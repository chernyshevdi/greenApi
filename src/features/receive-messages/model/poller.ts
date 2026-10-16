import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import type { MessagesState } from '@/entities/message'
import type { ConnectionProblem } from '@/entities/connection'
import { ApiError, deleteNotification, getSettings, receiveNotification } from '@/shared/api'
import type { Credentials } from '@/shared/api'
import { handleNotification } from './handleNotification'
import { problemFromError, problemFromSettings } from './problems'

export type PollingDispatch = ThunkDispatch<{ messages: MessagesState }, unknown, UnknownAction>

interface PollerOptions {
  credentials: Credentials
  dispatch: PollingDispatch
  /** Вызывается при 401/403: цикл после этого останавливается. */
  onAuthError?: () => void
  /** Текущая проблема с получением сообщений (`null` — всё хорошо). Вызывается при изменении. */
  onProblem?: (problem: ConnectionProblem | null) => void
  /** Подмена ожидания для тестов. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

const BACKOFF_MS = [1000, 2000, 5000]
/** Сбои связи показываем не с первой ошибки, чтобы плашка не мигала от единичного обрыва. */
const REPORT_AFTER_FAILURES = 2
/** Пока настройки инстанса неверны, перепроверяем их, чтобы плашка исчезла после исправления. */
const SETTINGS_RECHECK_MS = 15_000
/** Защита от «горячего» цикла, если сервер отвечает пустотой мгновенно. */
const MIN_EMPTY_CYCLE_MS = 500
const EMPTY_COOLDOWN_MS = 1000

export const backoffMs = (failures: number) =>
  BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const done = () => {
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', done)
      resolve()
    }, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}

/**
 * Запускает long-poll цикл receiveNotification → обработка → deleteNotification.
 * Возвращает функцию остановки. Один цикл на инстанс: два параллельных цикла
 * «крали» бы уведомления друг у друга, поэтому вызывающий обязан остановить прежний.
 */
export function startPolling({
  credentials,
  dispatch,
  onAuthError,
  onProblem,
  sleep = abortableSleep,
}: PollerOptions): () => void {
  const controller = new AbortController()
  const { signal } = controller

  // Две независимые причины: ошибки запросов и неверные настройки инстанса.
  let requestProblem: ConnectionProblem | null = null
  let settingsProblem: ConnectionProblem | null = null
  let reported: ConnectionProblem | null = null

  function report() {
    const next = requestProblem ?? settingsProblem
    if (next?.kind === reported?.kind && next?.message === reported?.message) return
    reported = next
    onProblem?.(next)
  }

  /**
   * Выключенные входящие уведомления не дают ошибки — очередь просто пуста, поэтому
   * без проверки настроек пользователь не узнает, почему ответы не приходят.
   */
  async function watchSettings() {
    while (!signal.aborted) {
      try {
        settingsProblem = problemFromSettings(await getSettings(credentials, signal))
      } catch {
        if (signal.aborted) return
        // Не удалось прочитать настройки — это не доказательство проблемы; опираемся на поллинг.
        return
      }
      report()
      if (!settingsProblem) return
      await sleep(SETTINGS_RECHECK_MS, signal)
    }
  }

  async function run() {
    let failures = 0
    // Уведомление, которое уже обработано, но ещё не удалось удалить из очереди.
    let handledReceiptId: number | null = null

    while (!signal.aborted) {
      try {
        const startedAt = Date.now()
        const notification = await receiveNotification(credentials, signal)
        failures = 0
        requestProblem = null
        report()

        if (signal.aborted) return // не обрабатываем: без удаления оно придёт заново
        if (!notification) {
          if (Date.now() - startedAt < MIN_EMPTY_CYCLE_MS) await sleep(EMPTY_COOLDOWN_MS, signal)
          continue
        }

        // Повторная доставка после неудачного удаления — не обрабатываем второй раз.
        if (notification.receiptId !== handledReceiptId) {
          dispatch(handleNotification(notification.body))
          handledReceiptId = notification.receiptId
        }

        try {
          await deleteNotification(credentials, notification.receiptId)
          handledReceiptId = null
        } catch {
          // Не блокируем цикл: уведомление придёт снова и будет удалено со следующей попытки.
        }
      } catch (error) {
        if (signal.aborted) return
        if (
          error instanceof ApiError &&
          (error.kind === 'unauthorized' || error.kind === 'forbidden')
        ) {
          onAuthError?.()
          return
        }
        failures += 1
        const problem = problemFromError(error)
        // Ошибка настроек (400) не пройдёт сама, сообщаем сразу; сбои связи — после повторов.
        if (problem.kind === 'config' || failures >= REPORT_AFTER_FAILURES) {
          requestProblem = problem
          report()
        }
        await sleep(backoffMs(failures), signal)
      }
    }
  }

  void run()
  void watchSettings()
  return () => controller.abort()
}
