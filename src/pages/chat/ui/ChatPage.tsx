import { useDispatch, useSelector } from 'react-redux'
import { selectActiveChatId, selectChat } from '@/entities/chat'
import { useAuthActions } from '@/features/auth'
import { ChatList } from '@/widgets/chat-list'
import { ChatWindow } from '@/widgets/chat-window'
import styles from './ChatPage.module.css'

export function ChatPage() {
  const dispatch = useDispatch()
  const activeChatId = useSelector(selectActiveChatId)
  const { logout } = useAuthActions()

  return (
    <div className={styles.page} data-chat-open={activeChatId !== null}>
      <aside className={styles.sidebar}>
        <ChatList onLogout={logout} />
      </aside>
      <main className={styles.main}>
        <ChatWindow onBack={() => dispatch(selectChat(null))} />
      </main>
    </div>
  )
}
