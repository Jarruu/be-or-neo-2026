import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { UserRole } from '../../../prisma/generated-client/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

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
      throw new BadRequestException('Anda tidak dapat menghapus akun Anda sendiri');
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
      throw new BadRequestException('Anda tidak dapat menonaktifkan akun Anda sendiri');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: !user.isActive,
        deactivatedAt: user.isActive ? new Date() : null,
      },
    });
  }
}
