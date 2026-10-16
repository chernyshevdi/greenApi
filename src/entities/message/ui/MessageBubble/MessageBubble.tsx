import { formatTime } from '@/shared/lib'
import type { Message, MessageStatus } from '../../model/types'
import styles from './MessageBubble.module.css'

const STATUS: Record<MessageStatus, { icon: string; label: string }> = {
  sending: { icon: '🕓', label: 'Отправляется' },
  sent: { icon: '✓', label: 'Отправлено' },
  error: { icon: '!', label: 'Не удалось отправить' },
}

interface MessageBubbleProps {
  message: Message
  /** Если передан, у сообщения со статусом `error` показывается кнопка «Повторить». */
  onRetry?: (message: Message) => void
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const status = message.direction === 'out' && message.status ? STATUS[message.status] : null

  return (
    <div className={[styles.row, styles[message.direction]].join(' ')}>
      <div className={styles.bubble}>
        <span className={styles.text}>{message.text}</span>
        {message.status === 'error' && onRetry && (
          <button type="button" className={styles.retry} onClick={() => onRetry(message)}>
            Повторить
          </button>
        )}
        <span className={styles.meta}>
          {formatTime(message.timestamp)}
          {status && (
            <span
              role="img"
              aria-label={status.label}
              className={message.status === 'error' ? styles.error : undefined}
            >
              {status.icon}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
