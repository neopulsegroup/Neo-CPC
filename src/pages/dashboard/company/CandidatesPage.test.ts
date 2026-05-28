import { describe, expect, it } from 'vitest';
import {
  csvEscape,
  formatCPF,
  formatPhone,
  isValidCPF,
  normalizeCPF,
  normalizeEmail,
  normalizePhone,
  parseSkills,
  stripUnsafeChars,
  toCandidatePayload,
  validateCandidate,
} from './candidatesUtils';

const t = {
  get: (k: string) => k,
};

describe('CandidatesPage helpers', () => {
  it('normaliza e valida CPF', () => {
    expect(normalizeCPF('111.444.777-35')).toBe('11144477735');
    expect(isValidCPF('111.444.777-35')).toBe(true);
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCPF('123')).toBe(false);
  });

  it('formata CPF quando tem 11 dígitos', () => {
    expect(formatCPF('11144477735')).toBe('111.444.777-35');
    expect(formatCPF('123')).toBe('123');
  });

  it('normaliza email e telefone removendo caracteres inválidos', () => {
    expect(normalizeEmail('  TESTE@EXEMPLO.COM ')).toBe('teste@exemplo.com');
    expect(normalizePhone(' +351 (910) 000-001 ')).toBe('+351910000001');
    expect(stripUnsafeChars('a\u0000b\u001Fc')).toBe('abc');
  });

  it('formata telefone com e sem indicativo', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('1234')).toBe('1234');
    expect(formatPhone('910000001')).toBe('910000001');
    expect(formatPhone('+351910000001')).toBe('+35 1910000001');
  });

  it('parseia competências por vírgula, remove duplicados e limita', () => {
    expect(parseSkills('React, Node.js, react, TypeScript,  , Node.js')).toEqual(['React', 'Node.js', 'TypeScript']);
    expect(parseSkills('')).toEqual([]);
  });

  it('valida campos obrigatórios e match', () => {
    const values = {
      name: 'A',
      cpf: '123',
      email: 'invalido',
      phone: '12',
      desired_role: '',
      experience: 'mid' as const,
      skills: '',
      job_offer_id: '',
      match_percent: '200',
      stage: 'triage' as const,
    };
    const errs = validateCandidate(values, t);
    expect(errs.name).toBeTruthy();
    expect(errs.cpf).toBeTruthy();
    expect(errs.email).toBeTruthy();
    expect(errs.phone).toBeTruthy();
    expect(errs.desired_role).toBeTruthy();
    expect(errs.match_percent).toBeTruthy();
  });

  it('monta payload sanitizado para Firestore', () => {
    const values = {
      name: ' João  ',
      cpf: '111.444.777-35',
      email: '  TESTE@EXEMPLO.COM ',
      phone: '+351 (910) 000-001',
      desired_role: 'Frontend',
      experience: 'senior' as const,
      skills: 'React, react, Node.js',
      job_offer_id: 'job1',
      match_percent: '92.2',
      stage: 'interview' as const,
    };
    const payload = toCandidatePayload('company1', values);
    expect(payload.company_id).toBe('company1');
    expect(payload.name).toBe('João');
    expect(payload.cpf).toBe('11144477735');
    expect(payload.email).toBe('teste@exemplo.com');
    expect(payload.phone).toBe('+351910000001');
    expect(payload.skills).toEqual(['React', 'Node.js']);
    expect(payload.match_percent).toBe(92);
  });

  it('clampa match para 0-100 ao gerar payload', () => {
    const values = {
      name: 'João',
      cpf: '111.444.777-35',
      email: 'teste@exemplo.com',
      phone: '+351910000001',
      desired_role: 'Frontend',
      experience: 'mid' as const,
      skills: '',
      job_offer_id: '',
      match_percent: '1000',
      stage: 'triage' as const,
    };
    expect(toCandidatePayload('company1', values).match_percent).toBe(100);
    expect(toCandidatePayload('company1', { ...values, match_percent: 'abc' }).match_percent).toBe(0);
  });

  it('escapa CSV com aspas duplas', () => {
    expect(csvEscape('a"b')).toBe('"a""b"');
  });
});
