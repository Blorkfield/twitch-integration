import type { ResolvedEmote } from '../types.js'

const CDN = 'https://static-cdn.jtvnw.net/emoticons/v2'

export function buildTwitchEmote(id: string, name: string): ResolvedEmote {
  return {
    id,
    name,
    source: 'twitch',
    animated: false,
    imageUrl1x: `${CDN}/${id}/default/dark/1.0`,
    imageUrl2x: `${CDN}/${id}/default/dark/2.0`,
    imageUrl3x: `${CDN}/${id}/default/dark/3.0`,
  }
}
