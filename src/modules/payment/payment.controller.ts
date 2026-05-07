import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Param,
  Patch,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../../prisma/generated-client/client';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UploadProofDto } from './dto/upload-proof.dto';
import { ReviewPaymentDto } from './dto/review-payment.dto';
import { ApiJwtAuth } from '../../common/swagger/decorators/api-jwt-auth.decorator';
import { ApiMultipartFormData } from '../../common/swagger/decorators/api-multipart-form-data.decorator';
import { ApiUuidParam } from '../../common/swagger/decorators/api-uuid-param.decorator';

@ApiTags('Payment')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiJwtAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('upload-proof')
  @ApiOperation({ summary: 'User: Upload payment proof' })
  @ApiMultipartFormData({ type: UploadProofDto })
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({ status: 201, description: 'Proof uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  uploadProof(
    @GetUser('id') userId: string,
    @Body() dto: UploadProofDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.paymentService.uploadProof(userId, dto.amount, file);
  }

  @Get('my-payment')
  @ApiOperation({ summary: 'User: Get my payment status' })
  getMyPayment(@GetUser('id') userId: string) {
    return this.paymentService.getMyPayment(userId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Get all payments' })
  findAll() {
    return this.paymentService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Get payment detail' })
  @ApiUuidParam('id', 'The payment record UUID')
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Review payment proof' })
  @ApiUuidParam('id', 'The payment record UUID')
  review(
    @GetUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: ReviewPaymentDto,
  ) {
    return this.paymentService.reviewPayment(adminId, id, dto);
  }
}
