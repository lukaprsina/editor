import { realmPlugin } from '../../RealmWithPlugins'
import { HorizontalRuleNode, INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode.js'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin.js'
import { Action, withLatestFrom } from '@mdxeditor/gurx'
import { activeEditor$, addComposerChild$, addExportVisitor$, addImportVisitor$, addLexicalNode$ } from '../core'
import { LexicalThematicBreakVisitor } from './LexicalThematicBreakVisitor'
import { MdastThematicBreakVisitor } from './MdastThematicBreakVisitor'

export const insertThematicBreak$ = Action((r) => {
  r.sub(r.pipe(insertThematicBreak$, withLatestFrom(activeEditor$)), ([, theEditor]) => {
    theEditor?.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
  })
})

export const thematicBreakPlugin = realmPlugin({
  init(realm) {
    realm.pubIn({
      [addImportVisitor$]: MdastThematicBreakVisitor,
      [addLexicalNode$]: HorizontalRuleNode,
      [addExportVisitor$]: LexicalThematicBreakVisitor,
      [addComposerChild$]: HorizontalRulePlugin
    })
  }
})
