import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

/** `INestApplication` sem o parâmetro devolve `getHttpServer(): any`, e o supertest recebe um `any`. */
export type TestApp = INestApplication<Server>;
