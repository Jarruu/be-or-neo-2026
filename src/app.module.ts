import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfileModule } from './modules/profile/profile.module';
import { VerificationModule } from './modules/verification/verification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ExamModule } from './modules/exam/exam.module';
import { LearningModuleModule } from './modules/learning-module/learning-module.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { UserModule } from './modules/user/user.module';
import { MentorModule } from './modules/mentor/mentor.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    ProfileModule,
    VerificationModule,
    DashboardModule,
    TimelineModule,
    PaymentModule,
    AttendanceModule,
    ExamModule,
    LearningModuleModule,
    AssignmentModule,
    MasterDataModule,
    UserModule,
    MentorModule,
    WhatsAppModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
