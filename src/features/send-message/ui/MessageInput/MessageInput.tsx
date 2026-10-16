import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { MAX_MESSAGE_LENGTH } from '@/shared/api'
import { ErrorText } from '@/shared/ui'
import { isSendable, useSendMessage } from '../../model/useSendMessage'
import styles from './MessageInput.module.css'

const MAX_HEIGHT = 160

export function MessageInput({ chatId }: { chatId: string }) {
  const { send } = useSendMessage()
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const tooLong = text.trim().length > MAX_MESSAGE_LENGTH

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }

  function submit() {
    if (!send(chatId, text)) return
    setText('')
    // Дожидаемся очистки значения, затем возвращаем высоту поля.
    requestAnimationFrame(resize)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing — не отправляем, пока идёт ввод через IME (китайский, японский и т.п.)
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          aria-label="Сообщение"
          placeholder="Сообщение"
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            resize()
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className={styles.send}
          aria-label="Отправить"
          disabled={!isSendable(text)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M2 21 23 12 2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </form>
      {tooLong && <ErrorText>Максимум {MAX_MESSAGE_LENGTH} символов</ErrorText>}
    </div>
  )
}
