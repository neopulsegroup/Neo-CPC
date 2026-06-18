/** Normaliza o e-mail para comparação e registo (único por subscrição). */
export function normalizeRegisterEmail(email: string): string {
  return email.trim().toLowerCase();
}
