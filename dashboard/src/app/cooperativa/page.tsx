import { RiWallet3Line, RiFileTextLine, RiBuilding2Line, RiCalendarEventLine } from "@remixicon/react";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";
import { EnergyBalanceChart } from "@/components/EnergyBalanceChart";
import { GdExtractList } from "@/components/GdExtractList";
import { getLatestUtilityData } from "@/lib/queries";
import { getGeneratorUc } from "@/lib/utility";
import type { BadgeProps } from "@/components/Badge";

export const dynamic = "force-dynamic";

function bandeiraVariant(bandeira: string | undefined): BadgeProps["variant"] {
  if (!bandeira) return "neutral";
  const b = bandeira.toLowerCase();
  if (b.includes("verde")) return "success";
  if (b.includes("amarela")) return "warning";
  if (b.includes("vermelha")) return "error";
  return "neutral";
}

export default async function CooperativaPage() {
  const utilityData = await getLatestUtilityData();
  const uc = getGeneratorUc(utilityData);
  const bandeira = utilityData?.tarifa_referencia?.bandeira_vigente;

  if (!utilityData || !uc) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 md:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Cooperativa
        </h1>
        <Card className="mt-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhum dado da Cooperaliança ainda. Rode o coletor (
            <code className="text-gray-700 dark:text-gray-300">python collector/utility.py --pdf</code>
            ) para sincronizar faturas e créditos.
          </p>
        </Card>
      </main>
    );
  }

  const gd = uc.geracao_distribuida;
  const fatura = uc.resumo_ultima_fatura;
  const tarifaKwh = utilityData.tarifa_referencia?.tarifa_kwh ?? 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Cooperativa
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {utilityData.distribuidora} · UC {utilityData.generator_uc} · {utilityData.titular}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bandeira && <Badge variant={bandeiraVariant(bandeira)}>{bandeira}</Badge>}
        </div>
      </div>

      {/* SALDO DE CRÉDITOS GD (destaque principal) */}
      <Card className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-transparent p-5 dark:border-emerald-500/30 md:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <RiWallet3Line className="size-4" />
              Saldo de créditos acumulados
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-gray-900 dark:text-gray-50">
              {(gd?.ValorProximoSaldoVencer ?? 0).toLocaleString("pt-BR")}
              <span className="ml-1 text-lg font-medium text-gray-400 dark:text-gray-500">kWh</span>
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              ~R$ {Math.round((gd?.ValorProximoSaldoVencer ?? 0) * tarifaKwh).toLocaleString("pt-BR")} em reserva GD
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <RiCalendarEventLine className="size-4 shrink-0" />
            Vencimento parcial em {gd?.ProximoSaldoVencer || "Próx. ciclo"}
          </div>
        </div>
      </Card>

      {/* GRID DE KPIs */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          icon={RiFileTextLine}
          label="Fatura Atual"
          value={fatura?.ValorFatura !== undefined ? `R$ ${Number(fatura.ValorFatura).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
          hint={fatura?.KwhReal !== undefined ? `${fatura.KwhReal.toLocaleString("pt-BR")} kWh · ${fatura.AnoMes}` : undefined}
          accent="amber"
        />
        <StatCard
          icon={RiCalendarEventLine}
          label="Próximo Vencimento"
          value={fatura?.DataLProxima ?? "—"}
          hint="Data de leitura"
          accent="blue"
        />
        <StatCard
          icon={RiBuilding2Line}
          label="Potência Instalada"
          value={(gd?.PotenciaInstalada ?? 16.0).toLocaleString("pt-BR")}
          unit="kWp"
          hint={`${gd?.PercentualFatUcGeradora ?? 100}% direcionado a esta UC`}
          accent="emerald"
        />
        <StatCard
          icon={RiWallet3Line}
          label="Tarifa Vigente"
          value={`R$ ${tarifaKwh.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`}
          unit="/kWh"
          hint={bandeira ?? "Rural B2"}
          accent="violet"
        />
      </div>

      {/* BALANÇO ENERGÉTICO (Injeção vs Compensação vs Saldo) */}
      {uc.balanco_energetico && <EnergyBalanceChart data={uc.balanco_energetico} />}

      {/* EXTRATO GD COM SCROLL INTERNO E FILTROS */}
      {uc.extrato_gd && <GdExtractList entries={uc.extrato_gd} />}
    </main>
  );
}
