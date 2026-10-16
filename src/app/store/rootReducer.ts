import { combineReducers } from '@reduxjs/toolkit'
import { chatsSlice } from '@/entities/chat'
import { connectionSlice } from '@/entities/connection'
import { messagesSlice } from '@/entities/message'
import { sessionSlice } from '@/entities/session'

// Ключи должны совпадать с reducerPath слайсов: селекторы сущностей читают state.<name>.
export const rootReducer = combineReducers({
  [sessionSlice.reducerPath]: sessionSlice.reducer,
  [chatsSlice.reducerPath]: chatsSlice.reducer,
  [messagesSlice.reducerPath]: messagesSlice.reducer,
  [connectionSlice.reducerPath]: connectionSlice.reducer,
})

export type RootState = ReturnType<typeof rootReducer>
