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
  const email = 'perfectuser@gmail.com';
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log(`Creating perfect user: ${email}...`);

  // 1. Pastikan ada SubDivision dan Exam untuk ditautkan
  let subDivision = await prisma.subDivision.findFirst({
    where: { name: 'Web Programming' },
  });

  if (!subDivision) {
    // Jika belum ada data sama sekali, ambil sub-division pertama yang tersedia
    subDivision = await prisma.subDivision.findFirst();
  }

  if (!subDivision) {
    console.error('Error: Tidak ada data SubDivision di database. Jalankan npx prisma db seed terlebih dahulu.');
    return;
  }

  const exam = await prisma.exam.findFirst({
    where: { subDivisionId: subDivision.id },
  });

  if (!exam) {
    console.error('Error: Tidak ada data Exam untuk SubDivision ini.');
    return;
  }

  // 2. Hapus data lama jika email yang sama sudah ada (untuk re-runnable)
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    await prisma.user.delete({ where: { id: existingUser.id } });
    console.log('Deleted existing user with same email.');
  }

  // 3. Create User & Profile
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.USER,
      profile: {
        create: {
          fullName: 'User Perfect Seeder',
          nim: '2211522000',
          whatsappNumber: '081234567890',
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
      formalPhotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
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

  console.log('-----------------------------------');
  console.log('Seeder Akun Sempurna Berhasil!');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
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
