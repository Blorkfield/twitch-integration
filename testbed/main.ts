import { TabManager } from '@blorkfield/blork-tabs'
import '@blorkfield/blork-tabs/styles.css'
import { TwitchClient } from '@blorkfield/twitch-integration'
import type {
  NormalizedMessage,
  TwitchClientSubscriptions,
  FollowEvent,
  SubscribeEvent,
  SubscriptionMessageEvent,
  SubscriptionGiftEvent,
  SubscriptionEndEvent,
  CheerEvent,
  RaidEvent,
  StreamOnlineEvent,
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
} from '@blorkfield/twitch-integration'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let client: TwitchClient | null = null
let statusDot: HTMLElement | null = null
let statusText: HTMLElement | null = null

function setStatus(state: 'disconnected' | 'connecting' | 'connected' | 'error', label: string) {
  if (!statusDot || !statusText) return
  statusDot.className = `status-dot ${state}`
  statusText.textContent = label
}

// ---------------------------------------------------------------------------
// Tab manager
// ---------------------------------------------------------------------------

const manager = new TabManager({
  snapThreshold: 40,
  panelGap: 0,
  panelMargin: 16,
})

// ---------------------------------------------------------------------------
// Event log (debug panel)
// ---------------------------------------------------------------------------

const eventLog = manager.addDebugPanel({
  id: 'events',
  title: 'Events',
  width: 480,
  maxEntries: 200,
  showTimestamps: true,
  hoverDelay: 1500,
  startCollapsed: false,
  initialPosition: { x: window.innerWidth - 800, y: 16 },
})

// ---------------------------------------------------------------------------
// Subscription checkboxes config
// ---------------------------------------------------------------------------

const SUBSCRIPTION_FLAGS: { key: keyof TwitchClientSubscriptions; label: string; scope: string; types: string[] }[] = [
  { key: 'chat',          label: 'Chat messages',        scope: 'user:read:chat',               types: ['channel.chat.message'] },
  { key: 'follow',        label: 'Follows',              scope: 'moderator:read:followers',      types: ['channel.follow'] },
  { key: 'subscribe',     label: 'Subscriptions',        scope: 'channel:read:subscriptions',   types: ['channel.subscribe', 'channel.subscription.message', 'channel.subscription.gift', 'channel.subscription.end'] },
  { key: 'cheer',         label: 'Cheers / Bits',        scope: 'bits:read',                    types: ['channel.cheer'] },
  { key: 'raid',          label: 'Raids',                scope: '—',                            types: ['channel.raid'] },
  { key: 'streamStatus',  label: 'Stream online/offline',scope: '—',                            types: ['stream.online', 'stream.offline'] },
  { key: 'channelUpdate', label: 'Channel update',       scope: '—',                            types: ['channel.update'] },
  { key: 'hypeTrain',     label: 'Hype Train',           scope: 'channel:read:hype_train',      types: ['channel.hype_train.begin', 'channel.hype_train.progress', 'channel.hype_train.end'] },
  { key: 'polls',         label: 'Polls',                scope: 'channel:read:polls',           types: ['channel.poll.begin', 'channel.poll.progress', 'channel.poll.end'] },
  { key: 'predictions',   label: 'Predictions',          scope: 'channel:read:predictions',     types: ['channel.prediction.begin', 'channel.prediction.progress', 'channel.prediction.lock', 'channel.prediction.end'] },
  { key: 'channelPoints', label: 'Channel Points',       scope: 'channel:read:redemptions',     types: ['channel.channel_points_custom_reward_redemption.add'] },
  { key: 'adBreak',       label: 'Ad Breaks',            scope: 'channel:read:ads',             types: ['channel.ad_break.begin'] },
  { key: 'shoutouts',     label: 'Shoutouts',            scope: 'moderator:read:shoutouts',     types: ['channel.shoutout.create', 'channel.shoutout.receive'] },
]

// Reverse map: Twitch subscription type string → flag key
const typeToSubKey = new Map<string, keyof TwitchClientSubscriptions>()
for (const f of SUBSCRIPTION_FLAGS) {
  for (const t of f.types) typeToSubKey.set(t, f.key)
}

// ---------------------------------------------------------------------------
// Config panel content
// ---------------------------------------------------------------------------

const FIELDS: { id: string; label: string; placeholder: string; type?: string }[] = [
  { id: 'channelId',   label: 'Channel ID',    placeholder: 'broadcaster numeric user ID' },
  { id: 'userId',      label: 'User ID',        placeholder: 'bot/reading account numeric user ID' },
  { id: 'clientId',    label: 'Client ID',      placeholder: 'Twitch app client ID' },
  { id: 'accessToken', label: 'Access Token',   placeholder: 'user access token', type: 'password' },
]

const configContent = `
  <form class="config-form" id="config-form" autocomplete="off">
    ${FIELDS.map(f => `
      <div class="field">
        <label for="${f.id}">${f.label}</label>
        <input
          id="${f.id}"
          name="${f.id}"
          type="${f.type ?? 'text'}"
          placeholder="${f.placeholder}"
          spellcheck="false"
          autocomplete="off"
        />
      </div>
    `).join('')}
    <div class="sub-picker">
      <div class="sub-picker-label">Subscriptions</div>
      <div class="sub-picker-panels">
        <div class="sub-picker-col">
          <div class="sub-picker-col-label">Available</div>
          <select id="subs-available" multiple class="sub-select"></select>
        </div>
        <div class="sub-picker-btns">
          <button type="button" id="btn-sub-add" class="btn sub-btn">&gt;&gt;</button>
          <button type="button" id="btn-sub-remove" class="btn sub-btn">&lt;&lt;</button>
        </div>
        <div class="sub-picker-col">
          <div class="sub-picker-col-label">Active</div>
          <select id="subs-selected" multiple class="sub-select"></select>
        </div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-connect" type="submit" id="btn-connect">Connect</button>
      <button class="btn btn-disconnect" type="button" id="btn-disconnect" disabled>Disconnect</button>
    </div>
    <div class="status-row">
      <span class="status-dot disconnected" id="status-dot"></span>
      <span class="status-text" id="status-text">disconnected</span>
    </div>
  </form>
`

const configPanel = manager.addPanel({
  id: 'config',
  title: 'Twitch Config',
  width: 340,
  content: configContent,
  startCollapsed: false,
  initialPosition: { x: window.innerWidth - 1160, y: 16 },
})

// ---------------------------------------------------------------------------
// User lookup panel
// ---------------------------------------------------------------------------

const lookupContent = `
  <div class="lookup-form">
    <div class="field">
      <label for="lookup-id">User ID</label>
      <input
        id="lookup-id"
        name="lookup-id"
        type="text"
        placeholder="numeric user ID"
        spellcheck="false"
        autocomplete="off"
      />
    </div>
    <button class="btn btn-connect" type="button" id="btn-lookup">Lookup</button>
    <div class="lookup-result" id="lookup-result"></div>
  </div>
`

const lookupPanel = manager.addPanel({
  id: 'lookup',
  title: 'User Lookup',
  width: 280,
  content: lookupContent,
  startCollapsed: false,
  initialPosition: { x: window.innerWidth - 296, y: 16 },
})

// Snap them together
manager.createSnapChain(['config', 'events', 'lookup'])

// ---------------------------------------------------------------------------
// Wire up the form after the panel is in the DOM
// ---------------------------------------------------------------------------

const form = document.getElementById('config-form') as HTMLFormElement
const btnConnect = document.getElementById('btn-connect') as HTMLButtonElement
const btnDisconnect = document.getElementById('btn-disconnect') as HTMLButtonElement
statusDot = document.getElementById('status-dot')
statusText = document.getElementById('status-text')

// Transfer list state
type SubKey = keyof TwitchClientSubscriptions
let selectedSubs: SubKey[] = []

const subsAvailable = document.getElementById('subs-available') as HTMLSelectElement
const subsSelected = document.getElementById('subs-selected') as HTMLSelectElement
const btnSubAdd = document.getElementById('btn-sub-add') as HTMLButtonElement
const btnSubRemove = document.getElementById('btn-sub-remove') as HTMLButtonElement

function renderSubPicker(): void {
  subsAvailable.innerHTML = ''
  subsSelected.innerHTML = ''
  for (const f of SUBSCRIPTION_FLAGS) {
    const opt = document.createElement('option')
    opt.value = f.key
    opt.textContent = f.label
    if (selectedSubs.includes(f.key)) {
      subsSelected.appendChild(opt)
    } else {
      subsAvailable.appendChild(opt)
    }
  }
}

btnSubAdd.addEventListener('click', () => {
  const toAdd = Array.from(subsAvailable.selectedOptions).map(o => o.value as SubKey)
  selectedSubs.push(...toAdd)
  renderSubPicker()
  saveSubState()
})

btnSubRemove.addEventListener('click', () => {
  const toRemove = new Set(Array.from(subsSelected.selectedOptions).map(o => o.value as SubKey))
  selectedSubs = selectedSubs.filter(k => !toRemove.has(k))
  renderSubPicker()
  saveSubState()
})

function saveSubState(): void {
  localStorage.setItem('twitch-testbed:subs', JSON.stringify(selectedSubs))
}

function getSubscriptions(): TwitchClientSubscriptions {
  const result: TwitchClientSubscriptions = {}
  for (const key of selectedSubs) result[key] = true
  return result
}

// Restore saved field values
for (const f of FIELDS) {
  const saved = localStorage.getItem(`twitch-testbed:${f.id}`)
  if (saved) {
    const el = document.getElementById(f.id) as HTMLInputElement
    if (el) el.value = saved
  }
}

// Restore saved subscription selection
const savedSubs = localStorage.getItem('twitch-testbed:subs')
if (savedSubs) {
  try { selectedSubs = JSON.parse(savedSubs) as SubKey[] } catch { /* ignore */ }
}
renderSubPicker()

function getFieldValues() {
  return Object.fromEntries(
    FIELDS.map(f => [f.id, (document.getElementById(f.id) as HTMLInputElement).value.trim()])
  ) as Record<string, string>
}

function saveFieldValues(values: Record<string, string>) {
  for (const f of FIELDS) {
    if (f.id !== 'accessToken') {
      localStorage.setItem(`twitch-testbed:${f.id}`, values[f.id] ?? '')
    }
  }
}

async function doConnect(values: Record<string, string>) {
  if (client) {
    client.removeAllListeners()
    client.disconnect()
    client = null
  }

  const { channelId, userId, clientId, accessToken } = values

  if (!channelId || !userId || !clientId || !accessToken) {
    eventLog.warn('config', { message: 'All fields are required.' })
    setStatus('error', 'missing fields')
    return
  }

  saveFieldValues(values)
  const subscriptions = getSubscriptions()
  setStatus('connecting', 'connecting…')
  btnConnect.disabled = true
  btnDisconnect.disabled = false

  client = new TwitchClient({
    channelId,
    userId,
    clientId,
    accessToken,
    subscriptions,
    onTokenRefresh: (token) => {
      eventLog.info('auth', { message: 'Token refreshed', token: token.slice(0, 8) + '…' })
    },
  })

  client.on('connected', () => {
    setStatus('connected', `connected to ${channelId}`)
    eventLog.info('connection', { status: 'connected', channelId })
  })

  client.on('disconnected', (code, reason) => {
    setStatus('disconnected', `disconnected (${code})`)
    eventLog.warn('connection', { status: 'disconnected', code, reason: reason || '—' })
    btnConnect.disabled = false
    btnDisconnect.disabled = true
  })

  // --- Chat ---
  client.on('message', (msg: NormalizedMessage) => {
    const emoteNames = msg.emotes.map(e => `${e.name} (${e.source})`).join(', ')
    eventLog.log(msg.user.displayName, {
      id: msg.user.id,
      text: msg.text,
      ...(emoteNames ? { emotes: emoteNames } : {}),
      ...(msg.cheer ? { bits: msg.cheer.bits } : {}),
      ...(msg.reply ? { reply_to: msg.reply.parentUserLogin } : {}),
    })
  })

  // --- Follows ---
  client.on('follow', (e: FollowEvent) => {
    eventLog.info('follow', { user: e.user.displayName, userId: e.user.id, followedAt: e.followedAt })
  })

  // --- Subscriptions ---
  client.on('subscribe', (e: SubscribeEvent) => {
    eventLog.info('subscribe', { user: e.user.displayName, tier: e.tier, isGift: e.isGift })
  })

  client.on('subscriptionMessage', (e: SubscriptionMessageEvent) => {
    eventLog.info('resub', {
      user: e.user.displayName,
      tier: e.tier,
      cumulativeMonths: e.cumulativeMonths,
      ...(e.streakMonths != null ? { streakMonths: e.streakMonths } : {}),
      message: e.message.text,
    })
  })

  client.on('subscriptionGift', (e: SubscriptionGiftEvent) => {
    eventLog.info('subgift', {
      gifter: e.isAnonymous ? 'anonymous' : e.gifter?.displayName,
      tier: e.tier,
      total: e.total,
      ...(e.cumulativeTotal != null ? { cumulative: e.cumulativeTotal } : {}),
    })
  })

  client.on('subscriptionEnd', (e: SubscriptionEndEvent) => {
    eventLog.info('subend', { user: e.user.displayName, tier: e.tier, isGift: e.isGift })
  })

  // --- Cheers ---
  client.on('cheer', (e: CheerEvent) => {
    eventLog.info('cheer', {
      user: e.isAnonymous ? 'anonymous' : e.user?.displayName,
      bits: e.bits,
      message: e.message,
    })
  })

  // --- Raids ---
  client.on('raid', (e: RaidEvent) => {
    eventLog.info('raid', { from: e.fromBroadcaster.displayName, viewers: e.viewerCount })
  })

  // --- Stream status ---
  client.on('streamOnline', (e: StreamOnlineEvent) => {
    eventLog.info('stream', { status: 'online', type: e.type, startedAt: e.startedAt })
  })

  client.on('streamOffline', () => {
    eventLog.info('stream', { status: 'offline' })
  })

  // --- Channel update ---
  client.on('channelUpdate', (e: ChannelUpdateEvent) => {
    eventLog.info('channelUpdate', { title: e.title, category: e.categoryName, language: e.language })
  })

  // --- Hype Train ---
  client.on('hypeTrain.begin', (e: HypeTrainBeginEvent) => {
    eventLog.info('hypeTrain', { event: 'begin', level: e.level, total: e.total, goal: e.goal })
  })

  client.on('hypeTrain.progress', (e: HypeTrainProgressEvent) => {
    eventLog.info('hypeTrain', { event: 'progress', level: e.level, total: e.total, progress: e.progress, goal: e.goal })
  })

  client.on('hypeTrain.end', (e: HypeTrainEndEvent) => {
    eventLog.info('hypeTrain', { event: 'end', level: e.level, total: e.total })
  })

  // --- Polls ---
  client.on('poll.begin', (e: PollBeginEvent) => {
    eventLog.info('poll', { event: 'begin', title: e.title, choices: e.choices.map(c => c.title).join(', ') })
  })

  client.on('poll.progress', (e: PollProgressEvent) => {
    const summary = e.choices.map(c => `${c.title}: ${c.votes}`).join(', ')
    eventLog.info('poll', { event: 'progress', title: e.title, votes: summary })
  })

  client.on('poll.end', (e: PollEndEvent) => {
    const summary = e.choices.map(c => `${c.title}: ${c.votes}`).join(', ')
    eventLog.info('poll', { event: 'end', status: e.status, title: e.title, votes: summary })
  })

  // --- Predictions ---
  client.on('prediction.begin', (e: PredictionBeginEvent) => {
    eventLog.info('prediction', { event: 'begin', title: e.title, outcomes: e.outcomes.map(o => o.title).join(' / ') })
  })

  client.on('prediction.progress', (e: PredictionProgressEvent) => {
    const summary = e.outcomes.map(o => `${o.title}: ${o.channelPoints}pts`).join(' / ')
    eventLog.info('prediction', { event: 'progress', title: e.title, outcomes: summary })
  })

  client.on('prediction.lock', (e: PredictionLockEvent) => {
    const summary = e.outcomes.map(o => `${o.title}: ${o.channelPoints}pts`).join(' / ')
    eventLog.info('prediction', { event: 'locked', title: e.title, outcomes: summary })
  })

  client.on('prediction.end', (e: PredictionEndEvent) => {
    const winner = e.outcomes.find(o => o.id === e.winningOutcomeId)
    eventLog.info('prediction', { event: 'end', status: e.status, title: e.title, winner: winner?.title ?? '—' })
  })

  // --- Channel Points ---
  client.on('channelPoints', (e: ChannelPointsEvent) => {
    eventLog.info('channelPoints', {
      user: e.user.displayName,
      reward: e.reward.title,
      ...(e.userInput ? { input: e.userInput } : {}),
      status: e.status,
    })
  })

  // --- Ad Break ---
  client.on('adBreak', (e: AdBreakEvent) => {
    eventLog.info('adBreak', { duration: `${e.durationSeconds}s`, automatic: e.isAutomatic })
  })

  // --- Shoutouts ---
  client.on('shoutout.create', (e: ShoutoutCreateEvent) => {
    eventLog.info('shoutout', { direction: 'sent', to: e.toBroadcaster.displayName, viewers: e.viewerCount })
  })

  client.on('shoutout.receive', (e: ShoutoutReceiveEvent) => {
    eventLog.info('shoutout', { direction: 'received', from: e.fromBroadcaster.displayName, viewers: e.viewerCount })
  })

  // --- Auth / errors ---
  client.on('auth_error', () => {
    setStatus('error', 'auth error')
    eventLog.error('auth', { message: 'Token rejected — check your access token and scopes' })
    btnConnect.disabled = false
    btnDisconnect.disabled = true
  })

  client.on('subscription_error', (type, err) => {
    const flagKey = typeToSubKey.get(type)
    if (flagKey && selectedSubs.includes(flagKey)) {
      selectedSubs = selectedSubs.filter(k => k !== flagKey)
      renderSubPicker()
      saveSubState()
    }
    const flag = SUBSCRIPTION_FLAGS.find(f => f.key === flagKey)
    const label = flag?.label ?? type
    const scope = flag?.scope ?? '—'
    const reason = err.message.split(': ').pop() ?? err.message
    eventLog.error('subscription', { failed: label, scope, reason })
  })

  client.on('revoked', (reason) => {
    setStatus('error', `revoked: ${reason}`)
    eventLog.error('eventsub', { message: 'Subscription revoked', reason })
    btnConnect.disabled = false
    btnDisconnect.disabled = true
  })

  client.on('error', (err) => {
    eventLog.error('error', { message: err.message })
  })

  try {
    if (subscriptions.chat) {
      eventLog.info('connection', { message: 'Preloading emotes…' })
      await client.preloadEmotes()
      eventLog.info('emotes', { message: 'BTTV + 7TV emotes loaded' })
    }

    eventLog.info('connection', { message: 'Connecting to EventSub…' })
    await client.connect()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    setStatus('error', 'failed')
    eventLog.error('connection', { message: msg })
    btnConnect.disabled = false
    btnDisconnect.disabled = true
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  void doConnect(getFieldValues())
})

btnDisconnect.addEventListener('click', () => {
  if (client) {
    client.removeAllListeners()
    client.disconnect()
    client = null
  }
  setStatus('disconnected', 'disconnected')
  btnConnect.disabled = false
  btnDisconnect.disabled = true
  eventLog.info('connection', { status: 'disconnected by user' })
})

// ---------------------------------------------------------------------------
// User lookup wiring
// ---------------------------------------------------------------------------

const btnLookup = document.getElementById('btn-lookup') as HTMLButtonElement
const lookupIdInput = document.getElementById('lookup-id') as HTMLInputElement
const lookupResult = document.getElementById('lookup-result') as HTMLDivElement

btnLookup.addEventListener('click', () => {
  void doLookup()
})

lookupIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void doLookup()
})

async function doLookup() {
  const userId = lookupIdInput.value.trim()
  if (!userId) return

  if (!client) {
    lookupResult.innerHTML = `<p class="lookup-error">Not connected.</p>`
    return
  }

  lookupResult.innerHTML = `<p class="lookup-status">Loading…</p>`

  try {
    const url = await client.getProfilePictureUrl(userId)
    if (url === null) {
      lookupResult.innerHTML = `<p class="lookup-error">User not found.</p>`
    } else {
      lookupResult.innerHTML = `
        <div class="lookup-user">
          <img class="lookup-avatar" src="${url}" alt="profile picture" />
          <span class="lookup-uid">${userId}</span>
        </div>
      `
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lookupResult.innerHTML = `<p class="lookup-error">${msg}</p>`
  }
}

// Unused but satisfies TS - configPanel/lookupPanel are used for DOM side-effects
void configPanel
void lookupPanel
