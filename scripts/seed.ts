import { config } from 'dotenv';
config();

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { hashPassword, generateId } from '../src/server/auth/crypto';

const client = createClient({
  url: process.env.DATABASE_URL ?? 'file:local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

const levelsData = [
  {
    name: 'Level 1: Pengenalan Excel',
    category: 'Pengenalan Excel',
    questions: [
      {
        q: 'Fungsi dari rumus =VLOOKUP adalah?',
        options: ['Menghitung jumlah data', 'Mencari data pada tabel', 'Menjumlahkan angka', 'Mengurutkan data', 'Menghapus duplikat'],
        answer: 'B',
      },
      {
        q: 'Perpotongan antara baris dan kolom pada lembar kerja Excel disebut?',
        options: ['Workbook', 'Range', 'Cell', 'Formula Bar', 'Ribbon'],
        answer: 'C',
      },
      {
        q: 'Setiap penulisan rumus atau fungsi di Microsoft Excel wajib diawali tanda?',
        options: ['= (Sama dengan)', '# (Tagar)', '@ (At)', '$ (Dolar)', '% (Persen)'],
        answer: 'A',
      },
    ],
  },
  {
    name: 'Level 2: Pengolahan Data',
    category: 'Pengolahan Data',
    questions: [
      {
        q: 'Manakah fungsi yang digunakan untuk menjumlahkan data pada Excel?',
        options: ['VLOOKUP', 'SUM', 'IF', 'COUNT', 'PROPER'],
        answer: 'B',
      },
      {
        q: 'Rumus yang digunakan untuk menghitung nilai rata-rata dari sekumpulan angka adalah?',
        options: ['SUM', 'AVERAGE', 'MAX', 'COUNT', 'MIN'],
        answer: 'B',
      },
      {
        q: 'Fungsi COUNT pada Excel berfungsi untuk menghitung?',
        options: ['Jumlah total nilai angka', 'Banyaknya sel yang berisi angka', 'Banyaknya sel kosong', 'Nilai tertinggi', 'Nilai terendah'],
        answer: 'B',
      },
    ],
  },
  {
    name: 'Level 3: Fungsi Logika',
    category: 'Fungsi Logika',
    questions: [
      {
        q: 'Jika nilai di sel A1 adalah 80, hasil dari =IF(A1>=75;"Lulus";"Remedial") adalah?',
        options: ['Remedial', 'Lulus', 'TRUE', '#VALUE!', 'FALSE'],
        answer: 'B',
      },
      {
        q: 'Fungsi logika yang menghasilkan nilai TRUE hanya jika semua kondisinya benar adalah?',
        options: ['=OR()', '=NOT()', '=AND()', '=IF()', '=XOR()'],
        answer: 'C',
      },
      {
        q: 'Manakah penulisan fungsi IF bertingkat yang tepat?',
        options: [
          '=IF(A1>80;"A";IF(A1>70;"B";"C"))',
          '=IF(A1>80;"A";ELSE("B"))',
          '=IF(A1>80="A",A1>70="B")',
          '=IF(A1>80;"A") + IF(A1>70;"B")',
          '=IF(A1>80:"A":IF(A1>70:"B":"C"))',
        ],
        answer: 'A',
      },
    ],
  },
  {
    name: 'Level 4: Referensi & Tabel',
    category: 'Referensi dan Tabel',
    questions: [
      {
        q: 'Tanda $ pada referensi sel $A$1 berfungsi untuk?',
        options: [
          'Mengubah format menjadi mata uang Dolar',
          'Mengunci referensi sel agar tidak berubah saat disalin',
          'Menghapus isi sel secara otomatis',
          'Menandai sel yang error',
          'Menyembunyikan baris dan kolom',
        ],
        answer: 'B',
      },
      {
        q: 'Fitur Excel untuk menampilkan baris data yang memenuhi kriteria tertentu saja disebut?',
        options: ['Sort', 'Filter', 'Merge & Center', 'Wrap Text', 'Freeze Panes'],
        answer: 'B',
      },
      {
        q: 'Jika ingin mencari data pada tabel yang tersusun secara horizontal, gunakan rumus?',
        options: ['=VLOOKUP', '=HLOOKUP', '=INDEX', '=CONCATENATE', '=COUNTIF'],
        answer: 'B',
      },
    ],
  },
  {
    name: 'Level 5: Studi Kasus',
    category: 'Studi Kasus',
    questions: [
      {
        q: 'Untuk menghitung jumlah siswa yang mendapat nilai di atas 80 pada range D2:D30, gunakan rumus?',
        options: [
          '=COUNT(D2:D30; ">80")',
          '=COUNTIF(D2:D30; ">80")',
          '=SUMIF(D2:D30; ">80")',
          '=AVERAGEIF(D2:D30; ">80")',
          '=MAX(D2:D30; ">80")',
        ],
        answer: 'B',
      },
      {
        q: 'Pesan error #DIV/0! pada Excel muncul karena?',
        options: [
          'Nama rumus salah ketik',
          'Kolom terlalu sempit',
          'Ada pembagian angka dengan nilai nol atau sel kosong',
          'Referensi sel telah dihapus',
          'Format tanggal tidak sesuai',
        ],
        answer: 'C',
      },
      {
        q: 'Rumus untuk menjumlahkan total penjualan pada kolom C hanya untuk kategori "Buku" di kolom B adalah?',
        options: [
          '=SUMIF(B2:B20; "Buku"; C2:C20)',
          '=COUNTIF(B2:B20; "Buku"; C2:C20)',
          '=VLOOKUP("Buku"; B2:C20; 2)',
          '=SUM(B2:B20="Buku"; C2:C20)',
          '=AVERAGEIF(B2:B20; "Buku"; C2:C20)',
        ],
        answer: 'A',
      },
    ],
  },
];

async function main() {
  const adminId = generateId('usr');
  const teacherId = generateId('usr');
  const studentId = generateId('usr');

  await db
    .insert(schema.users)
    .values([
      {
        id: adminId,
        email: 'masbimmm@sekolah.sch.id',
        username: 'masbimmm',
        fullName: 'Administrator masbimmm',
        passwordHash: hashPassword('password123'),
        role: 'admin',
      },
      {
        id: teacherId,
        email: 'guru@sekolah.sch.id',
        username: 'guru_excel',
        fullName: 'Pak Guru Excel',
        passwordHash: hashPassword('password123'),
        role: 'teacher',
      },
      {
        id: studentId,
        email: 'bima@sekolah.sch.id',
        username: 'Bima',
        fullName: 'Bima Pratama',
        passwordHash: hashPassword('password123'),
        role: 'student',
        avatar: 'cat-blue',
        totalPoints: 250,
      },
    ])
    .onConflictDoNothing();

  await db
    .update(schema.users)
    .set({ role: 'admin', updatedAt: new Date() })
    .where(eq(schema.users.username, 'masbimmm'));

  const classroomId = generateId('cls');
  await db
    .insert(schema.classrooms)
    .values({
      id: classroomId,
      teacherId,
      name: 'X TKJ 1',
      subject: 'Microsoft Excel',
      grade: 'Kelas X',
      description: 'Kelas praktik Excel SMK',
      joinCode: 'XTKJ01',
    })
    .onConflictDoNothing();

  await db
    .insert(schema.classroomMembers)
    .values({ id: generateId('cmb'), classroomId, studentId })
    .onConflictDoNothing();

  for (const [i, lvl] of levelsData.entries()) {
    const levelId = generateId('lvl');
    await db.insert(schema.levels).values({
      id: levelId,
      teacherId,
      name: lvl.name,
      description: `Level ${i + 1} materi ${lvl.category}`,
      difficulty: i < 2 ? 'easy' : i < 4 ? 'medium' : 'hard',
      completionRequirement: 2,
      position: i,
    });

    for (const [j, q] of lvl.questions.entries()) {
      const questionId = generateId('qst');
      await db.insert(schema.questions).values({
        id: questionId,
        creatorId: teacherId,
        type: 'multiple_choice',
        content: q.q,
        correctAnswer: q.answer,
        explanation: '',
        difficulty: i < 2 ? 'easy' : i < 4 ? 'medium' : 'hard',
        category: lvl.category,
        points: 10,
        timeLimit: 30,
      });
      await db.insert(schema.questionOptions).values(
        q.options.map((content, k) => ({
          id: generateId('opt'),
          questionId,
          label: ['A', 'B', 'C', 'D', 'E'][k] as 'A' | 'B' | 'C' | 'D' | 'E',
          content,
          position: k,
        })),
      );
      await db.insert(schema.levelQuestions).values({
        id: generateId('lq'),
        levelId,
        questionId,
        position: j,
      });
    }
  }

  const check = await db.select().from(schema.levels).where(eq(schema.levels.teacherId, teacherId));
  console.log(`Seed selesai: ${check.length} levels, 2 users (guru@sekolah.sch.id / bima@sekolah.sch.id), password: password123`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
