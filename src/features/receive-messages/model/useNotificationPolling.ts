import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setConnectionProblem } from '@/entities/connection'
import { resetSession, selectCredentials } from '@/entities/session'
import { startPolling } from './poller'
import type { PollingDispatch } from './poller'

/**
 * Пока в сессии есть креды, получает входящие сообщения. Остановка — при выходе
 * или размонтировании (в StrictMode прежний цикл останавливается перед новым).
 * Подключать один раз на уровне приложения.
 */
export function useNotificationPolling({ onAuthError }: { onAuthError?: () => void } = {}) {
  const dispatch = useDispatch<PollingDispatch>()
  const credentials = useSelector(selectCredentials)
  const onAuthErrorRef = useRef(onAuthError)

  useEffect(() => {
    onAuthErrorRef.current = onAuthError
  })

  useEffect(() => {
    if (!credentials) return
    const stop = startPolling({
      credentials,
      dispatch,
      onProblem: (problem) => dispatch(setConnectionProblem(problem)),
      // По умолчанию возвращаем пользователя на страницу входа (история чатов остаётся).
      onAuthError: () => (onAuthErrorRef.current ?? (() => dispatch(resetSession())))(),
    })
    return () => {
      stop()
      dispatch(setConnectionProblem(null))
    }
  }, [credentials, dispatch])
}
