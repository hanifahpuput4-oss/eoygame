// Admin-only weapon & cosmetic system
// - Weapons (/spawn gun <type>): minigun, laser, mega-laser. Admin only, non-permanent.
// - Jail (/jail on|off): freeze a player in place (cannot move). Admin only.
// - Cosmetics (/change tag|color): spoofed title, custom body/tag/nick colors
//   incl. animated RGB / BLINK / SPIN. Admin only, non-permanent.

export type WeaponType = 'minigun' | 'laser' | 'megalaser';

export type WeaponSpec = {
  id: WeaponType;
  label: string;
  cooldownMs: number;
  damage: number;
  speed: number;
  color: string;
  glow: string;
  length: number;
  thickness: number;
  ammo: number;
  lifetimeMs: number;
};

export const WEAPONS: Record<WeaponType, WeaponSpec> = {
  minigun: {
    id: 'minigun',
    label: 'Minigun',
    cooldownMs: 60,
    damage: 1,
    speed: 15,
    color: '#f97316',
    glow: '#fdba74',
    length: 16,
    thickness: 5,
    ammo: 120,
    lifetimeMs: 20000,
  },
  laser: {
    id: 'laser',
    label: 'Laser',
    cooldownMs: 180,
    damage: 1,
    speed: 17,
    color: '#38bdf8',
    glow: '#bae6fd',
    length: 26,
    thickness: 7,
    ammo: 40,
    lifetimeMs: 25000,
  },
  megalaser: {
    id: 'megalaser',
    label: 'Mega Laser',
    cooldownMs: 650,
    damage: 3,
    speed: 20,
    color: '#a855f7',
    glow: '#e9d5ff',
    length: 56,
    thickness: 16,
    ammo: 15,
    lifetimeMs: 30000,
  },
};

export function parseWeaponType(raw?: string): WeaponType | null {
  const q = (raw ?? '').toLowerCase().replace(/[\s_-]/g, '');
  if (!q) return null;
  if (q === 'minigun' || q === 'mg') return 'minigun';
  if (q === 'laser' || q === 'laserbiasa' || q === 'normal') return 'laser';
  if (q === 'megalaser' || q === 'mega' || q === 'biglaser' || q === 'laser besar') return 'megalaser';
  return null;
}

// ---------- Jail ----------

export const JAIL_FREEZE_MS = 15_000;

// ---------- Colors ----------

export type ColorChannel = 'body' | 'tag' | 'nick';

export type PlayerColors = {
  body?: string;
  tag?: string;
  nick?: string;
};

// Resolve a color argument: hex (#rrggbb), css name, or animated keywords.
// Returns { value, animated } or null when unrecognized.
export function parseColorArg(
  raw?: string,
): { value: string; animated: 'rgb' | 'blink' | 'spin' } | { value: string; animated: null } | null {
  const q = (raw ?? '').trim().toLowerCase();
  if (!q) return null;
  if (q === 'rgb' || q === 'rainbow') return { value: 'rgb', animated: 'rgb' };
  if (q === 'blink') return { value: 'blink', animated: 'blink' };
  if (q === 'spin' || q === 'hue') return { value: 'spin', animated: 'spin' };
  if (/^#[0-9a-f]{6}$/.test(q) || /^#[0-9a-f]{3}$/.test(q)) return { value: q, animated: null };
  if (/^[a-z]{3,20}$/.test(q)) return { value: q, animated: null };
  return null;
}

// Convert an arbitrary CSS color string to a hex string (best effort).
export function toHexColor(cssColor: string): string {
  const c = cssColor.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  if (typeof document === 'undefined') return c;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return c;
  ctx.fillStyle = c;
  const computed = ctx.fillStyle;
  return typeof computed === 'string' ? computed : c;
}

// Animated color resolver: returns the current CSS color at time `now`.
export function resolveAnimatedColor(mode: 'rgb' | 'blink' | 'spin', now: number): string {
  if (mode === 'rgb') {
    const hue = (now * 0.09) % 360;
    return `hsl(${hue}, 95%, 58%)`;
  }
  if (mode === 'blink') {
    const phase = Math.floor(now / 220) % 2;
    return phase === 0 ? '#ffffff' : '#111827';
  }
  // spin: rotating 3-color disco cycle (mirrors Windows setup spinner vibes)
  const idx = Math.floor(now / 160) % 3;
  return ['#38bdf8', '#a855f7', '#f472b6'][idx];
}

// Parse the stored color spec (plain css color or animated keyword) at a point in time.
export function resolvePlayerColor(spec: string | undefined, now: number): string | undefined {
  if (!spec) return undefined;
  const q = spec.toLowerCase();
  if (q === 'rgb') return resolveAnimatedColor('rgb', now);
  if (q === 'blink') return resolveAnimatedColor('blink', now);
  if (q === 'spin') return resolveAnimatedColor('spin', now);
  return spec;
}
