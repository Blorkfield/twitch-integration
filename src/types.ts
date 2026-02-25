export interface TwitchChatOptions {
  channelId: string
  userId: string
  clientId: string
  accessToken: string
  onTokenRefresh?: (newToken: string) => void
}

export interface Badge {
  setId: string
  id: string
  info: string
}

export interface ChatUser {
  id: string
  login: string
  displayName: string
  color: string
  badges: Badge[]
  isModerator: boolean
  isSubscriber: boolean
  isBroadcaster: boolean
  isVip: boolean
}

export interface ResolvedEmote {
  id: string
  name: string
  source: 'twitch' | 'bttv' | '7tv'
  animated: boolean
  imageUrl1x: string
  imageUrl2x?: string
  imageUrl3x?: string
}

export type MessageFragment =
  | { type: 'text'; text: string }
  | { type: 'emote'; text: string; emote: ResolvedEmote }
  | { type: 'cheermote'; text: string; bits: number; tier: number }
  | { type: 'mention'; text: string; userId: string; userLogin: string }

export interface NormalizedMessage {
  id: string
  text: string
  user: ChatUser
  fragments: MessageFragment[]
  emotes: ResolvedEmote[]
  timestamp: string
  cheer?: { bits: number }
  reply?: {
    parentMessageId: string
    parentUserLogin: string
    parentUserDisplayName: string
  }
  channelPointsRewardId?: string
}

export interface UserProfile {
  id: string
  profileImageUrl: string
}

// Internal: raw Twitch EventSub payload types

export interface TwitchEventSubMessage {
  metadata: {
    message_id: string
    message_type: 'session_welcome' | 'session_keepalive' | 'notification' | 'session_reconnect' | 'revocation'
    message_timestamp: string
  }
  payload: TwitchEventSubPayload
}

export type TwitchEventSubPayload =
  | TwitchWelcomePayload
  | TwitchKeepalivePayload
  | TwitchNotificationPayload
  | TwitchReconnectPayload
  | TwitchRevocationPayload

export interface TwitchWelcomePayload {
  session: {
    id: string
    status: string
    connected_at: string
    keepalive_timeout_seconds: number
    reconnect_url: string | null
  }
}

export interface TwitchKeepalivePayload {
  session?: {
    keepalive_timeout_seconds?: number
  }
}

export interface TwitchNotificationPayload {
  subscription: {
    type: string
  }
  event: TwitchChatMessageEvent
}

export interface TwitchReconnectPayload {
  session: {
    id: string
    status: string
    reconnect_url: string
  }
}

export interface TwitchRevocationPayload {
  subscription: {
    type: string
    status: string
    condition: Record<string, string>
  }
}

export interface TwitchChatMessageEvent {
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  chatter_user_id: string
  chatter_user_login: string
  chatter_user_name: string
  message_id: string
  message: {
    text: string
    fragments: TwitchRawFragment[]
  }
  color: string
  badges: Array<{ set_id: string; id: string; info: string }>
  message_type: string
  cheer?: { bits: number } | null
  reply?: {
    parent_message_id: string
    parent_user_id: string
    parent_user_login: string
    parent_user_display_name: string
    parent_message_body: string
  } | null
  channel_points_custom_reward_id?: string | null
  source_broadcaster_user_id?: string | null
  timestamp: string
}

export interface TwitchRawFragment {
  type: 'text' | 'cheermote' | 'emote' | 'mention'
  text: string
  cheermote?: {
    prefix: string
    bits: number
    tier: number
  }
  emote?: {
    id: string
    emote_set_id: string
    owner_id: string
    format: string[]
  }
  mention?: {
    user_id: string
    user_name: string
    user_login: string
  }
}
