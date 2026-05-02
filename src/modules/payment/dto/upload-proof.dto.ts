import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString } from 'class-validator';

export class UploadProofDto {
  @ApiProperty({ description: 'Amount paid', example: '50000' })
  @IsNotEmpty()
  @IsNumberString()
  amount: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Payment proof image (JPG, PNG)',
  })
  file: any;
}
