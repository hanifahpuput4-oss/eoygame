const globalForPresence = globalThis as unknown as {
  __llysRoomPresence?: Map<string, Map<string, number>>;
  __llysRecentlyLeft?: Map<string, number>;
};

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

export function touchPresence(roomId: string, userId: string, explicitJoin = false): boolean {
  const key = `${roomId}:${userId}`;
  const leftStore = getRecentlyLeftStore();
  if (explicitJoin) {
    leftStore.delete(key);
  } else {
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

export function removePresence(roomId: string, userId: string): void {
  const store = getPresenceStore();
  store.get(roomId)?.delete(userId);
  getRecentlyLeftStore().set(`${roomId}:${userId}`, Date.now());
}

export function removeUserFromAllRoomsPresence(userId: string): void {
  const store = getPresenceStore();
  const leftStore = getRecentlyLeftStore();
  const now = Date.now();
  for (const [roomId, roomMap] of store.entries()) {
    if (roomMap.has(userId)) {
      roomMap.delete(userId);
      leftStore.set(`${roomId}:${userId}`, now);
    }
  }
}

export function getStaleUserIds(
  roomId: string,
  currentUserIds: string[],
  timeoutMs = 5500,
): string[] {
  const store = getPresenceStore();
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
    }
  }
  return stale;
}
