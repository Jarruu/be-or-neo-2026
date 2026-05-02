/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/services/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password',
      fullName: 'Test User',
      nim: '12345',
    };

    it('should throw ConflictException if email exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: '1' });
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if NIM exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.profile.findUnique.mockResolvedValue({ id: '1' });
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create user and profile in transaction', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.profile.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        email: registerDto.email,
      });

      const result = await service.register(registerDto);
      expect(result.id).toBe('user-1');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password' };

    it('should throw Unauthorized for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw Unauthorized for invalid password', async () => {
      const passwordHash = await bcrypt.hash('different', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        passwordHash,
      });
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return access token if valid', async () => {
      const passwordHash = await bcrypt.hash(loginDto.password, 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        passwordHash,
        role: 'USER',
      });
      mockJwtService.signAsync.mockResolvedValue('token-123');

      const result = await service.login(loginDto);
      expect(result.access_token).toBe('token-123');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should return access token even if user is deactivated', async () => {
      const passwordHash = await bcrypt.hash(loginDto.password, 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        passwordHash,
        role: 'USER',
        isActive: false,
        deactivatedAt: new Date(),
      });
      mockJwtService.signAsync.mockResolvedValue('token-456');

      const result = await service.login(loginDto);
      expect(result.access_token).toBe('token-456');
      expect(result.user.email).toBe(loginDto.email);
    });
  });
});
