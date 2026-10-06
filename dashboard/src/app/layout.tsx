import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/AppShell";
import { isDemoMode } from "@/lib/dataSource";
import { getServerLocale, getServerI18n } from "@/i18n/server";
import { I18nProvider } from "@/i18n/context";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: "Solar Hub",
    description: t.overview.subtitle,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isDemo, locale] = await Promise.all([isDemoMode(), getServerLocale()]);

  return (
    <html lang={locale} className={GeistSans.variable} suppressHydrationWarning>
      <body className="antialiased bg-[#030712]">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <I18nProvider initialLocale={locale}>
            <AppShell isDemo={isDemo}>{children}</AppShell>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
