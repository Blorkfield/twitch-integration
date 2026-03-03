import type { SimUser } from './users.js'

type Listener = (event: unknown) => void

export class MockEventSubWebSocket {
  static current: MockEventSubWebSocket | null = null

  private readonly sessionId = crypto.randomUUID()
  private readonly listeners = new Map<string, Set<Listener>>()
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null

  readyState = 0 // CONNECTING

  constructor(_url: string) {
    MockEventSubWebSocket.current = this

    setTimeout(() => {
      this.readyState = 1 // OPEN
      this._emit('open', {})
      this._send({
        metadata: {
          message_id: crypto.randomUUID(),
          message_type: 'session_welcome',
          message_timestamp: new Date().toISOString(),
        },
        payload: {
          session: {
            id: this.sessionId,
            status: 'connected',
            connected_at: new Date().toISOString(),
            keepalive_timeout_seconds: 30,
            reconnect_url: null,
          },
        },
      })
    }, 50)

    this.keepaliveInterval = setInterval(() => {
      this._send({
        metadata: {
          message_id: crypto.randomUUID(),
          message_type: 'session_keepalive',
          message_timestamp: new Date().toISOString(),
        },
        payload: {},
      })
    }, 20_000)
  }

  addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener)
  }

  close(code = 1000, reason = ''): void {
    if (this.keepaliveInterval !== null) {
      clearInterval(this.keepaliveInterval)
      this.keepaliveInterval = null
    }
    this.readyState = 3 // CLOSED
    MockEventSubWebSocket.current = null
    this._emit('close', { code, reason })
  }

  sendNotification(subscriptionType: string, event: object): void {
    this._send({
      metadata: {
        message_id: crypto.randomUUID(),
        message_type: 'notification',
        message_timestamp: new Date().toISOString(),
        subscription_type: subscriptionType,
        subscription_version: '1',
      },
      payload: {
        subscription: {
          id: crypto.randomUUID(),
          type: subscriptionType,
          version: '1',
          status: 'enabled',
          cost: 0,
          condition: { broadcaster_user_id: 'mock_channel' },
          transport: { method: 'websocket', session_id: this.sessionId },
          created_at: new Date().toISOString(),
        },
        event,
      },
    })
  }

  private _send(data: object): void {
    this._emit('message', { data: JSON.stringify(data) })
  }

  private _emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

/**
 * Returns a fetch implementation for use with TwitchClient's transport option.
 * Handles Twitch Helix API calls during simulation — no globals are touched.
 */
export function createMockFetch(
  users: SimUser[],
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const userMap = new Map(users.map(u => [u.id, u]))

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url

    if (url.includes('api.twitch.tv/helix/users')) {
      const ids = new URL(url).searchParams.getAll('id')
      const data = ids
        .map(id => userMap.get(id))
        .filter((u): u is SimUser => u !== undefined)
        .map(u => ({
          id: u.id,
          login: u.login,
          display_name: u.displayName,
          profile_image_url: u.profileImageUrl ?? '',
          broadcaster_type: '',
          description: '',
          created_at: new Date(0).toISOString(),
        }))
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.includes('api.twitch.tv/helix')) {
      return new Response(
        JSON.stringify({ data: [], total: 0, max_total_cost: 10, total_cost: 1, pagination: {} }),
        { status: 202, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return fetch(input, init)
  }
}
