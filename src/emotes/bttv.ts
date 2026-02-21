import type { ResolvedEmote } from '../types.js'

const API = 'https://api.betterttv.net/3'
const CDN = 'https://cdn.betterttv.net/emote'

interface BttvEmote {
  id: string
  code: string
  imageType: string
  animated: boolean
}

interface BttvChannelResponse {
  channelEmotes: BttvEmote[]
  sharedEmotes: BttvEmote[]
}

function parseEmote(e: BttvEmote): ResolvedEmote {
  return {
    id: e.id,
    name: e.code,
    source: 'bttv',
    animated: e.animated,
    imageUrl1x: `${CDN}/${e.id}/1x`,
    imageUrl2x: `${CDN}/${e.id}/2x`,
    imageUrl3x: `${CDN}/${e.id}/3x`,
  }
}

export async function fetchBttvGlobal(): Promise<Map<string, ResolvedEmote>> {
  const res = await fetch(`${API}/cached/emotes/global`)
  if (!res.ok) throw new Error(`BTTV global fetch failed: ${res.status}`)
  const data = (await res.json()) as BttvEmote[]
  const map = new Map<string, ResolvedEmote>()
  for (const e of data) {
    map.set(e.code, parseEmote(e))
  }
  return map
}

export async function fetchBttvChannel(channelId: string): Promise<Map<string, ResolvedEmote>> {
  const res = await fetch(`${API}/cached/users/twitch/${channelId}`)
  if (!res.ok) throw new Error(`BTTV channel fetch failed: ${res.status}`)
  const data = (await res.json()) as BttvChannelResponse
  const map = new Map<string, ResolvedEmote>()
  for (const e of [...data.channelEmotes, ...data.sharedEmotes]) {
    map.set(e.code, parseEmote(e))
  }
  return map
}
