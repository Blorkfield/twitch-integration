import type { UserInfo } from '../types.js'

interface HelixUser {
  id: string
  login: string
  display_name: string
  profile_image_url: string
  broadcaster_type: 'partner' | 'affiliate' | ''
  description: string
  created_at: string
}

interface CacheEntry {
  user: UserInfo
  expiresAt: number
}

const HELIX_USERS = 'https://api.twitch.tv/helix/users'
const TTL_MS = 5 * 60 * 1_000

export class UserCache {
  private cache = new Map<string, CacheEntry>()

  constructor(
    private readonly getCredentials: () => { accessToken: string; clientId: string },
  ) {}

  async getUser(userId: string): Promise<UserInfo | null> {
    const results = await this.getUsers([userId])
    return results.get(userId) ?? null
  }

  async getUsers(userIds: string[]): Promise<Map<string, UserInfo | null>> {
    const now = Date.now()
    const result = new Map<string, UserInfo | null>()
    const toFetch: string[] = []

    for (const id of userIds) {
      const entry = this.cache.get(id)
      if (entry !== undefined && entry.expiresAt > now) {
        result.set(id, entry.user)
      } else {
        result.set(id, null)
        toFetch.push(id)
      }
    }

    for (let i = 0; i < toFetch.length; i += 100) {
      const chunk = toFetch.slice(i, i + 100)
      const fetched = await this._fetchChunk(chunk, now)
      for (const [id, user] of fetched) {
        result.set(id, user)
      }
    }

    return result
  }

  async getProfilePictureUrl(userId: string): Promise<string | null> {
    const user = await this.getUser(userId)
    return user?.profileImageUrl ?? null
  }

  async getProfilePictureUrls(userIds: string[]): Promise<Map<string, string>> {
    const users = await this.getUsers(userIds)
    const result = new Map<string, string>()
    for (const [id, user] of users) {
      if (user !== null) result.set(id, user.profileImageUrl)
    }
    return result
  }

  private async _fetchChunk(ids: string[], now: number): Promise<Map<string, UserInfo>> {
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
    const result = new Map<string, UserInfo>()
    const expiresAt = now + TTL_MS

    for (const u of body.data) {
      const user: UserInfo = {
        id: u.id,
        login: u.login,
        displayName: u.display_name,
        profileImageUrl: u.profile_image_url,
        broadcasterType: u.broadcaster_type,
        description: u.description,
        createdAt: u.created_at,
      }
      this.cache.set(u.id, { user, expiresAt })
      result.set(u.id, user)
    }

    return result
  }
}
