import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, ErrorText, Input } from '.'

describe('Button', () => {
  it('calls onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Войти</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and shows spinner while loading', () => {
    render(<Button loading>Войти</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('Input', () => {
  it('links label and input', () => {
    render(<Input label="idInstance" />)
    expect(screen.getByLabelText('idInstance')).toBeInTheDocument()
  })

  it('shows error and marks input invalid', () => {
    render(<Input label="Номер" error="Неверный номер" />)
    expect(screen.getByLabelText('Номер')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Неверный номер')
  })
})

describe('ErrorText', () => {
  it('renders nothing without children', () => {
    render(<ErrorText />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
