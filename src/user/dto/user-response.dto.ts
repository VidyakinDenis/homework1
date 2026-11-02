import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'Anna' }) name: string;
  @ApiProperty({ example: 'anna_login' }) login: string;
  @ApiProperty({ example: 'anna@example.com', nullable: true }) email: string | null;
  @ApiProperty({ example: 25, nullable: true }) age: number | null;
  @ApiProperty({ example: 'Люблю читать', nullable: true }) description: string | null;
}
