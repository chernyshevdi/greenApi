import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, it } from 'vitest'
import {
  resetSession,
  selectChatsOwner,
  selectCredentials,
  selectIsAuthorized,
  sessionSlice,
  setCredentials,
} from '.'

const credentials = { idInstance: '1', apiTokenInstance: 't', apiUrl: 'https://api.green-api.com' }
const makeStore = () => configureStore({ reducer: { session: sessionSlice.reducer } })

describe('sessionSlice', () => {
  it('starts unauthorized', () => {
    const state = makeStore().getState()
    expect(selectCredentials(state)).toBeNull()
    expect(selectIsAuthorized(state)).toBe(false)
  })

  it('stores and resets credentials', () => {
    const store = makeStore()
    store.dispatch(setCredentials(credentials))
    expect(selectCredentials(store.getState())).toEqual(credentials)
    expect(selectIsAuthorized(store.getState())).toBe(true)

    store.dispatch(resetSession())
    expect(selectCredentials(store.getState())).toBeNull()
  })

  it('remembers the chats owner after the session ends', () => {
    const store = makeStore()
    expect(selectChatsOwner(store.getState())).toBeNull()

    store.dispatch(setCredentials(credentials))
    expect(selectChatsOwner(store.getState())).toBe('1')

    store.dispatch(resetSession())
    expect(selectCredentials(store.getState())).toBeNull()
    expect(selectChatsOwner(store.getState())).toBe('1')
  })
})
