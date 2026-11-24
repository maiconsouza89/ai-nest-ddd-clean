import { describe, it, expect } from 'vitest';
import {
  MAX_VERIFICATION_ATTEMPTS,
  RESEND_INTERVAL_MS,
  VerificationCode,
} from './verification-code.entity.js';

const MINUTE = 60 * 1000;
const t0 = new Date('2026-01-01T00:00:00.000Z');
const at = (minutes: number) => new Date(t0.getTime() + minutes * MINUTE);

const issue = () =>
  VerificationCode.issue({ id: 'c1', userId: 'u1', codeHash: 'right' }, t0, 10 * MINUTE);

describe('VerificationCode', () => {
  it('nasce sem tentativas, sem uso e com o prazo contado da emissão', () => {
    const code = issue();
    expect(code).toMatchObject({ attempts: 0, usedAt: null, createdAt: t0, expiresAt: at(10) });
  });

  it('aceita o código certo dentro do prazo e marca o uso', () => {
    const code = issue();
    expect(code.verify('right', at(9))).toBe(true);
    expect(code.usedAt).toEqual(at(9));
  });

  it('recusa o código errado e conta a tentativa', () => {
    const code = issue();
    expect(code.verify('wrong', at(1))).toBe(false);
    expect(code.attempts).toBe(1);
    expect(code.usedAt).toBeNull();
  });

  it('a quinta tentativa errada esgota o código, e a sexta é recusada mesmo com o código certo', () => {
    expect(MAX_VERIFICATION_ATTEMPTS).toBe(5);
    const code = issue();
    for (let i = 0; i < 4; i++) code.verify('wrong', at(1));
    expect(code.acceptsAttemptsAt(at(1))).toBe(true);

    expect(code.verify('wrong', at(1))).toBe(false);

    expect(code.attempts).toBe(5);
    expect(code.acceptsAttemptsAt(at(1))).toBe(false);
    expect(code.verify('right', at(1))).toBe(false);
    expect(code.attempts).toBe(5);
    expect(code.usedAt).toBeNull();
  });

  it('recusa o código certo depois do prazo', () => {
    const code = issue();
    expect(code.verify('right', at(10))).toBe(false);
    expect(code.attempts).toBe(0);
  });

  it('só aceita um código novo depois do intervalo mínimo', () => {
    const code = issue();
    expect(code.allowsResendAt(new Date(t0.getTime() + RESEND_INTERVAL_MS - 1))).toBe(false);
    expect(code.allowsResendAt(new Date(t0.getTime() + RESEND_INTERVAL_MS))).toBe(true);
  });

  it('recusa um código já usado', () => {
    const code = issue();
    code.verify('right', at(1));
    expect(code.verify('right', at(2))).toBe(false);
    expect(code.usedAt).toEqual(at(1));
  });
});
