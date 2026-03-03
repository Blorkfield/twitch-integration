import { TwitchClient } from '../client.js'
import { MockEventSubWebSocket, createMockFetch } from './mock-websocket.js'
import { executeAction } from './actions.js'
import type { ActionType, ActionParams } from './actions.js'
import { Scheduler } from './scheduler.js'
import type { SchedulerOptions } from './scheduler.js'
import { USER_POOL, randomUser } from './users.js'
import type { SimUser } from './users.js'
import type { ChannelContext } from './event-builders.js'
import { avatarDataUri } from './avatars.js'

export interface SimulationOptions {
  /** Simulated channel ID. Default: `'mock_channel'` */
  channelId?: string
  /** Simulated channel login. Default: `'mock_streamer'` */
  channelLogin?: string
  /** Simulated channel display name. Default: `'MockStreamer'` */
  channelName?: string
  /** User pool for random selection. Default: built-in 8-user pool. */
  users?: SimUser[]
}

export interface ScenarioOptions {
  /** How long to run in seconds. */
  duration: number
  /** Events per second. */
  rate: number
  /** Which action types to include. Default: all actions. */
  actions?: ActionType[]
  /** User selection mode or explicit list. Default: `'random'` from the simulator's user pool. */
  users?: 'random' | SimUser[]
  /** Called each time an event fires. */
  onFire?: (user: SimUser, action: ActionType) => void
  /** Called when the scenario finishes. */
  onComplete?: () => void
}

const ALL_ACTIONS: ActionType[] = ['chat', 'follow', 'subscribe', 'resub', 'giftsub', 'cheer', 'raid']

export class TwitchSimulator {
  readonly client: TwitchClient
  readonly users: SimUser[]

  private readonly channel: ChannelContext
  private readonly scheduler = new Scheduler()

  constructor(options: SimulationOptions = {}) {
    this.channel = {
      id: options.channelId ?? 'mock_channel',
      login: options.channelLogin ?? 'mock_streamer',
      name: options.channelName ?? 'MockStreamer',
    }
    const rawUsers = options.users ?? USER_POOL
    this.users = rawUsers.map((u, i) =>
      u.profileImageUrl ? u : { ...u, profileImageUrl: avatarDataUri(u.color, i) },
    )

    const mockFetch = createMockFetch(this.users)

    this.client = new TwitchClient({
      channelId: this.channel.id,
      userId: 'mock_user',
      clientId: 'mock_client_id',
      accessToken: 'mock_access_token',
      subscriptions: {
        chat: true,
        follow: true,
        subscribe: true,
        cheer: true,
        raid: true,
        streamStatus: true,
        channelUpdate: true,
        hypeTrain: true,
        polls: true,
        predictions: true,
        channelPoints: true,
        adBreak: true,
        shoutouts: true,
      },
      transport: {
        fetch: mockFetch,
        WebSocket: MockEventSubWebSocket,
      },
    })
  }

  connect(): Promise<void> {
    return this.client.connect()
  }

  disconnect(): void {
    this.scheduler.stop()
    this.client.disconnect()
  }

  // ── Fire individual events ─────────────────────────────────────────────────

  fire(action: ActionType, user?: SimUser, params?: ActionParams): void {
    const ws = MockEventSubWebSocket.current
    if (!ws) return
    executeAction(ws, user ?? randomUser(this.users), action, this.channel, params)
  }

  fireChat(text?: string, user?: SimUser): void {
    this.fire('chat', user, text !== undefined ? { message: text } : undefined)
  }

  fireFollow(user?: SimUser): void {
    this.fire('follow', user)
  }

  fireSubscribe(user?: SimUser): void {
    this.fire('subscribe', user)
  }

  fireResub(months?: number, message?: string, user?: SimUser): void {
    const params: ActionParams = {}
    if (months !== undefined) params.months = months
    if (message !== undefined) params.message = message
    this.fire('resub', user, params)
  }

  fireGiftSub(total?: number, user?: SimUser): void {
    this.fire('giftsub', user, total !== undefined ? { giftCount: total } : undefined)
  }

  fireCheer(bits?: number, message?: string, user?: SimUser): void {
    const params: ActionParams = {}
    if (bits !== undefined) params.bits = bits
    if (message !== undefined) params.message = message
    this.fire('cheer', user, params)
  }

  fireRaid(viewerCount?: number, user?: SimUser): void {
    this.fire('raid', user, viewerCount !== undefined ? { viewerCount } : undefined)
  }

  // ── Scenario runner ────────────────────────────────────────────────────────

  run(options: ScenarioOptions): void {
    const schedulerOpts: SchedulerOptions = {
      durationSeconds: options.duration,
      actionsPerSecond: options.rate,
      actions: options.actions ?? ALL_ACTIONS,
      users: options.users ?? 'random',
      onFire: (user, action) => {
        this.fire(action, user)
        options.onFire?.(user, action)
      },
      ...(options.onComplete !== undefined && { onComplete: options.onComplete }),
    }
    this.scheduler.start(schedulerOpts)
  }

  stop(): void {
    this.scheduler.stop()
  }

  get running(): boolean {
    return this.scheduler.running
  }
}
