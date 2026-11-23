# -*- coding: utf-8 -*-
"""Append stages 5-10 to world.ts (derived from stage 4 layout, themed remaps)."""
import io, sys, math

PATH = r"c:\Users\TKJ\Desktop\llysSmart\src\game-engine\maps\world.ts"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()
CRLF = "\r\n" in src
if CRLF:
    src = src.replace("\r\n", "\n")

if "STAGE10_PLATFORMS" in src:
    print("ALREADY_APPLIED")
    sys.exit(0)

# ---- raw stage-4 platform template (exact copy from world.ts STAGE4_PLATFORMS) ----
TPL = [
    dict(x=0, y=820, w=5600, h=280, type="ground"),
    dict(x=40, y=710, w=220, h=28, type="stone"),
    dict(x=300, y=640, w=160, h=24, type="crumble"),
    dict(x=520, y=580, w=180, h=26, type="stone"),
    dict(x=720, y=794, w=180, h=26, type="spike"),
    dict(x=760, y=660, w=160, h=24, type="moving", baseX=760, baseY=660, moveAxis="x", moveRange=100, moveSpeed=0.0022, movePhase=0),
    dict(x=980, y=530, w=320, h=22, type="stone"),
    dict(x=960, y=390, w=360, h=22, type="roof"),
    dict(x=1060, y=260, w=170, h=22, type="roof"),
    dict(x=900, y=798, w=64, h=22, type="bounce"),
    dict(x=1360, y=460, w=150, h=24, type="moving", baseX=1360, baseY=460, moveAxis="y", moveRange=130, moveSpeed=0.0025, movePhase=1.57),
    dict(x=1560, y=794, w=220, h=26, type="spike"),
    dict(x=1580, y=640, w=140, h=24, type="crumble"),
    dict(x=1780, y=570, w=150, h=24, type="stone"),
    dict(x=1980, y=500, w=140, h=24, type="crumble"),
    dict(x=1740, y=330, w=190, h=24, type="roof"),
    dict(x=1880, y=794, w=180, h=26, type="fire"),
    dict(x=2120, y=798, w=64, h=22, type="bounce"),
    dict(x=2250, y=680, w=280, h=28, type="stone"),
    dict(x=2360, y=520, w=150, h=24, type="moving", baseX=2360, baseY=520, moveAxis="x", moveRange=100, moveSpeed=0.0024, movePhase=0),
    dict(x=2640, y=420, w=150, h=24, type="moving", baseX=2640, baseY=420, moveAxis="x", moveRange=100, moveSpeed=0.0024, movePhase="Math.PI"),
    dict(x=2840, y=340, w=220, h=24, type="stone"),
    dict(x=2820, y=590, w=160, h=24, type="crumble"),
    dict(x=2600, y=794, w=150, h=26, type="spike"),
    dict(x=2980, y=794, w=140, h=26, type="fire"),
    dict(x=3080, y=798, w=64, h=22, type="bounce"),
    dict(x=3180, y=680, w=260, h=28, type="stone"),
    dict(x=3480, y=590, w=150, h=24, type="crumble"),
    dict(x=3420, y=420, w=150, h=24, type="moving", baseX=3420, baseY=420, moveAxis="y", moveRange=130, moveSpeed=0.0026, movePhase=0.8),
    dict(x=3660, y=540, w=320, h=26, type="stone"),
    dict(x=3720, y=380, w=250, h=24, type="roof"),
    dict(x=3800, y=230, w=180, h=22, type="roof"),
    dict(x=4020, y=650, w=220, h=26, type="stone"),
    dict(x=3500, y=794, w=140, h=26, type="spike"),
    dict(x=3880, y=794, w=110, h=26, type="fire"),
    dict(x=4220, y=560, w=150, h=24, type="crumble"),
    dict(x=4420, y=480, w=240, h=26, type="stone"),
    dict(x=4320, y=310, w=190, h=24, type="moving", baseX=4320, baseY=310, moveAxis="x", moveRange=100, moveSpeed=0.0024, movePhase=1.6),
    dict(x=4620, y=220, w=210, h=24, type="roof"),
    dict(x=4720, y=600, w=160, h=24, type="crumble"),
    dict(x=4860, y=440, w=220, h=26, type="stone"),
    dict(x=4640, y=640, w=160, h=24, type="moving", baseX=4640, baseY=640, moveAxis="x", moveRange=100, moveSpeed=0.0023, movePhase=0),
    dict(x=4360, y=794, w=130, h=26, type="spike"),
    dict(x=4540, y=794, w=140, h=26, type="fire"),
    dict(x=4780, y=798, w=64, h=22, type="bounce"),
    dict(x=5120, y=700, w=400, h=32, type="stone"),
    dict(x=5180, y=540, w=280, h=26, type="roof"),
]

# theme remap per stage: (name, label, type_map, speed_mult)
THEMES = [
    (5, "Hutan Neon Biolumin", {"roof": "crumble", "fire": "spike", "stone": "stone", "spike": "fire", "crumble": "roof", "bounce": "bounce"}, 1.0),
    (6, "Kota Roda Gigi", {"roof": "stone", "fire": "fire", "stone": "moving", "spike": "spike", "crumble": "crumble", "bounce": "bounce"}, 1.05),
    (7, "Samudra Es", {"roof": "roof", "fire": "spike", "stone": "crumble", "spike": "fire", "crumble": "stone", "bounce": "bounce"}, 1.1),
    (8, "Gurun Reruntuhan", {"roof": "crumble", "fire": "fire", "stone": "roof", "spike": "spike", "crumble": "stone", "bounce": "bounce"}, 1.15),
    (9, "Sarang Virus", {"roof": "stone", "fire": "spike", "stone": "fire", "spike": "stone", "crumble": "crumble", "bounce": "bounce"}, 1.2),
    (10, "Menara Final Boss", {"roof": "roof", "fire": "fire", "stone": "stone", "spike": "spike", "crumble": "crumble", "bounce": "bounce"}, 1.25),
]

def fmt_platform(p, indent="  "):
    base = f"{indent}{{ x: {p['x']}, y: {p['y']}, w: {p['w']}, h: {p['h']}, type: '{p['type']}'"
    if p["type"] == "moving":
        base += f", baseX: {p['baseX']}, baseY: {p['baseY']}, moveAxis: '{p['moveAxis']}', moveRange: {p['moveRange']}, moveSpeed: {p['moveSpeed']}, movePhase: {p['movePhase']}"
    return base + " },"

QBLOCK_TPL = [
    (360, 520), (590, 460), (800, 530), (1030, 410), (1130, 150),
    (1260, 410), (1430, 320), (1650, 510), (1830, 440), (1810, 210),
    (2050, 390), (2430, 390), (2710, 300), (2910, 220), (2890, 470),
    (3250, 550), (3490, 300), (3730, 410), (3850, 120), (4090, 530),
    (4290, 440), (4490, 360), (4690, 110), (4790, 480), (4950, 320),
]

# enemy template (from stage 4 fallback list)
ENEMY_TPL = [
    ("virus", 440, 780, 38, 40, 310, 690, 2.3, 1),
    ("virus", 1120, 490, 38, 40, 1010, 1340, 2.2, -1),
    ("virus", 2360, 640, 38, 40, 2270, 2520, 2.4, 1),
    ("virus", 3740, 500, 38, 40, 3680, 4020, 2.3, -1),
    ("virus", 4620, 590, 38, 40, 4520, 4780, 2.2, 1),
    ("fireball", 1220, 786, 34, 34, 1050, 1470, 3.2, 1),
    ("fireball", 2020, 786, 34, 34, 1860, 2220, 3.2, -1),
    ("fireball", 2840, 300, 34, 34, 2740, 2980, 3.0, 1),
    ("fireball", 3960, 786, 34, 34, 3840, 4180, 3.3, -1),
    ("fireball", 4960, 786, 34, 34, 4840, 5140, 3.2, -1),
]

PU_POS = [(360, 580), (1810, 270), (2840, 280), (3720, 320), (4620, 160)]

out = []
for stage, label, tmap, spmul in THEMES:
    # platforms
    out.append(f"// ===================== STAGE {stage}: {label} =====================")
    out.append(f"export const STAGE{stage}_PLATFORMS: Platform[] = [")
    out.append("  // Main ground")
    out.append(fmt_platform(TPL[0]))
    for p in TPL[1:]:
        t = tmap.get(p["type"], p["type"])
        q = dict(p)
        q["type"] = t
        if t == "moving" and p["type"] != "moving":
            # converted hazard -> moving platform: copy geometry, gentle horizontal
            q.update(baseX=p["x"], baseY=p["y"], moveAxis="x", moveRange=100, moveSpeed=0.0023, movePhase=round((p["x"] % 628) / 100.0, 2))
        out.append(fmt_platform(q))
    out.append("];")
    out.append("")

    # qblock spots: rotate template by (stage-4)*7 with small y jitter
    off = (stage - 4) * 7
    out.append(f"export const STAGE{stage}_QBLOCK_SPOTS: {{ x: number; y: number }}[] = [")
    for i in range(25):
        bx, by = QBLOCK_TPL[(i + off) % 25]
        jy = ((stage * 13 + i * 7) % 41) - 20
        y = max(100, min(620, by + jy))
        out.append(f"  {{ x: {bx}, y: {y} }},")
    out.append("];")
    out.append("")

# stage records + selector patch
out.append("export const STAGE_PLATFORM_MAP: Record<number, Platform[]> = {")
for stage, label, tmap, spmul in THEMES:
    out.append(f"  {stage}: STAGE{stage}_PLATFORMS,")
out.append("};")
out.append("")
out.append("export const STAGE_QBLOCK_MAP: Record<number, { x: number; y: number }[]> = {")
for stage, label, tmap, spmul in THEMES:
    out.append(f"  {stage}: STAGE{stage}_QBLOCK_SPOTS,")
out.append("};")
out.append("")
out.append("export const MAX_STAGE = 10;")
out.append("")

block = "\n".join(out) + "\n"

anchor = "export function createStagePowerUps(stage: number): StagePowerUp[] {"
assert src.count(anchor) == 1, "powerup anchor not unique"
src = src.replace(anchor, block + "\n" + anchor)

# ---- patch createStagePowerUps: stages 5-10 before stage 4 ----
old_pu = "  if (stage <= 1) return [];\n  if (stage === 4) {"
new_pu = "  if (stage <= 1) return [];\n  if (stage >= 5 && stage <= MAX_STAGE) {\n    const kinds: Array<'blaster' | 'star'> = ['blaster', 'star', 'blaster', 'star', 'blaster'];\n    return PU_POS.map((pos, i) => ({ id: `pu_s${stage}_${i + 1}`, stage, kind: kinds[i], x: pos[0], y: pos[1], w: 34, h: 34 }));\n  }\n  if (stage === 4) {"
# PU_POS defined as tuple list -> inline instead
new_pu = new_pu.replace("PU_POS.map", "[[360, 580], [1810, 270], [2840, 280], [3720, 320], [4620, 160]].map((pos: [number, number]) => void 0).length ? PU_POS.map")
assert src.count(old_pu) == 1, "pu anchor missing"
src = src.replace(old_pu, "  if (stage <= 1) return [];\n  if (stage >= 5 && stage <= MAX_STAGE) {\n    const kinds: Array<'blaster' | 'star'> = ['blaster', 'star', 'blaster', 'star', 'blaster'];\n    const posList: Array<[number, number]> = [[360, 580], [1810, 270], [2840, 280], [3720, 320], [4620, 160]];\n    return posList.map((pos, i) => ({ id: `pu_s${stage}_${i + 1}`, stage, kind: kinds[i], x: pos[0], y: pos[1], w: 34, h: 34 }));\n  }\n  if (stage === 4) {")

# ---- patch createStageEnemies: stages 5-10 ----
old_en = "export function createStageEnemies(stage: number): StageEnemy[] {\n  if (stage <= 1) return [];\n  if (stage === 2) {"
new_en = ("export function createStageEnemies(stage: number): StageEnemy[] {\n"
"  if (stage <= 1) return [];\n"
"  if (stage >= 5 && stage <= MAX_STAGE) {\n"
"    const spd = 1 + (stage - 4) * 0.08;\n"
"    const tpl: Array<[string, number, number, number, number, number, number, number, number]> = [\n"
"      ['virus', 440, 780, 38, 40, 310, 690, 2.3, 1],\n"
"      ['virus', 1120, 490, 38, 40, 1010, 1340, 2.2, -1],\n"
"      ['virus', 2360, 640, 38, 40, 2270, 2520, 2.4, 1],\n"
"      ['virus', 3740, 500, 38, 40, 3680, 4020, 2.3, -1],\n"
"      ['virus', 4620, 590, 38, 40, 4520, 4780, 2.2, 1],\n"
"      ['fireball', 1220, 786, 34, 34, 1050, 1470, 3.2, 1],\n"
"      ['fireball', 2020, 786, 34, 34, 1860, 2220, 3.2, -1],\n"
"      ['fireball', 2840, 300, 34, 34, 2740, 2980, 3.0, 1],\n"
"      ['fireball', 3960, 786, 34, 34, 3840, 4180, 3.3, -1],\n"
"      ['fireball', 4960, 786, 34, 34, 4840, 5140, 3.2, -1],\n"
"    ];\n"
"    return tpl.map((e, i) => ({ id: `x${stage}_${i}`, kind: e[0] as 'virus' | 'fireball', x: e[1], y: e[2], w: e[3], h: e[4], minX: e[5], maxX: e[6], speed: Math.round(e[7] * spd * 10) / 10, dir: e[8] }));\n"
"  }\n"
"  if (stage === 2) {")
assert src.count(old_en) == 1, "enemy anchor missing"
src = src.replace(old_en, new_en)

# ---- patch getStageBasePlatforms ----
old_sel = "  const src = stage === 4 ? STAGE4_PLATFORMS : stage === 3 ? STAGE3_PLATFORMS : stage === 2 ? STAGE2_PLATFORMS : PLATFORMS;"
new_sel = "  const src = STAGE_PLATFORM_MAP[stage] ?? (stage === 4 ? STAGE4_PLATFORMS : stage === 3 ? STAGE3_PLATFORMS : stage === 2 ? STAGE2_PLATFORMS : PLATFORMS);"
assert src.count(old_sel) == 1, "selector anchor missing"
src = src.replace(old_sel, new_sel)

# ---- patch generateQuestionBlocks baseSpots ----
old_bs = "  const baseSpots = stage === 4 ? STAGE4_QBLOCK_SPOTS : stage === 3 ? STAGE3_QBLOCK_SPOTS : stage === 2 ? STAGE2_QBLOCK_SPOTS : QBLOCK_CANDIDATE_SPOTS;"
new_bs = "  const baseSpots = STAGE_QBLOCK_MAP[stage] ?? (stage === 4 ? STAGE4_QBLOCK_SPOTS : stage === 3 ? STAGE3_QBLOCK_SPOTS : stage === 2 ? STAGE2_QBLOCK_SPOTS : QBLOCK_CANDIDATE_SPOTS);"
assert src.count(old_bs) == 1, "basespots anchor missing"
src = src.replace(old_bs, new_bs)

if CRLF:
    src = src.replace("\n", "\r\n")
with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src)
print("OK world.ts updated, lines:", src.count("\n") + 1)
