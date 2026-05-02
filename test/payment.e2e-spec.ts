/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/services/prisma.service';
import { VerificationStatus, PaymentStatus, UserRole } from '../prisma/generated-client/client';

jest.setTimeout(120000);

describe('Payment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let userId: string;
  const userEmail = `user-pay-${Date.now()}@test.com`;
  const adminEmail = `admin-pay-${Date.now()}@test.com`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('CloudinaryStorageService')
      .useValue({ uploadFile: jest.fn().mockResolvedValue('http://mock.url/proof.jpg') })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create and Login User
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: userEmail,
        password,
        fullName: 'Pay User',
        nim: `NIM-PAY-${Date.now()}`,
      });

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) throw new Error('User not created');
    userId = user.id;

    const userLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userEmail, password });
    userToken = userLogin.body.access_token as string;

    // Create and Login Admin
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password,
        fullName: 'Admin Pay',
        nim: `NIM-ADM-${Date.now()}`,
      });
    await prisma.user.update({ where: { email: adminEmail }, data: { role: UserRole.ADMIN } });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password });
    adminToken = adminLogin.body.access_token as string;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.submissionVerification.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email: { in: [userEmail, adminEmail] } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('Payment Controller', () => {
    it('/api/payments/upload-proof (POST) - Fail if not approved', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/upload-proof')
        .set('Authorization', `Bearer ${userToken}`)
        .field('amount', '50000')
        .attach('file', Buffer.from('test'), 'proof.jpg')
        .expect(400);
    });

    it('/api/payments/upload-proof (POST) - Success after approval', async () => {
      // Approve user verification
      await prisma.submissionVerification.create({
        data: {
          userId,
          status: VerificationStatus.APPROVED,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/payments/upload-proof')
        .set('Authorization', `Bearer ${userToken}`)
        .field('amount', '50000')
        .attach('file', Buffer.from('test'), 'proof.jpg')
        .expect(201);

      expect(response.body.status).toBe(PaymentStatus.PENDING);
      expect(response.body.amount).toBe("50000");
    });

    it('/api/payments/my-payment (GET) - Success', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/payments/my-payment')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      
      expect(response.body.status).toBe(PaymentStatus.PENDING);
    });

    it('/api/payments/:id/review (PATCH) - Admin Success', async () => {
      const payment = await prisma.payment.findFirst({ where: { userId } });
      if (!payment) throw new Error('Payment not found');

      const response = await request(app.getHttpServer())
        .patch(`/api/payments/${payment.id}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: PaymentStatus.APPROVED })
        .expect(200);

      expect(response.body.status).toBe(PaymentStatus.APPROVED);
    });
  });
});
