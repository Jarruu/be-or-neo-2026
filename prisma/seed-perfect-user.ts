import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { Pool } from 'pg';
import {
  PrismaClient,
  UserRole,
  VerificationStatus,
  PaymentStatus,
  AttemptStatus,
  Fakultas,
} from './generated-client/client';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  const perfectUsers = [
    {
      email: 'perfectuser@gmail.com',
      fullName: 'User Perfect Seeder 1',
      nim: '2211522001',
      whatsappNumber: '0895600077007',
    },
    {
      email: 'perfectuser2@gmail.com',
      fullName: 'User Perfect Seeder 2',
      nim: '2211522002',
      whatsappNumber: '083193872341',
    },
    {
      email: 'perfectuser3@gmail.com',
      fullName: 'User Perfect Seeder 3',
      nim: '2211522003',
      whatsappNumber: '085316164198',
    },
  ];

  console.log('Starting perfect users seeding...');

  // 1. Pastikan ada SubDivision dan Exam untuk ditautkan
  let subDivision = await prisma.subDivision.findFirst({
    where: { name: 'Web Programming' },
  });

  if (!subDivision) {
    subDivision = await prisma.subDivision.findFirst();
  }

  if (!subDivision) {
    console.error(
      'Error: Tidak ada data SubDivision di database. Jalankan npx prisma db seed terlebih dahulu.',
    );
    return;
  }

  const exam = await prisma.exam.findFirst({
    where: { subDivisionId: subDivision.id },
  });

  if (!exam) {
    console.error('Error: Tidak ada data Exam untuk SubDivision ini.');
    return;
  }

  for (const userData of perfectUsers) {
    console.log(`Creating perfect user: ${userData.email}...`);

    // 2. Hapus data lama jika email yang sama sudah ada (untuk re-runnable)
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });
    if (existingUser) {
      await prisma.user.delete({ where: { id: existingUser.id } });
      console.log(`Deleted existing user: ${userData.email}`);
    }

    // 3. Create User & Profile
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        role: UserRole.USER,
        profile: {
          create: {
            fullName: userData.fullName,
            nickName: userData.fullName.split(' ')[2], // Ambil kata ketiga sebagai nickname (Seeder)
            nim: userData.nim,
            whatsappNumber: userData.whatsappNumber,
            subDivisionId: subDivision.id,
            divisionId: subDivision.divisionId,
            fakultas: Fakultas.TEKNOLOGI_INFORMASI,
          },
        },
      },
    });

    // 4. Submission Verification (APPROVED)
    await prisma.submissionVerification.create({
      data: {
        userId: user.id,
        status: VerificationStatus.APPROVED,
        krsScanUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
        formalPhotoUrl:
          'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
        reviewedAt: new Date(),
      },
    });

    // 5. Payment (APPROVED)
    await prisma.payment.create({
      data: {
        userId: user.id,
        amount: 50000,
        proofUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
        status: PaymentStatus.APPROVED,
        reviewedAt: new Date(),
      },
    });

    // 6. Exam Attempt (SUBMITTED)
    await prisma.examAttempt.create({
      data: {
        userId: user.id,
        examId: exam.id,
        status: AttemptStatus.SUBMITTED,
        score: 100,
        correctCount: 5,
        wrongCount: 0,
        totalQuestions: 5,
        startedAt: new Date(Date.now() - 30 * 60000), // 30 menit lalu
        finishedAt: new Date(),
      },
    });
  }

  console.log('-----------------------------------');
  console.log('Seeder Akun Sempurna Berhasil!');
  console.log(`Total: ${perfectUsers.length} akun ditambahkan.`);
  console.log('Status: Profil OK, Verifikasi OK, Bayar OK, Ujian OK');
  console.log('-----------------------------------');
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
