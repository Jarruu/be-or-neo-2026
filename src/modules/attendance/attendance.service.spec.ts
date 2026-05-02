import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../../common/services/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '../../../prisma/generated-client/client';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: PrismaService;

  const mockActivity = {
    id: 'activity-1',
    name: 'Test Activity',
    deadline: new Date(Date.now() + 3600000), // 1 hour from now
  };

  const mockPrismaService = {
    activity: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    attendance: {
      createMany: jest.fn(),
      groupBy: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createActivity', () => {
    it('should create activity and initial attendance records', async () => {
      const dto = { name: 'New Activity', deadline: new Date().toISOString() };
      mockPrismaService.activity.create.mockResolvedValue({ id: 'act-1', ...dto });
      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);

      const result = await service.createActivity(dto);
      expect(result.id).toBe('act-1');
      expect(prisma.activity.create).toHaveBeenCalled();
      expect(prisma.attendance.createMany).toHaveBeenCalled();
    });
  });

  describe('scanAttendance', () => {
    const userId = 'user-1';
    const activityId = 'activity-1';
    const dto = { userId, activityId };

    it('should throw NotFound if activity does not exist', async () => {
      mockPrismaService.activity.findUnique.mockResolvedValue(null);
      await expect(service.scanAttendance(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequest if deadline passed', async () => {
      mockPrismaService.activity.findUnique.mockResolvedValue({
        ...mockActivity,
        deadline: new Date(Date.now() - 3600000), // 1 hour ago
      });
      await expect(service.scanAttendance(dto)).rejects.toThrow(BadRequestException);
    });

    it('should update attendance to PRESENT if record exists', async () => {
      mockPrismaService.activity.findUnique.mockResolvedValue(mockActivity);
      mockPrismaService.attendance.findUnique.mockResolvedValue({
        id: 'att-1',
        userId,
        activityId,
        status: AttendanceStatus.ABSENT,
      });
      mockPrismaService.attendance.update.mockResolvedValue({ status: AttendanceStatus.PRESENT });

      const result = await service.scanAttendance(dto);
      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(prisma.attendance.update).toHaveBeenCalled();
    });

    it('should create attendance if record does not exist but user is verified', async () => {
      mockPrismaService.activity.findUnique.mockResolvedValue(mockActivity);
      mockPrismaService.attendance.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: userId });
      mockPrismaService.attendance.create.mockResolvedValue({ status: AttendanceStatus.PRESENT });

      const result = await service.scanAttendance(dto);
      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(prisma.attendance.create).toHaveBeenCalled();
    });
  });

  describe('updateAttendance', () => {
    it('should manually update status', async () => {
      mockPrismaService.attendance.findUnique.mockResolvedValue({ id: 'att-1' });
      mockPrismaService.attendance.update.mockResolvedValue({ status: AttendanceStatus.EXCUSED });

      const result = await service.updateAttendance('att-1', {
        status: AttendanceStatus.EXCUSED,
        notes: 'Izin',
      });
      expect(result.status).toBe(AttendanceStatus.EXCUSED);
      expect(prisma.attendance.update).toHaveBeenCalled();
    });
  });
});
