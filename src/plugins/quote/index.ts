import { QuoteNode } from '@lexical/rich-text'
import { MdastBlockQuoteVisitor } from './MdastBlockQuoteVisitor'
import { LexicalQuoteVisitor } from './LexicalQuoteVisitor'
import { realmPlugin } from '../../RealmWithPlugins'
import { addActivePlugin$, addImportVisitor$, addLexicalNode$, addExportVisitor$ } from '../core'

export const quotePlugin = realmPlugin({
  init(realm) {
    realm.pubIn({
      [addActivePlugin$]: 'quote',
      [addImportVisitor$]: MdastBlockQuoteVisitor,
      [addLexicalNode$]: QuoteNode,
      [addExportVisitor$]: LexicalQuoteVisitor
    })
  }
})
