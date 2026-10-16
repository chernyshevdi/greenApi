import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConnectionBanner, connectionSlice, selectConnectionProblem, setConnectionProblem } from '.'

describe('connectionSlice', () => {
  it('stores and clears a problem', () => {
    const store = configureStore({ reducer: { connection: connectionSlice.reducer } })
    expect(selectConnectionProblem(store.getState())).toBeNull()

    store.dispatch(setConnectionProblem({ kind: 'network', message: 'retrying' }))
    expect(selectConnectionProblem(store.getState())).toEqual({
      kind: 'network',
      message: 'retrying',
    })

    store.dispatch(setConnectionProblem(null))
    expect(selectConnectionProblem(store.getState())).toBeNull()
  })
})

describe('ConnectionBanner', () => {
  it.each([
    ['config', 'проверьте настройки инстанса'],
    ['network', 'Нет связи с GREEN-API'],
    ['server', 'временно недоступен'],
    ['rate_limit', 'Слишком много запросов'],
  ] as const)('shows a title and the message for %s', (kind, title) => {
    render(<ConnectionBanner problem={{ kind, message: 'Подробности' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent(title)
    expect(screen.getByRole('alert')).toHaveTextContent('Подробности')
  })
})
