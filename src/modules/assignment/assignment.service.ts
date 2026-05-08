import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CloudinaryStorageService } from '../../common/services/storage/cloudinary-storage.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ScoreSubmissionDto } from './dto/score-submission.dto';
import {
  AttemptStatus,
  UserRole,
} from '../../../prisma/generated-client/client';
import { GoogleSheetsService } from '../../common/services/google-sheets.service';

@Injectable()
export class AssignmentService {
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
    private readonly googleSheetsService: GoogleSheetsService,
  ) {}

  // --- Assignment Management (Admin) ---

  async create(
    dto: CreateAssignmentDto,
    adminId: string,
    file?: Express.Multer.File,
  ) {
    let fileUrl: string | null = null;
    if (file) {
      fileUrl = await this.storage.uploadFile(file, 'assignment-tasks');
    }

    return this.prisma.assignment.create({
      data: {
        title: dto.title,
        description: dto.description,
        subDivisionId: dto.subDivisionId,
        fileUrl,
        dueAt: new Date(dto.dueAt),
        createdByAdminId: adminId,
      },
    });
  }

  async findAll() {
    return this.prisma.assignment.findMany({
      include: {
        subDivision: true,
        _count: { select: { submissions: true } },
      },
      orderBy: { dueAt: 'asc' },
    });
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
        'You must complete and submit your exam before accessing assignments.',
      );
    }

    return this.prisma.assignment.findMany({
      where: {
        subDivisionId: profile.subDivisionId,
        ...(frozenAt ? { createdAt: { lte: frozenAt } } : {}),
      },
      include: {
        submissions: {
          where: { userId },
          select: {
            id: true,
            submittedAt: true,
            score: true,
            feedback: true,
            fileUrl: true,
            textContent: true,
          },
        },
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  async findBySubDivision(subDivisionId: string, userId: string) {
    return this.prisma.assignment.findMany({
      where: { subDivisionId },
      include: {
        submissions: {
          where: { userId },
          select: {
            id: true,
            submittedAt: true,
            score: true,
            feedback: true,
            fileUrl: true,
            textContent: true,
          },
        },
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: { subDivision: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  async findOneForUser(id: string, userId: string, role: UserRole) {
    const assignment = await this.findOne(id);
    const frozenAt = await this.getUserFrozenAt(userId);
    await this.assertUserCanAccessAssignment(assignment, userId, role, frozenAt);
    return assignment;
  }

  async download(id: string, userId: string, role: UserRole) {
    const assignment = await this.findOneForUser(id, userId, role);

    if (!assignment.fileUrl) {
      throw new NotFoundException('Assignment file not found');
    }

    const { buffer, contentType } = await this.storage.downloadFile(
      assignment.fileUrl,
    );

    return {
      buffer,
      contentType:
        contentType || this.getContentTypeFromUrl(assignment.fileUrl),
      filename: this.buildDownloadFilename(
        assignment.title,
        assignment.fileUrl,
        contentType,
      ),
    };
  }

  async update(id: string, dto: UpdateAssignmentDto, file?: Express.Multer.File) {
    const assignment = await this.findOne(id);

    let fileUrl = assignment.fileUrl;
    if (file) {
      fileUrl = await this.storage.uploadFile(file, 'assignment-tasks');
    }

    return this.prisma.assignment.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        subDivisionId: dto.subDivisionId,
        fileUrl,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.assignment.delete({
      where: { id },
    });
  }

  // --- Submissions (User & Admin) ---

  async submit(
    assignmentId: string,
    userId: string,
    file?: Express.Multer.File,
    textContent?: string,
  ) {
    const assignment = await this.findOneForUser(
      assignmentId,
      userId,
      UserRole.USER,
    );

    const normalizedText = textContent?.trim();
    if (!file && !normalizedText) {
      throw new BadRequestException(
        'At least one of file or text content must be provided.',
      );
    }

    // Check if duplicate submission, or just update? Let's say we update/resubmit.
    const existing = await this.prisma.assignmentSubmission.findFirst({
      where: { assignmentId, userId },
    });

    const fileUrl = file
      ? await this.storage.uploadFile(file, 'assignments')
      : null;

    if (existing) {
      const updateData: {
        submittedAt: Date;
        fileUrl?: string;
        textContent?: string;
      } = {
        submittedAt: new Date(),
      };

      if (fileUrl) {
        updateData.fileUrl = fileUrl;
      }

      if (normalizedText !== undefined) {
        updateData.textContent = normalizedText;
      }

      return this.prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    return this.prisma.assignmentSubmission.create({
      data: {
        assignmentId: assignment.id,
        userId,
        fileUrl,
        textContent: normalizedText ?? null,
        submittedAt: new Date(),
      },
    });
  }

  async getSubmissions(assignmentId: string) {
    return this.prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: {
        user: {
          select: {
            profile: { select: { fullName: true, nim: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async scoreSubmission(submissionId: string, dto: ScoreSubmissionDto) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        user: {
          include: {
            profile: {
              include: {
                division: true,
                subDivision: { include: { division: true } },
              },
            },
          },
        },
        assignment: true,
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const result = await this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: dto.score,
        feedback: dto.feedback,
      },
    });

    // Sinkronisasi ke Google Sheets secara otomatis untuk SELURUH nilai pada assignment & divisi ini
    const profile = submission.user.profile as any;
    const divisionId = profile?.divisionId || profile?.subDivision?.divisionId;
    const divisionName = profile?.division?.name || profile?.subDivision?.division?.name;

    if (divisionId && divisionName) {
      await this.syncAssignmentToSheets(
        submission.assignmentId,
        divisionId,
        divisionName,
        submission.assignment.title,
      );
    }

    return result;
  }

  /**
   * Mengirimkan seluruh nilai tugas dalam satu divisi ke Google Sheets.
   * Ini memastikan data lama dan baru sinkron sepenuhnya.
   */
  private async syncAssignmentToSheets(
    assignmentId: string,
    divisionId: string,
    divisionName: string,
    assignmentTitle: string,
  ) {
    const spreadsheetId = process.env.ASSIGNMENT_SPREADSHEET_ID;
    if (!spreadsheetId) return;

    try {
      // 1. Cari semua ID Assignment yang memiliki judul sama dalam divisi ini
      // Karena Assignment bisa dibuat per sub-divisi, kita harus mengumpulkan semuanya
      const relatedAssignments = await this.prisma.assignment.findMany({
        where: {
          title: assignmentTitle,
          subDivision: { divisionId: divisionId },
        },
        select: { id: true },
      });
      const assignmentIds = relatedAssignments.map((a) => a.id);

      // 2. Ambil seluruh user yang berada di divisi ini (baik langsung maupun via sub-divisi)
      const approvedUsersInDivision = await this.prisma.user.findMany({
        where: {
          submissionVerifications: { some: { status: 'APPROVED' } },
          role: 'USER',
          isActive: true,
          profile: {
            OR: [
              { divisionId: divisionId },
              { subDivision: { divisionId: divisionId } },
            ],
          },
        },
        include: {
          profile: { include: { division: true, subDivision: true } },
          assignmentSubmissions: {
            where: { assignmentId: { in: assignmentIds } },
          },
        },
      });

      const records = approvedUsersInDivision
        .filter((u) => u.profile)
        .map((u) => {
          // Cari submission yang memiliki skor (jika ada beberapa)
          const submission = u.assignmentSubmissions.find((s) => s.score !== null) || u.assignmentSubmissions[0];
          
          return {
            nim: u.profile!.nim,
            fullName: u.profile!.fullName,
            divisionName: (u.profile as any).division?.name || '-',
            subDivisionName: (u.profile as any).subDivision?.name || '-',
            score: (submission && submission.score !== null && submission.score !== undefined) 
              ? Number(submission.score) 
              : 0,
          };
        });

      if (records.length > 0) {
        await this.googleSheetsService.batchUpdateAssignmentScores(
          spreadsheetId,
          divisionName,
          assignmentTitle,
          records,
        );
      }
    } catch (error) {
      // Log error but proceed
    }
  }

  async downloadSubmission(submissionId: string, userId: string, role: UserRole) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: true,
        user: {
          select: {
            profile: { select: { fullName: true } },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Authorization check
    if (role !== UserRole.ADMIN && submission.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this submission.',
      );
    }

    if (!submission.fileUrl) {
      throw new NotFoundException('Submission file not found');
    }

    const { buffer, contentType } = await this.storage.downloadFile(
      submission.fileUrl,
    );

    const userName = submission.user.profile?.fullName || 'User';
    const assignmentTitle = submission.assignment.title;
    const filename = this.buildDownloadFilename(
      `${assignmentTitle}-${userName}`,
      submission.fileUrl,
      contentType,
    );

    return {
      buffer,
      contentType: contentType || this.getContentTypeFromUrl(submission.fileUrl),
      filename,
    };
  }

  private async assertUserCanAccessAssignment(
    assignment: { subDivisionId: string; createdAt: Date },
    userId: string,
    role: UserRole,
    frozenAt?: Date | null,
  ) {
    if (role === UserRole.ADMIN) {
      return;
    }

    if (frozenAt && assignment.createdAt > frozenAt) {
      throw new NotFoundException('Assignment not found');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile?.subDivisionId || profile.subDivisionId !== assignment.subDivisionId) {
      throw new ForbiddenException(
        'You do not have access to this assignment.',
      );
    }

    const examPassed = await this.prisma.examAttempt.findFirst({
      where: { userId, status: AttemptStatus.SUBMITTED },
    });

    if (!examPassed) {
      throw new ForbiddenException(
        'You must complete and submit your exam before accessing assignments.',
      );
    }
  }

  private async getUserFrozenAt(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deactivatedAt: true },
    });

    return user?.deactivatedAt ?? null;
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

    return `${safeTitle || 'assignment-file'}.${extension}`;
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



