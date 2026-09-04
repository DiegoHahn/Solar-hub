import { Card } from "@/components/Card";

export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:py-10">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{title}</h1>
      <Card className="mt-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Em construção.</p>
      </Card>
    </main>
  );
}
