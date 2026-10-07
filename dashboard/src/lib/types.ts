import type { Database } from "./database.types";

export interface InverterReading {
  id: string;
  name: string;
  brand: string;
  ip: string;
  status: string;
  power_w: number;
  energy_today_kwh: number;
  energy_total_kwh: number;
  nominal_kw?: number | null;
  temperature_c?: number | null;
  vgrid?: number | null;
  igrid?: number | null;
  fgrid?: number | null;
  pv1?: { v: number; i: number; w: number } | null;
  pv2?: { v: number; i: number; w: number } | null;
  wifi_rssi?: string | null;
  wifi_ssid?: string | null;
  logger_sn?: string | null;
  logger_ver?: string | null;
  inverter_sn?: string | null;
  inverter_type?: string | null;
  model?: string | null;
  serial?: string | null;
  firmware?: string | null;
  work_mode?: string | null;
  /** Raw GoodWe sensors (collector converts non-numeric values to string) */
  raw_sensors?: Record<string, number | string | boolean> | null;
  /** Solarman logger (Solis) status.html variables */
  raw_variables?: Record<string, string> | null;
  error?: string | null;
}

export interface SunCurvePoint {
  time: string;
  power_kw: number | null;
  nominal_cap_kw: number;
  solis_kw?: number | null;
  goodwe1_kw?: number | null;
  goodwe2_kw?: number | null;
}

export interface GenerationPoint {
  label: string; // day of month ("01".."31"), month ("Jan".."Dec"), or year ("2025")
  kwh: number;
}

export interface MultiYearHistory {
  last12Months: GenerationPoint[];
  yearsTotals: GenerationPoint[];
  byYear: Record<string, GenerationPoint[]>;
  availableYears: string[];
}

export interface InverterMonthlyHistoryRow {
  month: string; // YYYY-MM
  inverter_id: string;
  kwh: number | string | null;
  is_estimated?: boolean | null;
}

export type SolarTelemetryRow = Omit<
  Database["public"]["Tables"]["solar_telemetry"]["Row"],
  "inverters_data"
> & {
  inverters_data: InverterReading[];
};

/** Tariff in force for the generator unit (per kWh, before taxes), as reported by the utility portal. */
export interface TarifaReferencia {
  bandeira_vigente: string;
  tarifa_kwh: number;
  te_kwh?: number | null;
  tusd_kwh?: number | null;
  vigente_desde?: string | null;
  resolucao?: string | null;
}

export interface GeracaoDistribuida {
  CodigoUc?: number;
  PotenciaInstalada: number;
  PercentualFatUcGeradora: number;
  ProximoSaldoVencer?: string;
  ValorProximoSaldoVencer: number;
}

export interface HistoricoConsumoMes {
  mes: string; // MM/YYYY
  kwh: number;
  valor: number;
}

export interface BalancoEnergeticoMes {
  mes: string; // MM/YYYY
  injetado_kwh: number;
  compensado_kwh: number;
  liquido_kwh: number; // injected - compensated (surplus / deficit)
  saldo_kwh: number; // accumulated credit balance at end of month
}

export interface ExtratoGdEntry {
  tipo: "injetada" | "compensada";
  mes: string; // MM/YYYY
  kwh: number; // negative when compensated
  saldo: number;
  grupo: 1 | 2; // 1 = GD I (Art. 26) · 2 = GD II (Law 14.300)
}

// ---- Raw Useall/Cooperaliança API payload (as stored by collector/utility.py) ----

/** Item from GeracaoDistribuida/BuscaDadosHistoricoGeracaoConsumo. `AnoMes` is formatted as "DD/MM/YYYY HH:mm:ss". */
export interface CoopHistoricoGeracaoConsumo {
  AnoMes: string;
  KwhGerado: number;
  kwhCreditado: number;
  Saldo: number;
}

/** Item from GeracaoDistribuida/RecuperarDadosHistoricoGeracao. Dates formatted as "DD/MM/YYYY HH:mm:ss"; "01/01/0001" = empty. */
export interface CoopExtratoGd {
  Operacao?: string;
  MesGeracao?: string;
  MesFaturamento?: string;
  KwhGerado: number;
  kwhCreditado: number;
  Saldo: number;
  GrupoTransicaoLei14300?: number;
}

/** Item from Fatura/RecuperarHistoricoFaturaConsumo60Meses. */
export interface CoopFatura {
  AnoMes?: string;
  ValorTotal?: number;
  ConsumoFaturado?: number;
  Vcto?: string;
}

export interface ResumoUltimaFatura {
  AnoMes: string;
  ValorFatura: number;
  KwhReal: number;
  DataLProxima: string;
}

export interface UnidadeConsumidora {
  codigo_uc: string;
  geracao_distribuida?: GeracaoDistribuida;
  resumo_ultima_fatura?: ResumoUltimaFatura;
  historico_consumo?: HistoricoConsumoMes[];
  balanco_energetico?: BalancoEnergeticoMes[];
  extrato_gd?: ExtratoGdEntry[];
  // Raw fields from utility API, normalized in lib/queries.ts
  historico_faturas_60_meses?: CoopFatura[];
  grafico_historico_12_meses?: {
    RetornoDadosHistoricoGeracaoConsumoKwhNormal?: CoopHistoricoGeracaoConsumo[];
  };
  extrato_historico_gd?: {
    RetornoDadosHistoricoGeracaoKwhNormal?: CoopExtratoGd[];
  };
}

export type UtilityDataRow = Omit<
  Database["public"]["Tables"]["utility_data"]["Row"],
  "tarifa_referencia" | "unidades_consumidoras"
> & {
  tarifa_referencia: TarifaReferencia | null;
  unidades_consumidoras: Record<string, UnidadeConsumidora>;
  /** Generator Consumer Unit code, resolved in getLatestUtilityData (virtual property, not on DB table) */
  generator_uc?: string | null;
};

/** Row from daily_weather table: raw Open-Meteo values for a day (Brasília timezone). */
export type DailyWeatherRow = Omit<
  Database["public"]["Tables"]["daily_weather"]["Row"],
  "source" | "updated_at"
> & {
  source: "forecast" | "archive";
  updated_at?: string;
};

export type AiAdvisorDailyRow = Database["public"]["Tables"]["ai_advisor_daily"]["Row"];
