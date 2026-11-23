import { DECOR, WORLD, type Platform, type StageBoss, type StageEnemy, type StagePowerUp } from '../maps/world';
import type { Projectile } from '../physics/physics';
import { resolvePlayerColor, toHexColor } from '../physics/weapons';

export type StageRenderInfo = {
  stage: number;
  totalStages: number;
  stageAnswered: number;
  stageTotal: number;
  isGateUnlocked: boolean;
  bossAlive?: boolean;
};

const AVATAR_COLORS: Record<string, { body: string; belly: string; ear: string }> = {
  'cat-blue': { body: '#3b82f6', belly: '#bfdbfe', ear: '#1d4ed8' },
  'cat-pink': { body: '#ec4899', belly: '#fbcfe8', ear: '#be185d' },
  'cat-green': { body: '#22c55e', belly: '#bbf7d0', ear: '#15803d' },
  'cat-orange': { body: '#f97316', belly: '#fed7aa', ear: '#c2410c' },
  'cat-purple': { body: '#a855f7', belly: '#e9d5ff', ear: '#7e22ce' },
};

function hashHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export type BubbleEntry = { text: string; at: number };

export type CatHazardState = {
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  blasterAmmo?: number;
  blasterUntil?: number;
  isGodMode?: boolean;
  jailedUntil?: number;
  gun?: string | null;
  tag?: string | null;
  colors?: { body?: string; tag?: string; nick?: string } | null;
  clone?: { username: string; fullName?: string } | null;
};

function drawCat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  avatar: string,
  facing: number,
  name: string,
  role: string,
  bubble?: BubbleEntry | null,
  hazard?: CatHazardState,
) {
  const now = Date.now();
  const isDying = Boolean(hazard?.isDying);
  const deathElapsed = isDying ? now - (hazard?.deathStartedAt ?? now) : 0;
  const isBurning = Boolean(!isDying && hazard?.burnUntil && hazard.burnUntil > now);
  const burnRemainingMs = isBurning ? (hazard!.burnUntil! - now) : 0;

  const base = AVATAR_COLORS[avatar] ?? AVATAR_COLORS['cat-blue'];
  const hue = hashHue(name + avatar);
  const flickerFire = isBurning && Math.floor(now / 70) % 2 === 0;
  const bodySpec = hazard?.colors?.body;
  const bodyOverride = bodySpec ? toHexColor(resolvePlayerColor(bodySpec, now) ?? bodySpec) : null;
  const cloned = Boolean(hazard?.clone);
  const effRole = cloned ? 'student' : role;
  const colors = bodyOverride
    ? { body: bodyOverride, belly: bodyOverride, ear: bodyOverride }
    : isBurning
    ? flickerFire
      ? { body: '#ea580c', belly: '#fed7aa', ear: '#9a3412' }
      : { body: '#451a03', belly: '#fdba74', ear: '#dc2626' }
    : effRole === 'admin'
      ? { body: '#e11d48', belly: '#fecdd3', ear: '#9f1239' }
      : effRole === 'teacher'
        ? { body: 'hsl(45, 90%, 55%)', belly: 'hsl(45, 95%, 80%)', ear: 'hsl(40, 85%, 40%)' }
        : { body: `hsl(${hue}, 70%, 55%)`, belly: `hsl(${hue}, 75%, 82%)`, ear: `hsl(${hue}, 70%, 38%)` };
  void base;

  const shakeX = isDying && deathElapsed < 180 ? Math.sin(now * 0.12) * 3.5 : isBurning ? Math.sin(now * 0.09) * 1.4 : 0;
  const drawX = x + shakeX;

  // Smoke & flame aura behind cat when burning
  if (isBurning) {
    ctx.save();
    for (let i = 0; i < 4; i += 1) {
      const phase = ((now * 0.005 + i * 0.25) % 1);
      const sx = drawX + w * 0.2 + ((i * 11) % (w * 0.6)) + Math.sin(now * 0.01 + i) * 5;
      const sy = y + 6 - phase * 28;
      const r = 4 + phase * 6;
      ctx.fillStyle = `rgba(55, 65, 81, ${(1 - phase) * 0.45})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(drawX + w / 2, y + h / 2);
  if (isDying && deathElapsed >= 180) {
    // Super Mario Bros death flip & spin
    const angle = Math.min(Math.PI, ((deathElapsed - 180) / 380) * Math.PI) + Math.sin(deathElapsed * 0.02) * 0.2;
    ctx.rotate(angle);
  }
  ctx.scale(facing, 1);
  ctx.translate(-w / 2, -h / 2);

  ctx.fillStyle = colors.ear;
  ctx.beginPath();
  ctx.moveTo(4, 14); ctx.lineTo(10, 0); ctx.lineTo(16, 14); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w - 16, 14); ctx.lineTo(w - 10, 0); ctx.lineTo(w - 4, 14); ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.body;
  roundRect(ctx, 2, 10, w - 4, h - 10, 10);
  ctx.fill();

  ctx.fillStyle = colors.belly;
  roundRect(ctx, w / 2 - 8, h * 0.55, 16, h * 0.35, 6);
  ctx.fill();

  if (isDying) {
    // X_X knocked-out Mario Bros eyes
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.25, 19); ctx.lineTo(w * 0.38, 25);
    ctx.moveTo(w * 0.38, 19); ctx.lineTo(w * 0.25, 25);
    ctx.moveTo(w * 0.62, 19); ctx.lineTo(w * 0.75, 25);
    ctx.moveTo(w * 0.75, 19); ctx.lineTo(w * 0.62, 25);
    ctx.stroke();
    // Open shocked mouth
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(w * 0.5, 32, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (isBurning) {
    // Panicked wide eyes O_O + screaming mouth when on fire!
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.32, 22, 4.4, 0, Math.PI * 2);
    ctx.arc(w * 0.68, 22, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(w * 0.32, 22, 2, 0, Math.PI * 2);
    ctx.arc(w * 0.68, 22, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, 31.5, 4.2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(w * 0.32, 22, 3, 0, Math.PI * 2);
    ctx.arc(w * 0.68, 22, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.44, 30); ctx.lineTo(w * 0.5, 33); ctx.lineTo(w * 0.56, 30);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();

  // Animated dancing flames on top of the cat while burning!
  if (isBurning) {
    ctx.save();
    const tongues = 4;
    for (let i = 0; i < tongues; i += 1) {
      const fx = drawX + 5 + i * ((w - 10) / (tongues - 1));
      const wave = Math.sin(now * 0.022 + i * 1.7) * 4;
      const fh = 14 + Math.cos(now * 0.028 + i * 2.1) * 5;
      // Outer orange-red flame
      ctx.fillStyle = i % 2 === 0 ? 'rgba(239, 68, 68, 0.92)' : 'rgba(249, 115, 22, 0.92)';
      ctx.beginPath();
      ctx.moveTo(fx - 6, y + 12);
      ctx.quadraticCurveTo(fx + wave, y + 10 - fh, fx + 6, y + 12);
      ctx.closePath();
      ctx.fill();
      // Inner yellow core
      ctx.fillStyle = 'rgba(253, 224, 71, 0.95)';
      ctx.beginPath();
      ctx.moveTo(fx - 3, y + 12);
      ctx.quadraticCurveTo(fx + wave * 0.6, y + 12 - fh * 0.62, fx + 3, y + 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  const hasStaffTitle = !cloned && (role === 'teacher' || role === 'admin');
  const isSuperCat = Boolean(hazard?.blasterUntil && hazard.blasterUntil > now);
  const isGodMode = Boolean(hazard?.isGodMode);

  if (isGodMode) {
    ctx.save();
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.95)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(drawX + w / 2, y + h / 2, Math.max(w, h) * 0.8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '16px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👑', drawX + w / 2, y - (hasStaffTitle ? 40 : 28));
    ctx.restore();
  }

  if (isSuperCat) {
    ctx.save();
    const pulse = 0.75 + 0.25 * Math.sin(now * 0.01);
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(drawX + w / 2, y + h / 2, Math.max(w, h) * 0.76, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 3; i += 1) {
      const ang = now * 0.005 + (i * Math.PI * 2) / 3;
      const sx = drawX + w / 2 + Math.cos(ang) * (Math.max(w, h) * 0.76);
      const sy = y + h / 2 + Math.sin(ang) * (Math.max(w, h) * 0.76);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (hasStaffTitle) {
    ctx.save();
    ctx.shadowColor = role === 'admin' ? '#fb7185' : '#ffd338';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = role === 'admin' ? 'rgba(244, 63, 94, 0.92)' : 'rgba(255, 211, 56, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(drawX + w / 2, y + h / 2, Math.max(w, h) * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const displayName = hazard?.clone?.username ?? name;
  const nickOverride = hazard?.colors?.nick
    ? resolvePlayerColor(hazard.colors.nick, now)
    : undefined;
  ctx.fillStyle = nickOverride ?? (effRole === 'admin' ? '#9f1239' : effRole === 'teacher' ? '#8c5308' : '#111827');
  ctx.font = 'bold 11px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(displayName, drawX + w / 2, y - 14);

  const tagOverride = hazard?.tag;
  const tagColor = hazard?.colors?.tag ? resolvePlayerColor(hazard.colors.tag, now) : undefined;
  const hasGun = Boolean(hazard?.gun);
  const showGunBadge = hasGun && (isSuperCat || hasStaffTitle || hazard?.blasterUntil);

  if (isSuperCat && !hasStaffTitle && !tagOverride) {
    const ammoText = `⚡ LASER x${hazard?.blasterAmmo ?? 0}`;
    ctx.font = 'bold 9px Nunito, sans-serif';
    const tw = ctx.measureText(ammoText).width + 10;
    const bx = drawX + w / 2 - tw / 2;
    const by = y - 28;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by - 12, tw, 15, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.fillText(ammoText, drawX + w / 2, by - 1);
  } else if (tagOverride) {
    // Spoofed title (/change tag), warna bisa custom via /change color tag
    ctx.fillStyle = tagColor ?? (effRole === 'admin' ? '#ff2a5f' : effRole === 'teacher' ? '#ffd338' : '#fde047');
    ctx.font = 'bold 9.5px Nunito, sans-serif';
    ctx.fillText(tagOverride.toUpperCase().slice(0, 20), drawX + w / 2, y - 26);
  } else if (effRole === 'admin') {
    ctx.fillStyle = tagColor ?? '#ff2a5f';
    ctx.font = 'bold 9.5px Nunito, sans-serif';
    ctx.fillText('ADMINISTRATOR', drawX + w / 2, y - 26);
  } else if (effRole === 'teacher') {
    ctx.fillStyle = tagColor ?? '#ffd338';
    ctx.font = 'bold 9px Nunito, sans-serif';
    ctx.fillText('TEACHER', drawX + w / 2, y - 26);
  }

  if (showGunBadge && !tagOverride) {
    // Senjata admin aktif: label ammo dengan warna sesuai weapon
    const gunLabel = `🔫 ${String(hazard!.gun).toUpperCase()} x${hazard?.blasterAmmo ?? 0}`;
    ctx.font = 'bold 9px Nunito, sans-serif';
    const tw = ctx.measureText(gunLabel).width + 10;
    const bx = drawX + w / 2 - tw / 2;
    const by = y - 28;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by - 12, tw, 15, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fdba74';
    ctx.fillText(gunLabel, drawX + w / 2, by - 1);
  }

  // Jail: kurung es + rantai di sekitar kucing, sisa detik di atas kepala
  const isJailed = Boolean(hazard?.jailedUntil && hazard.jailedUntil > now);
  if (isJailed) {
    const remainSec = Math.max(1, Math.ceil(((hazard!.jailedUntil!) - now) / 1000));
    ctx.save();
    const cageColor = `rgba(148, 197, 255, ${0.55 + 0.25 * Math.sin(now * 0.008)})`;
    ctx.strokeStyle = cageColor;
    ctx.lineWidth = 2.5;
    roundRect(ctx, drawX - 4, y - 4, w + 8, h + 8, 10);
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      const vx = drawX + 4 + i * ((w - 8) / 2);
      ctx.beginPath();
      ctx.moveTo(vx, y + 2);
      ctx.lineTo(vx, y + h - 2);
      ctx.stroke();
    }
    const jailLabel = `⛓️ ${remainSec}s`;
    ctx.font = 'bold 10px Nunito, sans-serif';
    const tw = ctx.measureText(jailLabel).width + 12;
    const bx = drawX + w / 2 - tw / 2;
    const by = y - (hasStaffTitle || tagOverride ? 44 : 32);
    ctx.fillStyle = '#1e3a8a';
    ctx.strokeStyle = cageColor;
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by - 14, tw, 19, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#bfdbfe';
    ctx.fillText(jailLabel, drawX + w / 2, by - 1);
    ctx.restore();
  }

  if (isBurning && (!bubble || now - bubble.at >= 5000)) {
    const sec = Math.max(1, Math.ceil(burnRemainingMs / 1000));
    const burnLabel = `🔥 PANAS! ${sec}s`;
    ctx.font = 'bold 10px Nunito, sans-serif';
    const tw = ctx.measureText(burnLabel).width + 12;
    const bx = drawX + w / 2 - tw / 2;
    const by = y - (hasStaffTitle ? 46 : 34);
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by - 14, tw, 19, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(burnLabel, drawX + w / 2, by - 1);
  }
  if (bubble && Date.now() - bubble.at < 5000) {
    const text = bubble.text.length > 40 ? bubble.text.slice(0, 37) + '...' : bubble.text;
    ctx.font = 'bold 11px Nunito, sans-serif';
    const tw = ctx.measureText(text).width + 14;
    const bw = Math.max(tw, 34);
    const bx = x + w / 2 - bw / 2;
    const by = y - (hasStaffTitle ? 50 : 36);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = '#233866';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by - 16, bw, 22, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#233866';
    ctx.fillText(text, x + w / 2, by - 1);
  }
  ctx.fillStyle = '#ffb03b';
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 6, y - 10);
  ctx.lineTo(x + w / 2 + 6, y - 10);
  ctx.lineTo(x + w / 2, y - 4);
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx: CanvasRenderingContext2D, stageInfo?: StageRenderInfo) {
  const stage = stageInfo?.stage ?? 1;
  const totalStages = stageInfo?.totalStages ?? 2;
  const stageAnswered = stageInfo?.stageAnswered ?? 0;
  const stageTotal = stageInfo?.stageTotal ?? 0;
  const isUnlocked = Boolean(stageInfo?.isGateUnlocked);
  const now = Date.now();

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  if (stage === 4) {
    sky.addColorStop(0, '#030712');
    sky.addColorStop(0.28, '#0b0f19');
    sky.addColorStop(0.58, '#1e1b4b');
    sky.addColorStop(0.82, '#0284c7');
    sky.addColorStop(1, '#38bdf8');
  } else if (stage === 3) {
    sky.addColorStop(0, '#0f051d');
    sky.addColorStop(0.32, '#450a0a');
    sky.addColorStop(0.65, '#991b1b');
    sky.addColorStop(0.85, '#c2410c');
    sky.addColorStop(1, '#f97316');
  } else if (stage === 2) {
    sky.addColorStop(0, '#2e1065');
    sky.addColorStop(0.38, '#7e22ce');
    sky.addColorStop(0.7, '#db2777');
    sky.addColorStop(0.9, '#f97316');
    sky.addColorStop(1, '#fde047');
  } else if (stage === 5) {
    // Hutan Neon Biolumin: deep purple-teal night sky
    sky.addColorStop(0, '#020617');
    sky.addColorStop(0.3, '#0f172a');
    sky.addColorStop(0.55, '#134e4a');
    sky.addColorStop(0.8, '#0d9488');
    sky.addColorStop(1, '#2dd4bf');
  } else if (stage === 6) {
    // Kota Roda Gigi: smoggy industrial dusk
    sky.addColorStop(0, '#1c1917');
    sky.addColorStop(0.35, '#44403c');
    sky.addColorStop(0.65, '#78716c');
    sky.addColorStop(0.85, '#b45309');
    sky.addColorStop(1, '#d97706');
  } else if (stage === 7) {
    // Samudra Es: pale glacial blue
    sky.addColorStop(0, '#0c4a6e');
    sky.addColorStop(0.35, '#0ea5e9');
    sky.addColorStop(0.65, '#7dd3fc');
    sky.addColorStop(0.88, '#bae6fd');
    sky.addColorStop(1, '#e0f2fe');
  } else if (stage === 8) {
    // Gurun Reruntuhan: scorched amber haze
    sky.addColorStop(0, '#7c2d12');
    sky.addColorStop(0.35, '#c2410c');
    sky.addColorStop(0.65, '#ea580c');
    sky.addColorStop(0.85, '#fbbf24');
    sky.addColorStop(1, '#fde68a');
  } else if (stage === 9) {
    // Sarang Virus: sickly organic green-red
    sky.addColorStop(0, '#0a0f0a');
    sky.addColorStop(0.3, '#14532d');
    sky.addColorStop(0.6, '#166534');
    sky.addColorStop(0.85, '#4d7c0f');
    sky.addColorStop(1, '#84cc16');
  } else if (stage === 10) {
    // Menara Final Boss: void purple-black with blood red horizon
    sky.addColorStop(0, '#000000');
    sky.addColorStop(0.25, '#0b0514');
    sky.addColorStop(0.5, '#1e1b4b');
    sky.addColorStop(0.75, '#4c0519');
    sky.addColorStop(1, '#7f1d1d');
  } else {
    sky.addColorStop(0, '#4b94e6');
    sky.addColorStop(0.65, '#8ec8fa');
    sky.addColorStop(1, '#c3e7ff');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  if (stage === 5) {
    // Biolumin: fireflies & glowing spores drifting
    ctx.save();
    for (let fx = 30; fx < WORLD.width; fx += 90) {
      const fy = 120 + ((fx * 53) % 420) + Math.sin(now * 0.002 + fx) * 14;
      const glow = 0.35 + 0.55 * Math.sin(now * 0.004 + fx * 1.7);
      const col = fx % 180 < 90 ? '163, 230, 53' : '45, 212, 191';
      ctx.fillStyle = `rgba(${col}, ${Math.max(0, glow)})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${col}, ${Math.max(0, glow) * 0.25})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (stage === 6) {
    // Kota Roda Gigi: giant rotating gear silhouettes + smoke
    ctx.save();
    for (const gx of [700, 2300, 3900, 5100]) {
      const gy = 200 + (gx % 160);
      const r = 90 + (gx % 60);
      ctx.strokeStyle = 'rgba(28, 25, 23, 0.55)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 8;
      for (let a = 0; a < 8; a += 1) {
        const ang = now * 0.0006 * (gx % 2 === 0 ? 1 : -1) + (a / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(gx + Math.cos(ang) * r, gy + Math.sin(ang) * r);
        ctx.lineTo(gx + Math.cos(ang) * (r + 22), gy + Math.sin(ang) * (r + 22));
        ctx.stroke();
      }
    }
    for (let sx = 200; sx < WORLD.width; sx += 520) {
      const puff = ((now * 0.03 + sx) % 300);
      ctx.fillStyle = `rgba(120, 113, 108, ${0.4 - puff / 900})`;
      ctx.beginPath();
      ctx.arc(sx + Math.sin(now * 0.001 + sx) * 10, 240 - puff, 16 + puff * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (stage === 7) {
    // Samudra Es: aurora ribbons + falling snow
    ctx.save();
    for (const ax of [800, 2600, 4400]) {
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
      ctx.lineWidth = 26;
      ctx.beginPath();
      for (let x = 0; x <= 420; x += 30) {
        const y = 140 + Math.sin(x * 0.02 + now * 0.001 + ax) * 44;
        if (x === 0) ctx.moveTo(ax - 210 + x, y);
        else ctx.lineTo(ax - 210 + x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = 14;
      ctx.stroke();
    }
    for (let sx = 20; sx < WORLD.width; sx += 46) {
      const sy = (now * 0.06 + sx * 7) % (WORLD.height - 60);
      ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.beginPath();
      ctx.arc(sx + Math.sin(now * 0.002 + sx) * 8, sy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (stage === 8) {
    // Gurun Reruntuhan: heat haze + sandstorm gusts
    ctx.save();
    const haze = ctx.createLinearGradient(0, 300, 0, WORLD.groundY);
    haze.addColorStop(0, 'rgba(253, 230, 138, 0)');
    haze.addColorStop(1, 'rgba(253, 230, 138, 0.28)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 300, WORLD.width, WORLD.groundY - 300);
    for (let gx = 0; gx < WORLD.width; gx += 340) {
      const drift = ((now * 0.12 + gx * 3) % 260);
      ctx.strokeStyle = 'rgba(254, 243, 199, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx + drift, 320 + (gx % 200));
      ctx.quadraticCurveTo(gx + drift + 30, 340 + (gx % 200), gx + drift + 70, 330 + (gx % 200));
      ctx.stroke();
    }
    ctx.restore();
  } else if (stage === 9) {
    // Sarang Virus: pulsating organic blobs & drifting spores
    ctx.save();
    for (const bx of [600, 1900, 3200, 4600]) {
      const by = 240 + (bx % 180);
      const pulse = 1 + 0.12 * Math.sin(now * 0.004 + bx);
      const blobGrad = ctx.createRadialGradient(bx, by, 8, bx, by, 90 * pulse);
      blobGrad.addColorStop(0, 'rgba(132, 204, 22, 0.5)');
      blobGrad.addColorStop(0.6, 'rgba(63, 98, 18, 0.35)');
      blobGrad.addColorStop(1, 'rgba(63, 98, 18, 0)');
      ctx.fillStyle = blobGrad;
      ctx.beginPath();
      ctx.arc(bx, by, 90 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let sx = 40; sx < WORLD.width; sx += 120) {
      const sy = (now * 0.04 + sx * 11) % 520;
      ctx.fillStyle = 'rgba(163, 230, 53, 0.6)';
      ctx.beginPath();
      ctx.arc(sx + Math.sin(now * 0.003 + sx) * 12, 560 - sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (stage === 10) {
    // Menara Final: void stars + red lightning strikes
    ctx.save();
    for (let sx = 30; sx < WORLD.width; sx += 110) {
      const sy = 30 + ((sx * 31) % 300);
      const twinkle = 0.4 + 0.6 * Math.sin(now * 0.006 + sx);
      ctx.fillStyle = `rgba(226, 232, 240, ${Math.max(0, twinkle)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    const boltPhase = (now % 3000) / 3000;
    if (boltPhase < 0.12) {
      const alpha = 1 - boltPhase / 0.12;
      for (const bx of [1200, 3000, 4800]) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.85})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        let lx = bx;
        let ly = 0;
        ctx.moveTo(lx, ly);
        while (ly < 560) {
          lx += Math.sin(ly * 0.05 + bx) * 36;
          ly += 70;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  } else if (stage === 3) {
    // Volcanic embers and sparks drifting upwards
    ctx.save();
    for (let ex = 40; ex < WORLD.width; ex += 130) {
      const ey = (ex * 37 + now * 0.05) % 640;
      const yPos = 680 - ey;
      const emberX = ex + Math.sin(now * 0.003 + ex) * 18;
      const emberAlpha = 0.4 + 0.5 * Math.sin(now * 0.005 + ex);
      ctx.fillStyle = `rgba(253, 186, 116, ${emberAlpha})`;
      ctx.beginPath();
      ctx.arc(emberX, yPos, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(239, 68, 68, ${emberAlpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(emberX, yPos, 4.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Deep crimson magma glow orbs along horizon
    for (const lavaX of [900, 2600, 4400]) {
      const lavaGrad = ctx.createRadialGradient(lavaX, 580, 20, lavaX, 580, 260);
      lavaGrad.addColorStop(0, 'rgba(254, 215, 170, 0.85)');
      lavaGrad.addColorStop(0.4, 'rgba(234, 88, 12, 0.55)');
      lavaGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
      ctx.fillStyle = lavaGrad;
      ctx.beginPath();
      ctx.arc(lavaX, 580, 260, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (stage === 2) {
    // Sunset giant glowing sun & evening stars
    ctx.save();
    for (let sx = 140; sx < WORLD.width; sx += 310) {
      const sy = 50 + ((sx * 17) % 140);
      const twinkle = 0.45 + 0.5 * Math.sin(now * 0.004 + sx);
      ctx.fillStyle = `rgba(254, 240, 138, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const sunX of [780, 2650, 4520]) {
      const sunGrad = ctx.createRadialGradient(sunX, 540, 20, sunX, 540, 220);
      sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.92)');
      sunGrad.addColorStop(0.45, 'rgba(249, 115, 22, 0.55)');
      sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, 540, 220, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Soft distant rolling hills
  ctx.fillStyle = stage === 4 ? 'rgba(30, 27, 75, 0.5)' : stage === 3 ? 'rgba(69, 10, 10, 0.5)' : stage === 2 ? 'rgba(88, 28, 135, 0.38)' : stage === 5 ? 'rgba(4, 47, 46, 0.55)' : stage === 6 ? 'rgba(28, 25, 23, 0.6)' : stage === 7 ? 'rgba(12, 74, 110, 0.4)' : stage === 8 ? 'rgba(124, 45, 18, 0.35)' : stage === 9 ? 'rgba(20, 83, 45, 0.5)' : stage === 10 ? 'rgba(11, 5, 20, 0.65)' : 'rgba(116, 198, 122, 0.35)';
  for (let hx = 0; hx < WORLD.width; hx += 460) {
    ctx.beginPath();
    ctx.arc(hx + 230, WORLD.groundY + 70, 290, Math.PI, 0);
    ctx.fill();
  }

  // Fluffy clouds
  ctx.fillStyle = stage === 4 ? 'rgba(30, 41, 59, 0.85)' : stage === 3 ? 'rgba(68, 24, 24, 0.85)' : stage === 2 ? 'rgba(253, 186, 116, 0.78)' : stage === 5 ? 'rgba(13, 148, 136, 0.5)' : stage === 6 ? 'rgba(87, 83, 78, 0.8)' : stage === 7 ? 'rgba(224, 242, 254, 0.9)' : stage === 8 ? 'rgba(254, 215, 170, 0.7)' : stage === 9 ? 'rgba(74, 124, 15, 0.6)' : stage === 10 ? 'rgba(30, 10, 30, 0.85)' : 'rgba(255,255,255,0.92)';
  for (const c of DECOR.clouds) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 26 * c.s, 0, Math.PI * 2);
    ctx.arc(c.x + 30 * c.s, c.y - 12 * c.s, 24 * c.s, 0, Math.PI * 2);
    ctx.arc(c.x + 60 * c.s, c.y, 24 * c.s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Centerpiece building (School in Stage 1, Cyber Sunset Tower in Stage 2, Magma Citadel in Stage 3, Orbital Cyber Station in Stage 4)
  const school = DECOR.school;
  ctx.fillStyle = stage === 4 ? '#090d16' : stage === 3 ? '#1c1917' : stage === 2 ? '#1e1b4b' : stage === 5 ? '#042f2e' : stage === 6 ? '#292524' : stage === 7 ? '#0c4a6e' : stage === 8 ? '#78350f' : stage === 9 ? '#14532d' : stage === 10 ? '#0b0514' : '#ead7bd';
  ctx.strokeStyle = stage === 4 ? '#06b6d4' : stage === 3 ? '#ea580c' : stage === 2 ? '#c084fc' : stage === 5 ? '#2dd4bf' : stage === 6 ? '#f59e0b' : stage === 7 ? '#7dd3fc' : stage === 8 ? '#fbbf24' : stage === 9 ? '#84cc16' : stage === 10 ? '#dc2626' : '#997d5c';
  ctx.lineWidth = 3;
  ctx.fillRect(school.x, school.y, school.w, school.h);
  ctx.strokeRect(school.x, school.y, school.w, school.h);

  // Central clock / radar tower section
  const towerW = 130;
  const towerX = school.x + school.w / 2 - towerW / 2;
  ctx.fillStyle = stage === 4 ? '#0f172a' : stage === 3 ? '#292524' : stage === 2 ? '#312e81' : stage === 5 ? '#134e4a' : stage === 6 ? '#44403c' : stage === 7 ? '#075985' : stage === 8 ? '#92400e' : stage === 9 ? '#166534' : stage === 10 ? '#1e1b4b' : '#f3e5cb';
  ctx.fillRect(towerX, school.y - 105, towerW, 105);
  ctx.strokeRect(towerX, school.y - 105, towerW, 105);

  // Roof & pediment
  ctx.fillStyle = stage === 4 ? '#0284c7' : stage === 3 ? '#7f1d1d' : stage === 2 ? '#4c1d95' : stage === 5 ? '#0f766e' : stage === 6 ? '#78716c' : stage === 7 ? '#0369a1' : stage === 8 ? '#b45309' : stage === 9 ? '#3f6212' : stage === 10 ? '#450a0a' : '#5a7094';
  ctx.beginPath();
  ctx.moveTo(towerX - 18, school.y - 105);
  ctx.lineTo(school.x + school.w / 2, school.y - 155);
  ctx.lineTo(towerX + towerW + 18, school.y - 105);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Clock / Cyber core face
  const clockCx = school.x + school.w / 2;
  const clockCy = school.y - 55;
  ctx.fillStyle = stage === 4 ? '#083344' : stage === 3 ? '#450a0a' : stage === 2 ? '#0f172a' : stage === 5 ? '#042f2e' : stage === 6 ? '#1c1917' : stage === 7 ? '#e0f2fe' : stage === 8 ? '#fef3c7' : stage === 9 ? '#052e16' : stage === 10 ? '#000000' : '#ffffff';
  ctx.strokeStyle = stage === 4 ? '#38bdf8' : stage === 3 ? '#f97316' : stage === 2 ? '#38bdf8' : stage === 5 ? '#5eead4' : stage === 6 ? '#f59e0b' : stage === 7 ? '#0ea5e9' : stage === 8 ? '#d97706' : stage === 9 ? '#a3e635' : stage === 10 ? '#dc2626' : '#3b4e6d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(clockCx, clockCy, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(clockCx, clockCy);
  ctx.lineTo(clockCx, clockCy - 16);
  ctx.moveTo(clockCx, clockCy);
  ctx.lineTo(clockCx + 12, clockCy + 4);
  ctx.stroke();

  // Windows
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const wx = school.x + 28 + col * 84;
      const wy = school.y + 42 + row * 120;
      ctx.fillStyle = stage === 4 ? '#38bdf8' : stage === 3 ? '#f97316' : stage === 2 ? '#fbbf24' : stage === 5 ? '#5eead4' : stage === 6 ? '#fbbf24' : stage === 7 ? '#bae6fd' : stage === 8 ? '#fde68a' : stage === 9 ? '#a3e635' : stage === 10 ? '#f87171' : '#9fd3f7';
      ctx.strokeStyle = stage === 4 ? '#06b6d4' : stage === 3 ? '#dc2626' : stage === 2 ? '#f59e0b' : stage === 5 ? '#0d9488' : stage === 6 ? '#a16207' : stage === 7 ? '#0284c7' : stage === 8 ? '#b45309' : stage === 9 ? '#4d7c0f' : stage === 10 ? '#7f1d1d' : '#5b7290';
      ctx.lineWidth = 3;
      roundRect(ctx, wx, wy, 48, 64, 6);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(wx + 24, wy);
      ctx.lineTo(wx + 24, wy + 64);
      ctx.moveTo(wx, wy + 32);
      ctx.lineTo(wx + 48, wy + 32);
      ctx.stroke();
    }
  }

  // Double doors
  ctx.fillStyle = stage === 4 ? '#0284c7' : stage === 3 ? '#450a0a' : stage === 2 ? '#3730a3' : stage === 5 ? '#115e59' : stage === 6 ? '#57534e' : stage === 7 ? '#0369a1' : stage === 8 ? '#92400e' : stage === 9 ? '#3f6212' : stage === 10 ? '#450a0a' : '#6c4223';
  roundRect(ctx, school.x + school.w / 2 - 38, school.y + school.h - 105, 76, 105, 8);
  ctx.fill();
  ctx.strokeStyle = stage === 4 ? '#38bdf8' : stage === 3 ? '#ea580c' : stage === 2 ? '#818cf8' : stage === 5 ? '#2dd4bf' : stage === 6 ? '#a16207' : stage === 7 ? '#7dd3fc' : stage === 8 ? '#fbbf24' : stage === 9 ? '#84cc16' : stage === 10 ? '#dc2626' : '#3f220c';
  ctx.stroke();

  // Trees
  for (const t of DECOR.trees) {
    const s = t.s ?? 1;
    ctx.fillStyle = stage === 4 ? '#0f172a' : stage === 3 ? '#1c1917' : stage === 2 ? '#4c1d95' : stage === 5 ? '#052e2b' : stage === 6 ? '#292524' : stage === 7 ? '#0c4a6e' : stage === 8 ? '#78350f' : stage === 9 ? '#14532d' : stage === 10 ? '#0b0514' : '#6b3e1a';
    ctx.fillRect(t.x - 9 * s, t.y - 46 * s, 18 * s, 46 * s);
    ctx.fillStyle = stage === 4 ? '#0284c7' : stage === 3 ? '#7f1d1d' : stage === 2 ? '#9d174d' : stage === 5 ? '#10b981' : stage === 6 ? '#78716c' : stage === 7 ? '#bae6fd' : stage === 8 ? '#d97706' : stage === 9 ? '#65a30d' : stage === 10 ? '#4c0519' : '#2d8a34';
    ctx.beginPath();
    ctx.arc(t.x, t.y - 68 * s, 38 * s, 0, Math.PI * 2);
    ctx.arc(t.x - 28 * s, t.y - 50 * s, 28 * s, 0, Math.PI * 2);
    ctx.arc(t.x + 28 * s, t.y - 50 * s, 28 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = stage === 4 ? '#38bdf8' : stage === 3 ? '#ea580c' : stage === 2 ? '#ec4899' : stage === 5 ? '#a3e635' : stage === 6 ? '#fbbf24' : stage === 7 ? '#e0f2fe' : stage === 8 ? '#fef08a' : stage === 9 ? '#a3e635' : stage === 10 ? '#dc2626' : '#48b04f';
    ctx.beginPath();
    ctx.arc(t.x - 10 * s, t.y - 76 * s, 18 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wooden signboard on left platform
  const sign = DECOR.sign;
  ctx.fillStyle = '#5a3214';
  ctx.fillRect(sign.x + 30, sign.y + 58, 12, 32);
  ctx.fillRect(sign.x + 110, sign.y + 58, 12, 32);
  ctx.fillStyle = stage === 4 ? '#bae6fd' : stage === 3 ? '#fed7aa' : stage === 2 ? '#fef08a' : stage === 5 ? '#99f6e4' : stage === 6 ? '#fed7aa' : stage === 7 ? '#e0f2fe' : stage === 8 ? '#fde68a' : stage === 9 ? '#d9f99d' : stage === 10 ? '#fecaca' : '#d89b56';
  ctx.strokeStyle = '#6c3e18';
  ctx.lineWidth = 3;
  roundRect(ctx, sign.x - 10, sign.y, 172, 62, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4e2709';
  ctx.font = 'bold 11px Nunito, sans-serif';
  ctx.textAlign = 'center';
  if (stage === 4) {
    ctx.fillText('STAGE 4: Galaksi Cyber & Power-Up!', sign.x + 76, sign.y + 24);
    ctx.fillText('Ambil Bintang ⚡ Tembak Laser! ➜', sign.x + 76, sign.y + 42);
  } else if (stage === 5) {
    ctx.fillText('STAGE 5: Hutan Neon Biolumin!', sign.x + 76, sign.y + 24);
    ctx.fillText('Awas Toxic Pit & Golem Neon! ➜', sign.x + 76, sign.y + 42);
  } else if (stage === 6) {
    ctx.fillText('STAGE 6: Kota Roda Gigi Metal Slug!', sign.x + 76, sign.y + 24);
    ctx.fillText('Tembak Boss Penjaga Pintu! ➜', sign.x + 76, sign.y + 42);
  } else if (stage === 7) {
    ctx.fillText('STAGE 7: Samudra Es & Boss!', sign.x + 76, sign.y + 24);
    ctx.fillText('Hati-hati Conveyor Es! ➜', sign.x + 76, sign.y + 42);
  } else if (stage === 8) {
    ctx.fillText('STAGE 8: Gurun Reruntuhan!', sign.x + 76, sign.y + 24);
    ctx.fillText('Badai Pasir & Boss Menanti! ➜', sign.x + 76, sign.y + 42);
  } else if (stage === 9) {
    ctx.fillText('STAGE 9: Sarang Virus!', sign.x + 76, sign.y + 24);
    ctx.fillText('Musuh Makin Banyak! ➜', sign.x + 76, sign.y + 42);
  } else if (stage === 10) {
    ctx.fillText('STAGE 10: Menara Final Boss!', sign.x + 76, sign.y + 24);
    ctx.fillText('PALING SUSAH! Semangat! ➜', sign.x + 76, sign.y + 42);
  } else if (stage === 3) {
    ctx.fillText('STAGE 3: Kastil Magma & Pijakan Lahar!', sign.x + 76, sign.y + 24);
    ctx.fillText('Waspada Api & Monster Virus! ➜', sign.x + 76, sign.y + 42);
  } else if (stage === 2) {
    ctx.fillText('STAGE 2: Awas Pijakan Rapuh', sign.x + 76, sign.y + 24);
    ctx.fillText('& Monster Virus Patroli! ➜', sign.x + 76, sign.y + 42);
  } else {
    ctx.fillText('STAGE 1: Jawab semua soal', sign.x + 76, sign.y + 24);
    ctx.fillText('untuk buka pintu stage! ➜', sign.x + 76, sign.y + 42);
  }

  // Stone Arch Finish Gate (Locked with chains OR Unlocked glowing portal to next stage)
  const gate = DECOR.gate;
  ctx.save();
  ctx.fillStyle = isUnlocked ? '#fde047' : '#9ca3af';
  ctx.strokeStyle = isUnlocked ? '#ca8a04' : '#374151';
  ctx.lineWidth = 3;
  roundRect(ctx, gate.x, gate.y, 130, 160, 62);
  ctx.fill();
  ctx.stroke();

  if (isUnlocked) {
    // Glowing animated portal inside the open door
    const portalGrad = ctx.createRadialGradient(
      gate.x + 65,
      gate.y + 92,
      8,
      gate.x + 65,
      gate.y + 92,
      72,
    );
    portalGrad.addColorStop(0, '#fef08a');
    portalGrad.addColorStop(0.5, '#22c55e');
    portalGrad.addColorStop(1, '#15803d');
    ctx.fillStyle = portalGrad;
    ctx.strokeStyle = '#14532d';
    roundRect(ctx, gate.x + 18, gate.y + 22, 94, 138, 46);
    ctx.fill();
    ctx.stroke();

    // Animated portal rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2.5;
    for (let r = 0; r < 3; r += 1) {
      const pulse = ((now * 0.002 + r * 0.33) % 1);
      ctx.beginPath();
      ctx.ellipse(gate.x + 65, gate.y + 88, 12 + pulse * 30, 20 + pulse * 44, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Unlocked plaque
    ctx.fillStyle = '#16a34a';
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 2.5;
    roundRect(ctx, gate.x + 4, gate.y + 118, 122, 26, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    const nextLabel = stage < totalStages ? `MASUK STAGE ${stage + 1} ➜` : 'SELESAI! 🏆';
    ctx.fillText(nextLabel, gate.x + 65, gate.y + 135);
  } else {
    // Closed wooden door
    ctx.fillStyle = '#6b4423';
    ctx.strokeStyle = '#3e230d';
    roundRect(ctx, gate.x + 18, gate.y + 22, 94, 138, 46);
    ctx.fill();
    ctx.stroke();

    // Vertical wood plank lines on door
    ctx.strokeStyle = 'rgba(30, 15, 5, 0.45)';
    ctx.lineWidth = 2;
    for (let px = gate.x + 36; px < gate.x + 105; px += 18) {
      ctx.beginPath();
      ctx.moveTo(px, gate.y + 28);
      ctx.lineTo(px, gate.y + 158);
      ctx.stroke();
    }

    // Criss-cross iron chains across the door
    const drawChainLine = (x1: number, y1: number, x2: number, y2: number) => {
      const steps = 11;
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const cx = x1 + (x2 - x1) * t;
        const cy = y1 + (y2 - y1) * t;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
        ctx.fillStyle = i % 2 === 0 ? '#64748b' : '#475569';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        roundRect(ctx, -7, -4, 14, 8, 3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    };
    drawChainLine(gate.x + 14, gate.y + 42, gate.x + 116, gate.y + 146);
    drawChainLine(gate.x + 116, gate.y + 42, gate.x + 14, gate.y + 146);
    drawChainLine(gate.x + 10, gate.y + 95, gate.x + 120, gate.y + 95);

    // Heavy central padlock over chains
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    roundRect(ctx, gate.x + 49, gate.y + 82, 32, 28, 6);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(gate.x + 65, gate.y + 82, 10, Math.PI, 0);
    ctx.stroke();

    // Live question counter plaque on gate
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    roundRect(ctx, gate.x + 6, gate.y + 118, 118, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    const progressText = stageTotal > 0 ? `🔒 ${stageAnswered} / ${stageTotal} SOAL` : 'TERKUNCI';
    ctx.fillText(progressText, gate.x + 65, gate.y + 134);

    // Boss guard plaque when boss is still alive
    if (stageInfo?.bossAlive) {
      const pulse = 0.6 + 0.4 * Math.sin(now * 0.008);
      ctx.fillStyle = `rgba(127, 29, 29, ${0.75 + 0.25 * pulse})`;
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2.5;
      roundRect(ctx, gate.x + 6, gate.y - 64, 118, 24, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fecaca';
      ctx.font = 'bold 10px Nunito, sans-serif';
      ctx.fillText('⚔ BOSS GUARD!', gate.x + 65, gate.y - 48);
    }
  }

  // Flag on top of gate
  ctx.strokeStyle = '#4b2e14';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gate.x + 65, gate.y);
  ctx.lineTo(gate.x + 65, gate.y - 38);
  ctx.stroke();
  ctx.fillStyle = isUnlocked ? '#22c55e' : '#ef4444';
  ctx.beginPath();
  ctx.moveTo(gate.x + 65, gate.y - 38);
  ctx.lineTo(gate.x + 98, gate.y - 28);
  ctx.lineTo(gate.x + 65, gate.y - 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[], stage = 1) {
  for (const p of platforms) {
    if (p.type === 'ground') {
      if (stage === 4) {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#083344';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      } else if (stage === 5) {
        ctx.fillStyle = '#022c22';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#0d9488';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#0f3d3e';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      } else if (stage === 3) {
        ctx.fillStyle = '#292524';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      } else if (stage === 2) {
        ctx.fillStyle = '#312e81';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#4c1d95';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      } else if (stage === 5) {
        ctx.fillStyle = '#022c22';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#0d9488';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#0f3d3e';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      } else if (stage === 6) {
        ctx.fillStyle = '#57534e';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#3f3f46';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      } else if (stage === 7) {
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      } else if (stage === 8) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      } else if (stage === 9) {
        ctx.fillStyle = '#365314';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#84cc16';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#1a2e05';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      } else if (stage === 10) {
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#0b0514';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      } else {
        ctx.fillStyle = '#3ca338';
        ctx.fillRect(p.x, p.y, p.w, 18);
        ctx.fillStyle = '#257322';
        ctx.fillRect(p.x, p.y + 18, p.w, 6);
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
      }
    } else if (p.type === 'grass') {
      // Dirt base
      ctx.fillStyle = '#8b5a2b';
      ctx.strokeStyle = '#4e2e12';
      ctx.lineWidth = 2.5;
      roundRect(ctx, p.x, p.y + 6, p.w, p.h - 6, 8);
      ctx.fill();
      ctx.stroke();
      // Lush green top cap
      ctx.fillStyle = '#44b83d';
      ctx.strokeStyle = '#1f6b1b';
      roundRect(ctx, p.x - 2, p.y, p.w + 4, 13, 6);
      ctx.fill();
      ctx.stroke();
    } else if (p.type === 'stone' || p.type === 'roof') {
      ctx.fillStyle = p.type === 'roof' ? '#586f94' : '#94a3b8';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;
      roundRect(ctx, p.x, p.y, p.w, p.h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(p.x + 6, p.y + 3, p.w - 12, 4);
    } else if (p.type === 'crate') {
      ctx.fillStyle = '#c8833b';
      ctx.strokeStyle = '#5c340e';
      ctx.lineWidth = 2.5;
      roundRect(ctx, p.x, p.y, p.w, p.h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.strokeRect(p.x + 5, p.y + 5, p.w - 10, p.h - 10);
      ctx.beginPath();
      ctx.moveTo(p.x + 5, p.y + 5);
      ctx.lineTo(p.x + p.w - 5, p.y + p.h - 5);
      ctx.moveTo(p.x + p.w - 5, p.y + 5);
      ctx.lineTo(p.x + 5, p.y + p.h - 5);
      ctx.stroke();
    } else if (p.type === 'qblock' || p.type === 'qblock-correct' || p.type === 'qblock-wrong' || p.type === 'qblock-assisted') {
      const isCorrect = p.type === 'qblock-correct';
      const isWrong = p.type === 'qblock-wrong';
      const isAssisted = p.type === 'qblock-assisted';
      ctx.fillStyle = isAssisted ? '#0284c7' : isCorrect ? '#22c55e' : isWrong ? '#ef4444' : '#fbbf24';
      ctx.strokeStyle = isAssisted ? '#0369a1' : isCorrect ? '#14532d' : isWrong ? '#7f1d1d' : '#92400e';
      ctx.lineWidth = 3;
      roundRect(ctx, p.x, p.y, p.w, p.h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(p.x + 6, p.y + 4, p.w - 12, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Nunito, sans-serif';
      ctx.textAlign = 'center';
      const symbol = isAssisted || isCorrect ? '✔' : isWrong ? '✖' : '?';
      ctx.fillText(symbol, p.x + p.w / 2, p.y + p.h / 2 + 9);
    } else if (p.type === 'bounce') {
      // Spring base + bright red/yellow bounce pad
      ctx.fillStyle = '#475569';
      ctx.fillRect(p.x + 12, p.y + 10, p.w - 24, p.h - 10);
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2.5;
      roundRect(ctx, p.x, p.y, p.w, 12, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(p.x + 10, p.y + 3, p.w - 20, 4);
    } else if (p.type === 'spike') {
      const count = Math.max(2, Math.floor(p.w / 22));
      const sw = p.w / count;
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      for (let i = 0; i < count; i += 1) {
        const sx = p.x + i * sw;
        ctx.beginPath();
        ctx.moveTo(sx, p.y + p.h);
        ctx.lineTo(sx + sw / 2, p.y);
        ctx.lineTo(sx + sw, p.y + p.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (p.type === 'fire') {
      const now = Date.now();
      // Charcoal stone pit base
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      roundRect(ctx, p.x, p.y + p.h - 9, p.w, 9, 4);
      ctx.fill();
      ctx.stroke();

      // Glowing ember coals bed
      ctx.fillStyle = '#dc2626';
      roundRect(ctx, p.x + 4, p.y + p.h - 7, p.w - 8, 5, 3);
      ctx.fill();

      // Animated dancing flame tongues
      const flameCount = Math.max(3, Math.floor(p.w / 14));
      const step = (p.w - 8) / flameCount;
      for (let i = 0; i < flameCount; i += 1) {
        const cx = p.x + 4 + i * step + step * 0.5;
        const baseY = p.y + p.h - 6;
        const sway = Math.sin(now * 0.015 + i * 1.9 + p.x) * 3.5;
        const fh = p.h - 2 + Math.cos(now * 0.02 + i * 2.3) * 5;

        // Outer red-orange flame
        ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#f97316';
        ctx.beginPath();
        ctx.moveTo(cx - step * 0.65, baseY);
        ctx.quadraticCurveTo(cx + sway, baseY - fh, cx + step * 0.65, baseY);
        ctx.closePath();
        ctx.fill();

        // Inner bright yellow flame core
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(cx - step * 0.34, baseY);
        ctx.quadraticCurveTo(cx + sway * 0.5, baseY - fh * 0.58, cx + step * 0.34, baseY);
        ctx.closePath();
        ctx.fill();
      }
    } else if (p.type === 'crumble') {
      const now = Date.now();
      const isBroken = Boolean(p.brokenUntil && now < p.brokenUntil);
      if (isBroken) {
        ctx.save();
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        roundRect(ctx, p.x, p.y, p.w, p.h, 6);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      const isShaking = Boolean(p.crumbleStartedAt);
      const sx = isShaking ? p.x + Math.sin(now * 0.14) * 3.5 : p.x;
      ctx.fillStyle = isShaking ? '#f97316' : '#f59e0b';
      ctx.strokeStyle = isShaking ? '#7f1d1d' : '#78350f';
      ctx.lineWidth = 2.5;
      roundRect(ctx, sx, p.y, p.w, p.h, 6);
      ctx.fill();
      ctx.stroke();
      // Fracture crack lines on crumble block
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2;
      for (let cx = sx + 28; cx < sx + p.w - 20; cx += 42) {
        ctx.beginPath();
        ctx.moveTo(cx, p.y + 2);
        ctx.lineTo(cx - 6, p.y + p.h * 0.5);
        ctx.lineTo(cx + 5, p.y + p.h - 2);
        ctx.stroke();
      }
    } else if (p.type === 'conveyor') {
      // Conveyor Belt: sabuk beroda dengan panah arah bergerak
      const now = Date.now();
      const dir = p.conveyorDir ?? 1;
      // Belt body
      ctx.fillStyle = '#27272a';
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 2.5;
      roundRect(ctx, p.x, p.y, p.w, p.h, 8);
      ctx.fill();
      ctx.stroke();
      // Top belt strip
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(p.x + 4, p.y + 3, p.w - 8, 6);
      // End wheels (roda di kedua ujung)
      for (const wx of [p.x + 12, p.x + p.w - 12]) {
        const wy = p.y + p.h - 7;
        ctx.fillStyle = '#a1a1aa';
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Spokes rotating with belt direction
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate((now * 0.004 * dir) % (Math.PI * 2));
        ctx.strokeStyle = '#52525b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
        ctx.moveTo(0, -5); ctx.lineTo(0, 5);
        ctx.stroke();
        ctx.restore();
      }
      // Animated chevrons (>>> atau <<<)
      const chCount = Math.max(2, Math.floor(p.w / 34));
      const gap = p.w / chCount;
      const scroll = ((now * 0.05 * dir) % gap + gap) % gap;
      ctx.strokeStyle = dir === 1 ? '#4ade80' : '#f87171';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = -1; i < chCount; i += 1) {
        const cx = p.x + i * gap + scroll;
        const cy = p.y + p.h - 8;
        if (cx < p.x + 14 || cx > p.x + p.w - 14) continue;
        ctx.beginPath();
        if (dir === 1) {
          ctx.moveTo(cx - 5, cy - 5);
          ctx.lineTo(cx + 2, cy);
          ctx.lineTo(cx - 5, cy + 5);
        } else {
          ctx.moveTo(cx + 5, cy - 5);
          ctx.lineTo(cx - 2, cy);
          ctx.lineTo(cx + 5, cy + 5);
        }
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    } else if (p.type === 'moving') {
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#0c4a6e';
      ctx.lineWidth = 2.5;
      roundRect(ctx, p.x, p.y, p.w, p.h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(p.x + 8, p.y + 4, p.w - 16, 5);
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 11px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.moveAxis === 'y' ? '▲ LIFT ▼' : '◀ LIFT ▶', p.x + p.w / 2, p.y + p.h - 5);
    } else {
      ctx.fillStyle = '#8b5a2b';
      ctx.strokeStyle = '#4e2e12';
      ctx.lineWidth = 2;
      roundRect(ctx, p.x, p.y, p.w, p.h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#a9714b';
      ctx.fillRect(p.x + 4, p.y + 3, p.w - 8, 5);
    }
  }
}

export function drawEnemies(ctx: CanvasRenderingContext2D, enemies: StageEnemy[], now = Date.now()) {
  for (const e of enemies) {
    ctx.save();
    if (e.kind === 'virus') {
      const isStomped = Boolean(e.stompedUntil && e.stompedUntil > now);
      const cx = e.x + e.w / 2;
      const cy = isStomped ? e.y + e.h - 10 : e.y + e.h / 2 + Math.sin(now * 0.012 + e.x * 0.05) * 2.5;
      const rx = e.w * 0.44;
      const ry = isStomped ? 9 : e.h * 0.42;

      // Spiky virus nodes around body
      if (!isStomped) {
        ctx.strokeStyle = '#581c87';
        ctx.lineWidth = 3;
        for (let a = 0; a < 8; a += 1) {
          const ang = (a / 8) * Math.PI * 2 + now * 0.003 * e.dir;
          const x1 = cx + Math.cos(ang) * (rx - 2);
          const y1 = cy + Math.sin(ang) * (ry - 2);
          const x2 = cx + Math.cos(ang) * (rx + 6);
          const y2 = cy + Math.sin(ang) * (ry + 6);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(x2, y2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Virus body
      ctx.fillStyle = isStomped ? '#6b21a8' : '#9333ea';
      ctx.strokeStyle = '#3b0764';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (isStomped) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 10px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('X _ X', cx, cy + 3);
      } else {
        // Angry glowing virus eyes
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(cx - 6, cy - 2, 4, 0, Math.PI * 2);
        ctx.arc(cx + 6, cy - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(cx - 6 + e.dir * 1.2, cy - 2, 1.8, 0, Math.PI * 2);
        ctx.arc(cx + 6 + e.dir * 1.2, cy - 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Walking Fireball monster
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2 + Math.abs(Math.sin(now * 0.015 + e.x * 0.04)) * -4;
      const r = e.w * 0.45;

      // Outer flame aura
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
      ctx.fill();

      // Inner orange-yellow core
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx, cy + 2, r * 0.62, 0, Math.PI * 2);
      ctx.fill();

      // Fierce eyes
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(cx - 5 + e.dir * 1.5, cy - 1, 2.4, 0, Math.PI * 2);
      ctx.arc(cx + 5 + e.dir * 1.5, cy - 1, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawPowerUps(ctx: CanvasRenderingContext2D, powerUps: StagePowerUp[], now = Date.now()) {
  for (const pu of powerUps) {
    if (pu.collectedUntil && pu.collectedUntil > now) continue;
    const bobY = Math.sin(now * 0.006 + pu.x) * 6;
    const cx = pu.x + pu.w / 2;
    const cy = pu.y + pu.h / 2 + bobY;

    ctx.save();
    // Glowing energy halo
    const halo = ctx.createRadialGradient(cx, cy, 3, cx, cy, 26);
    halo.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
    halo.addColorStop(0.5, 'rgba(56, 189, 248, 0.55)');
    halo.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();

    // Rotating power orb ring
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, now * 0.004, now * 0.004 + Math.PI * 1.5);
    ctx.stroke();

    // Power-Up Icon (Star or Blaster)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.kind === 'blaster' ? '⚡' : '🌟', cx, cy);

    // Floating pill badge
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx - 26, cy - 26, 52, 14, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px Nunito, sans-serif';
    ctx.fillText('POWER-UP', cx, cy - 18);
    ctx.restore();
  }
}

export function drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectile[], now = Date.now()) {
  void now;
  for (const pr of projectiles) {
    const isAdminRound = pr.kind === 'admin-round';
    const color = pr.color ?? '#38bdf8';
    const glow = pr.glow ?? '#bae6fd';
    const len = pr.length ?? 24;
    const thick = pr.thickness ?? 8;
    ctx.save();
    ctx.shadowColor = isAdminRound ? glow : '#38bdf8';
    ctx.shadowBlur = isAdminRound ? 18 : 12;

    const dir = pr.vx >= 0 ? 1 : -1;
    ctx.fillStyle = color;
    ctx.strokeStyle = isAdminRound ? glow : '#fef08a';
    ctx.lineWidth = 2;
    roundRect(ctx, pr.x - (dir === 1 ? len : 0), pr.y - thick / 2, len, thick, thick / 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    const coreLen = Math.max(3, len - 8);
    ctx.fillRect(pr.x - (dir === 1 ? len - 4 : -4), pr.y - 1.5, coreLen, 3);
    ctx.restore();
  }
}

export function drawBosses(ctx: CanvasRenderingContext2D, bosses: StageBoss[], now = Date.now()) {
  for (const b of bosses) {
    if (!b.alive) continue;
    const flash = Boolean(b.hitFlashUntil && b.hitFlashUntil > now);
    const cx = b.x + b.w / 2;
    // Walking bob tied to patrol (bigger amplitude when moving)
    const bob = Math.sin(now * 0.009 + b.x * 0.05) * 5;
    const by = b.y + bob;
    const facing = b.dir ?? -1;
    // Attack telegraph: mouth/core glow before spitting
    const telegraph = Boolean(b.attackUntil && b.attackUntil > now);
    const telegraphPulse = telegraph ? 0.5 + 0.5 * Math.sin(now * 0.04) : 0;

    ctx.save();
    if (flash) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 24;
    }

    const kind = b.kind;
    // Common body base
    const bodyColor = flash ? '#ffffff' : kind === 'overlord' ? '#4c0519' : kind === 'queen' ? '#7e22ce' : kind === 'tank' ? '#57534e' : kind === 'crab' ? '#0ea5e9' : kind === 'scorpion' ? '#b45309' : kind === 'golem' ? '#059669' : '#9333ea';
    const darkColor = flash ? '#e5e5e5' : kind === 'overlord' ? '#450a0a' : kind === 'queen' ? '#581c87' : kind === 'tank' ? '#292524' : kind === 'crab' ? '#0c4a6e' : kind === 'scorpion' ? '#7c2d12' : kind === 'golem' ? '#064e3b' : '#581c87';

    // Legs / treads per kind
    if (kind === 'tank') {
      // Treads
      ctx.fillStyle = darkColor;
      roundRect(ctx, b.x + 8, by + b.h - 26, b.w - 16, 22, 8);
      ctx.fill();
      ctx.fillStyle = '#3f3f46';
      for (let i = 0; i < 5; i += 1) {
        const wx = b.x + 18 + i * ((b.w - 44) / 4);
        ctx.beginPath();
        ctx.arc(wx, by + b.h - 15, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      // Cannon turret aimed at players
      ctx.fillStyle = bodyColor;
      roundRect(ctx, b.x + b.w / 2 - 10, by + 14, 20, b.h - 40, 6);
      ctx.fill();
      ctx.fillStyle = darkColor;
      ctx.fillRect(cx - 4, by - 6, 8, 26);
    } else if (kind === 'crab') {
      // Crab legs
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 5;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i += 1) {
          const lx = cx + side * (12 + i * 16);
          ctx.beginPath();
          ctx.moveTo(cx + side * 10, by + b.h * 0.6);
          ctx.lineTo(lx, by + b.h - 4);
          ctx.stroke();
        }
      }
      // Claws
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(b.x - 6, by + b.h * 0.45, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x + b.w + 6, by + b.h * 0.45, 13, 0, Math.PI * 2);
      ctx.fill();
      // Shell body
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(cx, by + b.h * 0.5, b.w * 0.44, b.h * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (kind === 'scorpion') {
      // Segmented tail with stinger
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w - 10, by + b.h * 0.55);
      ctx.quadraticCurveTo(b.x + b.w + 34, by + b.h * 0.2, b.x + b.w + 8, by - 6);
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(b.x + b.w + 8, by - 6, 6, 0, Math.PI * 2);
      ctx.fill();
      // Pincers
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(b.x - 4, by + b.h * 0.55, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x + b.w + 4, by + b.h * 0.55, 11, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(cx, by + b.h * 0.6, b.w * 0.4, b.h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'golem' || kind === 'guardian') {
      // Stone/metal golem: chunky body + glowing core
      ctx.fillStyle = bodyColor;
      roundRect(ctx, b.x + 10, by + 18, b.w - 20, b.h - 34, 12);
      ctx.fill();
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      // Arms swing while patrolling (dir-based phase)
      const swing = Math.sin(now * 0.009 + b.x * 0.05) * 6;
      ctx.fillStyle = darkColor;
      roundRect(ctx, b.x - 4, by + b.h * 0.35 + swing, 18, b.h * 0.5, 8);
      ctx.fill();
      roundRect(ctx, b.x + b.w - 14, by + b.h * 0.35 - swing, 18, b.h * 0.5, 8);
      ctx.fill();
      // Glowing core (pulses harder during attack telegraph)
      const corePulse = telegraph ? 0.85 + 0.15 * Math.sin(now * 0.04) : 0.6 + 0.4 * Math.sin(now * 0.01);
      ctx.fillStyle = telegraph ? `rgba(250, 204, 21, ${corePulse})` : kind === 'golem' ? `rgba(163, 230, 53, ${corePulse})` : `rgba(56, 189, 248, ${corePulse})`;
      ctx.beginPath();
      ctx.arc(cx + facing * 6, by + b.h * 0.52, telegraph ? 12 : 9, 0, Math.PI * 2);
      ctx.fill();
      if (telegraph) {
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.4 + 0.4 * telegraphPulse})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx + facing * 6, by + b.h * 0.52, 16 + 4 * telegraphPulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // queen / overlord: floating virus overlord with crown of spikes
      const haloGrad = ctx.createRadialGradient(cx, by + b.h * 0.5, 8, cx, by + b.h * 0.5, b.w * 0.7);
      haloGrad.addColorStop(0, kind === 'overlord' ? 'rgba(220, 38, 38, 0.5)' : 'rgba(168, 85, 247, 0.45)');
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, by + b.h * 0.5, b.w * 0.7, 0, Math.PI * 2);
      ctx.fill();
      // Spiky crown nodes
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 4;
      for (let a = 0; a < 9; a += 1) {
        const ang = (a / 9) * Math.PI * 2 + now * 0.002;
        const x1 = cx + Math.cos(ang) * (b.w * 0.38);
        const y1 = by + b.h * 0.5 + Math.sin(ang) * (b.h * 0.36);
        const x2 = cx + Math.cos(ang) * (b.w * 0.5);
        const y2 = by + b.h * 0.5 + Math.sin(ang) * (b.h * 0.47);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.fillStyle = kind === 'overlord' ? '#ef4444' : '#a855f7';
        ctx.beginPath();
        ctx.arc(x2, y2, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Body
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(cx, by + b.h * 0.5, b.w * 0.4, b.h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 3;
      ctx.stroke();
      if (kind === 'overlord') {
        // Crown
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(cx - 22, by + 4);
        ctx.lineTo(cx - 14, by - 12);
        ctx.lineTo(cx - 7, by + 2);
        ctx.lineTo(cx, by - 16);
        ctx.lineTo(cx + 7, by + 2);
        ctx.lineTo(cx + 14, by - 12);
        ctx.lineTo(cx + 22, by + 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Eyes (angry, tracking patrol direction)
    ctx.fillStyle = telegraph ? '#fca5a5' : '#fef08a';
    ctx.beginPath();
    ctx.arc(cx - 10, by + b.h * 0.32, 4.5, 0, Math.PI * 2);
    ctx.arc(cx + 10, by + b.h * 0.32, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(cx - 10 + facing * 1.5, by + b.h * 0.32, 2, 0, Math.PI * 2);
    ctx.arc(cx + 10 + facing * 1.5, by + b.h * 0.32, 2, 0, Math.PI * 2);
    ctx.fill();

    // HP bar above boss
    const hpRatio = Math.max(0, b.hp / b.maxHp);
    const barW = Math.max(70, b.w * 0.9);
    const barX = cx - barW / 2;
    const barY = b.y - 22;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    roundRect(ctx, barX - 2, barY - 2, barW + 4, 12, 5);
    ctx.fill();
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#fbbf24' : '#ef4444';
    roundRect(ctx, barX, barY, barW * hpRatio, 8, 3);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${b.name}  ${b.hp}/${b.maxHp}`, cx, barY - 5);

    ctx.restore();
  }
}

export function drawBossProjectiles(ctx: CanvasRenderingContext2D, bossProjectiles: { x: number; y: number; vx: number }[], now = Date.now()) {
  for (const bp of bossProjectiles) {
    const pulse = 0.7 + 0.3 * Math.sin(now * 0.02);
    const r = 9 + pulse * 2;
    // Toxic neon goo ball with trail
    const grad = ctx.createRadialGradient(bp.x, bp.y, 2, bp.x, bp.y, r + 6);
    grad.addColorStop(0, 'rgba(250, 204, 21, 0.95)');
    grad.addColorStop(0.55, 'rgba(163, 230, 53, 0.8)');
    grad.addColorStop(1, 'rgba(20, 83, 45, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, r + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(bp.x - bp.vx * 10, bp.y - 3, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

export { drawCat };
