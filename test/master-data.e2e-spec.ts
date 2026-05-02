import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/common/services/prisma.service';
import { UserRole } from '../prisma/generated-client/client';
import { JwtService } from '@nestjs/jwt';
import { Fakultas } from '../prisma/generated-client/client';

describe('MasterData (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    const jwtService = app.get<JwtService>(JwtService);

    const admin = await prisma.user.create({
      data: {
        email: 'master-admin@example.com',
        passwordHash: 'hashed',
        role: UserRole.ADMIN,
      },
    });
    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });
  });

  afterAll(async () => {
    await prisma.programStudi.deleteMany();
    await prisma.user.deleteMany();
    await prisma.department.deleteMany();
    await app.close();
  });

  describe('Departments', () => {
    let deptId: string;

    it('POST /api/master-data/departments', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/master-data/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Teknik Komputer' })
        .expect(201);
      
      deptId = res.body.id;
      expect(res.body.name).toBe('Teknik Komputer');
    });

    it('GET /api/profile/departments', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/profile/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('Divisions', () => {
    let deptId: string;
    let divId: string;

    beforeAll(async () => {
      const dept = await prisma.department.findFirst();
      deptId = dept!.id;
    });

    it('POST /api/master-data/divisions', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/master-data/divisions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Software', departmentId: deptId })
        .expect(201);
      
      divId = res.body.id;
      expect(res.body.name).toBe('Software');
    });
  });

  describe('SubDivisions', () => {
    let divId: string;

    beforeAll(async () => {
      const div = await prisma.division.findFirst();
      divId = div!.id;
    });

    it('POST /api/master-data/sub-divisions', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/master-data/sub-divisions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Web Development', divisionId: divId })
        .expect(201);
      
      expect(res.body.name).toBe('Web Development');
    });
  });

  describe('Program Studi', () => {
    beforeAll(async () => {
      await prisma.programStudi.create({
        data: {
          fakultas: Fakultas.TEKNOLOGI_INFORMASI,
          name: 'Sistem Informasi',
        },
      });
      await prisma.programStudi.create({
        data: {
          fakultas: Fakultas.TEKNIK,
          name: 'Teknik Sipil',
        },
      });
    });

    it('GET /api/master-data/program-studi', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/master-data/program-studi')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/master-data/program-studi?fakultas=TEKNOLOGI_INFORMASI', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/master-data/program-studi')
        .query({ fakultas: Fakultas.TEKNOLOGI_INFORMASI })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.every((item: any) => item.fakultas === Fakultas.TEKNOLOGI_INFORMASI),
      ).toBe(true);
    });
  });
});
