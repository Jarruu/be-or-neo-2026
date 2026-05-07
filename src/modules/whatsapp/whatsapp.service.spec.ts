import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../../common/services/prisma.service';
import { WawayService } from '../../common/services/waway.service';

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let prisma: PrismaService;
  let waway: WawayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        {
          provide: PrismaService,
          useValue: {
            profile: {
              findMany: jest.fn(),
            },
            scheduledWhatsApp: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: WawayService,
          useValue: {
            sendBulk: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
    prisma = module.get<PrismaService>(PrismaService);
    waway = module.get<WawayService>(WawayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduleMessage', () => {
    it('should create a scheduled message in database', async () => {
      const mockMsg = 'Test message';
      const mockDate = new Date();
      (prisma.scheduledWhatsApp.create as jest.Mock).mockResolvedValue({ id: '1' });

      await service.scheduleMessage(mockMsg, mockDate);

      expect(prisma.scheduledWhatsApp.create).toHaveBeenCalledWith({
        data: {
          message: mockMsg,
          scheduledAt: mockDate,
        },
      });
    });
  });

  describe('handleScheduledMessages', () => {
    it('should send messages that are due and update their status', async () => {
      const mockScheduledMessages = [
        { id: '1', message: 'Hello 1', scheduledAt: new Date() },
      ];
      (prisma.scheduledWhatsApp.findMany as jest.Mock).mockResolvedValue(
        mockScheduledMessages,
      );
      // Mock profiles for sendBulkToAllUsers which is called inside handleScheduledMessages
      (prisma.profile.findMany as jest.Mock).mockResolvedValue([
        {
          whatsappNumber: '62812',
          nickName: 'User 1',
          fullName: 'Full User 1',
        },
      ]);
      (waway.sendBulk as jest.Mock).mockResolvedValue({ status: 'success' });
      (prisma.scheduledWhatsApp.update as jest.Mock).mockResolvedValue({});

      await service.handleScheduledMessages();

      expect(prisma.scheduledWhatsApp.findMany).toHaveBeenCalled();
      expect(waway.sendBulk).toHaveBeenCalled();
      expect(prisma.scheduledWhatsApp.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ isSent: true }),
      });
    });

    it('should not do anything if no messages are due', async () => {
      (prisma.scheduledWhatsApp.findMany as jest.Mock).mockResolvedValue([]);

      await service.handleScheduledMessages();

      expect(waway.sendBulk).not.toHaveBeenCalled();
    });
  });

  describe('sendBulkToAllUsers', () => {
    it('should send bulk messages to only active users with whatsapp numbers', async () => {
      const mockProfiles = [
        { whatsappNumber: '6281234567890', nickName: 'Budi', fullName: 'Budi Santoso' },
        { whatsappNumber: '6289876543210', nickName: null, fullName: 'Ani' },
      ];
      (prisma.profile.findMany as jest.Mock).mockResolvedValue(mockProfiles);
      (waway.sendBulk as jest.Mock).mockResolvedValue({ status: 'success' });

      const result = await service.sendBulkToAllUsers('Halo {{nama}}');

      expect(prisma.profile.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { whatsappNumber: { not: null } },
            { whatsappNumber: { not: '' } },
            { user: { isActive: true } },
          ],
        },
        select: {
          whatsappNumber: true,
          nickName: true,
          fullName: true,
        },
      });
      expect(waway.sendBulk).toHaveBeenCalledWith(
        [
          { phone: '6281234567890', name: 'Budi' },
          { phone: '6289876543210', name: 'Ani' },
        ],
        'Halo {{nama}}',
      );
      expect(result.count).toBe(2);
    });

    it('should exclude deactivated users from bulk messages', async () => {
      // In this scenario, we mock the database behavior where the query 
      // with { user: { isActive: true } } only returns active users.
      const activeProfiles = [
        { whatsappNumber: '6281111111111', nickName: 'ActiveUser', fullName: 'Active User' },
      ];
      
      // We simulate that a deactivated user exists but is NOT returned by findMany 
      // because of the filter we added.
      (prisma.profile.findMany as jest.Mock).mockResolvedValue(activeProfiles);
      (waway.sendBulk as jest.Mock).mockResolvedValue({ status: 'success' });

      const result = await service.sendBulkToAllUsers('Halo');

      // Verify the query included the isActive: true filter
      expect(prisma.profile.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { user: { isActive: true } }
          ])
        })
      }));

      // Verify only the active user was sent to Waway
      expect(waway.sendBulk).toHaveBeenCalledWith(
        [{ phone: '6281111111111', name: 'ActiveUser' }],
        'Halo'
      );
      expect(result.count).toBe(1);
    });

    it('should return 0 if no profiles found', async () => {
      (prisma.profile.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.sendBulkToAllUsers('Halo');

      expect(result.count).toBe(0);
      expect(waway.sendBulk).not.toHaveBeenCalled();
    });
  });
});
