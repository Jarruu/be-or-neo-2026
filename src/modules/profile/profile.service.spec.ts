import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../common/services/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Fakultas } from '../../../prisma/generated-client/client';

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: PrismaService;
  let storageService: any;

  const mockPrismaService = {
    user: { findUnique: jest.fn() },
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    department: { findMany: jest.fn() },
    division: { findUnique: jest.fn(), findMany: jest.fn() },
    subDivision: { findUnique: jest.fn(), findMany: jest.fn() },
    programStudi: { findUnique: jest.fn(), findMany: jest.fn() },
  };

  const mockStorageService = {
    uploadFile: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'IStorageService',
          useValue: mockStorageService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    prisma = module.get<PrismaService>(PrismaService);
    storageService = module.get('IStorageService');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should throw NotFound if profile missing', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.profile.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('1')).rejects.toThrow(NotFoundException);
    });

    it('should return profile if found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.profile.findUnique.mockResolvedValue({
        id: '1',
        fullName: 'Test',
      });
      const result = await service.getProfile('1') as any;
      expect(result.fullName).toBe('Test');
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      mockPrismaService.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        fakultas: Fakultas.TEKNOLOGI_INFORMASI,
        studyProgramId: 'prog-1',
      });
      mockPrismaService.programStudi.findUnique.mockResolvedValue({
        id: 'prog-1',
        fakultas: Fakultas.TEKNOLOGI_INFORMASI,
        name: 'Sistem Informasi',
      });
    });

    it('should throw BadRequest if division does not belong to department', async () => {
      const dto = { departmentId: 'dept-1', divisionId: 'div-1' };
      mockPrismaService.division.findUnique.mockResolvedValue({
        id: 'div-1',
        departmentId: 'dept-2',
      });

      await expect(service.updateProfile('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequest if subdivision does not belong to division', async () => {
      const dto = { divisionId: 'div-1', subDivisionId: 'sub-1' };
      mockPrismaService.subDivision.findUnique.mockResolvedValue({
        id: 'sub-1',
        divisionId: 'div-2',
      });

      await expect(service.updateProfile('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update profile if hierarchy is valid', async () => {
      const dto = {
        departmentId: 'dept-1',
        divisionId: 'div-1',
        subDivisionId: 'sub-1',
      };
      mockPrismaService.division.findUnique.mockResolvedValue({
        id: 'div-1',
        departmentId: 'dept-1',
      });
      mockPrismaService.subDivision.findUnique.mockResolvedValue({
        id: 'sub-1',
        divisionId: 'div-1',
      });
      mockPrismaService.profile.update.mockResolvedValue({
        userId: 'user-1',
        ...dto,
      });

      const result = await service.updateProfile('user-1', dto);
      expect(result.userId).toBe('user-1');
      expect(mockCacheManager.del).toHaveBeenCalled();
    });

    it('should throw BadRequest if study program does not match faculty', async () => {
      const dto = {
        fakultas: Fakultas.TEKNIK,
        studyProgramId: 'prog-2',
      };

      mockPrismaService.programStudi.findUnique.mockResolvedValue({
        id: 'prog-2',
        fakultas: Fakultas.MIPA,
        name: 'Biologi',
      });

      await expect(service.updateProfile('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update profile if faculty and study program match', async () => {
      const dto = {
        fakultas: Fakultas.TEKNOLOGI_INFORMASI,
        studyProgramId: 'prog-1',
      };

      mockPrismaService.programStudi.findUnique.mockResolvedValue({
        id: 'prog-1',
        fakultas: Fakultas.TEKNOLOGI_INFORMASI,
        name: 'Sistem Informasi',
      });
      mockPrismaService.profile.update.mockResolvedValue({
        userId: 'user-1',
        ...dto,
      });

      const result = await service.updateProfile('user-1', dto);
      expect(result.fakultas).toBe(Fakultas.TEKNOLOGI_INFORMASI);
      expect(result.studyProgramId).toBe('prog-1');
    });
  });

  describe('updateAvatar', () => {
    it('should upload file and update profile avatarUrl', async () => {
      const mockFile = { originalname: 'test.png' } as any;
      mockStorageService.uploadFile.mockResolvedValue(
        'https://cloud.com/test.png',
      );
      mockPrismaService.profile.update.mockResolvedValue({
        avatarUrl: 'https://cloud.com/test.png',
      });

      const result = await service.updateAvatar('user-1', mockFile);
      expect(result.avatarUrl).toBe('https://cloud.com/test.png');
      expect(mockStorageService.uploadFile).toHaveBeenCalled();
      expect(mockCacheManager.del).toHaveBeenCalled();
    });
  });
});
