import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'admin@ix2.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securepassword', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
