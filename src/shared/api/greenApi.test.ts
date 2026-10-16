import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkAccount,
  deleteNotification,
  getSettings,
  getStateInstance,
  receiveNotification,
  sendMessage,
} from './greenApi'
import { ApiError } from './errors'
import type { Credentials } from './types'

const creds: Credentials = {
  idInstance: '4100000001',
  apiTokenInstance: 'token123',
  apiUrl: 'https://api.green-api.com/',
}
const base = 'https://api.green-api.com/waInstance4100000001'

const fetchMock = vi.fn()

function reply(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? '' : JSON.stringify(body), { status }),
  )
}

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('sendMessage', () => {
  it('POSTs chatId and message', async () => {
    reply({ idMessage: 'abc' })
    const res = await sendMessage(creds, { chatId: '10000000', message: 'hi' })

    expect(res).toEqual({ idMessage: 'abc' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${base}/sendMessage/token123`)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ chatId: '10000000', message: 'hi' })
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [400, 'validation'],
    [469, 'rate_limit'],
    [500, 'server'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    reply({ message: 'boom' }, status)
    await expect(sendMessage(creds, { chatId: '1', message: 'x' })).rejects.toMatchObject({
      name: 'ApiError',
      kind,
      status,
    })
  })

  it('maps fetch failure to network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(sendMessage(creds, { chatId: '1', message: 'x' })).rejects.toMatchObject({
      kind: 'network',
    })
  })
})

describe('receiveNotification', () => {
  it('passes receiveTimeout and returns notification', async () => {
    const notification = { receiptId: 7, body: { typeWebhook: 'incomingMessageReceived' } }
    reply(notification)

    expect(await receiveNotification(creds, undefined, 30)).toEqual(notification)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${base}/receiveNotification/token123?receiveTimeout=30`)
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
  })

  it.each([undefined, null])('returns null for empty response (%s)', async (body) => {
    reply(body)
    expect(await receiveNotification(creds)).toBeNull()
  })

  it('reports aborted requests', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    const error = await receiveNotification(creds).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'aborted' })
  })
})

describe('deleteNotification', () => {
  it('DELETEs with receiptId in path', async () => {
    reply({ result: true, reason: '' })
    await deleteNotification(creds, 1234567)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${base}/deleteNotification/token123/1234567`)
    expect(init.method).toBe('DELETE')
  })
})

describe('checkAccount', () => {
  it('sends phone as number and returns chatId', async () => {
    reply({ exist: true, chatId: '10000000', fromCache: false })
    const res = await checkAccount(creds, '79876543210')

    expect(res.chatId).toBe('10000000')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${base}/checkAccount/token123`)
    expect(JSON.parse(init.body)).toEqual({ phoneNumber: 79876543210 })
  })

  it('returns exist:false as a regular result', async () => {
    reply({ exist: false, chatId: '' })
    expect(await checkAccount(creds, '79876543210')).toMatchObject({ exist: false })
  })

  it('rejects non-digit phone without a request', async () => {
    await expect(checkAccount(creds, '+7 987')).rejects.toMatchObject({ kind: 'validation' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps status:false rate limit', async () => {
    reply({ status: false, data: { reason: 'rate_limit_exceeded', retryAfter: 7200 } })
    await expect(checkAccount(creds, '79876543210')).rejects.toMatchObject({ kind: 'rate_limit' })
  })
})

describe('getStateInstance', () => {
  it('GETs state without body', async () => {
    reply({ stateInstance: 'authorized' })
    expect(await getStateInstance(creds)).toEqual({ stateInstance: 'authorized' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${base}/getStateInstance/token123`)
    expect(init.method).toBe('GET')
  })

  it('maps 401 to unauthorized', async () => {
    reply(undefined, 401)
    await expect(getStateInstance(creds)).rejects.toMatchObject({ kind: 'unauthorized' })
  })
})

describe('error handling details', () => {
  it('checkAccount: status:false without rate limit becomes an unknown error with reason', async () => {
    reply({ status: false, data: { reason: 'notAuthorized' } })
    await expect(checkAccount(creds, '79876543210')).rejects.toMatchObject({
      kind: 'unknown',
      message: 'notAuthorized',
    })
  })

  it('checkAccount: empty body is an error', async () => {
    reply(undefined)
    await expect(checkAccount(creds, '79876543210')).rejects.toMatchObject({ kind: 'unknown' })
  })

  it('sendMessage: empty body is an error', async () => {
    reply(undefined)
    await expect(sendMessage(creds, { chatId: '1', message: 'x' })).rejects.toMatchObject({
      kind: 'unknown',
    })
  })

  it('getStateInstance: empty body is an error', async () => {
    reply(undefined)
    await expect(getStateInstance(creds)).rejects.toMatchObject({ kind: 'unknown' })
  })

  it('uses a plain-text error body as the message', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
    await expect(getStateInstance(creds)).rejects.toMatchObject({
      kind: 'forbidden',
      message: 'Forbidden',
    })
  })
})

describe('getSettings', () => {
  it('GETs settings', async () => {
    reply({ webhookUrl: '', incomingWebhook: 'yes' })
    expect(await getSettings(creds)).toEqual({ webhookUrl: '', incomingWebhook: 'yes' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${base}/getSettings/token123`)
    expect(init.method).toBe('GET')
  })

  it('throws on an empty body', async () => {
    reply(undefined)
    await expect(getSettings(creds)).rejects.toMatchObject({ kind: 'unknown' })
  })
})
