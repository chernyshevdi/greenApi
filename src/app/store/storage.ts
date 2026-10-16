type Kind = 'local' | 'session'

// Доступ к storage может бросать исключение (приватный режим, заблокированные cookies),
// поэтому всё обёрнуто в try/catch: приложение должно работать и без хранилища.
function getStorage(kind: Kind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readJson(kind: Kind, key: string): unknown {
  try {
    const raw = getStorage(kind)?.getItem(key)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeJson(kind: Kind, key: string, value: unknown): void {
  try {
    getStorage(kind)?.setItem(key, JSON.stringify(value))
  } catch {
    // переполнение квоты и т.п. — не критично
  }
}

export function removeKey(kind: Kind, key: string): void {
  try {
    getStorage(kind)?.removeItem(key)
  } catch {
    // ignore
  }
}
