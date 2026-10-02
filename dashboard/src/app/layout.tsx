import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/AppShell";
import { isDemoMode } from "@/lib/dataSource";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solar Hub",
  description: "Monitoramento da usina solar e gestão energética com a Cooperaliança",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDemo = await isDemoMode();

  return (
    <html lang="pt-BR" className={GeistSans.variable} suppressHydrationWarning>
      <body className="antialiased bg-[#030712]">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AppShell isDemo={isDemo}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
