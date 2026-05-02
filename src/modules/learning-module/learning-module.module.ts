import { Module } from '@nestjs/common';
import { LearningModuleService } from './learning-module.service';
import { LearningModuleController } from './learning-module.controller';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [LearningModuleController],
  providers: [LearningModuleService],
  exports: [LearningModuleService],
})
export class LearningModuleModule {}
