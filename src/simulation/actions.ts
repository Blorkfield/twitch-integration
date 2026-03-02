import type { MockEventSubWebSocket } from './mock-websocket.js'
import type { ChannelContext } from './event-builders.js'
import {
  chatMessageEvent,
  followEvent,
  subscribeEvent,
  resubEvent,
  giftSubEvent,
  cheerEvent,
  raidEvent,
} from './event-builders.js'
import type { SimUser } from './users.js'
import { randomChoice } from './users.js'

export type ActionType = 'chat' | 'follow' | 'subscribe' | 'resub' | 'giftsub' | 'cheer' | 'raid'

export const ACTION_LABELS: Record<ActionType, string> = {
  chat: 'Chat Message',
  follow: 'Follow',
  subscribe: 'Subscribe',
  resub: 'Resub',
  giftsub: 'Gift Sub',
  cheer: 'Cheer',
  raid: 'Raid',
}

export const CHAT_MESSAGES = [
  'hey',
  'lol',
  'nice',
  'wait what',
  'no way',
  'gg',
  'lmao',
  'that actually worked',
  'hi chat',
  'good stream',
  'lets go',
  'oh my god',
  'finally',
  'classic',
  'how did that happen',
  'i missed it',
  'worth watching',
  'same',
  'that was close',
  'carrying hard',
]

export interface ActionParams {
  message?: string
  bits?: number
  months?: number
  giftCount?: number
  viewerCount?: number
}

export function executeAction(
  ws: MockEventSubWebSocket,
  user: SimUser,
  action: ActionType,
  channel: ChannelContext,
  params: ActionParams = {},
): void {
  const { subscription_type, event } = buildEvent(user, action, channel, params)
  ws.sendNotification(subscription_type, event)
}

function buildEvent(user: SimUser, action: ActionType, channel: ChannelContext, params: ActionParams) {
  switch (action) {
    case 'chat':
      return chatMessageEvent(user, params.message ?? randomChoice(CHAT_MESSAGES), channel)
    case 'follow':
      return followEvent(user, channel)
    case 'subscribe':
      return subscribeEvent(user, channel)
    case 'resub':
      return resubEvent(
        user,
        channel,
        params.months ?? Math.floor(Math.random() * 24) + 1,
        params.message,
      )
    case 'giftsub':
      return giftSubEvent(user, channel, params.giftCount ?? Math.floor(Math.random() * 5) + 1)
    case 'cheer':
      return cheerEvent(user, channel, params.bits ?? 100, params.message)
    case 'raid':
      return raidEvent(user, channel, params.viewerCount ?? Math.floor(Math.random() * 500) + 10)
  }
}
