import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Fakultas, UserRole } from '../../../prisma/generated-client/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        profile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        payments: true,
        submissionVerifications: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, currentAdminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.id === currentAdminId) {
      if (dto.isActive === false) {
        throw new BadRequestException(
          'Anda tidak dapat menonaktifkan akun Anda sendiri',
        );
      }

      if (dto.role && dto.role !== user.role) {
        throw new BadRequestException(
          'Anda tidak dapat mengubah role akun Anda sendiri',
        );
      }
    }

    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already registered');
      }
    }

    if (dto.nim && dto.nim !== user.profile?.nim) {
      const existingProfile = await this.prisma.profile.findUnique({
        where: { nim: dto.nim },
      });

      if (existingProfile) {
        throw new ConflictException('NIM already registered');
      }
    }

    if (!user.profile && this.hasProfileUpdates(dto)) {
      throw new NotFoundException(`Profile for user ID ${id} not found`);
    }

    await this.validateProfileRelations(dto, user.profile);

    const userData: {
      email?: string;
      role?: UserRole;
      isActive?: boolean;
      deactivatedAt?: Date | null;
    } = {};

    if (dto.email !== undefined) userData.email = dto.email;
    if (dto.role !== undefined) userData.role = dto.role;
    if (dto.isActive !== undefined) {
      userData.isActive = dto.isActive;
      userData.deactivatedAt = dto.isActive
        ? null
        : (user.deactivatedAt ?? new Date());
    }

    const profileData = this.getProfileData(dto);

    const result = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id },
          data: userData,
        });
      }

      if (Object.keys(profileData).length > 0) {
        await tx.profile.update({
          where: { userId: id },
          data: profileData,
        });
      }

      return tx.user.findUnique({
        where: { id },
        include: {
          profile: true,
          payments: true,
          submissionVerifications: true,
        },
      });
    });

    await this.cacheManager.del(`profile:user:${id}`);
    return result;
  }

  async remove(id: string, currentAdminId: string) {
    // 1. Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // 2. Prevent admin from deleting themselves
    if (user.id === currentAdminId) {
      throw new BadRequestException(
        'Anda tidak dapat menghapus akun Anda sendiri',
      );
    }

    // 3. Prevent deleting other admins (optional, depend on policy)
    if (user.role === UserRole.ADMIN) {
      // Logic for safety: maybe only super admin can delete other admins?
      // For now, let's allow it but log it or add extra check if needed.
    }

    // 4. Delete user (Cascading will handle related records)
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async updateMentor(userId: string, mentorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.profile) {
      throw new NotFoundException(`Profile for user ID ${userId} not found`);
    }

    // Optional: Validate if mentor exists
    const mentor = await this.prisma.mentor.findUnique({
      where: { id: mentorId },
    });
    if (!mentor) {
      throw new NotFoundException(`Mentor with ID ${mentorId} not found`);
    }

    const updatedProfile = await this.prisma.profile.update({
      where: { userId },
      data: { mentorId },
    });

    await this.cacheManager.del(`profile:user:${userId}`);
    return updatedProfile;
  }

  async toggleActive(id: string, currentAdminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.id === currentAdminId) {
      throw new BadRequestException(
        'Anda tidak dapat menonaktifkan akun Anda sendiri',
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: !user.isActive,
        deactivatedAt: user.isActive ? new Date() : null,
      },
    });
  }

  private hasProfileUpdates(dto: UpdateUserDto) {
    return Object.keys(this.getProfileData(dto)).length > 0;
  }

  private getProfileData(dto: UpdateUserDto) {
    const data: {
      fullName?: string;
      nickName?: string;
      nim?: string;
      whatsappNumber?: string;
      fakultas?: Fakultas;
      studyProgramId?: string;
      departmentId?: string;
      divisionId?: string;
      subDivisionId?: string;
      mentorId?: string;
    } = {};

    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.nickName !== undefined) data.nickName = dto.nickName;
    if (dto.nim !== undefined) data.nim = dto.nim;
    if (dto.whatsappNumber !== undefined) {
      data.whatsappNumber = dto.whatsappNumber;
    }
    if (dto.fakultas !== undefined) data.fakultas = dto.fakultas;
    if (dto.studyProgramId !== undefined) {
      data.studyProgramId = dto.studyProgramId;
    }
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.divisionId !== undefined) data.divisionId = dto.divisionId;
    if (dto.subDivisionId !== undefined) {
      data.subDivisionId = dto.subDivisionId;
    }
    if (dto.mentorId !== undefined) data.mentorId = dto.mentorId;

    return data;
  }

  private async validateProfileRelations(
    dto: UpdateUserDto,
    currentProfile: {
      fakultas: Fakultas | null;
      studyProgramId: string | null;
      departmentId: string | null;
      divisionId: string | null;
    } | null,
  ) {
    const nextFakultas = dto.fakultas ?? currentProfile?.fakultas;
    const nextStudyProgramId =
      dto.studyProgramId ?? currentProfile?.studyProgramId;
    const nextDepartmentId = dto.departmentId ?? currentProfile?.departmentId;
    const nextDivisionId = dto.divisionId ?? currentProfile?.divisionId;

    if (nextStudyProgramId) {
      if (!nextFakultas) {
        throw new BadRequestException(
          'Fakultas harus dipilih sebelum program studi',
        );
      }

      const programStudi = await this.prisma.programStudi.findUnique({
        where: { id: nextStudyProgramId },
      });

      if (!programStudi) {
        throw new BadRequestException('Program studi tidak ditemukan');
      }

      if (programStudi.fakultas !== nextFakultas) {
        throw new BadRequestException(
          'Program studi yang dipilih tidak sesuai dengan fakultas',
        );
      }
    }

    if (nextDepartmentId && nextDivisionId) {
      const division = await this.prisma.division.findUnique({
        where: { id: nextDivisionId },
      });

      if (!division || division.departmentId !== nextDepartmentId) {
        throw new BadRequestException(
          'Divisi yang dipilih tidak terdaftar di departemen tersebut',
        );
      }
    }

    if (nextDivisionId && dto.subDivisionId) {
      const subDivision = await this.prisma.subDivision.findUnique({
        where: { id: dto.subDivisionId },
      });

      if (!subDivision || subDivision.divisionId !== nextDivisionId) {
        throw new BadRequestException(
          'Sub-divisi yang dipilih tidak terdaftar di divisi tersebut',
        );
      }
    }

    if (dto.mentorId) {
      const mentor = await this.prisma.mentor.findUnique({
        where: { id: dto.mentorId },
      });

      if (!mentor) {
        throw new NotFoundException(`Mentor with ID ${dto.mentorId} not found`);
      }
    }
  }
}
