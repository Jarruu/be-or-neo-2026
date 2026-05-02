/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/services/prisma.service';
import { UserRole, ExamType } from '../prisma/generated-client/client';
import * as bcrypt from 'bcrypt';

describe('Exam Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let subDivisionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup Admin
    const adminEmail = `admin_exam_${Date.now()}@test.com`;
    const passwordHash = await bcrypt.hash('password', 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: 'password' });
    adminToken = loginRes.body.access_token;

    // Setup SubDivision
    const dept = await prisma.department.create({
      data: { name: `Dept ${Date.now()}` },
    });
    const div = await prisma.division.create({
      data: { departmentId: dept.id, name: `Div ${Date.now()}` },
    });
    const subDiv = await prisma.subDivision.create({
      data: { divisionId: div.id, name: `SubDiv ${Date.now()}` },
    });
    subDivisionId = subDiv.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.department.deleteMany();
    await app.close();
  });

  it('Admin: should create an exam with questions', async () => {
    const res = await request(app.getHttpServer())
      .post('/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subDivisionId,
        title: 'Web Programming Entry Test',
        description: 'Test your basic JS knowledge',
        durationMinutes: 30,
        questions: [
          {
            type: ExamType.MCQ,
            prompt: 'What is 1+1?',
            points: 10,
            orderIndex: 1,
            choices: [
              { label: '1', isCorrect: false, orderIndex: 1 },
              { label: '2', isCorrect: true, orderIndex: 2 },
            ],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Web Programming Entry Test');
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.questions[0].choices).toHaveLength(2);
  });

  it('Admin: should get all exams', async () => {
    const res = await request(app.getHttpServer())
      .get('/exams')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
