import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Message } from '@/entities/message'
import { useStickToBottom } from './useStickToBottom'

const SCROLL_HEIGHT = 1000
const CLIENT_HEIGHT = 400

const msg = (id: string, direction: Message['direction']): Message => ({
  id,
  chatId: 'a',
  text: id,
  direction,
  timestamp: 1,
})

function Harness({ chatId, messages }: { chatId: string; messages: Message[] }) {
  const { listRef, onScroll } = useStickToBottom(chatId, messages)
  return <div data-testid="list" ref={listRef} onScroll={onScroll} />
}

// jsdom не раскладывает элементы: подставляем размеры и храним scrollTop сами.
const originals = new Map<string, PropertyDescriptor | undefined>()
function define(name: string, descriptor: PropertyDescriptor) {
  originals.set(name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name))
  Object.defineProperty(HTMLElement.prototype, name, { configurable: true, ...descriptor })
}

beforeEach(() => {
  define('scrollHeight', { get: () => SCROLL_HEIGHT })
  define('clientHeight', { get: () => CLIENT_HEIGHT })
  define('scrollTop', {
    get(this: { _top?: number }) {
      return this._top ?? 0
    },
    set(this: { _top?: number }, value: number) {
      this._top = value
    },
  })
})
afterEach(() => {
  for (const [name, original] of originals) {
    if (original) Object.defineProperty(HTMLElement.prototype, name, original)
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
  }
  originals.clear()
})

function scrollUp(el: HTMLElement) {
  el.scrollTop = 100 // далеко от низа: 1000 - 100 - 400 = 500px
  fireEvent.scroll(el)
}

describe('useStickToBottom', () => {
  it('scrolls to the bottom when a chat is opened', () => {
    const { getByTestId } = render(<Harness chatId="a" messages={[msg('1', 'in')]} />)
    expect(getByTestId('list').scrollTop).toBe(SCROLL_HEIGHT)
  })

  it('follows incoming messages while the user is at the bottom', () => {
    const { getByTestId, rerender } = render(<Harness chatId="a" messages={[msg('1', 'in')]} />)
    getByTestId('list').scrollTop = 590 // 1000 - 590 - 400 = 10px от низа
    fireEvent.scroll(getByTestId('list'))

    rerender(<Harness chatId="a" messages={[msg('1', 'in'), msg('2', 'in')]} />)
    expect(getByTestId('list').scrollTop).toBe(SCROLL_HEIGHT)
  })

  it('does not yank the user down on incoming messages when reading history', () => {
    const { getByTestId, rerender } = render(<Harness chatId="a" messages={[msg('1', 'in')]} />)
    scrollUp(getByTestId('list'))

    rerender(<Harness chatId="a" messages={[msg('1', 'in'), msg('2', 'in')]} />)
    expect(getByTestId('list').scrollTop).toBe(100)
  })

  it('always scrolls down for own messages', () => {
    const { getByTestId, rerender } = render(<Harness chatId="a" messages={[msg('1', 'in')]} />)
    scrollUp(getByTestId('list'))

    rerender(<Harness chatId="a" messages={[msg('1', 'in'), msg('2', 'out')]} />)
    expect(getByTestId('list').scrollTop).toBe(SCROLL_HEIGHT)
  })

  it('scrolls down when switching to another chat', () => {
    const { getByTestId, rerender } = render(<Harness chatId="a" messages={[msg('1', 'in')]} />)
    scrollUp(getByTestId('list'))

    rerender(<Harness chatId="b" messages={[msg('9', 'in')]} />)
    expect(getByTestId('list').scrollTop).toBe(SCROLL_HEIGHT)
  })
})
