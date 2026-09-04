"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RiHome5Line,
  RiHome5Fill,
  RiSunLine,
  RiSunFill,
  RiBuilding2Line,
  RiBuilding2Fill,
  RiBarChartGroupedLine,
  RiBarChartGroupedFill,
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

  return (
    <>
      {/* Desktop: sidebar lateral fixa */}
      <nav className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-gray-200 bg-white px-4 py-6 md:flex dark:border-gray-900 dark:bg-[#030712]">
        <span className="mb-8 px-2 text-lg font-semibold text-gray-900 dark:text-gray-50">
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
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
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
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400",
              )}
            >
              <ActiveIcon className="size-6" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
