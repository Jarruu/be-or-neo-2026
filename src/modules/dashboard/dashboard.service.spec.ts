import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../common/services/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
    submissionVerification: {
      findFirst: jest.fn(),
      groupBy: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      groupBy: jest.fn(),
    },
    recruitmentTimeline: {
      findMany: jest.fn(),
    },
    examAttempt: {
      findFirst: jest.fn(),
    },
    subDivision: {
      findMany: jest.fn(),
    },
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
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

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMyDashboard', () => {
    it('should calculate steps and current status correctly', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.profile.findUnique.mockResolvedValue({
        fullName: 'Test User',
        nim: '1234',
        whatsappNumber: '08123',
        fakultas: 'TEKNOLOGI_INFORMASI',
        studyProgramId: 'prog-1',
        departmentId: 'dept-1',
        divisionId: 'div-1',
        subDivisionId: 'sub-1',
        subDivision: { name: 'Frontend' },
        programStudi: { name: 'Sistem Informasi' },
      });
      mockPrismaService.submissionVerification.findFirst.mockResolvedValue({
        status: 'APPROVED',
      });
      mockPrismaService.payment.findFirst.mockResolvedValue({
        status: 'PENDING',
      });
      mockPrismaService.recruitmentTimeline.findMany.mockResolvedValue([]);
      mockPrismaService.examAttempt.findFirst.mockResolvedValue(null);

      const result = await service.getMyDashboard('user-1') as any;

      expect(result.progress.currentStep).toBe(3); // Profile Complete -> Step 2, Verif APPROVED -> Step 3
      expect(result.user.fullName).toBe('Test User');
      expect(result.steps[0].isCompleted).toBe(true);
      expect(result.steps[1].isCompleted).toBe(true);
      expect(result.steps[2].status).toBe('PENDING');
    });
  });

  describe('getAdminStats', () => {
    it('should return aggregated metrics for admin', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({ deactivatedAt: null });
      mockPrismaService.user.count.mockResolvedValue(100);
      mockPrismaService.submissionVerification.groupBy.mockResolvedValue([
        { status: 'APPROVED', _count: { _all: 50 } },
        { status: 'PENDING', _count: { _all: 30 } },
      ]);
      mockPrismaService.payment.groupBy.mockResolvedValue([
        { status: 'PAID', _count: { _all: 40 } },
      ]);
      mockPrismaService.subDivision.findMany.mockResolvedValue([
        { name: 'Web', _count: { profiles: 20 } },
        { name: 'Mobile', _count: { profiles: 12 } },
      ]);

      const result = await service.getAdminStats() as any;

      expect(result.overview.totalRegistrants).toBe(100);
      expect(result.verifications).toHaveLength(2);
      expect(result.payments[0].status).toBe('PAID');
      expect(result.distribution).toHaveLength(2);
      expect(result.distribution[0].name).toBe('Web');
    });
  });
});
