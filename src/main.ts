import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import cookieParser from 'cookie-parser';
import appConfig from './config/app.config.js';
import { ConfigType } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());

  const config = new DocumentBuilder()
    .setTitle('Example')
    .setDescription('The users API description')
    .addBearerAuth()
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('/swagger', app, () => SwaggerModule.createDocument(app, config));
  const { port } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  await app.listen(port, () => console.log(`Server start on port ${port}`));
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
