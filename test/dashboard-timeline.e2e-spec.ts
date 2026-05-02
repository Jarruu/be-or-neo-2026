/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/services/prisma.service';

describe('Dashboard & Timeline (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  const userEmail = `user-${Date.now()}@example.com`;
  const adminEmail = `admin-${Date.now()}@example.com`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('IStorageService')
      .useValue({ uploadFile: jest.fn().mockResolvedValue('http://mock.url') })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create User
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: userEmail,
        password,
        fullName: 'Regular User',
        nim: `NIM-${Date.now()}-U`,
      });
    const userLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: userEmail,
        password,
      });
    userToken = userLogin.body.access_token;

    // Create Admin
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password,
        fullName: 'Admin User',
        nim: `NIM-${Date.now()}-A`,
      });
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password,
      });
    adminToken = adminLogin.body.access_token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [userEmail, adminEmail] } },
    });
    await app.close();
  });

  describe('Dashboard Module', () => {
    it('/api/dashboard/me (GET) - should return dashboard structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('progress');
      expect(response.body).toHaveProperty('steps');
      expect(response.body).toHaveProperty('timeline');
      expect(response.body.user.fullName).toBe('Regular User');
    });
  });

  describe('Timeline Module', () => {
    let timelineId: string;

    it('/api/timelines (POST) - Forbidden for regular user', async () => {
      await request(app.getHttpServer())
        .post('/api/timelines')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Forbidden Event',
          startAt: new Date().toISOString(),
          endAt: new Date().toISOString(),
          orderIndex: 1,
        })
        .expect(403);
    });

    it('/api/timelines (POST) - Allowed for admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/timelines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Event',
          startAt: new Date().toISOString(),
          endAt: new Date().toISOString(),
          orderIndex: 1,
        })
        .expect(201);

      expect(response.body.title).toBe('Admin Event');
      timelineId = response.body.id;
    });

    it('/api/timelines (GET) - Public access', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/timelines')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('/api/timelines/:id (PATCH) - Update by admin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/timelines/${timelineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(response.body.title).toBe('Updated Title');
    });

    it('/api/timelines/:id (DELETE) - Remove by admin', async () => {
      await request(app.getHttpServer())
        .delete(`/api/timelines/${timelineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/timelines/${timelineId}`)
        .expect(404);
    });
  });
});
