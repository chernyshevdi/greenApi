import { useDispatch, useSelector } from 'react-redux'
import { addChat, selectChat } from '@/entities/chat'
import { selectCredentials } from '@/entities/session'
import { checkAccount } from '@/shared/api'
import { isValidPhone, normalizePhone } from '@/shared/lib'
import { createChatErrorMessage, NOT_FOUND_MESSAGE, PHONE_HINT } from './errorMessage'

export type CreateChatResult = { chatId: string } | { error: string }

/**
 * Создаёт чат по номеру: chatId из номера не вычисляется, поэтому его отдаёт checkAccount.
 * Креды берутся из entities/session. Повторный номер не плодит дубли — addChat игнорирует уже существующий chatId.
 */
export function useCreateChat() {
  const dispatch = useDispatch()
  const credentials = useSelector(selectCredentials)

  return async function createChat(rawPhone: string): Promise<CreateChatResult> {
    if (!credentials) return { error: 'Сначала войдите в аккаунт' }

    const phone = normalizePhone(rawPhone)
    if (!isValidPhone(phone)) return { error: PHONE_HINT }

    try {
      const account = await checkAccount(credentials, phone)
      if (!account.exist || !account.chatId) return { error: NOT_FOUND_MESSAGE }

      dispatch(
        addChat({
          chatId: account.chatId,
          title: account.username ? `@${account.username.replace(/^@/, '')}` : phone,
          phone,
        }),
      )
      dispatch(selectChat(account.chatId))
      return { chatId: account.chatId }
    } catch (error) {
      return { error: createChatErrorMessage(error) }
    }
  }
}
