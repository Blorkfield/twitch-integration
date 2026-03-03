import EventEmitter from 'eventemitter3'
import type {
  TwitchClientOptions,
  NormalizedMessage,
  TwitchEventSubMessage,
  TwitchWelcomePayload,
  TwitchNotificationPayload,
  TwitchReconnectPayload,
  TwitchRevocationPayload,
  UserInfo,
  ResolvedBadge,
  FollowEvent,
  SubscribeEvent,
  SubscriptionMessageEvent,
  SubscriptionGiftEvent,
  SubscriptionEndEvent,
  CheerEvent,
  RaidEvent,
  StreamOnlineEvent,
  StreamOfflineEvent,
  ChannelUpdateEvent,
  HypeTrainBeginEvent,
  HypeTrainProgressEvent,
  HypeTrainEndEvent,
  PollBeginEvent,
  PollProgressEvent,
  PollEndEvent,
  PredictionBeginEvent,
  PredictionProgressEvent,
  PredictionLockEvent,
  PredictionEndEvent,
  ChannelPointsEvent,
  AdBreakEvent,
  ShoutoutCreateEvent,
  ShoutoutReceiveEvent,
  TwitchChatMessageEvent,
  TwitchFollowEvent,
  TwitchSubscribeEvent,
  TwitchSubscriptionMessageEvent,
  TwitchSubscriptionGiftEvent,
  TwitchSubscriptionEndEvent,
  TwitchCheerEvent,
  TwitchRaidEvent,
  TwitchStreamOnlineEvent,
  TwitchStreamOfflineEvent,
  TwitchChannelUpdateEvent,
  TwitchHypeTrainBeginEvent,
  TwitchHypeTrainProgressEvent,
  TwitchHypeTrainEndEvent,
  TwitchPollBeginEvent,
  TwitchPollProgressEvent,
  TwitchPollEndEvent,
  TwitchPredictionBeginEvent,
  TwitchPredictionProgressEvent,
  TwitchPredictionLockEvent,
  TwitchPredictionEndEvent,
  TwitchChannelPointsEvent,
  TwitchAdBreakEvent,
  TwitchShoutoutCreateEvent,
  TwitchShoutoutReceiveEvent,
} from './types.js'
import { EmoteCache } from './emotes/index.js'
import { UserCache } from './users/index.js'
import { BadgeCache } from './badges/index.js'
import { normalizeMessage } from './normalizer.js'
import {
  normalizeFollow,
  normalizeSubscribe,
  normalizeSubscriptionMessage,
  normalizeSubscriptionGift,
  normalizeSubscriptionEnd,
  normalizeCheer,
  normalizeRaid,
  normalizeStreamOnline,
  normalizeStreamOffline,
  normalizeChannelUpdate,
  normalizeHypeTrainBegin,
  normalizeHypeTrainProgress,
  normalizeHypeTrainEnd,
  normalizePollBegin,
  normalizePollProgress,
  normalizePollEnd,
  normalizePredictionBegin,
  normalizePredictionProgress,
  normalizePredictionLock,
  normalizePredictionEnd,
  normalizeChannelPoints,
  normalizeAdBreak,
  normalizeShoutoutCreate,
  normalizeShoutoutReceive,
} from './event-normalizers.js'

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

function defaultWebSocket(url: string): WSLike {
  if (typeof WebSocket !== 'undefined') {
    return new WebSocket(url) as unknown as WSLike
  }
  // Node.js — require ws at runtime (peer dep)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('ws') as { default?: new (url: string) => WSLike } & (new (url: string) => WSLike)
  const WsImpl = mod.default ?? mod
  return new WsImpl(url)
}

interface TwitchClientEvents {
  // Connection lifecycle
  connected: []
  disconnected: [code: number, reason: string]
  revoked: [reason: string]
  auth_error: []
  error: [err: Error]
  /** Fired when an individual EventSub subscription POST fails. The type string identifies which subscription (e.g. `'channel.follow'`). */
  subscription_error: [type: string, err: Error]

  // Chat
  message: [msg: NormalizedMessage]

  // Channel events
  follow: [event: FollowEvent]
  subscribe: [event: SubscribeEvent]
  subscriptionMessage: [event: SubscriptionMessageEvent]
  subscriptionGift: [event: SubscriptionGiftEvent]
  subscriptionEnd: [event: SubscriptionEndEvent]
  cheer: [event: CheerEvent]
  raid: [event: RaidEvent]
  streamOnline: [event: StreamOnlineEvent]
  streamOffline: [event: StreamOfflineEvent]
  channelUpdate: [event: ChannelUpdateEvent]
  'hypeTrain.begin': [event: HypeTrainBeginEvent]
  'hypeTrain.progress': [event: HypeTrainProgressEvent]
  'hypeTrain.end': [event: HypeTrainEndEvent]
  'poll.begin': [event: PollBeginEvent]
  'poll.progress': [event: PollProgressEvent]
  'poll.end': [event: PollEndEvent]
  'prediction.begin': [event: PredictionBeginEvent]
  'prediction.progress': [event: PredictionProgressEvent]
  'prediction.lock': [event: PredictionLockEvent]
  'prediction.end': [event: PredictionEndEvent]
  channelPoints: [event: ChannelPointsEvent]
  adBreak: [event: AdBreakEvent]
  'shoutout.create': [event: ShoutoutCreateEvent]
  'shoutout.receive': [event: ShoutoutReceiveEvent]
}

export class TwitchClient extends EventEmitter<TwitchClientEvents> {
  private options: TwitchClientOptions
  private emoteCache: EmoteCache
  private userCache: UserCache
  private badgeCache: BadgeCache
  private readonly _fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  private readonly _createWebSocket: (url: string) => WSLike

  private ws: WSLike | null = null
  private sessionId: string | null = null
  private keepaliveTimeoutMs = 10_000
  private keepaliveTimer: ReturnType<typeof setTimeout> | null = null

  // Holds the old ws during a session_reconnect handoff
  private oldWs: WSLike | null = null

  private stopped = false

  constructor(options: TwitchClientOptions) {
    super()
    this.options = options
    this._fetch = options.transport?.fetch ?? fetch
    this._createWebSocket = options.transport?.WebSocket
      ? (url) => new (options.transport!.WebSocket!)(url) as unknown as WSLike
      : defaultWebSocket
    this.emoteCache = new EmoteCache(options.channelId)
    this.userCache = new UserCache(
      () => ({ accessToken: this.options.accessToken, clientId: this.options.clientId }),
      this._fetch,
    )
    this.badgeCache = new BadgeCache(
      options.channelId,
      () => ({ accessToken: this.options.accessToken, clientId: this.options.clientId }),
      this._fetch,
    )
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

  async preloadBadges(): Promise<void> {
    await this.badgeCache.load()
  }

  async getUser(userId: string): Promise<UserInfo | null> {
    return this.userCache.getUser(userId)
  }

  async getUsers(userIds: string[]): Promise<Map<string, UserInfo | null>> {
    return this.userCache.getUsers(userIds)
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

  resolveBadge(setId: string, version: string): ResolvedBadge | undefined {
    return this.badgeCache.resolve(setId, version)
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  private _openConnection(url: string, isReconnect: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = this._createWebSocket(url)
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
        try {
          this._handleNotification(payload.subscription.type, payload.event)
        } catch (e) {
          this.emit('error', e instanceof Error ? e : new Error(String(e)))
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

  private _handleNotification(type: string, event: unknown): void {
    switch (type) {
      case 'channel.chat.message':
        this.emit('message', normalizeMessage(
          event as TwitchChatMessageEvent,
          this.emoteCache,
          (setId, version) => this.badgeCache.resolve(setId, version),
        ))
        break
      case 'channel.follow':
        this.emit('follow', normalizeFollow(event as TwitchFollowEvent))
        break
      case 'channel.subscribe':
        this.emit('subscribe', normalizeSubscribe(event as TwitchSubscribeEvent))
        break
      case 'channel.subscription.message':
        this.emit('subscriptionMessage', normalizeSubscriptionMessage(event as TwitchSubscriptionMessageEvent))
        break
      case 'channel.subscription.gift':
        this.emit('subscriptionGift', normalizeSubscriptionGift(event as TwitchSubscriptionGiftEvent))
        break
      case 'channel.subscription.end':
        this.emit('subscriptionEnd', normalizeSubscriptionEnd(event as TwitchSubscriptionEndEvent))
        break
      case 'channel.cheer':
        this.emit('cheer', normalizeCheer(event as TwitchCheerEvent))
        break
      case 'channel.raid':
        this.emit('raid', normalizeRaid(event as TwitchRaidEvent))
        break
      case 'stream.online':
        this.emit('streamOnline', normalizeStreamOnline(event as TwitchStreamOnlineEvent))
        break
      case 'stream.offline':
        this.emit('streamOffline', normalizeStreamOffline(event as TwitchStreamOfflineEvent))
        break
      case 'channel.update':
        this.emit('channelUpdate', normalizeChannelUpdate(event as TwitchChannelUpdateEvent))
        break
      case 'channel.hype_train.begin':
        this.emit('hypeTrain.begin', normalizeHypeTrainBegin(event as TwitchHypeTrainBeginEvent))
        break
      case 'channel.hype_train.progress':
        this.emit('hypeTrain.progress', normalizeHypeTrainProgress(event as TwitchHypeTrainProgressEvent))
        break
      case 'channel.hype_train.end':
        this.emit('hypeTrain.end', normalizeHypeTrainEnd(event as TwitchHypeTrainEndEvent))
        break
      case 'channel.poll.begin':
        this.emit('poll.begin', normalizePollBegin(event as TwitchPollBeginEvent))
        break
      case 'channel.poll.progress':
        this.emit('poll.progress', normalizePollProgress(event as TwitchPollProgressEvent))
        break
      case 'channel.poll.end':
        this.emit('poll.end', normalizePollEnd(event as TwitchPollEndEvent))
        break
      case 'channel.prediction.begin':
        this.emit('prediction.begin', normalizePredictionBegin(event as TwitchPredictionBeginEvent))
        break
      case 'channel.prediction.progress':
        this.emit('prediction.progress', normalizePredictionProgress(event as TwitchPredictionProgressEvent))
        break
      case 'channel.prediction.lock':
        this.emit('prediction.lock', normalizePredictionLock(event as TwitchPredictionLockEvent))
        break
      case 'channel.prediction.end':
        this.emit('prediction.end', normalizePredictionEnd(event as TwitchPredictionEndEvent))
        break
      case 'channel.channel_points_custom_reward_redemption.add':
        this.emit('channelPoints', normalizeChannelPoints(event as TwitchChannelPointsEvent))
        break
      case 'channel.ad_break.begin':
        this.emit('adBreak', normalizeAdBreak(event as TwitchAdBreakEvent))
        break
      case 'channel.shoutout.create':
        this.emit('shoutout.create', normalizeShoutoutCreate(event as TwitchShoutoutCreateEvent))
        break
      case 'channel.shoutout.receive':
        this.emit('shoutout.receive', normalizeShoutoutReceive(event as TwitchShoutoutReceiveEvent))
        break
    }
  }

  // ---------------------------------------------------------------------------
  // Helix subscriptions
  // ---------------------------------------------------------------------------

  private async _subscribe(): Promise<void> {
    if (!this.sessionId) throw new Error('No session ID')

    const subs = this.options.subscriptions ?? {}
    const { channelId, userId } = this.options

    // Build descriptors for all enabled subscriptions
    const descriptors: Array<{ type: string; version: string; condition: Record<string, string> }> = []

    if (subs.chat) {
      descriptors.push({ type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: channelId, user_id: userId } })
    }
    if (subs.follow) {
      descriptors.push({ type: 'channel.follow', version: '2', condition: { broadcaster_user_id: channelId, moderator_user_id: userId } })
    }
    if (subs.subscribe) {
      descriptors.push(
        { type: 'channel.subscribe', version: '1', condition: { broadcaster_user_id: channelId } },
        { type: 'channel.subscription.message', version: '1', condition: { broadcaster_user_id: channelId } },
        { type: 'channel.subscription.gift', version: '1', condition: { broadcaster_user_id: channelId } },
        { type: 'channel.subscription.end', version: '1', condition: { broadcaster_user_id: channelId } },
      )
    }
    if (subs.cheer) {
      descriptors.push({ type: 'channel.cheer', version: '1', condition: { broadcaster_user_id: channelId } })
    }
    if (subs.raid) {
      descriptors.push({ type: 'channel.raid', version: '1', condition: { to_broadcaster_user_id: channelId } })
    }
    if (subs.streamStatus) {
      descriptors.push(
        { type: 'stream.online', version: '1', condition: { broadcaster_user_id: channelId } },
        { type: 'stream.offline', version: '1', condition: { broadcaster_user_id: channelId } },
      )
    }
    if (subs.channelUpdate) {
      descriptors.push({ type: 'channel.update', version: '2', condition: { broadcaster_user_id: channelId } })
    }
    if (subs.hypeTrain) {
      descriptors.push(
        { type: 'channel.hype_train.begin', version: '2', condition: { broadcaster_user_id: channelId } },
        { type: 'channel.hype_train.progress', version: '2', condition: { broadcaster_user_id: channelId } },
        { type: 'channel.hype_train.end', version: '2', condition: { broadcaster_user_id: channelId } },
      )
    }
    if (subs.polls) {
      descriptors.push(
        { type: 'channel.poll.begin', version: '1', condition: { broadcaster_user_id: channelId } },
        { type: 'channel.poll.progress', version: '1', condition: { broadcaster_user_id: channelId } },
        { type: 'channel.poll.end', version: '1', condition: { broadcaster_user_id: channelId } },
      )
    }
    if (subs.predictions) {
      descriptors.push(
        { type: 'channel.prediction.begin', version: '1', condition: { broadcaster_user_id: channelId } },
        { type: 'channel.prediction.progress', version: '1', condition: { broadcaster_user_id: channelId } },
        { type: 'channel.prediction.lock', version: '1', condition: { broadcaster_user_id: channelId } },
        { type: 'channel.prediction.end', version: '1', condition: { broadcaster_user_id: channelId } },
      )
    }
    if (subs.channelPoints) {
      descriptors.push({ type: 'channel.channel_points_custom_reward_redemption.add', version: '1', condition: { broadcaster_user_id: channelId } })
    }
    if (subs.adBreak) {
      descriptors.push({ type: 'channel.ad_break.begin', version: '1', condition: { broadcaster_user_id: channelId } })
    }
    if (subs.shoutouts) {
      descriptors.push(
        { type: 'channel.shoutout.create', version: '1', condition: { broadcaster_user_id: channelId, moderator_user_id: userId } },
        { type: 'channel.shoutout.receive', version: '1', condition: { broadcaster_user_id: channelId, moderator_user_id: userId } },
      )
    }

    if (descriptors.length === 0) return

    await Promise.allSettled(
      descriptors.map(desc => this._postSubscription(desc.type, desc.version, desc.condition)),
    )
  }

  private async _postSubscription(
    type: string,
    version: string,
    condition: Record<string, string>,
  ): Promise<void> {
    const res = await this._fetch(HELIX_SUBSCRIPTIONS, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.options.accessToken}`,
        'Client-Id': this.options.clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        version,
        condition,
        transport: {
          method: 'websocket',
          session_id: this.sessionId,
        },
      }),
    })

    if (res.status === 401) {
      this.emit('auth_error')
      this.emit('subscription_error', type, new Error(`Auth error subscribing to ${type}`))
      return
    }

    if (!res.ok) {
      const body = await res.text()
      this.emit('subscription_error', type, new Error(`EventSub subscription failed for ${type}: ${res.status} ${body}`))
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
