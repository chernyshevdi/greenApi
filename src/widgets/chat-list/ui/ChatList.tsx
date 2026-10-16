import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ConnectionBanner, selectConnectionProblem } from '@/entities/connection'
import { ChatItem, selectActiveChatId, selectChat, selectChatList } from '@/entities/chat'
import { NewChatForm } from '@/features/create-chat'
import { IconButton } from '@/shared/ui'
import styles from './ChatList.module.css'

interface ChatListProps {
  onLogout: () => void
}

const icon = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true,
}

export function ChatList({ onLogout }: ChatListProps) {
  const dispatch = useDispatch()
  const chats = useSelector(selectChatList)
  const activeChatId = useSelector(selectActiveChatId)
  const problem = useSelector(selectConnectionProblem)
  // «Новый чат» — панель вместо списка, как в Telegram Web.
  const [creating, setCreating] = useState(false)

  if (creating) {
    return (
      <section className={styles.panel} aria-label="Новый чат">
        <div className={styles.header}>
          <IconButton label="Назад" onClick={() => setCreating(false)}>
            <svg {...icon}>
              <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
            </svg>
          </IconButton>
        </div>
        <div className={styles.formWrap}>
          <NewChatForm onCreated={() => setCreating(false)} onCancel={() => setCreating(false)} />
        </div>
      </section>
    )
  }

  return (
    <section className={styles.panel} aria-label="Чаты">
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Чаты</h1>
        <IconButton label="Новый чат" onClick={() => setCreating(true)}>
          <svg {...icon}>
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
          </svg>
        </IconButton>
        <IconButton label="Выйти" onClick={onLogout}>
          <svg {...icon}>
            <path d="M10 17v-3H3v-4h7V7l5 5zm9-14H12v2h7v14h-7v2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2" />
          </svg>
        </IconButton>
      </div>

      {problem && <ConnectionBanner problem={problem} />}

      {chats.length === 0 ? (
        <p className={styles.empty}>Чатов пока нет. Создайте первый по номеру телефона.</p>
      ) : (
        <div className={styles.list}>
          {chats.map((chat) => (
            <ChatItem
              key={chat.chatId}
              chat={chat}
              active={chat.chatId === activeChatId}
              onClick={(chatId) => dispatch(selectChat(chatId))}
            />
          ))}
        </div>
      )}
    </section>
  )
}
