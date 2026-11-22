'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PresencePlayer = {
  id: string;
  username: string;
  avatar: string;
  role?: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  facing: 1 | -1;
  onGround?: boolean;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  ts?: number;
};

export type ChatMessage = {
  seq?: number;
  id: string;
  userId?: string;
  senderName: string;
  text: string;
  createdAt: string;
};

export type PositionData = {
  id: string;
  username: string;
  avatar: string;
  role?: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  facing: 1 | -1;
  onGround?: boolean;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
};

export type ScoreData = {
  userId: string;
  username: string;
  score: number;
  stars: number;
  isCorrect: boolean;
};

export type ActiveQuestion = {
  id: string;
  content: string;
  points: number;
  timeLimit: number;
  options: { label: string; content: string }[];
};

type RealtimeCallbacks = {
  onDirectMove?: (player: PresencePlayer) => void;
  onDirectLeave?: (userId: string, kicked?: boolean) => void;
};

export function useAblyRoom(
  roomId: string,
  enabled = true,
  callbacks?: RealtimeCallbacks,
) {
  const callbacksRef = useRef<RealtimeCallbacks | undefined>(callbacks);
  callbacksRef.current = callbacks;

  const wsRef = useRef<WebSocket | null>(null);
  const wsJoinedUserIdRef = useRef<string>('');
  const myInfoRef = useRef<PositionData | null>(null);
  const lastPacketTsByUserRef = useRef<Map<string, number>>(new Map());

  const [connected, setConnected] = useState(false);
  const [transportMode, setTransportMode] = useState<'ws' | 'http'>('http');
  const [pingMs, setPingMs] = useState<number>(2);
  const [presencePlayers, setPresencePlayers] = useState<PresencePlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [gameEvents, setGameEvents] = useState<{ type: string; payload: unknown }[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
  const [scoreEvent, setScoreEvent] = useState<ScoreData | null>(null);
  const [kickedPlayerId, setKickedPlayerId] = useState<string | null>(null);
  const [roomStatusEvent, setRoomStatusEvent] = useState<string | null>(null);
  const [rejoinRequestsEvent, setRejoinRequestsEvent] = useState<
    { userId: string; username: string; requestedAt: number }[] | null
  >(null);
  const [approvedPlayerId, setApprovedPlayerId] = useState<string | null>(null);

  const handleIncomingMove = useCallback((p: PresencePlayer) => {
    if (!p.id || p.id === myInfoRef.current?.id) return;
    if (typeof p.ts === 'number') {
      const prevTs = lastPacketTsByUserRef.current.get(p.id) ?? 0;
      if (p.ts < prevTs) return;
      lastPacketTsByUserRef.current.set(p.id, p.ts);
    }
    if (callbacksRef.current?.onDirectMove) {
      callbacksRef.current.onDirectMove(p);
    } else {
      setPresencePlayers((prev) => {
        const next = prev.filter((item) => item.id !== p.id);
        return [...next, p];
      });
    }
  }, []);

  const handleServerPacket = useCallback(
    (msg: Record<string, unknown>) => {
      const t = msg.t;

      if (t === 'po' && typeof msg.c === 'number') {
        const rtt = Math.max(1, Math.round((performance.now() - msg.c) * 10) / 10);
        setPingMs(rtt);
        if (msg.del === 1 || msg.rs === 'deleted') {
          setRoomStatusEvent('deleted');
        } else if (typeof msg.rs === 'string' && msg.rs) {
          setRoomStatusEvent(msg.rs);
        }
        if (Array.isArray(msg.rq)) {
          setRejoinRequestsEvent(msg.rq as { userId: string; username: string; requestedAt: number }[]);
        }
        if (msg.k === 1) {
          const myId = myInfoRef.current?.id || 'me';
          setKickedPlayerId(myId);
          setApprovedPlayerId(null);
          callbacksRef.current?.onDirectLeave?.(myId, true);
        } else if (msg.k === 0) {
          setKickedPlayerId((prev) => {
            if (prev) {
              setApprovedPlayerId(myInfoRef.current?.id || 'me');
            }
            return null;
          });
        }
        return;
      }

      if (t === 'snapshot' || t === 'init') {
        const list = Array.isArray(msg.players) ? (msg.players as Record<string, unknown>[]) : [];
        for (const raw of list) {
          const uid = typeof raw.userId === 'string' ? raw.userId : '';
          if (!uid || uid === myInfoRef.current?.id) continue;
          handleIncomingMove({
            id: uid,
            username: typeof raw.username === 'string' ? raw.username : 'Player',
            avatar: typeof raw.avatar === 'string' ? raw.avatar : 'cat-orange',
            role: typeof raw.role === 'string' ? raw.role : undefined,
            x: typeof raw.x === 'number' ? raw.x : 120,
            y: typeof raw.y === 'number' ? raw.y : 600,
            vx: typeof raw.vx === 'number' ? raw.vx : 0,
            vy: typeof raw.vy === 'number' ? raw.vy : 0,
            facing: raw.facing === -1 ? -1 : 1,
            onGround: Boolean(raw.onGround ?? true),
            isDying: Boolean(raw.isDying),
            deathStartedAt: typeof raw.deathStartedAt === 'number' ? raw.deathStartedAt : undefined,
            burnUntil: typeof raw.burnUntil === 'number' ? raw.burnUntil : undefined,
            ts: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
          });
        }
        return;
      }

      if (t === 'peer-join') {
        const uid = typeof msg.u === 'string' ? msg.u : '';
        if (!uid || uid === myInfoRef.current?.id) return;
        handleIncomingMove({
          id: uid,
          username: typeof msg.un === 'string' ? msg.un : 'Player',
          avatar: typeof msg.av === 'string' ? msg.av : 'cat-orange',
          role: typeof msg.r === 'string' ? msg.r : undefined,
          x: typeof msg.x === 'number' ? msg.x : 120,
          y: typeof msg.y === 'number' ? msg.y : 600,
          vx: 0,
          vy: 0,
          facing: msg.f === -1 ? -1 : 1,
          onGround: true,
          ts: Date.now(),
        });
        return;
      }

      if (t === 'm') {
        const uid = typeof msg.u === 'string' ? msg.u : '';
        if (!uid || uid === myInfoRef.current?.id) return;
        handleIncomingMove({
          id: uid,
          username: typeof msg.un === 'string' ? msg.un : 'Player',
          avatar: typeof msg.av === 'string' ? msg.av : 'cat-orange',
          role: typeof msg.r === 'string' ? msg.r : undefined,
          x: typeof msg.x === 'number' ? msg.x : 120,
          y: typeof msg.y === 'number' ? msg.y : 600,
          vx: typeof msg.vx === 'number' ? msg.vx : 0,
          vy: typeof msg.vy === 'number' ? msg.vy : 0,
          facing: msg.f === -1 ? -1 : 1,
          onGround: Boolean(msg.g),
          isDying: Boolean(msg.d),
          deathStartedAt: typeof msg.ds === 'number' ? msg.ds : undefined,
          burnUntil: typeof msg.b === 'number' ? msg.b : undefined,
          ts: typeof msg.ts === 'number' ? msg.ts : Date.now(),
        });
        return;
      }

      if (t === 'left') {
        const uid = typeof msg.u === 'string' ? msg.u : '';
        if (!uid) return;
        if (msg.kicked && uid === myInfoRef.current?.id) {
          setKickedPlayerId(uid);
        }
        if (callbacksRef.current?.onDirectLeave) {
          callbacksRef.current.onDirectLeave(uid, Boolean(msg.kicked));
        }
        setPresencePlayers((prev) => prev.filter((p) => p.id !== uid));
        return;
      }

      if (t === 'evt') {
        const name = msg.name;
        const data = msg.data as Record<string, unknown>;
        if (name === 'chat' && data) {
          setChatMessages((prev) => [...prev.slice(-29), data as unknown as ChatMessage]);
        } else if (name === 'question' && data) {
          setActiveQuestion((data.question as ActiveQuestion | null) ?? null);
        } else if (name === 'score' && data) {
          setScoreEvent(data as unknown as ScoreData);
        } else if (name === 'kicked' && data) {
          const pid = typeof data.playerId === 'string' ? data.playerId : '';
          const isVoluntaryLeave = Boolean(data.left);
          if (pid) {
            if (!isVoluntaryLeave) {
              setKickedPlayerId(pid);
            }
            callbacksRef.current?.onDirectLeave?.(pid, !isVoluntaryLeave);
            setPresencePlayers((prev) => prev.filter((p) => p.id !== pid));
          }
        } else if (name === 'room-status' && data) {
          if (typeof data.status === 'string') {
            setRoomStatusEvent(data.status);
          }
        } else if (name === 'rejoin-request' && data) {
          if (Array.isArray(data.requests)) {
            setRejoinRequestsEvent(data.requests as { userId: string; username: string; requestedAt: number }[]);
          }
        } else if (name === 'rejoin-approved' && data) {
          const pid = typeof data.playerId === 'string' ? data.playerId : '';
          if (pid) {
            setKickedPlayerId((prev) => (prev === pid || prev === 'me' ? null : prev));
            setApprovedPlayerId(pid);
          }
          if (Array.isArray(data.requests)) {
            setRejoinRequestsEvent(data.requests as { userId: string; username: string; requestedAt: number }[]);
          }
        } else if (name === 'game-event' && data) {
          setGameEvents((prev) => [...prev.slice(-49), data as { type: string; payload: unknown }]);
        }
      }
    },
    [handleIncomingMove],
  );

  useEffect(() => {
    if (!enabled || !roomId || typeof window === 'undefined') return;

    let cancelled = false;
    let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let sseSource: EventSource | null = null;
    let currentWsPort = 3001;
    let attemptIndex = 0;

    function ensureSseFallback() {
      if (cancelled || sseSource || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) return;
      try {
        const uid = myInfoRef.current?.id ?? '';
        const es = new EventSource(`/api/pos?stream=1&r=${encodeURIComponent(roomId)}&u=${encodeURIComponent(uid)}`);
        sseSource = es;
        es.onmessage = (ev) => {
          try {
            const parsed = JSON.parse(ev.data as string);
            handleServerPacket(parsed);
          } catch {
            // ignore
          }
        };
        es.onerror = () => {
          es.close();
          if (sseSource === es) sseSource = null;
        };
      } catch {
        // ignore
      }
    }

    function connectWebSocket(port: number) {
      if (cancelled) return;
      try {
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const hostWithPort = window.location.host; // e.g. 103.x.x.x:3000 or domain
        const hostname = window.location.hostname;

        // Prioritaskan Single-Port WebSocket (/ws-game di port 3000 yang sama dengan web!)
        // supaya akses dari luar jaringan via IP Static / Reverse Proxy langsung tembus WebSocket tanpa perlu port 3001.
        // Jika gagal (misal saat hot-reload tertentu), otomatis bergantian coba port dedicated 3001.
        const useSamePort = attemptIndex % 2 === 0;
        attemptIndex += 1;
        const wsUrl = useSamePort
          ? `${proto}://${hostWithPort}/ws-game`
          : `${proto}://${hostname}:${port}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        wsJoinedUserIdRef.current = '';

        ws.onopen = () => {
          if (cancelled) {
            ws.close();
            return;
          }
          if (sseSource) {
            sseSource.close();
            sseSource = null;
          }
          setConnected(true);
          setTransportMode('ws');
          if (myInfoRef.current && myInfoRef.current.id) {
            const me = myInfoRef.current;
            wsJoinedUserIdRef.current = me.id;
            ws.send(
              JSON.stringify({
                t: 'join',
                roomId,
                userId: me.id,
                username: me.username,
                avatar: me.avatar,
                role: me.role ?? 'student',
                x: Math.round(me.x * 10) / 10,
                y: Math.round(me.y * 10) / 10,
                vx: Math.round((me.vx ?? 0) * 100) / 100,
                vy: Math.round((me.vy ?? 0) * 100) / 100,
                f: me.facing,
                g: me.onGround ?? true,
              }),
            );
          } else {
            // Subscribe socket ke roomId segera walau init() profil belum selesai
            ws.send(JSON.stringify({ t: 'join', roomId }));
          }
          ws.send(
            JSON.stringify({
              t: 'p',
              c: performance.now(),
              r: roomId,
              u: myInfoRef.current?.id,
              rl: myInfoRef.current?.role,
            }),
          );
        };

        ws.onmessage = (ev) => {
          try {
            const parsed = JSON.parse(ev.data as string);
            handleServerPacket(parsed);
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (wsRef.current === ws) {
            wsRef.current = null;
            wsJoinedUserIdRef.current = '';
          }
          setConnected(false);
          setTransportMode('http');
          ensureSseFallback();
          if (!cancelled) {
            wsReconnectTimer = setTimeout(() => connectWebSocket(currentWsPort), 2000);
          }
        };

        ws.onerror = () => {
          // handled by onclose
        };
      } catch {
        // handled by reconnect
      }
    }

    // Panggil /api/pos terlebih dahulu untuk memastikan hookMainHttpServer() pada port 3000 sudah aktif
    fetch('/api/pos')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d && typeof d.wsPort === 'number' && d.wsPort > 0) {
          currentWsPort = d.wsPort;
        }
        if (!wsRef.current) {
          connectWebSocket(currentWsPort);
        }
      })
      .catch(() => {
        if (!cancelled && !wsRef.current) {
          connectWebSocket(currentWsPort);
        }
      });

    pingTimer = setInterval(() => {
      if (cancelled) return;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const me = myInfoRef.current;
        if (me?.id && wsJoinedUserIdRef.current !== me.id) {
          wsJoinedUserIdRef.current = me.id;
          ws.send(
            JSON.stringify({
              t: 'join',
              roomId,
              userId: me.id,
              username: me.username,
              avatar: me.avatar,
              role: me.role ?? 'student',
              x: Math.round(me.x * 10) / 10,
              y: Math.round(me.y * 10) / 10,
              vx: Math.round((me.vx ?? 0) * 100) / 100,
              vy: Math.round((me.vy ?? 0) * 100) / 100,
              f: me.facing,
              g: me.onGround ?? true,
            }),
          );
        }
        ws.send(
          JSON.stringify({
            t: 'p',
            c: performance.now(),
            r: roomId,
            u: me?.id,
            rl: me?.role,
          }),
        );
      }
    }, 1000);

    return () => {
      cancelled = true;
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (sseSource) {
        sseSource.close();
        sseSource = null;
      }

      const ws = wsRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ t: 'leave' }));
          } catch {
            // ignore
          }
        }
        ws.close();
        wsRef.current = null;
        wsJoinedUserIdRef.current = '';
      }
    };
  }, [enabled, roomId, handleServerPacket]);

  // PENTING: publishPosition HANYA mengirim paket kompak (~70 byte) lewat WebSocket
  const publishPosition = useCallback(
    (pos: PositionData) => {
      myInfoRef.current = pos;

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      if (wsJoinedUserIdRef.current !== pos.id) {
        wsJoinedUserIdRef.current = pos.id;
        try {
          ws.send(
            JSON.stringify({
              t: 'join',
              roomId,
              userId: pos.id,
              username: pos.username,
              avatar: pos.avatar,
              role: pos.role ?? 'student',
              x: Math.round(pos.x * 10) / 10,
              y: Math.round(pos.y * 10) / 10,
              vx: Math.round((pos.vx ?? 0) * 100) / 100,
              vy: Math.round((pos.vy ?? 0) * 100) / 100,
              f: pos.facing,
              g: pos.onGround ?? true,
            }),
          );
        } catch {
          return;
        }
      }

      try {
        // Slim packet: server sudah menyimpan userId, username, avatar, role saat 'join'
        ws.send(
          JSON.stringify({
            t: 'm',
            x: Math.round(pos.x * 10) / 10,
            y: Math.round(pos.y * 10) / 10,
            vx: Math.round((pos.vx ?? 0) * 100) / 100,
            vy: Math.round((pos.vy ?? 0) * 100) / 100,
            f: pos.facing,
            g: pos.onGround ? 1 : 0,
            d: pos.isDying ? 1 : 0,
            ds: pos.deathStartedAt,
            b: pos.burnUntil,
            ts: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
    },
    [roomId],
  );

  const publishChat = useCallback((msg: ChatMessage) => {
    void msg;
  }, []);

  const publishGameEvent = useCallback((type: string, payload: unknown) => {
    void type;
    void payload;
  }, []);

  return {
    connected,
    transportMode,
    pingMs,
    setPingMs,
    presencePlayers,
    chatMessages,
    gameEvents,
    activeQuestion,
    scoreEvent,
    kickedPlayerId,
    approvedPlayerId,
    roomStatusEvent,
    rejoinRequestsEvent,
    publishPosition,
    publishChat,
    publishGameEvent,
  };
}
