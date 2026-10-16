import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit'
import { resetChats } from '@/entities/chat'
import { resetMessages } from '@/entities/message'
import { resetSession } from '@/entities/session'

/**
 * Выход: очищает сессию, чаты и сообщения. Поллинг (features/receive-messages)
 * останавливается сам, когда креды становятся `null`; localStorage чистит
 * persist-слой в app, который сохраняет состояние стора.
 */
export const logout = (): ThunkAction<void, unknown, unknown, UnknownAction> => (dispatch) => {
  dispatch(resetChats())
  dispatch(resetMessages())
  dispatch(resetSession())
}
