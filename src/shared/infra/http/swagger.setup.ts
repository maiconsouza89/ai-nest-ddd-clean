import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ProblemDetailsResponse, problemContent } from './problem-details.response.js';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('AI NestJS DDD/Clean')
    .setDescription('API em NestJS: monólito modular com DDD e Clean Architecture.')
    .setVersion('1')
    .addBearerAuth()
    // respostas que qualquer operação pode dar: o rate limit global e o erro inesperado
    .addGlobalResponse(
      {
        status: 429,
        description: 'TOO_MANY_REQUESTS: passou do limite de requisições.',
        content: problemContent,
      },
      { status: 500, description: 'INTERNAL_ERROR: erro inesperado.', content: problemContent },
    )
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ProblemDetailsResponse],
  });
  SwaggerModule.setup('docs', app, document);
  return document;
}
