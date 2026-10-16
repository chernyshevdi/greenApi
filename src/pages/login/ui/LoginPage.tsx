import { LoginForm } from '@/features/auth'
import styles from './LoginPage.module.css'

export function LoginPage() {
  return (
    <main className={styles.page}>
      <LoginForm />
    </main>
  )
}
