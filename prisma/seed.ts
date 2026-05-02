import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import {
  PrismaClient,
  UserRole,
  VerificationStatus,
  PaymentStatus,
  ExamType,
  AttemptStatus,
  AttendanceStatus,
  Fakultas,
} from './generated-client/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Cleaning database...');
  // Delete in order to respect constraints
  await prisma.attendance.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.assignmentSubmission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.learningModule.deleteMany();
  await prisma.examAnswer.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.choice.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.submissionVerification.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.programStudi.deleteMany();
  await prisma.recruitmentTimeline.deleteMany();
  await prisma.subDivision.deleteMany();
  await prisma.division.deleteMany();
  await prisma.department.deleteMany();

  console.log('Start seeding all features...');

  const passwordHash = await bcrypt.hash('password', 10);

  // 1. Departments, Divisions, SubDivisions
  const operasional = await prisma.department.create({
    data: { name: 'Operasional' },
  });
  const organisasi = await prisma.department.create({
    data: { name: 'Organisasi' },
  });

  const programming = await prisma.division.create({
    data: { departmentId: operasional.id, name: 'Programming' },
  });
  const mmd = await prisma.division.create({
    data: { departmentId: operasional.id, name: 'Multimedia dan Desain' },
  });
  const skj = await prisma.division.create({
    data: { departmentId: operasional.id, name: 'Sistem Komputer Jaringan' },
  });

  const webProg = await prisma.subDivision.create({
    data: { divisionId: programming.id, name: 'Web Programming' },
  });
  const mobileProg = await prisma.subDivision.create({
    data: { divisionId: programming.id, name: 'Mobile Programming' },
  });
  const machineLearning = await prisma.subDivision.create({
    data: { divisionId: programming.id, name: 'Machine Learning' },
  });
  const uiux = await prisma.subDivision.create({
    data: { divisionId: mmd.id, name: 'Ui/Ux' },
  });
  const vidEdit = await prisma.subDivision.create({
    data: { divisionId: mmd.id, name: 'Video Editing' },
  });
  const Design = await prisma.subDivision.create({
    data: { divisionId: mmd.id, name: 'Design Grafis' },
  });
  const network = await prisma.subDivision.create({
    data: { divisionId: skj.id, name: 'Network' },
  });
  const system = await prisma.subDivision.create({
    data: { divisionId: skj.id, name: 'System' },
  });

  // 1b. Program Studi
  const programStudiData: Record<Fakultas, string[]> = {
    [Fakultas.PERTANIAN]: [
      'Agroteknologi',
      'Agribisnis',
      'Ilmu Tanah',
      'Proteksi Tanaman',
      'Penyuluhan Pertanian',
      'Agroekoteknologi (Kampus III)',
    ],
    [Fakultas.KEDOKTERAN]: [
      'Kedokteran',
      'Psikologi',
      'Kebidanan',
      'Ilmu Biomedis',
    ],
    [Fakultas.MIPA]: [
      'Kimia',
      'Biologi',
      'Matematika',
      'Fisika',
      'Statistika dan Sains Data',
    ],
    [Fakultas.PETERNAKAN]: [
      'Peternakan',
      'Peternakan (Kampus II)',
      'Nutrisi dan Teknologi Pakan Ternak',
    ],
    [Fakultas.TEKNIK]: [
      'Teknik Sipil',
      'Teknik Mesin',
      'Teknik Industri',
      'Teknik Elektro',
      'Teknik Lingkungan',
      'Arsitektur',
    ],
    [Fakultas.TEKNOLOGI_PERTANIAN]: [
      'Teknologi Pangan dan Hasil Pertanian',
      'Teknik Pertanian dan Biosistem',
      'Teknologi Industri Pertanian',
    ],
    [Fakultas.FARMASI]: ['Farmasi'],
    [Fakultas.TEKNOLOGI_INFORMASI]: [
      'Teknik Komputer',
      'Sistem Informasi',
      'Informatika',
    ],
    [Fakultas.KEPERAWATAN]: ['Keperawatan'],
    [Fakultas.KESEHATAN_MASYARAKAT]: ['Kesehatan Masyarakat', 'Gizi'],
    [Fakultas.KEDOKTERAN_GIGI]: ['Kedokteran Gigi'],
    [Fakultas.HUKUM]: ['Hukum'],
    [Fakultas.EKONOMI_DAN_BISNIS]: [
      'Ekonomi',
      'Manajemen',
      'Akuntansi',
      'Ekonomi Islam',
      'Kewirausahaan',
      'Ekonomi Pembangunan (Kampus II)',
      'Manajemen (Kampus II)',
      'Administrasi Perkantoran (D3)',
      'Akuntansi (D3)',
      'Perbankan dan Keuangan (D3)',
      'Manajemen Pemasaran (D3)',
    ],
    [Fakultas.ILMU_BUDAYA]: [
      'Sejarah',
      'Sastra Indonesia',
      'Sastra Inggris',
      'Sastra Minangkabau',
      'Sastra Jepang',
      'Arkeologi',
    ],
    [Fakultas.ILMU_SOSIAL_DAN_POLITIK]: [
      'Sosiologi',
      'Ilmu Politik',
      'Antropologi Sosial',
      'Hubungan Internasional',
      'Ilmu Komunikasi',
      'Administrasi Publik',
    ],
  };

  const programStudiMap = new Map<string, { id: string; fakultas: Fakultas; name: string }>();

  for (const fakultas of Object.values(Fakultas)) {
    const names = programStudiData[fakultas];
    for (const name of names) {
      const program = await prisma.programStudi.create({
        data: { fakultas, name },
      });
      programStudiMap.set(`${fakultas}:${name}`, program);
    }
  }

  const sistemInformasi = programStudiMap.get(
    `${Fakultas.TEKNOLOGI_INFORMASI}:Sistem Informasi`,
  );

  if (!sistemInformasi) {
    throw new Error('Seed program studi not found');
  }

  // 2. Users (Admin & 3 Regular Users)
  const admin = await prisma.user.create({
    data: {
      email: 'adminneo@gmail.com',
      passwordHash,
      role: UserRole.ADMIN,
      profile: {
        create: {
          fullName: 'Admin Neo Telemetri',
          nim: 'ADMIN001',
          whatsappNumber: '081234567890',
        },
      },
    },
  });

  const userApproved = await prisma.user.create({
    data: {
      email: 'user.approved@gmail.com',
      passwordHash,
      role: UserRole.USER,
      profile: {
        create: {
          fullName: 'User Approved',
          nim: 'USER001',
          whatsappNumber: '081234567891',
          departmentId: operasional.id,
          divisionId: programming.id,
          subDivisionId: webProg.id,
          fakultas: Fakultas.TEKNOLOGI_INFORMASI,
          studyProgramId: sistemInformasi.id,
        },
      },
    },
  });

  const userPending = await prisma.user.create({
    data: {
      email: 'user.pending@gmail.com',
      passwordHash,
      role: UserRole.USER,
      profile: {
        create: {
          fullName: 'User Pending',
          nim: 'USER002',
          whatsappNumber: '081234567892',
        },
      },
    },
  });

  const userRejected = await prisma.user.create({
    data: {
      email: 'user.rejected@gmail.com',
      passwordHash,
      role: UserRole.USER,
      profile: {
        create: {
          fullName: 'User Rejected',
          nim: 'USER003',
          whatsappNumber: '081234567893',
        },
      },
    },
  });

  // 3. Submission Verifications
  await prisma.submissionVerification.create({
    data: {
      userId: userApproved.id,
      status: VerificationStatus.APPROVED,
      krsScanUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
      formalPhotoUrl:
        'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
      reviewedByAdminId: admin.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.submissionVerification.create({
    data: {
      userId: userPending.id,
      status: VerificationStatus.PENDING,
      krsScanUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
    },
  });

  await prisma.submissionVerification.create({
    data: {
      userId: userRejected.id,
      status: VerificationStatus.REJECTED,
      rejectionReason: 'KRS tidak terbaca atau sudah kadaluarsa.',
      reviewedByAdminId: admin.id,
      reviewedAt: new Date(),
    },
  });

  // 4. Payments (Manual Proof)
  await prisma.payment.create({
    data: {
      userId: userApproved.id,
      amount: 50000,
      proofUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
      status: PaymentStatus.APPROVED,
      reviewedByAdminId: admin.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.payment.create({
    data: {
      userId: userPending.id,
      amount: 50000,
      proofUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
      status: PaymentStatus.PENDING,
    },
  });

  // 5. Activities & Attendance
  const activity = await prisma.activity.create({
    data: {
      name: 'Workshop Web Programming',
      deadline: new Date('2026-12-31'),
    },
  });

  await prisma.attendance.createMany({
    data: [
      {
        userId: userApproved.id,
        activityId: activity.id,
        status: AttendanceStatus.PRESENT,
        checkInTime: new Date(),
      },
      {
        userId: userPending.id,
        activityId: activity.id,
        status: AttendanceStatus.ABSENT,
      },
      {
        userId: userRejected.id,
        activityId: activity.id,
        status: AttendanceStatus.SICK,
        notes: 'Demam tinggi',
      },
    ],
  });

  // 6. Exams, Questions, Choices
  const exam = await prisma.exam.create({
    data: {
      subDivisionId: webProg.id,
      title: 'Ujian Dasar Web Programming',
      durationMinutes: 60,
      maxAttempts: 1,
    },
  });

  // Question 1
  const q1 = await prisma.question.create({
    data: {
      examId: exam.id,
      type: ExamType.MCQ,
      prompt: 'Apa kepanjangan dari HTML?',
      orderIndex: 1,
      points: 20,
    },
  });

  await prisma.choice.createMany({
    data: [
      {
        questionId: q1.id,
        label: 'Hyper Text Markup Language',
        isCorrect: true,
        orderIndex: 1,
      },
      {
        questionId: q1.id,
        label: 'High Tech Modern Language',
        isCorrect: false,
        orderIndex: 2,
      },
      {
        questionId: q1.id,
        label: 'Hyper Transfer Markup Language',
        isCorrect: false,
        orderIndex: 3,
      },
      {
        questionId: q1.id,
        label: 'Home Tool Markup Language',
        isCorrect: false,
        orderIndex: 4,
      },
    ],
  });

  // Question 2
  const q2 = await prisma.question.create({
    data: {
      examId: exam.id,
      type: ExamType.MCQ,
      prompt: 'Tag HTML mana yang digunakan untuk membuat baris baru?',
      orderIndex: 2,
      points: 20,
    },
  });

  await prisma.choice.createMany({
    data: [
      { questionId: q2.id, label: '<br>', isCorrect: true, orderIndex: 1 },
      { questionId: q2.id, label: '<lb>', isCorrect: false, orderIndex: 2 },
      { questionId: q2.id, label: '<break>', isCorrect: false, orderIndex: 3 },
      {
        questionId: q2.id,
        label: '<newline>',
        isCorrect: false,
        orderIndex: 4,
      },
    ],
  });

  // Question 3
  const q3 = await prisma.question.create({
    data: {
      examId: exam.id,
      type: ExamType.MCQ,
      prompt: 'Properti CSS mana yang digunakan untuk mengubah warna teks?',
      orderIndex: 3,
      points: 20,
    },
  });

  await prisma.choice.createMany({
    data: [
      { questionId: q3.id, label: 'color', isCorrect: true, orderIndex: 1 },
      {
        questionId: q3.id,
        label: 'text-color',
        isCorrect: false,
        orderIndex: 2,
      },
      {
        questionId: q3.id,
        label: 'font-color',
        isCorrect: false,
        orderIndex: 3,
      },
      { questionId: q3.id, label: 'fgcolor', isCorrect: false, orderIndex: 4 },
    ],
  });

  // 7. Learning Modules
  await prisma.learningModule.create({
    data: {
      subDivisionId: webProg.id,
      title: 'Modul 1: Dasar HTML & CSS',
      description: 'Mempelajari struktur dasar halaman web.',
      fileUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.pdf',
      createdByAdminId: admin.id,
    },
  });

  // 8. Assignments & Submissions
  const assignment = await prisma.assignment.create({
    data: {
      subDivisionId: webProg.id,
      title: 'Tugas Membuat Landing Page',
      description: 'Buatlah landing page sederhana menggunakan HTML & CSS.',
      dueAt: new Date('2026-12-31'),
      createdByAdminId: admin.id,
    },
  });

  await prisma.assignmentSubmission.create({
    data: {
      assignmentId: assignment.id,
      userId: userApproved.id,
      fileUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.zip',
      score: 95,
      feedback: 'Bagus sekali, layout rapi.',
    },
  });

  console.log('Seeding finished successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
