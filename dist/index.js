var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/client.ts
import EventEmitter from "eventemitter3";

// src/emotes/twitch.ts
var CDN = "https://static-cdn.jtvnw.net/emoticons/v2";
function buildTwitchEmote(id, name) {
  return {
    id,
    name,
    source: "twitch",
    animated: false,
    imageUrl1x: `${CDN}/${id}/default/dark/1.0`,
    imageUrl2x: `${CDN}/${id}/default/dark/2.0`,
    imageUrl3x: `${CDN}/${id}/default/dark/3.0`
  };
}

// src/emotes/bttv.ts
var API = "https://api.betterttv.net/3";
var CDN2 = "https://cdn.betterttv.net/emote";
function parseEmote(e) {
  return {
    id: e.id,
    name: e.code,
    source: "bttv",
    animated: e.animated,
    imageUrl1x: `${CDN2}/${e.id}/1x`,
    imageUrl2x: `${CDN2}/${e.id}/2x`,
    imageUrl3x: `${CDN2}/${e.id}/3x`
  };
}
async function fetchBttvGlobal() {
  const res = await fetch(`${API}/cached/emotes/global`);
  if (!res.ok) throw new Error(`BTTV global fetch failed: ${res.status}`);
  const data = await res.json();
  const map = /* @__PURE__ */ new Map();
  for (const e of data) {
    map.set(e.code, parseEmote(e));
  }
  return map;
}
async function fetchBttvChannel(channelId) {
  const res = await fetch(`${API}/cached/users/twitch/${channelId}`);
  if (!res.ok) throw new Error(`BTTV channel fetch failed: ${res.status}`);
  const data = await res.json();
  const map = /* @__PURE__ */ new Map();
  for (const e of [...data.channelEmotes, ...data.sharedEmotes]) {
    map.set(e.code, parseEmote(e));
  }
  return map;
}

// src/emotes/7tv.ts
var API2 = "https://7tv.io/v3";
var CDN3 = "https://cdn.7tv.app/emote";
function parseEmote2(e) {
  return {
    id: e.id,
    name: e.name,
    source: "7tv",
    animated: e.data.animated,
    imageUrl1x: `${CDN3}/${e.id}/1x.webp`,
    imageUrl2x: `${CDN3}/${e.id}/2x.webp`,
    imageUrl3x: `${CDN3}/${e.id}/3x.webp`
  };
}
async function fetch7tvGlobal() {
  const res = await fetch(`${API2}/emote-sets/global`);
  if (!res.ok) throw new Error(`7TV global fetch failed: ${res.status}`);
  const data = await res.json();
  const map = /* @__PURE__ */ new Map();
  for (const e of data.emotes) {
    map.set(e.name, parseEmote2(e));
  }
  return map;
}
async function fetch7tvChannel(channelId) {
  const res = await fetch(`${API2}/users/twitch/${channelId}`);
  if (!res.ok) throw new Error(`7TV channel fetch failed: ${res.status}`);
  const data = await res.json();
  const map = /* @__PURE__ */ new Map();
  for (const e of data.emote_set.emotes) {
    map.set(e.name, parseEmote2(e));
  }
  return map;
}

// src/emotes/index.ts
var EmoteCache = class {
  constructor(channelId) {
    this.channelId = channelId;
    this.bttvGlobal = /* @__PURE__ */ new Map();
    this.bttvChannel = /* @__PURE__ */ new Map();
    this.sevenTvGlobal = /* @__PURE__ */ new Map();
    this.sevenTvChannel = /* @__PURE__ */ new Map();
  }
  async load() {
    const results = await Promise.allSettled([
      fetchBttvGlobal().then((m) => {
        this.bttvGlobal = m;
      }),
      fetchBttvChannel(this.channelId).then((m) => {
        this.bttvChannel = m;
      }),
      fetch7tvGlobal().then((m) => {
        this.sevenTvGlobal = m;
      }),
      fetch7tvChannel(this.channelId).then((m) => {
        this.sevenTvChannel = m;
      })
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.warn("[twitch-integration] emote fetch error:", result.reason);
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
  resolveByName(name) {
    return this.sevenTvChannel.get(name) ?? this.bttvChannel.get(name) ?? this.sevenTvGlobal.get(name) ?? this.bttvGlobal.get(name);
  }
  /**
   * Resolve a Twitch native emote from fragment data.
   */
  resolveTwitch(id, name) {
    return buildTwitchEmote(id, name);
  }
};

// src/normalizer.ts
function normalizeMessage(event, emoteCache) {
  const emotes = [];
  const fragments = [];
  for (const frag of event.message.fragments) {
    switch (frag.type) {
      case "text": {
        const tokens = frag.text.split(/(\s+)/);
        let pendingText = "";
        for (const token of tokens) {
          if (/^\s+$/.test(token)) {
            pendingText += token;
            continue;
          }
          const resolved = emoteCache.resolveByName(token);
          if (resolved) {
            if (pendingText) {
              fragments.push({ type: "text", text: pendingText });
              pendingText = "";
            }
            fragments.push({ type: "emote", text: token, emote: resolved });
            if (!emotes.some((e) => e.id === resolved.id)) {
              emotes.push(resolved);
            }
          } else {
            pendingText += token;
          }
        }
        if (pendingText) {
          fragments.push({ type: "text", text: pendingText });
        }
        break;
      }
      case "emote": {
        const emoteData = frag.emote;
        const resolved = emoteCache.resolveTwitch(emoteData.id, frag.text);
        fragments.push({ type: "emote", text: frag.text, emote: resolved });
        if (!emotes.some((e) => e.id === resolved.id)) {
          emotes.push(resolved);
        }
        break;
      }
      case "cheermote": {
        const cheer = frag.cheermote;
        fragments.push({
          type: "cheermote",
          text: frag.text,
          bits: cheer.bits,
          tier: cheer.tier
        });
        break;
      }
      case "mention": {
        const mention = frag.mention;
        fragments.push({
          type: "mention",
          text: frag.text,
          userId: mention.user_id,
          userLogin: mention.user_login
        });
        break;
      }
    }
  }
  const badges = event.badges.map((b) => ({
    setId: b.set_id,
    id: b.id,
    info: b.info
  }));
  const badgeSetIds = new Set(badges.map((b) => b.setId));
  const msg = {
    id: event.message_id,
    text: event.message.text,
    user: {
      id: event.chatter_user_id,
      login: event.chatter_user_login,
      displayName: event.chatter_user_name,
      color: event.color,
      badges,
      isModerator: badgeSetIds.has("moderator"),
      isSubscriber: badgeSetIds.has("subscriber"),
      isBroadcaster: badgeSetIds.has("broadcaster"),
      isVip: badgeSetIds.has("vip")
    },
    fragments,
    emotes,
    timestamp: event.timestamp
  };
  if (event.cheer !== void 0) {
    msg.cheer = { bits: event.cheer.bits };
  }
  if (event.reply !== void 0) {
    msg.reply = {
      parentMessageId: event.reply.parent_message_id,
      parentUserLogin: event.reply.parent_user_login,
      parentUserDisplayName: event.reply.parent_user_display_name
    };
  }
  if (event.channel_points_custom_reward_id !== void 0) {
    msg.channelPointsRewardId = event.channel_points_custom_reward_id;
  }
  return msg;
}

// src/client.ts
var EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";
var HELIX_SUBSCRIPTIONS = "https://api.twitch.tv/helix/eventsub/subscriptions";
function createWebSocket(url) {
  if (typeof WebSocket !== "undefined") {
    return new WebSocket(url);
  }
  const mod = __require("ws");
  const WsImpl = mod.default ?? mod;
  return new WsImpl(url);
}
var TwitchChat = class extends EventEmitter {
  constructor(options) {
    super();
    this.ws = null;
    this.sessionId = null;
    this.keepaliveTimeoutMs = 1e4;
    this.keepaliveTimer = null;
    // Holds the old ws during a session_reconnect handoff
    this.oldWs = null;
    this.stopped = false;
    this.options = options;
    this.emoteCache = new EmoteCache(options.channelId);
  }
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  async connect() {
    this.stopped = false;
    await this._openConnection(EVENTSUB_URL, false);
  }
  disconnect() {
    this.stopped = true;
    this._clearKeepaliveTimer();
    this._closeWs(this.ws, 1e3, "disconnect");
    this.ws = null;
    this.sessionId = null;
  }
  async preloadEmotes() {
    await this.emoteCache.load();
  }
  async refreshEmotes() {
    await this.emoteCache.load();
  }
  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------
  _openConnection(url, isReconnect) {
    return new Promise((resolve, reject) => {
      const ws = createWebSocket(url);
      let settled = false;
      const settle = (fn) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };
      ws.addEventListener("message", (event) => {
        const raw = typeof event.data === "string" ? event.data : String(event.data);
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch (e) {
          this.emit("error", new Error(`Failed to parse WS message: ${String(e)}`));
          return;
        }
        this._dispatch(msg, ws, isReconnect, settle, resolve, reject);
      });
      ws.addEventListener("close", (event) => {
        const code = event.code;
        const reason = typeof event.reason === "string" ? event.reason : event.reason.toString();
        this._clearKeepaliveTimer();
        if (!settled) {
          settle(() => reject(new Error(`WebSocket closed before welcome: ${code} ${reason}`)));
          return;
        }
        if (ws !== this.ws) return;
        this.emit("disconnected", code, reason);
        if (!this.stopped && code !== 1e3) {
          setTimeout(() => {
            if (!this.stopped) {
              this._openConnection(EVENTSUB_URL, false).catch((err) => {
                this.emit("error", err instanceof Error ? err : new Error(String(err)));
              });
            }
          }, 2e3);
        }
      });
      ws.addEventListener("error", (err) => {
        const error = err instanceof Error ? err : new Error("WebSocket error");
        if (!settled) {
          settle(() => reject(error));
        } else {
          this.emit("error", error);
        }
      });
    });
  }
  _dispatch(msg, ws, isReconnect, settle, resolve, reject) {
    switch (msg.metadata.message_type) {
      case "session_welcome": {
        const payload = msg.payload;
        this.sessionId = payload.session.id;
        this.keepaliveTimeoutMs = payload.session.keepalive_timeout_seconds * 1e3;
        this._resetKeepaliveTimer();
        if (isReconnect) {
          this._closeWs(this.oldWs, 1e3, "reconnected");
          this.oldWs = null;
          this.ws = ws;
          settle(() => resolve());
          break;
        }
        this.ws = ws;
        this._subscribe().then(() => {
          settle(() => resolve());
          this.emit("connected");
        }).catch((err) => {
          settle(() => reject(err instanceof Error ? err : new Error(String(err))));
        });
        break;
      }
      case "session_keepalive": {
        this._resetKeepaliveTimer();
        break;
      }
      case "notification": {
        this._resetKeepaliveTimer();
        const payload = msg.payload;
        if (payload.subscription.type === "channel.chat.message") {
          try {
            const normalized = normalizeMessage(payload.event, this.emoteCache);
            this.emit("message", normalized);
          } catch (e) {
            this.emit("error", e instanceof Error ? e : new Error(String(e)));
          }
        }
        break;
      }
      case "session_reconnect": {
        const payload = msg.payload;
        this.oldWs = this.ws;
        this._openConnection(payload.session.reconnect_url, true).catch((err) => {
          this.emit("error", err instanceof Error ? err : new Error(String(err)));
        });
        break;
      }
      case "revocation": {
        const payload = msg.payload;
        this.emit("revoked", payload.subscription.status);
        break;
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Helix subscription
  // ---------------------------------------------------------------------------
  async _subscribe() {
    if (!this.sessionId) throw new Error("No session ID");
    const res = await fetch(HELIX_SUBSCRIPTIONS, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.options.accessToken}`,
        "Client-Id": this.options.clientId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "channel.chat.message",
        version: "1",
        condition: {
          broadcaster_user_id: this.options.channelId,
          user_id: this.options.userId
        },
        transport: {
          method: "websocket",
          session_id: this.sessionId
        }
      })
    });
    if (res.status === 401) {
      this.emit("auth_error");
      throw new Error("Auth error subscribing to EventSub");
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`EventSub subscription failed: ${res.status} ${body}`);
    }
  }
  // ---------------------------------------------------------------------------
  // Keepalive timer
  // ---------------------------------------------------------------------------
  _resetKeepaliveTimer() {
    this._clearKeepaliveTimer();
    this.keepaliveTimer = setTimeout(() => {
      this._closeWs(this.ws, 1001, "keepalive timeout");
      this.ws = null;
      if (!this.stopped) {
        this._openConnection(EVENTSUB_URL, false).catch((err) => {
          this.emit("error", err instanceof Error ? err : new Error(String(err)));
        });
      }
    }, this.keepaliveTimeoutMs + 500);
  }
  _clearKeepaliveTimer() {
    if (this.keepaliveTimer !== null) {
      clearTimeout(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  _closeWs(ws, code, reason) {
    if (!ws) return;
    try {
      ws.close(code, reason);
    } catch {
    }
  }
};
export {
  TwitchChat
};
//# sourceMappingURL=index.js.map