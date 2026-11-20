import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email tidak valid'),
  username: z
    .string()
    .min(3, 'Username minimal 3 karakter')
    .max(24, 'Username maksimal 24 karakter')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh huruf, angka, dan underscore'),
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter').max(80),
  password: z.string().min(8, 'Password minimal 8 karakter').max(72),
  role: z.enum(['teacher', 'student']),
  inviteCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email atau username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const classroomSchema = z.object({
  name: z.string().min(3, 'Nama kelas minimal 3 karakter').max(80),
  subject: z.string().min(2, 'Mata pelajaran wajib diisi').max(60),
  grade: z.string().min(1, 'Kelas wajib diisi').max(30),
  description: z.string().max(300).default(''),
});

const questionBase = z.object({
  type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'fill_blank']),
  content: z.string().min(5, 'Pertanyaan minimal 5 karakter').max(500),
  imageUrl: z.string().url().optional().or(z.literal('')),
  correctAnswer: z.string().min(1, 'Jawaban benar wajib diisi').max(300),
  explanation: z.string().max(500).default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string().min(1, 'Kategori wajib diisi').max(60),
  points: z.number().int().min(1).max(100),
  timeLimit: z.number().int().min(5).max(300),
  options: z
    .array(
      z.object({
        label: z.enum(['A', 'B', 'C', 'D']),
        content: z.string().min(1, 'Pilihan tidak boleh kosong').max(200),
      }),
    )
    .max(4)
    .default([]),
});

export const questionSchema = questionBase
  .refine(
    (q) => q.type !== 'multiple_choice' || q.options.length >= 2,
    { message: 'Pilihan ganda minimal 2 opsi', path: ['options'] },
  )
  .refine(
    (q) =>
      q.type !== 'multiple_choice' ||
      q.options.some((o) => o.label === q.correctAnswer),
    { message: 'Jawaban benar harus salah satu dari opsi A-D', path: ['correctAnswer'] },
  );

export const questionUpdateSchema = questionBase.partial();

export const levelSchema = z.object({
  name: z.string().min(2, 'Nama tujuan pembelajaran minimal 2 karakter').max(120),
  description: z.string().max(300).default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('easy'),
  questionIds: z.array(z.string()).max(100).default([]),
  mapConfig: z.record(z.string(), z.unknown()).optional(),
  rewardConfig: z.record(z.string(), z.unknown()).default({}),
  completionRequirement: z.number().int().min(1).max(100).default(1),
});

export const roomSchema = z.object({
  name: z.string().min(3, 'Nama ruang minimal 3 karakter').max(80),
  classroomId: z.string().min(1, 'Kelas wajib dipilih'),
  levelId: z.string().min(1, 'Level wajib dipilih'),
  maxPlayers: z.number().int().min(2).max(60).default(40),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export const joinRoomSchema = z.object({
  code: z
    .string()
    .length(6, 'Kode ruang harus 6 karakter')
    .regex(/^[A-Z0-9]+$/, 'Kode hanya boleh huruf dan angka'),
});

export const chatSchema = z.object({
  text: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(140, 'Pesan maksimal 140 karakter'),
});

export const answerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1, 'Jawaban wajib diisi').max(300),
  timeSpent: z.number().int().min(0).max(3600).default(0),
});

export const moveSchema = z.object({
  x: z.number().min(-10000).max(10000),
  y: z.number().min(-10000).max(10000),
  facing: z.number().int().min(-1).max(1).default(1),
  roomId: z.string().min(1).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type LevelInput = z.infer<typeof levelSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
