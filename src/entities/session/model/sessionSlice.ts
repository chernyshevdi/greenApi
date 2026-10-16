import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { Credentials } from '@/shared/api'

export interface SessionState {
  credentials: Credentials | null
  /**
   * idInstance, которому принадлежат чаты, сохранённые на устройстве. Переживает окончание
   * сессии (401), чтобы чаты вернулись при входе в тот же инстанс, и нужен, чтобы
   * предупредить об их удалении при входе в другой.
   */
  chatsOwner: string | null
}

export const initialSessionState: SessionState = { credentials: null, chatsOwner: null }

export const sessionSlice = createSlice({
  name: 'session',
  initialState: initialSessionState,
  reducers: {
    setCredentials(state, { payload }: PayloadAction<Credentials>) {
      state.credentials = payload
      state.chatsOwner = payload.idInstance
    },
    /** Завершает сессию, но помнит владельца чатов (см. chatsOwner). */
    resetSession(state) {
      state.credentials = null
    },
  },
  selectors: {
    selectCredentials: (state) => state.credentials,
    selectChatsOwner: (state) => state.chatsOwner,
    selectIsAuthorized: (state) => state.credentials !== null,
  },
})

export const { setCredentials, resetSession } = sessionSlice.actions
export const { selectChatsOwner, selectCredentials, selectIsAuthorized } = sessionSlice.selectors
