import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export interface ConnectionProblem {
  /** `config` — проблема в настройках инстанса, остальное — временные сбои связи. */
  kind: 'config' | 'network' | 'server' | 'rate_limit'
  message: string
}

export interface ConnectionState {
  problem: ConnectionProblem | null
}

export const initialConnectionState: ConnectionState = { problem: null }

/** Проблемы получения сообщений. В localStorage не сохраняется: определяется заново при каждом запуске. */
export const connectionSlice = createSlice({
  name: 'connection',
  initialState: initialConnectionState,
  reducers: {
    setConnectionProblem(state, { payload }: PayloadAction<ConnectionProblem | null>) {
      state.problem = payload
    },
  },
  selectors: {
    selectConnectionProblem: (state) => state.problem,
  },
})

export const { setConnectionProblem } = connectionSlice.actions
export const { selectConnectionProblem } = connectionSlice.selectors
