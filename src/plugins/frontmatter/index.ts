import { realmPlugin } from '@/RealmWithPlugins'
import {
  addExportVisitor$,
  addImportVisitor$,
  addLexicalNode$,
  addMdastExtension$,
  addSyntaxExtension$,
  addToMarkdownExtension$,
  createRootEditorSubscription$,
  rootEditor$
} from '@/plugins/core'
import { Cell, Signal, withLatestFrom } from '@mdxeditor/gurx'
import { $getRoot } from 'lexical'
import { frontmatterFromMarkdown, frontmatterToMarkdown } from 'mdast-util-frontmatter'
import { frontmatter } from 'micromark-extension-frontmatter'
import { $createFrontmatterNode, $isFrontmatterNode, FrontmatterNode } from './FrontmatterNode'
import { LexicalFrontmatterVisitor } from './LexicalFrontmatterVisitor'
import { MdastFrontmatterVisitor } from './MdastFrontmatterVisitor'

export const frontmatterDialogOpen$ = Cell(false)

export const insertFrontmatter$ = Signal<true>((r) => {
  r.sub(r.pipe(insertFrontmatter$, withLatestFrom(rootEditor$)), ([, rootEditor]) => {
    rootEditor?.update(() => {
      const firstItem = $getRoot().getFirstChild()
      if (!$isFrontmatterNode(firstItem)) {
        const fmNode = $createFrontmatterNode('"": ""')
        if (firstItem) {
          firstItem.insertBefore(fmNode)
        } else {
          $getRoot().append(fmNode)
        }
      }
    })
    r.pub(frontmatterDialogOpen$, true)
  })
})

export const removeFrontmatter$ = Signal<true>((r) => {
  r.sub(r.pipe(removeFrontmatter$, withLatestFrom(rootEditor$)), ([, rootEditor]) => {
    rootEditor?.update(() => {
      const firstItem = $getRoot().getFirstChild()
      if ($isFrontmatterNode(firstItem)) {
        firstItem.remove()
      }
    })
    r.pub(frontmatterDialogOpen$, false)
  })
})

export const hasFrontmatter$ = Cell(false, (r) => {
  r.pub(createRootEditorSubscription$, (rootEditor) => {
    return rootEditor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        r.pub(hasFrontmatter$, $isFrontmatterNode($getRoot().getFirstChild()))
      })
    })
  })
})

export const frontmatterPlugin = realmPlugin({
  init: (realm) => {
    realm.pubIn({
      [addMdastExtension$]: frontmatterFromMarkdown('yaml'),
      [addSyntaxExtension$]: frontmatter(),
      [addLexicalNode$]: FrontmatterNode,
      [addImportVisitor$]: MdastFrontmatterVisitor,
      [addExportVisitor$]: LexicalFrontmatterVisitor,
      [addToMarkdownExtension$]: frontmatterToMarkdown('yaml')
    })
  }
})
