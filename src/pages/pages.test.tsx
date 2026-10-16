import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'
import { addChat, chatsSlice, selectActiveChatId } from '@/entities/chat'
import { connectionSlice } from '@/entities/connection'
import { messagesSlice } from '@/entities/message'
import { selectCredentials, sessionSlice, setCredentials } from '@/entities/session'
import { ChatPage } from './chat'
import { LoginPage } from './login'

function makeStore() {
  const store = configureStore({
    reducer: {
      chats: chatsSlice.reducer,
      messages: messagesSlice.reducer,
      session: sessionSlice.reducer,
      connection: connectionSlice.reducer,
    },
  })
  store.dispatch(
    setCredentials({ idInstance: '1', apiTokenInstance: 't', apiUrl: 'https://api.green-api.com' }),
  )
  return store
}

describe('LoginPage', () => {
  it('renders the login form', () => {
    render(
      <Provider store={makeStore()}>
        <LoginPage />
      </Provider>,
    )
    expect(screen.getByLabelText('idInstance')).toBeInTheDocument()
    expect(screen.getByLabelText('apiTokenInstance')).toBeInTheDocument()
  })
})

describe('ChatPage', () => {
  function setup() {
    const store = makeStore()
    store.dispatch(addChat({ chatId: 'c1', title: 'Anna' }))
    const { container } = render(
      <Provider store={store}>
        <ChatPage />
      </Provider>,
    )
    return { store, root: container.firstElementChild as HTMLElement }
  }

  it('marks the layout as chat-open and goes back to the list', async () => {
    const { store, root } = setup()
    expect(root).toHaveAttribute('data-chat-open', 'false')

    await userEvent.click(screen.getByRole('button', { name: /Anna/ }))
    expect(root).toHaveAttribute('data-chat-open', 'true')
    expect(screen.getByLabelText('Сообщение')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'К списку чатов' }))
    expect(selectActiveChatId(store.getState())).toBeNull()
    expect(root).toHaveAttribute('data-chat-open', 'false')
  })

  it('logs out: clears session and chats', async () => {
    const { store } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(selectCredentials(store.getState())).toBeNull()
    expect(store.getState().chats.items).toEqual([])
  })
})
