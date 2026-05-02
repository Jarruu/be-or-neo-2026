import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/services/prisma.service';
import { CloudinaryStorageService } from '../src/common/services/storage/cloudinary-storage.service';
import { UserRole, AttemptStatus, PaymentStatus } from '../prisma/generated-client/client';
import { JwtService } from '@nestjs/jwt';

jest.setTimeout(60000);

describe('UserFlow: Exam & Assignment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let subDivisionId: string;
  let examId: string;
  let assignmentId: string;
  const userEmail = `flow-user-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CloudinaryStorageService)
      .useValue({ uploadFile: jest.fn().mockResolvedValue('http://mock.url/file') })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    const jwtService = app.get<JwtService>(JwtService);

    // Setup Test Data
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        passwordHash: 'hashed',
        role: UserRole.USER,
      },
    });
    userToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });

    const dept = await prisma.department.create({ data: { name: `Flow Dept ${Date.now()}` } });
    const div = await prisma.division.create({ data: { name: `Flow Div ${Date.now()}`, departmentId: dept.id } });
    const subDiv = await prisma.subDivision.create({ data: { name: `Flow SubDiv ${Date.now()}`, divisionId: div.id } });
    subDivisionId = subDiv.id;

    await prisma.profile.create({
      data: { userId: user.id, fullName: 'Flow User', nim: `FLOW-${Date.now()}`, subDivisionId },
    });

    // Add APPROVED payment to allow starting exam
    await prisma.payment.create({
      data: {
        userId: user.id,
        amount: 50000,
        status: PaymentStatus.APPROVED,
        proofUrl: 'http://mock.url/proof.jpg',
        reviewedAt: new Date(),
      },
    });

    const exam = await prisma.exam.create({
      data: { title: 'Flow Exam', subDivisionId, durationMinutes: 30 },
    });
    examId = exam.id;

    const admin = await prisma.user.create({ data: { email: `admin-flow-${Date.now()}@ex.com`, passwordHash: 'h', role: UserRole.ADMIN } });
    const asg = await prisma.assignment.create({
        data: { title: 'Flow Assignment', subDivisionId, dueAt: new Date(), createdByAdminId: admin.id }
    });
    assignmentId = asg.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'flow' } } });
    await app.close();
  });

  it('1. User starts exam attempt', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/exams/user/${examId}/start`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201);
    
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('2. User submits exam', async () => {
    const attempt = await prisma.examAttempt.findFirst({ where: { examId } });
    await request(app.getHttpServer())
      .post(`/api/exams/user/attempts/${attempt!.id}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ answers: [] })
      .expect(201);

    const updated = await prisma.examAttempt.findUnique({ where: { id: attempt!.id } });
    expect(updated!.status).toBe(AttemptStatus.SUBMITTED);
  });

  it('3. User submits assignment', async () => {
    await request(app.getHttpServer())
      .post(`/api/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', Buffer.from('my work'), 'work.zip')
      .expect(201);
  });

  it('4. User submits text-only assignment', async () => {
    await request(app.getHttpServer())
      .post(`/api/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .field('textContent', 'Ini jawaban dalam bentuk teks')
      .expect(201);
  });
});

