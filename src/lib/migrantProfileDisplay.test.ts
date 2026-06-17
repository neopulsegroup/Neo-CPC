import { describe, expect, it } from 'vitest';

import { resolveMigrantRegisteredName } from './migrantProfileDisplay';

describe('resolveMigrantRegisteredName', () => {
  it('prioriza o nome em profiles sobre users', () => {
    expect(
      resolveMigrantRegisteredName({
        profileDocName: 'Maria Silva',
        userProfileName: 'Maria',
      })
    ).toBe('Maria Silva');
  });

  it('usa users quando profiles não tem nome', () => {
    expect(
      resolveMigrantRegisteredName({
        profileDocName: '',
        userProfileName: 'João Costa',
      })
    ).toBe('João Costa');
  });
});
