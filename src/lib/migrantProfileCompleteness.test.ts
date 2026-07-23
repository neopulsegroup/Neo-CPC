import { describe, expect, it } from 'vitest';
import {
  getMissingMigrantPersonalInfoFields,
  isMigrantPersonalInfoComplete,
} from './migrantProfileCompleteness';

const completePersonal = {
  name: 'Ana Silva',
  phone: '+351912345678',
  birthDate: '1990-05-12',
  nationality: 'Brasileira',
  address: 'Rua das Flores 123',
  addressNumber: '10',
  cep: '8000-123',
  region: 'Algarve',
};

describe('isMigrantPersonalInfoComplete', () => {
  it('é false quando o perfil está vazio', () => {
    expect(isMigrantPersonalInfoComplete(null)).toBe(false);
    expect(getMissingMigrantPersonalInfoFields(null).length).toBeGreaterThan(0);
  });

  it('é true com todos os campos pessoais válidos', () => {
    expect(isMigrantPersonalInfoComplete(completePersonal)).toBe(true);
    expect(getMissingMigrantPersonalInfoFields(completePersonal)).toEqual([]);
  });

  it('exige regionOther quando a região é Outra', () => {
    expect(
      isMigrantPersonalInfoComplete({
        ...completePersonal,
        region: 'Outra',
        regionOther: '',
      })
    ).toBe(false);
    expect(
      isMigrantPersonalInfoComplete({
        ...completePersonal,
        region: 'Outra',
        regionOther: 'Madeira',
      })
    ).toBe(true);
  });

  it('aceita fallbacks de auth para nome e telefone', () => {
    expect(
      isMigrantPersonalInfoComplete(
        { ...completePersonal, name: null, phone: null },
        { authName: 'Ana', authPhone: '912345678' }
      )
    ).toBe(true);
  });
});
