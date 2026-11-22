import { NextRequest, NextResponse } from 'next/server';
import {
  getLiveRoomPositions,
  getLiveRoomStatus,
  isPlayerKicked,
  isRoomDeleted,
  touchPresence,
  updateLivePlayerPosition,
} from '@/server/services/presence-store';
import { broadcastRoomEvent, ensureWsServer, registerSseClient } from '@/server/services/ws-hub';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const wsPort = ensureWsServer();
  const stream = req.nextUrl.searchParams.get('stream') === '1';
  if (!stream) {
    return NextResponse.json({ wsPort });
  }

  const roomId = req.nextUrl.searchParams.get('r') ?? '';
  const userId = req.nextUrl.searchParams.get('u') ?? '';
  if (!roomId) {
    return NextResponse.json({ error: 'missing room' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let cleanupSse: (() => void) | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  const readable = new ReadableStream({
    start(controller) {
      const sendRaw = (jsonText: string): boolean => {
        try {
          controller.enqueue(encoder.encode(`data: ${jsonText}\n\n`));
          return true;
        } catch {
          return false;
        }
      };

      // Kirim snapshot awal begitu SSE tersambung (tembus Cloudflare / Nginx / Tunnel HTTPS)
      const snapshot = Array.from(getLiveRoomPositions(roomId).values());
      sendRaw(JSON.stringify({ t: 'snapshot', players: snapshot }));

      cleanupSse = registerSseClient(roomId, userId, sendRaw);

      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          if (keepAliveTimer) clearInterval(keepAliveTimer);
          cleanupSse?.();
        }
      }, 15000);
    },
    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      cleanupSse?.();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const wsPort = ensureWsServer();
    const body = await req.json();
    const roomId = typeof body?.r === 'string' ? body.r : '';
    const userId = typeof body?.u === 'string' ? body.u : '';
    if (!roomId || !userId) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }

    if (isRoomDeleted(roomId)) {
      return NextResponse.json({ wsPort, roomDeleted: true, rs: 'deleted', p: [] });
    }
    if (isPlayerKicked(roomId, userId)) {
      return NextResponse.json({ wsPort, kicked: true, p: [] });
    }

    if (typeof body.x === 'number' && typeof body.y === 'number') {
      const username = typeof body.un === 'string' ? body.un : 'Player';
      const avatar = typeof body.av === 'string' ? body.av : 'cat-orange';
      const role = typeof body.rl === 'string' ? body.rl : 'student';
      const vx = typeof body.vx === 'number' ? body.vx : 0;
      const vy = typeof body.vy === 'number' ? body.vy : 0;
      const facing: 1 | -1 = body.f === -1 ? -1 : 1;
      const onGround = Boolean(body.g ?? true);
      const isDying = Boolean(body.d);
      const deathStartedAt = typeof body.ds === 'number' ? body.ds : undefined;
      const burnUntil = typeof body.b === 'number' ? body.b : undefined;

      const updated = updateLivePlayerPosition(roomId, {
        userId,
        username,
        avatar,
        role,
        x: body.x,
        y: body.y,
        vx,
        vy,
        facing,
        onGround,
        isDying,
        deathStartedAt,
        burnUntil,
      });

      // Push immediately (< 0.2ms) to all LAN WebSocket AND Cloudflare/Domain SSE clients!
      if (updated) {
        broadcastRoomEvent(
          roomId,
          {
            t: 'm',
            u: userId,
            un: username,
            av: avatar,
            r: role,
            x: body.x,
            y: body.y,
            vx,
            vy,
            f: facing,
            g: onGround ? 1 : 0,
            d: isDying ? 1 : 0,
            ds: deathStartedAt,
            b: burnUntil,
            ts: Date.now(),
          },
          userId,
        );
      }
    } else {
      touchPresence(roomId, userId);
    }

    const liveMap = getLiveRoomPositions(roomId);
    const peers: Record<string, unknown>[] = [];
    const now = Date.now();
    for (const p of liveMap.values()) {
      if (p.userId === userId) continue;
      if (now - p.updatedAt > 6000) continue;
      peers.push({
        u: p.userId,
        un: p.username,
        av: p.avatar,
        rl: p.role,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        f: p.facing,
        g: p.onGround ? 1 : 0,
        d: p.isDying ? 1 : 0,
        ds: p.deathStartedAt,
        b: p.burnUntil,
      });
    }

    return NextResponse.json({ wsPort, rs: getLiveRoomStatus(roomId), p: peers });
  } catch {
    return NextResponse.json({ p: [] }, { status: 200 });
  }
}
