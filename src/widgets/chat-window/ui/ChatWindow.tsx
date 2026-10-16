import { useSelector } from 'react-redux'
import { Avatar, selectActiveChat } from '@/entities/chat'
import { MessageBubble, selectMessages } from '@/entities/message'
import { MessageInput, useSendMessage } from '@/features/send-message'
import { IconButton } from '@/shared/ui'
import { useStickToBottom } from '../model/useStickToBottom'
import styles from './ChatWindow.module.css'

interface ChatWindowProps {
  /** Кнопка «назад» к списку чатов; видна только на узком экране. */
  onBack?: () => void
}

export function ChatWindow({ onBack }: ChatWindowProps) {
  const chat = useSelector(selectActiveChat)
  const messages = useSelector(selectMessages(chat?.chatId ?? null))
  const { retry } = useSendMessage()
  const { listRef, onScroll } = useStickToBottom(chat?.chatId ?? null, messages)

  if (!chat) {
    return (
      <section className={`${styles.window} ${styles.placeholder}`} aria-label="Чат">
        <span className={styles.placeholderText}>Выберите чат, чтобы начать общение</span>
      </section>
    )
  }

  return (
    <section className={styles.window} aria-label={`Чат с ${chat.title}`}>
      <header className={styles.header}>
        {onBack && (
          <IconButton label="К списку чатов" className={styles.back} onClick={onBack}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
            </svg>
          </IconButton>
        )}
        <Avatar seed={chat.chatId} name={chat.title} size={42} />
        <div className={styles.who}>
          <div className={styles.title}>{chat.title}</div>
          {chat.phone && <div className={styles.subtitle}>+{chat.phone}</div>}
        </div>
      </header>

      <div ref={listRef} className={styles.messages} onScroll={onScroll} role="log">
        {messages.length === 0 ? (
          <p className={styles.empty}>Нет сообщений. Напишите первым.</p>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} onRetry={retry} />
          ))
        )}
      </div>

      <div className={styles.composer}>
        <MessageInput key={chat.chatId} chatId={chat.chatId} />
      </div>
    </section>
  )
}
