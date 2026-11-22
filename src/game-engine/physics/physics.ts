import { DECOR, PHYSICS, PLATFORMS, WORLD, rectsOverlap, type Platform, type StageEnemy, type StagePowerUp } from '../maps/world';

export type Player = {
  id: string;
  username: string;
  fullName?: string;
  avatar: string;
  role?: string;
  stage?: number;
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
  ridingPlatform?: Platform | null;
  spawnX?: number;
  spawnY?: number;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  blasterAmmo?: number;
  blasterUntil?: number;
  isGodMode?: boolean;
  lastPacketAt?: number;
  avgInterval?: number;
  snapshots?: { x: number; y: number; vx: number; vy: number; time: number }[];
};

export type Projectile = {
  id: string;
  x: number;
  y: number;
  vx: number;
  shooterId: string;
  stage: number;
  createdAt: number;
};

const PLAYER_W = 36;
const PLAYER_H = 44;

function isSolidBox(type: string) {
  return type === 'crate' || type === 'qblock' || type === 'qblock-correct' || type === 'qblock-wrong' || type === 'qblock-assisted';
}

function isQuestionBox(type: string) {
  return type === 'qblock' || type === 'qblock-correct' || type === 'qblock-wrong' || type === 'qblock-assisted';
}

function respawnToStart(p: Player) {
  p.isDying = false;
  p.deathStartedAt = undefined;
  p.burnUntil = undefined;
  p.blasterAmmo = 0;
  p.blasterUntil = undefined;
  p.x = p.spawnX ?? 120;
  p.y = p.spawnY ?? WORLD.groundY - PLAYER_H - 20;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.ridingPlayerId = null;
  p.lastCarrierX = undefined;
  p.ridingPlatform = null;
}

export function updateStageEntities(
  basePlatforms: Platform[],
  enemies: StageEnemy[],
  dtScale = 1,
  now = Date.now(),
  powerUps: StagePowerUp[] = [],
  projectiles: Projectile[] = [],
  onProjectileHitEnemy?: (projId: string, enemyId: string) => void,
) {
  for (const plat of basePlatforms) {
    if (plat.type === 'moving') {
      const bx = plat.baseX ?? plat.x;
      const by = plat.baseY ?? plat.y;
      const range = plat.moveRange ?? 90;
      const speed = plat.moveSpeed ?? 0.0022;
      const phase = plat.movePhase ?? 0;
      const offset = Math.sin(now * speed + phase) * range;
      const prevX = plat.x;
      const prevY = plat.y;
      if (plat.moveAxis === 'y') {
        plat.y = by + offset;
        plat.dx = 0;
        plat.dy = plat.y - prevY;
      } else {
        plat.x = bx + offset;
        plat.dx = plat.x - prevX;
        plat.dy = 0;
      }
    } else if (plat.type === 'crumble') {
      if (plat.crumbleStartedAt) {
        const elapsed = now - plat.crumbleStartedAt;
        if (elapsed >= 3550) {
          plat.brokenUntil = undefined;
          plat.crumbleStartedAt = undefined;
        } else if (elapsed >= 1150) {
          plat.brokenUntil = plat.crumbleStartedAt + 3550;
        }
      } else if (plat.brokenUntil && now >= plat.brokenUntil) {
        plat.brokenUntil = undefined;
      }
    }
  }

  for (const enemy of enemies) {
    if (enemy.stompedUntil && enemy.stompedUntil > now) continue;
    const span = (enemy.maxX - enemy.w) - enemy.minX;
    if (span <= 0) continue;
    const speedPxPerMs = enemy.speed * 0.06;
    const halfPeriod = span / speedPxPerMs;
    const fullPeriod = 2 * halfPeriod;
    const idOffset = (enemy.id.charCodeAt(0) * 499) + ((enemy.id.charCodeAt(1) || 0) * 137);
    const t = ((now + idOffset) % fullPeriod + fullPeriod) % fullPeriod;
    if (t < halfPeriod) {
      enemy.x = enemy.minX + t * speedPxPerMs;
      enemy.dir = 1;
    } else {
      enemy.x = (enemy.maxX - enemy.w) - (t - halfPeriod) * speedPxPerMs;
      enemy.dir = -1;
    }
  }

  // Update powerup item respawn timers
  for (const pu of powerUps) {
    if (pu.collectedUntil && now >= pu.collectedUntil) {
      pu.collectedUntil = undefined;
    }
  }

  // Update projectiles (lasers)
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const pr = projectiles[i];
    pr.x += pr.vx * dtScale;
    const pBox = { x: pr.x - 12, y: pr.y - 7, w: 24, h: 14 };
    let hit = false;
    for (const e of enemies) {
      if (e.stompedUntil && e.stompedUntil > now) continue;
      const eHitbox = { x: e.x + 2, y: e.y + 2, w: e.w - 4, h: e.h - 4 };
      if (rectsOverlap(pBox, eHitbox)) {
        e.stompedUntil = now + 9000;
        onProjectileHitEnemy?.(pr.id, e.id);
        hit = true;
        break;
      }
    }
    if (hit || pr.x < 0 || pr.x > WORLD.width || now - pr.createdAt > 3200) {
      projectiles.splice(i, 1);
    }
  }
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
  stageOptions?: {
    basePlatforms?: Platform[];
    enemies?: StageEnemy[];
    powerUps?: StagePowerUp[];
    isGateUnlocked?: boolean;
    onEnterGate?: () => void;
    isStaff?: boolean;
    onObstacleEvent?: (
      evt:
        | { op: 'crumble'; stg: number; idx: number; at: number }
        | { op: 'stomp'; stg: number; id: string; until: number }
        | { op: 'powerup'; stg: number; id: string; until: number }
        | { op: 'shoot'; stg: number; pid: string; x: number; y: number; vx: number },
    ) => void;
    onCollectPowerUp?: (pu: StagePowerUp) => void;
  },
) {
  const now = Date.now();

  // Super Mario Bros style death animation sequence when hitting spikes or enemies
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

  const basePlats = stageOptions?.basePlatforms ?? PLATFORMS;
  const allPlatforms = extraPlatforms.length > 0 ? [...basePlats, ...extraPlatforms] : basePlats;
  const isBurning = Boolean(p.burnUntil && p.burnUntil > now);
  const activeMoveSpeed = isBurning ? PHYSICS.moveSpeed * 1.2 : PHYSICS.moveSpeed;

  // Carry player when standing on a moving platform
  if (p.ridingPlatform && p.ridingPlatform.type === 'moving') {
    p.x += p.ridingPlatform.dx ?? 0;
    p.y += p.ridingPlatform.dy ?? 0;
  }

  // Carry rider horizontally when standing on another player
  if (p.ridingPlayerId) {
    for (const other of otherPlayers) {
      if (other.id === p.ridingPlayerId) {
        if ((other.stage ?? 1) !== (p.stage ?? 1)) {
          p.ridingPlayerId = null;
          p.lastCarrierX = undefined;
          break;
        }
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
    p.ridingPlatform = null;
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
  let newRidingPlatform: Platform | null = null;

  const box = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
  for (const plat of allPlatforms) {
    if (plat.type === 'crumble' && plat.brokenUntil && now < plat.brokenUntil) {
      continue;
    }
    if (!rectsOverlap(box, plat)) continue;

    if (plat.type === 'spike') {
      if (p.isGodMode) {
        p.vy = -8.5;
        p.onGround = false;
        onSoundEvent?.('bounce');
        continue;
      }
      p.isDying = true;
      p.deathStartedAt = now;
      p.vx = 0;
      p.vy = -13.2;
      p.onGround = false;
      p.ridingPlayerId = null;
      p.lastCarrierX = undefined;
      p.ridingPlatform = null;
      onSoundEvent?.('death');
      return;
    }

    if (plat.type === 'fire') {
      if (p.isGodMode) continue;
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
    const topThreshold = plat.type === 'moving' ? 18 : 14;
    if (p.vy >= 0 && prevY + PLAYER_H <= plat.y + topThreshold) {
      p.y = plat.y - PLAYER_H;
      if (plat.type === 'bounce') {
        p.vy = PHYSICS.bounceVelocity;
        p.onGround = false;
        onSoundEvent?.('bounce');
      } else {
        p.vy = 0;
        p.onGround = true;
        if (plat.type === 'moving') {
          newRidingPlatform = plat;
        } else if (plat.type === 'crumble' && !plat.crumbleStartedAt) {
          plat.crumbleStartedAt = now;
          const platIndex = stageOptions?.basePlatforms ? stageOptions.basePlatforms.indexOf(plat) : -1;
          if (platIndex >= 0) {
            stageOptions?.onObstacleEvent?.({
              op: 'crumble',
              stg: p.stage ?? 1,
              idx: platIndex,
              at: now,
            });
          }
        }
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

  // Collectible Power-Up Items (Blaster & Stars)
  const powerUps = stageOptions?.powerUps ?? [];
  for (const pu of powerUps) {
    if (pu.collectedUntil && pu.collectedUntil > now) continue;
    const puBox = { x: pu.x, y: pu.y, w: pu.w, h: pu.h };
    if (rectsOverlap(box, puBox)) {
      pu.collectedUntil = now + 40000;
      p.blasterAmmo = p.isGodMode ? 999 : 10;
      p.blasterUntil = p.isGodMode ? now + 99999999 : now + 30000;
      stageOptions?.onCollectPowerUp?.(pu);
      stageOptions?.onObstacleEvent?.({
        op: 'powerup',
        stg: p.stage ?? 1,
        id: pu.id,
        until: now + 40000,
      });
    }
  }

  // Stage Enemy collisions (Monster Virus & Walking Fireballs)
  const enemies = stageOptions?.enemies ?? [];
  for (const enemy of enemies) {
    if (enemy.stompedUntil && enemy.stompedUntil > now) continue;
    const eHitbox = { x: enemy.x + 3, y: enemy.y + 3, w: enemy.w - 6, h: enemy.h - 4 };
    if (!rectsOverlap(box, eHitbox)) continue;

    // Super Cat invulnerability shield or God Mode defeats enemy on touch!
    if (p.isGodMode || (p.blasterUntil && p.blasterUntil > now)) {
      enemy.stompedUntil = now + 9000;
      p.vy = -10.5;
      p.onGround = false;
      onSoundEvent?.('bounce');
      stageOptions?.onObstacleEvent?.({
        op: 'stomp',
        stg: p.stage ?? 1,
        id: enemy.id,
        until: now + 9000,
      });
      continue;
    }

    // Mario-style Stomp on top of Virus head!
    if (enemy.kind === 'virus' && p.vy > 0 && prevY + PLAYER_H <= enemy.y + enemy.h * 0.55) {
      enemy.stompedUntil = now + 6000;
      p.y = enemy.y - PLAYER_H;
      p.vy = -12.6;
      p.onGround = false;
      onSoundEvent?.('bounce');
      box.y = p.y;
      stageOptions?.onObstacleEvent?.({
        op: 'stomp',
        stg: p.stage ?? 1,
        id: enemy.id,
        until: now + 6000,
      });
      continue;
    }

    // Otherwise touching Virus from side or touching Fireball causes KO!
    p.isDying = true;
    p.deathStartedAt = now;
    p.vx = 0;
    p.vy = -13.2;
    p.onGround = false;
    p.ridingPlayerId = null;
    p.lastCarrierX = undefined;
    p.ridingPlatform = null;
    onSoundEvent?.('death');
    return;
  }

  // Exit Gate Portal check (when all questions in current stage are answered)
  if (stageOptions?.isGateUnlocked && stageOptions.onEnterGate) {
    const gateBox = { x: DECOR.gate.x + 22, y: DECOR.gate.y + 24, w: 86, h: 136 };
    if (rectsOverlap(box, gateBox)) {
      stageOptions.onEnterGate();
    }
  }

  // Player-on-player stacking (gendong-gendongan)
  for (const other of otherPlayers) {
    if (other.id === p.id) continue;
    if ((other.stage ?? 1) !== (p.stage ?? 1)) continue;
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
  p.ridingPlatform = newRidingPlatform;

  if (p.y > WORLD.height + 200) {
    p.x = 120;
    p.y = WORLD.groundY - PLAYER_H - 20;
    p.vy = 0;
  }
}

export { PLAYER_W, PLAYER_H };
