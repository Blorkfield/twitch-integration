import type { ResolvedBadge } from '../types.js'

interface HelixBadgeVersion {
  id: string
  image_url_1x: string
  image_url_2x: string
  image_url_4x: string
  title: string
}

interface HelixBadgeSet {
  set_id: string
  versions: HelixBadgeVersion[]
}

const HELIX_BADGES_GLOBAL = 'https://api.twitch.tv/helix/chat/badges/global'
const HELIX_BADGES_CHANNEL = 'https://api.twitch.tv/helix/chat/badges'

export class BadgeCache {
  // setId → version → ResolvedBadge
  private sets = new Map<string, Map<string, ResolvedBadge>>()

  constructor(
    private readonly channelId: string,
    private readonly getCredentials: () => { accessToken: string; clientId: string },
  ) {}

  async load(): Promise<void> {
    const { accessToken, clientId } = this.getCredentials()
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': clientId,
    }

    const [globalRes, channelRes] = await Promise.all([
      fetch(HELIX_BADGES_GLOBAL, { headers }),
      fetch(`${HELIX_BADGES_CHANNEL}?broadcaster_id=${this.channelId}`, { headers }),
    ])

    if (!globalRes.ok) throw new Error(`Global badges fetch failed: ${globalRes.status}`)
    if (!channelRes.ok) throw new Error(`Channel badges fetch failed: ${channelRes.status}`)

    const [globalBody, channelBody] = await Promise.all([
      globalRes.json() as Promise<{ data: HelixBadgeSet[] }>,
      channelRes.json() as Promise<{ data: HelixBadgeSet[] }>,
    ])

    // Load global first, channel second so channel versions override global
    for (const set of [...globalBody.data, ...channelBody.data]) {
      const versionMap = this.sets.get(set.set_id) ?? new Map<string, ResolvedBadge>()
      for (const v of set.versions) {
        versionMap.set(v.id, {
          title: v.title,
          imageUrl1x: v.image_url_1x,
          imageUrl2x: v.image_url_2x,
          imageUrl4x: v.image_url_4x,
        })
      }
      this.sets.set(set.set_id, versionMap)
    }
  }

  resolve(setId: string, version: string): ResolvedBadge | undefined {
    return this.sets.get(setId)?.get(version)
  }
}
