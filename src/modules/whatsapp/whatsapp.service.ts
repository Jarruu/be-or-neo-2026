import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { WawayService } from '../../common/services/waway.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wawayService: WawayService,
  ) {}

  async sendBulkToAllUsers(message: string) {
    const profiles = await this.prisma.profile.findMany({
      where: {
        AND: [
          { whatsappNumber: { not: null } },
          { whatsappNumber: { not: '' } },
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
