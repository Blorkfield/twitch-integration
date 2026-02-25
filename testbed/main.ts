import { TabManager } from '@blorkfield/blork-tabs'
import '@blorkfield/blork-tabs/styles.css'
import { TwitchChat } from '@blorkfield/twitch-integration'
import type { NormalizedMessage } from '@blorkfield/twitch-integration'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let chat: TwitchChat | null = null
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
// Chat console (debug panel)
// ---------------------------------------------------------------------------

const chatLog = manager.addDebugPanel({
  id: 'chat',
  title: 'Chat',
  width: 420,
  maxEntries: 200,
  showTimestamps: true,
  hoverDelay: 1500,
  startCollapsed: false,
  initialPosition: { x: window.innerWidth - 724, y: 16 },
})

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
  width: 320,
  content: configContent,
  startCollapsed: false,
  initialPosition: { x: window.innerWidth - 1052, y: 16 },
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
manager.createSnapChain(['config', 'chat', 'lookup'])

// ---------------------------------------------------------------------------
// Wire up the form after the panel is in the DOM
// ---------------------------------------------------------------------------

const form = document.getElementById('config-form') as HTMLFormElement
const btnConnect = document.getElementById('btn-connect') as HTMLButtonElement
const btnDisconnect = document.getElementById('btn-disconnect') as HTMLButtonElement
statusDot = document.getElementById('status-dot')
statusText = document.getElementById('status-text')

// Restore saved values
for (const f of FIELDS) {
  const saved = localStorage.getItem(`twitch-testbed:${f.id}`)
  if (saved) {
    const el = document.getElementById(f.id) as HTMLInputElement
    if (el) el.value = saved
  }
}

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
  if (chat) {
    chat.removeAllListeners()
    chat.disconnect()
    chat = null
  }

  const { channelId, userId, clientId, accessToken } = values

  if (!channelId || !userId || !clientId || !accessToken) {
    chatLog.warn('config', { message: 'All fields are required.' })
    setStatus('error', 'missing fields')
    return
  }

  saveFieldValues(values)
  setStatus('connecting', 'connecting…')
  btnConnect.disabled = true
  btnDisconnect.disabled = false

  chat = new TwitchChat({
    channelId,
    userId,
    clientId,
    accessToken,
    onTokenRefresh: (token) => {
      chatLog.info('auth', { message: 'Token refreshed', token: token.slice(0, 8) + '…' })
    },
  })

  chat.on('connected', () => {
    setStatus('connected', `connected to ${channelId}`)
    chatLog.info('connection', { status: 'connected', channelId })
  })

  chat.on('disconnected', (code, reason) => {
    setStatus('disconnected', `disconnected (${code})`)
    chatLog.warn('connection', { status: 'disconnected', code, reason: reason || '—' })
    btnConnect.disabled = false
    btnDisconnect.disabled = true
  })

  chat.on('message', (msg: NormalizedMessage) => {
    const emoteNames = msg.emotes.map(e => `${e.name} (${e.source})`).join(', ')
    chatLog.log(msg.user.displayName, {
      id: msg.user.id,
      text: msg.text,
      ...(emoteNames ? { emotes: emoteNames } : {}),
      ...(msg.cheer ? { bits: msg.cheer.bits } : {}),
      ...(msg.reply ? { reply_to: msg.reply.parentUserLogin } : {}),
    })
  })

  chat.on('auth_error', () => {
    setStatus('error', 'auth error')
    chatLog.error('auth', { message: 'Token rejected — check your access token and scopes (user:read:chat required)' })
    btnConnect.disabled = false
    btnDisconnect.disabled = true
  })

  chat.on('revoked', (reason) => {
    setStatus('error', `revoked: ${reason}`)
    chatLog.error('eventsub', { message: 'Subscription revoked', reason })
    btnConnect.disabled = false
    btnDisconnect.disabled = true
  })

  chat.on('error', (err) => {
    chatLog.error('error', { message: err.message })
  })

  try {
    chatLog.info('connection', { message: 'Preloading emotes…' })
    await chat.preloadEmotes()
    chatLog.info('emotes', { message: 'BTTV + 7TV emotes loaded' })

    chatLog.info('connection', { message: 'Connecting to EventSub…' })
    await chat.connect()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    setStatus('error', 'failed')
    chatLog.error('connection', { message: msg })
    btnConnect.disabled = false
    btnDisconnect.disabled = true
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  void doConnect(getFieldValues())
})

btnDisconnect.addEventListener('click', () => {
  if (chat) {
    chat.removeAllListeners()
    chat.disconnect()
    chat = null
  }
  setStatus('disconnected', 'disconnected')
  btnConnect.disabled = false
  btnDisconnect.disabled = true
  chatLog.info('connection', { status: 'disconnected by user' })
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

  if (!chat) {
    lookupResult.innerHTML = `<p class="lookup-error">Not connected.</p>`
    return
  }

  lookupResult.innerHTML = `<p class="lookup-status">Loading…</p>`

  try {
    const url = await chat.getProfilePictureUrl(userId)
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
