import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getMyDashboard(userId: string) {
    const frozenAt = await this.getUserFrozenAt(userId);
    const cacheKey = this.getCacheKey(userId, frozenAt);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        department: true,
        division: true,
        subDivision: true,
        programStudi: true,
      },
    });

    const verification = await this.prisma.submissionVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const payment = await this.prisma.payment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const timeline = await this.prisma.recruitmentTimeline.findMany({
      orderBy: [
        { orderIndex: 'asc' },
        { startAt: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Check progress
    const isProfileComplete = !!(
      profile?.fullName &&
      profile?.nim &&
      profile?.whatsappNumber &&
      profile?.fakultas &&
      profile?.studyProgramId &&
      profile?.departmentId &&
      profile?.divisionId &&
      profile?.subDivisionId
    );

    const verificationStatus = verification?.status || 'NOT_STARTED';
    const paymentStatus = payment?.status || 'NOT_STARTED';

    // Calculate current step
    let currentStep = 1;
    if (isProfileComplete) {
      currentStep = 2;
      if (verificationStatus === 'APPROVED') {
        currentStep = 3;
        if (paymentStatus === 'APPROVED') {
          currentStep = 4;
        }
      }
    }

    const examAttempt = await this.prisma.examAttempt.findFirst({
      where: { userId, status: 'SUBMITTED' },
    });

    const steps = [
      {
        step: 1,
        title: 'Lengkapi Profil',
        description: 'Isi data diri dan pilih subdivisi yang kamu minati.',
        isCompleted: isProfileComplete,
      },
      {
        step: 2,
        title: 'Verifikasi Berkas',
        description:
          'Upload dokumen yang diperlukan untuk verifikasi pendaftaran.',
        isCompleted: verificationStatus === 'APPROVED',
        status: verificationStatus,
      },
      {
        step: 3,
        title: 'Pembayaran',
        description:
          'Lakukan pembayaran biaya pendaftaran untuk melanjutkan ke tahap ujian.',
        isCompleted: paymentStatus === 'APPROVED',
        status: paymentStatus,
      },
      {
        step: 4,
        title: 'Ujian Seleksi',
        description: 'Kerjakan ujian sesuai subdivisi yang kamu pilih.',
        isCompleted: !!examAttempt,
        status: examAttempt ? 'COMPLETED' : 'PENDING',
      },
    ];

    const now = new Date();
    const nextTimelineEvent = timeline.find((t) => t.startAt > now);

    const result = {
      user: {
        id: userId,
        fullName: profile?.fullName,
        subDivision: profile?.subDivision?.name,
      },
      progress: {
        currentStep,
        totalSteps: steps.length,
        percentage: Math.round(((currentStep - 1) / steps.length) * 100),
      },
      steps,
      timeline,
      nextTimelineEvent,
    };

    // Cache user dashboard for 3 minutes (180,000 ms)
    await this.cacheManager.set(cacheKey, result, 180000);
    return result;
  }

  async getAdminStats() {
    const cacheKey = 'dashboard:admin_stats';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const totalUsers = await this.prisma.user.count({
      where: { role: 'USER', isActive: true },
    });

    const verificationStats = await this.prisma.submissionVerification.groupBy({
      by: ['status'],
      where: {
        user: { isActive: true },
      },
      _count: {
        _all: true,
      },
    });

    const paymentStats = await this.prisma.payment.groupBy({
      by: ['status'],
      where: {
        user: { isActive: true },
      },
      _count: {
        _all: true,
      },
    });

    // SubDivision Distribution
    const subDivisions = await this.prisma.subDivision.findMany({
      include: {
        _count: {
          select: { profiles: true },
        },
      },
    });

    const subDivisionDistribution = await Promise.all(
      subDivisions.map(async (sd) => {
        const activeCount = await this.prisma.profile.count({
          where: {
            subDivisionId: sd.id,
            user: { isActive: true },
          },
        });
        return {
          name: sd.name,
          applicantCount: activeCount,
        };
      }),
    );

    const result = {
      overview: {
        totalRegistrants: totalUsers,
      },
      verifications: verificationStats.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      payments: paymentStats.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      distribution: subDivisionDistribution,
    };

    // Cache admin stats for 5 minutes (300,000 ms)
    await this.cacheManager.set(cacheKey, result, 300000);
    return result;
  }

  private async getUserFrozenAt(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deactivatedAt: true },
    });

    return user?.deactivatedAt ?? null;
  }

  private getCacheKey(userId: string, frozenAt?: Date | null) {
    if (!frozenAt) {
      return `dashboard:user:${userId}`;
    }

    return `dashboard:user:${userId}:frozen:${frozenAt.toISOString()}`;
  }
}
