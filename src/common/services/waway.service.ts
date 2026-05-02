import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WawayService {
  private readonly logger = new Logger(WawayService.name);
  private readonly apiKey: string;
  private readonly deviceId: string;
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('WAWAY_API_KEY') || '';
    this.deviceId = this.configService.get<string>('WAWAY_DEVICE_ID') || '';
    this.baseUrl = this.configService.get<string>(
      'WAWAY_BASE_URL',
      'https://apiwaway.neotelemetri.id/api',
    );

    if (!this.apiKey || !this.deviceId) {
      this.logger.warn(
        'WAWAY_API_KEY or WAWAY_DEVICE_ID is not set. WhatsApp features may not work.',
      );
    }
  }

  async sendBulk(contacts: { phone: string; name: string }[], message: string) {
    try {
      const url = `${this.baseUrl}/devices/${this.deviceId}/send-bulk`;
      this.logger.log(`Sending bulk WhatsApp to: ${url}`);
      this.logger.debug(`Payload: ${JSON.stringify({ contacts, message })}`);

      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            contacts,
            message,
          },
          {
            headers: {
              'x-api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      this.logger.log(`Waway API Response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      const errorData = error.response?.data;
      this.logger.error(
        `Failed to send bulk WhatsApp messages: ${error.message}. Response: ${JSON.stringify(errorData)}`,
        error.stack,
      );
      throw error;
    }
  }
}
