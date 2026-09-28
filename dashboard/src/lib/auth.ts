/**
 * Retorna true se o e-mail estiver explicitamente configurado na variável de ambiente ALLOWED_EMAILS.
 * Opera em modo fail-closed: se a variável estiver ausente ou vazia, o acesso é negado.
 */
export function isEmailAllowed(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.ALLOWED_EMAILS || "";
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return false;

  return allowed.includes(email.trim().toLowerCase());
}

/**
 * Mascara um endereço de e-mail para logs de auditoria (ex: "u***r@example.com").
 */
export function maskEmail(email?: string | null): string {
  if (!email) return "desconhecido";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const [local, domain] = parts;
  const maskedLocal =
    local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : "***";
  return `${maskedLocal}@${domain}`;
}

/**
 * Valida caminhos relativos internos para redirecionamentos seguros,
 * evitando vulnerabilidades de open redirect.
 */
export function getSafeRedirectUrl(next: string | null | undefined): string {
  if (!next) return "/";
  if (
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\") &&
    !next.includes("@")
  ) {
    return next;
  }
  return "/";
}
