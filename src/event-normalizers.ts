import type {
  EventUser,
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
  HypeTrainContribution,
  HypeTrainBeginEvent,
  HypeTrainProgressEvent,
  HypeTrainEndEvent,
  PollBeginEvent,
  PollProgressEvent,
  PollEndEvent,
  PredictionOutcome,
  PredictionBeginEvent,
  PredictionProgressEvent,
  PredictionLockEvent,
  PredictionEndEvent,
  ChannelPointsEvent,
  AdBreakEvent,
  ShoutoutCreateEvent,
  ShoutoutReceiveEvent,
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

function user(id: string, login: string, name: string): EventUser {
  return { id, login, displayName: name }
}

export function normalizeFollow(e: TwitchFollowEvent): FollowEvent {
  return {
    user: user(e.user_id, e.user_login, e.user_name),
    followedAt: e.followed_at,
  }
}

export function normalizeSubscribe(e: TwitchSubscribeEvent): SubscribeEvent {
  return {
    user: user(e.user_id, e.user_login, e.user_name),
    tier: e.tier as '1000' | '2000' | '3000',
    isGift: e.is_gift,
  }
}

export function normalizeSubscriptionMessage(e: TwitchSubscriptionMessageEvent): SubscriptionMessageEvent {
  return {
    user: user(e.user_id, e.user_login, e.user_name),
    tier: e.tier as '1000' | '2000' | '3000',
    cumulativeMonths: e.cumulative_months,
    streakMonths: e.streak_months,
    durationMonths: e.duration_months,
    message: e.message,
  }
}

export function normalizeSubscriptionGift(e: TwitchSubscriptionGiftEvent): SubscriptionGiftEvent {
  return {
    gifter: e.is_anonymous || e.user_id == null
      ? null
      : user(e.user_id, e.user_login!, e.user_name!),
    isAnonymous: e.is_anonymous,
    tier: e.tier as '1000' | '2000' | '3000',
    total: e.total,
    cumulativeTotal: e.cumulative_total,
  }
}

export function normalizeSubscriptionEnd(e: TwitchSubscriptionEndEvent): SubscriptionEndEvent {
  return {
    user: user(e.user_id, e.user_login, e.user_name),
    tier: e.tier as '1000' | '2000' | '3000',
    isGift: e.is_gift,
  }
}

export function normalizeCheer(e: TwitchCheerEvent): CheerEvent {
  return {
    user: e.is_anonymous || e.user_id == null
      ? null
      : user(e.user_id, e.user_login!, e.user_name!),
    isAnonymous: e.is_anonymous,
    bits: e.bits,
    message: e.message,
  }
}

export function normalizeRaid(e: TwitchRaidEvent): RaidEvent {
  return {
    fromBroadcaster: user(e.from_broadcaster_user_id, e.from_broadcaster_user_login, e.from_broadcaster_user_name),
    viewerCount: e.viewers,
  }
}

export function normalizeStreamOnline(e: TwitchStreamOnlineEvent): StreamOnlineEvent {
  return {
    id: e.id,
    type: e.type,
    startedAt: e.started_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function normalizeStreamOffline(_e: TwitchStreamOfflineEvent): StreamOfflineEvent {
  return {}
}

export function normalizeChannelUpdate(e: TwitchChannelUpdateEvent): ChannelUpdateEvent {
  return {
    title: e.title,
    language: e.language,
    categoryId: e.category_id,
    categoryName: e.category_name,
    contentClassificationLabels: e.content_classification_labels,
  }
}

function normalizeHypeContribution(c: { user_id: string; user_login: string; user_name: string; type: 'bits' | 'subscription'; total: number }): HypeTrainContribution {
  return {
    user: user(c.user_id, c.user_login, c.user_name),
    type: c.type,
    total: c.total,
  }
}

export function normalizeHypeTrainBegin(e: TwitchHypeTrainBeginEvent): HypeTrainBeginEvent {
  return {
    id: e.id,
    total: e.total,
    progress: e.progress,
    goal: e.goal,
    topContributions: e.top_contributions.map(normalizeHypeContribution),
    lastContribution: normalizeHypeContribution(e.last_contribution),
    level: e.level,
    startedAt: e.started_at,
    expiresAt: e.expires_at,
  }
}

export function normalizeHypeTrainProgress(e: TwitchHypeTrainProgressEvent): HypeTrainProgressEvent {
  return {
    id: e.id,
    level: e.level,
    total: e.total,
    progress: e.progress,
    goal: e.goal,
    topContributions: e.top_contributions.map(normalizeHypeContribution),
    lastContribution: normalizeHypeContribution(e.last_contribution),
    startedAt: e.started_at,
    expiresAt: e.expires_at,
  }
}

export function normalizeHypeTrainEnd(e: TwitchHypeTrainEndEvent): HypeTrainEndEvent {
  return {
    id: e.id,
    level: e.level,
    total: e.total,
    topContributions: e.top_contributions.map(normalizeHypeContribution),
    endedAt: e.ended_at,
    cooldownEndsAt: e.cooldown_ends_at,
  }
}

function normalizePollChoices(choices: TwitchPollBeginEvent['choices']) {
  return choices.map(c => ({
    id: c.id,
    title: c.title,
    bitsVotes: c.bits_votes,
    channelPointsVotes: c.channel_points_votes,
    votes: c.votes,
  }))
}

export function normalizePollBegin(e: TwitchPollBeginEvent): PollBeginEvent {
  return {
    id: e.id,
    title: e.title,
    choices: normalizePollChoices(e.choices),
    bitsVoting: { isEnabled: e.bits_voting.is_enabled, amountPerVote: e.bits_voting.amount_per_vote },
    channelPointsVoting: { isEnabled: e.channel_points_voting.is_enabled, amountPerVote: e.channel_points_voting.amount_per_vote },
    startedAt: e.started_at,
    endsAt: e.ends_at,
  }
}

export function normalizePollProgress(e: TwitchPollProgressEvent): PollProgressEvent {
  return normalizePollBegin(e)
}

export function normalizePollEnd(e: TwitchPollEndEvent): PollEndEvent {
  return {
    id: e.id,
    title: e.title,
    choices: normalizePollChoices(e.choices),
    status: e.status,
    startedAt: e.started_at,
    endedAt: e.ended_at,
  }
}

function normalizePredictionOutcomes(outcomes: TwitchPredictionBeginEvent['outcomes']): PredictionOutcome[] {
  return outcomes.map(o => ({
    id: o.id,
    title: o.title,
    color: o.color,
    users: o.users,
    channelPoints: o.channel_points,
    topPredictors: o.top_predictors.map(p => ({
      user: user(p.user_id, p.user_login, p.user_name),
      channelPointsWon: p.channel_points_won,
      channelPointsUsed: p.channel_points_used,
    })),
  }))
}

export function normalizePredictionBegin(e: TwitchPredictionBeginEvent): PredictionBeginEvent {
  return {
    id: e.id,
    title: e.title,
    outcomes: normalizePredictionOutcomes(e.outcomes),
    startedAt: e.started_at,
    locksAt: e.locks_at,
  }
}

export function normalizePredictionProgress(e: TwitchPredictionProgressEvent): PredictionProgressEvent {
  return normalizePredictionBegin(e)
}

export function normalizePredictionLock(e: TwitchPredictionLockEvent): PredictionLockEvent {
  return {
    id: e.id,
    title: e.title,
    outcomes: normalizePredictionOutcomes(e.outcomes),
    startedAt: e.started_at,
    lockedAt: e.locked_at,
  }
}

export function normalizePredictionEnd(e: TwitchPredictionEndEvent): PredictionEndEvent {
  return {
    id: e.id,
    title: e.title,
    outcomes: normalizePredictionOutcomes(e.outcomes),
    winningOutcomeId: e.winning_outcome_id,
    status: e.status,
    startedAt: e.started_at,
    endedAt: e.ended_at,
  }
}

export function normalizeChannelPoints(e: TwitchChannelPointsEvent): ChannelPointsEvent {
  return {
    id: e.id,
    user: user(e.user_id, e.user_login, e.user_name),
    reward: e.reward,
    userInput: e.user_input || null,
    status: e.status,
    redeemedAt: e.redeemed_at,
  }
}

export function normalizeAdBreak(e: TwitchAdBreakEvent): AdBreakEvent {
  return {
    durationSeconds: e.duration_seconds,
    startedAt: e.started_at,
    isAutomatic: e.is_automatic,
  }
}

export function normalizeShoutoutCreate(e: TwitchShoutoutCreateEvent): ShoutoutCreateEvent {
  return {
    toBroadcaster: user(e.to_broadcaster_user_id, e.to_broadcaster_user_login, e.to_broadcaster_user_name),
    viewerCount: e.viewer_count,
    startedAt: e.started_at,
  }
}

export function normalizeShoutoutReceive(e: TwitchShoutoutReceiveEvent): ShoutoutReceiveEvent {
  return {
    fromBroadcaster: user(e.from_broadcaster_user_id, e.from_broadcaster_user_login, e.from_broadcaster_user_name),
    viewerCount: e.viewer_count,
    startedAt: e.started_at,
  }
}
