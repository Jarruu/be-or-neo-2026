import { ApiProperty } from '@nestjs/swagger';

export class WawayResponseDto {
  @ApiProperty({ example: true })
  status: boolean;

  @ApiProperty({ example: 'Bulk message queued' })
  message: string;

  @ApiProperty({ required: false })
  data?: any;
}

export class WhatsAppBulkSendResponseDto {
  @ApiProperty({ example: 'Bulk messages sent successfully.' })
  message: string;

  @ApiProperty({ example: 3, description: 'Total number of contacts processed' })
  count: number;

  @ApiProperty({ type: WawayResponseDto })
  wawayResponse: WawayResponseDto;
}
