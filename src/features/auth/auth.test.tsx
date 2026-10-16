import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChat, chatsSlice } from '@/entities/chat'
import { addMessage, messagesSlice } from '@/entities/message'
import { resetSession, selectCredentials, sessionSlice, setCredentials } from '@/entities/session'
import { LoginForm, logout, validateLogin } from '.'

const fetchMock = vi.fn()

function reply(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))
}

const makeStore = () =>
  configureStore({
    reducer: {
      session: sessionSlice.reducer,
      chats: chatsSlice.reducer,
      messages: messagesSlice.reducer,
    },
  })

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('validateLogin', () => {
  const valid = { idInstance: '4100000001', apiTokenInstance: 'tok', apiUrl: 'https://x.io' }

  it('accepts valid values', () => {
    expect(validateLogin(valid)).toEqual({})
  })

  it('reports every invalid field', () => {
    const errors = validateLogin({ idInstance: 'abc', apiTokenInstance: '', apiUrl: 'ftp://x' })
    expect(Object.keys(errors).sort()).toEqual(['apiTokenInstance', 'apiUrl', 'idInstance'])
  })

  it('requires idInstance', () => {
    expect(validateLogin({ ...valid, idInstance: '' }).idInstance).toBe('Введите idInstance')
  })
})

describe('LoginForm', () => {
  function setup() {
    const store = makeStore()
    render(
      <Provider store={store}>
        <LoginForm />
      </Provider>,
    )
    return store
  }

  async function fill(id = '4100000001', token = 'tok') {
    await userEvent.type(screen.getByLabelText('idInstance'), id)
    await userEvent.type(screen.getByLabelText('apiTokenInstance'), token)
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))
  }

  it('shows validation errors without a request', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(screen.getByText('Введите idInstance')).toBeInTheDocument()
    expect(screen.getByText('Введите apiTokenInstance')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores credentials when the instance is authorized', async () => {
    reply({ stateInstance: 'authorized' })
    const store = setup()
    await fill('  4100000001 ', ' tok ')

    await waitFor(() =>
      expect(selectCredentials(store.getState())).toMatchObject({
        idInstance: '4100000001',
        apiTokenInstance: 'tok',
      }),
    )
    expect(fetchMock.mock.calls[0][0]).toContain('/waInstance4100000001/getStateInstance/tok')
  })

  it('shows an error for wrong credentials and stays logged out', async () => {
    reply({}, 401)
    const store = setup()
    await fill()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Неверный idInstance или apiTokenInstance',
    )
    expect(selectCredentials(store.getState())).toBeNull()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled()
  })

  it('rejects a not authorized instance with a hint', async () => {
    reply({ stateInstance: 'notAuthorized' })
    const store = setup()
    await fill()

    expect(await screen.findByRole('alert')).toHaveTextContent('не авторизован в Telegram')
    expect(selectCredentials(store.getState())).toBeNull()
  })

  it('shows a network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    setup()
    await fill()
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с сервером')
  })
})

describe('logout', () => {
  it('clears credentials, chats and messages', async () => {
    reply({ stateInstance: 'authorized' })
    const store = makeStore()
    const { loginThunk } = await import('.')
    await store.dispatch(
      loginThunk({ idInstance: '1', apiTokenInstance: 't', apiUrl: 'https://api.green-api.com' }),
    )
    store.dispatch(addChat({ chatId: 'c', title: 'A' }))
    store.dispatch(addMessage({ id: 'm', chatId: 'c', text: 'x', direction: 'in', timestamp: 1 }))

    store.dispatch(logout())

    const state = store.getState()
    expect(state.session.credentials).toBeNull()
    expect(state.chats.items).toEqual([])
    expect(state.messages.byChatId).toEqual({})
  })
})

describe('LoginForm: warning about deleting chats of another instance', () => {
  function setupWithChats(owner: string | null) {
    const store = makeStore()
    store.dispatch(addChat({ chatId: 'c1', title: 'Anna' }))
    store.dispatch(addChat({ chatId: 'c2', title: 'Boris' }))
    if (owner) {
      store.dispatch(
        setCredentials({ idInstance: owner, apiTokenInstance: 't', apiUrl: 'https://x.io' }),
      )
      store.dispatch(resetSession())
    }
    render(
      <Provider store={store}>
        <LoginForm />
      </Provider>,
    )
    return store
  }

  const idField = () => screen.getByLabelText('idInstance')

  it('warns when the entered instance differs from the owner of saved chats', async () => {
    setupWithChats('4100000001')
    expect(screen.queryByRole('note')).toBeNull()

    await userEvent.type(idField(), '4100000002')
    expect(screen.getByRole('note')).toHaveTextContent(
      'сохранены чаты инстанса 4100000001 (2 чата)',
    )
    expect(screen.getByRole('note')).toHaveTextContent('инстанс 4100000002 они будут удалены')
    expect(screen.getByRole('button', { name: 'Войти и удалить чаты' })).toBeInTheDocument()
  })

  it('does not warn for the same instance', async () => {
    setupWithChats('4100000001')
    await userEvent.type(idField(), '4100000001')
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
  })

  it('does not warn when there are no saved chats', async () => {
    const store = makeStore()
    store.dispatch(
      setCredentials({ idInstance: '4100000001', apiTokenInstance: 't', apiUrl: 'https://x.io' }),
    )
    store.dispatch(resetSession())
    render(
      <Provider store={store}>
        <LoginForm />
      </Provider>,
    )
    await userEvent.type(idField(), '4100000002')
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('does not warn on a fresh device (unknown owner)', async () => {
    setupWithChats(null)
    await userEvent.type(idField(), '4100000002')
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('does not delete anything when login fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    const store = setupWithChats('4100000001')
    await userEvent.type(idField(), '4100000002')
    await userEvent.type(screen.getByLabelText('apiTokenInstance'), 'bad')
    await userEvent.click(screen.getByRole('button', { name: 'Войти и удалить чаты' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный')
    expect(store.getState().chats.items).toHaveLength(2)
  })
})
