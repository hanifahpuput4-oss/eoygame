import { PHYSICS, PLATFORMS, WORLD, rectsOverlap, type Platform } from '../maps/world';

export type Player = {
  id: string;
  username: string;
  avatar: string;
  role?: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  ridingPlayerId?: string | null;
  lastCarrierX?: number;
  spawnX?: number;
  spawnY?: number;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  lastPacketAt?: number;
  avgInterval?: number;
  snapshots?: { x: number; y: number; vx: number; vy: number; time: number }[];
};

const PLAYER_W = 36;
const PLAYER_H = 44;

function isSolidBox(type: string) {
  return type === 'crate' || type === 'qblock' || type === 'qblock-correct' || type === 'qblock-wrong';
}

function isQuestionBox(type: string) {
  return type === 'qblock' || type === 'qblock-correct' || type === 'qblock-wrong';
}

function respawnToStart(p: Player) {
  p.isDying = false;
  p.deathStartedAt = undefined;
  p.burnUntil = undefined;
  p.x = p.spawnX ?? 120;
  p.y = p.spawnY ?? WORLD.groundY - PLAYER_H - 20;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.ridingPlayerId = null;
  p.lastCarrierX = undefined;
}

export type PhysicsSoundEvent = 'jump' | 'bounce' | 'burn' | 'death';

export function updatePlayerPhysics(
  p: Player,
  input: { left: boolean; right: boolean; jump: boolean },
  otherPlayers: Iterable<Player> = [],
  extraPlatforms: Platform[] = [],
  onTouchQuestionBlock?: (questionId: string) => void,
  dtScale = 1,
  onSoundEvent?: (event: PhysicsSoundEvent) => void,
) {
  const now = Date.now();

  // Super Mario Bros style death animation sequence when hitting spikes
  if (p.isDying) {
    const elapsed = now - (p.deathStartedAt ?? now);
    // 0-180ms: freeze in shock before flying up & falling through screen
    if (elapsed >= 180) {
      const prevVy = p.vy;
      p.vy = Math.min(p.vy + PHYSICS.gravity * 0.92 * dtScale, PHYSICS.maxFallSpeed);
      const stepVy = Math.min(prevVy + 0.5 * PHYSICS.gravity * 0.92 * (dtScale + 1), PHYSICS.maxFallSpeed);
      p.y += stepVy * dtScale;
    }
    if (elapsed >= 1200 || p.y > WORLD.height + 240) {
      respawnToStart(p);
    }
    return;
  }

  const allPlatforms = extraPlatforms.length > 0 ? [...PLATFORMS, ...extraPlatforms] : PLATFORMS;
  const isBurning = Boolean(p.burnUntil && p.burnUntil > now);
  const activeMoveSpeed = isBurning ? PHYSICS.moveSpeed * 1.2 : PHYSICS.moveSpeed;

  // Carry rider horizontally when standing on another player
  if (p.ridingPlayerId) {
    for (const other of otherPlayers) {
      if (other.id === p.ridingPlayerId) {
        if (p.lastCarrierX !== undefined) {
          const carrierDx = other.x - p.lastCarrierX;
          if (Math.abs(carrierDx) < 120) {
            p.x += carrierDx;
          }
        }
        p.lastCarrierX = other.x;
        break;
      }
    }
  }

  if (input.left) {
    p.vx = -activeMoveSpeed;
    p.facing = -1;
  } else if (input.right) {
    p.vx = activeMoveSpeed;
    p.facing = 1;
  } else {
    p.vx *= Math.pow(0.6, dtScale);
    if (Math.abs(p.vx) < 0.1) p.vx = 0;
  }

  if (input.jump && p.onGround) {
    p.vy = PHYSICS.jumpVelocity;
    p.onGround = false;
    p.ridingPlayerId = null;
    p.lastCarrierX = undefined;
    onSoundEvent?.('jump');
  }

  const prevVy = p.vy;
  p.vy = Math.min(p.vy + PHYSICS.gravity * dtScale, PHYSICS.maxFallSpeed);
  const stepVy = Math.min(prevVy + 0.5 * PHYSICS.gravity * (dtScale + 1), PHYSICS.maxFallSpeed);

  const prevX = p.x;
  p.x += p.vx * dtScale;
  p.x = Math.max(0, Math.min(WORLD.width - PLAYER_W, p.x));

  // Horizontal collision with solid block obstacles (crates, qblocks)
  const hBox = { x: p.x, y: p.y + 4, w: PLAYER_W, h: PLAYER_H - 8 };
  for (const plat of allPlatforms) {
    if (!isSolidBox(plat.type)) continue;
    if (!rectsOverlap(hBox, plat)) continue;
    if (prevX + PLAYER_W <= plat.x + 4) {
      p.x = plat.x - PLAYER_W;
      p.vx = 0;
      if (isQuestionBox(plat.type) && plat.questionId && onTouchQuestionBlock) {
        onTouchQuestionBlock(plat.questionId);
      }
    } else if (prevX >= plat.x + plat.w - 4) {
      p.x = plat.x + plat.w;
      p.vx = 0;
      if (isQuestionBox(plat.type) && plat.questionId && onTouchQuestionBlock) {
        onTouchQuestionBlock(plat.questionId);
      }
    }
    hBox.x = p.x;
  }

  const prevY = p.y;
  p.y += stepVy * dtScale;
  p.onGround = false;
  let newCarrierId: string | null = null;
  let newCarrierX: number | undefined;

  const box = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
  for (const plat of allPlatforms) {
    if (!rectsOverlap(box, plat)) continue;

    if (plat.type === 'spike') {
      p.isDying = true;
      p.deathStartedAt = now;
      p.vx = 0;
      p.vy = -13.2;
      p.onGround = false;
      p.ridingPlayerId = null;
      p.lastCarrierX = undefined;
      onSoundEvent?.('death');
      return;
    }

    if (plat.type === 'fire') {
      const alreadyBurning = Boolean(p.burnUntil && p.burnUntil > now + 4400);
      p.burnUntil = now + 5000;
      if (!alreadyBurning) {
        onSoundEvent?.('burn');
        if (p.vy >= -4) {
          p.vy = -8.6;
          p.onGround = false;
        }
      }
      continue;
    }

    // Landing on top of any platform or obstacle
    if (p.vy >= 0 && prevY + PLAYER_H <= plat.y + 14) {
      p.y = plat.y - PLAYER_H;
      if (plat.type === 'bounce') {
        p.vy = PHYSICS.bounceVelocity;
        p.onGround = false;
        onSoundEvent?.('bounce');
      } else {
        p.vy = 0;
        p.onGround = true;
      }
      box.y = p.y;
      if (isQuestionBox(plat.type) && plat.questionId && onTouchQuestionBlock) {
        onTouchQuestionBlock(plat.questionId);
      }
    } else if (
      isSolidBox(plat.type) &&
      p.vy < 0 &&
      prevY >= plat.y + plat.h - 12
    ) {
      // Hitting bottom of crate or question block
      p.y = plat.y + plat.h;
      p.vy = 1.8;
      box.y = p.y;
      if (isQuestionBox(plat.type) && plat.questionId && onTouchQuestionBlock) {
        onTouchQuestionBlock(plat.questionId);
      }
    }
  }

  // Player-on-player stacking (gendong-gendongan)
  for (const other of otherPlayers) {
    if (other.id === p.id) continue;
    const headTop = other.y + 4; // allow feet to rest naturally on top of cat head
    const overlapX = p.x + PLAYER_W > other.x + 4 && p.x < other.x + PLAYER_W - 4;
    if (!overlapX) continue;

    const wasAbove = prevY + PLAYER_H <= headTop + 16;
    const isAtOrBelowTop = p.y + PLAYER_H >= headTop && p.y + PLAYER_H <= headTop + 26;

    if (p.vy >= 0 && wasAbove && isAtOrBelowTop) {
      p.y = headTop - PLAYER_H;
      p.vy = 0;
      p.onGround = true;
      newCarrierId = other.id;
      newCarrierX = other.x;
      box.y = p.y;
    }
  }

  p.ridingPlayerId = newCarrierId;
  p.lastCarrierX = newCarrierX;

  if (p.y > WORLD.height + 200) {
    p.x = 120;
    p.y = WORLD.groundY - PLAYER_H - 20;
    p.vy = 0;
  }
}

export { PLAYER_W, PLAYER_H };
