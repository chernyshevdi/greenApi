export const DEFAULT_API_URL: string = import.meta.env.VITE_API_URL || 'https://api.green-api.com'

/** Лимит длины текста для sendMessage в Telegram-версии GREEN-API. */
export const MAX_MESSAGE_LENGTH = 4096

/** Время ожидания long-poll в receiveNotification, сек (допустимо 5–60). */
export const RECEIVE_TIMEOUT_SEC = 20
