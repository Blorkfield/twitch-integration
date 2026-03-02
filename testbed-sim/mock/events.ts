import type { SimUser } from '../sim/users.js'

const CHANNEL_ID = 'mock_channel'
const CHANNEL_LOGIN = 'mock_streamer'
const CHANNEL_NAME = 'MockStreamer'

function now(): string {
  return new Date().toISOString()
}

export function chatMessageEvent(user: SimUser, message: string) {
  return {
    subscription_type: 'channel.chat.message',
    event: {
      broadcaster_user_id: CHANNEL_ID,
      broadcaster_user_login: CHANNEL_LOGIN,
      broadcaster_user_name: CHANNEL_NAME,
      chatter_user_id: user.id,
      chatter_user_login: user.login,
      chatter_user_name: user.displayName,
      message_id: crypto.randomUUID(),
      message: {
        text: message,
        fragments: [{ type: 'text', text: message, cheermote: null, emote: null, mention: null }],
      },
      color: user.color,
      badges: [],
      message_type: 'text',
      cheer: null,
      reply: null,
      channel_points_custom_reward_id: null,
      channel_points_animation_id: null,
    },
  }
}

export function followEvent(user: SimUser) {
  return {
    subscription_type: 'channel.follow',
    event: {
      user_id: user.id,
      user_login: user.login,
      user_name: user.displayName,
      broadcaster_user_id: CHANNEL_ID,
      broadcaster_user_login: CHANNEL_LOGIN,
      broadcaster_user_name: CHANNEL_NAME,
      followed_at: now(),
    },
  }
}

export function subscribeEvent(user: SimUser, tier: '1000' | '2000' | '3000' = '1000') {
  return {
    subscription_type: 'channel.subscribe',
    event: {
      user_id: user.id,
      user_login: user.login,
      user_name: user.displayName,
      broadcaster_user_id: CHANNEL_ID,
      broadcaster_user_login: CHANNEL_LOGIN,
      broadcaster_user_name: CHANNEL_NAME,
      tier,
      is_gift: false,
    },
  }
}

export function resubEvent(user: SimUser, months: number, message?: string) {
  return {
    subscription_type: 'channel.subscription.message',
    event: {
      user_id: user.id,
      user_login: user.login,
      user_name: user.displayName,
      broadcaster_user_id: CHANNEL_ID,
      broadcaster_user_login: CHANNEL_LOGIN,
      broadcaster_user_name: CHANNEL_NAME,
      tier: '1000',
      message: { text: message ?? '', emotes: [] },
      cumulative_months: months,
      streak_months: months,
      duration_months: 1,
    },
  }
}

export function giftSubEvent(user: SimUser, total: number) {
  return {
    subscription_type: 'channel.subscription.gift',
    event: {
      user_id: user.id,
      user_login: user.login,
      user_name: user.displayName,
      broadcaster_user_id: CHANNEL_ID,
      broadcaster_user_login: CHANNEL_LOGIN,
      broadcaster_user_name: CHANNEL_NAME,
      total,
      tier: '1000',
      cumulative_total: total,
      is_anonymous: false,
    },
  }
}

export function cheerEvent(user: SimUser, bits: number, message?: string) {
  return {
    subscription_type: 'channel.cheer',
    event: {
      is_anonymous: false,
      user_id: user.id,
      user_login: user.login,
      user_name: user.displayName,
      broadcaster_user_id: CHANNEL_ID,
      broadcaster_user_login: CHANNEL_LOGIN,
      broadcaster_user_name: CHANNEL_NAME,
      message: message ?? `Cheer${bits}`,
      bits,
    },
  }
}

export function raidEvent(user: SimUser, viewerCount: number) {
  return {
    subscription_type: 'channel.raid',
    event: {
      from_broadcaster_user_id: user.id,
      from_broadcaster_user_login: user.login,
      from_broadcaster_user_name: user.displayName,
      to_broadcaster_user_id: CHANNEL_ID,
      to_broadcaster_user_login: CHANNEL_LOGIN,
      to_broadcaster_user_name: CHANNEL_NAME,
      viewers: viewerCount,
    },
  }
}
