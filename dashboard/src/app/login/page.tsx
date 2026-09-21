"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  RiLockPasswordLine,
  RiMailLine,
  RiArrowRightLine,
  RiShieldCheckLine,
  RiEyeLine,
  RiEyeOffLine,
} from "@remixicon/react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      router.push("/");
      router.refresh();
    } catch (err: any) {
      console.error("Erro no login:", err);
      let errMsg = "Credenciais inválidas. Verifique seu e-mail e senha.";
      if (err.message?.includes("Invalid login credentials")) {
        errMsg = "E-mail ou senha incorretos.";
      } else if (err.message?.includes("Email not confirmed")) {
        errMsg = "E-mail ainda não confirmado.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setMessage({ type: "error", text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      console.error("Erro no login Google:", err);
      setMessage({
        type: "error",
        text:
          err.message ||
          "Não foi possível conectar com o Google. Verifique se o provedor está ativo no Supabase.",
      });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#030712] px-4 py-12">
      <div className="relative w-full max-w-md">
        {/* Card Principal */}
        <div className="rounded-2xl border border-gray-800/80 bg-gray-950/85 p-8 shadow-2xl backdrop-blur-xl">
          {/* Topo: Logo & Título */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-gradient-to-tr from-amber-500/20 to-amber-400/5 shadow-inner">
              <Image src="/logo.png" alt="Solar Hub" width={36} height={36} priority />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-50">
              Solar Hub
            </h1>
            <p className="mt-1.5 text-xs text-gray-400">
              Acesso restrito ao monitoramento da Usina Solar
            </p>
          </div>

          {/* Mensagens de Feedback */}
          {message && (
            <div
              className={`mb-5 rounded-lg border p-3 text-xs leading-relaxed ${
                message.type === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Botão de Login com Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-800 bg-gray-900/60 py-2.5 px-4 text-sm font-medium text-gray-200 transition-all hover:bg-gray-800 hover:text-white active:scale-[0.99] disabled:opacity-50"
          >
            {googleLoading ? (
              <div className="size-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            ) : (
              <svg className="size-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continuar com o Google</span>
          </button>

          {/* Divisor Visual */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-[11px]">
              <span className="bg-gray-950 px-2 text-gray-500">ou entre com e-mail e senha</span>
            </div>
          </div>

          {/* Formulário E-mail / Senha */}
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-gray-300"
              >
                E-mail
              </label>
              <div className="relative mt-1">
                <RiMailLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exemplo.com"
                  className="w-full rounded-lg border border-gray-800 bg-gray-900/80 py-2.5 pl-9 pr-3 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-gray-300"
              >
                Senha
              </label>
              <div className="relative mt-1">
                <RiLockPasswordLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-800 bg-gray-900/80 py-2.5 pl-9 pr-10 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? (
                    <RiEyeOffLine className="size-4" />
                  ) : (
                    <RiEyeLine className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-gray-950 transition-all hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="size-4 animate-spin rounded-full border-2 border-gray-950 border-t-transparent" />
              ) : (
                <>
                  <span>Entrar no Dashboard</span>
                  <RiArrowRightLine className="size-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Rodapé de Segurança */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-600">
          <RiShieldCheckLine className="size-3.5 text-gray-500" />
          <span>Autenticação criptografada protegida por Supabase Auth</span>
        </div>
      </div>
    </div>
  );
}
