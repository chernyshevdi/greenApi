import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  addChat,
  chatsSlice,
  ChatItem,
  selectActiveChat,
  selectChat,
  selectChatList,
  touchChat,
} from '.'
import type { Chat } from '.'

const makeStore = () => configureStore({ reducer: { chats: chatsSlice.reducer } })

const incoming = (chatId: string, timestamp = 1000) => ({
  chatId,
  lastMessage: { text: 'hi', timestamp, direction: 'in' as const },
})

describe('chatsSlice', () => {
  it('adds a chat once', () => {
    const store = makeStore()
    store.dispatch(addChat({ chatId: '1', title: 'Anna' }))
    store.dispatch(addChat({ chatId: '1', title: 'Other' }))
    expect(store.getState().chats.items).toHaveLength(1)
    expect(store.getState().chats.items[0]).toMatchObject({ title: 'Anna', unread: 0 })
  })

  it('counts unread for incoming messages in a non-active chat only', () => {
    const store = makeStore()
    store.dispatch(addChat({ chatId: '1', title: 'A' }))
    store.dispatch(addChat({ chatId: '2', title: 'B' }))
    store.dispatch(selectChat('2'))

    store.dispatch(touchChat(incoming('1')))
    store.dispatch(touchChat(incoming('1')))
    store.dispatch(touchChat(incoming('2')))

    const [a, b] = store.getState().chats.items
    expect(a.unread).toBe(2)
    expect(b.unread).toBe(0)
  })

  it('does not count outgoing messages as unread', () => {
    const store = makeStore()
    store.dispatch(addChat({ chatId: '1', title: 'A' }))
    store.dispatch(
      touchChat({ chatId: '1', lastMessage: { text: 'x', timestamp: 1, direction: 'out' } }),
    )
    expect(store.getState().chats.items[0].unread).toBe(0)
  })

  it('resets unread when chat is selected', () => {
    const store = makeStore()
    store.dispatch(addChat({ chatId: '1', title: 'A' }))
    store.dispatch(touchChat(incoming('1')))
    store.dispatch(selectChat('1'))
    expect(store.getState().chats.items[0].unread).toBe(0)
    expect(selectActiveChat(store.getState())?.chatId).toBe('1')
  })

  it('ignores touchChat for unknown chat', () => {
    const store = makeStore()
    store.dispatch(touchChat(incoming('nope')))
    expect(store.getState().chats.items).toEqual([])
  })
})

describe('selectChatList', () => {
  it('sorts by last activity, newest first', () => {
    const store = makeStore()
    store.dispatch(addChat({ chatId: 'old', title: 'Old' }))
    store.dispatch(addChat({ chatId: 'new', title: 'New' }))
    store.dispatch(touchChat(incoming('old', 5_000_000_000)))
    store.dispatch(touchChat(incoming('new', 6_000_000_000)))
    expect(selectChatList(store.getState()).map((c) => c.chatId)).toEqual(['new', 'old'])
  })

  it('returns the same reference while state is unchanged', () => {
    const store = makeStore()
    store.dispatch(addChat({ chatId: '1', title: 'A' }))
    expect(selectChatList(store.getState())).toBe(selectChatList(store.getState()))
  })
})

describe('ChatItem', () => {
  const chat: Chat = {
    chatId: '1',
    title: 'Василиса Премудрая',
    unread: 3,
    createdAt: 0,
    lastMessage: { text: 'Привет', timestamp: 1763115112, direction: 'out' },
  }

  it('shows title, preview with "Вы:" prefix and unread badge', () => {
    render(<ChatItem chat={chat} />)
    expect(screen.getByText('Василиса Премудрая')).toBeInTheDocument()
    expect(screen.getByText('Вы: Привет')).toBeInTheDocument()
    expect(screen.getByLabelText('Непрочитанных: 3')).toHaveTextContent('3')
  })

  it('calls onClick with chatId', async () => {
    const onClick = vi.fn()
    render(<ChatItem chat={chat} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledWith('1')
  })
})
