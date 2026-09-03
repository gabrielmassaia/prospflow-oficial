const MESSAGES_BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou senha inválidos",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com este email",
  USER_ALREADY_EXISTS: "Já existe uma conta com este email",
  INVALID_EMAIL: "Email inválido",
  PASSWORD_TOO_SHORT: "Senha muito curta",
  PASSWORD_TOO_LONG: "Senha muito longa",
};

export function translateAuthError(
  err: { code?: string; message?: string } | undefined,
  fallback: string
): string {
  if (!err?.code) return fallback;
  return MESSAGES_BY_CODE[err.code] ?? fallback;
}
