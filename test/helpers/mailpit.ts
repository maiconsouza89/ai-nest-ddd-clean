import { waitFor } from './wait-for.js';

// O Mailpit do docker-compose: os e2e enviam por SMTP de verdade e leem pela API dele.
export const MAILPIT_API = process.env.MAILPIT_API_URL ?? 'http://127.0.0.1:8025';

export type EmailSummary = { id: string; subject: string; from: string };

type Summary = { messages: { ID: string; Subject: string; From: { Address: string } }[] };

// Num worktree, a tag do usuário SMTP dele (`npm run worktree:setup`): o Mailpit é compartilhado entre checkouts.
const TAG = process.env.MAILPIT_TAG;

/** Os e-mails recebidos pelo endereço, do mais recente para o mais antigo, sem o corpo. */
export async function emailsTo(address: string, api = MAILPIT_API): Promise<EmailSummary[]> {
  const search = TAG ? `tag:"${TAG}" to:"${address}"` : `to:"${address}"`;
  const query = encodeURIComponent(search);
  const res = await fetch(`${api}/api/v1/search?query=${query}`);
  if (!res.ok)
    throw new Error(
      `Mailpit respondeu ${res.status}. Ele está no ar? docker compose up -d mailpit`,
    );
  const { messages } = (await res.json()) as Summary;
  return messages.map((m) => ({ id: m.ID, subject: m.Subject, from: m.From.Address }));
}

/** Os e-mails do endereço com o assunto exato. */
export async function emailsWith(address: string, subject: string, api = MAILPIT_API) {
  return (await emailsTo(address, api)).filter((e) => e.subject === subject);
}

/** Espera um e-mail com o assunto chegar ao endereço e devolve o mais recente, com o corpo em texto. */
export async function waitForEmail(address: string, subject: string, api = MAILPIT_API) {
  let latest: EmailSummary | undefined;
  await waitFor(async () => {
    [latest] = await emailsWith(address, subject, api);
    return latest !== undefined;
  });
  const text = await (await fetch(`${api}/view/${latest!.id}.txt`)).text();
  return { ...latest!, text };
}

/** O código do e-mail de verificação mais recente do endereço. */
export async function verificationCodeFor(address: string) {
  const email = await waitForEmail(address, 'Seu código de verificação');
  const code = /\b(\d{6})\b/.exec(email.text)?.[1];
  if (!code) throw new Error(`código não encontrado no e-mail: ${email.text}`);
  return code;
}
