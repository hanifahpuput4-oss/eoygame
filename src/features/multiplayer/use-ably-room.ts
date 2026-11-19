'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PresencePlayer = {
  id: string;
  username: string;
  avatar: string;
  role?: string;
  x: number;
  y: number;
  facing: 1 | -1;
};

export type ChatMessage = {
  id: string;
  senderName: string;
  text: string;
  createdAt: string;
};

type PositionData = { id: string; username: string; avatar: string; role?: string; x: number; y: number; facing: 1 | -1 };
export type ScoreData = { userId: string; username: string; score: number; stars: number; isCorrect: boolean };
export type ActiveQuestion = { id: string; content: string; points: number; timeLimit: number; options: { label: string; content: string }[] };

type AblyMessage = { name: string; data: unknown };
type AblyChannel = {
  subscribe(name: string, handler: (msg: AblyMessage) => void): void;
  unsubscribe(): void;
  publish(name: string, data: unknown): void;
  presence: {
    enter(): Promise<void>;
    leave(): Promise<void>;
    get(): Promise<{ clientId: string }[]>;
    subscribe(name: string, handler: () => void): void;
  };
};
type AblyClient = {
  connection: { on(name: string, handler: () => void): void };
  channels: { get(name: string): AblyChannel };
  close(): void;
};

declare global {
  interface Window {
    Ably?: { Realtime: new (options: { key: string }) => AblyClient };
  }
}

const CDN_URL = 'https://cdn.ably.com/lib/ably.min-2.js';

function loadAbly(): Promise<NonNullable<Window['Ably']>> {
  if (window.Ably) return Promise.resolve(window.Ably);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.Ably) resolve(window.Ably);
      else reject(new Error('Ably CDN loaded but window.Ably missing'));
    };
    script.onerror = () => reject(new Error('Failed to load Ably CDN'));
    document.head.appendChild(script);
  });
}

export function useAblyRoom(roomId: string, enabled: boolean) {
  const channelRef = useRef<AblyChannel | null>(null);
  const clientRef = useRef<AblyClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [presencePlayers, setPresencePlayers] = useState<PresencePlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [gameEvents, setGameEvents] = useState<{ type: string; payload: unknown }[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
  const [scoreEvent, setScoreEvent] = useState<ScoreData | null>(null);
  const [kickedPlayerId, setKickedPlayerId] = useState<string | null>(null);
  const [roomStatusEvent, setRoomStatusEvent] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !roomId) return;
    const key = process.env.NEXT_PUBLIC_ABLY_CLIENT_KEY;
    if (!key) return;

    let cancelled = false;
    let channel: AblyChannel | null = null;

    (async () => {
      const Ably = await loadAbly();
      if (cancelled) return;
      const client = new Ably.Realtime({ key });
      clientRef.current = client;
      client.connection.on('connected', () => setConnected(true));
      client.connection.on('disconnected', () => setConnected(false));
      channel = client.channels.get(`room:${roomId}`);

      channel.subscribe('position', (msg) => {
        const d = msg.data as PositionData;
        setPresencePlayers((prev) => {
          const next = prev.filter((p) => p.id !== d.id);
          return [...next, { id: d.id, username: d.username, avatar: d.avatar, role: d.role, x: d.x, y: d.y, facing: d.facing }];
        });
      });

      channel.subscribe('chat', (msg) => {
        setChatMessages((prev) => [...prev.slice(-29), msg.data as ChatMessage]);
      });

      channel.subscribe('question', (msg) => {
        const d = msg.data as { question: ActiveQuestion | null };
        setActiveQuestion(d.question);
      });

      channel.subscribe('score', (msg) => {
        setScoreEvent(msg.data as ScoreData);
      });

      channel.subscribe('kicked', (msg) => {
        const d = msg.data as { playerId: string };
        setKickedPlayerId(d.playerId);
      });

      channel.subscribe('room-status', (msg) => {
        const d = msg.data as { status: string };
        setRoomStatusEvent(d.status);
      });

      channel.subscribe('game-event', (msg) => {
        setGameEvents((prev) => [...prev.slice(-49), msg.data as { type: string; payload: unknown }]);
      });

      async function refreshPresence() {
        if (!channel) return;
        const members = await channel.presence.get();
        const ids = new Set(members.map((m) => m.clientId));
        setPresencePlayers((prev) => prev.filter((p) => ids.has(p.id)));
      }

      await channel.presence.enter();
      channel.presence.subscribe('leave', () => {
        void refreshPresence();
      });
      channel.presence.subscribe('enter', () => {
        void refreshPresence();
      });
      channelRef.current = channel;
      await refreshPresence();
    })().catch(() => {
      // CDN blocked or key invalid: game falls back to HTTP polling
    });

    return () => {
      cancelled = true;
      const current = channelRef.current;
      if (current) {
        void current.presence.leave();
        current.unsubscribe();
      }
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
      }
      channelRef.current = null;
      setConnected(false);
    };
  }, [roomId, enabled]);

  const publishPosition = useCallback((data: PositionData) => {
    channelRef.current?.publish('position', data);
  }, []);

  const publishChat = useCallback((message: ChatMessage) => {
    channelRef.current?.publish('chat', message);
  }, []);

  const publishGameEvent = useCallback((type: string, payload: unknown) => {
    channelRef.current?.publish('game-event', { type, payload });
  }, []);

  return { connected, presencePlayers, chatMessages, gameEvents, activeQuestion, scoreEvent, kickedPlayerId, roomStatusEvent, publishPosition, publishChat, publishGameEvent };
}
