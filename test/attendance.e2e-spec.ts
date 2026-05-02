/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/services/prisma.service';
import { UserRole, VerificationStatus, AttendanceStatus } from '../prisma/generated-client/client';

jest.setTimeout(60000);

describe('Attendance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let activityId: string;
  const userEmail = `user-att-${Date.now()}@test.com`;
  const adminEmail = `admin-att-${Date.now()}@test.com`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
        fullName: 'Att User',
        nim: `NIM-ATT-${Date.now()}`,
      });
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) throw new Error('User not created');
    userId = user.id;

    // Approve user to be eligible for attendance
    await prisma.submissionVerification.create({
      data: { userId: user.id, status: VerificationStatus.APPROVED },
    });

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
        fullName: 'Admin Att',
        nim: `NIM-ADM-${Date.now()}`,
      });
    await prisma.user.update({ where: { email: adminEmail }, data: { role: UserRole.ADMIN } });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password });
    adminToken = adminLogin.body.access_token as string;
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany({ where: { userId } });
    await prisma.activity.deleteMany({ where: { id: activityId } });
    await prisma.submissionVerification.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email: { in: [userEmail, adminEmail] } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('Attendance Controller', () => {
    it('/api/attendances/activities (POST) - Admin: Create Activity', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/attendances/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Activity',
          deadline: new Date(Date.now() + 3600000).toISOString(),
        })
        .expect(201);
      
      activityId = response.body.id;
      expect(response.body.name).toBe('E2E Activity');
    });

    it('/api/attendances/scan (POST) - Admin: Scan User', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/attendances/scan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: userId,
          activityId: activityId,
        })
        .expect(201);
      
      expect(response.body.status).toBe(AttendanceStatus.PRESENT);
    });

    it('/api/attendances/me (GET) - User: Get My Attendance', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/attendances/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].status).toBe(AttendanceStatus.PRESENT);
    });

    it('/api/attendances/activities/:id (GET) - Admin: Get Activity Details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/attendances/activities/${activityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.attendances.length).toBeGreaterThan(0);
    });
  });
});
