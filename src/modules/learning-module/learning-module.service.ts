import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../common/services/prisma.service';
import { CloudinaryStorageService } from '../../common/services/storage/cloudinary-storage.service';
import { CreateLearningModuleDto } from './dto/create-learning-module.dto';
import { UpdateLearningModuleDto } from './dto/update-learning-module.dto';
import {
  AttemptStatus,
  UserRole,
} from '../../../prisma/generated-client/client';

@Injectable()
export class LearningModuleService {
  private readonly CACHE_KEY_ALL = 'learning_modules:all';
  private readonly CACHE_KEY_SUBDIVISION = 'learning_modules:subdivision:';
  private readonly contentTypeToExtension: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      'pptx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      'xlsx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CloudinaryStorageService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(
    dto: CreateLearningModuleDto,
    adminId: string,
    file: Express.Multer.File,
  ) {
    const fileUrl = await this.storage.uploadFile(file, 'learning-modules');

    const result = await this.prisma.learningModule.create({
      data: {
        ...dto,
        fileUrl,
        createdByAdminId: adminId,
      },
    });

    await this.clearCache(dto.subDivisionId);
    return result;
  }

  async findAll() {
    const cached = await this.cacheManager.get(this.CACHE_KEY_ALL);
    if (cached) return cached;

    const modules = await this.prisma.learningModule.findMany({
      include: {
        subDivision: true,
        createdByAdmin: {
          select: { profile: { select: { fullName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.cacheManager.set(this.CACHE_KEY_ALL, modules);
    return modules;
  }

  async findByUserId(userId: string) {
    const frozenAt = await this.getUserFrozenAt(userId);
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });
    if (!profile?.subDivisionId) return [];

    // Check if exam is submitted
    const examPassed = await this.prisma.examAttempt.findFirst({
      where: { userId, status: AttemptStatus.SUBMITTED },
    });

    if (!examPassed) {
      throw new ForbiddenException(
        'You must complete and submit your exam before accessing learning modules.',
      );
    }

    return this.findBySubDivision(profile.subDivisionId, frozenAt);
  }

  async findBySubDivision(subDivisionId: string, frozenAt?: Date | null) {
    const cacheKey = this.getSubdivisionCacheKey(subDivisionId, frozenAt);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const modules = await this.prisma.learningModule.findMany({
      where: {
        subDivisionId,
        ...(frozenAt ? { createdAt: { lte: frozenAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.cacheManager.set(cacheKey, modules);
    return modules;
  }

  async findOne(id: string) {
    const module = await this.prisma.learningModule.findUnique({
      where: { id },
      include: { subDivision: true },
    });
    if (!module) throw new NotFoundException('Learning module not found');
    return module;
  }

  async findOneForUser(id: string, userId: string, role: UserRole) {
    const module = await this.findOne(id);
    const frozenAt = await this.getUserFrozenAt(userId);
    await this.assertUserCanAccessModule(module, userId, role, frozenAt);
    return module;
  }

  async download(id: string, userId: string, role: UserRole) {
    const module = await this.findOneForUser(id, userId, role);

    if (!module.fileUrl) {
      throw new NotFoundException('Learning module file not found');
    }

    const { buffer, contentType } = await this.storage.downloadFile(
      module.fileUrl,
    );

    return {
      buffer,
      contentType:
        contentType || this.getContentTypeFromUrl(module.fileUrl),
      filename: this.buildDownloadFilename(module.title, module.fileUrl, contentType),
    };
  }

  async update(
    id: string,
    dto: UpdateLearningModuleDto,
    file?: Express.Multer.File,
  ) {
    const module = await this.findOne(id);
    let fileUrl = module.fileUrl;

    if (file) {
      fileUrl = await this.storage.uploadFile(file, 'learning-modules');
    }

    const result = await this.prisma.learningModule.update({
      where: { id },
      data: {
        ...dto,
        fileUrl,
      },
    });

    await this.clearCache(module.subDivisionId);
    if (dto.subDivisionId && dto.subDivisionId !== module.subDivisionId) {
      await this.clearCache(dto.subDivisionId);
    }

    return result;
  }

  async remove(id: string) {
    const module = await this.findOne(id);
    const result = await this.prisma.learningModule.delete({
      where: { id },
    });

    await this.clearCache(module.subDivisionId);
    return result;
  }

  private async clearCache(subDivisionId?: string) {
    await this.cacheManager.del(this.CACHE_KEY_ALL);
    if (subDivisionId) {
      await this.cacheManager.del(`${this.CACHE_KEY_SUBDIVISION}${subDivisionId}`);
    }
  }

  private async getUserFrozenAt(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deactivatedAt: true },
    });

    return user?.deactivatedAt ?? null;
  }

  private getSubdivisionCacheKey(subDivisionId: string, frozenAt?: Date | null) {
    if (!frozenAt) {
      return `${this.CACHE_KEY_SUBDIVISION}${subDivisionId}`;
    }

    return `${this.CACHE_KEY_SUBDIVISION}${subDivisionId}:frozen:${frozenAt.toISOString()}`;
  }

  private async assertUserCanAccessModule(
    module: { subDivisionId: string; createdAt: Date },
    userId: string,
    role: UserRole,
    frozenAt?: Date | null,
  ) {
    if (role === UserRole.ADMIN) {
      return;
    }

    if (frozenAt && module.createdAt > frozenAt) {
      throw new NotFoundException('Learning module not found');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile?.subDivisionId || profile.subDivisionId !== module.subDivisionId) {
      throw new ForbiddenException(
        'You do not have access to this learning module.',
      );
    }

    const examPassed = await this.prisma.examAttempt.findFirst({
      where: { userId, status: AttemptStatus.SUBMITTED },
    });

    if (!examPassed) {
      throw new ForbiddenException(
        'You must complete and submit your exam before accessing learning modules.',
      );
    }
  }

  private buildDownloadFilename(
    title: string,
    fileUrl: string,
    contentType?: string | null,
  ) {
    const extension =
      this.getExtensionFromUrl(fileUrl) ||
      this.getExtensionFromContentType(contentType) ||
      'bin';

    const safeTitle = title
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .replace(/-+/g, '-');

    return `${safeTitle || 'learning-module'}.${extension}`;
  }

  private getExtensionFromContentType(contentType?: string | null) {
    if (!contentType) {
      return null;
    }

    const normalizedContentType = contentType.split(';')[0].trim().toLowerCase();
    return this.contentTypeToExtension[normalizedContentType] ?? null;
  }

  private getExtensionFromUrl(fileUrl: string) {
    try {
      const pathname = new URL(fileUrl).pathname;
      const lastSegment = pathname.split('/').pop() ?? '';
      const extension = lastSegment.split('.').pop();

      if (!extension || extension === lastSegment) {
        return null;
      }

      return extension.toLowerCase();
    } catch {
      return null;
    }
  }

  private getContentTypeFromUrl(fileUrl: string) {
    const extension = this.getExtensionFromUrl(fileUrl);

    if (!extension) {
      return 'application/octet-stream';
    }

    const matchingEntry = Object.entries(this.contentTypeToExtension).find(
      ([, mappedExtension]) => mappedExtension === extension,
    );

    return matchingEntry?.[0] ?? 'application/octet-stream';
  }
}
