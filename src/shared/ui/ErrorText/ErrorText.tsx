import type { HTMLAttributes } from 'react'
import styles from './ErrorText.module.css'

export function ErrorText({ children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null
  return (
    <p {...rest} role="alert" className={styles.error}>
      {children}
    </p>
  )
}
