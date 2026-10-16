import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Input } from '@/shared/ui'
import { PHONE_HINT } from '../../model/errorMessage'
import { useCreateChat } from '../../model/useCreateChat'
import styles from './NewChatForm.module.css'

interface NewChatFormProps {
  /** Вызывается после создания (или открытия существующего) чата. */
  onCreated?: (chatId: string) => void
  onCancel?: () => void
}

export function NewChatForm({ onCreated, onCancel }: NewChatFormProps) {
  const createChat = useCreateChat()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    setLoading(true)
    const result = await createChat(phone)
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setPhone('')
    onCreated?.(result.chatId)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.title}>Новый чат</h2>
      <Input
        label="Номер телефона"
        placeholder="79876543210"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={error}
        inputMode="tel"
        autoComplete="off"
        autoFocus
      />
      <p className={styles.hint}>{PHONE_HINT}</p>
      <div className={styles.actions}>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Отмена
          </Button>
        )}
        <Button type="submit" loading={loading}>
          Создать чат
        </Button>
      </div>
    </form>
  )
}
