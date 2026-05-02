/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/services/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import {
  UserRole,
  VerificationStatus,
} from '../prisma/generated-client/client';

describe('Verification Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let submissionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup: Create Admin and User
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: 'user@test.com',
        passwordHash: await bcrypt.hash('password', 10),
        role: UserRole.USER,
      },
    });

    await prisma.user.create({
      data: {
        email: 'admin@test.com',
        passwordHash: await bcrypt.hash('password', 10),
        role: UserRole.ADMIN,
      },
    });

    // Login to get tokens
    const authService = app.get<AuthService>(AuthService);
    const adminAuth = await authService.login({
      email: 'admin@test.com',
      password: 'password',
    });
    adminToken = adminAuth.access_token;

    const userAuth = await authService.login({
      email: 'user@test.com',
      password: 'password',
    });
    userToken = userAuth.access_token;

    // Create a dummy submission
    const submission = await prisma.submissionVerification.create({
      data: {
        userId: user.id,
        status: VerificationStatus.PENDING,
        twibbonLink: 'https://twibbon.com',
      },
    });
    submissionId = submission.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /verification/admin/list (Admin) - should list all submissions', () => {
    return request(app.getHttpServer())
      .get('/verification/admin/list')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        const found = res.body.find((s: any) => s.id === submissionId);
        expect(found).toBeDefined();
      });
  });

  it('GET /verification/admin/list (User) - should be forbidden', () => {
    return request(app.getHttpServer())
      .get('/verification/admin/list')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('PATCH /verification/admin/review/:id (Admin) - should approve submission', () => {
    return request(app.getHttpServer())
      .patch(`/verification/admin/review/${submissionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: VerificationStatus.APPROVED })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe(VerificationStatus.APPROVED);
      });
  });

  it('PATCH /verification/admin/review/:id (Admin) - should reject with reason', async () => {
    // Reset status to pending first
    await prisma.submissionVerification.update({
      where: { id: submissionId },
      data: { status: VerificationStatus.PENDING },
    });

    return request(app.getHttpServer())
      .patch(`/verification/admin/review/${submissionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: VerificationStatus.REJECTED,
        rejectionReason: 'Invalid document',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe(VerificationStatus.REJECTED);

        expect(res.body.rejectionReason).toBe('Invalid document');
      });
  });
});
