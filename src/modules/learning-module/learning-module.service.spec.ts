import { Test, TestingModule } from '@nestjs/testing';
import { LearningModuleService } from './learning-module.service';
import { PrismaService } from '../../common/services/prisma.service';
import { CloudinaryStorageService } from '../../common/services/storage/cloudinary-storage.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttemptStatus, UserRole } from '../../../prisma/generated-client/client';

describe('LearningModuleService', () => {
  let service: LearningModuleService;
  let prisma: PrismaService;
  let storage: CloudinaryStorageService;
  let cache: any;

  const mockPrismaService = {
    user: { findUnique: jest.fn() },
    learningModule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    profile: { findUnique: jest.fn() },
    examAttempt: { findFirst: jest.fn() },
  };

  const mockStorage = {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningModuleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CloudinaryStorageService,
          useValue: mockStorage,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<LearningModuleService>(LearningModuleService);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get<CloudinaryStorageService>(CloudinaryStorageService);
    cache = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      title: 'React Module',
      description: 'Intro to React',
      subDivisionId: 'sub-1',
    };
    const adminId = 'admin-1';
    const file = { originalname: 'react.pdf' } as any;

    it('should upload file and create module', async () => {
      mockStorage.uploadFile.mockResolvedValue('http://cloudinary.com/react.pdf');
      mockPrismaService.learningModule.create.mockResolvedValue({ id: 'mod-1', ...dto, fileUrl: 'url' });

      const result = await service.create(dto, adminId, file);

      expect(storage.uploadFile).toHaveBeenCalledWith(file, 'learning-modules');
      expect(prisma.learningModule.create).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalled();
      expect(result.id).toBe('mod-1');
    });
  });

  describe('findByUserId', () => {
    const userId = 'user-1';

    it('should throw Forbidden if exam not submitted', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue({ subDivisionId: 'sub-1' });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue(null);

      await expect(service.findByUserId(userId)).rejects.toThrow(ForbiddenException);
    });

    it('should return modules if exam is submitted', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.profile.findUnique.mockResolvedValue({ subDivisionId: 'sub-1' });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue({ status: AttemptStatus.SUBMITTED });
      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.learningModule.findMany.mockResolvedValue([{ title: 'Module 1' }]);

      const result = await service.findByUserId(userId);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Module 1');
    });
  });

  describe('download', () => {
    it('should download and provide correct filename', async () => {
      mockStorage.downloadFile.mockResolvedValue({
        buffer: Buffer.from('content'),
        contentType: 'application/pdf',
      });

      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.learningModule.findUnique.mockResolvedValue({
        id: 'mod-1',
        title: 'Advanced Git',
        fileUrl: 'http://cloudinary.com/git.pdf',
        subDivisionId: 'sub-1',
      });
      mockPrismaService.profile.findUnique.mockResolvedValue({ subDivisionId: 'sub-1' });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue({ status: AttemptStatus.SUBMITTED });

      const result = await service.download('mod-1', 'user-1', UserRole.USER);

      expect(mockStorage.downloadFile).toHaveBeenCalledWith('http://cloudinary.com/git.pdf');
      expect(result.filename).toBe('Advanced-Git.pdf');
      expect(result.contentType).toBe('application/pdf');
    });

    it('should throw error if storage download fails', async () => {
      mockStorage.downloadFile.mockRejectedValue(new Error('Storage error'));

      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.learningModule.findUnique.mockResolvedValue({
        id: 'mod-1',
        title: 'Title',
        fileUrl: 'url',
        subDivisionId: 'sub-1',
      });
      mockPrismaService.profile.findUnique.mockResolvedValue({ subDivisionId: 'sub-1' });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue({ status: AttemptStatus.SUBMITTED });

      await expect(service.download('mod-1', 'user-1', UserRole.USER)).rejects.toThrow();
    });
  });
});
