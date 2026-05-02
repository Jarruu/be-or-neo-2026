import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendBulkWhatsAppDto {
  @ApiProperty({
    example: 'Halo {{name}}, terima kasih!',
    description: 'The message template to send. Use {{name}} as placeholder for nickName.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
