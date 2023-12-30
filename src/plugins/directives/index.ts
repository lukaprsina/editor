import { realmPlugin } from '../../RealmWithPlugins'
import {
  addExportVisitor$,
  addImportVisitor$,
  addLexicalNode$,
  addMdastExtension$,
  addSyntaxExtension$,
  addToMarkdownExtension$,
  insertDecoratorNode$
} from '../core'
import { Cell, Signal, map } from '@mdxeditor/gurx'
import { LexicalEditor } from 'lexical'
import { Directive, directiveFromMarkdown, directiveToMarkdown } from 'mdast-util-directive'
import { directive } from 'micromark-extension-directive'
import { $createDirectiveNode, DirectiveNode } from './DirectiveNode'
import { DirectiveVisitor } from './DirectiveVisitor'
import { MdastDirectiveVisitor } from './MdastDirectiveVisitor'
export * from './DirectiveNode'

/**
 * Implement this interface to create a custom editor for markdown directives.
 * Pass the object in the `directivesPlugin` parameters.
 */
export interface DirectiveDescriptor<T extends Directive = Directive> {
  /**
   * Whether the descriptor's Editor should be used for the given node.
   * @param node - The directive mdast node. You can code your logic against the node's name, type, attributes, children, etc.
   */
  testNode(node: Directive): boolean
  /**
   * The name of the descriptor - use this if you're building UI for the user to select a directive.
   */
  name: string
  /**
   * The attributes that the directive has. This can be used when building the UI for the user to configure a directive. The {@link GenericDirectiveEditor} uses those to display a property form.
   */
  attributes: string[]
  /**
   * Whether or not the directive has inner markdown content as children. Used by the {@link GenericDirectiveEditor} to determine whether to show the inner markdown editor.
   */
  hasChildren: boolean
  /**
   * The type of the supported directive. Can be one of: 'leafDirective' | 'containerDirective' | 'textDirective'.
   */
  type?: 'leafDirective' | 'containerDirective' | 'textDirective'
  /**
   * The React component to be used as an Editor. See {@link DirectiveEditorProps} for the props passed to the component.
   */
  Editor: React.ComponentType<DirectiveEditorProps<T>>
}

/**
 * The properties passed to the {@link DirectiveDescriptor.Editor} component.
 */
export interface DirectiveEditorProps<T extends Directive = Directive> {
  /**
   * The mdast directive node.
   */
  mdastNode: T
  /**
   * The parent lexical editor - use this if you are dealing with the Lexical APIs.
   */
  parentEditor: LexicalEditor
  /**
   * The Lexical directive node.
   */
  lexicalNode: DirectiveNode
  /**
   * The descriptor that activated the editor
   */
  descriptor: DirectiveDescriptor
}

export interface InsertDirectivePayload {
  type: Directive['type']
  name: string
  attributes?: Directive['attributes']
}

export const directiveDescriptors$ = Cell<DirectiveDescriptor<any>[]>([])
export const insertDirective$ = Signal<InsertDirectivePayload>((r) => {
  r.link(
    r.pipe(
      insertDirective$,
      map((payload) => {
        return () => $createDirectiveNode({ children: [], ...payload })
      })
    ),
    insertDecoratorNode$
  )
})

/**
 * The parameters used to configure the `directivesPlugin` function.
 */
export interface DirectivesPluginParams {
  /**
   * Use this to register your custom directive editors. You can also use the built-in {@link GenericDirectiveEditor}.
   */
  directiveDescriptors: DirectiveDescriptor<any>[]
}

/**
 * The plugin that adds support for markdown directives.
 */
export const directivesPlugin = realmPlugin<DirectivesPluginParams>({
  update: (realm, params) => {
    realm.pub(directiveDescriptors$, params?.directiveDescriptors || [])
  },

  init: (realm) => {
    realm.pubIn({
      // import
      [addMdastExtension$]: directiveFromMarkdown,
      [addSyntaxExtension$]: directive(),
      [addImportVisitor$]: MdastDirectiveVisitor,
      // export
      [addLexicalNode$]: DirectiveNode,
      [addExportVisitor$]: DirectiveVisitor,
      [addToMarkdownExtension$]: directiveToMarkdown
    })
  }
})
