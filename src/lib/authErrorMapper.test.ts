import { describe, expect, it } from 'vitest';
import { mapAuthErrorToMessage } from './authErrorMapper';

const messages: Record<string, string> = {
  'auth.accessDeniedBlockedToast': 'Conta bloqueada',
  'auth.accessDeniedDisabledToast': 'Conta desativada',
  'auth.loginError': 'Email ou palavra-passe incorretos',
  'auth.loginTryAgain': 'Não foi possível entrar',
  'auth.registerErrorGeneric': 'Não foi possível concluir o cadastro',
  'auth.registerErrorEmailInUse': 'Este e-mail já está cadastrado',
  'auth.passwordLengthError': 'A palavra-passe deve ter pelo menos 6 caracteres',
  'auth.networkError': 'Problema de ligação',
  'auth.tooManyAttempts': 'Muitas tentativas',
  'auth.serviceUnavailable': 'Serviço indisponível',
  'common.error': 'Erro',
};

const t = {
  get: (key: string) => messages[key] ?? key,
};

describe('mapAuthErrorToMessage', () => {
  it('não expõe erro técnico de provider no registo', () => {
    const message = mapAuthErrorToMessage({
      error: new Error('Firebase: Error (auth/email-already-in-use).'),
      mode: 'register',
      t,
      secureRegistrationMessage: true,
    });

    expect(message).toBe('Não foi possível concluir o cadastro');
    expect(message.toLowerCase()).not.toContain('firebase');
    expect(message.toLowerCase()).not.toContain('auth/');
  });

  it('mapeia credenciais inválidas para mensagem amigável', () => {
    const message = mapAuthErrorToMessage({
      error: new Error('INVALID_CREDENTIALS'),
      mode: 'login',
      t,
    });

    expect(message).toBe('Email ou palavra-passe incorretos');
  });

  it('fallback de login nunca retorna mensagem técnica', () => {
    const message = mapAuthErrorToMessage({
      error: new Error('Firebase: Error (auth/internal-error).'),
      mode: 'login',
      t,
    });

    expect(message).toBe('Não foi possível entrar');
  });

  it('mapeia falha de validação de registo para mensagem genérica', () => {
    const message = mapAuthErrorToMessage({
      error: new Error('VALIDATION_FAILED'),
      mode: 'register',
      t,
    });

    expect(message).toBe('Não foi possível concluir o cadastro');
  });
});

