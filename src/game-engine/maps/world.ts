export const WORLD = {
  width: 3600,
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

export type PlatformType = 'ground' | 'grass' | 'wood' | 'stone' | 'crate' | 'qblock' | 'qblock-correct' | 'qblock-wrong' | 'bounce' | 'spike' | 'roof';

export type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
  type: PlatformType;
  questionId?: string;
};

export const PLATFORMS: Platform[] = [
  // Main ground
  { x: 0, y: 820, w: 3600, h: 280, type: 'ground' },

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

  // Spikes hazard on ground & between platforms (touching launches/resets slightly)
  { x: 850, y: 794, w: 66, h: 26, type: 'spike' },
  { x: 1410, y: 794, w: 66, h: 26, type: 'spike' },
  { x: 2220, y: 794, w: 88, h: 26, type: 'spike' },

  // Bounce / trampoline pads (super jump!)
  { x: 770, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 1650, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 2540, y: 798, w: 64, h: 22, type: 'bounce' },

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

  // Right-side obstacle tower & stair pyramid
  { x: 2260, y: 710, w: 170, h: 28, type: 'stone' },
  { x: 2470, y: 620, w: 200, h: 28, type: 'grass' },
  { x: 2720, y: 540, w: 200, h: 28, type: 'grass' },
  { x: 2500, y: 470, w: 180, h: 26, type: 'wood' },
  { x: 2740, y: 370, w: 210, h: 28, type: 'stone' },
  { x: 2990, y: 280, w: 220, h: 28, type: 'grass' },

  // Crate pyramid near finish gate
  { x: 2960, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 3010, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 3060, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 2985, y: 724, w: 48, h: 48, type: 'crate' },
  { x: 3035, y: 724, w: 48, h: 48, type: 'crate' },
  { x: 3010, y: 676, w: 48, h: 48, type: 'crate' },

  // Finish gate fortress terrace
  { x: 3180, y: 700, w: 340, h: 32, type: 'grass' },
  { x: 3240, y: 540, w: 220, h: 26, type: 'stone' },
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
  ],
  sign: { x: 95, y: 625, text: 'Kerja sama tim untuk menyelesaikan setiap tantangan!' },
  gate: { x: 3300, y: 540 },
};

export const SPAWN_POINTS = Array.from({ length: 48 }, (_, i) => ({
  x: 100 + (i % 16) * 65,
  y: 740 - Math.floor(i / 16) * 60,
}));

export const QBLOCK_CANDIDATE_SPOTS: { x: number; y: number }[] = [
  { x: 160, y: 580 },
  { x: 350, y: 530 },
  { x: 470, y: 690 },
  { x: 610, y: 600 },
  { x: 720, y: 575 },
  { x: 840, y: 500 },
  { x: 970, y: 505 },
  { x: 1030, y: 390 },
  { x: 1115, y: 270 },
  { x: 1120, y: 165 },
  { x: 1230, y: 575 },
  { x: 1340, y: 690 },
  { x: 1510, y: 515 },
  { x: 1555, y: 295 },
  { x: 1450, y: 100 },
  { x: 1690, y: 690 },
  { x: 1790, y: 445 },
  { x: 1810, y: 185 },
  { x: 1990, y: 530 },
  { x: 2050, y: 335 },
  { x: 2150, y: 690 },
  { x: 2320, y: 585 },
  { x: 2430, y: 495 },
  { x: 2565, y: 495 },
  { x: 2565, y: 345 },
  { x: 2680, y: 690 },
  { x: 2795, y: 415 },
  { x: 2820, y: 245 },
  { x: 3075, y: 155 },
  { x: 3010, y: 555 },
  { x: 3255, y: 575 },
  { x: 3325, y: 415 },
  { x: 3440, y: 575 },
];

export function generateQuestionBlocks(questionIds: string[], seedStr: string): Platform[] {
  if (questionIds.length === 0) return [];
  let seed = 2166136261;
  for (let i = 0; i < seedStr.length; i += 1) {
    seed ^= seedStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const pool = [...QBLOCK_CANDIDATE_SPOTS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return questionIds.map((qid, idx) => {
    const spot = pool[idx % pool.length];
    const jitterX = Math.round((nextRand() - 0.5) * 28);
    const jitterY = Math.round((nextRand() - 0.5) * 14);
    const tierOffset = Math.floor(idx / pool.length) * 64;
    return {
      x: Math.max(40, Math.min(WORLD.width - 90, spot.x + jitterX + tierOffset)),
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
