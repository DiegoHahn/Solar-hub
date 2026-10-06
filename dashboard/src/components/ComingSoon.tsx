"use client";

import { Card } from "@/components/Card";
import { useI18n } from "@/i18n";

export function ComingSoon({ title }: { title: string }) {
  const { t } = useI18n();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:py-10">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{title}</h1>
      <Card className="mt-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t.common.underConstruction}</p>
      </Card>
    </main>
  );
}
