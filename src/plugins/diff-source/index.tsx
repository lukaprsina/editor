import { Extension } from '@codemirror/state'
import { ViewMode, addEditorWrapper$, viewMode$ } from '../core'
import { DiffSourceWrapper } from './DiffSourceWrapper'
import { Cell } from '@mdxeditor/gurx'
import { realmPlugin } from '@/RealmWithPlugins'

export const diffMarkdown$ = Cell('')
export const cmExtensions$ = Cell<Extension[]>([])

export interface DiffSourcePluginParams {
  viewMode?: ViewMode
  diffMarkdown?: string
  codeMirrorExtensions?: Extension[]
}

export const diffSourcePlugin = realmPlugin({
  update: (r, params?: DiffSourcePluginParams) => {
    r.pub(diffMarkdown$, params?.diffMarkdown || '')
  },

  init(r, params?: DiffSourcePluginParams) {
    r.pubIn({
      [diffMarkdown$]: params?.diffMarkdown || '',
      [cmExtensions$]: params?.codeMirrorExtensions || [],
      [addEditorWrapper$]: DiffSourceWrapper,
      [viewMode$]: params?.viewMode || 'rich-text'
    })
  }
})
