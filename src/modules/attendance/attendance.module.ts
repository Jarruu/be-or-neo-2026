import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { GoogleSheetsService } from '../../common/services/google-sheets.service';

@Module({
  providers: [AttendanceService, GoogleSheetsService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}
