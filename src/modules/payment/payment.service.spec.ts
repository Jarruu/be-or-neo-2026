import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../common/services/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '../../../prisma/generated-client/client';
import { CloudinaryStorageService } from '../../common/services/storage/cloudinary-storage.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: PrismaService;
  let storage: CloudinaryStorageService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockStorageService = {
    uploadFile: jest.fn().mockResolvedValue('http://mock-url.com/proof.jpg'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CloudinaryStorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get<CloudinaryStorageService>(CloudinaryStorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadProof', () => {
    const userId = 'user-1';
    const amount = '50000';
    const mockFile = { buffer: Buffer.from('test') } as any;

    it('should throw BadRequest if user has no profile', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.uploadProof(userId, amount, mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequest if verification is not approved', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        profile: { fullName: 'Test' },
        submissionVerifications: [{ status: 'PENDING' }],
      });
      await expect(service.uploadProof(userId, amount, mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequest if user already has an APPROVED payment', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        profile: { fullName: 'Test' },
        submissionVerifications: [{ status: 'APPROVED' }],
      });
      mockPrismaService.payment.findFirst.mockResolvedValue({
        status: PaymentStatus.APPROVED,
      });
      await expect(service.uploadProof(userId, amount, mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully upload proof', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        profile: { fullName: 'Test' },
        submissionVerifications: [{ status: 'APPROVED' }],
      });
      mockPrismaService.payment.findFirst.mockResolvedValue(null);
      mockPrismaService.payment.create.mockResolvedValue({ id: 'pay-1' });

      const result = await service.uploadProof(userId, amount, mockFile);
      expect(result).toBeDefined();
      expect(storage.uploadFile).toHaveBeenCalled();
      expect(prisma.payment.create).toHaveBeenCalled();
    });
  });

  describe('reviewPayment', () => {
    const adminId = 'admin-1';
    const paymentId = 'pay-1';

    it('should throw BadRequest if status is already processed', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: paymentId,
        status: PaymentStatus.APPROVED,
      });
      await expect(
        service.reviewPayment(adminId, paymentId, { status: PaymentStatus.APPROVED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequest if rejected without reason', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: paymentId,
        status: PaymentStatus.PENDING,
      });
      await expect(
        service.reviewPayment(adminId, paymentId, { status: PaymentStatus.REJECTED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully approve payment', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: paymentId,
        status: PaymentStatus.PENDING,
      });
      mockPrismaService.payment.update.mockResolvedValue({ status: PaymentStatus.APPROVED });

      const result = await service.reviewPayment(adminId, paymentId, {
        status: PaymentStatus.APPROVED,
      });
      expect(result.status).toBe(PaymentStatus.APPROVED);
      expect(prisma.payment.update).toHaveBeenCalled();
    });
  });
});
