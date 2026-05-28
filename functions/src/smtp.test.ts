import { describe, expect, it } from 'vitest';

import { buildTransportOptions } from './smtp';

describe('smtp', () => {
  it('buildTransportOptions usa secure=true para ssl', () => {
    const options = buildTransportOptions({
      host: 'smtp.example.com',
      port: 465,
      security: 'ssl',
      username: 'user',
      password: 'pass',
      fromEmail: 'no-reply@example.com',
    });
    expect(options).toMatchObject({ host: 'smtp.example.com', port: 465, secure: true });
  });

  it('buildTransportOptions usa secure=false para tls', () => {
    const options = buildTransportOptions({
      host: 'smtp.example.com',
      port: 587,
      security: 'tls',
      username: 'user',
      password: 'pass',
      fromEmail: 'no-reply@example.com',
    });
    expect(options).toMatchObject({ host: 'smtp.example.com', port: 587, secure: false });
  });
});

