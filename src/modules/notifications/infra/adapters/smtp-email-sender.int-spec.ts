import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { emailsTo, waitForEmail } from '#test/helpers/mailpit';
import { SmtpEmailSender } from './smtp-email-sender.js';

const MAILPIT_IMAGE = 'axllent/mailpit:v1'; // a mesma do docker-compose.yml

describe('SmtpEmailSender com Mailpit (integração)', () => {
  let mailpit: StartedTestContainer;
  let api: string;
  let smtpUrl: string;

  beforeAll(async () => {
    mailpit = await new GenericContainer(MAILPIT_IMAGE)
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forHttp('/readyz', 8025))
      .start();
    api = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}`;
    smtpUrl = `smtp://${mailpit.getHost()}:${mailpit.getMappedPort(1025)}`;
  }, 120_000);

  afterAll(() => mailpit?.stop());

  it('envia o e-mail com remetente, destinatário, assunto e corpo', async () => {
    const sender = new SmtpEmailSender({ url: smtpUrl, from: 'no-reply@example.com' });

    await sender.send({ to: 'ana@example.com', subject: 'Olá, Ana', body: 'Código: 042137' });

    expect(await emailsTo('ana@example.com', api)).toHaveLength(1);
    const email = await waitForEmail('ana@example.com', 'Olá, Ana', api);
    expect(email.from).toBe('no-reply@example.com');
    expect(email.text.trim()).toBe('Código: 042137');
  });

  it('com o servidor fora do ar, falha dentro do prazo', async () => {
    // uma porta mapeada que já não tem ninguém escutando
    const stopped = await new GenericContainer(MAILPIT_IMAGE).withExposedPorts(1025).start();
    const url = `smtp://${stopped.getHost()}:${stopped.getMappedPort(1025)}`;
    await stopped.stop();
    const sender = new SmtpEmailSender({ url, from: 'no-reply@example.com' });

    const started = Date.now();
    await expect(sender.send({ to: 'ana@example.com', subject: 's', body: 'b' })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(15_000);
  }, 60_000);
});
