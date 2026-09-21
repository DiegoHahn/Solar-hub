"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  RiHome5Line,
  RiHome5Fill,
  RiSunLine,
  RiSunFill,
  RiBuilding2Line,
  RiBuilding2Fill,
  RiBarChartGroupedLine,
  RiBarChartGroupedFill,
  RiLogoutBoxRLine,
  RiUserLine,
} from "@remixicon/react";
import { cx } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Início", Icon: RiHome5Line, IconActive: RiHome5Fill },
  { href: "/placas", label: "Placas", Icon: RiSunLine, IconActive: RiSunFill },
  {
    href: "/cooperativa",
    label: "Cooperativa",
    Icon: RiBuilding2Line,
    IconActive: RiBuilding2Fill,
  },
  {
    href: "/combinada",
    label: "Análise",
    Icon: RiBarChartGroupedLine,
    IconActive: RiBarChartGroupedFill,
  },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Não renderiza navegação na tela de login ou callback de autenticação
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Desktop: sidebar lateral fixa */}
      <nav className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col justify-between border-r border-gray-200 bg-white px-4 py-6 md:flex dark:border-gray-900 dark:bg-[#030712]">
        <div>
          <span className="mb-8 flex items-center gap-2 px-2 text-lg font-semibold text-gray-900 dark:text-gray-50">
            ☀️ Solar Hub
          </span>
          <ul className="flex flex-col gap-1">
            {navItems.map(({ href, label, Icon, IconActive }) => {
              const isActive = pathname === href;
              const ActiveIcon = isActive ? IconActive : Icon;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cx(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-amber-500/10 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900/60",
                    )}
                  >
                    <ActiveIcon className="size-5 shrink-0" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Rodapé da Sidebar: Usuário & Logout */}
        <div className="border-t border-gray-100 pt-4 dark:border-gray-900">
          {userEmail && (
            <div className="mb-2 flex items-center gap-2 px-2 text-xs text-gray-500 dark:text-gray-400">
              <RiUserLine className="size-3.5 shrink-0" />
              <span className="truncate">{userEmail}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <RiLogoutBoxRLine className="size-4 shrink-0" />
            Sair do Painel
          </button>
        </div>
      </nav>

      {/* Mobile: barra inferior fixa */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-gray-900 dark:bg-[#030712]">
        {navItems.map(({ href, label, Icon, IconActive }) => {
          const isActive = pathname === href;
          const ActiveIcon = isActive ? IconActive : Icon;
          return (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium",
                isActive
                  ? "text-amber-500 dark:text-amber-400"
                  : "text-gray-500 dark:text-gray-400",
              )}
            >
              <ActiveIcon className="size-6" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-400"
        >
          <RiLogoutBoxRLine className="size-6" aria-hidden="true" />
          Sair
        </button>
      </nav>
    </>
  );
}
