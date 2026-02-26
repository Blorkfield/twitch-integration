// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TwitchClientSubscriptions {
  /** channel.chat.message v1 | scope: user:read:chat */
  chat?: boolean
  /** channel.follow v2 | scope: moderator:read:followers */
  follow?: boolean
  /** channel.subscribe v1 + channel.subscription.message v1 + channel.subscription.gift v1 + channel.subscription.end v1 | scope: channel:read:subscriptions */
  subscribe?: boolean
  /** channel.cheer v1 | scope: bits:read */
  cheer?: boolean
  /** channel.raid v1 | no scope required */
  raid?: boolean
  /** stream.online v1 + stream.offline v1 | no scope required */
  streamStatus?: boolean
  /** channel.update v2 | no scope required */
  channelUpdate?: boolean
  /** channel.hype_train.begin/progress/end v2 | scope: channel:read:hype_train */
  hypeTrain?: boolean
  /** channel.poll.begin/progress/end v1 | scope: channel:read:polls */
  polls?: boolean
  /** channel.prediction.begin/progress/lock/end v1 | scope: channel:read:predictions */
  predictions?: boolean
  /** channel.channel_points_custom_reward_redemption.add v1 | scope: channel:read:redemptions */
  channelPoints?: boolean
  /** channel.ad_break.begin v1 | scope: channel:read:ads */
  adBreak?: boolean
  /** channel.shoutout.create v1 + channel.shoutout.receive v1 | scope: moderator:read:shoutouts */
  shoutouts?: boolean
}

export interface TwitchClientOptions {
  channelId: string
  userId: string
  clientId: string
  accessToken: string
  /** Which EventSub subscriptions to register on connect. All omitted/false = nothing subscribed. */
  subscriptions?: TwitchClientSubscriptions
  onTokenRefresh?: (newToken: string) => void
}

/** @deprecated Use TwitchClientOptions */
export type TwitchChatOptions = TwitchClientOptions

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface UserInfo {
  id: string
  login: string
  displayName: string
  profileImageUrl: string
  broadcasterType: 'partner' | 'affiliate' | ''
  description: string
  createdAt: string
}

export interface ResolvedBadge {
  title: string
  imageUrl1x: string
  imageUrl2x: string
  imageUrl4x: string
}

export interface Badge {
  setId: string
  id: string
  info: string
  resolved?: ResolvedBadge
}

/** Minimal user reference included in channel event payloads. */
export interface EventUser {
  id: string
  login: string
  displayName: string
}

// ---------------------------------------------------------------------------
// Chat types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Channel event payload types (normalized, camelCase)
// ---------------------------------------------------------------------------

export interface FollowEvent {
  user: EventUser
  followedAt: string
}

export interface SubscribeEvent {
  user: EventUser
  tier: '1000' | '2000' | '3000'
  isGift: boolean
}

export interface SubscriptionMessageEvent {
  user: EventUser
  tier: '1000' | '2000' | '3000'
  cumulativeMonths: number
  streakMonths: number | null
  durationMonths: number
  message: { text: string; emotes: Array<{ begin: number; end: number; id: string }> }
}

export interface SubscriptionGiftEvent {
  /** null when anonymous */
  gifter: EventUser | null
  isAnonymous: boolean
  tier: '1000' | '2000' | '3000'
  total: number
  /** null when anonymous or gifter has not shared cumulative total */
  cumulativeTotal: number | null
}

export interface SubscriptionEndEvent {
  user: EventUser
  tier: '1000' | '2000' | '3000'
  isGift: boolean
}

export interface CheerEvent {
  /** null when anonymous */
  user: EventUser | null
  isAnonymous: boolean
  bits: number
  message: string
}

export interface RaidEvent {
  fromBroadcaster: EventUser
  viewerCount: number
}

export interface StreamOnlineEvent {
  id: string
  type: string
  startedAt: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StreamOfflineEvent {}

export interface ChannelUpdateEvent {
  title: string
  language: string
  categoryId: string
  categoryName: string
  contentClassificationLabels: string[]
}

export interface HypeTrainContribution {
  user: EventUser
  type: 'bits' | 'subscription'
  total: number
}

export interface HypeTrainBeginEvent {
  id: string
  total: number
  progress: number
  goal: number
  topContributions: HypeTrainContribution[]
  lastContribution: HypeTrainContribution
  level: number
  startedAt: string
  expiresAt: string
}

export interface HypeTrainProgressEvent {
  id: string
  level: number
  total: number
  progress: number
  goal: number
  topContributions: HypeTrainContribution[]
  lastContribution: HypeTrainContribution
  startedAt: string
  expiresAt: string
}

export interface HypeTrainEndEvent {
  id: string
  level: number
  total: number
  topContributions: HypeTrainContribution[]
  endedAt: string
  cooldownEndsAt: string
}

export interface PollChoice {
  id: string
  title: string
  bitsVotes: number
  channelPointsVotes: number
  votes: number
}

export interface PollBeginEvent {
  id: string
  title: string
  choices: PollChoice[]
  bitsVoting: { isEnabled: boolean; amountPerVote: number }
  channelPointsVoting: { isEnabled: boolean; amountPerVote: number }
  startedAt: string
  endsAt: string
}

export interface PollProgressEvent extends PollBeginEvent {}

export interface PollEndEvent {
  id: string
  title: string
  choices: PollChoice[]
  status: 'completed' | 'archived' | 'terminated'
  startedAt: string
  endedAt: string
}

export interface PredictionPredictor {
  user: EventUser
  channelPointsWon: number | null
  channelPointsUsed: number
}

export interface PredictionOutcome {
  id: string
  title: string
  color: 'blue' | 'pink'
  users: number
  channelPoints: number
  topPredictors: PredictionPredictor[]
}

export interface PredictionBeginEvent {
  id: string
  title: string
  outcomes: PredictionOutcome[]
  startedAt: string
  locksAt: string
}

export interface PredictionProgressEvent extends PredictionBeginEvent {}

export interface PredictionLockEvent {
  id: string
  title: string
  outcomes: PredictionOutcome[]
  startedAt: string
  lockedAt: string
}

export interface PredictionEndEvent {
  id: string
  title: string
  outcomes: PredictionOutcome[]
  winningOutcomeId: string | null
  status: 'resolved' | 'canceled'
  startedAt: string
  endedAt: string
}

export interface ChannelPointsEvent {
  id: string
  user: EventUser
  reward: { id: string; title: string; cost: number; prompt: string }
  userInput: string | null
  status: 'unfulfilled' | 'fulfilled' | 'canceled'
  redeemedAt: string
}

export interface AdBreakEvent {
  durationSeconds: number
  startedAt: string
  isAutomatic: boolean
}

export interface ShoutoutCreateEvent {
  toBroadcaster: EventUser
  viewerCount: number
  startedAt: string
}

export interface ShoutoutReceiveEvent {
  fromBroadcaster: EventUser
  viewerCount: number
  startedAt: string
}

// ---------------------------------------------------------------------------
// Internal: raw Twitch EventSub wire types (snake_case, not exported)
// ---------------------------------------------------------------------------

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
  event: unknown
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

// Raw chat message
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

// Raw channel events
export interface TwitchFollowEvent {
  user_id: string
  user_login: string
  user_name: string
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  followed_at: string
}

export interface TwitchSubscribeEvent {
  user_id: string
  user_login: string
  user_name: string
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  tier: string
  is_gift: boolean
}

export interface TwitchSubscriptionMessageEvent {
  user_id: string
  user_login: string
  user_name: string
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  tier: string
  message: {
    text: string
    emotes: Array<{ begin: number; end: number; id: string }>
  }
  cumulative_months: number
  streak_months: number | null
  duration_months: number
}

export interface TwitchSubscriptionGiftEvent {
  user_id: string | null
  user_login: string | null
  user_name: string | null
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  total: number
  tier: string
  cumulative_total: number | null
  is_anonymous: boolean
}

export interface TwitchSubscriptionEndEvent {
  user_id: string
  user_login: string
  user_name: string
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  tier: string
  is_gift: boolean
}

export interface TwitchCheerEvent {
  is_anonymous: boolean
  user_id: string | null
  user_login: string | null
  user_name: string | null
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  message: string
  bits: number
}

export interface TwitchRaidEvent {
  from_broadcaster_user_id: string
  from_broadcaster_user_login: string
  from_broadcaster_user_name: string
  to_broadcaster_user_id: string
  to_broadcaster_user_login: string
  to_broadcaster_user_name: string
  viewers: number
}

export interface TwitchStreamOnlineEvent {
  id: string
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  type: string
  started_at: string
}

export interface TwitchStreamOfflineEvent {
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
}

export interface TwitchChannelUpdateEvent {
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  title: string
  language: string
  category_id: string
  category_name: string
  content_classification_labels: string[]
}

interface TwitchHypeTrainContribution {
  user_id: string
  user_login: string
  user_name: string
  type: 'bits' | 'subscription'
  total: number
}

export interface TwitchHypeTrainBeginEvent {
  broadcaster_user_id: string
  id: string
  total: number
  progress: number
  goal: number
  top_contributions: TwitchHypeTrainContribution[]
  last_contribution: TwitchHypeTrainContribution
  level: number
  started_at: string
  expires_at: string
}

export interface TwitchHypeTrainProgressEvent {
  broadcaster_user_id: string
  id: string
  level: number
  total: number
  progress: number
  goal: number
  top_contributions: TwitchHypeTrainContribution[]
  last_contribution: TwitchHypeTrainContribution
  started_at: string
  expires_at: string
}

export interface TwitchHypeTrainEndEvent {
  broadcaster_user_id: string
  id: string
  level: number
  total: number
  top_contributions: TwitchHypeTrainContribution[]
  ended_at: string
  cooldown_ends_at: string
}

interface TwitchPollChoiceRaw {
  id: string
  title: string
  bits_votes: number
  channel_points_votes: number
  votes: number
}

export interface TwitchPollBeginEvent {
  broadcaster_user_id: string
  id: string
  title: string
  choices: TwitchPollChoiceRaw[]
  bits_voting: { is_enabled: boolean; amount_per_vote: number }
  channel_points_voting: { is_enabled: boolean; amount_per_vote: number }
  started_at: string
  ends_at: string
}

export interface TwitchPollProgressEvent extends TwitchPollBeginEvent {}

export interface TwitchPollEndEvent {
  broadcaster_user_id: string
  id: string
  title: string
  choices: TwitchPollChoiceRaw[]
  status: 'completed' | 'archived' | 'terminated'
  started_at: string
  ended_at: string
}

interface TwitchPredictionPredictorRaw {
  user_id: string
  user_login: string
  user_name: string
  channel_points_won: number | null
  channel_points_used: number
}

interface TwitchPredictionOutcomeRaw {
  id: string
  title: string
  color: 'blue' | 'pink'
  users: number
  channel_points: number
  top_predictors: TwitchPredictionPredictorRaw[]
}

export interface TwitchPredictionBeginEvent {
  broadcaster_user_id: string
  id: string
  title: string
  outcomes: TwitchPredictionOutcomeRaw[]
  started_at: string
  locks_at: string
}

export interface TwitchPredictionProgressEvent extends TwitchPredictionBeginEvent {}

export interface TwitchPredictionLockEvent {
  broadcaster_user_id: string
  id: string
  title: string
  outcomes: TwitchPredictionOutcomeRaw[]
  started_at: string
  locked_at: string
}

export interface TwitchPredictionEndEvent {
  broadcaster_user_id: string
  id: string
  title: string
  outcomes: TwitchPredictionOutcomeRaw[]
  winning_outcome_id: string | null
  status: 'resolved' | 'canceled'
  started_at: string
  ended_at: string
}

export interface TwitchChannelPointsEvent {
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  id: string
  user_id: string
  user_login: string
  user_name: string
  user_input: string
  status: 'unfulfilled' | 'fulfilled' | 'canceled'
  reward: { id: string; title: string; cost: number; prompt: string }
  redeemed_at: string
}

export interface TwitchAdBreakEvent {
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  duration_seconds: number
  started_at: string
  is_automatic: boolean
}

export interface TwitchShoutoutCreateEvent {
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  to_broadcaster_user_id: string
  to_broadcaster_user_login: string
  to_broadcaster_user_name: string
  moderator_user_id: string
  moderator_user_login: string
  moderator_user_name: string
  viewer_count: number
  started_at: string
}

export interface TwitchShoutoutReceiveEvent {
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  from_broadcaster_user_id: string
  from_broadcaster_user_login: string
  from_broadcaster_user_name: string
  viewer_count: number
  started_at: string
}
