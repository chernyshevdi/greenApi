import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSelector } from 'react-redux'
import { selectChatList } from '@/entities/chat'
import { selectChatsOwner } from '@/entities/session'
import { DEFAULT_API_URL } from '@/shared/api'
import { pluralize } from '@/shared/lib'
import { Button, ErrorText, Input } from '@/shared/ui'
import { useAuthActions } from '../../model/useAuth'
import { validateLogin } from '../../model/validate'
import type { LoginErrors } from '../../model/validate'
import styles from './LoginForm.module.css'

export function LoginForm() {
  const { login } = useAuthActions()
  const chatsOwner = useSelector(selectChatsOwner)
  const chatCount = useSelector(selectChatList).length
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL)
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Вход в другой инстанс удалит сохранённые на устройстве чаты — предупреждаем заранее.
  const enteredId = idInstance.trim()
  const willDeleteChats =
    chatCount > 0 && chatsOwner !== null && enteredId !== '' && enteredId !== chatsOwner

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const values = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: apiUrl.trim(),
    }
    const validation = validateLogin(values)
    setErrors(validation)
    setSubmitError(null)
    if (Object.keys(validation).length > 0) return

    setLoading(true)
    const error = await login(values)
    // При успехе форма размонтируется (страница сменится), поэтому состояние не трогаем.
    if (error) {
      setSubmitError(error)
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h1 className={styles.title}>Вход в Telegram Chat</h1>
      <p className={styles.hint}>Данные инстанса GREEN-API из личного кабинета</p>

      <Input
        label="idInstance"
        value={idInstance}
        onChange={(e) => setIdInstance(e.target.value)}
        error={errors.idInstance}
        inputMode="numeric"
        autoComplete="off"
        autoFocus
      />
      <Input
        label="apiTokenInstance"
        type="password"
        value={apiTokenInstance}
        onChange={(e) => setApiTokenInstance(e.target.value)}
        error={errors.apiTokenInstance}
        autoComplete="off"
      />

      <details className={styles.advanced} open={Boolean(errors.apiUrl)}>
        <summary>Дополнительно</summary>
        <Input
          label="apiUrl"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          error={errors.apiUrl}
          autoComplete="off"
        />
      </details>

      {willDeleteChats && (
        <p className={styles.warning} role="note">
          На этом устройстве сохранены чаты инстанса {chatsOwner} ({chatCount}{' '}
          {pluralize(chatCount, ['чат', 'чата', 'чатов'])}). После входа в инстанс {enteredId} они
          будут удалены.
        </p>
      )}
      <ErrorText>{submitError}</ErrorText>
      <Button type="submit" loading={loading} fullWidth>
        {willDeleteChats ? 'Войти и удалить чаты' : 'Войти'}
      </Button>
    </form>
  )
}
