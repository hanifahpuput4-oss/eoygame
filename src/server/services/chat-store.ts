export type EphemeralChatMessage = {
  seq: number;
  id: string;
  roomId: string;
  userId: string;
  senderName: string;
  text: string;
  createdAt: string;
};

type ChatStoreState = {
  seq: number;
  rooms: Map<string, EphemeralChatMessage[]>;
};

const globalForChat = globalThis as unknown as {
  __llysChatStore?: ChatStoreState;
};

function getStore(): ChatStoreState {
  if (!globalForChat.__llysChatStore) {
    globalForChat.__llysChatStore = {
      seq: 0,
      rooms: new Map(),
    };
  }
  return globalForChat.__llysChatStore;
}

const MAX_ROOM_MESSAGES = 50;

export function addEphemeralChat(
  roomId: string,
  msg: Omit<EphemeralChatMessage, 'seq'>,
): EphemeralChatMessage {
  const store = getStore();
  store.seq += 1;
  const entry: EphemeralChatMessage = {
    ...msg,
    seq: store.seq,
  };
  const list = store.rooms.get(roomId) ?? [];
  list.push(entry);
  if (list.length > MAX_ROOM_MESSAGES) {
    list.splice(0, list.length - MAX_ROOM_MESSAGES);
  }
  store.rooms.set(roomId, list);
  return entry;
}

export function getEphemeralChatSince(
  roomId: string,
  cursor?: number,
): { messages: EphemeralChatMessage[]; chatCursor: number } {
  const store = getStore();
  if (cursor === undefined || cursor < 0) {
    return { messages: [], chatCursor: store.seq };
  }
  const list = store.rooms.get(roomId) ?? [];
  const messages = list.filter((m) => m.seq > cursor);
  return { messages, chatCursor: store.seq };
}
