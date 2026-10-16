import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  addMessage,
  MessageBubble,
  messagesSlice,
  parseIncomingMessage,
  selectMessages,
  updateMessage,
} from '.'
import type { Message } from '.'
import type { NotificationBody } from '@/shared/api'

const msg = (over: Partial<Message> = {}): Message => ({
  id: 'm1',
  chatId: 'c1',
  text: 'hello',
  direction: 'out',
  timestamp: 1763115112,
  status: 'sending',
  ...over,
})

const makeStore = () => configureStore({ reducer: { messages: messagesSlice.reducer } })

describe('messagesSlice', () => {
  it('dedupes by id within a chat', () => {
    const store = makeStore()
    store.dispatch(addMessage(msg()))
    store.dispatch(addMessage(msg()))
    expect(selectMessages('c1')(store.getState())).toHaveLength(1)
  })

  it('allows the same id in different chats', () => {
    const store = makeStore()
    store.dispatch(addMessage(msg()))
    store.dispatch(addMessage(msg({ chatId: 'c2' })))
    expect(selectMessages('c2')(store.getState())).toHaveLength(1)
  })

  it('replaces local id and status after send', () => {
    const store = makeStore()
    store.dispatch(addMessage(msg({ id: 'local-1' })))
    store.dispatch(
      updateMessage({ chatId: 'c1', id: 'local-1', changes: { id: 'server-1', status: 'sent' } }),
    )
    expect(selectMessages('c1')(store.getState())[0]).toMatchObject({
      id: 'server-1',
      status: 'sent',
    })
  })

  it('keeps local id if server id already exists (no duplicates)', () => {
    const store = makeStore()
    store.dispatch(addMessage(msg({ id: 'local-1' })))
    store.dispatch(addMessage(msg({ id: 'server-1' })))
    store.dispatch(updateMessage({ chatId: 'c1', id: 'local-1', changes: { id: 'server-1' } }))
    expect(selectMessages('c1')(store.getState()).map((m) => m.id)).toEqual(['local-1', 'server-1'])
  })

  it('returns a stable empty array for unknown chats', () => {
    const store = makeStore()
    expect(selectMessages('x')(store.getState())).toBe(selectMessages(null)(store.getState()))
  })
})

describe('parseIncomingMessage', () => {
  const valid: NotificationBody = {
    typeWebhook: 'incomingMessageReceived',
    timestamp: 1763115112,
    idMessage: 'id-1',
    senderData: { chatId: '10000000', chatName: 'Василиса', senderName: 'Василиса Премудрая' },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
  }

  it('parses incoming text message', () => {
    expect(parseIncomingMessage(valid)).toEqual({
      chatTitle: 'Василиса',
      message: {
        id: 'id-1',
        chatId: '10000000',
        text: 'Привет',
        direction: 'in',
        timestamp: 1763115112,
      },
    })
  })

  it('parses text with a link (extendedTextMessage)', () => {
    const body: NotificationBody = {
      ...valid,
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'Смотри https://example.com' },
      },
    }
    expect(parseIncomingMessage(body)?.message.text).toBe('Смотри https://example.com')
  })

  it('returns null for extendedTextMessage without text', () => {
    const body: NotificationBody = {
      ...valid,
      messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: '' } },
    }
    expect(parseIncomingMessage(body)).toBeNull()
  })

  it('falls back to phone, then chatId for title', () => {
    const phone = { ...valid, senderData: { chatId: '1', senderPhoneNumber: 79876543210 } }
    expect(parseIncomingMessage(phone)?.chatTitle).toBe('79876543210')
    const bare = { ...valid, senderData: { chatId: '1' } }
    expect(parseIncomingMessage(bare)?.chatTitle).toBe('1')
  })

  it.each([
    ['other webhook type', { ...valid, typeWebhook: 'outgoingMessageStatus' }],
    ['non-text message', { ...valid, messageData: { typeMessage: 'imageMessage' } }],
    [
      'empty text',
      {
        ...valid,
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: '' } },
      },
    ],
    ['no idMessage', { ...valid, idMessage: undefined }],
    ['no senderData', { ...valid, senderData: undefined }],
  ])('returns null for %s', (_, body) => {
    expect(parseIncomingMessage(body)).toBeNull()
  })
})

describe('MessageBubble', () => {
  it('shows text and delivery status for outgoing', () => {
    render(<MessageBubble message={msg({ status: 'sent' })} />)
    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Отправлено' })).toBeInTheDocument()
  })

  it('shows no status for incoming', () => {
    render(<MessageBubble message={msg({ direction: 'in', status: undefined })} />)
    expect(screen.queryByRole('img')).toBeNull()
  })
})
