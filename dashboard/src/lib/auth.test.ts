import { describe, expect, it, afterEach } from "vitest";
import { isEmailAllowed, maskEmail, getSafeRedirectUrl } from "./auth";

describe("auth helpers", () => {
  const originalEnv = process.env.ALLOWED_EMAILS;

  afterEach(() => {
    process.env.ALLOWED_EMAILS = originalEnv;
  });

  describe("isEmailAllowed", () => {
    it("deve permitir e-mail listado exatamente", () => {
      process.env.ALLOWED_EMAILS = "diego@example.com,outro@example.com";
      expect(isEmailAllowed("diego@example.com")).toBe(true);
      expect(isEmailAllowed("outro@example.com")).toBe(true);
    });

    it("deve ser case-insensitive e tolerar espaços", () => {
      process.env.ALLOWED_EMAILS = "  Diego@Example.com , OUTRO@example.com ";
      expect(isEmailAllowed("diego@example.com")).toBe(true);
      expect(isEmailAllowed("DIEGO@EXAMPLE.COM")).toBe(true);
      expect(isEmailAllowed("  diego@example.com  ")).toBe(true);
    });

    it("deve rejeitar e-mail não listado", () => {
      process.env.ALLOWED_EMAILS = "diego@example.com";
      expect(isEmailAllowed("invasor@example.com")).toBe(false);
    });

    it("deve operar em fail-closed se ALLOWED_EMAILS estiver vazia ou ausente", () => {
      process.env.ALLOWED_EMAILS = "";
      expect(isEmailAllowed("diego@example.com")).toBe(false);

      delete process.env.ALLOWED_EMAILS;
      expect(isEmailAllowed("diego@example.com")).toBe(false);
    });

    it("deve rejeitar valores nulos ou vazios", () => {
      process.env.ALLOWED_EMAILS = "diego@example.com";
      expect(isEmailAllowed("")).toBe(false);
      expect(isEmailAllowed(null)).toBe(false);
      expect(isEmailAllowed(undefined)).toBe(false);
    });
  });

  describe("maskEmail", () => {
    it("deve mascarar e-mails comuns preservando extremidades e domínio", () => {
      expect(maskEmail("diego@example.com")).toBe("d***o@example.com");
      expect(maskEmail("usuario@empresa.com.br")).toBe("u***o@empresa.com.br");
    });

    it("deve mascarar nomes curtos", () => {
      expect(maskEmail("ab@example.com")).toBe("***@example.com");
    });

    it("deve tratar valores inválidos ou nulos com segurança", () => {
      expect(maskEmail(null)).toBe("desconhecido");
      expect(maskEmail("")).toBe("desconhecido");
      expect(maskEmail("invalido")).toBe("***");
    });
  });

  describe("getSafeRedirectUrl", () => {
    it("deve aceitar caminhos relativos válidos", () => {
      expect(getSafeRedirectUrl("/")).toBe("/");
      expect(getSafeRedirectUrl("/cooperativa")).toBe("/cooperativa");
      expect(getSafeRedirectUrl("/placas?tab=2")).toBe("/placas?tab=2");
    });

    it("deve rejeitar vetores de open redirect e retornar /", () => {
      expect(getSafeRedirectUrl("@evil.com")).toBe("/");
      expect(getSafeRedirectUrl("/@evil.com")).toBe("/");
      expect(getSafeRedirectUrl("//evil.com")).toBe("/");
      expect(getSafeRedirectUrl("//evil.com/path")).toBe("/");
      expect(getSafeRedirectUrl("/\\evil.com")).toBe("/");
      expect(getSafeRedirectUrl("https://evil.com")).toBe("/");
      expect(getSafeRedirectUrl("http://evil.com")).toBe("/");
      expect(getSafeRedirectUrl("javascript:alert(1)")).toBe("/");
    });

    it("deve retornar / para entradas nulas ou vazias", () => {
      expect(getSafeRedirectUrl(null)).toBe("/");
      expect(getSafeRedirectUrl(undefined)).toBe("/");
      expect(getSafeRedirectUrl("")).toBe("/");
    });
  });
});
