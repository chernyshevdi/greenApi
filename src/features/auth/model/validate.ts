export interface LoginValues {
  idInstance: string
  apiTokenInstance: string
  apiUrl: string
}

export type LoginErrors = Partial<Record<keyof LoginValues, string>>

/** Проверка формы входа. Пустой объект — ошибок нет. Значения ожидаются уже `trim`-нутыми. */
export function validateLogin({ idInstance, apiTokenInstance, apiUrl }: LoginValues): LoginErrors {
  const errors: LoginErrors = {}

  if (!idInstance) errors.idInstance = 'Введите idInstance'
  else if (!/^\d+$/.test(idInstance)) errors.idInstance = 'idInstance состоит только из цифр'

  if (!apiTokenInstance) errors.apiTokenInstance = 'Введите apiTokenInstance'

  if (!apiUrl) errors.apiUrl = 'Введите apiUrl'
  else if (!isHttpUrl(apiUrl)) errors.apiUrl = 'Адрес должен начинаться с http:// или https://'

  return errors
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
