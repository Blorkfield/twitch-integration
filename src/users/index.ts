interface HelixUser {
  id: string
  login: string
  display_name: string
  profile_image_url: string
}

interface CacheEntry {
  url: string
  expiresAt: number
}

const HELIX_USERS = 'https://api.twitch.tv/helix/users'
const TTL_MS = 5 * 60 * 1_000

export class UserCache {
  private cache = new Map<string, CacheEntry>()

  constructor(
    private readonly getCredentials: () => { accessToken: string; clientId: string },
  ) {}

  async getProfilePictureUrl(userId: string): Promise<string | null> {
    const results = await this.getProfilePictureUrls([userId])
    return results.get(userId) ?? null
  }

  async getProfilePictureUrls(userIds: string[]): Promise<Map<string, string>> {
    const now = Date.now()
    const result = new Map<string, string>()
    const toFetch: string[] = []

    for (const id of userIds) {
      const entry = this.cache.get(id)
      if (entry !== undefined && entry.expiresAt > now) {
        result.set(id, entry.url)
      } else {
        toFetch.push(id)
      }
    }

    if (toFetch.length === 0) return result

    for (let i = 0; i < toFetch.length; i += 100) {
      const chunk = toFetch.slice(i, i + 100)
      const fetched = await this._fetchChunk(chunk, now)
      for (const [id, url] of fetched) {
        result.set(id, url)
      }
    }

    return result
  }

  private async _fetchChunk(ids: string[], now: number): Promise<Map<string, string>> {
    const params = new URLSearchParams()
    for (const id of ids) params.append('id', id)

    const { accessToken, clientId } = this.getCredentials()
    const res = await fetch(`${HELIX_USERS}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': clientId,
      },
    })

    if (!res.ok) {
      throw new Error(`Helix users fetch failed: ${res.status}`)
    }

    const body = (await res.json()) as { data: HelixUser[] }
    const result = new Map<string, string>()
    const expiresAt = now + TTL_MS

    for (const user of body.data) {
      this.cache.set(user.id, { url: user.profile_image_url, expiresAt })
      result.set(user.id, user.profile_image_url)
    }

    return result
  }
}
