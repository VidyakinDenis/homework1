import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { UserCreateDto } from './dto/user-create.schema.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UsersListDto } from './dto/user-params.schema.js';
import { UserPatchDto } from './dto/user-patch.schema.js';
import { Public } from '../auth/guards/public.decorator.js';
import type { AuthRequest } from '../auth/types/auth-request.js';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/my')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  @ApiOperation({
    summary: 'Получить своего пользователя',
    description: 'Возвращает вашего пользователя',
  })
  async getMyProfile(@Req() req: AuthRequest) {
    const user = await this.userService.getUserById(req.user.id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Get('/:id')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  @ApiParam({ name: 'id', required: true, type: Number })
  @ApiOperation({ summary: 'Получить пользователя', description: 'Возвращает пользователя' })
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.getUserById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Get('/')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Получить всех пользователей',
    description: 'Возвращает страницу активных пользователей с необязательным поиском по логину',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({ name: 'login', required: false, example: 'anna_login' })
  async getAllUsers(@Query() { page, pageSize, login }: UsersListDto) {
    return await this.userService.getAllUsers(page, pageSize, login);
  }

  @Post('/create')
  @Public()
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiOperation({ summary: 'Создать пользователя', description: 'Создаёт пользователя' })
  async createUser(@Body() body: UserCreateDto) {
    return await this.userService.createUser(body);
  }

  @Patch('/:id')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  @ApiParam({ name: 'id', required: true, type: Number })
  @ApiOperation({
    summary: 'Изменить пользователя',
    description: 'Изменяет данные своего пользователя',
  })
  async patchUser(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UserPatchDto,
  ) {
    if (req.user.id !== id) throw new ForbiddenException("You can't patch this user");
    return await this.userService.patchUser(body, id);
  }

  @Delete('/:id')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  @ApiParam({ name: 'id', required: true, type: Number })
  @ApiOperation({ summary: 'Удалить пользователя', description: 'Удаляет свой аккаунт' })
  async deleteUserById(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    if (req.user.id !== id) throw new ForbiddenException("You can't delete this user");
    return await this.userService.deleteUserById(id);
  }
}
