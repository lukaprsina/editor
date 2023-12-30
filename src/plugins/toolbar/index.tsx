import { realmPlugin } from '../../RealmWithPlugins'
import { Cell, useCellValues } from '@mdxeditor/gurx'
import React from 'react'
import { addTopAreaChild$, readOnly$ } from '../core'
import { Root } from './primitives/toolbar'

export const toolbarContents$ = Cell<() => React.ReactNode>(() => null)

const DEFAULT_TOOLBAR_CONTENTS = () => {
  return 'This is an empty toolbar. Pass `{toolbarContents: () => { return <>toolbar components</> }}` to the toolbarPlugin to customize it.'
}

export const toolbarPlugin = realmPlugin<{ toolbarContents: () => React.ReactNode }>({
  init(realm, params) {
    realm.pubIn({
      [toolbarContents$]: params?.toolbarContents ?? DEFAULT_TOOLBAR_CONTENTS,
      [addTopAreaChild$]: () => {
        const [toolbarContents, readOnly] = useCellValues(toolbarContents$, readOnly$)
        return <Root readOnly={readOnly}>{toolbarContents()}</Root>
      }
    })
  }
})
