import { Test, TestingModule } from '@nestjs/testing';
import { VerificationService } from './verification.service';
import { PrismaService } from '../../common/services/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { VerificationStatus } from '../../../prisma/generated-client/client';

describe('VerificationService', () => {
  let service: VerificationService;
  let prisma: PrismaService;
  let storage: any;

  const mockPrismaService = {
    submissionVerification: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockStorage = {
    uploadFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'IStorageService',
          useValue: mockStorage,
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get('IStorageService');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reviewSubmission', () => {
    it('should throw NotFound if submission missing', async () => {
      mockPrismaService.submissionVerification.findUnique.mockResolvedValue(
        null,
      );
      await expect(
        service.reviewSubmission('1', 'admin-1', {
          status: VerificationStatus.APPROVED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update status and reject reason if REJECTED', async () => {
      mockPrismaService.submissionVerification.findUnique.mockResolvedValue({
        id: '1',
      });
      mockPrismaService.submissionVerification.update.mockResolvedValue({
        id: '1',
        status: 'REJECTED',
      });

      await service.reviewSubmission('1', 'admin-1', {
        status: VerificationStatus.REJECTED,
        rejectionReason: 'Poor photo',
      });

      expect(prisma.submissionVerification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: 'Poor photo',
          reviewedByAdminId: 'admin-1',
        }),
      });
    });
  });

  describe('submitVerification', () => {
    it('should create new submission if none exists', async () => {
      mockPrismaService.submissionVerification.findFirst.mockResolvedValue(
        null,
      );
      mockStorage.uploadFile.mockResolvedValue('url-1');
      mockPrismaService.submissionVerification.create.mockResolvedValue({
        id: 'new-1',
      });

      const dto = { twibbonLink: 'link-1' };
      const files = { krsScan: [{ originalname: 'krs.pdf' }] as any };

      const result = await service.submitVerification('user-1', dto, files);
      expect(result.id).toBe('new-1');
      expect(prisma.submissionVerification.create).toHaveBeenCalled();
    });

    it('should update existing PENDING submission', async () => {
      mockPrismaService.submissionVerification.findFirst.mockResolvedValue({
        id: 'existing-1',
        status: 'PENDING',
      });
      mockPrismaService.submissionVerification.update.mockResolvedValue({
        id: 'existing-1',
      });

      const result = await service.submitVerification(
        'user-1',
        { twibbonLink: 'new-link' },
        {},
      );
      expect(prisma.submissionVerification.update).toHaveBeenCalledWith({
        where: { id: 'existing-1' },
        data: expect.objectContaining({ twibbonLink: 'new-link' }),
      });
    });
  });
});
