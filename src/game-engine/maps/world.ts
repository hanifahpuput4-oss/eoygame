export const WORLD = {
  width: 5600,
  height: 1100,
  groundY: 820,
};

export const PHYSICS = {
  gravity: 0.52,
  moveSpeed: 4.6,
  jumpVelocity: -12.6,
  bounceVelocity: -16.8,
  maxFallSpeed: 16,
};

export type PlatformType =
  | 'ground'
  | 'grass'
  | 'wood'
  | 'stone'
  | 'crate'
  | 'qblock'
  | 'qblock-correct'
  | 'qblock-wrong'
  | 'bounce'
  | 'spike'
  | 'fire'
  | 'roof'
  | 'crumble'
  | 'moving';

export type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
  type: PlatformType;
  questionId?: string;
  // Moving platform properties
  baseX?: number;
  baseY?: number;
  moveAxis?: 'x' | 'y';
  moveRange?: number;
  moveSpeed?: number;
  movePhase?: number;
  dx?: number;
  dy?: number;
  // Crumbling platform runtime state
  crumbleStartedAt?: number;
  brokenUntil?: number;
};

export type StageEnemy = {
  id: string;
  kind: 'virus' | 'fireball';
  x: number;
  y: number;
  w: number;
  h: number;
  minX: number;
  maxX: number;
  speed: number;
  dir: 1 | -1;
  stompedUntil?: number;
};

export const PLATFORMS: Platform[] = [
  // Main ground (expanded to 5600px)
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },

  // Starting zone & Signboard platform (left)
  { x: 40, y: 710, w: 220, h: 28, type: 'grass' },
  { x: 290, y: 650, w: 180, h: 26, type: 'grass' },

  // Wooden crates stack (can step on each crate)
  { x: 510, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 560, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 535, y: 724, w: 48, h: 48, type: 'crate' },

  // Low floating grass islands & stone steps
  { x: 650, y: 700, w: 190, h: 28, type: 'grass' },
  { x: 890, y: 630, w: 210, h: 28, type: 'grass' },
  { x: 1150, y: 700, w: 220, h: 28, type: 'grass' },

  // Spikes hazard on ground & between platforms (Mario Bros death + respawn to start!)
  { x: 850, y: 794, w: 66, h: 26, type: 'spike' },
  { x: 1410, y: 794, w: 66, h: 26, type: 'spike' },
  { x: 2220, y: 794, w: 88, h: 26, type: 'spike' },
  { x: 3290, y: 794, w: 88, h: 26, type: 'spike' },
  { x: 4040, y: 794, w: 88, h: 26, type: 'spike' },
  { x: 4720, y: 794, w: 88, h: 26, type: 'spike' },

  // Fire hazards (touching sets character on fire for 5 seconds!)
  { x: 635, y: 794, w: 64, h: 26, type: 'fire' },
  { x: 1225, y: 676, w: 56, h: 24, type: 'fire' },
  { x: 1830, y: 794, w: 68, h: 26, type: 'fire' },
  { x: 2535, y: 596, w: 56, h: 24, type: 'fire' },
  { x: 2840, y: 794, w: 68, h: 26, type: 'fire' },
  { x: 3560, y: 794, w: 72, h: 26, type: 'fire' },
  { x: 3720, y: 596, w: 56, h: 24, type: 'fire' },
  { x: 4340, y: 794, w: 72, h: 26, type: 'fire' },
  { x: 4520, y: 516, w: 56, h: 24, type: 'fire' },
  { x: 5010, y: 794, w: 68, h: 26, type: 'fire' },

  // Bounce / trampoline pads (super jump!)
  { x: 770, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 1650, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 2540, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 3440, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 4220, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 4880, y: 798, w: 64, h: 22, type: 'bounce' },

  // School building walkable ledges & roof (center-left)
  { x: 960, y: 510, w: 360, h: 20, type: 'stone' },
  { x: 940, y: 390, w: 400, h: 22, type: 'roof' },
  { x: 1060, y: 285, w: 160, h: 22, type: 'roof' },

  // Mid-section parkour bridges & crates
  { x: 1440, y: 640, w: 200, h: 26, type: 'wood' },
  { x: 1510, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 1700, y: 570, w: 230, h: 28, type: 'grass' },
  { x: 1980, y: 650, w: 210, h: 28, type: 'grass' },
  { x: 1980, y: 460, w: 190, h: 26, type: 'wood' },

  // High sky islands & golden key platform
  { x: 1480, y: 420, w: 200, h: 26, type: 'grass' },
  { x: 1730, y: 310, w: 210, h: 28, type: 'grass' },
  { x: 1380, y: 220, w: 190, h: 26, type: 'stone' },

  // Center-right obstacle tower & stair pyramid
  { x: 2260, y: 710, w: 170, h: 28, type: 'stone' },
  { x: 2470, y: 620, w: 200, h: 28, type: 'grass' },
  { x: 2720, y: 540, w: 200, h: 28, type: 'grass' },
  { x: 2500, y: 470, w: 180, h: 26, type: 'wood' },
  { x: 2740, y: 370, w: 210, h: 28, type: 'stone' },
  { x: 2990, y: 280, w: 220, h: 28, type: 'grass' },

  // Crate pyramid mid-map
  { x: 2960, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 3010, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 3060, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 2985, y: 724, w: 48, h: 48, type: 'crate' },
  { x: 3035, y: 724, w: 48, h: 48, type: 'crate' },
  { x: 3010, y: 676, w: 48, h: 48, type: 'crate' },

  // NEW EXPANDED ZONE 1: Volcano Canyon & Fire Bridges (3180 - 4100)
  { x: 3180, y: 700, w: 220, h: 28, type: 'stone' },
  { x: 3420, y: 610, w: 210, h: 26, type: 'wood' },
  { x: 3650, y: 620, w: 230, h: 28, type: 'stone' },
  { x: 3520, y: 450, w: 200, h: 26, type: 'grass' },
  { x: 3780, y: 350, w: 220, h: 28, type: 'roof' },
  { x: 3930, y: 690, w: 190, h: 28, type: 'grass' },
  { x: 3860, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 4030, y: 520, w: 210, h: 26, type: 'wood' },

  // NEW EXPANDED ZONE 2: Sky Citadel & High Parkour (4150 - 5050)
  { x: 4180, y: 670, w: 220, h: 28, type: 'grass' },
  { x: 4440, y: 540, w: 230, h: 28, type: 'stone' },
  { x: 4260, y: 390, w: 210, h: 26, type: 'grass' },
  { x: 4540, y: 280, w: 220, h: 28, type: 'roof' },
  { x: 4720, y: 640, w: 210, h: 28, type: 'wood' },
  { x: 4820, y: 450, w: 210, h: 28, type: 'grass' },
  { x: 4630, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 4680, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 4655, y: 724, w: 48, h: 48, type: 'crate' },

  // NEW EXPANDED ZONE 3: Fortress Finish Terrace (5100 - 5520)
  { x: 5120, y: 700, w: 380, h: 32, type: 'grass' },
  { x: 5180, y: 540, w: 260, h: 26, type: 'stone' },
];

export const DECOR = {
  school: { x: 960, y: 400, w: 360, h: 420 },
  trees: [
    { x: 260, y: 820, s: 1.1 },
    { x: 470, y: 820, s: 0.95 },
    { x: 740, y: 700, s: 0.85 },
    { x: 910, y: 820, s: 1.05 },
    { x: 1370, y: 820, s: 1.1 },
    { x: 1610, y: 820, s: 0.95 },
    { x: 1810, y: 570, s: 0.8 },
    { x: 2150, y: 820, s: 1.15 },
    { x: 2420, y: 820, s: 1.0 },
    { x: 2680, y: 820, s: 1.05 },
    { x: 2890, y: 820, s: 0.95 },
    { x: 3140, y: 820, s: 1.1 },
    { x: 3510, y: 820, s: 1.0 },
    { x: 3810, y: 820, s: 1.1 },
    { x: 4150, y: 820, s: 0.95 },
    { x: 4480, y: 820, s: 1.15 },
    { x: 4830, y: 820, s: 1.0 },
    { x: 5100, y: 820, s: 1.05 },
    { x: 5480, y: 820, s: 1.1 },
  ],
  clouds: [
    { x: 180, y: 130, s: 1.0 },
    { x: 560, y: 85, s: 1.25 },
    { x: 980, y: 120, s: 0.95 },
    { x: 1420, y: 75, s: 1.3 },
    { x: 1880, y: 135, s: 1.05 },
    { x: 2340, y: 95, s: 1.2 },
    { x: 2820, y: 125, s: 0.9 },
    { x: 3280, y: 85, s: 1.15 },
    { x: 3740, y: 110, s: 1.2 },
    { x: 4220, y: 80, s: 1.05 },
    { x: 4720, y: 125, s: 1.25 },
    { x: 5210, y: 90, s: 1.1 },
  ],
  sign: { x: 95, y: 625, text: 'Kerja sama tim untuk menyelesaikan setiap tantangan!' },
  gate: { x: 5240, y: 540 },
};

export const SPAWN_POINTS = Array.from({ length: 48 }, (_, i) => ({
  x: 100 + (i % 16) * 45,
  y: 740 - Math.floor(i / 16) * 60,
}));

export const QBLOCK_CANDIDATE_SPOTS: { x: number; y: number }[] = [
  { x: 340, y: 530 },
  { x: 535, y: 610 },
  { x: 720, y: 575 },
  { x: 960, y: 505 },
  { x: 1030, y: 390 },
  { x: 1115, y: 270 },
  { x: 1120, y: 165 },
  { x: 1270, y: 575 },
  { x: 1510, y: 515 },
  { x: 1555, y: 295 },
  { x: 1450, y: 105 },
  { x: 1790, y: 445 },
  { x: 1810, y: 185 },
  { x: 2040, y: 530 },
  { x: 2050, y: 335 },
  { x: 2320, y: 585 },
  { x: 2540, y: 495 },
  { x: 2565, y: 345 },
  { x: 2810, y: 415 },
  { x: 2820, y: 245 },
  { x: 3010, y: 555 },
  { x: 3075, y: 155 },
  { x: 3255, y: 575 },
  { x: 3480, y: 485 },
  { x: 3585, y: 325 },
  { x: 3740, y: 495 },
  { x: 3850, y: 225 },
  { x: 4100, y: 395 },
  { x: 4255, y: 545 },
  { x: 4330, y: 265 },
  { x: 4510, y: 415 },
  { x: 4610, y: 160 },
  { x: 4785, y: 515 },
  { x: 4890, y: 325 },
  { x: 5060, y: 575 },
];

export const STAGE2_PLATFORMS: Platform[] = [
  // Main ground
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },

  // Starting zone (left)
  { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
  { x: 310, y: 650, w: 170, h: 24, type: 'crumble' },
  { x: 530, y: 590, w: 180, h: 26, type: 'stone' },

  // First Moving Bridge & Spike Pit
  { x: 720, y: 794, w: 132, h: 26, type: 'spike' },
  { x: 750, y: 660, w: 170, h: 24, type: 'moving', baseX: 750, baseY: 660, moveAxis: 'x', moveRange: 95, moveSpeed: 0.0022, movePhase: 0 },

  // Sunset Cyber-Tower ledges & elevator (960 - 1340)
  { x: 960, y: 520, w: 360, h: 22, type: 'stone' },
  { x: 940, y: 390, w: 400, h: 22, type: 'roof' },
  { x: 1050, y: 270, w: 180, h: 22, type: 'roof' },
  { x: 870, y: 798, w: 64, h: 22, type: 'bounce' },

  // Crumbling Sky Steps & Vertical Lift (1420 - 2180)
  { x: 1420, y: 660, w: 175, h: 24, type: 'crumble' },
  { x: 1520, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 1660, y: 570, w: 170, h: 24, type: 'moving', baseX: 1660, baseY: 470, moveAxis: 'y', moveRange: 120, moveSpeed: 0.0024, movePhase: 1.2 },
  { x: 1890, y: 630, w: 220, h: 28, type: 'stone' },
  { x: 1920, y: 380, w: 190, h: 24, type: 'crumble' },
  { x: 1620, y: 250, w: 200, h: 26, type: 'roof' },
  { x: 2140, y: 798, w: 64, h: 22, type: 'bounce' },

  // Mid-Arena Virus Gauntlet & Crumble Bridge (2240 - 3150)
  { x: 2240, y: 680, w: 320, h: 28, type: 'stone' },
  { x: 2610, y: 600, w: 170, h: 24, type: 'crumble' },
  { x: 2830, y: 530, w: 260, h: 28, type: 'stone' },
  { x: 2480, y: 430, w: 190, h: 24, type: 'moving', baseX: 2480, baseY: 430, moveAxis: 'x', moveRange: 110, moveSpeed: 0.0025, movePhase: 2.1 },
  { x: 2820, y: 310, w: 230, h: 26, type: 'roof' },
  { x: 2620, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 3060, y: 798, w: 64, h: 22, type: 'bounce' },

  // Zone 3: Sunset Canyon & Dual Moving Lifts (3180 - 4120)
  { x: 3180, y: 690, w: 280, h: 28, type: 'stone' },
  { x: 3510, y: 610, w: 170, h: 24, type: 'crumble' },
  { x: 3730, y: 530, w: 180, h: 24, type: 'moving', baseX: 3730, baseY: 530, moveAxis: 'x', moveRange: 95, moveSpeed: 0.0026, movePhase: 0.7 },
  { x: 3460, y: 390, w: 220, h: 26, type: 'stone' },
  { x: 3780, y: 280, w: 220, h: 26, type: 'roof' },
  { x: 3980, y: 660, w: 240, h: 28, type: 'stone' },
  { x: 3540, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 3890, y: 794, w: 72, h: 26, type: 'fire' },

  // Zone 4: Final Citadel Approach (4220 - 5500)
  { x: 4250, y: 580, w: 175, h: 24, type: 'crumble' },
  { x: 4480, y: 500, w: 260, h: 28, type: 'stone' },
  { x: 4320, y: 330, w: 200, h: 24, type: 'moving', baseX: 4320, baseY: 330, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 1.9 },
  { x: 4620, y: 240, w: 210, h: 26, type: 'roof' },
  { x: 4790, y: 620, w: 175, h: 24, type: 'crumble' },
  { x: 4880, y: 420, w: 210, h: 26, type: 'stone' },
  { x: 4340, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 4720, y: 798, w: 64, h: 22, type: 'bounce' },

  // Finish Gate Terrace
  { x: 5120, y: 700, w: 380, h: 32, type: 'stone' },
  { x: 5180, y: 540, w: 260, h: 26, type: 'roof' },
];

export const STAGE2_QBLOCK_SPOTS: { x: number; y: number }[] = [
  { x: 365, y: 525 },
  { x: 590, y: 465 },
  { x: 785, y: 520 },
  { x: 1010, y: 400 },
  { x: 1115, y: 150 },
  { x: 1245, y: 400 },
  { x: 1480, y: 535 },
  { x: 1690, y: 130 },
  { x: 1980, y: 505 },
  { x: 1990, y: 255 },
  { x: 2370, y: 555 },
  { x: 2520, y: 295 },
  { x: 2670, y: 475 },
  { x: 2920, y: 405 },
  { x: 2910, y: 185 },
  { x: 3290, y: 565 },
  { x: 3545, y: 265 },
  { x: 3780, y: 395 },
  { x: 3865, y: 155 },
  { x: 4075, y: 535 },
  { x: 4310, y: 455 },
  { x: 4585, y: 375 },
  { x: 4700, y: 120 },
  { x: 4960, y: 295 },
];

export function createStageEnemies(stage: number): StageEnemy[] {
  if (stage <= 1) return [];
  return [
    // Ground & platform patrolling Viruses (can be dodged or stomped from above!)
    { id: 'v1', kind: 'virus', x: 420, y: 780, w: 38, h: 40, minX: 290, maxX: 670, speed: 1.9, dir: 1 },
    { id: 'v2', kind: 'virus', x: 1120, y: 480, w: 38, h: 40, minX: 975, maxX: 1270, speed: 1.7, dir: -1 },
    { id: 'v3', kind: 'virus', x: 2340, y: 640, w: 38, h: 40, minX: 2255, maxX: 2510, speed: 1.8, dir: 1 },
    { id: 'v4', kind: 'virus', x: 3280, y: 650, w: 38, h: 40, minX: 3195, maxX: 3410, speed: 2.0, dir: -1 },
    { id: 'v5', kind: 'virus', x: 4560, y: 460, w: 38, h: 40, minX: 4495, maxX: 4690, speed: 1.9, dir: 1 },
    // Fast rolling Fireballs on ground/ledges (must jump over!)
    { id: 'f1', kind: 'fireball', x: 1820, y: 786, w: 34, h: 34, minX: 1660, maxX: 2090, speed: 2.6, dir: 1 },
    { id: 'f2', kind: 'fireball', x: 2880, y: 786, w: 34, h: 34, minX: 2750, maxX: 3030, speed: 2.7, dir: -1 },
    { id: 'f3', kind: 'fireball', x: 3720, y: 786, w: 34, h: 34, minX: 3670, maxX: 3860, speed: 2.5, dir: 1 },
    { id: 'f4', kind: 'fireball', x: 4920, y: 786, w: 34, h: 34, minX: 4810, maxX: 5090, speed: 2.8, dir: -1 },
  ];
}

export function getStageBasePlatforms(stage: number): Platform[] {
  const src = stage === 2 ? STAGE2_PLATFORMS : PLATFORMS;
  return src.map((p) => ({ ...p }));
}

export function generateQuestionBlocks(questionIds: string[], seedStr: string, stage = 1): Platform[] {
  if (questionIds.length === 0) return [];
  let seed = 2166136261;
  const fullSeed = `${seedStr}:stage${stage}`;
  for (let i = 0; i < fullSeed.length; i += 1) {
    seed ^= fullSeed.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const baseSpots = stage === 2 ? STAGE2_QBLOCK_SPOTS : QBLOCK_CANDIDATE_SPOTS;
  const pool = [...baseSpots];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return questionIds.map((qid, idx) => {
    const spot = pool[idx % pool.length];
    const jitterX = Math.round((nextRand() - 0.5) * 16);
    const jitterY = Math.round((nextRand() - 0.5) * 10);
    const tierOffset = Math.floor(idx / pool.length) * 64;
    return {
      x: Math.max(260, Math.min(5080, spot.x + jitterX + tierOffset)),
      y: Math.max(80, Math.min(WORLD.groundY - 90, spot.y + jitterY)),
      w: 48,
      h: 48,
      type: 'qblock' as const,
      questionId: qid,
    };
  });
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
