import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello, Welcome to Open Recruitment Neo Telemetri 2026 API';
  }
}
