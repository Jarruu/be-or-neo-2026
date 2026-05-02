import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  PaymentStatus,
} from '../../../prisma/generated-client/client';
import { CloudinaryStorageService } from '../../common/services/storage/cloudinary-storage.service';
import { ReviewPaymentDto } from './dto/review-payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: CloudinaryStorageService,
  ) {}

  async uploadProof(userId: string, amount: string, file: Express.Multer.File) {
    // 1. Check user profile and verification status
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        submissionVerifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user || !user.profile) {
      throw new BadRequestException('Lengkapi profil terlebih dahulu');
    }

    const verification = user.submissionVerifications[0];
    if (!verification || verification.status !== 'APPROVED') {
      throw new BadRequestException(
        'Berkas pendaftaran harus disetujui (APPROVED) sebelum melakukan pembayaran',
      );
    }

    // 2. Check if user already has an APPROVED or PENDING payment
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        userId,
        status: { in: [PaymentStatus.APPROVED, PaymentStatus.PENDING] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.APPROVED) {
        throw new BadRequestException('Anda sudah melunasi pembayaran');
      }
      if (existingPayment.status === PaymentStatus.PENDING) {
        throw new BadRequestException(
          'Pembayaran Anda sedang dalam peninjauan admin',
        );
      }
    }

    // 3. Upload proof image
    const proofUrl = await this.storageService.uploadFile(file, 'payments');

    // 4. Save to database
    return await this.prisma.payment.create({
      data: {
        userId,
        amount: parseFloat(amount),
        proofUrl,
        status: PaymentStatus.PENDING,
      },
    });
  }

  async findAll() {
    return this.prisma.payment.findMany({
      include: {
        user: {
          select: {
            email: true,
            profile: { select: { fullName: true, nim: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
            profile: { select: { fullName: true, nim: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Data pembayaran tidak ditemukan');
    }

    return payment;
  }

  async reviewPayment(adminId: string, paymentId: string, dto: ReviewPaymentDto) {
    const payment = await this.findOne(paymentId);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Pembayaran sudah diproses');
    }

    if (dto.status === PaymentStatus.REJECTED && !dto.rejectionReason) {
      throw new BadRequestException('Alasan penolakan harus diisi');
    }

    return await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: dto.status,
        rejectionReason: dto.status === PaymentStatus.REJECTED ? dto.rejectionReason : null,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  async getMyPayment(userId: string) {
    return await this.prisma.payment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
