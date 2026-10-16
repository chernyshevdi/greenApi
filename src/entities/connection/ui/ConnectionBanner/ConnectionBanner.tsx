import type { ConnectionProblem } from '../../model/connectionSlice'
import styles from './ConnectionBanner.module.css'

const TITLES: Record<ConnectionProblem['kind'], string> = {
  config: 'Сообщения не приходят: проверьте настройки инстанса',
  network: 'Нет связи с GREEN-API',
  server: 'GREEN-API временно недоступен',
  rate_limit: 'Слишком много запросов',
}

export function ConnectionBanner({ problem }: { problem: ConnectionProblem }) {
  const transient = problem.kind !== 'config'
  return (
    <div
      role="alert"
      className={[styles.banner, transient && styles.transient].filter(Boolean).join(' ')}
    >
      <span className={styles.title}>{TITLES[problem.kind]}</span>
      {problem.message}
    </div>
  )
}
