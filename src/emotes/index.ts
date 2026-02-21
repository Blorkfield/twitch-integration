import type { ResolvedEmote } from '../types.js'
import { buildTwitchEmote } from './twitch.js'
import { fetchBttvGlobal, fetchBttvChannel } from './bttv.js'
import { fetch7tvGlobal, fetch7tvChannel } from './7tv.js'

export class EmoteCache {
  private bttvGlobal = new Map<string, ResolvedEmote>()
  private bttvChannel = new Map<string, ResolvedEmote>()
  private sevenTvGlobal = new Map<string, ResolvedEmote>()
  private sevenTvChannel = new Map<string, ResolvedEmote>()

  constructor(private readonly channelId: string) {}

  async load(): Promise<void> {
    const results = await Promise.allSettled([
      fetchBttvGlobal().then(m => { this.bttvGlobal = m }),
      fetchBttvChannel(this.channelId).then(m => { this.bttvChannel = m }),
      fetch7tvGlobal().then(m => { this.sevenTvGlobal = m }),
      fetch7tvChannel(this.channelId).then(m => { this.sevenTvChannel = m }),
    ])

    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn('[twitch-integration] emote fetch error:', result.reason)
      }
    }
  }

  /**
   * Resolve a third-party emote by name.
   * Priority: 7TV channel > BTTV channel > 7TV global > BTTV global
   *
   * Twitch emotes are resolved separately via resolveFromFragment(), since their
   * IDs come directly from message fragments — no lookup table needed.
   */
  resolveByName(name: string): ResolvedEmote | undefined {
    return (
      this.sevenTvChannel.get(name) ??
      this.bttvChannel.get(name) ??
      this.sevenTvGlobal.get(name) ??
      this.bttvGlobal.get(name)
    )
  }

  /**
   * Resolve a Twitch native emote from fragment data.
   */
  resolveTwitch(id: string, name: string): ResolvedEmote {
    return buildTwitchEmote(id, name)
  }
}
