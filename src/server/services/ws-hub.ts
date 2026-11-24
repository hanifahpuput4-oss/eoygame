import http from 'node:http';
import crypto from 'node:crypto';
import type { Duplex } from 'node:stream';
import type { Socket } from 'node:net';
import {
  getLiveRoomPositions,
  removePresence,
  touchPresence,
  updateLivePlayerPosition,
} from './presence-store';

type WsClient = {
  id: string;
  socket: Socket;
  roomId: string;
  userId: string;
  username: string;
  avatar: string;
  role: string;
};

type WsHubState = {
  server: http.Server | null;
  port: number;
  starting: boolean;
  samePortHooked: boolean;
  rooms: Map<string, Map<string, WsClient>>;
};

const globalForWsHub = globalThis as unknown as {
  __llysWsHub?: { server?: { close: () => void } | null };
  __llysWsHubV2?: { server?: { close: () => void } | null };
  __llysWsHubV3?: { server?: { close: () => void } | null; rooms?: Map<string, Map<string, WsClient>> };
  __llysWsHubV4?: WsHubState;
};

function getHub(): WsHubState {
  if (globalForWsHub.__llysWsHub?.server) {
    try {
      globalForWsHub.__llysWsHub.server.close();
    } catch {
      // ignore
    }
    globalForWsHub.__llysWsHub = undefined;
  }
  if (globalForWsHub.__llysWsHubV2?.server) {
    try {
      globalForWsHub.__llysWsHubV2.server.close();
    } catch {
      // ignore
    }
    globalForWsHub.__llysWsHubV2 = undefined;
  }
  if (!globalForWsHub.__llysWsHubV4) {
    const inheritedRooms = globalForWsHub.__llysWsHubV3?.rooms ?? new Map<string, Map<string, WsClient>>();
    const existingServer = (globalForWsHub.__llysWsHubV3?.server as http.Server | null) ?? null;
    globalForWsHub.__llysWsHubV4 = {
      server: existingServer,
      port: existingServer ? 3001 : 0,
      starting: false,
      samePortHooked: false,
      rooms: inheritedRooms,
    };
  }
  return globalForWsHub.__llysWsHubV4;
}

function encodeWsTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[0] = 0x81; // FIN + text frame
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function encodeWsPongFrame(payload: Buffer): Buffer {
  const len = Math.min(payload.length, 125);
  const frame = Buffer.allocUnsafe(2 + len);
  frame[0] = 0x8a; // FIN + pong
  frame[1] = len;
  payload.copy(frame, 2, 0, len);
  return frame;
}

function addClientToRoom(client: WsClient) {
  const hub = getHub();
  let roomClients = hub.rooms.get(client.roomId);
  if (!roomClients) {
    roomClients = new Map();
    hub.rooms.set(client.roomId, roomClients);
  }
  roomClients.set(client.id, client);
}

function removeClientFromRoom(client: WsClient) {
  const hub = getHub();
  const roomClients = hub.rooms.get(client.roomId);
  if (!roomClients) return;
  roomClients.delete(client.id);
  if (roomClients.size === 0) {
    hub.rooms.delete(client.roomId);
  }
}

export function broadcastRoomEvent(
  roomId: string,
  payload: Record<string, unknown>,
  excludeUserId?: string,
  excludeClientId?: string,
) {
  const hub = getHub();
  const roomClients = hub.rooms.get(roomId);
  if (!roomClients || roomClients.size === 0) return;

  const json = JSON.stringify(payload);
  let wsFrame: Buffer | null = null;

  for (const client of roomClients.values()) {
    if (excludeClientId && client.id === excludeClientId) continue;
    if (excludeUserId && client.userId === excludeUserId) continue;

    if (!client.socket.destroyed && client.socket.writable) {
      if (!wsFrame) wsFrame = encodeWsTextFrame(json);
      try {
        client.socket.write(wsFrame);
      } catch {
        // ignore write error on closing socket
      }
    }
  }
}

function handleIncomingMessage(client: WsClient, rawText: string) {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(rawText);
  } catch {
    return;
  }

  const t = msg.t;

  // Sub-millisecond Ping / Pong
  if (t === 'p') {
    const reply = encodeWsTextFrame(JSON.stringify({ t: 'po', c: msg.c }));
    if (!client.socket.destroyed && client.socket.writable) {
      client.socket.write(reply);
    }
    if (client.roomId && client.userId) {
      touchPresence(client.roomId, client.userId);
    }
    return;
  }

  // Join / Authenticate Room
  if (t === 'join') {
    const roomId = typeof msg.roomId === 'string' ? msg.roomId : '';
    const userId = typeof msg.userId === 'string' ? msg.userId : '';
    if (!roomId || !userId) return;

    if (client.roomId) {
      removeClientFromRoom(client);
    }
    client.roomId = roomId;
    client.userId = userId;
    client.username = typeof msg.username === 'string' ? msg.username : 'Player';
    client.avatar = typeof msg.avatar === 'string' ? msg.avatar : 'cat-orange';
    client.role = typeof msg.role === 'string' ? msg.role : 'student';

    addClientToRoom(client);
    touchPresence(roomId, userId, true);

    if (typeof msg.x === 'number' && typeof msg.y === 'number') {
      updateLivePlayerPosition(roomId, {
        userId,
        username: client.username,
        avatar: client.avatar,
        role: client.role,
        x: msg.x,
        y: msg.y,
        vx: typeof msg.vx === 'number' ? msg.vx : 0,
        vy: typeof msg.vy === 'number' ? msg.vy : 0,
        facing: msg.f === -1 ? -1 : 1,
        onGround: Boolean(msg.g ?? true),
      });
    }

    const snapshot = Array.from(getLiveRoomPositions(roomId).values());
    const initFrame = encodeWsTextFrame(
      JSON.stringify({
        t: 'snapshot',
        players: snapshot,
      }),
    );
    if (!client.socket.destroyed && client.socket.writable) {
      client.socket.write(initFrame);
    }

    broadcastRoomEvent(
      roomId,
      {
        t: 'peer-join',
        u: client.userId,
        un: client.username,
        av: client.avatar,
        r: client.role,
        x: typeof msg.x === 'number' ? msg.x : 120,
        y: typeof msg.y === 'number' ? msg.y : 600,
        f: msg.f === -1 ? -1 : 1,
      },
      undefined,
      client.id,
    );
    return;
  }

  if (!client.roomId || !client.userId) return;

  // High-frequency kinematics / movement packet (slimmed payload supported)
  if (t === 'm') {
    const x = typeof msg.x === 'number' ? msg.x : 0;
    const y = typeof msg.y === 'number' ? msg.y : 0;
    const vx = typeof msg.vx === 'number' ? msg.vx : 0;
    const vy = typeof msg.vy === 'number' ? msg.vy : 0;
    const facing: 1 | -1 = msg.f === -1 ? -1 : 1;
    const onGround = Boolean(msg.g);
    const isDying = Boolean(msg.d);
    const deathStartedAt = typeof msg.ds === 'number' ? msg.ds : undefined;
    const burnUntil = typeof msg.b === 'number' ? msg.b : undefined;

    const updated = updateLivePlayerPosition(client.roomId, {
      userId: client.userId,
      username: client.username,
      avatar: client.avatar,
      role: client.role,
      x,
      y,
      vx,
      vy,
      facing,
      onGround,
      isDying,
      deathStartedAt,
      burnUntil,
    });
    if (!updated) return;

    broadcastRoomEvent(
      client.roomId,
      {
        t: 'm',
        u: client.userId,
        un: client.username,
        av: client.avatar,
        r: client.role,
        x,
        y,
        vx,
        vy,
        f: facing,
        g: onGround ? 1 : 0,
        d: isDying ? 1 : 0,
        ds: deathStartedAt,
        b: burnUntil,
        ts: typeof msg.ts === 'number' ? msg.ts : Date.now(),
      },
      client.userId,
      client.id,
    );
    return;
  }

  if (t === 'leave') {
    removePresence(client.roomId, client.userId);
    broadcastRoomEvent(
      client.roomId,
      {
        t: 'left',
        u: client.userId,
      },
      undefined,
      client.id,
    );
    removeClientFromRoom(client);
  }
}

function attachWsConnection(socket: Socket) {
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 15000);

  const client: WsClient = {
    id: `ws_${crypto.randomBytes(6).toString('hex')}`,
    socket,
    roomId: '',
    userId: '',
    username: '',
    avatar: '',
    role: 'student',
  };

  let buffer: Buffer = Buffer.alloc(0);

  socket.on('data', (chunk: Buffer) => {
    buffer = buffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([buffer, chunk]);

    while (buffer.length >= 2) {
      const byte0 = buffer[0];
      const byte1 = buffer[1];
      const opcode = byte0 & 0x0f;
      const isMasked = (byte1 & 0x80) !== 0;
      let payloadLen = byte1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        const bigLen = buffer.readBigUInt64BE(2);
        if (bigLen > BigInt(1024 * 64)) {
          socket.destroy();
          return;
        }
        payloadLen = Number(bigLen);
        offset = 10;
      }

      const maskOffset = offset;
      if (isMasked) offset += 4;

      if (buffer.length < offset + payloadLen) return;

      const payload = Buffer.allocUnsafe(payloadLen);
      if (isMasked) {
        const m0 = buffer[maskOffset];
        const m1 = buffer[maskOffset + 1];
        const m2 = buffer[maskOffset + 2];
        const m3 = buffer[maskOffset + 3];
        const masks = [m0, m1, m2, m3];
        for (let i = 0; i < payloadLen; i += 1) {
          payload[i] = buffer[offset + i] ^ masks[i & 3];
        }
      } else {
        buffer.copy(payload, 0, offset, offset + payloadLen);
      }

      buffer = buffer.subarray(offset + payloadLen);

      if (opcode === 0x8) {
        removeClientFromRoom(client);
        socket.end();
        return;
      } else if (opcode === 0x9) {
        if (!socket.destroyed && socket.writable) {
          socket.write(encodeWsPongFrame(payload));
        }
      } else if (opcode === 0x1) {
        handleIncomingMessage(client, payload.toString('utf8'));
      }
    }
  });

  const cleanup = () => {
    if (client.roomId) {
      removeClientFromRoom(client);
    }
  };

  socket.on('close', cleanup);
  socket.on('error', cleanup);
  socket.on('end', cleanup);
}

export function handleWsUpgrade(req: http.IncomingMessage, socket: Duplex) {
  const key = req.headers['sec-websocket-key'];
  if (!key || typeof key !== 'string') {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const headers =
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`;

  socket.write(headers);
  attachWsConnection(socket as Socket);
}

/**
 * Hooks directly into Next.js's main HTTP server (port 3000) so players outside LAN
 * accessing via the school's Static IP / Port-Forward / Reverse Proxy on port 3000
 * can establish a Native WebSocket at `ws://<IP_STATIC>:3000/ws-game` WITHOUT needing port 3001 opened!
 */
function hookMainHttpServer(hub: WsHubState) {
  if (hub.samePortHooked) return;
  try {
    const proc = process as unknown as {
      _getActiveHandles?: () => Array<
        http.Server & {
          __llysSamePortWsHooked?: boolean;
        }
      >;
    };
    const handles = proc._getActiveHandles?.() ?? [];
    for (const h of handles) {
      if (!h || typeof h.address !== 'function' || typeof h.emit !== 'function') continue;
      if (h === hub.server) continue;
      const addr = h.address();
      if (!addr || typeof addr !== 'object' || typeof addr.port !== 'number') continue;
      if (addr.port === hub.port && hub.port !== 0) continue;

      if (!h.__llysSamePortWsHooked) {
        h.__llysSamePortWsHooked = true;
        // Enable TCP_NODELAY on every socket hitting main port 3000 too
        h.on('connection', (sock: Socket) => {
          try {
            sock.setNoDelay(true);
          } catch {
            // ignore
          }
        });

        const origEmit = h.emit.bind(h);
        h.emit = ((event: string, ...args: unknown[]) => {
          if (event === 'upgrade') {
            const req = args[0] as http.IncomingMessage | undefined;
            const socket = args[1] as Duplex | undefined;
            if (req && socket && typeof req.url === 'string' && req.url.startsWith('/ws-game')) {
              handleWsUpgrade(req, socket);
              return true;
            }
          }
          return origEmit(event, ...args);
        }) as typeof h.emit;
      }
      hub.samePortHooked = true;
    }
  } catch {
    // non-fatal if _getActiveHandles is unavailable
  }
}

export function ensureWsServer(): number {
  const hub = getHub();
  hookMainHttpServer(hub);

  if (hub.server && hub.port > 0) {
    return hub.port;
  }
  if (hub.starting) {
    return hub.port || Number(process.env.WS_PORT || 3001);
  }

  hub.starting = true;
  const preferredPort = Number(process.env.WS_PORT || 3001);

  const server = http.createServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ status: 'ok', transport: 'llysSmart-ws-v4' }));
  });

  server.on('upgrade', (req: http.IncomingMessage, socket: Duplex) => {
    handleWsUpgrade(req, socket);
  });

  function tryListen(portToTry: number, attempt: number) {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && attempt < 5) {
        tryListen(portToTry + 1, attempt + 1);
      } else {
        hub.starting = false;
      }
    });

    server.listen(portToTry, '0.0.0.0', () => {
      hub.server = server;
      hub.port = portToTry;
      hub.starting = false;
      hookMainHttpServer(hub);
    });
  }

  tryListen(preferredPort, 0);
  return hub.port || preferredPort;
}

ensureWsServer();
