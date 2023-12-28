import { realmPlugin } from '@/RealmWithPlugins'
import { Cell, Signal, map } from '@mdxeditor/gurx'
import { appendCodeBlockEditorDescriptor$, insertCodeBlock$ } from '../codeblock'
import { CodeMirrorEditor } from './CodeMirrorEditor'

export const codeBlockLanguages$ = Cell({
  js: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TypeScript (React)',
  jsx: 'JavaScript (React)',
  css: 'CSS'
})

export const insertCodeMirror$ = Signal<{ language: string; code: string }>((r) => {
  r.link(
    r.pipe(
      insertCodeMirror$,
      map(({ language, code }) => {
        return {
          code: code,
          language,
          meta: ''
        }
      })
    ),
    insertCodeBlock$
  )
})

export const codeMirrorPlugin = realmPlugin<{ codeBlockLanguages: Record<string, string> }>({
  update(r, params) {
    r.pub(codeBlockLanguages$, params?.codeBlockLanguages)
  },

  init(r, params) {
    r.pub(appendCodeBlockEditorDescriptor$, {
      match(language, meta) {
        return Boolean(params?.codeBlockLanguages.hasOwnProperty(language)) && meta === ''
      },
      priority: 1,
      Editor: CodeMirrorEditor
    })
  }
})
