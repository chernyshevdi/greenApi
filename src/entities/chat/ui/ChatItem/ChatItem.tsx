import { formatTime } from '@/shared/lib'
import type { Chat } from '../../model/types'
import { Avatar } from '../Avatar/Avatar'
import styles from './ChatItem.module.css'

interface ChatItemProps {
  chat: Chat
  active?: boolean
  onClick?: (chatId: string) => void
}

export function ChatItem({ chat, active = false, onClick }: ChatItemProps) {
  const { lastMessage } = chat
  const preview = lastMessage
    ? `${lastMessage.direction === 'out' ? 'Вы: ' : ''}${lastMessage.text}`
    : ''

  return (
    <button
      type="button"
      className={[styles.item, active && styles.active].filter(Boolean).join(' ')}
      aria-current={active ? 'true' : undefined}
      onClick={() => onClick?.(chat.chatId)}
    >
      <Avatar seed={chat.chatId} name={chat.title} />
      <span className={styles.body}>
        <span className={styles.row}>
          <span className={styles.title}>{chat.title}</span>
          {lastMessage && <span className={styles.time}>{formatTime(lastMessage.timestamp)}</span>}
        </span>
        <span className={styles.row}>
          <span className={styles.preview}>{preview}</span>
          {chat.unread > 0 && (
            <span className={styles.badge} aria-label={`Непрочитанных: ${chat.unread}`}>
              {chat.unread}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
