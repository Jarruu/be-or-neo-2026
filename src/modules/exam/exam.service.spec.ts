/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ExamService } from './exam.service';
import { PrismaService } from '../../common/services/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AttemptStatus } from '../../../prisma/generated-client/client';

describe('ExamService', () => {
  let service: ExamService;
  let prisma: PrismaService;

  const mockPrismaService = {
    exam: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    question: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    payment: { findFirst: jest.fn() },
    examAttempt: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    examAnswer: { create: jest.fn() },
    profile: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ExamService>(ExamService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startAttempt', () => {
    const examId = 'exam-1';
    const userId = 'user-1';

    it('should throw Forbidden if registration not paid', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({ id: examId });
      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      await expect(service.startAttempt(examId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return existing active attempt if found', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({ id: examId });
      mockPrismaService.payment.findFirst.mockResolvedValue({ status: 'PAID' });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue({
        id: 'active-1',
        status: 'IN_PROGRESS',
      });

      const result = await service.startAttempt(examId, userId);
      expect(result.id).toBe('active-1');
    });

    it('should create new attempt if valid', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({
        id: examId,
        maxAttempts: 1,
      });
      mockPrismaService.payment.findFirst.mockResolvedValue({ status: 'PAID' });
      mockPrismaService.examAttempt.findFirst.mockResolvedValue(null);
      mockPrismaService.examAttempt.count.mockResolvedValue(0);
      mockPrismaService.question.count.mockResolvedValue(5);
      mockPrismaService.examAttempt.create.mockResolvedValue({ id: 'new-1' });

      const result = await service.startAttempt(examId, userId);
      expect(result.id).toBe('new-1');
    });
  });

  describe('submitAttempt', () => {
    const attemptId = 'att-1';
    const userId = 'user-1';

    it('should correctly calculate score for MCQ and Short Text', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        id: attemptId,
        userId,
        status: AttemptStatus.IN_PROGRESS,
        exam: {
          questions: [
            {
              id: 'q1',
              type: 'MCQ',
              choices: [
                { id: 'c1', isCorrect: true },
                { id: 'c2', isCorrect: false },
              ],
            },
            { id: 'q2', type: 'SHORT_TEXT', correctTextAnswer: 'NestJS' },
          ],
        },
      });

      mockPrismaService.examAnswer.create.mockResolvedValue({});
      mockPrismaService.examAttempt.update.mockResolvedValue({ score: 100 });

      const dto = {
        answers: [
          { questionId: 'q1', chosenChoiceId: 'c1' },
          { questionId: 'q2', textAnswer: 'nestjs' }, // case insensitive
        ],
      };

      const result = await service.submitAttempt(attemptId, userId, dto);
      expect(prisma.examAttempt.update).toHaveBeenCalledWith({
        where: { id: attemptId },
        data: expect.objectContaining({
          correctCount: 2,
          wrongCount: 0,
          score: 100,
          status: 'SUBMITTED',
        }),
      });
    });
  });
});
