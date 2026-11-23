import re

head = open('scratch/page_head.tsx', 'rb').read().decode('utf-16')
out = head

# 1 draggingRef type
old1 = "  const draggingRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });"
new1 = "  const draggingRef = useRef<{ active: boolean; x: number; y: number; moved: boolean }>({ active: false, x: 0, y: 0, moved: false });"
print('drag anchor:', out.count(old1))
out = out.replace(old1, new1)

# 2 rejoin mirror reset
old2 = "    setFeedback(null);\r\n    if (myIdRef.current) {"
new2 = "    setFeedback(null);\r\n    // Guru/Admin selalu mulai dengan mirror OFF saat rejoin\r\n    mirrorTargetRef.current = null;\r\n    setMirrorTarget(null);\r\n    questionBlocksRef.current = [];\r\n    if (myIdRef.current) {"
print('rejoin anchor:', out.count(old2))
out = out.replace(old2, new2)

# 3 mount mirror reset
old3 = "      setRoom(r);\r\n      roomRef.current = r;"
new3 = "      if (isStaffRole(p.role)) {\r\n        mirrorTargetRef.current = null;\r\n        setMirrorTarget(null);\r\n      }\r\n      setRoom(r);\r\n      roomRef.current = r;"
print('mount anchor:', out.count(old3))
out = out.replace(old3, new3)

# 4 assist_answer banner
m = re.search(r"setStageBanner\('[^']*Soal telah dibantu dijawab[^']*'\);", out)
print('banner anchor:', bool(m))
out = out[: m.start()] + "setStageBanner('⭐ Soal sudah dibantu jawab');" + out[m.end():]

# 5 silent /
old5 = "    if (!isStaff) {\r\n      addSystemChatMessage('Perintah command (/) hanya dapat digunakan oleh Guru dan Administrator.');\r\n      return;\r\n    }"
new5 = "    if (!isStaff) {\r\n      // Siswa ketik '/' dianggap chat biasa, tanpa pesan error\r\n      return;\r\n    }"
print('slash anchor:', out.count(old5))
out = out.replace(old5, new5)

# 6 staff submit persist
old6 = "      ably.publishCommand({ op: 'assist_answer', targetId, qid: answeredId });\r\n      soundEngine.playAnswerCorrect();"
new6 = "      ably.publishCommand({ op: 'assist_answer', targetId, qid: answeredId });\r\n      // Persist ke database supaya centang biru bertahan walau siswa rejoin\r\n      fetch('/api/game/assist-answer', {\r\n        method: 'POST',\r\n        headers: { 'Content-Type': 'application/json' },\r\n        body: JSON.stringify({ roomId, targetId, questionId: answeredId, answer: selected }),\r\n      }).catch(() => {});\r\n      soundEngine.playAnswerCorrect();"
print('persist anchor:', out.count(old6))
out = out.replace(old6, new6)

# 7 pointer handlers
old7 = """  function onPointerDown(e: React.PointerEvent) {\r
    draggingRef.current = { active: true, x: e.clientX, y: e.clientY };\r
    (e.target as HTMLElement).setPointerCapture(e.pointerId);\r
    setChatMinimized(true);\r
  }\r
  function onPointerMove(e: React.PointerEvent) {\r
    if (!draggingRef.current.active || !cameraRef.current) return;\r
    cameraRef.current.panBy(e.clientX - draggingRef.current.x, e.clientY - draggingRef.current.y);\r
    draggingRef.current = { active: true, x: e.clientX, y: e.clientY };\r
  }\r
  function onPointerUp() {\r
    draggingRef.current.active = false;\r
  }"""
new7 = """  function onPointerDown(e: React.PointerEvent) {\r
    draggingRef.current = { active: true, x: e.clientX, y: e.clientY, moved: false };\r
    (e.target as HTMLElement).setPointerCapture(e.pointerId);\r
    setChatMinimized(true);\r
  }\r
  function onPointerMove(e: React.PointerEvent) {\r
    if (!draggingRef.current.active || !cameraRef.current) return;\r
    const dx = e.clientX - draggingRef.current.x;\r
    const dy = e.clientY - draggingRef.current.y;\r
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) draggingRef.current.moved = true;\r
    cameraRef.current.panBy(dx, dy);\r
    draggingRef.current = { active: true, x: e.clientX, y: e.clientY, moved: draggingRef.current.moved };\r
  }\r
  function onPointerUp(e: React.PointerEvent) {\r
    const wasDrag = draggingRef.current.moved;\r
    draggingRef.current.active = false;\r
    // Admin: klik (bukan drag) langsung pada kotak soal untuk membukanya\r
    if (\r
      wasDrag ||\r
      myRoleRef.current !== 'admin' ||\r
      questionRef.current ||\r
      questionBlocksRef.current.length === 0\r
    )\r
      return;\r
    const canvas = canvasRef.current;\r
    const cam = cameraRef.current;\r
    if (!canvas || !cam) return;\r
    const rect = canvas.getBoundingClientRect();\r
    const worldX = (e.clientX - rect.left) / cam.zoom + cam.x;\r
    const worldY = (e.clientY - rect.top) / cam.zoom + cam.y;\r
    const hit = questionBlocksRef.current.find(\r
      (b) => worldX >= b.x && worldX <= b.x + b.w && worldY >= b.y && worldY <= b.y + b.h,\r
    );\r
    if (!hit || !hit.questionId) return;\r
    const res = answerResultsRef.current.get(hit.questionId);\r
    if (res === true || res === 'assisted') return;\r
    const found = levelQuestionsRef.current.find((q) => q.id === hit.questionId);\r
    if (!found) return;\r
    soundEngine.playQuestionOpen();\r
    questionRef.current = found;\r
    setQuestion(found);\r
    setQuestionMinimized(false);\r
    setSelected('');\r
  }"""
print('pointer anchor:', out.count(old7))
out = out.replace(old7, new7)

# 8 bootstrap ingest
old8 = "          for (const [qid, okAns] of Object.entries(data.answerResults as Record<string, boolean>)) {\r\n            answerResultsRef.current.set(qid, Boolean(okAns));\r\n          }"
new8 = "          for (const [qid, okAns] of Object.entries(data.answerResults as Record<string, boolean | 'assisted'>)) {\r\n            answerResultsRef.current.set(qid, okAns === 'assisted' ? 'assisted' : Boolean(okAns));\r\n          }"
print('bootstrap anchor:', out.count(old8))
out = out.replace(old8, new8)

# 9 sync ingest
old9 = "            for (const [qid, okAns] of Object.entries(data.answerResults as Record<string, boolean>)) {\r\n              answerResultsRef.current.set(qid, Boolean(okAns));\r\n            }"
new9 = "            for (const [qid, okAns] of Object.entries(data.answerResults as Record<string, boolean | 'assisted'>)) {\r\n              answerResultsRef.current.set(qid, okAns === 'assisted' ? 'assisted' : Boolean(okAns));\r\n            }"
print('sync anchor:', out.count(old9))
out = out.replace(old9, new9)

open('src/app/game/[id]/page.tsx', 'w', encoding='utf-8', newline='').write(out)
print('WROTE, length', len(out))
