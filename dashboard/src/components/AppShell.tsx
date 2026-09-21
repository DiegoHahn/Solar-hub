"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/auth");

  if (isAuth) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  return (
    <>
      <Nav />
      <div className="pb-16 md:pb-0 md:pl-56">{children}</div>
    </>
  );
}
