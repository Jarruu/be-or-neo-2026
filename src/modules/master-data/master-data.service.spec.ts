import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MasterDataService } from './master-data.service';
import { PrismaService } from '../../common/services/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('MasterDataService', () => {
  let service: MasterDataService;
  let prisma: PrismaService;

  const mockPrismaService = {
    department: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    division: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    subDivision: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    store: {
      keys: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterDataService,
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

    service = module.get<MasterDataService>(MasterDataService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Department', () => {
    const deptId = 'dept-1';
    const deptDto = { name: 'Technology' };

    it('should create a department if name is unique', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(null);
      mockPrismaService.department.create.mockResolvedValue({
        id: deptId,
        ...deptDto,
      });

      const result = await service.createDepartment(deptDto);
      expect(result.id).toBe(deptId);
      expect(prisma.department.create).toHaveBeenCalledWith({ data: deptDto });
    });

    it('should throw ConflictException if department name exists', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue({
        id: deptId,
        ...deptDto,
      });
      await expect(service.createDepartment(deptDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should update a department', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue({
        id: deptId,
        ...deptDto,
      });
      mockPrismaService.department.update.mockResolvedValue({
        id: deptId,
        name: 'New Name',
      });

      const result = await service.updateDepartment(deptId, {
        name: 'New Name',
      });
      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundException if updating non-existent department', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(null);
      await expect(
        service.updateDepartment(deptId, { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Division', () => {
    const divId = 'div-1';
    const divDto = { name: 'Web', departmentId: 'dept-1' };

    it('should create a division if name is unique in department', async () => {
      mockPrismaService.division.findUnique.mockResolvedValue(null);
      mockPrismaService.division.create.mockResolvedValue({
        id: divId,
        ...divDto,
      });

      const result = await service.createDivision(divDto);
      expect(result.id).toBe(divId);
    });

    it('should throw Conflict if division exists in department', async () => {
      mockPrismaService.division.findUnique.mockResolvedValue({
        id: divId,
        ...divDto,
      });
      await expect(service.createDivision(divDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('SubDivision', () => {
    it('should delete sub-division if it exists', async () => {
      mockPrismaService.subDivision.findUnique.mockResolvedValue({
        id: 'sub-1',
        name: 'FE',
      });
      mockPrismaService.subDivision.delete.mockResolvedValue({ id: 'sub-1' });

      await service.deleteSubDivision('sub-1');
      expect(prisma.subDivision.delete).toHaveBeenCalled();
    });
  });
});
