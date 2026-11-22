'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Camera } from '@/game-engine/camera/camera';
import { updatePlayerPhysics, updateStageEntities, type Player, type Projectile, PLAYER_W, PLAYER_H } from '@/game-engine/physics/physics';
import { drawWorld, drawPlatforms, drawEnemies, drawPowerUps, drawProjectiles, drawCat, type BubbleEntry } from '@/game-engine/entities/render';
import {
  PHYSICS,
  PLATFORMS,
  SPAWN_POINTS,
  WORLD,
  generateQuestionBlocks,
  getStageBasePlatforms,
  createStageEnemies,
  createStagePowerUps,
  type Platform,
  type StageEnemy,
  type StagePowerUp,
} from '@/game-engine/maps/world';
import { soundEngine } from '@/game-engine/audio/sound-engine';
import { useAblyRoom, type ObstacleEvent, type RoomCommandEvent } from '@/features/multiplayer/use-ably-room';
import { clearCachedData } from '@/lib/client-cache';
import '../game.css';

type HudControlsConfig = {
  size: number;
  gap: number;
  opacity: number;
  swapSides: boolean;
  dpadX: number;
  dpadY: number;
  jumpX: number;
  jumpY: number;
};

const DEFAULT_HUD_CONTROLS: HudControlsConfig = {
  size: 86,
  gap: 18,
  opacity: 0.88,
  swapSides: false,
  dpadX: 0,
  dpadY: 0,
  jumpX: 0,
  jumpY: 0,
};

const HUD_CONTROLS_STORAGE_KEY = 'llys_hud_controls_v1';

type RoomPlayer = {
  userId: string;
  username: string;
  fullName?: string | null;
  avatar: string;
  role?: string;
  stage?: number;
  lastX?: number;
  lastY?: number;
  lastFacing?: number;
  vx?: number;
  vy?: number;
  onGround?: boolean;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  score?: number;
};

type RoomData = {
  hostId: string;
  id: string;
  name: string;
  code: string;
  status: string;
  settings?: { stageCount?: number };
  players: RoomPlayer[];
  level: { id: string; name: string; subject?: string; mapConfig?: string } | null;
};

function resolveTotalStages(room: RoomData | null): number {
  const configured = Number(room?.settings?.stageCount);
  if (Number.isFinite(configured) && configured >= 1) {
    return Math.min(4, Math.max(1, Math.round(configured)));
  }
  return 4;
}

function getStageQuestions<T>(allQuestions: T[], stage: number, totalStages: number): T[] {
  if (totalStages <= 1 || allQuestions.length === 0) return allQuestions;
  const perStage = Math.ceil(allQuestions.length / totalStages);
  const startIdx = Math.max(0, (stage - 1) * perStage);
  return allQuestions.slice(startIdx, startIdx + perStage);
}

function getRoomSubjectTitle(room: RoomData | null): string {
  if (!room) return 'Arena llysSmart';
  if (room.level?.subject?.trim()) return room.level.subject.trim();
  if (room.level?.mapConfig) {
    try {
      const parsed = JSON.parse(room.level.mapConfig);
      if (parsed && typeof parsed.subjectName === 'string' && parsed.subjectName.trim()) {
        return parsed.subjectName.trim();
      }
    } catch {
      // fallback below
    }
  }
  if (room.level?.name) {
    const clean = room.level.name.split(/\s*\(|\s*-/)[0]?.trim();
    if (clean) return clean;
  }
  return room.name?.split(/\s*\(|\s*-/)[0]?.trim() || 'Arena llysSmart';
}

type ChatMsg = {
  seq?: number;
  id: string;
  userId?: string;
  senderName: string;
  senderFullName?: string;
  role?: string;
  text: string;
  createdAt: string;
};

type Question = {
  id: string;
  content: string;
  points: number;
  timeLimit: number;
  options: { label: string; content: string }[];
  correctAnswer?: string;
};

const CHIP_COLORS = ['blue', 'pink', 'green', 'yellow', 'purple'] as const;
const OPTION_DISPLAY_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

function shuffleQuestionOptions(q: Question, seedStr: string): Question {
  const opts = [...(q.options ?? [])];
  if (opts.length <= 1) return q;
  let h = 2166136261 >>> 0;
  const fullSeed = `${seedStr}:${q.id}`;
  for (let i = 0; i < fullSeed.length; i += 1) {
    h ^= fullSeed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  for (let i = opts.length - 1; i > 0; i -= 1) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const j = (h >>> 0) % (i + 1);
    const tmp = opts[i];
    opts[i] = opts[j];
    opts[j] = tmp;
  }
  return { ...q, options: opts };
}

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
  const myRoleRef = useRef('student');
  myRoleRef.current = myRole;
  const isStaff = myRole === 'teacher' || myRole === 'admin';
  const isStaffRole = (r?: string | null) => r === 'teacher' || r === 'admin';
  const [exitNotice, setExitNotice] = useState<'kicked' | 'deleted' | null>(null);
  const exitNoticeRef = useRef<'kicked' | 'deleted' | null>(null);
  const manualLeaveRef = useRef(false);
  const [chatMinimized, setChatMinimized] = useState(true);
  const [leaderboardMinimized, setLeaderboardMinimized] = useState(true);

  const [missionMinimized, setMissionMinimized] = useState(true);
  const [questionMinimized, setQuestionMinimized] = useState(true);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [panelOffsets, setPanelOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const panelDragRef = useRef<{ key: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [rejoinRequests, setRejoinRequests] = useState<{ userId: string; username: string; requestedAt: number }[]>([]);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingControlsLayout, setEditingControlsLayout] = useState(false);
  const [hudControls, setHudControls] = useState<HudControlsConfig>(DEFAULT_HUD_CONTROLS);
  const controlDragRef = useRef<{ group: 'dpad' | 'jump'; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [bgmVolume, setBgmVolume] = useState(0.45);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sfxVolume, setSfxVolume] = useState(0.75);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<string[]>([]);
  const answeredIdsRef = useRef<Set<string>>(new Set());
  const answerResultsRef = useRef<Map<string, boolean | 'assisted'>>(new Map());
  const [correctCount, setCorrectCount] = useState(0);
  const [levelQuestions, setLevelQuestions] = useState<Question[]>([]);
  const levelQuestionsRef = useRef<Question[]>([]);
  const questionBlocksRef = useRef<Platform[]>([]);
  const [currentStage, setCurrentStage] = useState(1);
  const currentStageRef = useRef(1);
  const [totalStages, setTotalStages] = useState(4);
  const totalStagesRef = useRef(4);
  const stagePlatformsRef = useRef<Platform[]>(getStageBasePlatforms(1));
  const stageEnemiesRef = useRef<StageEnemy[]>(createStageEnemies(1));
  const stagePowerUpsRef = useRef<StagePowerUp[]>(createStagePowerUps(1));
  const projectilesRef = useRef<Projectile[]>([]);
  const lastShotAtRef = useRef<number>(0);
  const [ammoCount, setAmmoCount] = useState<number>(0);
  const [isGodMode, setIsGodMode] = useState(false);
  const isGodModeRef = useRef(false);
  const [mirrorTarget, setMirrorTarget] = useState<string | null>(null);
  const mirrorTargetRef = useRef<{ userId: string; username: string } | 'all' | null>(null);
  const [stageBanner, setStageBanner] = useState<string | null>(null);
  const stageBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [question, setQuestion] = useState<Question | null>(null);
  const questionRef = useRef<Question | null>(null);
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctAnswer?: string; explanation?: string; pointsEarned: number } | null>(null);
  const [error, setError] = useState('');
  const bubblesRef = useRef<Map<string, BubbleEntry>>(new Map());
  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  const chatCursorRef = useRef<number>(-1);
  const myUsernameRef = useRef<string>('');
  const myFullNameRef = useRef<string>('');
  const sessionIdRef = useRef<string>('');
  const lastSyncedPosRef = useRef<{ x: number; y: number; facing: number }>({ x: -9999, y: -9999, facing: 1 });
  const hasLeftRef = useRef(false);
  const justKickedInSessionRef = useRef(false);
  const chatMinimizedRef = useRef(chatMinimized);
  const [unreadCount, setUnreadCount] = useState(0);
  const ablyEnabled = true;

  function ingestRemotePlayerSnapshot(rp: {
    id: string;
    username: string;
    fullName?: string;
    avatar: string;
    role?: string;
    stage?: number;
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    facing: 1 | -1;
    onGround?: boolean;
    isDying?: boolean;
    deathStartedAt?: number;
    burnUntil?: number;
  }) {
    if (!rp.id || rp.id === myIdRef.current) return;
    const nowPerf = performance.now();
    const nowWall = Date.now();
    const pvx = typeof rp.vx === 'number' ? rp.vx : 0;
    const pvy = typeof rp.vy === 'number' ? rp.vy : 0;
    const existing = playersRef.current.get(rp.id);
    if (existing) {
      existing.targetX = rp.x;
      existing.targetY = rp.y;
      existing.vx = pvx;
      existing.vy = pvy;
      existing.facing = rp.facing;
      if (rp.fullName) existing.fullName = rp.fullName;
      if (typeof rp.stage === 'number') existing.stage = rp.stage;
      if (typeof rp.onGround === 'boolean') existing.onGround = rp.onGround;
      if (typeof rp.isDying === 'boolean') existing.isDying = rp.isDying;
      if (rp.deathStartedAt !== undefined) existing.deathStartedAt = rp.deathStartedAt;
      if (rp.burnUntil !== undefined) existing.burnUntil = rp.burnUntil;
      if (rp.role) existing.role = rp.role;

      if (!existing.snapshots) existing.snapshots = [];
      const snaps = existing.snapshots;
      const lastSnap = snaps[snaps.length - 1];
      const hasMovedSinceLastSnap =
        !lastSnap ||
        Math.abs(rp.x - lastSnap.x) > 0.08 ||
        Math.abs(rp.y - lastSnap.y) > 0.08 ||
        Math.abs(pvx - lastSnap.vx) > 0.04 ||
        Math.abs(pvy - lastSnap.vy) > 0.04;
      if (hasMovedSinceLastSnap) {
        if (lastSnap) {
          const dt = Math.max(12, Math.min(220, nowPerf - lastSnap.time));
          existing.avgInterval =
            existing.avgInterval !== undefined ? existing.avgInterval * 0.75 + dt * 0.25 : dt;
        }
        snaps.push({ x: rp.x, y: rp.y, vx: pvx, vy: pvy, time: nowPerf });
        if (snaps.length > 10) snaps.splice(0, snaps.length - 10);
      }
      existing.lastPacketAt = nowWall;
    } else {
      const resolvedFullName = rp.fullName || roomRef.current?.players?.find((pl) => pl.userId === rp.id)?.fullName || undefined;
      playersRef.current.set(rp.id, {
        id: rp.id,
        username: rp.username,
        fullName: resolvedFullName,
        avatar: rp.avatar,
        role: rp.role,
        stage: rp.stage ?? 1,
        x: rp.x,
        y: rp.y,
        targetX: rp.x,
        targetY: rp.y,
        vx: pvx,
        vy: pvy,
        facing: rp.facing,
        onGround: rp.onGround ?? true,
        isDying: rp.isDying,
        deathStartedAt: rp.deathStartedAt,
        burnUntil: rp.burnUntil,
        avgInterval: 24,
        snapshots: [{ x: rp.x, y: rp.y, vx: pvx, vy: pvy, time: nowPerf }],
        lastPacketAt: nowWall,
      });
    }
  }

  function triggerForcedExit(reason: 'kicked' | 'deleted') {
    if (manualLeaveRef.current) return;
    if (exitNoticeRef.current === 'deleted' || exitNoticeRef.current === reason) return;
    if (reason === 'kicked' && isStaffRole(myRoleRef.current)) return;
    exitNoticeRef.current = reason;
    hasLeftRef.current = true;
    keysRef.current.left = false;
    keysRef.current.right = false;
    keysRef.current.jump = false;
    questionRef.current = null;
    setQuestion(null);
    setFeedback(null);
    const me = playersRef.current.get(myIdRef.current);
    if (me) {
      me.vx = 0;
      me.vy = 0;
    }
    setExitNotice(reason);
  }

  function applyStage(
    nextStage: number,
    opts?: {
      respawnPlayer?: boolean;
      showToast?: boolean;
      seedId?: string;
      allQuestions?: Question[];
      totalStg?: number;
      persistCheckpoint?: boolean;
    },
  ) {
    const tStg = opts?.totalStg ?? totalStagesRef.current;
    const stg = Math.max(1, Math.min(tStg, nextStage));

    // Siswa tidak dapat melompati stage tanpa menyelesaikan soal stage sebelumnya
    if (!isStaff && stg > currentStageRef.current) {
      const allQsForCheck = opts?.allQuestions ?? levelQuestionsRef.current;
      const curStageQs = getStageQuestions(allQsForCheck, currentStageRef.current, tStg);
      const isCleared = curStageQs.length > 0 && curStageQs.every((q) => answeredIdsRef.current.has(q.id));
      if (!isCleared) {
        return;
      }
    }

    currentStageRef.current = stg;
    setCurrentStage(stg);
    stagePlatformsRef.current = getStageBasePlatforms(stg);
    stageEnemiesRef.current = createStageEnemies(stg);
    stagePowerUpsRef.current = createStagePowerUps(stg);
    projectilesRef.current = [];
    setAmmoCount(0);

    const allQs = opts?.allQuestions ?? levelQuestionsRef.current;
    const stageQs = getStageQuestions(allQs, stg, tStg);
    const uid = opts?.seedId || myIdRef.current || 'anon';
    
    // Default Guru & Admin: kotak soal bersih/hilang total, kecuali sedang mirror!
    if (isStaff && !mirrorTargetRef.current) {
      questionBlocksRef.current = [];
    } else {
      const mirror = mirrorTargetRef.current;
      const seedUserId = mirror && mirror !== 'all' ? mirror.userId : uid;
      questionBlocksRef.current = generateQuestionBlocks(
        stageQs.map((q) => q.id),
        `${seedUserId}:${roomId}:s${stg}`,
        stg,
      );
    }

    if (opts?.persistCheckpoint !== false && uid && roomId) {
      try {
        window.localStorage.setItem(`llys_stage_${roomId}_${uid}`, String(stg));
      } catch {
        // ignore storage error
      }
    }

    const me = playersRef.current.get(myIdRef.current);
    if (me) {
      me.stage = stg;
      if (opts?.respawnPlayer) {
        me.x = me.spawnX ?? 120;
        me.y = me.spawnY ?? 600;
        me.vx = 0;
        me.vy = 0;
        me.onGround = false;
        me.ridingPlatform = null;
        me.isDying = false;
        me.deathStartedAt = undefined;
        me.burnUntil = undefined;
      }
      if (ably.connected) {
        ably.publishPosition({
          id: me.id,
          username: me.username,
          avatar: me.avatar,
          role: myRole,
          stage: stg,
          x: me.x,
          y: me.y,
          vx: me.vx,
          vy: me.vy,
          facing: me.facing,
          onGround: me.onGround,
          isDying: me.isDying,
          deathStartedAt: me.deathStartedAt,
          burnUntil: me.burnUntil,
        });
      }
    }

    if (opts?.showToast) {
      soundEngine.playAnswerCorrect();
      const label =
        stg === 4
          ? `⚡ STAGE 4/${tStg}: Galaksi Cyber — Ambil Power-Up & Tembak Lawan Monster Virus! (${stageQs.length} Soal)`
          : stg === 3
          ? `🔥 STAGE 3/${tStg}: Kastil Magma — Waspada Lahar Panas, Lift Vulkanik & Monster Virus! (${stageQs.length} Soal)`
          : stg === 2
          ? `🌅 STAGE 2/${tStg}: Menara Sunset — Awas Pijakan Rapuh, Lift & Patroli Virus! (${stageQs.length} Soal)`
          : `🏞️ STAGE 1/${tStg}: Lembah Kampus — Jawab Semua Soal untuk Buka Gerbang! (${stageQs.length} Soal)`;
      setStageBanner(label);
      if (stageBannerTimerRef.current) clearTimeout(stageBannerTimerRef.current);
      stageBannerTimerRef.current = setTimeout(() => {
        setStageBanner(null);
      }, 4200);
    }
  }

  function handleRejoinApproved() {
    if (exitNoticeRef.current !== 'kicked') return;
    exitNoticeRef.current = null;
    hasLeftRef.current = false;
    justKickedInSessionRef.current = false;
    setExitNotice(null);
    answeredIdsRef.current.clear();
    answerResultsRef.current.clear();
    setAnsweredQuestionIds([]);
    setCorrectCount(0);
    questionRef.current = null;
    setQuestion(null);
    setFeedback(null);
    if (myIdRef.current) {
      setScores((prev) => ({ ...prev, [myIdRef.current]: 0 }));
      const shuffleSeed = `${myIdRef.current}:${roomId}:${Date.now()}`;
      setLevelQuestions((prev) => {
        const next = prev.map((q) => shuffleQuestionOptions(q, shuffleSeed));
        levelQuestionsRef.current = next;
        applyStage(1, {
          respawnPlayer: true,
          showToast: true,
          seedId: myIdRef.current,
          allQuestions: next,
        });
        return next;
      });
    }
  }

  function applyLiveRoomStatus(nextStatus: string) {
    if (!nextStatus) return;
    if (nextStatus === 'deleted') {
      if (isStaffRole(myRoleRef.current)) {
        manualLeaveRef.current = true;
        hasLeftRef.current = true;
        router.replace('/dashboard/teacher/rooms');
      } else {
        triggerForcedExit('deleted');
      }
      return;
    }
    if (nextStatus === 'completed') {
      manualLeaveRef.current = true;
      hasLeftRef.current = true;
      router.replace(isStaffRole(myRoleRef.current) ? '/dashboard/teacher/rooms' : '/dashboard/student');
      return;
    }
    if (nextStatus === 'paused') {
      keysRef.current.left = false;
      keysRef.current.right = false;
      keysRef.current.jump = false;
      const me = playersRef.current.get(myIdRef.current);
      if (me) {
        me.vx = 0;
        me.vy = 0;
      }
    }
    if (roomRef.current) {
      roomRef.current = { ...roomRef.current, status: nextStatus };
    }
    setRoom((prev) => (prev && prev.status !== nextStatus ? { ...prev, status: nextStatus } : prev));
  }

  const pendingObstacleUploadRef = useRef<ObstacleEvent | null>(null);

  const applyObstacleEvent = useCallback((evt: ObstacleEvent) => {
    const curStg = currentStageRef.current;
    if (evt.stg !== curStg) return;
    if (evt.op === 'crumble') {
      const plat = stagePlatformsRef.current[evt.idx];
      if (plat && plat.type === 'crumble') {
        plat.crumbleStartedAt = evt.at;
      }
    } else if (evt.op === 'stomp') {
      const enemy = stageEnemiesRef.current.find((e) => e.id === evt.id);
      if (enemy) {
        enemy.stompedUntil = Math.max(enemy.stompedUntil ?? 0, evt.until);
      }
    } else if (evt.op === 'powerup') {
      const pu = stagePowerUpsRef.current.find((p) => p.id === evt.id);
      if (pu) {
        pu.collectedUntil = Math.max(pu.collectedUntil ?? 0, evt.until);
      }
    } else if (evt.op === 'shoot') {
      if (projectilesRef.current.some((pr) => pr.id === evt.pid)) return;
      projectilesRef.current.push({
        id: evt.pid,
        x: evt.x,
        y: evt.y,
        vx: evt.vx,
        shooterId: 'remote',
        stage: evt.stg,
        createdAt: Date.now(),
      });
      soundEngine.playShoot();
    }
  }, []);

  const applyIncomingCommand = useCallback((cmd: RoomCommandEvent) => {
    const isTarget = cmd.targetId === 'all' || cmd.targetId === myIdRef.current;
    if (cmd.op === 'god') {
      const targetP = playersRef.current.get(cmd.targetId);
      if (targetP) {
        targetP.isGodMode = cmd.value;
      }
      if (isTarget) {
        isGodModeRef.current = cmd.value;
        setIsGodMode(cmd.value);
        const me = playersRef.current.get(myIdRef.current);
        if (me) me.isGodMode = cmd.value;
        if (cmd.value) {
          soundEngine.playPowerUp();
          setStageBanner('👑 GOD MODE DIAKTIFKAN! Kamu kebal rintangan & infinite power-up.');
        } else {
          setStageBanner('🛡️ God Mode telah dinonaktifkan.');
        }
      }
    } else if (cmd.op === 'teleport') {
      if (isTarget) {
        if (typeof cmd.stage === 'number' && cmd.stage !== currentStageRef.current) {
          applyStage(cmd.stage, { respawnPlayer: true, showToast: true });
        } else if (typeof cmd.x === 'number' && typeof cmd.y === 'number') {
          const me = playersRef.current.get(myIdRef.current);
          if (me) {
            me.x = cmd.x;
            me.y = cmd.y;
            me.vx = 0;
            me.vy = 0;
          }
          soundEngine.playBounce();
          setStageBanner('🌀 Kamu diteleportasikan oleh Guru/Admin!');
        }
      }
    } else if (cmd.op === 'reset') {
      if (isTarget) {
        answeredIdsRef.current.clear();
        answerResultsRef.current.clear();
        setAnsweredQuestionIds([]);
        setCorrectCount(0);
        questionRef.current = null;
        setQuestion(null);
        setQuestionMinimized(false);
        setSelected('');
        if (myIdRef.current) {
          setScores((prev) => ({ ...prev, [myIdRef.current]: 0 }));
          try {
            window.localStorage.setItem(`llys_stage_${roomId}_${myIdRef.current}`, '1');
          } catch {}
        }
        applyStage(1, { respawnPlayer: true, showToast: true });
        soundEngine.playDeath();
        setStageBanner('🔄 Jawaban & Progres kamu telah di-reset ke Stage 1 oleh Guru/Admin.');
      }
      if (isStaff && mirrorTargetRef.current) {
        const curM = mirrorTargetRef.current;
        if (cmd.targetId === 'all' || (curM !== 'all' && curM.userId === cmd.targetId)) {
          answerResultsRef.current.clear();
          const curStg = currentStageRef.current;
          const stageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
          const seedUserId = curM !== 'all' ? curM.userId : (myIdRef.current || 'anon');
          questionBlocksRef.current = generateQuestionBlocks(
            stageQs.map((q) => q.id),
            `${seedUserId}:${roomId}:s${curStg}`,
            curStg,
          );
        }
      }
    } else if (cmd.op === 'assist_answer') {
      if (isTarget) {
        answeredIdsRef.current.add(cmd.qid);
        answerResultsRef.current.set(cmd.qid, 'assisted');
        setAnsweredQuestionIds(Array.from(answeredIdsRef.current));
        setCorrectCount(answeredIdsRef.current.size);
        soundEngine.playAnswerCorrect();
        setStageBanner('🌟 Soal telah dibantu dijawab oleh Guru/Admin! (+0 Poin, Misi Tercatat)');
      }
    }
  }, [applyStage]);

  const ably = useAblyRoom(roomId, ablyEnabled, {
    onDirectMove: (rp) => {
      ingestRemotePlayerSnapshot(rp);
    },
    onDirectLeave: (uid, kicked) => {
      if (uid === myIdRef.current || uid === 'me') {
        if (kicked && !manualLeaveRef.current && !isStaffRole(myRoleRef.current)) {
          justKickedInSessionRef.current = true;
          triggerForcedExit('kicked');
        }
        return;
      }
      playersRef.current.delete(uid);
      setRoom((prev) => (prev ? { ...prev, players: prev.players.filter((pl) => pl.userId !== uid) } : prev));
    },
    onObstacleEvent: applyObstacleEvent,
    onCommandEvent: applyIncomingCommand,
  });

  const fireLaser = useCallback(() => {
    const me = playersRef.current.get(myIdRef.current);
    if (!me || exitNoticeRef.current || roomRef.current?.status === 'paused') return;
    const now = Date.now();
    const ammo = me.blasterAmmo ?? 0;
    const until = me.blasterUntil ?? 0;
    if (ammo <= 0 || until <= now) {
      return;
    }
    if (now - lastShotAtRef.current < 160) {
      return;
    }
    lastShotAtRef.current = now;
    me.blasterAmmo = ammo - 1;
    setAmmoCount(me.blasterAmmo);
    soundEngine.playShoot();

    const facing = me.facing ?? 1;
    const projId = `proj_${myIdRef.current}_${now}`;
    const pX = facing === 1 ? me.x + 36 : me.x;
    const pY = me.y + 20;
    const pVx = facing * 14;
    const curStg = currentStageRef.current;

    const proj: Projectile = {
      id: projId,
      x: pX,
      y: pY,
      vx: pVx,
      shooterId: myIdRef.current,
      stage: curStg,
      createdAt: now,
    };
    projectilesRef.current.push(proj);

    const shootEvt = {
      op: 'shoot' as const,
      stg: curStg,
      pid: projId,
      x: pX,
      y: pY,
      vx: pVx,
    };
    ably.publishObstacle(shootEvt);
    pendingObstacleUploadRef.current = shootEvt;
  }, [ably]);

  function notifyLeaveRoom() {
    if (hasLeftRef.current || exitNoticeRef.current || !roomId) return;
    hasLeftRef.current = true;
    const payload = JSON.stringify({ roomId });
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon('/api/game/leave', blob)) return;
      }
    } catch {
      // fallback to keepalive fetch
    }
    fetch('/api/game/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }

  function handleSessionReplaced() {
    manualLeaveRef.current = true;
    hasLeftRef.current = true;
    clearCachedData();
    window.location.replace('/login?reason=session_replaced');
  }

  function handleLeaveGame() {
    manualLeaveRef.current = true;
    notifyLeaveRoom();
    router.push(isStaff ? '/dashboard/teacher/rooms' : '/dashboard/student');
  }

  useEffect(() => {
    hasLeftRef.current = false;
    manualLeaveRef.current = false;
    const onUnload = () => notifyLeaveRoom();
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [roomId]);

  useEffect(() => {
    chatMinimizedRef.current = chatMinimized;
    if (!chatMinimized) {
      setUnreadCount(0);
    }
  }, [chatMinimized]);

  useEffect(() => {
    setBgmEnabled(soundEngine.bgmEnabled);
    setBgmVolume(soundEngine.bgmVolume);
    setSfxEnabled(soundEngine.sfxEnabled);
    setSfxVolume(soundEngine.sfxVolume);

    try {
      const raw = window.localStorage.getItem(HUD_CONTROLS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<HudControlsConfig>;
        setHudControls((prev) => ({
          size: typeof parsed.size === 'number' ? Math.max(64, Math.min(128, parsed.size)) : prev.size,
          gap: typeof parsed.gap === 'number' ? Math.max(8, Math.min(44, parsed.gap)) : prev.gap,
          opacity: typeof parsed.opacity === 'number' ? Math.max(0.35, Math.min(1, parsed.opacity)) : prev.opacity,
          swapSides: typeof parsed.swapSides === 'boolean' ? parsed.swapSides : prev.swapSides,
          dpadX: typeof parsed.dpadX === 'number' ? parsed.dpadX : prev.dpadX,
          dpadY: typeof parsed.dpadY === 'number' ? parsed.dpadY : prev.dpadY,
          jumpX: typeof parsed.jumpX === 'number' ? parsed.jumpX : prev.jumpX,
          jumpY: typeof parsed.jumpY === 'number' ? parsed.jumpY : prev.jumpY,
        }));
      }
    } catch {
      // ignore storage read error
    }

    const unlockAudio = () => {
      soundEngine.unlockAndStartBgm();
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      soundEngine.stopBgm();
    };
  }, []);

  function updateHudControls(patch: Partial<HudControlsConfig>) {
    setHudControls((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(HUD_CONTROLS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage error
      }
      return next;
    });
  }

  function resetHudControls() {
    soundEngine.playClick();
    setHudControls(DEFAULT_HUD_CONTROLS);
    try {
      window.localStorage.setItem(HUD_CONTROLS_STORAGE_KEY, JSON.stringify(DEFAULT_HUD_CONTROLS));
    } catch {
      // ignore
    }
  }

  function ingestMessages(incoming: ChatMsg[]) {
    if (!incoming || incoming.length === 0) return;
    const newMsgs: ChatMsg[] = [];
    let unreadAdded = 0;

    for (const m of incoming) {
      if (!m || !m.id || seenMsgIdsRef.current.has(m.id)) continue;
      seenMsgIdsRef.current.add(m.id);
      newMsgs.push(m);

      const player =
        (m.userId ? playersRef.current.get(m.userId) : undefined) ??
        Array.from(playersRef.current.values()).find((pl) => pl.username === m.senderName);
      if (player) {
        bubblesRef.current.set(player.id, { text: m.text, at: Date.now() });
      }

      const isMe =
        (Boolean(m.userId) && m.userId === myIdRef.current) ||
        (Boolean(myUsernameRef.current) && m.senderName === myUsernameRef.current);
      if (chatMinimizedRef.current && !isMe) {
        unreadAdded += 1;
      }
    }

    if (newMsgs.length > 0) {
      setChat((prev) => [...prev.slice(-49), ...newMsgs]);
    }
    if (unreadAdded > 0) {
      setUnreadCount((prev) => prev + unreadAdded);
    }
  }

  useEffect(() => {
    let cancelled = false;
    chatCursorRef.current = -1;
    seenMsgIdsRef.current.clear();
    setChat([]);
    setUnreadCount(0);

    async function init() {
      const res = await fetch('/api/rooms/' + roomId + '?bootstrap=1');
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        if (res.status === 404) {
          triggerForcedExit('deleted');
          return;
        }
        setError('Ruang tidak ditemukan');
        return;
      }
      const data = await res.json();
      if (cancelled) return;

      const p = data.profile;
      const r: RoomData = data.room;
      myIdRef.current = p.id;
      myUsernameRef.current = p.username;
      myRoleRef.current = p.role;
      setMyRole(p.role);

      if (Array.isArray(data.rejoinRequests)) {
        setRejoinRequests(data.rejoinRequests);
      }

      if (typeof data.sessionId === 'string' && data.sessionId) {
        sessionIdRef.current = data.sessionId;
      }
      if (typeof data.chatCursor === 'number' && data.chatCursor > chatCursorRef.current) {
        chatCursorRef.current = data.chatCursor;
      }
      if (!data.kicked) {
        if (data.answerResults && typeof data.answerResults === 'object') {
          for (const [qid, okAns] of Object.entries(data.answerResults as Record<string, boolean>)) {
            answerResultsRef.current.set(qid, Boolean(okAns));
          }
        }
        if (Array.isArray(data.answeredQuestionIds)) {
          for (const qid of data.answeredQuestionIds) answeredIdsRef.current.add(qid);
          const list = Array.from(answeredIdsRef.current);
          setAnsweredQuestionIds(list);
          setCorrectCount(list.length);
        }
      }

      if (r.status === 'completed' || (!isStaffRole(p.role) && r.status !== 'in_progress' && r.status !== 'paused')) {
        router.replace(isStaffRole(p.role) ? '/dashboard/teacher/rooms' : '/dashboard/student');
        return;
      }

      setRoom(r);
      roomRef.current = r;
      const myEntry = (r.players ?? []).find((pl: RoomPlayer) => pl.userId === p.id);
      myFullNameRef.current = p.fullName || myEntry?.fullName || '';

      for (const pl of r.players ?? []) {
        const isMe = pl.userId === p.id;
        if (!playersRef.current.has(pl.userId)) {
          const spawn = SPAWN_POINTS[playersRef.current.size % SPAWN_POINTS.length];
          const px = pl.lastX ?? spawn.x;
          const py = pl.lastY ?? spawn.y;
          playersRef.current.set(pl.userId, {
            id: pl.userId,
            username: pl.username,
            fullName: pl.fullName || undefined,
            avatar: pl.avatar,
            role: isMe ? p.role : pl.role,
            stage: pl.stage ?? 1,
            x: px,
            y: py,
            spawnX: spawn.x,
            spawnY: spawn.y,
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
          fullName: p.fullName || myEntry?.fullName || undefined,
          avatar: p.avatar,
          role: p.role,
          stage: myEntry?.stage ?? 1,
          x: myEntry?.lastX ?? spawn.x,
          y: myEntry?.lastY ?? spawn.y,
          spawnX: spawn.x,
          spawnY: spawn.y,
          vx: 0,
          vy: 0,
          facing: (myEntry?.lastFacing as 1 | -1) ?? 1,
          onGround: false,
        });
      }

      const rawQs: Question[] = data.questions ?? [];
      const shuffleSeed = `${p.id}:${roomId}:${Date.now()}`;
      const qs: Question[] = rawQs.map((q) => shuffleQuestionOptions(q, shuffleSeed));
      setLevelQuestions(qs);
      levelQuestionsRef.current = qs;

      const tStg = resolveTotalStages(r);
      totalStagesRef.current = tStg;
      setTotalStages(tStg);

      let initialStage = 1;
      try {
        const savedStage = Number(window.localStorage.getItem(`llys_stage_${roomId}_${p.id}`));
        if (Number.isFinite(savedStage) && savedStage >= 1 && savedStage <= tStg) {
          initialStage = savedStage;
        }
      } catch {
        // ignore storage read error
      }
      if (tStg > 1 && qs.length > 0 && answeredIdsRef.current.size > 0) {
        const s1Qs = getStageQuestions(qs, 1, tStg);
        const s1Cleared = s1Qs.length > 0 && s1Qs.every((q) => answeredIdsRef.current.has(q.id));
        if (s1Cleared && initialStage < 2) {
          initialStage = 2;
        }
      }

      applyStage(initialStage, {
        respawnPlayer: false,
        showToast: false,
        seedId: p.id,
        allQuestions: qs,
        totalStg: tStg,
      });

      const meInit = playersRef.current.get(p.id);
      if (meInit && !data.kicked) {
        meInit.stage = initialStage;
        ably.publishPosition({
          id: meInit.id,
          username: meInit.username,
          avatar: meInit.avatar,
          role: p.role,
          stage: initialStage,
          x: meInit.x,
          y: meInit.y,
          vx: 0,
          vy: 0,
          facing: meInit.facing,
          onGround: meInit.onGround,
        });
      }

      if (data.kicked && !isStaffRole(p.role)) {
        triggerForcedExit('kicked');
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [roomId, router]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const manualExitFsRef = useRef(false);

  function getFullscreenElement(): Element | null {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  }

  async function requestElementFullscreen(el: HTMLElement | null): Promise<boolean> {
    if (!el) return false;
    const anyEl = el as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    try {
      if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen({ navigationUI: 'hide' });
        return true;
      }
      if (typeof anyEl.webkitRequestFullscreen === 'function') {
        await anyEl.webkitRequestFullscreen();
        return true;
      }
    } catch {
      // ignore and allow fallback
    }
    return false;
  }

  async function enterFullscreen() {
    if (getFullscreenElement()) return;
    const okMain = await requestElementFullscreen(mainRef.current);
    if (!okMain) {
      await requestElementFullscreen(document.documentElement);
    }
    try {
      const scr = screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } };
      await scr.orientation?.lock?.('landscape');
    } catch {
      // orientation lock optional
    }
  }

  useEffect(() => {
    function onFsChange() {
      const active = Boolean(getFullscreenElement());
      setIsFullscreen(active);
      window.dispatchEvent(new Event('resize'));
    }
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    function onFirstTouch() {
      if (manualExitFsRef.current) return;
      if (window.matchMedia('(pointer: coarse)').matches && !getFullscreenElement()) {
        void enterFullscreen();
      }
    }
    el.addEventListener('pointerdown', onFirstTouch, { passive: true });
    return () => el.removeEventListener('pointerdown', onFirstTouch);
  }, []);

  async function toggleFullscreen() {
    try {
      if (getFullscreenElement()) {
        manualExitFsRef.current = true;
        const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
        if (typeof document.exitFullscreen === 'function') {
          await document.exitFullscreen();
        } else if (typeof doc.webkitExitFullscreen === 'function') {
          await doc.webkitExitFullscreen();
        }
      } else {
        manualExitFsRef.current = false;
        await enterFullscreen();
      }
    } catch {
      // iOS Safari tidak mendukung requestFullscreen pada elemen; abaikan
    }
  }

  useEffect(() => {
    function blockContext(e: Event) {
      e.preventDefault();
    }
    const el = mainRef.current;
    el?.addEventListener('contextmenu', blockContext);
    return () => el?.removeEventListener('contextmenu', blockContext);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPos = body.style.position;
    const prevBodyInset = body.style.inset;
    const prevBodyWidth = body.style.width;
    const prevBodyHeight = body.style.height;
    const prevBodyBg = body.style.backgroundColor;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.inset = '0';
    body.style.width = '100%';
    body.style.height = '100%';
    body.style.backgroundColor = '#1e2d42';

    let lockedH = window.innerHeight;

    function isInputFocused() {
      const a = document.activeElement as HTMLElement | null;
      return Boolean(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
    }

    function syncViewportLock() {
      const el = mainRef.current;
      if (!el) return;

      if (!isInputFocused() || window.innerHeight > lockedH) {
        lockedH = window.innerHeight;
      }

      el.style.height = `${lockedH}px`;
    }

    function onOrientationChange() {
      setTimeout(() => {
        lockedH = window.innerHeight;
        syncViewportLock();
      }, 150);
    }

    syncViewportLock();
    window.addEventListener('resize', syncViewportLock);
    window.addEventListener('scroll', syncViewportLock, { passive: true });
    window.addEventListener('orientationchange', onOrientationChange);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', syncViewportLock);
    vv?.addEventListener('scroll', syncViewportLock);

    return () => {
      window.removeEventListener('resize', syncViewportLock);
      window.removeEventListener('scroll', syncViewportLock);
      window.removeEventListener('orientationchange', onOrientationChange);
      vv?.removeEventListener('resize', syncViewportLock);
      vv?.removeEventListener('scroll', syncViewportLock);

      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPos;
      body.style.inset = prevBodyInset;
      body.style.width = prevBodyWidth;
      body.style.height = prevBodyHeight;
      body.style.backgroundColor = prevBodyBg;
    };
  }, []);

  useEffect(() => {
    for (const rp of ably.presencePlayers) {
      if (rp.id === myIdRef.current) continue;
      const existing = playersRef.current.get(rp.id);
      if (existing) {
        existing.targetX = rp.x;
        existing.targetY = rp.y;
        existing.facing = rp.facing;
        if ((rp as any).fullName) existing.fullName = (rp as any).fullName;
        if (typeof rp.stage === 'number') existing.stage = rp.stage;
        if (rp.role) existing.role = rp.role;
      } else {
        const resolvedFullName = (rp as any).fullName || roomRef.current?.players?.find((pl) => pl.userId === rp.id)?.fullName || undefined;
        playersRef.current.set(rp.id, {
          id: rp.id,
          username: rp.username,
          fullName: resolvedFullName,
          avatar: rp.avatar,
          role: rp.role,
          stage: rp.stage ?? 1,
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
      if (exitNoticeRef.current || (roomRef.current?.status === 'paused' && !isStaffRole(myRoleRef.current))) {
        keysRef.current.left = false;
        keysRef.current.right = false;
        keysRef.current.jump = false;
        return;
      }
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
      if (['f', 'F', 'x', 'X', 'e', 'E', 'j', 'J'].includes(e.key) && down) {
        fireLaser();
      }
      if (e.key === '/' && down) {
        if (!isStaffRole(myRoleRef.current)) return;
        e.preventDefault();
        keysRef.current.left = false;
        keysRef.current.right = false;
        keysRef.current.jump = false;
        setPanelsHidden(false);
        setChatMinimized(false);
        chatMinimizedRef.current = false;
        setChatInput('/');
        setTimeout(() => {
          const inputEl = document.getElementById('mp-chat-input') as HTMLInputElement | null;
          if (inputEl) {
            inputEl.focus();
            inputEl.setSelectionRange(1, 1);
          }
        }, 30);
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
  }, [fireLaser]);

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
    const ro = typeof ResizeObserver !== 'undefined' && canvas.parentElement
      ? new ResizeObserver(() => resize())
      : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);

    const camera = new Camera(canvas.width, canvas.height);
    cameraRef.current = camera;

    let raf = 0;
    let tick = 0;
    let prevSentX = -1;
    let prevSentY = -1;
    let prevSentVx = 0;
    let prevSentVy = 0;
    let prevSentFacing = 0;
    let prevSentDying = false;
    let lastFrameTime = performance.now();

    function loop(now = performance.now()) {
      if (!ctx || !canvas) return;
      const elapsedMs = now - lastFrameTime;
      lastFrameTime = now;
      // Normalisasi delta-time ke basis 60 FPS (16.6667ms) supaya layar Android 90Hz/120Hz/144Hz
      // punya kecepatan jalan & lompat yang persis sama dengan iOS dan PC 60Hz
      const dtScale = elapsedMs > 0 ? Math.min(2.5, Math.max(0.1, elapsedMs / (1000 / 60))) : 1;
      const camLerp = 1 - Math.pow(1 - 0.12, dtScale);
      tick += 1;

      const me = playersRef.current.get(myIdRef.current);

      for (const p of playersRef.current.values()) {
        if (p.id === myIdRef.current) continue;
        // Adaptive Mobile Legends Snapshot Buffer Interpolation:
        // - Untuk peer LAN (WebSocket ~16-25ms): interpDelay super rendah (~20ms) -> instan & 60/120 FPS mulus
        // - Untuk peer luar LAN (HTTP Single-Flight ~70-130ms): interpDelay otomatis menyesuaikan (~90-150ms) -> tetap mulus tanpa patah-patah
        let desiredX = p.targetX ?? p.x;
        let desiredY = p.targetY ?? p.y;

        const snaps = p.snapshots;
        if (snaps && snaps.length >= 2 && !p.isDying) {
          const avgInt = p.avgInterval ?? 24;
          const interpDelay = Math.max(18, Math.min(180, avgInt * 1.18));
          const renderTime = now - interpDelay;

          while (snaps.length > 2 && snaps[1].time <= renderTime) {
            snaps.shift();
          }

          const s0 = snaps[0];
          const s1 = snaps[1];
          if (renderTime <= s0.time) {
            desiredX = s0.x;
            desiredY = s0.y;
          } else if (renderTime <= s1.time) {
            const span = Math.max(1, s1.time - s0.time);
            const alpha = Math.max(0, Math.min(1, (renderTime - s0.time) / span));
            desiredX = s0.x + (s1.x - s0.x) * alpha;
            desiredY = s0.y + (s1.y - s0.y) * alpha;
          } else {
            const latest = snaps[snaps.length - 1];
            const overMs = Math.min(55, renderTime - latest.time);
            const overFrames = overMs / (1000 / 60);
            desiredX = Math.max(0, Math.min(WORLD.width - PLAYER_W, latest.x + latest.vx * overFrames * 0.7));
            desiredY = Math.min(WORLD.groundY - PLAYER_H, latest.y + latest.vy * overFrames * 0.7);
          }
        }

        const dx = desiredX - p.x;
        if (Math.abs(dx) > 450) {
          p.x = desiredX;
        } else if (Math.abs(dx) <= 0.15) {
          p.x = desiredX;
        } else {
          const smoothX = 1 - Math.pow(1 - 0.45, dtScale);
          p.x += dx * smoothX;
        }

        const dy = desiredY - p.y;
        if (Math.abs(dy) > 450) {
          p.y = desiredY;
        } else if (Math.abs(dy) <= 0.15) {
          p.y = desiredY;
        } else {
          const smoothY = 1 - Math.pow(1 - 0.48, dtScale);
          p.y += dy * smoothY;
        }
        for (const plat of stagePlatformsRef.current) {
          if (
            plat.type === 'fire' &&
            p.x + PLAYER_W > plat.x &&
            p.x < plat.x + plat.w &&
            p.y + PLAYER_H > plat.y &&
            p.y < plat.y + plat.h
          ) {
            p.burnUntil = Date.now() + 5000;
            break;
          }
        }
      }

      const syncedNow = ably.getSyncedServerTime();
      updateStageEntities(
        stagePlatformsRef.current,
        stageEnemiesRef.current,
        dtScale,
        syncedNow,
        stagePowerUpsRef.current,
        projectilesRef.current,
        (projId, enemyId) => {
          soundEngine.playZap();
          const curStg = currentStageRef.current;
          const stompEvt = {
            op: 'stomp' as const,
            stg: curStg,
            id: enemyId,
            until: Date.now() + 9000,
          };
          applyObstacleEvent(stompEvt);
          ably.publishObstacle(stompEvt);
          pendingObstacleUploadRef.current = stompEvt;
        },
      );

      const curStage = currentStageRef.current;
      const tStages = totalStagesRef.current;
      const curStageQs = getStageQuestions(levelQuestionsRef.current, curStage, tStages);
      const stageTotal = curStageQs.length;
      let stageAnswered = 0;
      for (const sq of curStageQs) {
        if (answeredIdsRef.current.has(sq.id)) stageAnswered += 1;
      }
      const isGateUnlocked = isStaff || (stageTotal > 0 && stageAnswered >= stageTotal);

      const dynBlocks: Platform[] = questionBlocksRef.current.map((b) => {
        const qid = b.questionId ?? '';
        const res = answerResultsRef.current.get(qid);
        const type = res === 'assisted' ? 'qblock-assisted' : res === true ? 'qblock-correct' : res === false ? 'qblock-wrong' : 'qblock';
        return { ...b, type };
      });

      const isStudentPaused = room?.status === 'paused' && !isStaff;
      const isQuestionModalBusy = !isStaff && Boolean(questionRef.current && !answeredIdsRef.current.has(questionRef.current.id));
      if (isQuestionModalBusy) {
        keysRef.current.left = false;
        keysRef.current.right = false;
        keysRef.current.jump = false;
      }
      if (
        me &&
        !exitNoticeRef.current &&
        !isStudentPaused &&
        (isStaff || room?.status === 'in_progress' || room?.status === 'waiting')
      ) {
        updatePlayerPhysics(
          me,
          isQuestionModalBusy ? { left: false, right: false, jump: false } : keysRef.current,
          playersRef.current.values(),
          dynBlocks,
          (qid) => {
            if (!isStaff) {
              if (answeredIdsRef.current.has(qid)) return;
              if (questionRef.current && !answeredIdsRef.current.has(questionRef.current.id)) {
                setQuestionMinimized(false);
                return;
              }
              const found = levelQuestionsRef.current.find((q) => q.id === qid);
              if (found) {
                keysRef.current.left = false;
                keysRef.current.right = false;
                keysRef.current.jump = false;
                me.vx = 0;
                soundEngine.playQuestionOpen();
                questionRef.current = found;
                setQuestion(found);
                setQuestionMinimized(false);
                setSelected('');
              }
            } else if (mirrorTargetRef.current) {
              const res = answerResultsRef.current.get(qid);
              if (res === true || res === 'assisted') return;
              const found = levelQuestionsRef.current.find((q) => q.id === qid);
              if (found) {
                keysRef.current.left = false;
                keysRef.current.right = false;
                keysRef.current.jump = false;
                me.vx = 0;
                soundEngine.playQuestionOpen();
                questionRef.current = found;
                setQuestion(found);
                setQuestionMinimized(false);
                setSelected('');
              }
            }
          },
          dtScale,
          (soundEvt) => {
            if (isQuestionModalBusy) return;
            if (soundEvt === 'jump') soundEngine.playJump();
            else if (soundEvt === 'bounce') soundEngine.playBounce();
            else if (soundEvt === 'burn') soundEngine.playBurn();
            else if (soundEvt === 'death') soundEngine.playDeath();
          },
          {
            basePlatforms: stagePlatformsRef.current,
            enemies: stageEnemiesRef.current,
            powerUps: stagePowerUpsRef.current,
            isGateUnlocked,
            isStaff,
            onObstacleEvent: (evt) => {
              applyObstacleEvent(evt);
              ably.publishObstacle(evt);
              pendingObstacleUploadRef.current = evt;
            },
            onCollectPowerUp: () => {
              soundEngine.playPowerUp();
              setAmmoCount(10);
            },
            onEnterGate: () => {
              if (currentStageRef.current < totalStagesRef.current) {
                applyStage(currentStageRef.current + 1, {
                  respawnPlayer: true,
                  showToast: true,
                });
              }
            },
          },
        );
      }

      // Jalur 1 (WebSocket Port 3000 /ws-game atau Port 3001):
      // - Adaptif tick rate: 60Hz (16ms) di LAN, 42Hz (24ms) di luar jaringan agar bebas TCP bufferbloat
      // - Mengirim 1 paket "berhenti" terakhir saat vx=0 & vy=0 agar interpolasi player lain berhenti presisi
      if (me && ably.connected) {
        const nowMs = Date.now();
        const isMovingNow = Math.abs(me.vx) > 0.04 || Math.abs(me.vy) > 0.04;
        const wasMovingPrev = Math.abs(prevSentVx) > 0.04 || Math.abs(prevSentVy) > 0.04;
        const justStopped = !isMovingNow && wasMovingPrev;
        const moved =
          justStopped ||
          Math.abs(me.x - prevSentX) > 0.25 ||
          Math.abs(me.y - prevSentY) > 0.25 ||
          Math.abs(me.vx - prevSentVx) > 0.08 ||
          Math.abs(me.vy - prevSentVy) > 0.08 ||
          me.facing !== prevSentFacing ||
          Boolean(me.isDying) !== prevSentDying;
        const minSendInterval = justStopped ? 0 : ably.pingMs > 25 ? 24 : 16;
        if (moved && nowMs - lastSentRef.current >= minSendInterval) {
          lastSentRef.current = nowMs;
          prevSentX = me.x;
          prevSentY = me.y;
          prevSentVx = isMovingNow ? me.vx : 0;
          prevSentVy = isMovingNow ? me.vy : 0;
          prevSentFacing = me.facing;
          prevSentDying = Boolean(me.isDying);
          ably.publishPosition({
            id: me.id,
            username: me.username,
            avatar: me.avatar,
            role: myRole,
            stage: curStage,
            x: me.x,
            y: me.y,
            vx: isMovingNow ? me.vx : 0,
            vy: isMovingNow ? me.vy : 0,
            facing: me.facing,
            onGround: me.onGround,
            isDying: me.isDying,
            deathStartedAt: me.deathStartedAt,
            burnUntil: me.burnUntil,
          });
        }
      }

      camera.follow(me ? me.x + PLAYER_W / 2 : WORLD.width / 2, me ? me.y : WORLD.height / 2, camLerp);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      camera.applyTransform(ctx);

      drawWorld(ctx, {
        stage: curStage,
        totalStages: tStages,
        stageAnswered,
        stageTotal,
        isGateUnlocked,
      });
      drawPlatforms(ctx, [...stagePlatformsRef.current, ...dynBlocks], curStage);
      drawEnemies(ctx, stageEnemiesRef.current, syncedNow);
      drawPowerUps(ctx, stagePowerUpsRef.current, syncedNow);
      drawProjectiles(ctx, projectilesRef.current, syncedNow);

      for (const p of playersRef.current.values()) {
        const pStage = p.stage ?? 1;
        if (pStage !== curStage) continue;

        const role = p.id === myIdRef.current ? myRole : (p.role ?? (room?.hostId === p.id ? 'teacher' : 'student'));
        const displayName = p.fullName?.trim() || p.username;
        drawCat(
          ctx,
          p.x,
          p.y,
          PLAYER_W,
          PLAYER_H,
          p.avatar,
          p.facing,
          displayName,
          role,
          bubblesRef.current.get(p.id) ?? null,
          {
            isDying: p.isDying,
            deathStartedAt: p.deathStartedAt,
            burnUntil: p.burnUntil,
            blasterAmmo: p.blasterAmmo,
            blasterUntil: p.blasterUntil,
            isGodMode: p.isGodMode || (p.id === myIdRef.current && isGodModeRef.current),
          },
        );
      }

      ctx.restore();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ro?.disconnect();
    };
  }, [room?.status, room?.hostId, roomId, myRole, ablyEnabled, ably.connected, ably.publishPosition]);

  // Jalur 2 (Khusus Pemain Luar LAN / Tunnel Port 3000 yang tidak tembus port WebSocket 3001):
  // - HANYA aktif jika WebSocket belum terhubung (!ably.connected), sehingga pemain LAN tidak mengirim HTTP sama sekali
  // - Single-flight: request berikutnya hanya dikirim setelah request sebelumnya selesai (0 antrean / tidak bikin ping pemain lain naik!)
  // - Server /api/pos otomatis mem-broadcast gerakan pemain luar LAN ke semua pemain WebSocket LAN dalam < 0.2ms
  useEffect(() => {
    if (ably.connected) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let lastUploadX = -9999;
    let lastUploadY = -9999;
    let lastUploadVx = 0;
    let lastUploadVy = 0;
    let lastUploadFacing = 1;
    let lastUploadDying = false;
    let lastHeartbeatAt = 0;

    async function posLoop() {
      if (!active || ably.connected) return;
      const tStart = performance.now();
      let didSendMove = false;
      try {
        const me = playersRef.current.get(myIdRef.current);
        if (me && myIdRef.current) {
          const nowMs = Date.now();
          const isMoving = Math.abs(me.vx) > 0.04 || Math.abs(me.vy) > 0.04;
          const wasMoving = Math.abs(lastUploadVx) > 0.04 || Math.abs(lastUploadVy) > 0.04;
          const justStopped = !isMoving && wasMoving;
          const moved =
            justStopped ||
            Math.abs(me.x - lastUploadX) > 0.3 ||
            Math.abs(me.y - lastUploadY) > 0.3 ||
            me.facing !== lastUploadFacing ||
            Boolean(me.isDying) !== lastUploadDying;

          // Saat diam, gunakan SSE push stream untuk menerima gerakan player lain secara real-time,
          // dan hanya kirim heartbeat /api/pos setiap 1400ms agar bandwidth Cloudflare/4G 100% hemat!
          const pendingObs = pendingObstacleUploadRef.current;
          if (pendingObs) pendingObstacleUploadRef.current = null;

          if (moved || pendingObs || nowMs - lastHeartbeatAt >= 1400) {
            didSendMove = moved;
            lastHeartbeatAt = nowMs;
            lastUploadX = me.x;
            lastUploadY = me.y;
            lastUploadVx = isMoving ? me.vx : 0;
            lastUploadVy = isMoving ? me.vy : 0;
            lastUploadFacing = me.facing;
            lastUploadDying = Boolean(me.isDying);

            const postPayload: Record<string, unknown> = moved
              ? {
                  r: roomId,
                  u: me.id,
                  un: me.username,
                  fn: myFullNameRef.current || me.fullName || undefined,
                  av: me.avatar,
                  rl: myRole,
                  stg: currentStageRef.current,
                  x: Math.round(me.x * 10) / 10,
                  y: Math.round(me.y * 10) / 10,
                  vx: isMoving ? Math.round(me.vx * 100) / 100 : 0,
                  vy: isMoving ? Math.round(me.vy * 100) / 100 : 0,
                  f: me.facing,
                  g: me.onGround ? 1 : 0,
                  d: me.isDying ? 1 : 0,
                  ds: me.deathStartedAt,
                  b: me.burnUntil,
                }
              : {
                  r: roomId,
                  u: me.id,
                };
            if (pendingObs) {
              postPayload.obstacle = pendingObs;
            }

            const res = await fetch('/api/pos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(postPayload),
            });
            if (res.ok && active) {
              const rtt = Math.max(1, Math.round((performance.now() - tStart) * 0.42));
              ably.setPingMs((prev) => (prev <= 5 ? rtt : Math.round(prev * 0.6 + rtt * 0.4)));
              const data = await res.json();
              if (typeof data.st === 'number') {
                ably.setServerTimeOffset(Math.round(data.st + rtt / 2 - Date.now()));
              }
              if (data.obstacles && typeof data.obstacles === 'object') {
                const obs = data.obstacles as {
                  crumbles?: { stage: number; idx: number; startedAt: number }[];
                  stomps?: { stage: number; id: string; until: number }[];
                  powerups?: { stage: number; id: string; until: number }[];
                };
                if (Array.isArray(obs.crumbles)) {
                  for (const c of obs.crumbles) {
                    applyObstacleEvent({ op: 'crumble', stg: c.stage, idx: c.idx, at: c.startedAt });
                  }
                }
                if (Array.isArray(obs.stomps)) {
                  for (const s of obs.stomps) {
                    applyObstacleEvent({ op: 'stomp', stg: s.stage, id: s.id, until: s.until });
                  }
                }
                if (Array.isArray(obs.powerups)) {
                  for (const pu of obs.powerups) {
                    applyObstacleEvent({ op: 'powerup', stg: pu.stage, id: pu.id, until: pu.until });
                  }
                }
              }
              if (data.roomDeleted || data.rs === 'deleted') {
                active = false;
                applyLiveRoomStatus('deleted');
                return;
              }
              if (data.kicked && !isStaffRole(myRoleRef.current)) {
                triggerForcedExit('kicked');
                return;
              }
              if (!data.kicked && exitNoticeRef.current === 'kicked') {
                handleRejoinApproved();
              }
              if (typeof data.rs === 'string' && data.rs) {
                applyLiveRoomStatus(data.rs);
              }
              const peers = Array.isArray(data.p) ? data.p : [];
              for (const rp of peers) {
                const uid = typeof rp.u === 'string' ? rp.u : '';
                if (!uid || uid === myIdRef.current) continue;
                ingestRemotePlayerSnapshot({
                  id: uid,
                  username: typeof rp.un === 'string' ? rp.un : 'Player',
                  fullName: typeof rp.fn === 'string' ? rp.fn : undefined,
                  avatar: typeof rp.av === 'string' ? rp.av : 'cat-orange',
                  role: typeof rp.rl === 'string' ? rp.rl : undefined,
                  stage: typeof rp.stg === 'number' ? rp.stg : typeof rp.stage === 'number' ? rp.stage : 1,
                  x: typeof rp.x === 'number' ? rp.x : 120,
                  y: typeof rp.y === 'number' ? rp.y : 600,
                  vx: typeof rp.vx === 'number' ? rp.vx : 0,
                  vy: typeof rp.vy === 'number' ? rp.vy : 0,
                  facing: rp.f === -1 ? -1 : 1,
                  onGround: Boolean(rp.g),
                  isDying: Boolean(rp.d),
                  deathStartedAt: typeof rp.ds === 'number' ? rp.ds : undefined,
                  burnUntil: typeof rp.b === 'number' ? rp.b : undefined,
                });
              }
            }
          }
        }
      } catch {
        // non-fatal
      } finally {
        if (active && !ably.connected) {
          const elapsed = performance.now() - tStart;
          const waitMs = didSendMove ? Math.max(28, Math.round(55 - elapsed)) : 32;
          timer = setTimeout(posLoop, waitMs);
        }
      }
    }

    posLoop();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ably.connected, roomId, myRole]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function syncLoop() {
      if (!active) return;
      try {
        const me = playersRef.current.get(myIdRef.current);
        const payload: Record<string, unknown> = {
          roomId,
          chatCursor: chatCursorRef.current,
          justKicked: justKickedInSessionRef.current,
        };
        // Saat WebSocket sudah terhubung, posisi sudah di-stream real-time & disimpan ke DB oleh ws-hub/pos,
      // sehingga room-sync tidak perlu mengirim duplikat payload koordinat lagi.
      if (me && !ably.connected) {
          const rx = Math.round(me.x * 10) / 10;
          const ry = Math.round(me.y * 10) / 10;
          const prev = lastSyncedPosRef.current;
          if (
            Math.abs(rx - prev.x) > 0.4 ||
            Math.abs(ry - prev.y) > 0.4 ||
            me.facing !== prev.facing ||
            Math.abs(me.vx) > 0.05 ||
            Boolean(me.isDying)
          ) {
            payload.x = rx;
            payload.y = ry;
            payload.vx = Math.round(me.vx * 100) / 100;
            payload.vy = Math.round(me.vy * 100) / 100;
            payload.onGround = me.onGround;
            payload.isDying = Boolean(me.isDying);
            payload.deathStartedAt = me.deathStartedAt;
            payload.burnUntil = me.burnUntil;
            payload.facing = me.facing;
            lastSyncedPosRef.current = { x: rx, y: ry, facing: me.facing };
          }
        }
        const res = await fetch('/api/game/room-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.status === 401) {
          active = false;
          handleSessionReplaced();
          return;
        }
        if (!res.ok || !active) return;
        const data = await res.json();
        if (data.roomDeleted || data.room === null || data.room?.status === 'deleted') {
          active = false;
          applyLiveRoomStatus('deleted');
          return;
        }
        if (data.kicked && !isStaffRole(myRoleRef.current)) {
          triggerForcedExit('kicked');
          return;
        }
        if (!data.kicked && exitNoticeRef.current === 'kicked') {
          handleRejoinApproved();
        }
        if (Array.isArray(data.rejoinRequests)) {
          setRejoinRequests(data.rejoinRequests);
        }

        if (typeof data.sessionId === 'string' && data.sessionId) {
          sessionIdRef.current = data.sessionId;
        }
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
        const nowWall = Date.now();
        for (const p of serverPlayers) {
          if (p.userId === myIdRef.current) continue;
          const existing = playersRef.current.get(p.userId);
          if (existing) {
            // Jangan timpa posisi dari posLoop yang lebih segar (< 1500ms)
            if (nowWall - (existing.lastPacketAt ?? 0) > 1500) {
              if (p.lastX !== undefined) existing.targetX = p.lastX;
              if (p.lastY !== undefined) existing.targetY = p.lastY;
              if (p.lastFacing !== undefined) existing.facing = p.lastFacing as 1 | -1;
            }
            if (p.fullName) existing.fullName = p.fullName;
            if (p.role) existing.role = p.role;
            if (typeof p.stage === 'number') existing.stage = p.stage;
          } else {
            const px = p.lastX ?? 120;
            const py = p.lastY ?? 600;
            playersRef.current.set(p.userId, {
              id: p.userId,
              username: p.username,
              fullName: p.fullName || undefined,
              avatar: p.avatar,
              role: p.role,
              stage: p.stage ?? 1,
              x: px,
              y: py,
              targetX: px,
              targetY: py,
              vx: p.vx ?? 0,
              vy: p.vy ?? 0,
              facing: (p.lastFacing as 1 | -1) ?? 1,
              onGround: p.onGround ?? false,
            });
          }
        }
        if (data.room?.status === 'completed') {
          active = false;
          applyLiveRoomStatus('completed');
          return;
        }
        if (typeof data.room?.status === 'string') {
          applyLiveRoomStatus(data.room.status);
        }
        setRoom((prev) => {
          if (!prev) return prev;
          const statusChanged = data.room?.status && data.room.status !== prev.status;
          const playersChanged =
            prev.players.length !== serverPlayers.length ||
            prev.players.some((pl, idx) => pl.userId !== serverPlayers[idx]?.userId);
          if (!statusChanged && !playersChanged) return prev;
          const updated = {
            ...prev,
            status: data.room?.status ?? prev.status,
            players: serverPlayers,
          };
          roomRef.current = updated;
          return updated;
        });
        if (typeof data.chatCursor === 'number' && data.chatCursor > chatCursorRef.current) {
          chatCursorRef.current = data.chatCursor;
        }
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          ingestMessages(data.messages);
        }
        if (data.answerResults && typeof data.answerResults === 'object') {
          if (Array.isArray(data.answeredQuestionIds) && data.answeredQuestionIds.length === 0) {
            answerResultsRef.current.clear();
          } else {
            for (const [qid, okAns] of Object.entries(data.answerResults as Record<string, boolean>)) {
              answerResultsRef.current.set(qid, Boolean(okAns));
            }
          }
        }
        if (Array.isArray(data.answeredQuestionIds)) {
          if (data.answeredQuestionIds.length === 0) {
            answeredIdsRef.current.clear();
            setAnsweredQuestionIds([]);
            setCorrectCount(0);
          } else {
            for (const qid of data.answeredQuestionIds) answeredIdsRef.current.add(qid);
            setAnsweredQuestionIds((prev) => (prev.length === answeredIdsRef.current.size ? prev : Array.from(answeredIdsRef.current)));
          }
        }
        if (typeof data.correctCount === 'number') {
          setCorrectCount(data.correctCount);
        }
        if (Array.isArray(data.rejoinRequests)) {
          setRejoinRequests(data.rejoinRequests);
        }
      } catch {
        // polling fallback failure is non-fatal
      } finally {
        // Saat WebSocket aktif, semua posisi/chat/skor/soal sudah real-time lewat WS,
        // sehingga room-sync cukup jalan setiap 4 detik sebagai heartbeat ringan (hemat bandwidth luar LAN 7x lipat!)
        const syncInterval = ably.connected ? 4000 : 2500;
        if (active) timer = setTimeout(syncLoop, syncInterval);
      }
    }
    syncLoop();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ably.connected, roomId, levelQuestions]);

  useEffect(() => {
    if (!ably.roomStatusEvent) return;
    applyLiveRoomStatus(ably.roomStatusEvent);
  }, [ably.roomStatusEvent]);

  useEffect(() => {
    if (!ably.rejoinRequestsEvent) return;
    setRejoinRequests(ably.rejoinRequestsEvent);
  }, [ably.rejoinRequestsEvent]);

  useEffect(() => {
    if (!ably.scoreEvent) return;
    setScores((prev) => ({ ...prev, [ably.scoreEvent!.userId]: ably.scoreEvent!.score }));
  }, [ably.scoreEvent]);

  useEffect(() => {
    if (!ably.kickedPlayerId) return;
    if (ably.kickedPlayerId === myIdRef.current || ably.kickedPlayerId === 'me') {
      if (!manualLeaveRef.current && !isStaffRole(myRoleRef.current)) {
        justKickedInSessionRef.current = true;
        triggerForcedExit('kicked');
      }
    } else {
      playersRef.current.delete(ably.kickedPlayerId);
      setRoom((prev) =>
        prev ? { ...prev, players: prev.players.filter((pl) => pl.userId !== ably.kickedPlayerId) } : prev,
      );
    }
  }, [ably.kickedPlayerId]);

  useEffect(() => {
    if (!ably.approvedPlayerId) return;
    if (ably.approvedPlayerId === myIdRef.current || ably.approvedPlayerId === 'me') {
      handleRejoinApproved();
    }
  }, [ably.approvedPlayerId]);

  useEffect(() => {
    if (!chatMinimized) {
      const box = chatBoxRef.current;
      if (box) box.scrollTop = box.scrollHeight;
    }
  }, [chat, chatMinimized]);

  useEffect(() => {
    if (ably.chatMessages.length > 0) {
      ingestMessages(ably.chatMessages as ChatMsg[]);
    }
  }, [ably.chatMessages]);

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = { active: true, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setChatMinimized(true);
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
    if (down) {
      soundEngine.unlockAndStartBgm();
    }
    if (
      editingControlsLayout ||
      exitNoticeRef.current ||
      (roomRef.current?.status === 'paused' && !isStaffRole(myRoleRef.current))
    ) {
      keysRef.current.left = false;
      keysRef.current.right = false;
      keysRef.current.jump = false;
      return;
    }
    keysRef.current[dir] = down;
  }

  function startControlGroupDrag(group: 'dpad' | 'jump', e: React.PointerEvent) {
    if (!editingControlsLayout) return;
    e.preventDefault();
    e.stopPropagation();
    const origX = group === 'dpad' ? hudControls.dpadX : hudControls.jumpX;
    const origY = group === 'dpad' ? hudControls.dpadY : hudControls.jumpY;
    controlDragRef.current = {
      group,
      startX: e.clientX,
      startY: e.clientY,
      origX,
      origY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function moveControlGroupDrag(e: React.PointerEvent) {
    const d = controlDragRef.current;
    if (!d || !editingControlsLayout) return;
    e.preventDefault();
    e.stopPropagation();
    const nx = Math.round(Math.max(-360, Math.min(360, d.origX + (e.clientX - d.startX))));
    const ny = Math.round(Math.max(-420, Math.min(120, d.origY + (e.clientY - d.startY))));
    if (d.group === 'dpad') {
      updateHudControls({ dpadX: nx, dpadY: ny });
    } else {
      updateHudControls({ jumpX: nx, jumpY: ny });
    }
  }

  function endControlGroupDrag(e: React.PointerEvent) {
    if (!controlDragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    controlDragRef.current = null;
  }

  function addSystemChatMessage(text: string) {
    const sysMsg: ChatMsg = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderName: 'SYSTEM',
      text,
      createdAt: new Date().toISOString(),
    };
    ingestMessages([sysMsg]);
  }

  function handleChatCommand(rawText: string) {
    const isStaff = isStaffRole(myRoleRef.current);
    const isAdmin = myRoleRef.current === 'admin';

    if (!isStaff) {
      addSystemChatMessage('Perintah command (/) hanya dapat digunakan oleh Guru dan Administrator.');
      return;
    }

    const parts = rawText.slice(1).trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const arg1 = parts[1]?.toLowerCase();
    const arg2 = parts[2]?.toLowerCase();

    // Helper to find player by username or 'me'
    const findPlayer = (nameQuery?: string) => {
      if (!nameQuery) return null;
      if (nameQuery === 'me') {
        const myP = playersRef.current.get(myIdRef.current);
        return myP ? { id: myIdRef.current, username: myUsernameRef.current || 'Me' } : null;
      }
      for (const p of playersRef.current.values()) {
        if (p.username.toLowerCase() === nameQuery) {
          return { id: p.id, username: p.username };
        }
      }
      const foundInRoom = roomRef.current?.players?.find((pl) => pl.username.toLowerCase() === nameQuery);
      if (foundInRoom) {
        return { id: foundInRoom.userId, username: foundInRoom.username };
      }
      return null;
    };

    if (cmd === 'help' || cmd === 'cmd') {
      const helpLines = [
        '--- DAFTAR CHAT COMMAND ---',
        '• /cls : Bersihkan seluruh chat di layar (Clear Screen)',
        '• /set god <user|me> : Aktifkan God Mode (Kebal & Infinite Laser)',
        '• /unset god <user|me> : Nonaktifkan God Mode',
        '• /teleport <user|me> me : Tarik player ke posisimu',
        '• /teleport <user|me> <stage> : Lempar player ke Stage tertentu (1-4)',
        isAdmin ? '• /teleport all me : Tarik SELURUH siswa ke posisimu' : null,
        isAdmin ? '• /teleport all <stage> : Lempar SELURUH siswa ke Stage tertentu' : null,
        '• /mirror <username> : Tampilkan & bantu jawab kotak soal siswa',
        '• /mirror all : Mode soal bonus untuk seluruh kelas',
        '• /unset mirror : Sembunyikan kembali kotak soal',
        '• /reset <user|me> : Reset jawaban & skor player ke Stage 1',
        isAdmin ? '• /reset all : Reset SEMUA jawaban 1 room ke Stage 1' : null,
      ].filter(Boolean);
      for (const line of helpLines) {
        addSystemChatMessage(line as string);
      }
      return;
    }

    if (cmd === 'cls' || cmd === 'clear') {
      setChat([]);
      seenMsgIdsRef.current.clear();
      setUnreadCount(0);
      return;
    }

    if (cmd === 'set' && arg1 === 'god') {
      const targetQuery = arg2 || parts[2];
      const target = findPlayer(targetQuery);
      if (!target) {
        addSystemChatMessage(`Gagal: Player '${targetQuery || ''}' tidak ditemukan di room.`);
        return;
      }
      const p = playersRef.current.get(target.id);
      if (p) p.isGodMode = true;
      if (target.id === myIdRef.current) {
        isGodModeRef.current = true;
        setIsGodMode(true);
      }
      ably.publishCommand({ op: 'god', targetId: target.id, value: true, targetName: target.username });
      addSystemChatMessage(`👑 God Mode DIAKTIFKAN untuk '${target.username}'. (Kebal & Infinite Laser)`);
      soundEngine.playPowerUp();
      return;
    }

    if (cmd === 'unset' && arg1 === 'god') {
      const targetQuery = arg2 || parts[2];
      const target = findPlayer(targetQuery);
      if (!target) {
        addSystemChatMessage(`Gagal: Player '${targetQuery || ''}' tidak ditemukan di room.`);
        return;
      }
      const p = playersRef.current.get(target.id);
      if (p) p.isGodMode = false;
      if (target.id === myIdRef.current) {
        isGodModeRef.current = false;
        setIsGodMode(false);
      }
      ably.publishCommand({ op: 'god', targetId: target.id, value: false, targetName: target.username });
      addSystemChatMessage(`🛡️ God Mode DINONAKTIFKAN untuk '${target.username}'.`);
      return;
    }

    if (cmd === 'teleport') {
      const targetQuery = arg1;
      const dest = arg2;

      if (!targetQuery || !dest) {
        addSystemChatMessage('Format salah. Contoh: /teleport bims me atau /teleport bims 2');
        return;
      }

      if (targetQuery === 'all') {
        if (!isAdmin) {
          addSystemChatMessage('Perintah /teleport all hanya dapat digunakan oleh Administrator.');
          return;
        }
        if (dest === 'me') {
          const me = playersRef.current.get(myIdRef.current);
          ably.publishCommand({
            op: 'teleport',
            targetId: 'all',
            stage: currentStageRef.current,
            x: me?.x ?? 120,
            y: me?.y ?? 600,
          });
          addSystemChatMessage(`Berhasil teleport SELURUH siswa ke posisimu di Stage ${currentStageRef.current}.`);
        } else {
          const stg = Number(dest);
          if (stg >= 1 && stg <= totalStagesRef.current) {
            ably.publishCommand({ op: 'teleport', targetId: 'all', stage: stg });
            addSystemChatMessage(`Berhasil teleport SELURUH siswa ke Stage ${stg}.`);
          } else {
            addSystemChatMessage(`Nomor stage tidak valid (1-${totalStagesRef.current}).`);
          }
        }
        soundEngine.playBounce();
        return;
      }

      const target = findPlayer(targetQuery);
      if (!target) {
        addSystemChatMessage(`Player '${targetQuery}' tidak ditemukan.`);
        return;
      }

      if (dest === 'me') {
        const me = playersRef.current.get(myIdRef.current);
        ably.publishCommand({
          op: 'teleport',
          targetId: target.id,
          stage: currentStageRef.current,
          x: me?.x ?? 120,
          y: me?.y ?? 600,
        });
        addSystemChatMessage(`Berhasil teleport '${target.username}' ke posisimu.`);
      } else {
        const stg = Number(dest);
        if (stg >= 1 && stg <= totalStagesRef.current) {
          ably.publishCommand({ op: 'teleport', targetId: target.id, stage: stg });
          addSystemChatMessage(`Berhasil teleport '${target.username}' ke Stage ${stg}.`);
        } else {
          addSystemChatMessage(`Nomor stage tidak valid (1-${totalStagesRef.current}).`);
        }
      }
      soundEngine.playBounce();
      return;
    }

    if (cmd === 'reset') {
      const targetQuery = arg1;
      if (!targetQuery) {
        addSystemChatMessage('Format salah. Contoh: /reset bims atau /reset all');
        return;
      }
      if (targetQuery === 'all') {
        if (!isAdmin) {
          addSystemChatMessage('Perintah /reset all hanya dapat digunakan oleh Administrator.');
          return;
        }
        fetch('/api/game/reset-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, targetId: 'all' }),
        }).catch(() => {});
        ably.publishCommand({ op: 'reset', targetId: 'all' });
        if (mirrorTargetRef.current) {
          answerResultsRef.current.clear();
          const curStg = currentStageRef.current;
          const stageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
          questionBlocksRef.current = generateQuestionBlocks(
            stageQs.map((q) => q.id),
            `all:${roomId}:s${curStg}`,
            curStg,
          );
        }
        addSystemChatMessage('Berhasil me-reset jawaban seluruh siswa ke Stage 1.');
        soundEngine.playDeath();
        return;
      }
      const target = findPlayer(targetQuery);
      if (!target) {
        addSystemChatMessage(`Player '${targetQuery}' tidak ditemukan.`);
        return;
      }
      fetch('/api/game/reset-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, targetId: target.id }),
      }).catch(() => {});
      ably.publishCommand({ op: 'reset', targetId: target.id });
      const curMirror = mirrorTargetRef.current;
      if (curMirror && (curMirror === 'all' || curMirror.userId === target.id)) {
        answerResultsRef.current.clear();
        const curStg = currentStageRef.current;
        const stageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
        questionBlocksRef.current = generateQuestionBlocks(
          stageQs.map((q) => q.id),
          `${target.id}:${roomId}:s${curStg}`,
          curStg,
        );
      }
      addSystemChatMessage(`Berhasil me-reset jawaban '${target.username}' ke Stage 1.`);
      soundEngine.playDeath();
      return;
    }

    if (cmd === 'mirror') {
      const targetQuery = arg1;
      if (!targetQuery) {
        addSystemChatMessage('Format: /mirror <username> atau /mirror all');
        return;
      }
      if (targetQuery === 'all') {
        mirrorTargetRef.current = 'all';
        setMirrorTarget('Seluruh Kelas (Bonus)');
        const curStg = currentStageRef.current;
        const curStageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
        questionBlocksRef.current = generateQuestionBlocks(
          curStageQs.map((q) => q.id),
          `all:${roomId}:s${curStg}`,
          curStg,
        );
        addSystemChatMessage('🔍 Mode Mirror ALL aktif! Kotak soal bonus sekelas dimunculkan di map.');
        soundEngine.playPowerUp();
        return;
      }

      const target = findPlayer(targetQuery);
      if (!target) {
        addSystemChatMessage(`Player '${targetQuery}' tidak ditemukan.`);
        return;
      }

      mirrorTargetRef.current = { userId: target.id, username: target.username };
      setMirrorTarget(target.username);
      const curStg = currentStageRef.current;
      const curStageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
      questionBlocksRef.current = generateQuestionBlocks(
        curStageQs.map((q) => q.id),
        `${target.id}:${roomId}:s${curStg}`,
        curStg,
      );
      addSystemChatMessage(`🔍 Mode Mirroring '${target.username}' aktif! Kotak soal siswa dimunculkan di map.`);
      soundEngine.playPowerUp();
      return;
    }

    if (cmd === 'unset' && arg1 === 'mirror') {
      mirrorTargetRef.current = null;
      setMirrorTarget(null);
      questionBlocksRef.current = [];
      addSystemChatMessage('Mode Mirror dimatikan. Kotak soal disembunyikan kembali dari pandangan.');
      soundEngine.playBounce();
      return;
    }

    addSystemChatMessage(`Perintah '/${cmd}' tidak dikenali. Ketik /help untuk melihat daftar perintah.`);
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (exitNoticeRef.current || (roomRef.current?.status === 'paused' && !isStaffRole(myRoleRef.current))) return;
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');

    if (text.toLowerCase() === '/cls' || text.toLowerCase() === '/clear') {
      setChat([]);
      seenMsgIdsRef.current.clear();
      setUnreadCount(0);
      return;
    }

    if (text.startsWith('/')) {
      handleChatCommand(text);
      return;
    }

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
        if (typeof data.message.seq === 'number' && data.message.seq > chatCursorRef.current) {
          chatCursorRef.current = data.message.seq;
        }
        ingestMessages([data.message]);
      }
    }
  }

  const displayChat = chat;
  const players = room?.players ?? [];
  const totalSteps = Math.max(levelQuestions.length, 1);
  // Hitung semua soal yang sudah dijawab oleh player (baik benar maupun salah) ke dalam progres misi
  const doneSteps = Math.min(Math.max(answeredQuestionIds.length, correctCount), totalSteps);
  const sortedPlayers = [...players].sort((a, b) => (scores[b.userId] ?? 0) - (scores[a.userId] ?? 0) || a.username.localeCompare(b.username));
  const hasVisibleQuestion = Boolean(question && (!isStaff ? !answeredQuestionIds.includes(question.id) : Boolean(mirrorTargetRef.current)));
  const questionActive = hasVisibleQuestion;
  const allBottomMinimized = panelsHidden || !hasVisibleQuestion;
  const controlsPosClass = allBottomMinimized ? '' : ' mp-elevated';

  async function togglePauseGame() {
    if (!room) return;
    const nextStatus = room.status === 'paused' ? 'in_progress' : 'paused';
    applyLiveRoomStatus(nextStatus);
    await fetch('/api/rooms/' + roomId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  async function endGame() {
    hasLeftRef.current = true;
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

  async function kickAllPlayers() {
    if (!confirm('Keluarkan semua siswa dari ruang permainan ini?')) return;
    const res = await fetch('/api/game/kick-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    });
    if (res.ok) {
      const data = await res.json();
      const kickedSet = new Set<string>(Array.isArray(data.kickedIds) ? data.kickedIds : []);
      for (const pid of kickedSet) {
        playersRef.current.delete(pid);
      }
      setRoom((prev) =>
        prev ? { ...prev, players: prev.players.filter((pl) => !kickedSet.has(pl.userId)) } : prev,
      );
    }
  }

  async function approveRejoin(playerId: string) {
    setRejoinRequests((prev) => prev.filter((r) => r.userId !== playerId));
    const res = await fetch('/api/game/approve-rejoin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    });
    if (res.ok) {
      const data = await res.json();
      setScores((prev) => ({ ...prev, [playerId]: 0 }));
      if (Array.isArray(data.rejoinRequests)) {
        setRejoinRequests(data.rejoinRequests);
      }
    }
  }

  async function rejectRejoin(playerId: string) {
    setRejoinRequests((prev) => prev.filter((r) => r.userId !== playerId));
    const res = await fetch('/api/game/reject-rejoin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rejoinRequests)) {
        setRejoinRequests(data.rejoinRequests);
      }
    }
  }
  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (exitNoticeRef.current || (roomRef.current?.status === 'paused' && !isStaffRole(myRoleRef.current))) return;
    if (!question || !selected || submitting) return;

    if (isStaffRole(myRoleRef.current) && mirrorTargetRef.current) {
      const answeredId = question.id;
      const targetId = mirrorTargetRef.current === 'all' ? 'all' : mirrorTargetRef.current.userId;
      const targetName = mirrorTargetRef.current === 'all' ? 'Seluruh Siswa' : mirrorTargetRef.current.username;

      answerResultsRef.current.set(answeredId, 'assisted');
      answeredIdsRef.current.add(answeredId);
      setAnsweredQuestionIds(Array.from(answeredIdsRef.current));
      setCorrectCount(answeredIdsRef.current.size);

      ably.publishCommand({ op: 'assist_answer', targetId, qid: answeredId });
      soundEngine.playAnswerCorrect();
      setStageBanner(`🟦 Berhasil membantu soal untuk ${targetName}! (+0 Poin, Misi Tercatat)`);
      if (stageBannerTimerRef.current) clearTimeout(stageBannerTimerRef.current);
      stageBannerTimerRef.current = setTimeout(() => setStageBanner(null), 4000);
      setQuestion(null);
      questionRef.current = null;
      setSelected('');
      return;
    }

    setSubmitting(true);
    try {
      const answeredId = question.id;
      const res = await fetch('/api/game/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current || undefined,
          roomId,
          levelId: roomRef.current?.level?.id,
          questionId: answeredId,
          answer: selected,
          timeSpent: 0,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.rejoinRequests)) {
        setRejoinRequests(data.rejoinRequests);
      }

      if (typeof data.sessionId === 'string' && data.sessionId) {
        sessionIdRef.current = data.sessionId;
      }
      if (res.ok) {
        const result = data.result ?? data;
        answerResultsRef.current.set(answeredId, Boolean(result.isCorrect));
        answeredIdsRef.current.add(answeredId);
        const nextAnsweredList = Array.from(answeredIdsRef.current);
        setAnsweredQuestionIds(nextAnsweredList);
        // Tambahkan progres misi baik jawaban benar maupun salah
        setCorrectCount(nextAnsweredList.length);
        const curStg = currentStageRef.current;
        const totStg = totalStagesRef.current;
        const curStgQs = getStageQuestions(levelQuestionsRef.current, curStg, totStg);
        if (curStgQs.length > 0 && curStgQs.every((q) => answeredIdsRef.current.has(q.id))) {
          const msg =
            curStg < totStg
              ? `🔓 GERBANG STAGE ${curStg} TERBUKA! Pergi ke Pintu Ujung Kanan untuk Masuk Stage ${curStg + 1} ➜`
              : `🏆 SEMUA SOAL STAGE ${curStg} SELESAI! Pergi ke Gerbang Finish di Ujung Kanan!`;
          setStageBanner(msg);
          if (stageBannerTimerRef.current) clearTimeout(stageBannerTimerRef.current);
          stageBannerTimerRef.current = setTimeout(() => setStageBanner(null), 5000);
        }
        setSelected('');
        if (result.isCorrect) {
          soundEngine.playAnswerCorrect();
          if (myIdRef.current) {
            setScores((prev) => ({
              ...prev,
              [myIdRef.current]: (prev[myIdRef.current] ?? 0) + (result.pointsEarned ?? 0),
            }));
          }
        } else {
          soundEngine.playAnswerWrong();
        }
        setFeedback(result);
      } else {
        if (res.status === 409) {
          answeredIdsRef.current.add(answeredId);
          const nextAnsweredList = Array.from(answeredIdsRef.current);
          setAnsweredQuestionIds(nextAnsweredList);
          setCorrectCount(nextAnsweredList.length);
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
    <main ref={mainRef} className="fixed top-0 left-0 right-0 h-screen w-full overflow-hidden bg-[#1e2d42] p-0 md:p-4 game-shell">
      <div className={`game-viewport${questionActive ? ' question-focus' : ''}`}>
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

                {!panelsHidden && (
                  <button
                    type="button"
                    className="pause-btn mp-chat-top-btn"
                    aria-pressed={!chatMinimized}
                    aria-label={chatMinimized ? 'Buka Chat Room' : 'Tutup Chat Room'}
                    title={chatMinimized ? 'Buka Chat Room' : 'Tutup Chat Room'}
                    onClick={() => {
                      soundEngine.playClick();
                      setChatMinimized((prev) => !prev);
                      setUnreadCount(0);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                        fill="#fff"
                      />
                      <circle cx="8.5" cy="11.5" r="1.3" fill="#6b3806" />
                      <circle cx="12" cy="11.5" r="1.3" fill="#6b3806" />
                      <circle cx="15.5" cy="11.5" r="1.3" fill="#6b3806" />
                    </svg>
                    {unreadCount > 0 && <span className="mp-chat-badge">{unreadCount}</span>}
                  </button>
                )}
              </div>

              <div className="mp-center-stage-pill">
                <div className="mp-stage-title">{getRoomSubjectTitle(room)}</div>
                {totalStages > 1 && (
                  isStaff ? (
                    <div className="mp-stage-switch-row" role="group" aria-label="Pilih Stage (Guru/Admin)">
                      {Array.from({ length: totalStages }, (_, idx) => {
                        const stgNum = idx + 1;
                        const stgQs = getStageQuestions(levelQuestions, stgNum, totalStages);
                        const stgAns = stgQs.filter((q) => answeredQuestionIds.includes(q.id)).length;
                        const isCleared = stgQs.length > 0 && stgAns >= stgQs.length;
                        return (
                          <button
                            key={stgNum}
                            type="button"
                            className={`mp-stage-chip-compact${currentStage === stgNum ? ' is-active' : ''}${isCleared ? ' is-cleared' : ''}`}
                            title={`Stage ${stgNum} (${stgAns}/${stgQs.length} soal)`}
                            onClick={() => {
                              soundEngine.playClick();
                              applyStage(stgNum, { respawnPlayer: true, showToast: true });
                            }}
                          >
                            {stgNum}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mp-stage-switch-row">
                      <span className="mp-stage-badge-student">
                        Stage {currentStage} / {totalStages}
                      </span>
                    </div>
                  )
                )}
              </div>

              {mirrorTarget && isStaff && (
                <div className="mirror-indicator-pill" role="status">
                  <span>🔍 Mirroring: <strong>{mirrorTarget}</strong></span>
                  <button
                    type="button"
                    className="mirror-close-btn"
                    title="Tutup Mode Mirror (/unset mirror)"
                    onClick={() => {
                      mirrorTargetRef.current = null;
                      setMirrorTarget(null);
                      questionBlocksRef.current = [];
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="mp-top-right">
                <div className="mp-timer-row">
                  <div
                    className="mp-ping-pill"
                    title={`Realtime Transport: ${ably.transportMode.toUpperCase()} (${ably.pingMs} ms)`}
                    aria-label={`Ping ${ably.pingMs} ms`}
                  >
                    <span className={`mp-ping-dot ${ably.pingMs <= 20 ? 'fast' : ably.pingMs <= 80 ? 'ok' : 'slow'}`} />
                    <span>{ably.pingMs} ms</span>
                  </div>
                  {isStaff && (
                    <div className="mp-teacher-actions">
                      <button
                        type="button"
                        className={`pause-btn mp-staff-btn ${room?.status === 'paused' ? 'mp-staff-green' : 'mp-staff-blue'}`}
                        aria-label={room?.status === 'paused' ? 'Lanjutkan Game' : 'Jeda Game'}
                        title={room?.status === 'paused' ? 'Lanjutkan Game' : 'Jeda Game'}
                        onClick={togglePauseGame}
                      >
                        {room?.status === 'paused' ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8 5.5v13l11-6.5-11-6.5z" fill="#fff" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="#fff" />
                            <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="#fff" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className="pause-btn mp-staff-btn mp-staff-blue mp-chat-top-btn"
                        aria-label="Kelola Pemain"
                        title="Kelola Pemain"
                        onClick={() => {
                          setKickModalOpen(true);
                          fetch('/api/game/room-sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ roomId, chatCursor: chatCursorRef.current }),
                          })
                            .then((r) => (r.ok ? r.json() : null))
                            .then((d) => {
                              if (d && Array.isArray(d.rejoinRequests)) {
                                setRejoinRequests(d.rejoinRequests);
                              }
                            })
                            .catch(() => {});
                        }}
                      >
                        <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="9" cy="8.5" r="3.2" fill="#fff" />
                          <path
                            d="M3.5 19c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                          <circle cx="16.8" cy="9.2" r="2.3" fill="#fff" opacity="0.92" />
                          <path
                            d="M15.8 14.3c2.4.3 4.4 2 4.4 4.4"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        {rejoinRequests.length > 0 && (
                          <span className="mp-chat-badge">{rejoinRequests.length}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="pause-btn mp-staff-btn mp-staff-danger"
                        aria-label="Akhiri Sesi Game"
                        title="Akhiri Sesi Game"
                        onClick={endGame}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M12 3v9"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                          />
                          <path
                            d="M7.05 6.05a8 8 0 1 0 9.9 0"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="pause-btn"
                    aria-pressed={settingsModalOpen}
                    aria-label="Pengaturan Suara & Tombol"
                    title="Pengaturan Suara & Tombol"
                    onClick={() => {
                      soundEngine.playClick();
                      setSettingsModalOpen((v) => !v);
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"
                        fill="#fff"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="pause-btn"
                    aria-pressed={panelsHidden}
                    aria-label={panelsHidden ? 'Tampilkan semua panel' : 'Sembunyikan semua panel'}
                    title={panelsHidden ? 'Tampilkan semua panel' : 'Sembunyikan semua panel'}
                    onClick={() => {
                      soundEngine.playClick();
                      setPanelsHidden((v) => !v);
                    }}
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
                  <button type="button" className="pause-btn" aria-label="Kembali" title="Kembali" onClick={handleLeaveGame}>
                    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path d="M20 6l-12 10 12 10v-6h8v-8h-8V6z" fill="#fff" /></svg>
                  </button>
                  <button
                    type="button"
                    className="pause-btn mp-fullscreen-btn"
                    aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
                    title={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 3v3H6v3H3V3h6zm6 0h6v6h-3V6h-3V3zM3 15h3v3h3v3H3v-6zm15 0h3v6h-6v-3h3v-3z" fill="#fff" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 3h6v3H6v3H3V3zm12 0h6v6h-3V6h-3V3zM3 15h3v3h3v3H3v-6zm18 0v6h-6v-3h3v-3h3z" fill="#fff" />
                      </svg>
                    )}
                  </button>
                </div>

                {!panelsHidden && (
                  <div className="mp-right-tool-rail">
                    <div className="mp-tool-slot">
                      <button
                        type="button"
                        className={`mp-icon-badge${!leaderboardMinimized ? ' is-active' : ''}`}
                        aria-pressed={!leaderboardMinimized}
                        aria-label={leaderboardMinimized ? 'Buka Leaderboard' : 'Tutup Leaderboard'}
                        title={leaderboardMinimized ? 'Buka Leaderboard' : 'Tutup Leaderboard'}
                        onClick={() => {
                          soundEngine.playClick();
                          setLeaderboardMinimized((v) => !v);
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <span aria-hidden="true">🏆</span>
                      </button>
                      {!leaderboardMinimized && (
                        <aside className="mp-dark-panel mp-leaderboard-box mp-tool-popover" aria-label="Papan peringkat" style={panelStyle('leaderboard')}>
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
                            {sortedPlayers
                              .filter((p) => p.role !== 'admin')
                              .slice(0, 5)
                              .map((p, i) => {
                                const pFullName = p.fullName || playersRef.current.get(p.userId)?.fullName;
                                const rankDisplayName =
                                  pFullName && pFullName.trim().toLowerCase() !== p.username.trim().toLowerCase()
                                    ? `[${p.username}] - ${pFullName.trim()}`
                                    : `[${p.username}]`;
                                return (
                                  <li key={p.userId} className="mp-rank-row">
                                    <span className={`rank-medal ${['gold', 'silver', 'bronze'][i] ?? 'silver'}`}>{i + 1}</span>
                                    <span className={`rank-cat-dot ${chipColor(p.userId)}`} aria-hidden="true" />
                                    <span className="rank-name" title={rankDisplayName}>{rankDisplayName}</span>
                                    <span className="rank-score">{scores[p.userId] ?? 0}</span>
                                  </li>
                                );
                              })}
                          </ol>
                        </aside>
                      )}
                    </div>

                    <div className="mp-tool-slot">
                      <button
                        type="button"
                        className={`mp-icon-badge${!missionMinimized ? ' is-active' : ''}`}
                        aria-pressed={!missionMinimized}
                        aria-label={missionMinimized ? 'Buka Misi' : 'Tutup Misi'}
                        title={missionMinimized ? 'Buka Misi' : 'Tutup Misi'}
                        onClick={() => {
                          soundEngine.playClick();
                          setMissionMinimized((v) => !v);
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <span aria-hidden="true">🎯</span>
                      </button>
                      {!missionMinimized && (
                        <aside className="mp-dark-panel mp-topic-card mp-tool-popover" aria-label="Progres misi" style={panelStyle('mission')}>
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
                        </aside>
                      )}
                    </div>

                    <button
                      type="button"
                      className="mp-icon-badge"
                      aria-label="Perbesar Kamera (Zoom In)"
                      title="Perbesar (Zoom In)"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        soundEngine.playClick();
                        cameraRef.current?.zoomBy(0.12);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
                        <circle cx="14" cy="14" r="8.5" fill="none" stroke="#fff" strokeWidth="3" />
                        <line x1="20.5" y1="20.5" x2="27.5" y2="27.5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
                        <line x1="10.5" y1="14" x2="17.5" y2="14" stroke="#ffd338" strokeWidth="2.8" strokeLinecap="round" />
                        <line x1="14" y1="10.5" x2="14" y2="17.5" stroke="#ffd338" strokeWidth="2.8" strokeLinecap="round" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      className="mp-icon-badge"
                      aria-label="Perkecil Kamera (Zoom Out)"
                      title="Perkecil (Zoom Out)"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        soundEngine.playClick();
                        cameraRef.current?.zoomBy(-0.12);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
                        <circle cx="14" cy="14" r="8.5" fill="none" stroke="#fff" strokeWidth="3" />
                        <line x1="20.5" y1="20.5" x2="27.5" y2="27.5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
                        <line x1="10.5" y1="14" x2="17.5" y2="14" stroke="#a8d8ff" strokeWidth="2.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
          </div>

          {stageBanner && (
            <div className="mp-stage-banner-toast" role="status" aria-live="polite">
              {stageBanner}
            </div>
          )}

          {editingControlsLayout && (
            <div className="hud-edit-banner" role="region" aria-label="Mode atur posisi tombol">
              <span className="hud-edit-banner-text">Geser tombol Arah &amp; Lompat ke posisi yang nyaman</span>
              <button
                type="button"
                className="btn-green-action hud-edit-done-btn"
                onClick={() => {
                  soundEngine.playClick();
                  setEditingControlsLayout(false);
                }}
              >
                ✔ Selesai
              </button>
            </div>
          )}

          <div
            className={`onscreen-controls${controlsPosClass}${hudControls.swapSides ? ' is-swapped' : ''}`}
            style={
              {
                '--ctrl-size': `${hudControls.size}px`,
                '--ctrl-gap': `${hudControls.gap}px`,
                '--ctrl-opacity': hudControls.opacity,
              } as React.CSSProperties
            }
          >
            <div
              className={`dpad-group${editingControlsLayout ? ' is-editing-layout' : ''}`}
              style={{ transform: `translate(${hudControls.dpadX}px, ${hudControls.dpadY}px)` }}
              onPointerDown={(e) => startControlGroupDrag('dpad', e)}
              onPointerMove={moveControlGroupDrag}
              onPointerUp={endControlGroupDrag}
              onPointerCancel={endControlGroupDrag}
            >
              {editingControlsLayout && <span className="dpad-edit-tag">Geser Arah</span>}
              <button
                type="button"
                className="ctrl-circle"
                aria-label="Gerak ke Kiri"
                onPointerDown={(e) => {
                  if (editingControlsLayout) return;
                  e.preventDefault();
                  touchControl('left', true);
                }}
                onPointerUp={() => touchControl('left', false)}
                onPointerCancel={() => touchControl('left', false)}
                onPointerLeave={() => touchControl('left', false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg
                  width={Math.round(hudControls.size * 0.44)}
                  height={Math.round(hudControls.size * 0.44)}
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <path d="M18 7l-9 9 9 9v-5h8v-8h-8V7z" fill="#fff" />
                </svg>
              </button>
              <button
                type="button"
                className="ctrl-circle"
                aria-label="Gerak ke Kanan"
                onPointerDown={(e) => {
                  if (editingControlsLayout) return;
                  e.preventDefault();
                  touchControl('right', true);
                }}
                onPointerUp={() => touchControl('right', false)}
                onPointerCancel={() => touchControl('right', false)}
                onPointerLeave={() => touchControl('right', false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg
                  width={Math.round(hudControls.size * 0.44)}
                  height={Math.round(hudControls.size * 0.44)}
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <path d="M14 7l9 9-9 9v-5H6v-8h8V7z" fill="#fff" />
                </svg>
              </button>
            </div>

            <div
              className={`dpad-group${editingControlsLayout ? ' is-editing-layout' : ''}`}
              style={{ transform: `translate(${hudControls.jumpX}px, ${hudControls.jumpY}px)` }}
              onPointerDown={(e) => startControlGroupDrag('jump', e)}
              onPointerMove={moveControlGroupDrag}
              onPointerUp={endControlGroupDrag}
              onPointerCancel={endControlGroupDrag}
            >
              {editingControlsLayout && <span className="dpad-edit-tag">Aksi &amp; Lompat</span>}
              <button
                type="button"
                className={`ctrl-circle ctrl-shoot-btn${ammoCount > 0 ? ' has-ammo' : ''}`}
                aria-label="Tembak Laser"
                title="Tembak Laser (F / X / E)"
                onPointerDown={(e) => {
                  if (editingControlsLayout) return;
                  e.preventDefault();
                  fireLaser();
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <span className="ctrl-shoot-icon" aria-hidden="true">⚡</span>
                {ammoCount > 0 && <span className="ctrl-ammo-badge">{ammoCount}</span>}
              </button>
              <button
                type="button"
                className="ctrl-circle"
                aria-label="Lompat"
                onPointerDown={(e) => {
                  if (editingControlsLayout) return;
                  e.preventDefault();
                  touchControl('jump', true);
                }}
                onPointerUp={() => touchControl('jump', false)}
                onPointerCancel={() => touchControl('jump', false)}
                onPointerLeave={() => touchControl('jump', false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg
                  width={Math.round(hudControls.size * 0.46)}
                  height={Math.round(hudControls.size * 0.46)}
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <path d="M16 6l-9 9h5v11h8V15h5l-9-9z" fill="#fff" />
                </svg>
              </button>
            </div>
          </div>

          {(!panelsHidden || hasVisibleQuestion) && (
          <div className="mp-bottom-dock">
              {!panelsHidden && !chatMinimized && (
                <aside className="mp-dark-panel mp-chat-panel mp-chat-fixed" aria-label="Ruang obrolan">
                  <div className="mp-chat-header">
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
                    {displayChat.map((m) => {
                      if (m.senderName === 'SYSTEM') {
                        return (
                          <div key={m.id} className="sys-chat-entry">
                            <span className="font-bold">{m.text}</span>
                          </div>
                        );
                      }

                      const senderPlayer = (m.userId ? playersRef.current.get(m.userId) : null) ||
                        roomRef.current?.players?.find((pl) => pl.userId === m.userId || pl.username === m.senderName);
                      const isSenderAdmin = m.role === 'admin' || senderPlayer?.role === 'admin' || m.senderName.toLowerCase() === 'admin' || m.senderName.toLowerCase() === 'administrator';

                      let senderLabel = '';
                      if (isSenderAdmin) {
                        senderLabel = '[Administrator]';
                      } else {
                        const uname = m.senderName;
                        const fname = m.senderFullName || senderPlayer?.fullName;
                        if (fname && fname.trim().toLowerCase() !== uname.trim().toLowerCase()) {
                          senderLabel = `[${uname}] - ${fname.trim()}`;
                        } else {
                          senderLabel = `[${uname}]`;
                        }
                      }

                      return (
                        <div key={m.id} className="chat-msg-item">
                          <span>
                            <span className={`chat-sender ${chipColor(m.senderName)}`}>{senderLabel}</span>
                            <span className="chat-text">: {m.text}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <form className="mp-chat-form" onSubmit={sendChat}>
                    <label htmlFor="mp-chat-input" className="sr-only">Ketik pesan</label>
                    <input
                      id="mp-chat-input"
                      type="text"
                      className="mp-chat-input"
                      placeholder={isStaff ? 'Ketik pesan atau /cmd...' : 'Ketik pesan...'}
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

              {question && (!isStaff ? !answeredQuestionIds.includes(question.id) : Boolean(mirrorTargetRef.current)) && (
                <section className="parchment-card mp-question-dock" aria-label="Tantangan soal" style={panelStyle('question')}>
                  <div
                    className="mp-dock-ribbon mp-drag-handle flex items-center justify-between"
                    onPointerDown={(e) => startPanelDrag('question', e)}
                    onPointerMove={movePanelDrag}
                    onPointerUp={(e) => endPanelDrag(e)}
                    onPointerCancel={(e) => endPanelDrag(e)}
                  >
                    <span className="mp-panel-heading-title">
                      <span aria-hidden="true">📖</span> Tantangan Soal {isStaff && mirrorTarget && (
                        <span className="text-xs text-yellow-300 font-normal ml-2">
                          (Mirror: {mirrorTarget})
                        </span>
                      )}
                    </span>
                    {isStaff && (
                      <button
                        type="button"
                        className="mp-win-btn ml-auto text-sm font-bold text-slate-300 hover:text-white"
                        title="Tutup Modal Soal (Guru/Admin)"
                        onClick={() => {
                          setQuestion(null);
                          questionRef.current = null;
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="mp-bonus-badge" aria-label={`Bonus ${question.points} poin`}>
                    <span aria-hidden="true">⏱</span> +{question.points}
                  </div>

                  <div className="mp-q-header-row">
                    <h2 className="mp-q-heading">{question.content}</h2>
                  </div>

                  <form onSubmit={submitAnswer}>
                    <div className="mp-options-grid-2x2" role="radiogroup" aria-label="Pilihan jawaban">
                      {question.options.map((o, idx) => {
                        const displayLabel = OPTION_DISPLAY_LABELS[idx] ?? o.label;
                        const isCorrectKey = myRoleRef.current === 'admin' && Boolean(question.correctAnswer) && (
                          question.correctAnswer === o.label ||
                          question.correctAnswer === o.content ||
                          question.correctAnswer?.toLowerCase() === o.label.toLowerCase() ||
                          question.correctAnswer?.toLowerCase() === o.content.toLowerCase()
                        );
                        return (
                          <button
                            key={o.label}
                            type="button"
                            role="radio"
                            aria-checked={selected === o.label}
                            className={`mp-grid-opt-btn${selected === o.label ? ' selected' : ''}${isCorrectKey ? ' border-emerald-500 ring-2 ring-emerald-400' : ''}`}
                            onClick={() => {
                              soundEngine.playClick();
                              setSelected(o.label);
                            }}
                          >
                            <span className="opt-badge">{displayLabel}</span>
                            <span className="flex-1 text-left">{o.content}</span>
                            {isCorrectKey && (
                              <span className="admin-key-badge ml-2" title="Kunci Jawaban Benar (Admin Only)">
                                ✓ KUNCI JAWABAN
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <button type="submit" className="btn-orange-action" disabled={!selected || submitting}>
                        <span aria-hidden="true">✔</span> {submitting ? 'Mengirim...' : isStaff ? 'Bantu Jawab (Centang Biru)' : 'Submit'}
                      </button>
                    </div>
                  </form>
                </section>
              )}

            </div>
          )}
        </div>

        {settingsModalOpen && (
          <div
            className="overlay-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Pengaturan Game"
            onClick={() => setSettingsModalOpen(false)}
          >
            <div className="parchment-card feedback-modal-card settings-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <div className="green-arch-ribbon">Pengaturan Game</div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Suara &amp; Musik (BGM)</div>

                <div className="settings-row">
                  <span className="settings-label">Musik Latar (BGM)</span>
                  <button
                    type="button"
                    className={`settings-toggle-btn ${bgmEnabled ? 'on' : 'off'}`}
                    onClick={() => {
                      const next = !bgmEnabled;
                      setBgmEnabled(next);
                      soundEngine.setBgmEnabled(next);
                      soundEngine.playClick();
                    }}
                  >
                    {bgmEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="settings-slider-wrap">
                  <div className="settings-row">
                    <span className="settings-label">Volume Musik</span>
                    <span className="settings-val-badge">{Math.round(bgmVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="settings-range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(bgmVolume * 100)}
                    onChange={(e) => {
                      const v = Number(e.target.value) / 100;
                      setBgmVolume(v);
                      soundEngine.setBgmVolume(v);
                    }}
                  />
                </div>

                <div className="settings-row" style={{ marginTop: 4 }}>
                  <span className="settings-label">Efek Suara (Lompat, Api, Mati, Klik)</span>
                  <button
                    type="button"
                    className={`settings-toggle-btn ${sfxEnabled ? 'on' : 'off'}`}
                    onClick={() => {
                      const next = !sfxEnabled;
                      setSfxEnabled(next);
                      soundEngine.setSfxEnabled(next);
                      if (next) soundEngine.playClick();
                    }}
                  >
                    {sfxEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="settings-slider-wrap">
                  <div className="settings-row">
                    <span className="settings-label">Volume Efek Suara</span>
                    <span className="settings-val-badge">{Math.round(sfxVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="settings-range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(sfxVolume * 100)}
                    onChange={(e) => {
                      const v = Number(e.target.value) / 100;
                      setSfxVolume(v);
                      soundEngine.setSfxVolume(v);
                    }}
                    onPointerUp={() => soundEngine.playJump()}
                  />
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Ukuran &amp; Posisi Tombol Layar</div>

                <div className="settings-slider-wrap">
                  <div className="settings-row">
                    <span className="settings-label">Ukuran Tombol (Kiri/Kanan/Lompat)</span>
                    <span className="settings-val-badge">{hudControls.size}px</span>
                  </div>
                  <input
                    type="range"
                    className="settings-range"
                    min={64}
                    max={128}
                    step={2}
                    value={hudControls.size}
                    onChange={(e) => updateHudControls({ size: Number(e.target.value) })}
                  />
                </div>

                <div className="settings-slider-wrap">
                  <div className="settings-row">
                    <span className="settings-label">Jarak Tombol Kiri &amp; Kanan</span>
                    <span className="settings-val-badge">{hudControls.gap}px</span>
                  </div>
                  <input
                    type="range"
                    className="settings-range"
                    min={8}
                    max={44}
                    step={2}
                    value={hudControls.gap}
                    onChange={(e) => updateHudControls({ gap: Number(e.target.value) })}
                  />
                </div>

                <div className="settings-slider-wrap">
                  <div className="settings-row">
                    <span className="settings-label">Transparansi Tombol</span>
                    <span className="settings-val-badge">{Math.round(hudControls.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="settings-range"
                    min={35}
                    max={100}
                    step={5}
                    value={Math.round(hudControls.opacity * 100)}
                    onChange={(e) => updateHudControls({ opacity: Number(e.target.value) / 100 })}
                  />
                </div>

                <div className="settings-row">
                  <span className="settings-label">Tukar Sisi Kiri &amp; Kanan</span>
                  <button
                    type="button"
                    className={`settings-toggle-btn ${hudControls.swapSides ? 'on' : 'off'}`}
                    onClick={() => {
                      soundEngine.playClick();
                      updateHudControls({ swapSides: !hudControls.swapSides });
                    }}
                  >
                    {hudControls.swapSides ? 'DITUKAR' : 'NORMAL'}
                  </button>
                </div>

                <div className="settings-actions-row">
                  <button
                    type="button"
                    className="btn-blue-action"
                    style={{ fontSize: 13, padding: '8px 14px', minHeight: 40, flex: 1 }}
                    onClick={() => {
                      soundEngine.playClick();
                      setSettingsModalOpen(false);
                      setEditingControlsLayout(true);
                    }}
                  >
                    Geser Posisi Tombol di Layar
                  </button>
                  <button
                    type="button"
                    className="btn-orange-action"
                    style={{ fontSize: 13, padding: '8px 14px', minHeight: 40 }}
                    onClick={resetHudControls}
                  >
                    Reset Tombol
                  </button>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="btn-green-action"
                  style={{ fontSize: 14, padding: '8px 24px', minHeight: 42 }}
                  onClick={() => {
                    soundEngine.playClick();
                    setSettingsModalOpen(false);
                  }}
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}

        {kickModalOpen && isStaff && (
          <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Kelola Pemain" onClick={() => setKickModalOpen(false)}>
            <div className="parchment-card feedback-modal-card teacher-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <div className="green-arch-ribbon">Kelola Pemain</div>
              </div>
              <p className="feedback-subtext text-center" style={{ marginBottom: 8 }}>
                Keluarkan peserta yang tidak dikenal dari ruang permainan.
              </p>

              {sortedPlayers.filter((pl) => pl.userId !== myIdRef.current && pl.role !== 'admin' && pl.role !== 'teacher').length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button
                    type="button"
                    className="btn-orange-action"
                    style={{ fontSize: 12, padding: '6px 14px', minHeight: 36 }}
                    onClick={kickAllPlayers}
                  >
                    🚫 Kick Semua Pemain
                  </button>
                </div>
              )}

              <div className="teacher-list-box">
                {rejoinRequests.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div
                      className="teacher-q-text"
                      style={{ fontSize: 13, color: '#8c5308', marginBottom: 6 }}
                    >
                      Permintaan Masuk Kembali (Approve = Reset Soal &amp; Poin Sesi ke 0):
                    </div>
                    {rejoinRequests.map((req) => (
                      <div key={req.userId} className="teacher-q-card" style={{ marginBottom: 6 }}>
                        <div className="teacher-q-info">
                          <div className="teacher-q-text">{req.username}</div>
                          <div className="teacher-q-meta">
                            <span>Ingin bergabung ulang setelah di-kick</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn-green-action"
                            style={{ fontSize: 12, padding: '6px 12px', minHeight: 36 }}
                            onClick={() => approveRejoin(req.userId)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-orange-action"
                            style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}
                            onClick={() => rejectRejoin(req.userId)}
                          >
                            Tolak
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {sortedPlayers.filter((pl) => pl.userId !== myIdRef.current).length === 0 &&
                rejoinRequests.length === 0 ? (
                  <p className="feedback-subtext text-center">Belum ada siswa di dalam ruang.</p>
                ) : (
                  sortedPlayers
                    .filter((pl) => pl.userId !== myIdRef.current)
                    .map((pl) => (
                      <div key={pl.userId} className="teacher-q-card">
                        <div className="teacher-q-info">
                          <div className="teacher-q-text">
                            {pl.username}
                            {pl.role === 'admin' ? ' (ADMIN)' : pl.role === 'teacher' ? ' (GURU)' : ''}
                          </div>
                          <div className="teacher-q-meta">
                            <span>Skor: {scores[pl.userId] ?? 0} poin</span>
                          </div>
                        </div>
                        {pl.role !== 'admin' && pl.role !== 'teacher' && (
                          <button
                            type="button"
                            className="btn-orange-action"
                            style={{ fontSize: 13, padding: '6px 14px', minHeight: 38, flexShrink: 0 }}
                            onClick={() => kickPlayer(pl.userId)}
                          >
                            Kick
                          </button>
                        )}
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
                {feedback.isCorrect
                  ? 'Mantap! Soal yang kamu jawab dinyatakan BENAR.'
                  : 'Jawaban kamu pada soal yang sudah dijawab ini dinyatakan SALAH.'}
              </p>

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

        {room?.status === 'paused' && !exitNotice && (
          <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Room Dijeda">
            <div className="parchment-card feedback-modal-card">
              <p className="feedback-subtext" style={{ marginTop: 4 }}>
                {isStaff
                  ? 'Room sedang dijeda. Semua pergerakan siswa dikunci.'
                  : 'Room sedang dijeda, menunggu aksi dari guru...'}
              </p>
              {isStaff && (
                <button
                  type="button"
                  className="btn-green-action"
                  onClick={togglePauseGame}
                >
                  Lanjutkan Game
                </button>
              )}
            </div>
          </div>
        )}

        {exitNotice && (
          <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Notifikasi Ruang">
            <div className="parchment-card feedback-modal-card">
              <p className="feedback-subtext" style={{ marginTop: 4 }}>
                {exitNotice === 'kicked'
                  ? 'Kamu telah dikeluarkan dari ruang permainan ini oleh guru.'
                  : 'Room game ini telah dihapus oleh guru.'}
              </p>
              <button
                type="button"
                className="btn-orange-action"
                onClick={() => {
                  router.replace(isStaff ? '/dashboard/teacher/rooms' : '/dashboard/student');
                }}
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
