export type LivePlayerState = {
  userId: string;
  username: string;
  avatar: string;
  role: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  updatedAt: number;
};

export type CachedRoomDbState = {
  CachedAt: number;
  room: { id: string; status: string; name: string; levelId: string; activeQuestionId: string | null } | null;
  players: {
    userId: string;
    username: string;
    avatar: string;
    role: string;
    lastX: number | null;
    lastY: number | null;
    lastFacing: number | null;
  }[];
  scores: { userId: string; score: number; stars: number }[];
};

const globalForPresence = globalThis as unknown as {
  __llysRoomPresence?: Map<string, Map<string, number>>;
  __llysRecentlyLeft?: Map<string, number>;
  __llysLivePositions?: Map<string, Map<string, LivePlayerState>>;
  __llysRoomDbCache?: Map<string, CachedRoomDbState>;
  __llysLastDbPosWrite?: Map<string, number>;
  __llysKickedPlayers?: Map<string, number>;
  __llysDeletedRooms?: Map<string, number>;
  __llysLiveRoomStatus?: Map<string, string>;
};

function getKickedPlayersStore(): Map<string, number> {
  if (!globalForPresence.__llysKickedPlayers) {
    globalForPresence.__llysKickedPlayers = new Map();
  }
  return globalForPresence.__llysKickedPlayers;
}

function getDeletedRoomsStore(): Map<string, number> {
  if (!globalForPresence.__llysDeletedRooms) {
    globalForPresence.__llysDeletedRooms = new Map();
  }
  return globalForPresence.__llysDeletedRooms;
}

function getLiveRoomStatusStore(): Map<string, string> {
  if (!globalForPresence.__llysLiveRoomStatus) {
    globalForPresence.__llysLiveRoomStatus = new Map();
  }
  return globalForPresence.__llysLiveRoomStatus;
}

export function markPlayerKicked(roomId: string, userId: string): void {
  getKickedPlayersStore().set(`${roomId}:${userId}`, Date.now());
  removePresence(roomId, userId);
}

export function clearPlayerKicked(roomId: string, userId: string): void {
  getKickedPlayersStore().delete(`${roomId}:${userId}`);
  getRecentlyLeftStore().delete(`${roomId}:${userId}`);
}

export function isPlayerKicked(roomId: string, userId: string): boolean {
  const kickedAt = getKickedPlayersStore().get(`${roomId}:${userId}`);
  if (!kickedAt) return false;
  if (Date.now() - kickedAt > 15 * 60 * 1000) {
    getKickedPlayersStore().delete(`${roomId}:${userId}`);
    return false;
  }
  return true;
}

export function markRoomDeleted(roomId: string): void {
  getDeletedRoomsStore().set(roomId, Date.now());
  getLiveRoomStatusStore().set(roomId, 'deleted');
  getPresenceStore().delete(roomId);
  getLivePositionsStore().delete(roomId);
  invalidateRoomSyncCache(roomId);
}

export function isRoomDeleted(roomId: string): boolean {
  return getDeletedRoomsStore().has(roomId);
}

export function setLiveRoomStatus(roomId: string, status: string): void {
  getLiveRoomStatusStore().set(roomId, status);
}

export function getLiveRoomStatus(roomId: string): string | undefined {
  if (isRoomDeleted(roomId)) return 'deleted';
  return getLiveRoomStatusStore().get(roomId);
}

function getPresenceStore(): Map<string, Map<string, number>> {
  if (!globalForPresence.__llysRoomPresence) {
    globalForPresence.__llysRoomPresence = new Map();
  }
  return globalForPresence.__llysRoomPresence;
}

function getRecentlyLeftStore(): Map<string, number> {
  if (!globalForPresence.__llysRecentlyLeft) {
    globalForPresence.__llysRecentlyLeft = new Map();
  }
  return globalForPresence.__llysRecentlyLeft;
}

function getLivePositionsStore(): Map<string, Map<string, LivePlayerState>> {
  if (!globalForPresence.__llysLivePositions) {
    globalForPresence.__llysLivePositions = new Map();
  }
  return globalForPresence.__llysLivePositions;
}

function getRoomDbCacheStore(): Map<string, CachedRoomDbState> {
  if (!globalForPresence.__llysRoomDbCache) {
    globalForPresence.__llysRoomDbCache = new Map();
  }
  return globalForPresence.__llysRoomDbCache;
}

function getLastDbPosWriteStore(): Map<string, number> {
  if (!globalForPresence.__llysLastDbPosWrite) {
    globalForPresence.__llysLastDbPosWrite = new Map();
  }
  return globalForPresence.__llysLastDbPosWrite;
}

export function getCachedRoomDbState(roomId: string, ttlMs = 800): CachedRoomDbState | null {
  const entry = getRoomDbCacheStore().get(roomId);
  if (!entry) return null;
  if (Date.now() - entry.CachedAt > ttlMs) return null;
  return entry;
}

export function setCachedRoomDbState(roomId: string, state: Omit<CachedRoomDbState, 'CachedAt'>): void {
  getRoomDbCacheStore().set(roomId, {
    ...state,
    CachedAt: Date.now(),
  });
}

export function invalidateRoomSyncCache(roomId?: string): void {
  const store = getRoomDbCacheStore();
  if (!roomId) {
    store.clear();
  } else {
    store.delete(roomId);
  }
}

export function shouldWritePosToDb(roomId: string, userId: string, intervalMs = 3000): boolean {
  const key = `${roomId}:${userId}`;
  const store = getLastDbPosWriteStore();
  const now = Date.now();
  const last = store.get(key) ?? 0;
  if (now - last < intervalMs) return false;
  store.set(key, now);
  return true;
}

export function touchPresence(roomId: string, userId: string, explicitJoin = false): boolean {
  if (isRoomDeleted(roomId)) {
    return false;
  }
  const key = `${roomId}:${userId}`;
  const leftStore = getRecentlyLeftStore();
  if (explicitJoin) {
    leftStore.delete(key);
    invalidateRoomSyncCache(roomId);
  } else {
    if (isPlayerKicked(roomId, userId)) {
      return false;
    }
    const leftAt = leftStore.get(key);
    if (leftAt && Date.now() - leftAt < 3000) {
      return false;
    }
  }

  const store = getPresenceStore();
  let roomMap = store.get(roomId);
  if (!roomMap) {
    roomMap = new Map();
    store.set(roomId, roomMap);
  }
  roomMap.set(userId, Date.now());
  return true;
}

export function updateLivePlayerPosition(
  roomId: string,
  state: Omit<LivePlayerState, 'updatedAt'>,
): LivePlayerState | null {
  if (!touchPresence(roomId, state.userId)) {
    return null;
  }
  const store = getLivePositionsStore();
  let roomPos = store.get(roomId);
  if (!roomPos) {
    roomPos = new Map();
    store.set(roomId, roomPos);
  }
  const entry: LivePlayerState = {
    ...state,
    updatedAt: Date.now(),
  };
  roomPos.set(state.userId, entry);
  return entry;
}

export function getLiveRoomPositions(roomId: string): Map<string, LivePlayerState> {
  return getLivePositionsStore().get(roomId) ?? new Map();
}

export function removePresence(roomId: string, userId: string): void {
  const store = getPresenceStore();
  store.get(roomId)?.delete(userId);
  getLivePositionsStore().get(roomId)?.delete(userId);
  getRecentlyLeftStore().set(`${roomId}:${userId}`, Date.now());
  invalidateRoomSyncCache(roomId);
}

export function removeUserFromAllRoomsPresence(userId: string): void {
  const store = getPresenceStore();
  const posStore = getLivePositionsStore();
  const leftStore = getRecentlyLeftStore();
  const now = Date.now();
  for (const [roomId, roomMap] of store.entries()) {
    if (roomMap.has(userId)) {
      roomMap.delete(userId);
      posStore.get(roomId)?.delete(userId);
      leftStore.set(`${roomId}:${userId}`, now);
      invalidateRoomSyncCache(roomId);
    }
  }
}

export function getStaleUserIds(
  roomId: string,
  currentUserIds: string[],
  timeoutMs = 5500,
): string[] {
  const store = getPresenceStore();
  const posStore = getLivePositionsStore();
  let roomMap = store.get(roomId);
  if (!roomMap) {
    roomMap = new Map();
    store.set(roomId, roomMap);
  }
  const now = Date.now();
  const stale: string[] = [];

  for (const uid of currentUserIds) {
    const lastSeen = roomMap.get(uid);
    if (lastSeen === undefined) {
      roomMap.set(uid, now);
    } else if (now - lastSeen > timeoutMs) {
      stale.push(uid);
      roomMap.delete(uid);
      posStore.get(roomId)?.delete(uid);
    }
  }
  if (stale.length > 0) {
    invalidateRoomSyncCache(roomId);
  }
  return stale;
}
