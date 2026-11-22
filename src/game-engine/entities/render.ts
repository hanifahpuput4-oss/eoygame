import { DECOR, WORLD, type Platform } from '../maps/world';

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
  const colors = isBurning
    ? flickerFire
      ? { body: '#ea580c', belly: '#fed7aa', ear: '#9a3412' }
      : { body: '#451a03', belly: '#fdba74', ear: '#dc2626' }
    : role === 'admin'
      ? { body: '#e11d48', belly: '#fecdd3', ear: '#9f1239' }
      : role === 'teacher'
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

  const hasStaffTitle = role === 'teacher' || role === 'admin';
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

  ctx.fillStyle = role === 'admin' ? '#9f1239' : role === 'teacher' ? '#8c5308' : '#111827';
  ctx.font = 'bold 11px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, drawX + w / 2, y - 14);
  if (role === 'admin') {
    ctx.fillStyle = '#ff2a5f';
    ctx.font = 'bold 9.5px Nunito, sans-serif';
    ctx.fillText('ADMINISTRATOR', drawX + w / 2, y - 26);
  } else if (role === 'teacher') {
    ctx.fillStyle = '#ffd338';
    ctx.font = 'bold 9px Nunito, sans-serif';
    ctx.fillText('TEACHER', drawX + w / 2, y - 26);
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

export function drawWorld(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  sky.addColorStop(0, '#4b94e6');
  sky.addColorStop(0.65, '#8ec8fa');
  sky.addColorStop(1, '#c3e7ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Soft distant rolling hills
  ctx.fillStyle = 'rgba(116, 198, 122, 0.35)';
  for (let hx = 0; hx < WORLD.width; hx += 460) {
    ctx.beginPath();
    ctx.arc(hx + 230, WORLD.groundY + 70, 290, Math.PI, 0);
    ctx.fill();
  }

  // Fluffy clouds
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const c of DECOR.clouds) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 26 * c.s, 0, Math.PI * 2);
    ctx.arc(c.x + 30 * c.s, c.y - 12 * c.s, 24 * c.s, 0, Math.PI * 2);
    ctx.arc(c.x + 60 * c.s, c.y, 24 * c.s, 0, Math.PI * 2);
    ctx.fill();
  }

  // School building (centerpiece with clock tower & walkable ledges)
  const school = DECOR.school;
  ctx.fillStyle = '#ead7bd';
  ctx.strokeStyle = '#997d5c';
  ctx.lineWidth = 3;
  ctx.fillRect(school.x, school.y, school.w, school.h);
  ctx.strokeRect(school.x, school.y, school.w, school.h);

  // Central clock tower section
  const towerW = 130;
  const towerX = school.x + school.w / 2 - towerW / 2;
  ctx.fillStyle = '#f3e5cb';
  ctx.fillRect(towerX, school.y - 105, towerW, 105);
  ctx.strokeRect(towerX, school.y - 105, towerW, 105);

  // School roof & pediment
  ctx.fillStyle = '#5a7094';
  ctx.beginPath();
  ctx.moveTo(towerX - 18, school.y - 105);
  ctx.lineTo(school.x + school.w / 2, school.y - 155);
  ctx.lineTo(towerX + towerW + 18, school.y - 105);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Clock face
  const clockCx = school.x + school.w / 2;
  const clockCy = school.y - 55;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3b4e6d';
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
      ctx.fillStyle = '#9fd3f7';
      ctx.strokeStyle = '#5b7290';
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

  // School double doors
  ctx.fillStyle = '#6c4223';
  roundRect(ctx, school.x + school.w / 2 - 38, school.y + school.h - 105, 76, 105, 8);
  ctx.fill();
  ctx.strokeStyle = '#3f220c';
  ctx.stroke();

  // Trees
  for (const t of DECOR.trees) {
    const s = t.s ?? 1;
    ctx.fillStyle = '#6b3e1a';
    ctx.fillRect(t.x - 9 * s, t.y - 46 * s, 18 * s, 46 * s);
    ctx.fillStyle = '#2d8a34';
    ctx.beginPath();
    ctx.arc(t.x, t.y - 68 * s, 38 * s, 0, Math.PI * 2);
    ctx.arc(t.x - 28 * s, t.y - 50 * s, 28 * s, 0, Math.PI * 2);
    ctx.arc(t.x + 28 * s, t.y - 50 * s, 28 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#48b04f';
    ctx.beginPath();
    ctx.arc(t.x - 10 * s, t.y - 76 * s, 18 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wooden signboard on left platform
  const sign = DECOR.sign;
  ctx.fillStyle = '#5a3214';
  ctx.fillRect(sign.x + 30, sign.y + 58, 12, 32);
  ctx.fillRect(sign.x + 110, sign.y + 58, 12, 32);
  ctx.fillStyle = '#d89b56';
  ctx.strokeStyle = '#6c3e18';
  ctx.lineWidth = 3;
  roundRect(ctx, sign.x, sign.y, 152, 62, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4e2709';
  ctx.font = 'bold 11px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Kerja sama tim untuk', sign.x + 76, sign.y + 24);
  ctx.fillText('menyelesaikan tantangan! ➜', sign.x + 76, sign.y + 42);

  // Stone Arch Finish Gate with heavy iron chains & "COMING SOON" seal
  const gate = DECOR.gate;
  ctx.save();
  ctx.fillStyle = '#9ca3af';
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 3;
  roundRect(ctx, gate.x, gate.y, 130, 160, 62);
  ctx.fill();
  ctx.stroke();

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

  // "COMING SOON" wooden plaque on gate
  ctx.fillStyle = '#fbbf24';
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2.5;
  roundRect(ctx, gate.x + 10, gate.y + 118, 110, 24, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#451a03';
  ctx.font = 'bold 11px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('COMING SOON', gate.x + 65, gate.y + 134);

  // Red flag on top of gate
  ctx.strokeStyle = '#4b2e14';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gate.x + 65, gate.y);
  ctx.lineTo(gate.x + 65, gate.y - 38);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(gate.x + 65, gate.y - 38);
  ctx.lineTo(gate.x + 98, gate.y - 28);
  ctx.lineTo(gate.x + 65, gate.y - 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[]) {
  for (const p of platforms) {
    if (p.type === 'ground') {
      ctx.fillStyle = '#3ca338';
      ctx.fillRect(p.x, p.y, p.w, 18);
      ctx.fillStyle = '#257322';
      ctx.fillRect(p.x, p.y + 18, p.w, 6);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(p.x, p.y + 24, p.w, p.h - 24);
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
    } else if (p.type === 'qblock' || p.type === 'qblock-correct' || p.type === 'qblock-wrong') {
      const isCorrect = p.type === 'qblock-correct';
      const isWrong = p.type === 'qblock-wrong';
      ctx.fillStyle = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : '#fbbf24';
      ctx.strokeStyle = isCorrect ? '#14532d' : isWrong ? '#7f1d1d' : '#92400e';
      ctx.lineWidth = 3;
      roundRect(ctx, p.x, p.y, p.w, p.h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(p.x + 6, p.y + 4, p.w - 12, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Nunito, sans-serif';
      ctx.textAlign = 'center';
      const symbol = isCorrect ? '✔' : isWrong ? '✖' : '?';
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

export { drawCat };
