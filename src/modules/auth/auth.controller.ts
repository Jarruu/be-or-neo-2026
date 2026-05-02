import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ApiJwtAuth } from '../../common/swagger/decorators/api-jwt-auth.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (Email or NIM already exists).',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Returns a JWT for any valid account, including deactivated users. Deactivated users keep access to the snapshot of data they had when the account was deactivated.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged in. Deactivated accounts are allowed.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (Invalid credentials).',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiJwtAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({
    summary: 'Get current authenticated user',
    description:
      'Returns the currently authenticated user regardless of active status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Return current authenticated user details.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProfile(@GetUser('id') userId: string) {
    return this.authService.validateUser(userId);
  }

  @ApiJwtAuth()
  @UseGuards(JwtAuthGuard)
  @Get('file-token')
  @ApiOperation({
    summary: 'Get a short-lived token for file preview/download',
    description:
      'Generates a temporary JWT (valid for 60 seconds) that can be used in query parameters to access files without leaking the main session token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Return a short-lived file access token.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getFileToken(
    @GetUser() user: { id: string; email: string; role: string },
  ) {
    return this.authService.generateFileToken(user);
  }
}
