import EventEmitter from 'eventemitter3';

interface TwitchChatOptions {
    channelId: string;
    userId: string;
    clientId: string;
    accessToken: string;
    onTokenRefresh?: (newToken: string) => void;
}
interface Badge {
    setId: string;
    id: string;
    info: string;
}
interface ChatUser {
    id: string;
    login: string;
    displayName: string;
    color: string;
    badges: Badge[];
    isModerator: boolean;
    isSubscriber: boolean;
    isBroadcaster: boolean;
    isVip: boolean;
}
interface ResolvedEmote {
    id: string;
    name: string;
    source: 'twitch' | 'bttv' | '7tv';
    animated: boolean;
    imageUrl1x: string;
    imageUrl2x?: string;
    imageUrl3x?: string;
}
type MessageFragment = {
    type: 'text';
    text: string;
} | {
    type: 'emote';
    text: string;
    emote: ResolvedEmote;
} | {
    type: 'cheermote';
    text: string;
    bits: number;
    tier: number;
} | {
    type: 'mention';
    text: string;
    userId: string;
    userLogin: string;
};
interface NormalizedMessage {
    id: string;
    text: string;
    user: ChatUser;
    fragments: MessageFragment[];
    emotes: ResolvedEmote[];
    timestamp: string;
    cheer?: {
        bits: number;
    };
    reply?: {
        parentMessageId: string;
        parentUserLogin: string;
        parentUserDisplayName: string;
    };
    channelPointsRewardId?: string;
}

interface TwitchChatEvents {
    connected: [];
    disconnected: [code: number, reason: string];
    message: [msg: NormalizedMessage];
    revoked: [reason: string];
    auth_error: [];
    error: [err: Error];
}
declare class TwitchChat extends EventEmitter<TwitchChatEvents> {
    private options;
    private emoteCache;
    private ws;
    private sessionId;
    private keepaliveTimeoutMs;
    private keepaliveTimer;
    private oldWs;
    private stopped;
    constructor(options: TwitchChatOptions);
    connect(): Promise<void>;
    disconnect(): void;
    preloadEmotes(): Promise<void>;
    refreshEmotes(): Promise<void>;
    private _openConnection;
    private _dispatch;
    private _subscribe;
    private _resetKeepaliveTimer;
    private _clearKeepaliveTimer;
    private _closeWs;
}

export { type Badge, type ChatUser, type MessageFragment, type NormalizedMessage, type ResolvedEmote, TwitchChat, type TwitchChatOptions };
