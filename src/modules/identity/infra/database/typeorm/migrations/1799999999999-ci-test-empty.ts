import { MigrationInterface } from "typeorm";

// Teste do CI: migration vazia, para conferir que ela roda todos os testes de integração.
export class CiTestEmpty1799999999999 implements MigrationInterface {
    name = 'CiTestEmpty1799999999999'

    public async up(): Promise<void> {}

    public async down(): Promise<void> {}
}
