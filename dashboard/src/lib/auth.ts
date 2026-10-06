/**
 * Returns true if the email is explicitly configured in ALLOWED_EMAILS environment variable.
 * Operates in fail-closed mode: if the variable is missing or empty, access is denied.
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
 * Masks an email address for privacy/audit logs (e.g., "u***r@example.com").
 */
export function maskEmail(email?: string | null): string {
  if (!email) return "unknown";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const [local, domain] = parts;
  const maskedLocal =
    local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : "***";
  return `${maskedLocal}@${domain}`;
}

/**
 * Validates internal relative paths for secure redirects,
 * preventing open redirect vulnerabilities.
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
