import { useSelector } from 'react-redux'
import { selectIsAuthorized } from '@/entities/session'
import { useNotificationPolling } from '@/features/receive-messages'
import { ChatPage } from '@/pages/chat'
import { LoginPage } from '@/pages/login'

export function App() {
  // Поллинг идёт, пока есть сессия; при выходе или 401 останавливается сам.
  useNotificationPolling()
  const authorized = useSelector(selectIsAuthorized)
  return authorized ? <ChatPage /> : <LoginPage />
}
