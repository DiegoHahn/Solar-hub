"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/Nav";
import { DemoBanner } from "@/components/DemoBanner";

export function AppShell({
  children,
  isDemo = false,
}: {
  children: React.ReactNode;
  isDemo?: boolean;
}) {
  const pathname = usePathname();
  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/auth");

  if (isAuth) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  return (
    <>
      <Nav isDemo={isDemo} />
      <div className="pb-16 md:pb-0 md:pl-56">
        {isDemo && <DemoBanner />}
        {children}
      </div>
    </>
  );
}
