export interface Credentials {
  idInstance: string
  apiTokenInstance: string
  apiUrl: string
}

export interface SendMessageParams {
  chatId: string
  message: string
}

export interface SendMessageResponse {
  idMessage: string
}

export interface CheckAccountResponse {
  exist: boolean
  chatId: string
  username?: string
  phoneNumber?: number
  fromCache?: boolean
}

export type StateInstance =
  'notAuthorized' | 'authorized' | 'blocked' | 'suspended' | 'starting' | 'pendingPassword'

export interface GetStateInstanceResponse {
  stateInstance: StateInstance
}

export interface GetSettingsResponse {
  /** Должен быть пустым, иначе уведомления уходят на него, а не в очередь HTTP API. */
  webhookUrl: string
  /** `yes` — приходят уведомления о входящих сообщениях. */
  incomingWebhook: 'yes' | 'no'
}

export interface DeleteNotificationResponse {
  result: boolean
  reason: string
}

export interface NotificationBody {
  typeWebhook: string
  timestamp?: number
  idMessage?: string
  senderData?: {
    chatId: string
    chatName?: string
    sender?: string
    senderName?: string
    senderContactName?: string
    senderPhoneNumber?: number
  }
  messageData?: {
    typeMessage: string
    textMessageData?: { textMessage: string }
    /** Текст со ссылкой приходит как extendedTextMessage. */
    extendedTextMessageData?: { text: string }
  }
}

export interface ReceivedNotification {
  receiptId: number
  body: NotificationBody
}
