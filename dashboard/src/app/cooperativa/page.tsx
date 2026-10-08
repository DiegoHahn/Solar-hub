import { RiWallet3Line, RiFileTextLine, RiBuilding2Line, RiCalendarEventLine } from "@remixicon/react";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";
import { EnergyBalanceChart } from "@/components/EnergyBalanceChart";
import { GdExtractList } from "@/components/GdExtractList";
import { getDataSource } from "@/lib/dataSource";
import { getGeneratorUc, getTariffPerKwh, maskUcCode, holderFirstName, tariffFlagVariant, translateTariffFlag } from "@/lib/utility";
import { formatCurrency, formatCurrencyEstimate, formatNumber, formatPortalDate, formatTariff } from "@/i18n";
import { getServerI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function CooperativaPage() {
  const { t, locale } = await getServerI18n();
  const ds = await getDataSource();
  const utilityData = await ds.getLatestUtilityData();
  const uc = getGeneratorUc(utilityData);
  const bandeira = utilityData?.tarifa_referencia?.bandeira_vigente;

  if (!utilityData || !uc) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 md:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          {t.utility.title}
        </h1>
        <Card className="mt-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t.utility.noUtilityDataNotice.replace("{command}", "python collector/utility.py --pdf")}
          </p>
        </Card>
      </main>
    );
  }

  const gd = uc.geracao_distribuida;
  const lastBill = uc.resumo_ultima_fatura;
  const tariffPerKwh = getTariffPerKwh(utilityData);
  const balanceKwh = gd?.ValorProximoSaldoVencer;
  const reserveValue = balanceKwh !== undefined && tariffPerKwh !== null ? balanceKwh * tariffPerKwh : null;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {t.utility.title}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {utilityData.distribuidora} · UC {maskUcCode(utilityData.generator_uc)} · {holderFirstName(utilityData.titular)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bandeira && <Badge variant={tariffFlagVariant(bandeira)}>{translateTariffFlag(bandeira, t)}</Badge>}
        </div>
      </div>

      {/* DG CREDIT BALANCE (Hero Card) */}
      <Card className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-transparent p-5 dark:border-emerald-500/30 md:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <RiWallet3Line className="size-4" />
              {t.utility.accumulatedCreditBalance}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-gray-900 dark:text-gray-50">
              {balanceKwh !== undefined ? formatNumber(balanceKwh, locale) : "—"}
              <span className="ml-1 text-lg font-medium text-gray-400 dark:text-gray-500">kWh</span>
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {reserveValue !== null && t.utility.inReserveGd.replace("{value}", formatCurrencyEstimate(reserveValue, locale))}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <RiCalendarEventLine className="size-4 shrink-0" />
            {t.utility.partialExpiry.replace(
              "{date}",
              gd?.ProximoSaldoVencer ? formatPortalDate(gd.ProximoSaldoVencer, locale) : t.utility.nextCycle
            )}
          </div>
        </div>
      </Card>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          icon={RiFileTextLine}
          label={t.utility.currentInvoice}
          value={lastBill?.ValorFatura !== undefined ? formatCurrency(Number(lastBill.ValorFatura), locale) : "—"}
          hint={lastBill?.KwhReal !== undefined ? `${formatNumber(lastBill.KwhReal, locale)} kWh · ${formatPortalDate(lastBill.AnoMes, locale)}` : undefined}
          accent="amber"
        />
        <StatCard
          icon={RiCalendarEventLine}
          label={t.utility.nextDueDate}
          value={formatPortalDate(lastBill?.DataLProxima, locale)}
          hint={t.utility.readingDate}
          accent="blue"
        />
        <StatCard
          icon={RiBuilding2Line}
          label={t.utility.installedPower}
          value={
            gd?.PotenciaInstalada !== undefined
              ? formatNumber(gd.PotenciaInstalada, locale, { minimumFractionDigits: 1 })
              : "—"
          }
          unit="kWp"
          hint={
            gd?.PercentualFatUcGeradora !== undefined
              ? t.utility.directedToThisUc.replace("{percent}", String(gd.PercentualFatUcGeradora))
              : undefined
          }
          accent="emerald"
        />
        <StatCard
          icon={RiWallet3Line}
          label={t.utility.effectiveTariff}
          value={tariffPerKwh !== null ? formatTariff(tariffPerKwh, locale) : "—"}
          unit="/kWh"
          hint={bandeira ? translateTariffFlag(bandeira, t) : "Rural B2"}
          accent="violet"
        />
      </div>

      {/* ENERGY BALANCE */}
      {uc.balanco_energetico && (
        <EnergyBalanceChart
          data={uc.balanco_energetico}
          currentBalanceKwh={balanceKwh}
        />
      )}

      {/* DISTRIBUTED GENERATION STATEMENT */}
      {uc.extrato_gd && <GdExtractList entries={uc.extrato_gd} />}
    </main>
  );
}
