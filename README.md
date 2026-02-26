# @blorkfield/twitch-integration

Manages a Twitch EventSub WebSocket connection and exposes a typed event stream for all major channel and stream events: chat messages, follows, subscriptions, raids, cheers, channel points, hype trains, polls, predictions, shoutouts, stream status, ad breaks, and channel updates.

---

## Installation

```bash
pnpm add @blorkfield/twitch-integration
# ws is required in Node.js environments
pnpm add ws
```

---

## Prerequisites: credentials

You need four things before constructing `TwitchClient`:

| Option | What it is | How to get it |
|---|---|---|
| `clientId` | Your Twitch app's client ID | [Twitch Developer Console](https://dev.twitch.tv/console/apps) → your app |
| `accessToken` | A **user** access token for the account | OAuth flow — **not** an app access token |
| `userId` | Twitch numeric user ID of the account that owns the token | Call `GET /helix/users` with the token |
| `channelId` | Twitch numeric user ID of the broadcaster whose channel you're monitoring | Call `GET /helix/users?login=channelname` |

The library does not handle OAuth. Obtain the token yourself and pass it in. Use `onTokenRefresh` to persist refreshed tokens.

> **Why a user token?** Twitch's EventSub WebSocket transport does not accept app access tokens — this is a hard Twitch protocol requirement.

---

## Getting an access token

No tools needed.

### Step 1 — Add the redirect URL to your Twitch app

**This must be done before the flow will work.** Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps), open your app, and add exactly this to the **OAuth Redirect URLs** list:

```
https://localhost
```

Save the app. If this value isn't there, Twitch will reject the authorization and you'll get a redirect_uri mismatch error.

### Step 2 — Open the authorization URL

Paste this into your browser after substituting your `clientId`:

```
https://id.twitch.tv/oauth2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=https://localhost&response_type=token&scope=user:read:chat+moderator:read:followers+channel:read:subscriptions+bits:read+channel:read:hype_train+channel:read:polls+channel:read:predictions+channel:read:redemptions+channel:read:ads+moderator:read:shoutouts
```

### Step 3 — Grab the token

1. Authorize in the browser
2. You get redirected to `https://localhost` (which fails to load — that's expected)
3. Your token is in the URL bar: `https://localhost/#access_token=YOUR_TOKEN&...`
4. Copy everything after `access_token=` up to the first `&`

That's your `accessToken`. You only need scopes for the subscription flags you actually enable — remove any you don't need from the scope list before opening the URL.

---

## OAuth scopes

Each subscription type requires the corresponding scope(s) on your access token. Only enable subscriptions for scopes your token actually has — missing scopes cause individual subscription failures which are emitted as `error` events.

| `subscriptions` flag | EventSub types registered | Required scope |
|---|---|---|
| `chat` | `channel.chat.message` | `user:read:chat` |
| `follow` | `channel.follow` | `moderator:read:followers` |
| `subscribe` | `channel.subscribe`, `channel.subscription.message`, `channel.subscription.gift`, `channel.subscription.end` | `channel:read:subscriptions` |
| `cheer` | `channel.cheer` | `bits:read` |
| `raid` | `channel.raid` | *(none)* |
| `streamStatus` | `stream.online`, `stream.offline` | *(none)* |
| `channelUpdate` | `channel.update` | *(none)* |
| `hypeTrain` | `channel.hype_train.begin`, `channel.hype_train.progress`, `channel.hype_train.end` | `channel:read:hype_train` |
| `polls` | `channel.poll.begin`, `channel.poll.progress`, `channel.poll.end` | `channel:read:polls` |
| `predictions` | `channel.prediction.begin`, `channel.prediction.progress`, `channel.prediction.lock`, `channel.prediction.end` | `channel:read:predictions` |
| `channelPoints` | `channel.channel_points_custom_reward_redemption.add` | `channel:read:redemptions` |
| `adBreak` | `channel.ad_break.begin` | `channel:read:ads` |
| `shoutouts` | `channel.shoutout.create`, `channel.shoutout.receive` | `moderator:read:shoutouts` |

---

## APIs called at runtime

### On `connect()`

1. Opens a WebSocket to `wss://eventsub.wss.twitch.tv/ws`
2. Receives `session_welcome` from Twitch containing a `session_id`
3. `POST https://api.twitch.tv/helix/eventsub/subscriptions` — one call per enabled subscription, registered in parallel using your `clientId` + `accessToken`

### On `preloadEmotes()` / `refreshEmotes()`

Four parallel fetches, all unauthenticated:

| Source | Endpoint |
|---|---|
| BTTV global | `GET https://api.betterttv.net/3/cached/emotes/global` |
| BTTV channel | `GET https://api.betterttv.net/3/cached/users/twitch/{channelId}` |
| 7TV global | `GET https://7tv.io/v3/emote-sets/global` |
| 7TV channel | `GET https://7tv.io/v3/users/twitch/{channelId}` |

### On `preloadBadges()`

Two parallel calls using your credentials:

- `GET https://api.twitch.tv/helix/chat/badges/global`
- `GET https://api.twitch.tv/helix/chat/badges?broadcaster_id={channelId}`

### On user lookup

- `GET https://api.twitch.tv/helix/users` (batched, cached for 5 minutes)

---

## Usage

```typescript
import { TwitchClient } from '@blorkfield/twitch-integration'

const client = new TwitchClient({
  channelId: '123456789',
  userId: '987654321',
  clientId: 'abc123...',
  accessToken: 'oauth:...',
  subscriptions: {
    chat: true,
    follow: true,
    subscribe: true,
    cheer: true,
    raid: true,
    streamStatus: true,
    hypeTrain: true,
    channelPoints: true,
  },
  onTokenRefresh: (token) => saveTokenSomewhere(token),
})

await client.preloadEmotes()   // optional: fetch BTTV + 7TV emote maps
await client.connect()         // resolves once connected; subscriptions registered in parallel

client.on('message', (msg) => {
  console.log(msg.user.displayName, msg.text)
})

client.on('follow', (e) => {
  console.log(`${e.user.displayName} followed! (${e.followedAt})`)
})

client.on('subscribe', (e) => {
  console.log(`${e.user.displayName} subscribed at tier ${e.tier}`)
})

client.on('raid', (e) => {
  console.log(`${e.fromBroadcaster.displayName} raided with ${e.viewerCount} viewers`)
})

client.on('cheer', (e) => {
  const who = e.isAnonymous ? 'anonymous' : e.user!.displayName
  console.log(`${who} cheered ${e.bits} bits: ${e.message}`)
})

client.on('channelPoints', (e) => {
  console.log(`${e.user.displayName} redeemed "${e.reward.title}"`)
})

client.on('auth_error', () => {
  // token is bad or missing required scopes — re-authenticate
})

client.on('error', (err) => {
  // individual subscription failures, parse errors, etc.
  console.error(err.message)
})

// Later:
client.disconnect()
```

---

## Event reference

### Connection events

| Event | Arguments | When |
|---|---|---|
| `connected` | — | All subscription POSTs attempted; WebSocket ready |
| `disconnected` | `code: number, reason: string` | WebSocket closed |
| `revoked` | `reason: string` | Twitch revoked a subscription |
| `auth_error` | — | 401 response on any subscription POST |
| `subscription_error` | `type: string, err: Error` | Individual subscription POST failed; `type` is the Twitch EventSub type string (e.g. `'channel.follow'`) |
| `error` | `err: Error` | Parse errors and other unexpected errors |

### Channel events

| Event | Arguments | When |
|---|---|---|
| `message` | `msg: NormalizedMessage` | Chat message received |
| `follow` | `event: FollowEvent` | Someone followed the channel |
| `subscribe` | `event: SubscribeEvent` | New subscription (not a resub) |
| `subscriptionMessage` | `event: SubscriptionMessageEvent` | Resub with a shared message |
| `subscriptionGift` | `event: SubscriptionGiftEvent` | Gifted subscription(s) |
| `subscriptionEnd` | `event: SubscriptionEndEvent` | Subscription ended |
| `cheer` | `event: CheerEvent` | Bits cheered |
| `raid` | `event: RaidEvent` | Incoming raid |
| `streamOnline` | `event: StreamOnlineEvent` | Stream went live |
| `streamOffline` | `event: StreamOfflineEvent` | Stream went offline |
| `channelUpdate` | `event: ChannelUpdateEvent` | Title, category, or language changed |
| `hypeTrain.begin` | `event: HypeTrainBeginEvent` | Hype Train started |
| `hypeTrain.progress` | `event: HypeTrainProgressEvent` | Hype Train level progress |
| `hypeTrain.end` | `event: HypeTrainEndEvent` | Hype Train ended |
| `poll.begin` | `event: PollBeginEvent` | Poll created |
| `poll.progress` | `event: PollProgressEvent` | Poll votes updated |
| `poll.end` | `event: PollEndEvent` | Poll ended |
| `prediction.begin` | `event: PredictionBeginEvent` | Prediction created |
| `prediction.progress` | `event: PredictionProgressEvent` | Prediction bets updated |
| `prediction.lock` | `event: PredictionLockEvent` | Prediction locked (no more bets) |
| `prediction.end` | `event: PredictionEndEvent` | Prediction resolved or cancelled |
| `channelPoints` | `event: ChannelPointsEvent` | Channel point reward redeemed |
| `adBreak` | `event: AdBreakEvent` | Ad break started |
| `shoutout.create` | `event: ShoutoutCreateEvent` | Shoutout sent to another channel |
| `shoutout.receive` | `event: ShoutoutReceiveEvent` | Received a shoutout from another channel |

---

## Event payload shapes

All event payloads include minimal user references (`EventUser`) with `id`, `login`, and `displayName`. Use `client.getUser(id)` or `client.getProfilePictureUrl(id)` to fetch the full user info including profile picture.

```typescript
interface EventUser {
  id: string
  login: string
  displayName: string
}
```

### Follow

```typescript
interface FollowEvent {
  user: EventUser
  followedAt: string        // ISO 8601
}
```

### Subscribe

```typescript
interface SubscribeEvent {
  user: EventUser
  tier: '1000' | '2000' | '3000'
  isGift: boolean
}
```

### Subscription message (resub)

```typescript
interface SubscriptionMessageEvent {
  user: EventUser
  tier: '1000' | '2000' | '3000'
  cumulativeMonths: number
  streakMonths: number | null   // null if user chose not to share streak
  durationMonths: number
  message: {
    text: string
    emotes: Array<{ begin: number; end: number; id: string }>
  }
}
```

### Subscription gift

```typescript
interface SubscriptionGiftEvent {
  gifter: EventUser | null      // null if anonymous
  isAnonymous: boolean
  tier: '1000' | '2000' | '3000'
  total: number                 // subs gifted in this batch
  cumulativeTotal: number | null
}
```

### Subscription end

```typescript
interface SubscriptionEndEvent {
  user: EventUser
  tier: '1000' | '2000' | '3000'
  isGift: boolean
}
```

### Cheer

```typescript
interface CheerEvent {
  user: EventUser | null        // null if anonymous
  isAnonymous: boolean
  bits: number
  message: string
}
```

### Raid

```typescript
interface RaidEvent {
  fromBroadcaster: EventUser
  viewerCount: number
}
```

### Stream online

```typescript
interface StreamOnlineEvent {
  id: string
  type: string                  // 'live'
  startedAt: string
}
```

### Stream offline

```typescript
interface StreamOfflineEvent {}
```

### Channel update

```typescript
interface ChannelUpdateEvent {
  title: string
  language: string
  categoryId: string
  categoryName: string
  contentClassificationLabels: string[]
}
```

### Hype Train

```typescript
interface HypeTrainContribution {
  user: EventUser
  type: 'bits' | 'subscription'
  total: number
}

interface HypeTrainBeginEvent {
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

interface HypeTrainProgressEvent {
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

interface HypeTrainEndEvent {
  id: string
  level: number
  total: number
  topContributions: HypeTrainContribution[]
  endedAt: string
  cooldownEndsAt: string
}
```

### Poll

```typescript
interface PollChoice {
  id: string
  title: string
  bitsVotes: number
  channelPointsVotes: number
  votes: number
}

interface PollBeginEvent {
  id: string
  title: string
  choices: PollChoice[]
  bitsVoting: { isEnabled: boolean; amountPerVote: number }
  channelPointsVoting: { isEnabled: boolean; amountPerVote: number }
  startedAt: string
  endsAt: string
}

// PollProgressEvent has the same shape as PollBeginEvent (votes update in place)

interface PollEndEvent {
  id: string
  title: string
  choices: PollChoice[]
  status: 'completed' | 'archived' | 'terminated'
  startedAt: string
  endedAt: string
}
```

### Prediction

```typescript
interface PredictionPredictor {
  user: EventUser
  channelPointsWon: number | null
  channelPointsUsed: number
}

interface PredictionOutcome {
  id: string
  title: string
  color: 'blue' | 'pink'
  users: number
  channelPoints: number
  topPredictors: PredictionPredictor[]
}

interface PredictionBeginEvent {
  id: string
  title: string
  outcomes: PredictionOutcome[]
  startedAt: string
  locksAt: string
}

// PredictionProgressEvent has the same shape as PredictionBeginEvent

interface PredictionLockEvent {
  id: string
  title: string
  outcomes: PredictionOutcome[]
  startedAt: string
  lockedAt: string
}

interface PredictionEndEvent {
  id: string
  title: string
  outcomes: PredictionOutcome[]
  winningOutcomeId: string | null
  status: 'resolved' | 'canceled'
  startedAt: string
  endedAt: string
}
```

### Channel Points redemption

```typescript
interface ChannelPointsEvent {
  id: string
  user: EventUser
  reward: {
    id: string
    title: string
    cost: number
    prompt: string
  }
  userInput: string | null
  status: 'unfulfilled' | 'fulfilled' | 'canceled'
  redeemedAt: string
}
```

### Ad break

```typescript
interface AdBreakEvent {
  durationSeconds: number
  startedAt: string
  isAutomatic: boolean
}
```

### Shoutout

```typescript
interface ShoutoutCreateEvent {
  toBroadcaster: EventUser
  viewerCount: number
  startedAt: string
}

interface ShoutoutReceiveEvent {
  fromBroadcaster: EventUser
  viewerCount: number
  startedAt: string
}
```

---

## NormalizedMessage shape

```typescript
interface NormalizedMessage {
  id: string
  text: string                   // full raw message text
  user: ChatUser
  fragments: MessageFragment[]   // per-token breakdown
  emotes: ResolvedEmote[]        // deduplicated list of all emotes in message
  timestamp: string              // RFC3339
  cheer?: { bits: number }
  reply?: {
    parentMessageId: string
    parentUserLogin: string
    parentUserDisplayName: string
  }
  channelPointsRewardId?: string
}

type MessageFragment =
  | { type: 'text'; text: string }
  | { type: 'emote'; text: string; emote: ResolvedEmote }
  | { type: 'cheermote'; text: string; bits: number; tier: number }
  | { type: 'mention'; text: string; userId: string; userLogin: string }

interface ResolvedEmote {
  id: string
  name: string
  source: 'twitch' | 'bttv' | '7tv'
  animated: boolean
  imageUrl1x: string
  imageUrl2x?: string
  imageUrl3x?: string
}
```

### Emote resolution

Third-party emote name collisions are resolved in priority order:

1. 7TV channel
2. BTTV channel
3. 7TV global
4. BTTV global
5. Twitch (authoritative for native emotes — resolved from fragment data, not name lookup)

---

## User lookup

`TwitchClient` exposes a cached user lookup backed by the Helix API. Use this to fetch profile pictures for users in events.

```typescript
// Full user info
const user: UserInfo | null = await client.getUser('123456789')
// { id, login, displayName, profileImageUrl, broadcasterType, description, createdAt }

// Batch lookup
const users: Map<string, UserInfo | null> = await client.getUsers(['123456789', '987654321'])

// Profile picture shorthand (same cache, same TTL)
const url: string | null = await client.getProfilePictureUrl('123456789')
const urls: Map<string, string | null> = await client.getProfilePictureUrls(['123456789', '987654321'])
```

Results are cached for 5 minutes. `broadcasterType` is `'partner'`, `'affiliate'`, or `''`.

### Example: profile picture in a follow event

```typescript
client.on('follow', async (e) => {
  const pfp = await client.getProfilePictureUrl(e.user.id)
  showFollowAlert({ name: e.user.displayName, avatar: pfp })
})
```

---

## Badges

### Preloading

```typescript
await client.preloadBadges()
```

Fetches global and channel badge sets from Helix in two parallel calls.

### Auto-resolution on messages

If badges are preloaded, each `Badge` in `msg.user.badges` will have a `resolved` field populated automatically:

```typescript
client.on('message', (msg) => {
  for (const badge of msg.user.badges) {
    console.log(badge.setId, badge.id)       // e.g. 'subscriber', '6'
    console.log(badge.resolved?.title)        // e.g. 'Subscriber'
    console.log(badge.resolved?.imageUrl2x)   // CDN image URL
  }
})
```

### Manual resolution

```typescript
const badge: ResolvedBadge | undefined = client.resolveBadge('subscriber', '6')
// { title, imageUrl1x, imageUrl2x, imageUrl4x }
```

---

## Lifecycle notes

- **Reconnect:** handled automatically on unexpected disconnects with a 2s backoff
- **`session_reconnect`:** library connects to the new URL, waits for `session_welcome`, then closes the old connection — subscriptions carry over automatically, no re-POST
- **Keepalive:** Twitch sends keepalives; if one doesn't arrive within `keepalive_timeout_seconds + 0.5s`, the library reconnects
- **Subscription failures:** individual subscription POST failures emit `error` events but do not disconnect or prevent `connected` from firing — the connection stays open for whichever subscriptions succeeded
- **Max 3 active WebSocket connections** per Twitch user account — `disconnect()` cleanly closes before reconnecting elsewhere

---

## Build

```bash
pnpm build      # tsup → dist/ (ESM + CJS + .d.ts)
pnpm typecheck  # tsc --noEmit
```
