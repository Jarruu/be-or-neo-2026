import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/common/services/prisma.service';
import { CloudinaryStorageService } from '@/common/services/storage/cloudinary-storage.service';
import { UserRole } from '../prisma/generated-client/client';
import { JwtService } from '@nestjs/jwt';

describe('LearningModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;
  let subDivisionId: string;

  const mockStorage = {
    uploadFile: jest.fn().mockResolvedValue('http://cloudinary.com/module.pdf'),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CloudinaryStorageService)
      .useValue(mockStorage)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Setup Test Data
    const admin = await prisma.user.create({
      data: {
        email: 'lm-admin@example.com',
        passwordHash: 'hashed',
        role: UserRole.ADMIN,
      },
    });
    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });

    const user = await prisma.user.create({
      data: {
        email: 'lm-user@example.com',
        passwordHash: 'hashed',
        role: UserRole.USER,
      },
    });
    userToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });

    const dept = await prisma.department.create({ data: { name: 'LM Dept' } });
    const div = await prisma.division.create({ data: { name: 'LM Div', departmentId: dept.id } });
    const subDiv = await prisma.subDivision.create({ data: { name: 'LM SubDiv', divisionId: div.id } });
    subDivisionId = subDiv.id;

    // Associate user with subdivision
    await prisma.profile.create({
        data: {
            userId: user.id,
            fullName: 'LM User',
            nim: 'NIM-LM',
            subDivisionId: subDivisionId,
        }
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.department.deleteMany();
    await app.close();
  });

  describe('/learning-modules (POST)', () => {
    it('Admin can upload learning module', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/learning-modules')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Web Basics')
        .field('description', 'Intro to Web')
        .field('subDivisionId', subDivisionId)
        .attach('file', Buffer.from('pdf content'), 'basics.pdf')
        .expect(201);

      expect(response.body.title).toBe('Web Basics');
      expect(response.body.fileUrl).toBe('http://cloudinary.com/module.pdf');
    });
  });

  describe('/api/learning-modules (GET)', () => {
    it('Admin can get all modules', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/learning-modules')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].title).toBe('Web Basics');
    });
  });
});
