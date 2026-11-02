import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { UserCreateDto } from '../user/dto/user-create.schema.js';
import { UserLoginDto } from './dto/userLogin.schema.js';
import { RefreshTokenDto, TokensPairDto } from './dto/tokens.schema.js';
import { TokensHelper } from './helpers/tokens-helper.js';
import type { Request, Response } from 'express';
import { Public } from './guards/public.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieHelper: TokensHelper,
  ) {}

  @Post('/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokensPairDto })
  @ApiOperation({
    summary: 'Получить токены',
    description: 'Возвращает пару токенов',
  })
  async login(@Body() body: UserLoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(body);
    this.cookieHelper.set(res, tokens.refreshToken, tokens.refreshExpiresAt);
    return tokens.accessToken;
  }

  @Post('/registration')
  @Public()
  @ApiCreatedResponse({ type: TokensPairDto })
  @ApiOperation({
    summary: 'Зарегистрировать пользователя',
    description: 'Возвращает пару токенов',
  })
  async registration(@Body() body: UserCreateDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.registration(body);
    this.cookieHelper.set(res, tokens.refreshToken, tokens.refreshExpiresAt);
    return tokens.accessToken;
  }

  @Post('/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Токен отозван' })
  @ApiOperation({
    summary: 'Деавторизировать пользователя',
    description: 'Отзывает рефреш-токен',
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.cookieHelper.read(req);
    if (token) await this.authService.logout(token);
    this.cookieHelper.clear(res);
  }

  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokensPairDto })
  @ApiOperation({
    summary: 'Обновить токены',
    description: 'Возвращает пару токенов и отзывает полученный рефреш',
  })
  @Public()
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = this.cookieHelper.read(req);
    if (!refreshToken) throw new UnauthorizedException('Refresh token is missing');
    try {
      const tokens = await this.authService.refresh(refreshToken);
      this.cookieHelper.set(res, tokens.refreshToken, tokens.refreshExpiresAt);
      return tokens.accessToken;
    } catch (err) {
      this.cookieHelper.clear(res);
      throw err;
    }
  }
}
