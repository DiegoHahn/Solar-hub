export interface InverterReading {
  id: string;
  name: string;
  brand: string;
  ip: string;
  status: string;
  power_w: number;
  energy_today_kwh: number;
  energy_total_kwh: number;
  nominal_kw?: number;
  temperature_c?: number;
  vgrid?: number;
  igrid?: number;
  fgrid?: number;
  pv1?: { v: number; i: number; w: number };
  pv2?: { v: number; i: number; w: number };
  wifi_rssi?: string;
  wifi_ssid?: string;
  logger_sn?: string;
  logger_ver?: string;
  inverter_sn?: string;
  inverter_type?: string;
  model?: string;
  serial?: string;
  firmware?: string;
  work_mode?: string;
  raw_sensors?: Record<string, any>;
  raw_variables?: Record<string, any>;
  error?: string;
}

export interface SunCurvePoint {
  time: string;
  power_kw: number;
  nominal_cap_kw: number;
  solis_kw: number;
  goodwe1_kw: number;
  goodwe2_kw: number;
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

export interface SolarTelemetryRow {
  id: number;
  recorded_at: string;
  plant_name: string;
  total_nominal_capacity_kw: number;
  total_power_w: number;
  total_power_kw: number;
  total_today_kwh: number;
  total_lifetime_kwh: number;
  capacity_factor_pct: number | null;
  inverters_count: number;
  inverters_data: InverterReading[];
  created_at: string;
}

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
  CodigoUc: number;
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

export interface UnidadeConsumidora {
  codigo_uc: string;
  geracao_distribuida?: GeracaoDistribuida;
  resumo_ultima_fatura?: {
    AnoMes: string;
    ValorFatura: number;
    KwhReal: number;
    DataLProxima: string;
  };
  historico_consumo?: HistoricoConsumoMes[];
  balanco_energetico?: BalancoEnergeticoMes[];
  extrato_gd?: ExtratoGdEntry[];
}

export interface UtilityDataRow {
  id: number;
  updated_at: string;
  distribuidora: string;
  titular: string;
  cpf: string;
  tarifa_referencia: TarifaReferencia | null;
  unidades_consumidoras: Record<string, UnidadeConsumidora>;
  created_at: string;
}
