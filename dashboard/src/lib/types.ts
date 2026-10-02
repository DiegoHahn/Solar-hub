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
  /** Sensores GoodWe crus (o coletor converte valores não numéricos para string) */
  raw_sensors?: Record<string, number | string | boolean> | null;
  /** Variáveis do status.html do logger Solarman (Solis) */
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
  label: string; // dia do mês ("01".."31"), mês ("Jan".."Dez") ou ano ("2025")
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

export interface TarifaReferencia {
  classe: string;
  subclasse: string;
  tipo_rede: string;
  bandeira_vigente: string;
  tarifa_kwh: number;
  tusd_kwh: number;
  te_kwh: number;
  icms_aliquota: number;
}

export interface GeracaoDistribuida {
  CodigoUc?: number;
  PotenciaInstalada: number;
  PercentualFatUcGeradora: number;
  ProximoSaldoVencer: string;
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
  liquido_kwh: number; // injetado - compensado (superávit / déficit)
  saldo_kwh: number; // saldo acumulado de créditos no fim do mês
}

export interface ExtratoGdEntry {
  tipo: "injetada" | "compensada";
  mes: string; // MM/YYYY
  kwh: number; // negativo quando compensada
  saldo: number;
  grupo: 1 | 2; // 1 = GD I (Art. 26) · 2 = GD II (Lei 14.300)
}

// ---- Payload cru da API Useall/Cooperaliança (como gravado pelo collector_utility.py) ----

/** Item de GeracaoDistribuida/BuscaDadosHistoricoGeracaoConsumo. `AnoMes` vem como "DD/MM/YYYY HH:mm:ss". */
export interface CoopHistoricoGeracaoConsumo {
  AnoMes: string;
  KwhGerado: number;
  kwhCreditado: number;
  Saldo: number;
}

/** Item de GeracaoDistribuida/RecuperarDadosHistoricoGeracao. Datas "DD/MM/YYYY HH:mm:ss"; "01/01/0001" = vazio. */
export interface CoopExtratoGd {
  Operacao?: string;
  MesGeracao?: string;
  MesFaturamento?: string;
  KwhGerado: number;
  kwhCreditado: number;
  Saldo: number;
  GrupoTransicaoLei14300?: number;
}

/** Item de Fatura/RecuperarHistoricoFaturaConsumo60Meses. */
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
  // Campos crus vindos da concessionária, normalizados em lib/queries.ts
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
  /** Código da UC geradora, resolvido em getLatestUtilityData (não existe na tabela) */
  generator_uc?: string | null;
};

/** Linha da tabela daily_weather: valores brutos da Open-Meteo para um dia (fuso de Brasília). */
export type DailyWeatherRow = Omit<
  Database["public"]["Tables"]["daily_weather"]["Row"],
  "source" | "updated_at"
> & {
  source: "forecast" | "archive";
  updated_at?: string;
};

export type AiAdvisorDailyRow = Database["public"]["Tables"]["ai_advisor_daily"]["Row"];
