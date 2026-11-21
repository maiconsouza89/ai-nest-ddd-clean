import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Health (e2e)', () => {
  let app: INestApplication;
  let dbUp = true;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue({
        pingCheck: async (key: string) => {
          return { [key]: { status: dbUp ? 'up' : 'down' } };
        },
      })
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('live e ready respondem 200 sem token e sem prefixo de versão', async () => {
    dbUp = true;
    await request(app.getHttpServer()).get('/health/live').expect(200);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
  });

  it('com o banco indisponível, ready falha e live continua respondendo', async () => {
    dbUp = false;
    await request(app.getHttpServer()).get('/health/ready').expect(503);
    await request(app.getHttpServer()).get('/health/live').expect(200);
  });
});
