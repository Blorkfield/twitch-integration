import EventEmitter from 'eventemitter3'
import type {
  TwitchChatOptions,
  NormalizedMessage,
  TwitchEventSubMessage,
  TwitchWelcomePayload,
  TwitchNotificationPayload,
  TwitchReconnectPayload,
  TwitchRevocationPayload,
} from './types.js'
import { EmoteCache } from './emotes/index.js'
import { UserCache } from './users/index.js'
import { normalizeMessage } from './normalizer.js'

const EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws'
const HELIX_SUBSCRIPTIONS = 'https://api.twitch.tv/helix/eventsub/subscriptions'

// Minimal interface covering both `ws` WebSocket and browser WebSocket.
interface WSLike {
  close(code?: number, reason?: string): void
  addEventListener(type: 'open', listener: () => void): void
  addEventListener(type: 'message', listener: (event: { data: string }) => void): void
  addEventListener(type: 'close', listener: (event: { code: number; reason: string | Buffer }) => void): void
  addEventListener(type: 'error', listener: (event: unknown) => void): void
}

function createWebSocket(url: string): WSLike {
  if (typeof WebSocket !== 'undefined') {
    return new WebSocket(url) as unknown as WSLike
  }
  // Node.js — require ws at runtime (peer dep)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('ws') as { default?: new (url: string) => WSLike } & (new (url: string) => WSLike)
  const WsImpl = mod.default ?? mod
  return new WsImpl(url)
}

interface TwitchChatEvents {
  connected: []
  disconnected: [code: number, reason: string]
  message: [msg: NormalizedMessage]
  revoked: [reason: string]
  auth_error: []
  error: [err: Error]
}

export class TwitchChat extends EventEmitter<TwitchChatEvents> {
  private options: TwitchChatOptions
  private emoteCache: EmoteCache
  private userCache: UserCache

  private ws: WSLike | null = null
  private sessionId: string | null = null
  private keepaliveTimeoutMs = 10_000
  private keepaliveTimer: ReturnType<typeof setTimeout> | null = null

  // Holds the old ws during a session_reconnect handoff
  private oldWs: WSLike | null = null

  private stopped = false

  constructor(options: TwitchChatOptions) {
    super()
    this.options = options
    this.emoteCache = new EmoteCache(options.channelId)
    this.userCache = new UserCache(() => ({
      accessToken: this.options.accessToken,
      clientId: this.options.clientId,
    }))
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async connect(): Promise<void> {
    this.stopped = false
    await this._openConnection(EVENTSUB_URL, false)
  }

  disconnect(): void {
    this.stopped = true
    this._clearKeepaliveTimer()
    this._closeWs(this.ws, 1000, 'disconnect')
    this.ws = null
    this.sessionId = null
  }

  async preloadEmotes(): Promise<void> {
    await this.emoteCache.load()
  }

  async refreshEmotes(): Promise<void> {
    await this.emoteCache.load()
  }

  async getProfilePictureUrl(userId: string): Promise<string | null> {
    return this.userCache.getProfilePictureUrl(userId)
  }

  async getProfilePictureUrls(userIds: string[]): Promise<Map<string, string | null>> {
    const found = await this.userCache.getProfilePictureUrls(userIds)
    const result = new Map<string, string | null>()
    for (const id of userIds) {
      result.set(id, found.get(id) ?? null)
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  private _openConnection(url: string, isReconnect: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = createWebSocket(url)
      let settled = false

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true
          fn()
        }
      }

      ws.addEventListener('message', (event) => {
        const raw = typeof event.data === 'string' ? event.data : String(event.data)
        let msg: TwitchEventSubMessage
        try {
          msg = JSON.parse(raw) as TwitchEventSubMessage
        } catch (e) {
          this.emit('error', new Error(`Failed to parse WS message: ${String(e)}`))
          return
        }
        this._dispatch(msg, ws, isReconnect, settle, resolve, reject)
      })

      ws.addEventListener('close', (event) => {
        const code = event.code
        const reason = typeof event.reason === 'string' ? event.reason : event.reason.toString()

        this._clearKeepaliveTimer()

        if (!settled) {
          settle(() => reject(new Error(`WebSocket closed before welcome: ${code} ${reason}`)))
          return
        }

        if (ws !== this.ws) return // this was an old ws that got closed; ignore

        this.emit('disconnected', code, reason)

        if (!this.stopped && code !== 1000) {
          setTimeout(() => {
            if (!this.stopped) {
              this._openConnection(EVENTSUB_URL, false).catch(err => {
                this.emit('error', err instanceof Error ? err : new Error(String(err)))
              })
            }
          }, 2_000)
        }
      })

      ws.addEventListener('error', (err) => {
        const error = err instanceof Error ? err : new Error('WebSocket error')
        if (!settled) {
          settle(() => reject(error))
        } else {
          this.emit('error', error)
        }
      })
    })
  }

  private _dispatch(
    msg: TwitchEventSubMessage,
    ws: WSLike,
    isReconnect: boolean,
    settle: (fn: () => void) => void,
    resolve: () => void,
    reject: (err: Error) => void,
  ): void {
    switch (msg.metadata.message_type) {
      case 'session_welcome': {
        const payload = msg.payload as TwitchWelcomePayload
        this.sessionId = payload.session.id
        this.keepaliveTimeoutMs = payload.session.keepalive_timeout_seconds * 1_000
        this._resetKeepaliveTimer()

        if (isReconnect) {
          // Subscriptions carry over — no need to re-POST.
          // Close the old connection now that the new one is ready.
          this._closeWs(this.oldWs, 1000, 'reconnected')
          this.oldWs = null
          this.ws = ws
          settle(() => resolve())
          break
        }

        this.ws = ws
        this._subscribe()
          .then(() => {
            settle(() => resolve())
            this.emit('connected')
          })
          .catch(err => {
            settle(() => reject(err instanceof Error ? err : new Error(String(err))))
          })
        break
      }

      case 'session_keepalive': {
        this._resetKeepaliveTimer()
        break
      }

      case 'notification': {
        this._resetKeepaliveTimer()
        const payload = msg.payload as TwitchNotificationPayload
        if (payload.subscription.type === 'channel.chat.message') {
          try {
            const normalized = normalizeMessage(payload.event, this.emoteCache)
            this.emit('message', normalized)
          } catch (e) {
            this.emit('error', e instanceof Error ? e : new Error(String(e)))
          }
        }
        break
      }

      case 'session_reconnect': {
        const payload = msg.payload as TwitchReconnectPayload
        // Keep current ws open until new one sends session_welcome
        this.oldWs = this.ws
        this._openConnection(payload.session.reconnect_url, true).catch(err => {
          this.emit('error', err instanceof Error ? err : new Error(String(err)))
        })
        break
      }

      case 'revocation': {
        const payload = msg.payload as TwitchRevocationPayload
        this.emit('revoked', payload.subscription.status)
        break
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helix subscription
  // ---------------------------------------------------------------------------

  private async _subscribe(): Promise<void> {
    if (!this.sessionId) throw new Error('No session ID')

    const res = await fetch(HELIX_SUBSCRIPTIONS, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.options.accessToken}`,
        'Client-Id': this.options.clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'channel.chat.message',
        version: '1',
        condition: {
          broadcaster_user_id: this.options.channelId,
          user_id: this.options.userId,
        },
        transport: {
          method: 'websocket',
          session_id: this.sessionId,
        },
      }),
    })

    if (res.status === 401) {
      this.emit('auth_error')
      throw new Error('Auth error subscribing to EventSub')
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`EventSub subscription failed: ${res.status} ${body}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Keepalive timer
  // ---------------------------------------------------------------------------

  private _resetKeepaliveTimer(): void {
    this._clearKeepaliveTimer()
    this.keepaliveTimer = setTimeout(() => {
      this._closeWs(this.ws, 1001, 'keepalive timeout')
      this.ws = null
      if (!this.stopped) {
        this._openConnection(EVENTSUB_URL, false).catch(err => {
          this.emit('error', err instanceof Error ? err : new Error(String(err)))
        })
      }
    }, this.keepaliveTimeoutMs + 500)
  }

  private _clearKeepaliveTimer(): void {
    if (this.keepaliveTimer !== null) {
      clearTimeout(this.keepaliveTimer)
      this.keepaliveTimer = null
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _closeWs(ws: WSLike | null, code: number, reason: string): void {
    if (!ws) return
    try {
      ws.close(code, reason)
    } catch {
      // ignore
    }
  }
}
