import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { SubmitExamDto } from './dto/user-exam.dto';
import {
  AttemptStatus,
  ExamType,
} from '../../../prisma/generated-client/client';

@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.exam.findMany({
      include: {
        subDivision: true,
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            choices: {
              orderBy: { orderIndex: 'asc' },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  async create(dto: CreateExamDto) {
    const { questions, ...examData } = dto;

    return this.prisma.exam.create({
      data: {
        ...examData,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        questions: questions
          ? {
              create: questions.map((q) => ({
                type: q.type,
                prompt: q.prompt,
                correctTextAnswer: q.correctTextAnswer,
                points: q.points,
                orderIndex: q.orderIndex,
                choices: q.choices
                  ? {
                      create: q.choices.map((c) => ({
                        label: c.label,
                        isCorrect: c.isCorrect,
                        orderIndex: c.orderIndex,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: {
        questions: {
          include: {
            choices: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateExamDto) {
    await this.findOne(id);

    return this.prisma.exam.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        maxAttempts: dto.maxAttempts,
        isActive: dto.isActive,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.exam.delete({
      where: { id },
    });
  }

  // Question Management
  async addQuestion(
    examId: string,
    dto: {
      type: ExamType;
      prompt: string;
      correctTextAnswer?: string;
      points?: number;
      orderIndex?: number;
      choices?: Array<{
        label: string;
        isCorrect: boolean;
        orderIndex?: number;
      }>;
    },
  ) {
    await this.findOne(examId);
    return this.prisma.question.create({
      data: {
        type: dto.type,
        prompt: dto.prompt,
        correctTextAnswer: dto.correctTextAnswer,
        points: dto.points ?? 0,
        orderIndex: dto.orderIndex ?? 0,
        examId,
        choices: dto.choices
          ? {
              create: dto.choices.map((c) => ({
                label: c.label,
                isCorrect: c.isCorrect,
                orderIndex: c.orderIndex ?? 0,
              })),
            }
          : undefined,
      },
      include: { choices: true },
    });
  }

  async deleteQuestion(id: string) {
    return this.prisma.question.delete({
      where: { id },
    });
  }

  // --- User Exam Logic ---

  async findAvailableExams(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { subDivisionId: true },
    });

    if (!profile?.subDivisionId) return [];

    return this.prisma.exam.findMany({
      where: {
        subDivisionId: profile.subDivisionId,
        isActive: true,
      },
      include: {
        attempts: {
          where: { userId },
        },
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async startAttempt(examId: string, userId: string) {
    const exam = await this.findOne(examId);

    // Check payment status first
    const payment = await this.prisma.payment.findFirst({
      where: { userId, status: 'APPROVED' },
    });

    if (!payment) {
      throw new ForbiddenException(
        'You must complete the registration payment before starting the exam.',
      );
    }

    // Check if user already has an active attempt
    const activeAttempt = await this.prisma.examAttempt.findFirst({
      where: { userId, examId, status: AttemptStatus.IN_PROGRESS },
    });
    if (activeAttempt) return activeAttempt;

    // Check attempt limits
    const finishedAttempts = await this.prisma.examAttempt.count({
      where: { userId, examId, status: { not: AttemptStatus.IN_PROGRESS } },
    });

    if (exam.maxAttempts && finishedAttempts >= exam.maxAttempts) {
      throw new ForbiddenException('Maximum attempt reached for this exam');
    }

    return this.prisma.examAttempt.create({
      data: {
        userId,
        examId,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
        totalQuestions: await this.prisma.question.count({ where: { examId } }),
      },
    });
  }

  async submitAttempt(attemptId: string, userId: string, dto: SubmitExamDto) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { questions: { include: { choices: true } } } },
      },
    });

    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException('Exam attempt not found');
    }

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Exam already submitted');
    }

    // Logic: Submit all answers
    const questions = attempt.exam.questions;
    let correctCount = 0;

    // Process answers and calculate score
    await Promise.all(
      dto.answers.map(async (answer) => {
        const question = questions.find((q) => q.id === answer.questionId);
        if (!question) return;

        let isCorrect = false;
        if (question.type === 'MCQ' && answer.chosenChoiceId) {
          const choice = question.choices.find(
            (c) => c.id === answer.chosenChoiceId,
          );
          if (choice?.isCorrect) {
            isCorrect = true;
            correctCount++;
          }
        } else if (question.type === 'SHORT_TEXT' && answer.textAnswer) {
          if (
            question.correctTextAnswer?.toLowerCase() ===
            answer.textAnswer.toLowerCase()
          ) {
            isCorrect = true;
            correctCount++;
          }
        }

        return this.prisma.examAnswer.create({
          data: {
            attemptId,
            questionId: answer.questionId,
            chosenChoiceId: answer.chosenChoiceId,
            textAnswer: answer.textAnswer,
            isCorrect,
          },
        });
      }),
    );

    const totalQuestions = questions.length;
    const score =
      totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.SUBMITTED,
        finishedAt: new Date(),
        correctCount,
        wrongCount: totalQuestions - correctCount,
        score,
      },
    });
  }

  async hasCompletedExam(userId: string) {
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { userId, status: AttemptStatus.SUBMITTED },
    });
    return !!attempt;
  }
  
  async getAllAttempts() {
    return this.prisma.examAttempt.findMany({
      where: {
        status: 'SUBMITTED',
      },
      include: {
        user: {
          include: {
            profile: {
              include: {
                subDivision: {
                  include: {
                    division: true,
                  },
                },
              },
            },
          },
        },
        exam: {
          include: {
            subDivision: {
              include: {
                division: true,
              },
            },
          },
        },
      },
      orderBy: { finishedAt: 'desc' },
    });
  }
}
