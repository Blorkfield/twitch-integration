import { TabManager } from '@blorkfield/blork-tabs'
import '@blorkfield/blork-tabs/styles.css'
import { TwitchSimulator, USER_POOL, ACTION_LABELS } from '@blorkfield/twitch-integration/simulation'
import type { ActionType, SimUser } from '@blorkfield/twitch-integration/simulation'

// ── Simulator ──────────────────────────────────────────────────────────────────
const simulator = new TwitchSimulator()
const client = simulator.client

// ── Tab manager ────────────────────────────────────────────────────────────────
const manager = new TabManager({
  snapThreshold: 40,
  panelGap: 0,
  panelMargin: 16,
})

// ── Action types list ─────────────────────────────────────────────────────────
const ACTION_TYPES: ActionType[] = ['chat', 'follow', 'subscribe', 'resub', 'giftsub', 'cheer', 'raid']

// ── Controls panel ─────────────────────────────────────────────────────────────
const controlsContent = `
  <div style="display:flex;flex-direction:column;gap:0;padding:4px 2px">

    <div class="sim-section">
      <div class="sim-section-title">Status</div>
      <div class="sim-status-row">
        <span class="sim-status-dot connecting" id="status-dot"></span>
        <span id="status-text">Connecting…</span>
      </div>
    </div>

    <div class="sim-section">
      <div class="sim-section-title">Users</div>
      <div class="sim-user-grid" id="sim-user-grid"></div>
      <div class="sim-row" style="margin-top:4px">
        <button class="btn btn-ghost" id="btn-all-users" style="font-size:10px;padding:3px 10px">All</button>
        <button class="btn btn-ghost" id="btn-no-users" style="font-size:10px;padding:3px 10px">None</button>
      </div>
    </div>

    <div class="sim-section">
      <div class="sim-section-title">Timeline</div>
      <div class="sim-row">
        <label class="sim-label">Duration <input type="number" id="tl-duration" value="10" min="1" max="3600"> sec</label>
        <label class="sim-label">Rate <input type="number" id="tl-rate" value="2" min="0.1" max="30" step="0.1"> / sec</label>
      </div>
      <div class="sim-row">
        <label class="sim-radio-label"><input type="radio" name="tl-users" value="random" checked> Random</label>
        <label class="sim-radio-label"><input type="radio" name="tl-users" value="selected"> Selected only</label>
      </div>
      <div class="sim-section-subtitle">Actions</div>
      <div class="sim-chips" id="tl-chips"></div>
      <div class="sim-row" style="margin-top:8px">
        <button class="btn btn-run" id="btn-run" disabled>▶ Run</button>
        <button class="btn btn-stop" id="btn-stop" disabled>■ Stop</button>
      </div>
      <div class="sim-progress-wrap" id="progress-wrap" style="margin-top:8px">
        <div class="sim-progress-bar" id="progress-bar"></div>
      </div>
    </div>

    <div class="sim-section">
      <div class="sim-section-title">Manual Action</div>
      <div class="sim-row" style="margin-bottom:6px">
        <select id="manual-user" style="flex:1;background:#0e0e14;border:1px solid #2a2a3a;border-radius:4px;color:#e0e0e0;padding:5px 7px;font-size:13px;font-family:inherit;outline:none;cursor:pointer"></select>
        <select id="manual-action" style="flex:1;background:#0e0e14;border:1px solid #2a2a3a;border-radius:4px;color:#e0e0e0;padding:5px 7px;font-size:13px;font-family:inherit;outline:none;cursor:pointer"></select>
      </div>
      <div class="sim-params" id="manual-params"></div>
      <button class="btn btn-primary" id="btn-send" disabled style="margin-top:8px;width:100%">Send</button>
    </div>

  </div>
`

// ── Chat panel ─────────────────────────────────────────────────────────────────
const chatContent = `
  <div class="sim-chat-log" id="chat-log">
    <div class="sim-chat-empty" id="chat-empty">No events yet — use Controls to send something.</div>
  </div>
`

// ── Add panels ─────────────────────────────────────────────────────────────────
const controlsPanel = manager.addPanel({
  id: 'controls',
  title: 'Controls',
  width: 420,
  content: controlsContent,
  startCollapsed: false,
  initialPosition: { x: window.innerWidth - 816, y: 16 },
})

const chatPanel = manager.addPanel({
  id: 'chat',
  title: 'Chat Simulation',
  width: 380,
  content: chatContent,
  startCollapsed: false,
  initialPosition: { x: window.innerWidth - 396, y: 16 },
})

manager.createSnapChain(['controls', 'chat'])

// ── DOM refs (elements are in the DOM after addPanel) ──────────────────────────
function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

const statusDot  = el('status-dot')
const statusText = el('status-text')
const chatLog    = el('chat-log')
const chatEmpty  = el('chat-empty')

// ── Status ─────────────────────────────────────────────────────────────────────
function setStatus(state: 'connecting' | 'connected' | 'error', text: string): void {
  statusDot.className = `sim-status-dot ${state}`
  statusText.textContent = text
}

// ── Chat helpers ───────────────────────────────────────────────────────────────
function isAtBottom(): boolean {
  return chatLog.scrollTop + chatLog.clientHeight >= chatLog.scrollHeight - 30
}

function addEntry(node: HTMLElement): void {
  const wasBottom = isAtBottom()
  chatEmpty.style.display = 'none'
  chatLog.appendChild(node)
  if (wasBottom) chatLog.scrollTop = chatLog.scrollHeight
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function addChatMsg(user: { displayName: string; color: string }, text: string): void {
  const div = document.createElement('div')
  div.className = 'sim-chat-msg'
  div.innerHTML =
    `<span class="sim-chat-username" style="color:${user.color}">${esc(user.displayName)}</span>` +
    `<span class="sim-chat-colon">:</span>` +
    `<span class="sim-chat-text"> ${esc(text)}</span>`
  addEntry(div)
}

function addNotice(cls: string, html: string): void {
  const div = document.createElement('div')
  div.className = `sim-notice ${cls}`
  div.innerHTML = html
  addEntry(div)
}

// ── Client events ──────────────────────────────────────────────────────────────
client.on('connected', () => {
  setStatus('connected', 'Connected')
  el<HTMLButtonElement>('btn-send').disabled = false
  el<HTMLButtonElement>('btn-run').disabled = false
})

client.on('disconnected', () => {
  setStatus('error', 'Disconnected')
  el<HTMLButtonElement>('btn-send').disabled = true
  el<HTMLButtonElement>('btn-run').disabled = true
})

client.on('error', err => {
  addNotice('sim-notice-error', `Error: ${esc(err.message)}`)
})

client.on('message', msg => {
  addChatMsg({ displayName: msg.user.displayName, color: msg.user.color }, msg.text)
})

client.on('follow', e => {
  addNotice('sim-notice-follow', `→ <strong>${esc(e.user.displayName)}</strong> just followed!`)
})

client.on('subscribe', e => {
  const t = e.tier === '1000' ? 'Tier 1' : e.tier === '2000' ? 'Tier 2' : 'Tier 3'
  addNotice('sim-notice-sub', `★ <strong>${esc(e.user.displayName)}</strong> subscribed with ${t}!`)
})

client.on('subscriptionMessage', e => {
  const t = e.tier === '1000' ? 'Tier 1' : e.tier === '2000' ? 'Tier 2' : 'Tier 3'
  const m = e.cumulativeMonths
  addNotice(
    'sim-notice-sub',
    `★ <strong>${esc(e.user.displayName)}</strong> resubbed ${t} for ${m} month${m !== 1 ? 's' : ''}!` +
      (e.message?.text ? ` <span style="opacity:.65">"${esc(e.message.text)}"</span>` : ''),
  )
})

client.on('subscriptionGift', e => {
  const who = e.gifter ? `<strong>${esc(e.gifter.displayName)}</strong>` : 'An anonymous gifter'
  addNotice('sim-notice-sub', `★ ${who} gifted ${e.total} sub${e.total !== 1 ? 's' : ''}!`)
})

client.on('cheer', e => {
  const who = e.isAnonymous || !e.user ? 'Anonymous' : e.user.displayName
  addNotice('sim-notice-cheer', `♦ <strong>${esc(who)}</strong> cheered ${e.bits} bit${e.bits !== 1 ? 's' : ''}!`)
})

client.on('raid', e => {
  const v = e.viewerCount
  addNotice('sim-notice-raid', `⚡ <strong>${esc(e.fromBroadcaster.displayName)}</strong> raided with ${v} viewer${v !== 1 ? 's' : ''}!`)
})

// ── Build user grid ────────────────────────────────────────────────────────────
const userGrid = el('sim-user-grid')
USER_POOL.forEach(user => {
  const label = document.createElement('label')
  label.className = 'sim-user-item'
  label.innerHTML =
    `<input type="checkbox" data-uid="${user.id}" checked>` +
    `<span class="sim-user-dot" style="background:${user.color}"></span>` +
    `<span class="sim-user-name">${esc(user.displayName)}</span>`
  userGrid.appendChild(label)
})

el('btn-all-users').addEventListener('click', () => {
  userGrid.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(cb => { cb.checked = true })
})
el('btn-no-users').addEventListener('click', () => {
  userGrid.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(cb => { cb.checked = false })
})

function getSelectedUsers(): SimUser[] {
  const ids = new Set(
    Array.from(userGrid.querySelectorAll<HTMLInputElement>('input:checked')).map(cb => cb.dataset.uid!),
  )
  return USER_POOL.filter(u => ids.has(u.id))
}

// ── Build manual action selects ────────────────────────────────────────────────
const manualUserSel = el<HTMLSelectElement>('manual-user')
USER_POOL.forEach(user => {
  const opt = new Option(user.displayName, user.id)
  manualUserSel.appendChild(opt)
})

const manualActionSel = el<HTMLSelectElement>('manual-action')
ACTION_TYPES.forEach(type => {
  const opt = new Option(ACTION_LABELS[type], type)
  manualActionSel.appendChild(opt)
})

// ── Manual params rendering ────────────────────────────────────────────────────
const paramsArea = el('manual-params')

function buildParamsUI(action: ActionType): void {
  paramsArea.innerHTML = ''

  const field = (label: string, input: HTMLInputElement) => {
    const wrap = document.createElement('div')
    wrap.className = 'sim-param-field'
    const lbl = document.createElement('div')
    lbl.className = 'sim-param-label'
    lbl.textContent = label
    wrap.appendChild(lbl)
    wrap.appendChild(input)
    return wrap
  }

  const text = (id: string, ph: string): HTMLInputElement => {
    const i = document.createElement('input')
    i.type = 'text'; i.id = id; i.placeholder = ph; i.className = 'sim-param-input'
    return i
  }

  const num = (id: string, ph: string, min: number, def: number): HTMLInputElement => {
    const i = document.createElement('input')
    i.type = 'number'; i.id = id; i.placeholder = ph; i.className = 'sim-param-input'
    i.min = String(min); i.value = String(def)
    return i
  }

  switch (action) {
    case 'chat':    paramsArea.appendChild(field('Message', text('p-message', 'Hello chat!'))); break
    case 'resub':   paramsArea.appendChild(field('Months', num('p-months', '6', 1, 6)));
                    paramsArea.appendChild(field('Message (optional)', text('p-message', ''))); break
    case 'giftsub': paramsArea.appendChild(field('Gift count', num('p-giftcount', '1', 1, 1))); break
    case 'cheer':   paramsArea.appendChild(field('Bits', num('p-bits', '100', 1, 100)));
                    paramsArea.appendChild(field('Message (optional)', text('p-message', ''))); break
    case 'raid':    paramsArea.appendChild(field('Viewer count', num('p-viewers', '150', 1, 150))); break
    default: break
  }
}

buildParamsUI('chat')
manualActionSel.addEventListener('change', () => buildParamsUI(manualActionSel.value as ActionType))

el('btn-send').addEventListener('click', () => {
  const user = USER_POOL.find(u => u.id === manualUserSel.value)!
  const action = manualActionSel.value as ActionType
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
  const numVal = (id: string, fb: number) => { const v = parseInt(val(id), 10); return isNaN(v) ? fb : v }
  simulator.fire(action, user, {
    ...(val('p-message') ? { message: val('p-message') } : {}),
    ...(action === 'cheer'   ? { bits: numVal('p-bits', 100) }       : {}),
    ...(action === 'resub'   ? { months: numVal('p-months', 6) }     : {}),
    ...(action === 'giftsub' ? { giftCount: numVal('p-giftcount', 1) } : {}),
    ...(action === 'raid'    ? { viewerCount: numVal('p-viewers', 150) } : {}),
  })
})

// ── Timeline action chips ──────────────────────────────────────────────────────
const chipsContainer = el('tl-chips')
ACTION_TYPES.forEach(type => {
  const chip = document.createElement('label')
  chip.className = 'sim-chip selected'
  chip.innerHTML = `<input type="checkbox" value="${type}" checked> ${ACTION_LABELS[type]}`
  chip.querySelector('input')!.addEventListener('change', e => {
    chip.classList.toggle('selected', (e.target as HTMLInputElement).checked)
  })
  chipsContainer.appendChild(chip)
})

function getCheckedActions(): ActionType[] {
  const out: ActionType[] = []
  chipsContainer.querySelectorAll<HTMLInputElement>('input:checked').forEach(cb => out.push(cb.value as ActionType))
  return out.length > 0 ? out : ['chat']
}

// ── Timeline run / stop ────────────────────────────────────────────────────────
const btnRun  = el<HTMLButtonElement>('btn-run')
const btnStop = el<HTMLButtonElement>('btn-stop')
const progressWrap = el('progress-wrap')
const progressBar  = el('progress-bar')

let progressTick: ReturnType<typeof setInterval> | null = null

function startProgress(ms: number): void {
  progressWrap.classList.add('visible')
  progressBar.style.width = '0%'
  const t0 = Date.now()
  progressTick = setInterval(() => {
    progressBar.style.width = `${Math.min(((Date.now() - t0) / ms) * 100, 100)}%`
  }, 100)
}

function stopProgress(): void {
  if (progressTick) { clearInterval(progressTick); progressTick = null }
  progressBar.style.width = '0%'
  progressWrap.classList.remove('visible')
}

btnRun.addEventListener('click', () => {
  const duration = Math.max(1, parseFloat(el<HTMLInputElement>('tl-duration').value) || 10)
  const rate     = Math.max(0.1, parseFloat(el<HTMLInputElement>('tl-rate').value) || 2)
  const userMode = document.querySelector<HTMLInputElement>('input[name="tl-users"]:checked')?.value ?? 'random'
  const selected = getSelectedUsers()
  const users: 'random' | SimUser[] = userMode === 'selected' && selected.length > 0 ? selected : 'random'
  const actions  = getCheckedActions()

  btnRun.disabled = true
  btnStop.disabled = false
  startProgress(duration * 1000)

  simulator.run({
    duration,
    rate,
    users,
    actions,
    onComplete: () => {
      btnRun.disabled = false
      btnStop.disabled = true
      stopProgress()
    },
  })
})

btnStop.addEventListener('click', () => {
  simulator.stop()
  btnRun.disabled = false
  btnStop.disabled = true
  stopProgress()
})

// ── Connect ────────────────────────────────────────────────────────────────────
simulator.connect().catch(err => {
  setStatus('error', 'Connection failed')
  addNotice('sim-notice-error', `Failed to connect: ${esc(String(err))}`)
})

void controlsPanel
void chatPanel
