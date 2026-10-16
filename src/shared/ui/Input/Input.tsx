import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { ErrorText } from '../ErrorText/ErrorText'
import styles from './Input.module.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, id, className, ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={[styles.input, error && styles.invalid, className].filter(Boolean).join(' ')}
      />
      <ErrorText id={errorId}>{error}</ErrorText>
    </div>
  )
}
