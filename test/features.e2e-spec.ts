/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/services/prisma.service';
import * as path from 'path';
import { Fakultas } from '../prisma/generated-client/client';

describe('Features (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testNim = `NIM${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('IStorageService')
      .useValue({
        uploadFile: jest
          .fn()
          .mockResolvedValue(
            'https://res.cloudinary.com/demo/image/upload/v1234567890/mock-image.jpg',
          ),
        deleteFile: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Cleanup test data
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.programStudi.deleteMany();
    await app.close();
  });

  describe('Auth Module', () => {
    it('/api/auth/register (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          fullName: 'Test User',
          nim: testNim,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(testEmail);
    });

    it('/api/auth/login (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      accessToken = response.body.access_token;
    });

    it('/api/auth/me (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe(testEmail);
    });
  });

  describe('Profile Module', () => {
    it('/api/profile/me (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.fullName).toBe('Test User');
      expect(response.body.nim).toBe(testNim);
    });

    it('/api/profile/me (PATCH)', async () => {
      const studyProgram = await prisma.programStudi.create({
        data: {
          fakultas: Fakultas.TEKNOLOGI_INFORMASI,
          name: 'Sistem Informasi',
        },
      });

      const response = await request(app.getHttpServer())
        .patch('/api/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          nickName: 'Tester',
          whatsappNumber: '08123456789',
          fakultas: Fakultas.TEKNOLOGI_INFORMASI,
          studyProgramId: studyProgram.id,
        })
        .expect(200);

      expect(response.body.nickName).toBe('Tester');
      expect(response.body.fakultas).toBe(Fakultas.TEKNOLOGI_INFORMASI);
      expect(response.body.studyProgramId).toBe(studyProgram.id);
    });

    it('/api/profile/me (PATCH) rejects mismatched faculty and study program', async () => {
      const studyProgram = await prisma.programStudi.create({
        data: {
          fakultas: Fakultas.MIPA,
          name: 'Biologi',
        },
      });

      await request(app.getHttpServer())
        .patch('/api/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          fakultas: Fakultas.TEKNIK,
          studyProgramId: studyProgram.id,
        })
        .expect(400);
    });

    it('/api/profile/me/avatar (POST)', async () => {
      const filePath = path.join(__dirname, 'fixtures', 'dummy.txt');
      const response = await request(app.getHttpServer())
        .post('/api/profile/me/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', filePath)
        .expect(201);

      expect(response.body).toHaveProperty('avatarUrl');
      expect(response.body.avatarUrl).toContain('cloudinary');
    });

    it('/api/profile/departments (GET)', async () => {
      await request(app.getHttpServer())
        .get('/api/profile/departments')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('/api/master-data/program-studi (GET)', async () => {
      await prisma.programStudi.create({
        data: {
          fakultas: Fakultas.TEKNOLOGI_INFORMASI,
          name: 'Teknik Komputer',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/master-data/program-studi')
        .query({ fakultas: Fakultas.TEKNOLOGI_INFORMASI })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(
        response.body.every(
          (item: any) => item.fakultas === Fakultas.TEKNOLOGI_INFORMASI,
        ),
      ).toBe(true);
    });
  });

  describe('Verification Module', () => {
    it('/api/verification/submit (POST)', async () => {
      const filePath = path.join(__dirname, 'fixtures', 'dummy.txt');
      const response = await request(app.getHttpServer())
        .post('/api/verification/submit')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('krsScan', filePath)
        .attach('formalPhoto', filePath)
        .field('twibbonLink', 'https://instagram.com/p/test')
        .expect(201);

      expect(response.body.status).toBe('PENDING');
      expect(response.body.twibbonLink).toBe('https://instagram.com/p/test');
    });

    it('/api/verification/me (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/verification/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('PENDING');
    });
  });
});
