import { avatarColor, getInitials } from '@/shared/lib'
import styles from './Avatar.module.css'

interface AvatarProps {
  /** Стабильный идентификатор для цвета (chatId). */
  seed: string
  name: string
  size?: number
}

export function Avatar({ seed, name, size = 54 }: AvatarProps) {
  return (
    <span
      className={styles.avatar}
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.4, background: avatarColor(seed) }}
    >
      {getInitials(name)}
    </span>
  )
}
