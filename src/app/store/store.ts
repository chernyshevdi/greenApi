import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit'
import { resetChats } from '@/entities/chat'
import { resetMessages } from '@/entities/message'
import { setCredentials } from '@/entities/session'
import { loadPersistedState } from './persistence'
import type { PersistedState } from './persistence'
import { rootReducer } from './rootReducer'
import type { RootState } from './rootReducer'

export function createAppStore(persisted: PersistedState = loadPersistedState()) {
  // Чаты принадлежат инстансу: при входе в другой инстанс старые чаты очищаются
  // (форма входа заранее предупреждает об этом).
  const listener = createListenerMiddleware()
  listener.startListening({
    actionCreator: setCredentials,
    effect: ({ payload }, api) => {
      const previousOwner = (api.getOriginalState() as RootState).session.chatsOwner
      if (previousOwner && previousOwner !== payload.idInstance) {
        api.dispatch(resetChats())
        api.dispatch(resetMessages())
      }
    },
  })

  return configureStore({
    reducer: rootReducer,
    preloadedState: persisted.preloadedState,
    middleware: (getDefault) => getDefault().prepend(listener.middleware),
  })
}

export type AppStore = ReturnType<typeof createAppStore>
export type AppDispatch = AppStore['dispatch']
