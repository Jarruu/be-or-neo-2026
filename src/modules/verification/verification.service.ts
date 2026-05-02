import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { IStorageService } from '../../common/services/storage/storage.interface';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { VerificationStatus } from '../../../prisma/generated-client/client';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('IStorageService') private readonly storage: IStorageService,
  ) {}

  async findAll(status?: VerificationStatus) {
    return this.prisma.submissionVerification.findMany({
      where: status ? { status } : {},
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewSubmission(
    id: string,
    adminId: string,
    dto: ReviewVerificationDto,
  ) {
    const submission = await this.prisma.submissionVerification.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return this.prisma.submissionVerification.update({
      where: { id },
      data: {
        status: dto.status,
        rejectionReason:
          dto.status === VerificationStatus.REJECTED
            ? dto.rejectionReason
            : null,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  async getMyVerification(userId: string) {
    return this.prisma.submissionVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitVerification(
    userId: string,
    dto: CreateVerificationDto,
    files: {
      krsScan?: Express.Multer.File[];
      formalPhoto?: Express.Multer.File[];
      instagramProof?: Express.Multer.File[];
      instagramMarketingProof?: Express.Multer.File[];
    },
  ) {
    // Cek pendaftaran aktif (PENDING)
    const submission = await this.prisma.submissionVerification.findFirst({
      where: {
        userId,
        status: {
          in: [VerificationStatus.PENDING, VerificationStatus.REJECTED],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data: any = {
      userId,
      twibbonLink: dto.twibbonLink,
    };

    if (files.krsScan) {
      const upload = await this.storage.uploadFile(
        files.krsScan[0],
        'verifications',
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      data.krsScanUrl = upload;
    }

    if (files.formalPhoto) {
      const upload = await this.storage.uploadFile(
        files.formalPhoto[0],
        'verifications',
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      data.formalPhotoUrl = upload;
    }

    if (files.instagramProof) {
      const upload = await this.storage.uploadFile(
        files.instagramProof[0],
        'verifications',
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      data.instagramProofUrl = upload;
    }

    if (files.instagramMarketingProof) {
      const upload = await this.storage.uploadFile(
        files.instagramMarketingProof[0],
        'verifications',
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      data.instagramMarketingProofUrl = upload;
    }

    if (submission) {
      return this.prisma.submissionVerification.update({
        where: { id: submission.id },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data,
      });
    }

    return this.prisma.submissionVerification.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data,
    });
  }
}
