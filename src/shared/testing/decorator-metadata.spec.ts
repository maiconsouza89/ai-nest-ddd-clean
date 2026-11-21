import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

@Injectable()
class Dependency {
  value = 'ok';
}

@Injectable()
class Consumer {
  constructor(readonly dependency: Dependency) {}
}

// Prova que o transformador emite a decorator metadata: sem `@Inject`, o Nest só injeta por classe com ela.
describe('decorator metadata', () => {
  it('injeta uma dependência por classe', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [Dependency, Consumer],
    }).compile();

    expect(moduleRef.get(Consumer).dependency.value).toBe('ok');
  });
});
