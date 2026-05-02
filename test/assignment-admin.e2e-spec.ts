import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/common/services/prisma.service';
import { CloudinaryStorageService } from '@/common/services/storage/cloudinary-storage.service';
import { UserRole } from '../prisma/generated-client/client';
import { JwtService } from '@nestjs/jwt';

describe('AssignmentAdmin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;
  let subDivisionId: string;
  let adminUserId: string;

  const mockStorage = {
    uploadFile: jest.fn().mockResolvedValue('http://cloudinary.com/task.pdf'),
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
        email: 'admin-test@example.com',
        passwordHash: 'hashed',
        role: UserRole.ADMIN,
      },
    });
    adminUserId = admin.id;
    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });

    const user = await prisma.user.create({
      data: {
        email: 'user-test@example.com',
        passwordHash: 'hashed',
        role: UserRole.USER,
      },
    });
    userToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });

    const dept = await prisma.department.create({ data: { name: 'Test Dept' } });
    const div = await prisma.division.create({ data: { name: 'Test Div', departmentId: dept.id } });
    const subDiv = await prisma.subDivision.create({ data: { name: 'Test SubDiv', divisionId: div.id } });
    subDivisionId = subDiv.id;
  });

  afterAll(async () => {
    await prisma.assignment.deleteMany();
    await prisma.user.deleteMany();
    await prisma.subDivision.deleteMany();
    await prisma.division.deleteMany();
    await prisma.department.deleteMany();
    await app.close();
  });

  describe('/assignments (POST)', () => {
    it('should create an assignment with file upload (Admin)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'E2E Task')
        .field('description', 'Task description')
        .field('dueAt', new Date().toISOString())
        .field('subDivisionId', subDivisionId)
        .attach('file', Buffer.from('dummy file content'), 'test.pdf');

      expect(response.status).toBe(201);
      expect(response.body.fileUrl).toBe('http://cloudinary.com/task.pdf');
      expect(mockStorage.uploadFile).toHaveBeenCalled();
    });

    it('should throw 403 when user tries to create an assignment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/assignments')
        .set('Authorization', `Bearer ${userToken}`)
        .field('title', 'Forbidden Task')
        .field('dueAt', new Date().toISOString())
        .field('subDivisionId', subDivisionId);

      expect(response.status).toBe(403);
    });
  });

  describe('/api/assignments/:id (PATCH)', () => {
    let assignmentId: string;

    beforeEach(async () => {
      const asg = await prisma.assignment.create({
        data: {
          title: 'Initial Title',
          dueAt: new Date(),
          subDivisionId,
          createdByAdminId: adminUserId,
        },
      });
      assignmentId = asg.id;
    });

    it('should update assignment and upload new file (Admin)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Updated Title')
        .attach('file', Buffer.from('updated file content'), 'updated.pdf');

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.fileUrl).toBe('http://cloudinary.com/task.pdf');
    });
  });
});
