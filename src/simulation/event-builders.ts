import type { SimUser } from './users.js'

export interface ChannelContext {
  id: string
  login: string
  name: string
}

function now(): string {
  return new Date().toISOString()
}

export function chatMessageEvent(user: SimUser, message: string, channel: ChannelContext) {
  return {
    subscription_type: 'channel.chat.message',
    event: {
      broadcaster_user_id: channel.id,
      broadcaster_user_login: channel.login,
      broadcaster_user_name: channel.name,
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

export function followEvent(user: SimUser, channel: ChannelContext) {
  return {
    subscription_type: 'channel.follow',
    event: {
      user_id: user.id,
      user_login: user.login,
      user_name: user.displayName,
      broadcaster_user_id: channel.id,
      broadcaster_user_login: channel.login,
      broadcaster_user_name: channel.name,
      followed_at: now(),
    },
  }
}

export function subscribeEvent(
  user: SimUser,
  channel: ChannelContext,
  tier: '1000' | '2000' | '3000' = '1000',
) {
  return {
    subscription_type: 'channel.subscribe',
    event: {
      user_id: user.id,
      user_login: user.login,
      user_name: user.displayName,
      broadcaster_user_id: channel.id,
      broadcaster_user_login: channel.login,
      broadcaster_user_name: channel.name,
      tier,
      is_gift: false,
    },
  }
}

export function resubEvent(user: SimUser, channel: ChannelContext, months: number, message?: string) {
  return {
    subscription_type: 'channel.subscription.message',
    event: {
      user_id: user.id,
      user_login: user.login,
      user_name: user.displayName,
      broadcaster_user_id: channel.id,
      broadcaster_user_login: channel.login,
      broadcaster_user_name: channel.name,
      tier: '1000',
      message: { text: message ?? '', emotes: [] },
      cumulative_months: months,
      streak_months: months,
      duration_months: 1,
    },
  }
}

export function giftSubEvent(user: SimUser, channel: ChannelContext, total: number) {
  return {
    subscription_type: 'channel.subscription.gift',
    event: {
      user_id: user.id,
      user_login: user.login,
      user_name: user.displayName,
      broadcaster_user_id: channel.id,
      broadcaster_user_login: channel.login,
      broadcaster_user_name: channel.name,
      total,
      tier: '1000',
      cumulative_total: total,
      is_anonymous: false,
    },
  }
}

export function cheerEvent(user: SimUser, channel: ChannelContext, bits: number, message?: string) {
  return {
    subscription_type: 'channel.cheer',
    event: {
      is_anonymous: false,
      user_id: user.id,
      user_login: user.login,
      user_name: user.displayName,
      broadcaster_user_id: channel.id,
      broadcaster_user_login: channel.login,
      broadcaster_user_name: channel.name,
      message: message ?? `Cheer${bits}`,
      bits,
    },
  }
}

export function raidEvent(user: SimUser, channel: ChannelContext, viewerCount: number) {
  return {
    subscription_type: 'channel.raid',
    event: {
      from_broadcaster_user_id: user.id,
      from_broadcaster_user_login: user.login,
      from_broadcaster_user_name: user.displayName,
      to_broadcaster_user_id: channel.id,
      to_broadcaster_user_login: channel.login,
      to_broadcaster_user_name: channel.name,
      viewers: viewerCount,
    },
  }
}
