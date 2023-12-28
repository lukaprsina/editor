import { realmPlugin } from '@/RealmWithPlugins'
import { InitialEditorStateType } from '@lexical/react/LexicalComposer.js'
import { createEmptyHistoryState } from '@lexical/react/LexicalHistoryPlugin.js'
import { $isHeadingNode, HeadingTagType } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $findMatchingParent, $insertNodeToNearestRoot, $wrapNodeInElement } from '@lexical/utils'
import { Cell, NodeRef, Realm, Signal, filter, scan, withLatestFrom } from '@mdxeditor/gurx'
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isDecoratorNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $setSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  DecoratorNode,
  ElementNode,
  FOCUS_COMMAND,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
  Klass,
  LexicalEditor,
  LexicalNode,
  ParagraphNode,
  RangeSelection,
  SELECTION_CHANGE_COMMAND,
  TextFormatType,
  TextNode,
  createCommand
} from 'lexical'
import * as Mdast from 'mdast'
import { mdxJsxFromMarkdown, mdxJsxToMarkdown } from 'mdast-util-mdx-jsx'
import { mdxJsx } from 'micromark-extension-mdx-jsx'
import React from 'react'
import { LexicalConvertOptions, exportMarkdownFromLexical } from '../../exportMarkdownFromLexical'
import {
  MarkdownParseError,
  MarkdownParseOptions,
  MdastImportVisitor,
  UnrecognizedMarkdownConstructError,
  importMarkdownToLexical
} from '../../importMarkdownToLexical'
import { controlOrMeta } from '../../utils/detectMac'
import { noop } from '../../utils/fp'
import type { JsxComponentDescriptor } from '../jsx'
import { GenericHTMLNode } from './GenericHTMLNode'
import { type IconKey } from './Icon'
import { LexicalGenericHTMLVisitor } from './LexicalGenericHTMLNodeVisitor'
import { LexicalLinebreakVisitor } from './LexicalLinebreakVisitor'
import { LexicalParagraphVisitor } from './LexicalParagraphVisitor'
import { LexicalRootVisitor } from './LexicalRootVisitor'
import { LexicalTextVisitor } from './LexicalTextVisitor'
import { MdastBreakVisitor } from './MdastBreakVisitor'
import { MdastFormattingVisitor } from './MdastFormattingVisitor'
import { MdastHTMLVisitor } from './MdastHTMLVisitor'
import { MdastInlineCodeVisitor } from './MdastInlineCodeVisitor'
import { MdastParagraphVisitor } from './MdastParagraphVisitor'
import { MdastRootVisitor } from './MdastRootVisitor'
import { MdastTextVisitor } from './MdastTextVisitor'
import { SharedHistoryPlugin } from './SharedHistoryPlugin'

export * from './GenericHTMLNode'

/** @internal */
export type EditorSubscription = (activeEditor: LexicalEditor) => () => void
type Teardowns = (() => void)[]

/** @internal */
export type BlockType = 'paragraph' | 'quote' | HeadingTagType | ''

/**
 * The type of the editor being edited currently. Custom editors can override this, so that the toolbar can change contents.
 */
export interface EditorInFocus {
  editorType: string
  rootNode: LexicalNode | null
}

/** @internal */
export const NESTED_EDITOR_UPDATED_COMMAND = createCommand<void>('NESTED_EDITOR_UPDATED_COMMAND')

export const rootEditor$ = Cell<LexicalEditor | null>(null)
export const activeEditor$ = Cell<LexicalEditor | null>(null)
export const contentEditableClassName$ = Cell('')

export const readOnly$ = Cell(false, (r) => {
  r.sub(r.pipe(readOnly$, withLatestFrom(rootEditor$)), ([readOnly, rootEditor]) => {
    rootEditor?.setEditable(!readOnly)
  })
})

export const placeholder$ = Cell<React.ReactNode>('')
export const autoFocus$ = Cell<boolean | { defaultSelection?: 'rootStart' | 'rootEnd'; preventScroll?: boolean }>(false)
export const inFocus$ = Cell(false)
export const currentFormat$ = Cell(0)
export const markdownProcessingError$ = Cell<{ error: string; source: string } | null>(null)
export const markdownErrorSignal$ = Signal<{ error: string; source: string }>((r) => {
  r.link(
    r.pipe(
      markdownProcessingError$,
      filter((e) => e !== null)
    ),
    markdownErrorSignal$
  )
})

export const applyFormat$ = Signal<TextFormatType>((r) => {
  r.sub(r.pipe(applyFormat$, withLatestFrom(activeEditor$)), ([format, theEditor]) => {
    theEditor?.dispatchCommand(FORMAT_TEXT_COMMAND, format)
  })
})

export const currentSelection$ = Cell<RangeSelection | null>(null, (r) => {
  r.sub(r.pipe(currentSelection$, withLatestFrom(activeEditor$)), ([selection, theEditor]) => {
    if (!selection || !theEditor) {
      return
    }

    const anchorNode = selection.anchor.getNode()
    let element =
      anchorNode.getKey() === 'root'
        ? anchorNode
        : $findMatchingParent(anchorNode, (e) => {
            const parent = e.getParent()
            return parent !== null && $isRootOrShadowRoot(parent)
          })

    if (element === null) {
      element = anchorNode.getTopLevelElementOrThrow()
    }

    const elementKey = element.getKey()
    const elementDOM = theEditor.getElementByKey(elementKey)

    if (elementDOM !== null) {
      const blockType = $isHeadingNode(element) ? element.getTag() : (element.getType() as BlockType)
      r.pub(currentBlockType$, blockType)
    }
  })
})

export const initialMarkdown$ = Cell('')

export const markdown$ = Cell('')
const markdownSignal$ = Signal<string>((r) => {
  r.link(markdown$, markdownSignal$)
  r.link(initialMarkdown$, markdown$)
})

// import configuration
export const importVisitors$ = Cell<MdastImportVisitor<Mdast.Content>[]>([])
export const syntaxExtensions$ = Cell<MarkdownParseOptions['syntaxExtensions']>([])
export const mdastExtensions$ = Cell<NonNullable<MarkdownParseOptions['mdastExtensions']>>([])

export const usedLexicalNodes$ = Cell<Klass<LexicalNode>[]>([])

// export configuration
export const exportVisitors$ = Cell<NonNullable<LexicalConvertOptions['visitors']>>([])
export const toMarkdownExtensions$ = Cell<NonNullable<LexicalConvertOptions['toMarkdownExtensions']>>([])
export const toMarkdownOptions$ = Cell<NonNullable<LexicalConvertOptions['toMarkdownOptions']>>({})

// the JSX plugin will fill in these
export const jsxIsAvailable$ = Cell(false)
export const jsxComponentDescriptors$ = Cell<JsxComponentDescriptor[]>([])

// used for the various popups, dialogs, and tooltips
export const editorRootElementRef$ = Cell<React.RefObject<HTMLDivElement> | null>(null)

export const addLexicalNode$ = Appender(usedLexicalNodes$)
export const addImportVisitor$ = Appender(importVisitors$)
export const addSyntaxExtension$ = Appender(syntaxExtensions$)
export const addMdastExtension$ = Appender(mdastExtensions$)
export const addExportVisitor$ = Appender(exportVisitors$)
export const addToMarkdownExtension$ = Appender(toMarkdownExtensions$)

export const setMarkdown$ = Signal<string>((r) => {
  r.sub(
    r.pipe(
      setMarkdown$,
      withLatestFrom(markdown$, rootEditor$, inFocus$),
      filter(([newMarkdown, oldMarkdown]) => {
        return newMarkdown.trim() !== oldMarkdown.trim()
      })
    ),
    ([theNewMarkdownValue, , editor, inFocus]) => {
      editor?.update(() => {
        $getRoot().clear()
        tryImportingMarkdown(r, theNewMarkdownValue)

        if (!inFocus) {
          $setSelection(null)
        } else {
          editor.focus()
        }
      })
    }
  )
})

function rebind() {
  return scan((teardowns, [subs, activeEditorValue]: [EditorSubscription[], LexicalEditor | null]) => {
    teardowns.forEach((teardown) => {
      if (!teardown) {
        throw new Error('You have a subscription that does not return a teardown')
      }
      teardown()
    })
    return activeEditorValue ? subs.map((s) => s(activeEditorValue)) : []
  }, [] as Teardowns)
}

export const activeEditorSubscriptions$ = Cell<EditorSubscription[]>([], (r) => {
  r.pipe(r.combine(activeEditorSubscriptions$, activeEditor$), rebind())
})

export const rootEditorSubscriptions$ = Cell<EditorSubscription[]>([], (r) => {
  r.pipe(r.combine(rootEditorSubscriptions$, rootEditor$), rebind())
})

export const editorInFocus$ = Cell<EditorInFocus | null>(null)
export const onBlur$ = Signal<FocusEvent>()

export const iconComponentFor$ = Cell<(name: IconKey) => React.ReactNode>((name: IconKey) => {
  throw new Error(`No icon component for ${name}`)
})

export function Appender<T>(cell$: NodeRef<T[]>, init?: (r: Realm, sig$: NodeRef<T | T[]>) => void) {
  return Signal<T | T[]>((r, sig$) => {
    r.changeWith(cell$, sig$, (values, newValue) => {
      if (!Array.isArray(newValue)) {
        newValue = [newValue]
      }
      let result = values

      for (const v of newValue) {
        if (!values.includes(v)) {
          result = [...result, v]
        }
      }
      return result
    })
    init?.(r, sig$)
  })
}

function handleSelectionChange(r: Realm) {
  const selection = $getSelection()
  if ($isRangeSelection(selection)) {
    r.pubIn({
      [currentSelection$]: selection,
      [currentFormat$]: selection.format
    })
  }
}

export const createRootEditorSubscription$ = Appender(rootEditorSubscriptions$, (r, sig$) => {
  // track the active editor - this is necessary for the nested editors
  r.pub(sig$, [
    (rootEditor) => {
      return rootEditor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_, theActiveEditor) => {
          r.pubIn({
            [activeEditor$]: theActiveEditor,
            [inFocus$]: true
          })
          // doing stuff root editor restores the focus state
          if (theActiveEditor._parentEditor === null) {
            theActiveEditor.getEditorState().read(() => {
              r.pub(editorInFocus$, {
                rootNode: $getRoot(),
                editorType: 'lexical'
              })
            })
          }
          handleSelectionChange(r)

          return false
        },
        COMMAND_PRIORITY_CRITICAL
      )
    },
    // Export handler
    (rootEditor) => {
      return rootEditor.registerUpdateListener(({ dirtyElements, dirtyLeaves, editorState }) => {
        const err = r.getValue(markdownProcessingError$)
        if (err !== null) {
          return
        }
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
          return
        }

        let theNewMarkdownValue!: string

        editorState.read(() => {
          theNewMarkdownValue = exportMarkdownFromLexical({
            root: $getRoot(),
            visitors: r.getValue(exportVisitors$),
            jsxComponentDescriptors: r.getValue(jsxComponentDescriptors$),
            toMarkdownExtensions: r.getValue(toMarkdownExtensions$),
            toMarkdownOptions: r.getValue(toMarkdownOptions$),
            jsxIsAvailable: r.getValue(jsxIsAvailable$)
          })
        })

        r.pub(markdown$, theNewMarkdownValue.trim())
      })
    },
    (rootEditor) => {
      return rootEditor.registerCommand(
        FOCUS_COMMAND,
        () => {
          r.pub(inFocus$, true)
          return false
        },
        COMMAND_PRIORITY_CRITICAL
      )
    },
    // Fixes select all when frontmatter is present
    (rootEditor) => {
      return rootEditor.registerCommand<KeyboardEvent>(
        KEY_DOWN_COMMAND,
        (event) => {
          const { keyCode, ctrlKey, metaKey } = event
          if (keyCode === 65 && controlOrMeta(metaKey, ctrlKey)) {
            let shouldOverride = false

            rootEditor.getEditorState().read(() => {
              shouldOverride = $isDecoratorNode($getRoot().getFirstChild()) || $isDecoratorNode($getRoot().getLastChild())
            })

            if (shouldOverride) {
              event.preventDefault()
              event.stopImmediatePropagation()
              rootEditor.update(() => {
                const rootElement = rootEditor.getRootElement() as HTMLDivElement
                window.getSelection()?.selectAllChildren(rootElement)
                rootElement.focus({
                  preventScroll: true
                })
              })
              return true
            }
          }

          return false
        },
        COMMAND_PRIORITY_CRITICAL
      )
    }
  ])
})

export const createActiveEditorSubscription$ = Appender(activeEditorSubscriptions$, (r, sig$) => {
  r.pub(sig$, [
    (editor) => {
      return editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          handleSelectionChange(r)
        })
      })
    },
    (editor) => {
      return editor.registerCommand(
        BLUR_COMMAND,
        (payload) => {
          const theRootEditor = r.getValue(rootEditor$)
          if (theRootEditor) {
            const movingOutside = !theRootEditor.getRootElement()?.contains(payload.relatedTarget as Node)
            if (movingOutside) {
              r.pubIn({
                [inFocus$]: false,
                [onBlur$]: payload
              })
            }
          }
          return false
        },
        COMMAND_PRIORITY_CRITICAL
      )
    }
  ])
})

function tryImportingMarkdown(r: Realm, markdownValue: string) {
  try {
    ////////////////////////
    // Import initial value
    ////////////////////////
    importMarkdownToLexical({
      root: $getRoot(),
      visitors: r.getValue(importVisitors$),
      mdastExtensions: r.getValue(mdastExtensions$),
      markdown: markdownValue,
      syntaxExtensions: r.getValue(syntaxExtensions$)
    })
    r.pub(markdownProcessingError$, null)
  } catch (e) {
    if (e instanceof MarkdownParseError || e instanceof UnrecognizedMarkdownConstructError) {
      r.pubIn({
        [markdown$]: markdownValue,
        [markdownProcessingError$]: {
          error: e.message,
          source: markdownValue
        }
      })
    } else {
      throw e
    }
  }
}

// gets bound to the root editor state getter
export const initialRootEditorState$ = Cell<InitialEditorStateType | null>(null, (r) => {
  r.pub(initialRootEditorState$, (theRootEditor) => {
    r.pub(rootEditor$, theRootEditor)
    r.pub(activeEditor$, theRootEditor)

    tryImportingMarkdown(r, r.getValue(initialMarkdown$))

    const autoFocusValue = r.getValue(autoFocus$)
    if (autoFocusValue) {
      if (autoFocusValue === true) {
        // Default 'on' state
        setTimeout(() => theRootEditor.focus(noop, { defaultSelection: 'rootStart' }))
        return
      }
      setTimeout(() =>
        theRootEditor.focus(noop, {
          defaultSelection: autoFocusValue.defaultSelection ?? 'rootStart'
        })
      )
    }
  })
})

export const composerChildren$ = Cell<React.ComponentType[]>([])
export const addComposerChild$ = Appender(composerChildren$)

export const topAreaChildren$ = Cell<React.ComponentType[]>([])
export const addTopAreaChild$ = Appender(topAreaChildren$)

export const editorWrappers$ = Cell<React.ComponentType<{ children: React.ReactNode }>[]>([])
export const addEditorWrapper$ = Appender(editorWrappers$)

export const nestedEditorChildren$ = Cell<React.ComponentType[]>([])
export const addNestedEditorChild$ = Appender(nestedEditorChildren$)

export const historyState$ = Cell(createEmptyHistoryState())

export const currentBlockType$ = Cell<BlockType | ''>('')
export const applyBlockType$ = Signal<BlockType>()

export const convertSelectionToNode$ = Signal<() => ElementNode>((r) => {
  r.sub(r.pipe(convertSelectionToNode$, withLatestFrom(activeEditor$)), ([factory, editor]) => {
    editor?.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, factory)
        setTimeout(() => {
          editor.focus()
        })
      }
    })
  })
})

export const insertDecoratorNode$ = Signal<() => DecoratorNode<unknown>>((r) => {
  r.sub(r.pipe(insertDecoratorNode$, withLatestFrom(activeEditor$)), ([nodeFactory, theEditor]) => {
    theEditor?.focus(
      () => {
        theEditor.getEditorState().read(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            const focusNode = selection.focus.getNode()

            if (focusNode !== null) {
              theEditor.update(() => {
                const node = nodeFactory()
                if (node.isInline()) {
                  $insertNodes([node])
                  if ($isRootOrShadowRoot(node.getParentOrThrow())) {
                    $wrapNodeInElement(node, $createParagraphNode).selectEnd()
                  }
                } else {
                  $insertNodeToNearestRoot(node)
                }
                if ('select' in node && typeof node.select === 'function') {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                  setTimeout(() => node.select())
                }
              })

              setTimeout(() => {
                theEditor.dispatchCommand(NESTED_EDITOR_UPDATED_COMMAND, undefined)
              })
            }
          }
        })
      },
      { defaultSelection: 'rootEnd' }
    )
  })
})

export type ViewMode = 'rich-text' | 'source' | 'diff'

export const viewMode$ = Cell<ViewMode>('rich-text', (r) => {
  r.sub(
    r.pipe(
      viewMode$,
      scan(
        (prev, next) => {
          return {
            current: prev.next,
            next
          }
        },
        { current: 'rich-text' as ViewMode, next: 'rich-text' as ViewMode }
      ),
      withLatestFrom(markdownSourceEditorValue$)
    ),
    ([{ current }, markdownSourceFromEditor]) => {
      if (current === 'source' || current === 'diff') {
        r.pub(setMarkdown$, markdownSourceFromEditor)
      }
    }
  )
})

export const markdownSourceEditorValue$ = Cell('', (r) => {
  r.link(markdown$, markdownSourceEditorValue$)
  r.link(markdownSourceEditorValue$, markdownSignal$)
})

export const activePlugins$ = Cell<string[]>([])
export const addActivePlugin$ = Appender(activePlugins$)

interface CorePluginParams {
  initialMarkdown: string
  contentEditableClassName: string
  placeholder?: React.ReactNode
  autoFocus: boolean | { defaultSelection?: 'rootStart' | 'rootEnd'; preventScroll?: boolean | undefined }
  onChange: (markdown: string) => void
  onBlur?: (e: FocusEvent) => void
  onError?: (payload: { error: string; source: string }) => void
  toMarkdownOptions: NonNullable<LexicalConvertOptions['toMarkdownOptions']>
  readOnly: boolean
  iconComponentFor: (name: IconKey) => React.ReactElement
  suppressHtmlProcessing?: boolean
}

export const corePlugin = realmPlugin<CorePluginParams>({
  init(r, params) {
    r.pubIn({
      [initialMarkdown$]: params?.initialMarkdown.trim(),
      [iconComponentFor$]: params?.iconComponentFor,
      [addImportVisitor$]: [
        MdastRootVisitor,
        MdastParagraphVisitor,
        MdastTextVisitor,
        MdastFormattingVisitor,
        MdastInlineCodeVisitor,
        MdastBreakVisitor
      ],
      [addLexicalNode$]: [ParagraphNode, TextNode, GenericHTMLNode],
      [addExportVisitor$]: [
        LexicalRootVisitor,
        LexicalParagraphVisitor,
        LexicalTextVisitor,
        LexicalLinebreakVisitor,
        LexicalGenericHTMLVisitor
      ],

      [addComposerChild$]: SharedHistoryPlugin
    })

    // Use the JSX extension to parse HTML
    if (!params?.suppressHtmlProcessing) {
      r.pubIn({
        [addMdastExtension$]: mdxJsxFromMarkdown(),
        [addSyntaxExtension$]: mdxJsx(),
        [addToMarkdownExtension$]: mdxJsxToMarkdown(),
        [addImportVisitor$]: MdastHTMLVisitor
      })
    }
  },

  update(realm, params) {
    realm.pubIn({
      [contentEditableClassName$]: params?.contentEditableClassName,
      [toMarkdownOptions$]: params?.toMarkdownOptions,
      [autoFocus$]: params?.autoFocus,
      [placeholder$]: params?.placeholder,
      [readOnly$]: params?.readOnly
    })

    realm.singletonSub(markdownSignal$, params?.onChange)
    realm.singletonSub(onBlur$, params?.onBlur)
    realm.singletonSub(markdownErrorSignal$, params?.onError)
  }
})
