import { Module } from '@nestjs/common';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { CommonModule } from '../../common/common.module';
import { ExamUserController } from './exam-user.controller';

@Module({
  imports: [CommonModule],
  controllers: [ExamController, ExamUserController],
  providers: [ExamService],
  exports: [ExamService],
})
export class ExamModule {}
