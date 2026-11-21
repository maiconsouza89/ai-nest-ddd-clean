import { isHealthRequest } from './ignored-paths';

describe('isHealthRequest', () => {
  it.each(['/health', '/health/live', '/health/ready?verbose=1', '/health?x=1'])('ignora %s', (url) => {
    expect(isHealthRequest(url)).toBe(true);
  });

  it.each(['/health-reports', '/healthy-orders', '/v1/orders', undefined])('não ignora %s', (url) => {
    expect(isHealthRequest(url)).toBe(false);
  });
});
