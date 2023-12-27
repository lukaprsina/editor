import React from 'react'
import { Realm, RealmContext } from '@mdxeditor/gurx'
import { tap } from './utils/fp'

export interface RealmPluginDefinition<Params> {
  init?: (realm: Realm, params: Params) => void
  update?: (realm: Realm, params: Params) => void
}

export interface RealmPlugin {
  init?: (realm: Realm) => void
  update?: (realm: Realm) => void
}

export function realmPlugin<Params>(plugin: RealmPluginDefinition<Params>): (params: Params) => RealmPlugin {
  return function (params: Params) {
    return {
      init: (realm: Realm) => plugin.init?.(realm, params),
      update: (realm: Realm) => plugin.update?.(realm, params)
    }
  }
}

export function RealmWithPlugins({ children, plugins }: { children: React.ReactNode; plugins: RealmPlugin[] }) {
  const theRealm = React.useMemo(() => {
    return tap(new Realm(), (r) => {
      for (const plugin of plugins) {
        plugin.init?.(r)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  for (const plugin of plugins) {
    plugin.update?.(theRealm)
  }

  return <RealmContext.Provider value={theRealm}>{children}</RealmContext.Provider>
}
