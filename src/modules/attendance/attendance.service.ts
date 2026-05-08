import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ScanAttendanceDto } from './dto/scan-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { AttendanceStatus } from '../../../prisma/generated-client/client';

import { GoogleSheetsService } from '../../common/services/google-sheets.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {}

  // --- Activity Management (Admin) ---

  async createActivity(dto: CreateActivityDto) {
    const activity = await this.prisma.activity.create({
      data: {
        name: dto.name,
        deadline: new Date(dto.deadline),
      },
    });

    // Auto-create ABSENT records for all APPROVED users
    const approvedUsers = await this.prisma.user.findMany({
      where: {
        submissionVerifications: {
          some: { status: 'APPROVED' },
        },
        role: 'USER',
        isActive: true,
      },
      include: {
        profile: {
          include: { division: true, subDivision: true },
        },
      },
    });

    const attendanceData = approvedUsers.map((user) => ({
      userId: user.id,
      activityId: activity.id,
      status: AttendanceStatus.ABSENT,
    }));

    if (attendanceData.length > 0) {
      await this.prisma.attendance.createMany({
        data: attendanceData,
      });

      // Sinkronisasi Google Sheets: Bulk update semua user dengan ALFA
      const spreadsheetId = process.env.ATTENDANCE_SPREADSHEET_ID;
      if (spreadsheetId) {
        const records = approvedUsers
          .filter((u) => u.profile)
          .map((u) => ({
            nim: u.profile!.nim,
            fullName: u.profile!.fullName,
            divisionName: (u.profile as any).division?.name || '-',
            subDivisionName: (u.profile as any).subDivision?.name || '-',
            status: 'ALFA',
          }));

        if (records.length > 0) {
          await this.googleSheetsService.batchUpdateAttendance(
            spreadsheetId,
            activity.name,
            records,
          );
        }
      }
    }

    return activity;
  }

  async findAllActivities() {
    const activities = await this.prisma.activity.findMany({
      include: {
        _count: {
          select: { attendances: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get detailed stats for each activity
    const activitiesWithStats = await Promise.all(
      activities.map(async (activity) => {
        const stats = await this.prisma.attendance.groupBy({
          by: ['status'],
          where: { activityId: activity.id },
          _count: true,
        });

        const formattedStats = {
          present: stats.find((s) => s.status === AttendanceStatus.PRESENT)?._count || 0,
          absent: stats.find((s) => s.status === AttendanceStatus.ABSENT)?._count || 0,
          excused: stats.find((s) => s.status === AttendanceStatus.EXCUSED)?._count || 0,
          sick: stats.find((s) => s.status === AttendanceStatus.SICK)?._count || 0,
        };

        return {
          ...activity,
          stats: formattedStats,
        };
      }),
    );

    return activitiesWithStats;
  }

  async findOneActivity(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true, nim: true } },
              },
            },
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Kegiatan tidak ditemukan');
    }

    return activity;
  }

  async updateActivity(id: string, dto: CreateActivityDto) {
    await this.findOneActivity(id);
    return await this.prisma.activity.update({
      where: { id },
      data: {
        name: dto.name,
        deadline: new Date(dto.deadline),
      },
    });
  }

  async removeActivity(id: string) {
    const activity = await this.findOneActivity(id);

    // Sync delete to Google Sheets (remove the activity column)
    const spreadsheetId = process.env.ATTENDANCE_SPREADSHEET_ID;
    if (spreadsheetId) {
      try {
        await this.googleSheetsService.deleteActivityColumn(spreadsheetId, activity.name);
      } catch (error) {
        // Log error but proceed with DB deletion
      }
    }

    return await this.prisma.activity.delete({
      where: { id },
    });
  }

  // --- Attendance Logic ---

  async scanAttendance(dto: ScanAttendanceDto) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: dto.activityId },
    });

    if (!activity) {
      throw new NotFoundException('Kegiatan tidak ditemukan');
    }

    const now = new Date();
    if (now > activity.deadline) {
      throw new BadRequestException(
        'Waktu absensi untuk kegiatan ini sudah berakhir',
      );
    }

    const attendance = await this.prisma.attendance.findUnique({
      where: {
        userId_activityId: {
          userId: dto.userId,
          activityId: dto.activityId,
        },
      },
    });

    let result;
    if (!attendance) {
      // Check if user exists and is approved
      const user = await this.prisma.user.findFirst({
        where: {
          id: dto.userId,
          submissionVerifications: { some: { status: 'APPROVED' } },
          isActive: true,
        },
      });

      if (!user) {
        throw new BadRequestException(
          'User tidak ditemukan atau belum diverifikasi',
        );
      }

      result = await this.prisma.attendance.create({
        data: {
          userId: dto.userId,
          activityId: dto.activityId,
          status: AttendanceStatus.PRESENT,
          checkInTime: now,
        },
        include: {
          user: {
            select: {
              profile: {
                include: { division: true, subDivision: true },
              },
            },
          },
          activity: { select: { name: true } },
        },
      });
    } else {
      result = await this.prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          status: AttendanceStatus.PRESENT,
          checkInTime: now,
        },
        include: {
          user: {
            select: {
              profile: {
                include: { division: true, subDivision: true },
              },
            },
          },
          activity: { select: { name: true } },
        },
      });
    }

    // Sinkronisasi ke Google Sheets secara otomatis untuk SELURUH absensi pada activity ini
    await this.syncActivityToSheets(result.activityId, result.activity.name);

    return result;
  }

  async updateAttendance(attendanceId: string, dto: UpdateAttendanceDto) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance) {
      throw new NotFoundException('Data absensi tidak ditemukan');
    }

    const result = await this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status: dto.status,
        notes: dto.notes,
        checkInTime:
          dto.status === AttendanceStatus.PRESENT
            ? new Date()
            : attendance.checkInTime,
      },
      include: {
        user: {
          select: {
            profile: {
              include: { division: true, subDivision: true },
            },
          },
        },
        activity: { select: { id: true, name: true } },
      },
    });

    // Sinkronisasi ke Google Sheets secara otomatis untuk SELURUH absensi pada activity ini
    await this.syncActivityToSheets(result.activity.id, result.activity.name);

    return result;
  }

  async removeAttendance(attendanceId: string) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        user: { select: { profile: { select: { nim: true } } } },
        activity: { select: { id: true, name: true } },
      },
    });

    if (!attendance) {
      throw new NotFoundException('Data absensi tidak ditemukan');
    }

    const result = await this.prisma.attendance.delete({
      where: { id: attendanceId },
    });

    // Sinkronisasi ulang untuk memastikan spreadsheet akurat setelah penghapusan
    await this.syncActivityToSheets(attendance.activity.id, attendance.activity.name);

    return result;
  }

  /**
   * Mengirimkan seluruh data absensi untuk satu kegiatan ke Google Sheets.
   * Ini memastikan data lama dan baru sinkron sepenuhnya.
   */
  private async syncActivityToSheets(activityId: string, activityName: string) {
    const spreadsheetId = process.env.ATTENDANCE_SPREADSHEET_ID;
    if (!spreadsheetId) return;

    try {
      // Ambil seluruh user yang sudah disetujui (Approved)
      // Kita ingin memastikan semua yang berhak ikut kegiatan ada di spreadsheet
      const approvedUsers = await this.prisma.user.findMany({
        where: {
          submissionVerifications: { some: { status: 'APPROVED' } },
          role: 'USER',
          isActive: true,
        },
        include: {
          profile: { include: { division: true, subDivision: true } },
          attendances: {
            where: { activityId },
          },
        },
      });

      const records = approvedUsers
        .filter((u) => u.profile)
        .map((u) => {
          const attendance = u.attendances[0];
          return {
            nim: u.profile!.nim,
            fullName: u.profile!.fullName,
            divisionName: (u.profile as any).division?.name || '-',
            subDivisionName: (u.profile as any).subDivision?.name || '-',
            status: attendance ? this.formatStatus(attendance.status) : 'ALFA',
          };
        });

      if (records.length > 0) {
        await this.googleSheetsService.batchUpdateAttendance(
          spreadsheetId,
          activityName,
          records,
        );
      }
    } catch (error) {
      // Log error but don't disrupt the flow
    }
  }

  async getMyAttendances(userId: string) {
    return await this.prisma.attendance.findMany({
      where: { userId },
      include: {
        activity: true,
      },
      orderBy: {
        activity: {
          createdAt: 'desc',
        },
      },
    });
  }

  private formatStatus(status: AttendanceStatus): string {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 'HADIR';
      case AttendanceStatus.ABSENT:
        return 'ALFA';
      case AttendanceStatus.SICK:
        return 'SAKIT';
      case AttendanceStatus.EXCUSED:
        return 'IZIN';
      default:
        return status;
    }
  }
}
