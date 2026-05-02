import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TimelineService } from './timeline.service';
import { PrismaService } from '../../common/services/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('TimelineService', () => {
  let service: TimelineService;
  let prisma: PrismaService;

  const mockTimeline = {
    id: '1',
    title: 'Test Event',
    description: 'Test Desc',
    startAt: new Date(),
    endAt: new Date(),
    orderIndex: 1,
  };

  const mockPrismaService = {
    recruitmentTimeline: {
      findMany: jest.fn().mockResolvedValue([mockTimeline]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(mockTimeline),
      create: jest.fn().mockResolvedValue(mockTimeline),
      update: jest.fn().mockResolvedValue(mockTimeline),
      delete: jest.fn().mockResolvedValue(mockTimeline),
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
        TimelineService,
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

    service = module.get<TimelineService>(TimelineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all timelines', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      const result = await service.findAll();
      expect(result).toEqual([mockTimeline]);
      expect(prisma.recruitmentTimeline.findMany).toHaveBeenCalledWith({
        orderBy: [
          { orderIndex: 'asc' },
          { startAt: 'asc' },
          { createdAt: 'asc' },
        ],
      });
    });
  });

  describe('findOne', () => {
    it('should return a timeline if found', async () => {
      const result = await service.findOne('1');
      expect(result).toEqual(mockTimeline);
    });

    it('should throw NotFoundException if not found', async () => {
      jest
        .spyOn(prisma.recruitmentTimeline, 'findUnique')
        .mockResolvedValueOnce(null);
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new timeline', async () => {
      const dto = {
        title: 'New',
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
        orderIndex: 2,
      };
      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(prisma.recruitmentTimeline.create).toHaveBeenCalled();
      expect(mockCacheManager.del).toHaveBeenCalled();
    });

    it('should throw ConflictException if orderIndex already exists', async () => {
      mockPrismaService.recruitmentTimeline.findFirst.mockResolvedValueOnce({
        id: 'existing-id',
      });

      const dto = {
        title: 'Conflicted',
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
        orderIndex: 1,
      };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });
});
