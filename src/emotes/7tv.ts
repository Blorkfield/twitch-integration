import type { ResolvedEmote } from '../types.js'

const API = 'https://7tv.io/v3'
const CDN = 'https://cdn.7tv.app/emote'

interface SevenTvFile {
  name: string
  static_name: string
  width: number
  height: number
  frame_count: number
  size: number
  format: string
}

interface SevenTvEmoteData {
  host: {
    url: string
    files: SevenTvFile[]
  }
  animated: boolean
}

interface SevenTvEmote {
  id: string
  name: string
  data: SevenTvEmoteData
}

interface SevenTvEmoteSet {
  emotes: SevenTvEmote[]
}

interface SevenTvChannelResponse {
  emote_set: SevenTvEmoteSet
}

function parseEmote(e: SevenTvEmote): ResolvedEmote {
  return {
    id: e.id,
    name: e.name,
    source: '7tv',
    animated: e.data.animated,
    imageUrl1x: `${CDN}/${e.id}/1x.webp`,
    imageUrl2x: `${CDN}/${e.id}/2x.webp`,
    imageUrl3x: `${CDN}/${e.id}/3x.webp`,
  }
}

export async function fetch7tvGlobal(): Promise<Map<string, ResolvedEmote>> {
  const res = await fetch(`${API}/emote-sets/global`)
  if (!res.ok) throw new Error(`7TV global fetch failed: ${res.status}`)
  const data = (await res.json()) as SevenTvEmoteSet
  const map = new Map<string, ResolvedEmote>()
  for (const e of data.emotes) {
    map.set(e.name, parseEmote(e))
  }
  return map
}

export async function fetch7tvChannel(channelId: string): Promise<Map<string, ResolvedEmote>> {
  const res = await fetch(`${API}/users/twitch/${channelId}`)
  if (!res.ok) throw new Error(`7TV channel fetch failed: ${res.status}`)
  const data = (await res.json()) as SevenTvChannelResponse
  const map = new Map<string, ResolvedEmote>()
  for (const e of data.emote_set.emotes) {
    map.set(e.name, parseEmote(e))
  }
  return map
}
