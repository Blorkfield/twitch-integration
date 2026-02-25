import type {
  TwitchChatMessageEvent,
  NormalizedMessage,
  MessageFragment,
  ResolvedEmote,
} from './types.js'
import type { EmoteCache } from './emotes/index.js'

export function normalizeMessage(
  event: TwitchChatMessageEvent,
  emoteCache: EmoteCache,
): NormalizedMessage {
  const emotes: ResolvedEmote[] = []
  const fragments: MessageFragment[] = []

  for (const frag of event.message.fragments) {
    switch (frag.type) {
      case 'text': {
        // A "text" fragment may contain third-party emote names.
        // Split on whitespace and check each token against the emote cache.
        const tokens = frag.text.split(/(\s+)/)
        let pendingText = ''

        for (const token of tokens) {
          if (/^\s+$/.test(token)) {
            pendingText += token
            continue
          }
          const resolved = emoteCache.resolveByName(token)
          if (resolved) {
            if (pendingText) {
              fragments.push({ type: 'text', text: pendingText })
              pendingText = ''
            }
            fragments.push({ type: 'emote', text: token, emote: resolved })
            if (!emotes.some(e => e.id === resolved.id)) {
              emotes.push(resolved)
            }
          } else {
            pendingText += token
          }
        }
        if (pendingText) {
          fragments.push({ type: 'text', text: pendingText })
        }
        break
      }

      case 'emote': {
        const emoteData = frag.emote!
        const resolved = emoteCache.resolveTwitch(emoteData.id, frag.text)
        fragments.push({ type: 'emote', text: frag.text, emote: resolved })
        if (!emotes.some(e => e.id === resolved.id)) {
          emotes.push(resolved)
        }
        break
      }

      case 'cheermote': {
        const cheer = frag.cheermote!
        fragments.push({
          type: 'cheermote',
          text: frag.text,
          bits: cheer.bits,
          tier: cheer.tier,
        })
        break
      }

      case 'mention': {
        const mention = frag.mention!
        fragments.push({
          type: 'mention',
          text: frag.text,
          userId: mention.user_id,
          userLogin: mention.user_login,
        })
        break
      }
    }
  }

  const badges = event.badges.map(b => ({
    setId: b.set_id,
    id: b.id,
    info: b.info,
  }))

  const badgeSetIds = new Set(badges.map(b => b.setId))

  const msg: NormalizedMessage = {
    id: event.message_id,
    text: event.message.text,
    user: {
      id: event.chatter_user_id,
      login: event.chatter_user_login,
      displayName: event.chatter_user_name,
      color: event.color,
      badges,
      isModerator: badgeSetIds.has('moderator'),
      isSubscriber: badgeSetIds.has('subscriber'),
      isBroadcaster: badgeSetIds.has('broadcaster'),
      isVip: badgeSetIds.has('vip'),
    },
    fragments,
    emotes,
    timestamp: event.timestamp,
  }

  if (event.cheer != null) {
    msg.cheer = { bits: event.cheer.bits }
  }

  if (event.reply != null) {
    msg.reply = {
      parentMessageId: event.reply.parent_message_id,
      parentUserLogin: event.reply.parent_user_login,
      parentUserDisplayName: event.reply.parent_user_display_name,
    }
  }

  if (event.channel_points_custom_reward_id != null) {
    msg.channelPointsRewardId = event.channel_points_custom_reward_id
  }

  return msg
}
