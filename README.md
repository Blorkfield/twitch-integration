# @blorkfield/twitch-integration

Manages a Twitch EventSub WebSocket connection and normalizes chat messages into a typed event stream with emotes resolved across Twitch, BTTV, and 7TV.

No knowledge of overlays, physics, or effects — just "what did chat say and what emotes were in it."

---

## Installation

```bash
pnpm add @blorkfield/twitch-integration
# ws is required in Node.js environments
pnpm add ws
```

---

## Prerequisites: credentials

You need four things before constructing `TwitchChat`:

| Option | What it is | How to get it |
|---|---|---|
| `clientId` | Your Twitch app's client ID | [Twitch Developer Console](https://dev.twitch.tv/console/apps) → your app |
| `accessToken` | A **user** access token for the bot/reading account | OAuth flow with `user:read:chat` scope — **not** an app access token |
| `userId` | Twitch numeric user ID of the account that owns the token | Call `GET /helix/users` with the token |
| `channelId` | Twitch numeric user ID of the broadcaster whose chat you're reading | Call `GET /helix/users?login=channelname` |

The library does not handle OAuth. Obtain the token yourself and pass it in. Use `onTokenRefresh` to persist refreshed tokens.

> **Why a user token?** Twitch's EventSub WebSocket transport does not accept app access tokens — this is a hard Twitch protocol requirement.

---

## APIs called at runtime

### On `connect()`

1. Opens a WebSocket to `wss://eventsub.wss.twitch.tv/ws`
2. Receives `session_welcome` from Twitch containing a `session_id`
3. `POST https://api.twitch.tv/helix/eventsub/subscriptions` — registers a `channel.chat.message` subscription tied to that session, using your `clientId` + `accessToken`

That's it. Twitch then pushes `channel.chat.message` notifications over the same socket.

### On `preloadEmotes()` / `refreshEmotes()`

Four parallel fetches, all unauthenticated:

| Source | Endpoint |
|---|---|
| BTTV global | `GET https://api.betterttv.net/3/cached/emotes/global` |
| BTTV channel | `GET https://api.betterttv.net/3/cached/users/twitch/{channelId}` |
| 7TV global | `GET https://7tv.io/v3/emote-sets/global` |
| 7TV channel | `GET https://7tv.io/v3/users/twitch/{channelId}` |

Twitch emotes don't need a fetch — their IDs come in the message fragments directly and URLs are constructed from the CDN pattern.

---

## Usage

```typescript
import { TwitchChat } from '@blorkfield/twitch-integration'

const chat = new TwitchChat({
  channelId: '123456789',    // broadcaster's numeric Twitch user ID
  userId: '987654321',       // bot/reading account's numeric Twitch user ID
  clientId: 'abc123...',     // your Twitch app client ID
  accessToken: 'oauth:...',  // user access token with user:read:chat scope
  onTokenRefresh: (token) => saveTokenSomewhere(token),
})

await chat.preloadEmotes()   // fetch BTTV + 7TV emote maps before connecting
await chat.connect()         // resolves once subscribed and receiving messages

chat.on('message', (msg) => {
  console.log(msg.user.displayName, msg.text)
  console.log(msg.emotes)    // all resolved emotes in this message
  console.log(msg.fragments) // text/emote/cheermote/mention breakdown
})

chat.on('auth_error', () => {
  // token is bad or expired — re-authenticate and call chat.connect() again
})

chat.on('revoked', (reason) => {
  // Twitch revoked the subscription — do not auto-reconnect
  console.error('Subscription revoked:', reason)
})

chat.on('disconnected', (code, reason) => {
  // library auto-reconnects on unexpected disconnects (non-1000 codes)
})

// Later:
chat.disconnect()
```

---

## Event reference

| Event | Arguments | When |
|---|---|---|
| `connected` | — | Subscribed and receiving messages |
| `disconnected` | `code: number, reason: string` | WebSocket closed |
| `message` | `msg: NormalizedMessage` | Chat message received |
| `revoked` | `reason: string` | Twitch revoked the subscription |
| `auth_error` | — | 401 response on subscription POST |
| `error` | `err: Error` | Unexpected error |

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

## Lifecycle notes

- **Reconnect:** handled automatically on unexpected disconnects with a 2s backoff
- **`session_reconnect`:** library connects to the new URL, waits for `session_welcome`, then closes the old connection — subscriptions carry over automatically, no re-POST
- **Keepalive:** Twitch sends keepalives; if one doesn't arrive within `keepalive_timeout_seconds + 0.5s`, the library reconnects
- **Max 3 active WebSocket connections** per Twitch user account — `disconnect()` cleanly closes before reconnecting elsewhere

---

## User lookup

`TwitchChat` exposes a cached user lookup backed by the Helix API. Requires an active connection (uses the same credentials).

```typescript
// Full user info
const user: UserInfo | null = await chat.getUser('123456789')
// { id, login, displayName, profileImageUrl, broadcasterType, description, createdAt }

// Batch
const users: Map<string, UserInfo | null> = await chat.getUsers(['123456789', '987654321'])

// Profile picture shorthand (delegates to getUser, same cache)
const url: string | null = await chat.getProfilePictureUrl('123456789')
const urls: Map<string, string | null> = await chat.getProfilePictureUrls(['123456789', '987654321'])
```

`broadcasterType` is `'partner'`, `'affiliate'`, or `''`. Results are cached for 5 minutes — repeated calls for the same user ID don't hit the API again.

---

## Badges

### Preloading

```typescript
await chat.preloadBadges()
```

Fetches global and channel badge sets from Helix in two parallel calls. Call this once before connecting, alongside `preloadEmotes()`.

### Auto-resolution on messages

If badges are preloaded, each `Badge` in `msg.user.badges` will have a `resolved` field populated automatically:

```typescript
chat.on('message', (msg) => {
  for (const badge of msg.user.badges) {
    console.log(badge.setId, badge.id)       // e.g. 'subscriber', '6'
    console.log(badge.resolved?.title)        // e.g. 'Subscriber'
    console.log(badge.resolved?.imageUrl2x)   // CDN image URL
  }
})
```

`badge.resolved` is `undefined` if badges weren't preloaded or the badge isn't in the fetched sets.

### Manual resolution

```typescript
const badge: ResolvedBadge | undefined = chat.resolveBadge('subscriber', '6')
// { title, imageUrl1x, imageUrl2x, imageUrl4x }
```

---

## Build

```bash
pnpm build      # tsup → dist/ (ESM + CJS + .d.ts)
pnpm typecheck  # tsc --noEmit
```
