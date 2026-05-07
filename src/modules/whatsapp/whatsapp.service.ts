import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/services/prisma.service';
import { WawayService } from '../../common/services/waway.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wawayService: WawayService,
  ) {}

  async scheduleMessage(message: string, scheduledAt: Date) {
    return this.prisma.scheduledWhatsApp.create({
      data: {
        message,
        scheduledAt,
      },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledMessages() {
    const now = new Date();
    const pendingMessages = await this.prisma.scheduledWhatsApp.findMany({
      where: {
        isSent: false,
        scheduledAt: {
          lte: now,
        },
      },
    });

    if (pendingMessages.length === 0) return;

    this.logger.log(`Found ${pendingMessages.length} scheduled messages to send.`);

    for (const msg of pendingMessages) {
      try {
        await this.sendBulkToAllUsers(msg.message);
        await this.prisma.scheduledWhatsApp.update({
          where: { id: msg.id },
          data: {
            isSent: true,
            sentAt: new Date(),
          },
        });
        this.logger.log(`Scheduled message ${msg.id} sent successfully.`);
      } catch (error) {
        this.logger.error(
          `Failed to send scheduled message ${msg.id}: ${error.message}`,
        );
      }
    }
  }

  async sendBulkToAllUsers(message: string) {
    const profiles = await this.prisma.profile.findMany({
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

    if (profiles.length === 0) {
      return { message: 'No users with WhatsApp numbers found.', count: 0 };
    }

    const contacts = profiles.map((p) => {
      // Clean phone number: remove non-digits and ensure it starts with 62
      let phone = (p.whatsappNumber as string).replace(/\D/g, '');
      if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
      } else if (phone.startsWith('8')) {
        phone = '62' + phone;
      }

      return {
        phone: phone,
        name: p.nickName || p.fullName,
      };
    });

    const result = await this.wawayService.sendBulk(contacts, message);
    return {
      message: 'Bulk messages sent successfully.',
      count: contacts.length,
      wawayResponse: result,
    };
  }
}
