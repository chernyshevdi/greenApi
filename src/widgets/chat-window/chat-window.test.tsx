import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChat, chatsSlice, selectChat } from '@/entities/chat'
import { addMessage, messagesSlice } from '@/entities/message'
import { sessionSlice, setCredentials } from '@/entities/session'
import { ChatWindow } from '.'

const fetchMock = vi.fn()
beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

function setup({ open = true, onBack }: { open?: boolean; onBack?: () => void } = {}) {
  const store = configureStore({
    reducer: {
      chats: chatsSlice.reducer,
      messages: messagesSlice.reducer,
      session: sessionSlice.reducer,
    },
  })
  store.dispatch(
    setCredentials({ idInstance: '1', apiTokenInstance: 't', apiUrl: 'https://api.green-api.com' }),
  )
  store.dispatch(addChat({ chatId: 'c1', title: 'Anna', phone: '79876543210' }))
  if (open) store.dispatch(selectChat('c1'))
  render(
    <Provider store={store}>
      <ChatWindow onBack={onBack} />
    </Provider>,
  )
  return store
}

describe('ChatWindow', () => {
  it('shows a placeholder when no chat is selected', () => {
    setup({ open: false })
    expect(screen.getByText(/Выберите чат/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Сообщение')).toBeNull()
  })

  it('shows header, empty state and the input for an empty chat', () => {
    setup()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('+79876543210')).toBeInTheDocument()
    expect(screen.getByText(/Нет сообщений/)).toBeInTheDocument()
    expect(screen.getByLabelText('Сообщение')).toBeInTheDocument()
  })

  it('renders messages of the active chat only', async () => {
    const store = setup()
    store.dispatch(
      addMessage({ id: '1', chatId: 'c1', text: 'hello', direction: 'in', timestamp: 1763115112 }),
    )
    store.dispatch(
      addMessage({ id: '2', chatId: 'other', text: 'secret', direction: 'in', timestamp: 1 }),
    )
    expect(await screen.findByText('hello')).toBeInTheDocument()
    expect(screen.queryByText('secret')).toBeNull()
    expect(screen.queryByText(/Нет сообщений/)).toBeNull()
  })

  it('sends a message and shows it in the log', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ idMessage: 'srv' })))
    setup()
    await userEvent.type(screen.getByLabelText('Сообщение'), 'Привет{Enter}')
    expect(await screen.findByText('Привет')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('img', { name: 'Отправлено' })).toBeInTheDocument())
  })

  it('offers retry for a failed message', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }))
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ idMessage: 'srv' })))
    setup()
    await userEvent.type(screen.getByLabelText('Сообщение'), 'hi{Enter}')
    await userEvent.click(await screen.findByRole('button', { name: 'Повторить' }))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Отправлено' })).toBeInTheDocument())
  })

  it('calls onBack from the header button', async () => {
    const onBack = vi.fn()
    setup({ onBack })
    await userEvent.click(screen.getByRole('button', { name: 'К списку чатов' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
