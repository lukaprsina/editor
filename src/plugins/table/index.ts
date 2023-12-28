import { realmPlugin } from '@/RealmWithPlugins'
import { Signal, map } from '@mdxeditor/gurx'
import * as Mdast from 'mdast'
import { gfmTableFromMarkdown, gfmTableToMarkdown } from 'mdast-util-gfm-table'
import { gfmTable } from 'micromark-extension-gfm-table'
import {
  addExportVisitor$,
  addImportVisitor$,
  addLexicalNode$,
  addMdastExtension$,
  addSyntaxExtension$,
  addToMarkdownExtension$,
  insertDecoratorNode$
} from '../core'
import { LexicalTableVisitor } from './LexicalTableVisitor'
import { MdastTableVisitor } from './MdastTableVisitor'
import { $createTableNode, TableNode } from './TableNode'

type InsertTablePayload = {
  /**
   * The nunber of rows of the table.
   */
  rows?: number
  /**
   * The nunber of columns of the table.
   */
  columns?: number
}

function seedTable(rows: number = 1, columns: number = 1): Mdast.Table {
  const table: Mdast.Table = {
    type: 'table',
    children: []
  }

  for (let i = 0; i < rows; i++) {
    const tableRow: Mdast.TableRow = {
      type: 'tableRow',
      children: []
    }

    for (let j = 0; j < columns; j++) {
      const cell: Mdast.TableCell = {
        type: 'tableCell',
        children: []
      }
      tableRow.children.push(cell)
    }

    table.children.push(tableRow)
  }

  return table
}

export const insertTable$ = Signal<InsertTablePayload>((r) => {
  r.link(
    r.pipe(
      insertTable$,
      map(({ rows, columns }) => {
        return () => $createTableNode(seedTable(rows, columns))
      })
    ),
    insertDecoratorNode$
  )
})

export const tablePlugin = realmPlugin({
  init(realm) {
    realm.pubIn({
      // import
      [addMdastExtension$]: gfmTableFromMarkdown,
      [addSyntaxExtension$]: gfmTable,
      [addImportVisitor$]: MdastTableVisitor,
      // export
      [addLexicalNode$]: TableNode,
      [addExportVisitor$]: LexicalTableVisitor,
      [addToMarkdownExtension$]: gfmTableToMarkdown({ tableCellPadding: true, tablePipeAlign: true })
    })
  }
})
