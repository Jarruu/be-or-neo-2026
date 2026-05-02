import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentService } from './assignment.service';
import { PrismaService } from '../../common/services/prisma.service';
import { CloudinaryStorageService } from '../../common/services/storage/cloudinary-storage.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AttemptStatus,
  UserRole,
} from '../../../prisma/generated-client/client';

describe('AssignmentService', () => {
  let service: AssignmentService;
  let prisma: PrismaService;
  let storage: CloudinaryStorageService;

  const mockPrismaService = {
    user: { findUnique: jest.fn() },
    assignment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    profile: { findUnique: jest.fn() },
    examAttempt: { findFirst: jest.fn() },
    assignmentSubmission: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockStorage = {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CloudinaryStorageService,
          useValue: mockStorage,
        },
      ],
    }).compile();

    service = module.get<AssignmentService>(AssignmentService);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get<CloudinaryStorageService>(CloudinaryStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      title: 'JS Task',
      description: 'JS Description',
      dueAt: new Date().toISOString(),
      subDivisionId: 'sub-1',
    };
    const adminId = 'admin-1';

    it('should create an assignment without file', async () => {
      mockPrismaService.assignment.create.mockResolvedValue({
        id: 'asg-1',
        ...dto,
        fileUrl: null,
        createdByAdminId: adminId,
      });

      const result = await service.create(dto, adminId);
      expect(result.id).toBe('asg-1');
      expect(result.fileUrl).toBeNull();
      expect(prisma.assignment.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          description: dto.description,
          subDivisionId: dto.subDivisionId,
          fileUrl: null,
          dueAt: new Date(dto.dueAt),
          createdByAdminId: adminId,
        },
      });
      expect(storage.uploadFile).not.toHaveBeenCalled();
    });

    it('should create an assignment with file upload', async () => {
      const file = { originalname: 'task.pdf' } as any;
      mockStorage.uploadFile.mockResolvedValue('http://cloudinary.com/task.pdf');
      mockPrismaService.assignment.create.mockResolvedValue({
        id: 'asg-1',
        ...dto,
        fileUrl: 'http://cloudinary.com/task.pdf',
        createdByAdminId: adminId,
      });

      const result = await service.create(dto, adminId, file);
      expect(result.id).toBe('asg-1');
      expect(result.fileUrl).toBe('http://cloudinary.com/task.pdf');
      expect(storage.uploadFile).toHaveBeenCalledWith(file, 'assignment-tasks');
      expect(prisma.assignment.create).toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    const userId = 'user-1';
    const asgId = 'asg-1';
    const file = { originalname: 'task.zip' } as any;

    it('should throw Forbidden if exam not submitted', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.assignment.findUnique.mockResolvedValue({
        id: asgId,
        subDivisionId: 'sub-1',
      });
      mockPrismaService.profile.findUnique.mockResolvedValue({
        subDivisionId: 'sub-1',
      });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue(null);
      await expect(service.submit(asgId, userId, file)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequest when both file and text are missing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue({
        status: AttemptStatus.SUBMITTED,
      });
      mockPrismaService.assignment.findUnique.mockResolvedValue({
        id: asgId,
        subDivisionId: 'sub-1',
      });
      mockPrismaService.profile.findUnique.mockResolvedValue({
        subDivisionId: 'sub-1',
      });

      await expect(service.submit(asgId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create submission with file upload', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue({
        status: AttemptStatus.SUBMITTED,
      });
      mockPrismaService.assignment.findUnique.mockResolvedValue({
        id: asgId,
        subDivisionId: 'sub-1',
      });
      mockPrismaService.profile.findUnique.mockResolvedValue({
        subDivisionId: 'sub-1',
      });
      mockPrismaService.assignmentSubmission.findFirst.mockResolvedValue(null);
      mockStorage.uploadFile.mockResolvedValue('url-zip');
      mockPrismaService.assignmentSubmission.create.mockResolvedValue({
        id: 'subm-1',
      });

      const result = await service.submit(asgId, userId, file);
      expect(result.id).toBe('subm-1');
      expect(storage.uploadFile).toHaveBeenCalledWith(file, 'assignments');
    });

    it('should create submission with text-only content', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue({
        status: AttemptStatus.SUBMITTED,
      });
      mockPrismaService.assignment.findUnique.mockResolvedValue({
        id: asgId,
        subDivisionId: 'sub-1',
      });
      mockPrismaService.profile.findUnique.mockResolvedValue({
        subDivisionId: 'sub-1',
      });
      mockPrismaService.assignmentSubmission.findFirst.mockResolvedValue(null);
      mockPrismaService.assignmentSubmission.create.mockResolvedValue({
        id: 'subm-1',
        textContent: 'my answer',
      });

      const result = await service.submit(asgId, userId, undefined, 'my answer');
      expect(result.id).toBe('subm-1');
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(prisma.assignmentSubmission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assignmentId: asgId,
          userId,
          textContent: 'my answer',
        }),
      });
    });

    it('should update existing submission', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue({
        status: AttemptStatus.SUBMITTED,
      });
      mockPrismaService.assignment.findUnique.mockResolvedValue({
        id: asgId,
        subDivisionId: 'sub-1',
      });
      mockPrismaService.profile.findUnique.mockResolvedValue({
        subDivisionId: 'sub-1',
      });
      mockPrismaService.assignmentSubmission.findFirst.mockResolvedValue({
        id: 'subm-1',
      });
      mockStorage.uploadFile.mockResolvedValue('new-url');
      mockPrismaService.assignmentSubmission.update.mockResolvedValue({
        id: 'subm-1',
      });

      await service.submit(asgId, userId, file);
      expect(prisma.assignmentSubmission.update).toHaveBeenCalled();
    });
  });

  describe('scoreSubmission', () => {
    it('should update score and feedback', async () => {
      mockPrismaService.assignmentSubmission.findUnique.mockResolvedValue({
        id: 'subm-1',
      });
      mockPrismaService.assignmentSubmission.update.mockResolvedValue({
        id: 'subm-1',
        score: 90,
      });

      const result = await service.scoreSubmission('subm-1', {
        score: 90,
        feedback: 'Good',
      });
      expect(result.score).toBe(90);
    });
  });

  describe('download', () => {
    it('should download assignment with stable filename', async () => {
      mockStorage.downloadFile.mockResolvedValue({
        buffer: Buffer.from('pdf-content'),
        contentType: 'application/pdf',
      });

      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.assignment.findUnique.mockResolvedValue({
        id: 'asg-1',
        title: 'Tugas Frontend Minggu 1',
        fileUrl: 'http://cloudinary.com/task.pdf',
        subDivisionId: 'sub-1',
        subDivision: { id: 'sub-1', name: 'Frontend' },
      });

      const result = await service.download('asg-1', 'admin-1', UserRole.ADMIN);

      expect(mockStorage.downloadFile).toHaveBeenCalledWith('http://cloudinary.com/task.pdf');
      expect(result.filename).toBe('Tugas-Frontend-Minggu-1.pdf');
      expect(result.contentType).toBe('application/pdf');
    });
  });
});
