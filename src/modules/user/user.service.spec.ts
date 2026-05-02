import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../common/services/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole } from '../../../prisma/generated-client/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    programStudi: {
      findUnique: jest.fn(),
    },
    division: {
      findUnique: jest.fn(),
    },
    subDivision: {
      findUnique: jest.fn(),
    },
    mentor: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCacheManager = {
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const mockUsers = [{ id: '1', email: 'test@example.com' }];
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(result).toEqual(mockUsers);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a user if found', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('1');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          profile: true,
          payments: true,
          submissionVerifications: true,
        },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const adminId = 'admin-1';
    const userId = 'user-1';

    it('should delete a user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        role: UserRole.USER,
      });
      mockPrismaService.user.delete.mockResolvedValue({ id: userId });

      const result = await service.remove(userId, adminId);

      expect(result).toEqual({ id: userId });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should throw NotFoundException if user to delete not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.remove(userId, adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if admin tries to delete themselves', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: adminId,
        role: UserRole.ADMIN,
      });

      await expect(service.remove(adminId, adminId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    const adminId = 'admin-1';
    const userId = 'user-1';

    beforeEach(() => {
      mockPrismaService.$transaction.mockImplementation((callback) =>
        callback(mockPrismaService),
      );
    });

    it('should update user and profile data successfully', async () => {
      const existingUser = {
        id: userId,
        email: 'old@example.com',
        role: UserRole.USER,
        isActive: true,
        deactivatedAt: null,
        profile: {
          nim: '2211521001',
          fakultas: null,
          studyProgramId: null,
          departmentId: null,
          divisionId: null,
        },
      };
      const updatedUser = {
        id: userId,
        email: 'new@example.com',
        profile: { fullName: 'Updated User' },
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(updatedUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);
      mockPrismaService.profile.update.mockResolvedValue(updatedUser.profile);

      const result = await service.update(
        userId,
        { email: 'new@example.com', fullName: 'Updated User' },
        adminId,
      );

      expect(result).toEqual(updatedUser);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { email: 'new@example.com' },
      });
      expect(mockPrismaService.profile.update).toHaveBeenCalledWith({
        where: { userId },
        data: { fullName: 'Updated User' },
      });
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        `profile:user:${userId}`,
      );
    });

    it('should throw NotFoundException if user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.update(userId, {}, adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should prevent admin from deactivating themselves', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: adminId,
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        profile: null,
      });

      await expect(
        service.update(adminId, { isActive: false }, adminId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
