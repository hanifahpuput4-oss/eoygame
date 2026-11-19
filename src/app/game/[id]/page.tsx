'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Camera } from '@/game-engine/camera/camera';
import { updatePlayerPhysics, type Player, PLAYER_W, PLAYER_H } from '@/game-engine/physics/physics';
import { drawWorld, drawPlatforms, drawCat, type BubbleEntry } from '@/game-engine/entities/render';
import { PLATFORMS, SPAWN_POINTS, WORLD, generateQuestionBlocks, type Platform } from '@/game-engine/maps/world';
import { useAblyRoom } from '@/features/multiplayer/use-ably-room';
import '../game.css';

type RoomPlayer = {
  userId: string;
  username: string;
  avatar: string;
  role?: string;
  lastX?: number;
  lastY?: number;
  lastFacing?: number;
  score?: number;
};

type RoomData = {
  hostId: string;
  id: string;
  name: string;
  code: string;
  status: string;
  players: RoomPlayer[];
  level: { id: string; name: string } | null;
};

type ChatMsg = { id: string; userId?: string; senderName: string; text: string; createdAt: string };

type Question = {
  id: string;
  content: string;
  points: number;
  timeLimit: number;
  options: { label: string; content: string }[];
};

const CHIP_COLORS = ['blue', 'pink', 'green', 'yellow', 'purple'] as const;

function chipColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[h % CHIP_COLORS.length];
}

function CatAvatarSvg({ color }: { color: string }) {
  const palettes: Record<string, { bg: string; stroke: string; fur: string; dark: string; eye: string }> = {
    blue: { bg: '#d8ecff', stroke: '#1e4b85', fur: '#5ca0ff', dark: '#183966', eye: '#10233d' },
    pink: { bg: '#ffe0ec', stroke: '#85214b', fur: '#ff80ab', dark: '#691638', eye: '#3d1024' },
    green: { bg: '#dff7e3', stroke: '#1f6b32', fur: '#66bb6a', dark: '#174f24', eye: '#0f3618' },
    yellow: { bg: '#fff3d1', stroke: '#8a6410', fur: '#ffc93c', dark: '#6b4a08', eye: '#3d2b04' },
    purple: { bg: '#efe2ff', stroke: '#5b2f9e', fur: '#b07cff', dark: '#45227a', eye: '#2a1450' },
  };
  const p = palettes[color] ?? palettes.blue;
  return (
    <svg width="36" height="36" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill={p.bg} stroke={p.stroke} strokeWidth="3" />
      <polygon points="11,18 8,6 20,13" fill={p.fur} stroke={p.dark} strokeWidth="2.5" />
      <polygon points="37,18 40,6 28,13" fill={p.fur} stroke={p.dark} strokeWidth="2.5" />
      <ellipse cx="24" cy="27" rx="14" ry="12" fill={p.fur} stroke={p.dark} strokeWidth="2.5" />
      <ellipse cx="24" cy="30" rx="9" ry="6.5" fill="#fff" />
      <circle cx="19" cy="25" r="2.2" fill={p.eye} />
      <circle cx="29" cy="25" r="2.2" fill={p.eye} />
    </svg>
  );
}

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params.id;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const playersRef = useRef<Map<string, Player>>(new Map());
  const myIdRef = useRef<string>('');
  const keysRef = useRef({ left: false, right: false, jump: false });
  const draggingRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const lastSentRef = useRef(0);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  const [room, setRoom] = useState<RoomData | null>(null);
  const roomRef = useRef<RoomData | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [myRole, setMyRole] = useState('student');
  const [chatMinimized, setChatMinimized] = useState(false);
  const [leaderboardMinimized, setLeaderboardMinimized] = useState(false);
  const [playersMinimized, setPlayersMinimized] = useState(true);
  const [missionMinimized, setMissionMinimized] = useState(true);
  const [questionMinimized, setQuestionMinimized] = useState(true);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [panelOffsets, setPanelOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const panelDragRef = useRef<{ key: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<string[]>([]);
  const answeredIdsRef = useRef<Set<string>>(new Set());
  const answerResultsRef = useRef<Map<string, boolean>>(new Map());
  const [correctCount, setCorrectCount] = useState(0);
  const [levelQuestions, setLevelQuestions] = useState<Question[]>([]);
  const levelQuestionsRef = useRef<Question[]>([]);
  const questionBlocksRef = useRef<Platform[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [question, setQuestion] = useState<Question | null>(null);
  const questionRef = useRef<Question | null>(null);
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctAnswer: string; explanation: string; pointsEarned: number } | null>(null);
  const [error, setError] = useState('');
  const bubblesRef = useRef<Map<string, BubbleEntry>>(new Map());
  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  const chatInitializedRef = useRef(false);
  const ablyEnabled = Boolean(process.env.NEXT_PUBLIC_ABLY_CLIENT_KEY);
  const ably = useAblyRoom(roomId, ablyEnabled);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const pRes = await fetch('/api/profile');
      if (!pRes.ok) {
        router.replace('/login');
        return;
      }
      const { profile: p } = await pRes.json();
      if (cancelled) return;
      myIdRef.current = p.id;
      setMyRole(p.role);

      const rRes = await fetch('/api/rooms/' + roomId);
      if (!rRes.ok) {
        setError('Ruang tidak ditemukan');
        return;
      }
      let r: RoomData = (await rRes.json()).room;
      if (r.status === 'completed' || (p.role !== 'teacher' && r.status !== 'in_progress')) {
        router.replace(p.role === 'teacher' ? '/dashboard/teacher/rooms' : '/dashboard/student');
        return;
      }
      const myEntry = (r.players ?? []).find((pl: RoomPlayer) => pl.userId === p.id);
      if (!myEntry) {
        const reRes = await fetch('/api/rooms', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId }),
        });
        if (!reRes.ok) {
          router.replace(p.role === 'teacher' ? '/dashboard/teacher/rooms' : '/dashboard/student');
          return;
        }
        const rd = await reRes.json();
        if (rd.room) {
          setRoom(rd.room);
          r = rd.room;
        }
      } else {
        setRoom(r);
      }
      roomRef.current = r;

      for (const pl of r.players ?? []) {
        const isMe = pl.userId === p.id;
        if (!playersRef.current.has(pl.userId)) {
          const spawn = SPAWN_POINTS[playersRef.current.size % SPAWN_POINTS.length];
          const px = pl.lastX ?? spawn.x;
          const py = pl.lastY ?? spawn.y;
          playersRef.current.set(pl.userId, {
            id: pl.userId,
            username: pl.username,
            avatar: pl.avatar,
            role: isMe ? p.role : pl.role,
            x: px,
            y: py,
            targetX: px,
            targetY: py,
            vx: 0,
            vy: 0,
            facing: (pl.lastFacing as 1 | -1) ?? 1,
            onGround: false,
          });
        }
      }
      if (!playersRef.current.has(p.id)) {
        const spawn = SPAWN_POINTS[playersRef.current.size % SPAWN_POINTS.length];
        playersRef.current.set(p.id, {
          id: p.id,
          username: p.username,
          avatar: p.avatar,
          role: p.role,
          x: myEntry?.lastX ?? spawn.x,
          y: myEntry?.lastY ?? spawn.y,
          vx: 0,
          vy: 0,
          facing: (myEntry?.lastFacing as 1 | -1) ?? 1,
          onGround: false,
        });
      }

      const cRes = await fetch('/api/rooms/' + roomId + '/chat');
      if (cRes.ok) {
        const data = await cRes.json();
        const initialMsgs: ChatMsg[] = data.messages ?? [];
        for (const m of initialMsgs) seenMsgIdsRef.current.add(m.id);
        chatInitializedRef.current = true;
        setChat(initialMsgs);
      } else {
        chatInitializedRef.current = true;
      }

      if (r.level?.id) {
        const lRes = await fetch('/api/levels/' + r.level.id + '/questions');
        if (lRes.ok) {
          const data = await lRes.json();
          const qs: Question[] = data.questions ?? [];
          setLevelQuestions(qs);
          levelQuestionsRef.current = qs;
          questionBlocksRef.current = generateQuestionBlocks(
            qs.map((q) => q.id),
            `${p.id}:${roomId}`,
          );
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [roomId, router]);

  useEffect(() => {
    for (const rp of ably.presencePlayers) {
      if (rp.id === myIdRef.current) continue;
      const existing = playersRef.current.get(rp.id);
      if (existing) {
        existing.targetX = rp.x;
        existing.targetY = rp.y;
        existing.facing = rp.facing;
        if (rp.role) existing.role = rp.role;
      } else {
        playersRef.current.set(rp.id, {
          id: rp.id,
          username: rp.username,
          avatar: rp.avatar,
          role: rp.role,
          x: rp.x,
          y: rp.y,
          targetX: rp.x,
          targetY: rp.y,
          vx: 0,
          vy: 0,
          facing: rp.facing,
          onGround: false,
        });
      }
    }
  }, [ably.presencePlayers]);

  useEffect(() => {
    function onKey(e: KeyboardEvent, down: boolean) {
      const target = e.target as HTMLElement | null;
      const active = document.activeElement as HTMLElement | null;
      const isTyping =
        (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) ||
        (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable));
      if (isTyping) {
        keysRef.current.left = false;
        keysRef.current.right = false;
        keysRef.current.jump = false;
        return;
      }
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) keysRef.current.left = down;
      if (['ArrowRight', 'd', 'D'].includes(e.key)) keysRef.current.right = down;
      if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) {
        keysRef.current.jump = down;
        if (down) e.preventDefault();
      }
    }
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      cameraRef.current?.resize(canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    const camera = new Camera(canvas.width, canvas.height);
    cameraRef.current = camera;

    let raf = 0;
    let tick = 0;
    let prevSentX = -1;
    let prevSentY = -1;
    let prevSentFacing = 0;

    function loop() {
      if (!ctx || !canvas) return;
      tick += 1;

      const me = playersRef.current.get(myIdRef.current);

      for (const p of playersRef.current.values()) {
        if (p.id === myIdRef.current) continue;
        if (p.targetX !== undefined) {
          const dx = p.targetX - p.x;
          if (Math.abs(dx) > 450) {
            p.x = p.targetX;
          } else if (Math.abs(dx) < 0.35) {
            p.x = p.targetX;
          } else {
            p.x += dx * 0.22;
          }
        }
        if (p.targetY !== undefined) {
          const dy = p.targetY - p.y;
          if (Math.abs(dy) > 450) {
            p.y = p.targetY;
          } else if (Math.abs(dy) < 0.35) {
            p.y = p.targetY;
          } else {
            p.y += dy * 0.22;
          }
        }
      }

      const dynBlocks: Platform[] = questionBlocksRef.current.map((b) => {
        const qid = b.questionId ?? '';
        const res = answerResultsRef.current.get(qid);
        const type = res === true ? 'qblock-correct' : res === false ? 'qblock-wrong' : 'qblock';
        return { ...b, type };
      });

      if (me && (room?.status === 'in_progress' || room?.status === 'waiting')) {
        updatePlayerPhysics(me, keysRef.current, playersRef.current.values(), dynBlocks, (qid) => {
          if (myRole === 'teacher') return;
          if (answeredIdsRef.current.has(qid)) return;
          if (questionRef.current?.id === qid) {
            setQuestionMinimized(false);
            return;
          }
          const found = levelQuestionsRef.current.find((q) => q.id === qid);
          if (found) {
            questionRef.current = found;
            setQuestion(found);
            setQuestionMinimized(false);
            setSelected('');
          }
        });
      }

      if (me && ablyEnabled && ably.connected && tick % 3 === 0) {
        const now = Date.now();
        const moved = Math.abs(me.x - prevSentX) > 0.5 || Math.abs(me.y - prevSentY) > 0.5 || me.facing !== prevSentFacing;
        if (moved && now - lastSentRef.current > 60) {
          lastSentRef.current = now;
          prevSentX = me.x;
          prevSentY = me.y;
          prevSentFacing = me.facing;
          ably.publishPosition({ id: me.id, username: me.username, avatar: me.avatar, role: myRole, x: me.x, y: me.y, facing: me.facing });
        }
      }

      camera.follow(me ? me.x + PLAYER_W / 2 : WORLD.width / 2, me ? me.y : WORLD.height / 2);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      camera.applyTransform(ctx);

      drawWorld(ctx);
      drawPlatforms(ctx, [...PLATFORMS, ...dynBlocks]);

      for (const p of playersRef.current.values()) {
        const role = p.id === myIdRef.current ? myRole : (p.role ?? (room?.hostId === p.id ? 'teacher' : 'student'));
        drawCat(ctx, p.x, p.y, PLAYER_W, PLAYER_H, p.avatar, p.facing, p.username, role, bubblesRef.current.get(p.id) ?? null);
      }

      ctx.restore();
      raf = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [room?.status, room?.hostId, roomId, myRole, ablyEnabled, ably.connected, ably.publishPosition]);

  useEffect(() => {
    if (!ablyEnabled || !ably.connected) {
      let active = true;
      let timer: ReturnType<typeof setTimeout>;
      async function syncLoop() {
        if (!active) return;
        try {
          const me = playersRef.current.get(myIdRef.current);
          const payload: Record<string, unknown> = { roomId };
          if (me) {
            payload.x = Math.round(me.x * 10) / 10;
            payload.y = Math.round(me.y * 10) / 10;
            payload.facing = me.facing;
          }
          const res = await fetch('/api/game/room-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok || !active) return;
          const data = await res.json();
          const serverPlayers: RoomPlayer[] = data.players ?? [];
          setScores((prev) => {
            const next = { ...prev };
            for (const p of serverPlayers) next[p.userId] = p.score ?? 0;
            return next;
          });
          const activeIds = new Set(serverPlayers.map((p) => p.userId));
          for (const id of Array.from(playersRef.current.keys())) {
            if (id !== myIdRef.current && !activeIds.has(id)) {
              playersRef.current.delete(id);
            }
          }
          for (const p of serverPlayers) {
            if (p.userId === myIdRef.current) continue;
            const existing = playersRef.current.get(p.userId);
            if (existing) {
              if (p.lastX !== undefined) existing.targetX = p.lastX;
              if (p.lastY !== undefined) existing.targetY = p.lastY;
              if (p.lastFacing !== undefined) existing.facing = p.lastFacing as 1 | -1;
              if (p.role) existing.role = p.role;
            } else {
              const px = p.lastX ?? 120;
              const py = p.lastY ?? 600;
              playersRef.current.set(p.userId, {
                id: p.userId,
                username: p.username,
                avatar: p.avatar,
                role: p.role,
                x: px,
                y: py,
                targetX: px,
                targetY: py,
                vx: 0,
                vy: 0,
                facing: (p.lastFacing as 1 | -1) ?? 1,
                onGround: false,
              });
            }
          }
          if (data.room?.status === 'completed') {
            active = false;
            router.replace(myRole === 'teacher' ? '/dashboard/teacher/rooms' : '/dashboard/student');
            return;
          }
          setRoom((prev) => {
            if (!prev) return prev;
            const statusChanged = data.room?.status && data.room.status !== prev.status;
            const playersChanged =
              prev.players.length !== serverPlayers.length ||
              prev.players.some((pl, idx) => pl.userId !== serverPlayers[idx]?.userId);
            if (!statusChanged && !playersChanged) return prev;
            return {
              ...prev,
              status: data.room?.status ?? prev.status,
              players: serverPlayers,
            };
          });
          if (Array.isArray(data.messages)) {
            setChat((prev) => {
              if (prev.length === data.messages.length && prev[prev.length - 1]?.id === data.messages[data.messages.length - 1]?.id) {
                return prev;
              }
              return data.messages;
            });
          }
          if (data.answerResults && typeof data.answerResults === 'object') {
            for (const [qid, okAns] of Object.entries(data.answerResults as Record<string, boolean>)) {
              answerResultsRef.current.set(qid, Boolean(okAns));
            }
          }
          if (Array.isArray(data.answeredQuestionIds)) {
            for (const qid of data.answeredQuestionIds) answeredIdsRef.current.add(qid);
            setAnsweredQuestionIds((prev) => (prev.length === answeredIdsRef.current.size ? prev : Array.from(answeredIdsRef.current)));
          }
          if (typeof data.correctCount === 'number') {
            setCorrectCount(data.correctCount);
          }
        } catch {
          // polling fallback failure is non-fatal
        } finally {
          if (active) timer = setTimeout(syncLoop, 150);
        }
      }
      syncLoop();
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [ablyEnabled, ably.connected, roomId, levelQuestions]);

  useEffect(() => {
    if (ably.roomStatusEvent === 'completed') {
      router.replace(myRole === 'teacher' ? '/dashboard/teacher/rooms' : '/dashboard/student');
    }
  }, [ably.roomStatusEvent, myRole, router]);

  useEffect(() => {
    if (!ably.scoreEvent) return;
    setScores((prev) => ({ ...prev, [ably.scoreEvent!.userId]: ably.scoreEvent!.score }));
  }, [ably.scoreEvent]);

  useEffect(() => {
    if (!ably.kickedPlayerId) return;
    if (ably.kickedPlayerId === myIdRef.current) {
      alert('Anda dikeluarkan dari ruang oleh guru.');
      router.push(myRole === 'teacher' ? '/dashboard/teacher/rooms' : '/dashboard/student');
    } else {
      playersRef.current.delete(ably.kickedPlayerId);
    }
  }, [ably.kickedPlayerId, myRole, router]);

  useEffect(() => {
    const box = chatBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [chat, ably.chatMessages]);

  useEffect(() => {
    const msgs: ChatMsg[] = ably.chatMessages.length > 0 ? (ably.chatMessages as ChatMsg[]) : chat;
    if (!chatInitializedRef.current || msgs.length === 0) return;
    for (const m of msgs) {
      if (seenMsgIdsRef.current.has(m.id)) continue;
      seenMsgIdsRef.current.add(m.id);
      const player =
        (m.userId ? playersRef.current.get(m.userId) : undefined) ??
        Array.from(playersRef.current.values()).find((pl) => pl.username === m.senderName);
      if (player) {
        bubblesRef.current.set(player.id, { text: m.text, at: Date.now() });
      }
    }
  }, [chat, ably.chatMessages]);

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = { active: true, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current.active || !cameraRef.current) return;
    cameraRef.current.panBy(e.clientX - draggingRef.current.x, e.clientY - draggingRef.current.y);
    draggingRef.current = { active: true, x: e.clientX, y: e.clientY };
  }
  function onPointerUp() {
    draggingRef.current.active = false;
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    cameraRef.current?.zoomBy(e.deltaY > 0 ? -0.1 : 0.1);
  }

  function startPanelDrag(key: string, e: React.PointerEvent, allowButtonDrag = false) {
    if (!allowButtonDrag && (e.target as HTMLElement).closest('button, input')) return;
    e.stopPropagation();
    const cur = panelOffsets[key] ?? { x: 0, y: 0 };
    panelDragRef.current = { key, startX: e.clientX, startY: e.clientY, origX: cur.x, origY: cur.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function movePanelDrag(e: React.PointerEvent) {
    const d = panelDragRef.current;
    if (!d) return;
    e.stopPropagation();
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    const nx = d.origX + dx;
    const ny = d.origY + dy;
    setPanelOffsets((prev) => ({ ...prev, [d.key]: { x: nx, y: ny } }));
  }

  function endPanelDrag(e: React.PointerEvent, onClickFallback?: () => void) {
    const d = panelDragRef.current;
    if (!d) return;
    e.stopPropagation();
    const wasMoved = d.moved;
    panelDragRef.current = null;
    if (!wasMoved && onClickFallback) onClickFallback();
  }

  function panelStyle(key: string): React.CSSProperties | undefined {
    const o = panelOffsets[key];
    return o ? { transform: `translate(${o.x}px, ${o.y}px)` } : undefined;
  }

  function touchControl(dir: 'left' | 'right' | 'jump', down: boolean) {
    keysRef.current[dir] = down;
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    if (myIdRef.current) {
      bubblesRef.current.set(myIdRef.current, { text, at: Date.now() });
    }
    const res = await fetch('/api/game/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, text }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.message) {
        seenMsgIdsRef.current.add(data.message.id);
        setChat((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      }
    }
  }

  const displayChat = ably.chatMessages.length > 0 ? ably.chatMessages : chat;
  const players = room?.players ?? [];
  const totalSteps = Math.max(levelQuestions.length, 1);
  const doneSteps = Math.min(correctCount, totalSteps);
  const sortedPlayers = [...players].sort((a, b) => (scores[b.userId] ?? 0) - (scores[a.userId] ?? 0) || a.username.localeCompare(b.username));
  const hasVisibleQuestion = Boolean(question && myRole !== 'teacher' && !answeredQuestionIds.includes(question.id));
  const allBottomMinimized =
    panelsHidden || (chatMinimized && playersMinimized && missionMinimized && (!hasVisibleQuestion || questionMinimized));
  const controlsPosClass = allBottomMinimized ? '' : ' mp-elevated';

  async function endGame() {
    const res = await fetch('/api/rooms/' + roomId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    if (res.ok) {
      router.replace('/dashboard/teacher/rooms');
    }
  }

  async function kickPlayer(playerId: string) {
    const res = await fetch('/api/game/kick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    });
    if (res.ok) {
      playersRef.current.delete(playerId);
      setRoom((prev) => (prev ? { ...prev, players: prev.players.filter((pl) => pl.userId !== playerId) } : prev));
    }
  }
  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!question || !selected || submitting) return;
    setSubmitting(true);
    try {
      const answeredId = question.id;
      const sessionRes = await fetch('/api/rooms/' + roomId);
      const { room: r } = await sessionRes.json();
      const sRes = await fetch('/api/game/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, levelId: r.level?.id }),
      });
      const { sessionId } = await sRes.json();

      const res = await fetch('/api/game/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, questionId: answeredId, answer: selected, timeSpent: 0 }),
      });
      const data = await res.json();
      if (res.ok) {
        const result = data.result ?? data;
        answerResultsRef.current.set(answeredId, Boolean(result.isCorrect));
        answeredIdsRef.current.add(answeredId);
        setAnsweredQuestionIds(Array.from(answeredIdsRef.current));
        setSelected('');
        if (result.isCorrect) {
          setCorrectCount((c) => c + 1);
          if (myIdRef.current) {
            setScores((prev) => ({
              ...prev,
              [myIdRef.current]: (prev[myIdRef.current] ?? 0) + (result.pointsEarned ?? 0),
            }));
          }
        }
        setFeedback(result);
      } else {
        if (res.status === 409) {
          answeredIdsRef.current.add(answeredId);
          setAnsweredQuestionIds(Array.from(answeredIdsRef.current));
          questionRef.current = null;
          setQuestion(null);
          setSelected('');
        } else {
          setError(data.error ?? 'Gagal mengirim jawaban');
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--cream-bg)]">
        <div className="parchment-card mp-error-card">
          <div className="wood-header-sign">llysSmart</div>
          <p className="font-display text-xl font-semibold">{error}</p>
          <div className="mt-4 flex justify-center">
            <button className="btn-orange-action" onClick={() => router.push('/dashboard/student')}>
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#1e2d42] p-2 md:p-4">
      <div className="game-viewport">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        />

        <div className="mp-hud-layer">
          <div className="mp-topbar">
              <div className="mp-top-left">
                <div className="mp-brand-pill">
                  <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true">
                    <rect x="4" y="12" width="40" height="24" rx="12" fill="#e8eefc" stroke="#233866" strokeWidth="3.5" />
                    <path d="M15 20v8M11 24h8" stroke="#3b66c4" strokeWidth="3.2" strokeLinecap="round" />
                    <circle cx="32" cy="21" r="2.5" fill="#ef4b5b" />
                    <circle cx="36" cy="26" r="2.5" fill="#ffb03b" />
                  </svg>
                  <div className="mp-brand-text">
                    <span className="mp-brand-name">llysSmart</span>
                    <span className="mp-brand-sub">Let&apos;s Learn Your Skills</span>
                  </div>
                </div>

                <div className="mp-team-cards" role="group" aria-label="Pemain di ruang">
                  {sortedPlayers.slice(0, 3).map((p) => {
                    const color = chipColor(p.userId);
                    const active = p.userId === myIdRef.current;
                    return (
                      <div key={p.userId} className={`mp-player-chip ${color}${active ? ' active' : ''}`}>
                        <span className="mp-cat-avatar">
                          <CatAvatarSvg color={color} />
                        </span>
                        <span className="mp-chip-info">
                          <span className="mp-chip-name">{p.username}</span>
                          <span className="mp-mini-bar">
                            <span className={`mp-mini-fill ${color}`} style={{ width: active ? '100%' : '45%' }} />
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mp-center-stage-pill">
                <div className="mp-stage-title">{room?.level?.name ?? room?.name ?? 'Arena llysSmart'}</div>
                <div className="mp-step-dots" aria-label="Progres tantangan">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <span key={i} className={`step-dot${i < doneSteps ? ' done' : ''}`} />
                  ))}
                </div>
              </div>

              <div className="mp-top-right">
                <div className="mp-timer-row">
                  <button
                    type="button"
                    className="pause-btn"
                    aria-pressed={panelsHidden}
                    aria-label={panelsHidden ? 'Tampilkan semua panel' : 'Sembunyikan semua panel'}
                    title={panelsHidden ? 'Tampilkan semua panel' : 'Sembunyikan semua panel'}
                    onClick={() => setPanelsHidden((v) => !v)}
                  >
                    {panelsHidden ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="3" y1="3" x2="21" y2="21" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" fill="#fff" />
                      </svg>
                    )}
                  </button>
                  <button type="button" className="pause-btn" aria-label="Kembali" title="Kembali" onClick={() => router.push(myRole === 'teacher' ? '/dashboard/teacher/rooms' : '/dashboard/student')}>
                    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path d="M20 6l-12 10 12 10v-6h8v-8h-8V6z" fill="#fff" /></svg>
                  </button>
                </div>

                {!panelsHidden && (
                  leaderboardMinimized ? (
                    <button
                      type="button"
                      className="mp-icon-badge"
                      aria-label="Buka Leaderboard"
                      title="Buka Leaderboard"
                      style={panelStyle('leaderboard')}
                      onPointerDown={(e) => startPanelDrag('leaderboard', e, true)}
                      onPointerMove={movePanelDrag}
                      onPointerUp={(e) => endPanelDrag(e, () => setLeaderboardMinimized(false))}
                      onPointerCancel={(e) => endPanelDrag(e)}
                    >
                      <span aria-hidden="true">🏆</span>
                    </button>
                  ) : (
                    <aside className="mp-dark-panel mp-leaderboard-box" aria-label="Papan peringkat" style={panelStyle('leaderboard')}>
                      <h2
                        className="mp-panel-heading mp-drag-handle"
                        onPointerDown={(e) => startPanelDrag('leaderboard', e)}
                        onPointerMove={movePanelDrag}
                        onPointerUp={(e) => endPanelDrag(e)}
                        onPointerCancel={(e) => endPanelDrag(e)}
                      >
                        <span className="mp-panel-heading-title">
                          <span aria-hidden="true">🏆</span> Leaderboard
                        </span>
                        <button
                          type="button"
                          className="mp-win-btn"
                          aria-label="Perkecil leaderboard"
                          title="Perkecil"
                          onClick={() => setLeaderboardMinimized(true)}
                        >
                          −
                        </button>
                      </h2>
                      <ol className="mp-rank-list">
                        {sortedPlayers.slice(0, 5).map((p, i) => (
                          <li key={p.userId} className="mp-rank-row">
                            <span className={`rank-medal ${['gold', 'silver', 'bronze'][i] ?? 'silver'}`}>{i + 1}</span>
                            <span className={`rank-cat-dot ${chipColor(p.userId)}`} aria-hidden="true" />
                            <span className="rank-name">{p.username}</span>
                            <span className="rank-score">{scores[p.userId] ?? 0}</span>
                          </li>
                        ))}
                      </ol>
                    </aside>
                  )
                )}
              </div>
          </div>

          <div className={`onscreen-controls${controlsPosClass}`}>
            <div className="dpad-group">
              <button type="button" className="ctrl-circle" aria-label="Gerak ke Kiri"
                onPointerDown={() => touchControl('left', true)} onPointerUp={() => touchControl('left', false)}
                onPointerLeave={() => touchControl('left', false)}>
                <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
                  <path d="M18 7l-9 9 9 9v-5h8v-8h-8V7z" fill="#fff" />
                </svg>
              </button>
              <button type="button" className="ctrl-circle" aria-label="Gerak ke Kanan"
                onPointerDown={() => touchControl('right', true)} onPointerUp={() => touchControl('right', false)}
                onPointerLeave={() => touchControl('right', false)}>
                <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
                  <path d="M14 7l9 9-9 9v-5H6v-8h8V7z" fill="#fff" />
                </svg>
              </button>
            </div>

            <div className="dpad-group">
              <button type="button" className="ctrl-circle" aria-label="Perbesar"
                onClick={() => { cameraRef.current?.zoomBy(0.1); }}>
                <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
                  <circle cx="14" cy="14" r="8" fill="none" stroke="#fff" strokeWidth="3" />
                  <line x1="20" y1="20" x2="27" y2="27" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <line x1="11" y1="14" x2="17" y2="14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="ctrl-circle" aria-label="Perkecil"
                onClick={() => { cameraRef.current?.zoomBy(-0.1); }}>
                <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
                  <circle cx="14" cy="14" r="8" fill="none" stroke="#fff" strokeWidth="3" />
                  <line x1="20" y1="20" x2="27" y2="27" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <line x1="11" y1="14" x2="17" y2="14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="ctrl-circle" aria-label="Lompat"
                onPointerDown={() => touchControl('jump', true)} onPointerUp={() => touchControl('jump', false)}
                onPointerLeave={() => touchControl('jump', false)}>
                <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
                  <path d="M16 6l-9 9h5v11h8V15h5l-9-9z" fill="#fff" />
                </svg>
              </button>
            </div>
          </div>

          {!panelsHidden && (
          <div className="mp-bottom-dock">
              {chatMinimized ? (
                <button
                  type="button"
                  className="mp-icon-badge"
                  aria-label="Buka Chat Room"
                  title="Buka Chat Room"
                  style={panelStyle('chat')}
                  onPointerDown={(e) => startPanelDrag('chat', e, true)}
                  onPointerMove={movePanelDrag}
                  onPointerUp={(e) => endPanelDrag(e, () => setChatMinimized(false))}
                  onPointerCancel={(e) => endPanelDrag(e)}
                >
                  <span aria-hidden="true">💬</span>
                </button>
              ) : (
                <aside className="mp-dark-panel mp-chat-panel" aria-label="Ruang obrolan" style={panelStyle('chat')}>
                  <div
                    className="mp-chat-header mp-drag-handle"
                    onPointerDown={(e) => startPanelDrag('chat', e)}
                    onPointerMove={movePanelDrag}
                    onPointerUp={(e) => endPanelDrag(e)}
                    onPointerCancel={(e) => endPanelDrag(e)}
                  >
                    <div className="mp-chat-title">
                      <span aria-hidden="true">💬</span> Chat Room
                    </div>
                    <div className="mp-online-count" aria-label={`${players.length} pemain`}>
                      <span aria-hidden="true">👤</span> {players.length}
                      <button
                        type="button"
                        className="mp-win-btn"
                        aria-label="Perkecil chat"
                        title="Perkecil chat"
                        onClick={() => setChatMinimized(true)}
                      >
                        −
                      </button>
                    </div>
                  </div>

                  <div className="mp-chat-messages" ref={chatBoxRef} role="log" aria-live="polite">
                    {displayChat.map((m) => (
                      <div key={m.id} className="chat-msg-item">
                        <span>
                          <span className={`chat-sender ${chipColor(m.senderName)}`}>{m.senderName}</span>
                          <span className="chat-text">: {m.text}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <form className="mp-chat-form" onSubmit={sendChat}>
                    <label htmlFor="mp-chat-input" className="sr-only">Ketik pesan</label>
                    <input
                      id="mp-chat-input"
                      type="text"
                      className="mp-chat-input"
                      placeholder="Ketik pesan..."
                      maxLength={120}
                      autoComplete="off"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onFocus={() => {
                        keysRef.current.left = false;
                        keysRef.current.right = false;
                        keysRef.current.jump = false;
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      onKeyUp={(e) => e.stopPropagation()}
                    />
                    <button type="submit" className="mp-chat-send-btn" aria-label="Kirim pesan">
                      <span aria-hidden="true">➤</span>
                    </button>
                  </form>
                </aside>
              )}

              {question && myRole !== 'teacher' && !answeredQuestionIds.includes(question.id) && (
                questionMinimized ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="mp-icon-badge mp-icon-badge-parchment"
                      aria-label="Buka Tantangan Soal"
                      title="Buka Tantangan Soal"
                      style={panelStyle('question')}
                      onPointerDown={(e) => startPanelDrag('question', e, true)}
                      onPointerMove={movePanelDrag}
                      onPointerUp={(e) => endPanelDrag(e, () => setQuestionMinimized(false))}
                      onPointerCancel={(e) => endPanelDrag(e)}
                    >
                      <span aria-hidden="true">📖</span>
                    </button>
                  </div>
                ) : (
                  <section className="parchment-card mp-question-dock" aria-label="Tantangan soal" style={panelStyle('question')}>
                    <div
                      className="mp-dock-ribbon mp-drag-handle"
                      onPointerDown={(e) => startPanelDrag('question', e)}
                      onPointerMove={movePanelDrag}
                      onPointerUp={(e) => endPanelDrag(e)}
                      onPointerCancel={(e) => endPanelDrag(e)}
                    >
                      <span className="mp-panel-heading-title">
                        <span aria-hidden="true">📖</span> Tantangan Soal
                      </span>
                      <button
                        type="button"
                        className="mp-win-btn"
                        aria-label="Perkecil soal"
                        title="Perkecil soal"
                        onClick={() => setQuestionMinimized(true)}
                      >
                        −
                      </button>
                    </div>

                    <div className="mp-bonus-badge" aria-label={`Bonus ${question.points} poin`}>
                      <span aria-hidden="true">⏱</span> +{question.points}
                    </div>

                    <div className="mp-q-header-row">
                      <h2 className="mp-q-heading">{question.content}</h2>
                    </div>

                    <form onSubmit={submitAnswer}>
                      <div className="mp-options-grid-2x2" role="radiogroup" aria-label="Pilihan jawaban">
                        {question.options.map((o) => (
                          <button
                            key={o.label}
                            type="button"
                            role="radio"
                            aria-checked={selected === o.label}
                            className={`mp-grid-opt-btn${selected === o.label ? ' selected' : ''}`}
                            onClick={() => setSelected(o.label)}
                          >
                            <span className="opt-badge">{o.label}</span>
                            {o.content}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-end">
                        <button type="submit" className="btn-orange-action" disabled={!selected || submitting}>
                          <span aria-hidden="true">✔</span> {submitting ? 'Mengirim...' : 'Submit'}
                        </button>
                      </div>
                    </form>
                  </section>
                )
              )}

              <aside className={`mp-right-progress-stack${playersMinimized && missionMinimized ? ' is-compact-icons' : ''}`} aria-label="Progres belajar">
                {playersMinimized ? (
                  <button
                    type="button"
                    className="mp-icon-badge"
                    aria-label="Buka Daftar Pemain"
                    title="Buka Daftar Pemain"
                    style={panelStyle('players')}
                    onPointerDown={(e) => startPanelDrag('players', e, true)}
                    onPointerMove={movePanelDrag}
                    onPointerUp={(e) => endPanelDrag(e, () => setPlayersMinimized(false))}
                    onPointerCancel={(e) => endPanelDrag(e)}
                  >
                    <span aria-hidden="true">📊</span>
                  </button>
                ) : (
                  <div className="mp-dark-panel mp-progress-mini-card" style={panelStyle('players')}>
                    <h2
                      className="mp-panel-heading mp-drag-handle"
                      onPointerDown={(e) => startPanelDrag('players', e)}
                      onPointerMove={movePanelDrag}
                      onPointerUp={(e) => endPanelDrag(e)}
                      onPointerCancel={(e) => endPanelDrag(e)}
                    >
                      <span className="mp-panel-heading-title">
                        <span aria-hidden="true">📊</span> Pemain
                      </span>
                      <button
                        type="button"
                        className="mp-win-btn"
                        aria-label="Perkecil daftar pemain"
                        title="Perkecil daftar pemain"
                        onClick={() => setPlayersMinimized(true)}
                      >
                        −
                      </button>
                    </h2>
                    <ol className="mp-rank-list">
                      {sortedPlayers.slice(0, 3).map((p, i) => (
                        <li key={p.userId} className="mp-rank-row">
                          <span className={`rank-medal ${['gold', 'silver', 'bronze'][i] ?? 'bronze'}`}>{i + 1}</span>
                          <span className="rank-name">{p.username}</span>
                          <span className="rank-score">{scores[p.userId] ?? 0}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {missionMinimized ? (
                  <button
                    type="button"
                    className="mp-icon-badge"
                    aria-label="Buka Misi"
                    title="Buka Misi"
                    style={panelStyle('mission')}
                    onPointerDown={(e) => startPanelDrag('mission', e, true)}
                    onPointerMove={movePanelDrag}
                    onPointerUp={(e) => endPanelDrag(e, () => setMissionMinimized(false))}
                    onPointerCancel={(e) => endPanelDrag(e)}
                  >
                    <span aria-hidden="true">🎯</span>
                  </button>
                ) : (
                  <div className="mp-dark-panel mp-topic-card" style={panelStyle('mission')}>
                    <h3
                      className="mp-panel-heading mp-drag-handle"
                      onPointerDown={(e) => startPanelDrag('mission', e)}
                      onPointerMove={movePanelDrag}
                      onPointerUp={(e) => endPanelDrag(e)}
                      onPointerCancel={(e) => endPanelDrag(e)}
                    >
                      <span className="mp-panel-heading-title">
                        <span aria-hidden="true">🎯</span> Misi
                      </span>
                      <button
                        type="button"
                        className="mp-win-btn"
                        aria-label="Perkecil misi"
                        title="Perkecil misi"
                        onClick={() => setMissionMinimized(true)}
                      >
                        −
                      </button>
                    </h3>
                    <ul className="mp-topic-checklist">
                      <li><span className="check-green" aria-hidden="true">✔</span> Masuk arena</li>
                      <li>
                        <span className={doneSteps > 0 ? 'check-green' : 'check-pending'} aria-hidden="true">
                          {doneSteps > 0 ? '✔' : '○'}
                        </span>{' '}
                        Jawab tantangan soal ({doneSteps}/{totalSteps})
                      </li>
                    </ul>
                    <div className="mp-goal-bar-row">
                      <span aria-hidden="true">🚩</span>
                      <div className="mp-goal-track">
                        <div className="mp-goal-fill" style={{ width: `${(doneSteps / totalSteps) * 100}%` }} />
                      </div>
                      <span className="mp-goal-fraction">{doneSteps} / {totalSteps}</span>
                    </div>
                  </div>
                )}

                {myRole === 'teacher' && (
                  <div className="mp-teacher-actions">
                    <button
                      type="button"
                      className="btn-blue-action mp-menu-btn"
                      onClick={() => setKickModalOpen(true)}
                    >
                      <span aria-hidden="true">👥</span> Pemain
                    </button>
                    <button
                      type="button"
                      className="btn-orange-action mp-menu-btn"
                      onClick={endGame}
                    >
                      <span aria-hidden="true">🏁</span> Akhiri
                    </button>
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>

        {kickModalOpen && myRole === 'teacher' && (
          <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Kelola Pemain" onClick={() => setKickModalOpen(false)}>
            <div className="parchment-card feedback-modal-card teacher-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <div className="green-arch-ribbon">Kelola Pemain</div>
              </div>
              <p className="feedback-subtext text-center" style={{ marginBottom: 8 }}>
                Keluarkan peserta yang tidak dikenal dari ruang permainan.
              </p>

              <div className="teacher-list-box">
                {sortedPlayers.filter((pl) => pl.userId !== myIdRef.current).length === 0 ? (
                  <p className="feedback-subtext text-center">Belum ada siswa di dalam ruang.</p>
                ) : (
                  sortedPlayers
                    .filter((pl) => pl.userId !== myIdRef.current)
                    .map((pl) => (
                      <div key={pl.userId} className="teacher-q-card">
                        <div className="teacher-q-info">
                          <div className="teacher-q-text">{pl.username}</div>
                          <div className="teacher-q-meta">
                            <span>Skor: {scores[pl.userId] ?? 0} poin</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-orange-action"
                          style={{ fontSize: 13, padding: '6px 14px', minHeight: 38, flexShrink: 0 }}
                          onClick={() => kickPlayer(pl.userId)}
                        >
                          Kick
                        </button>
                      </div>
                    ))
                )}
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="btn-blue-action"
                  style={{ fontSize: 13, padding: '6px 20px', minHeight: 40 }}
                  onClick={() => setKickModalOpen(false)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
        {feedback && (
          <div className="overlay-backdrop" role="dialog" aria-modal="true">
            <div className="parchment-card feedback-modal-card">
              <div className="green-arch-ribbon">{feedback.isCorrect ? 'Jawaban Benar!' : 'Jawaban Salah'}</div>

              <div className="big-star-wrap" aria-hidden="true">
                <svg width="96" height="96" viewBox="0 0 64 64">
                  <polygon
                    points="32,4 40.5,21.5 60,24.3 46,38 49.3,57.2 32,48 14.7,57.2 18,38 4,24.3 23.5,21.5"
                    fill={feedback.isCorrect ? '#ffd43b' : '#d9c9a8'}
                    stroke="#8c5308"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <p className="feedback-star-bonus">+{feedback.pointsEarned} Poin</p>
              <p className="feedback-subtext">
                Jawaban benar: <strong>{feedback.correctAnswer}</strong>
              </p>
              {feedback.explanation && <p className="feedback-subtext">{feedback.explanation}</p>}

              <button
                type="button"
                className="btn-green-action"
                onClick={() => {
                  setFeedback(null);
                  questionRef.current = null;
                  setQuestion(null);
                }}
              >
                Oke <span aria-hidden="true">▶</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
