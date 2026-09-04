import type { SolarTelemetryRow, UtilityDataRow, SunCurvePoint, GenerationPoint } from "./types";

/**
 * ☀️ DADOS MOCKADOS REALISTAS DE UM DIA DE OPERAÇÃO NORMAL
 * Usina de 16 kWp com 3 inversores (1x Solis 6kW + 2x GoodWe 5kW).
 * No horário de pico solar (12h - 13h), a geração supera 100% da capacidade nominal (~105% a 110%).
 * Atualizado com 166 transações reais de extrato e 12 meses de balanço energético.
 */

export const mockSolarTelemetry: SolarTelemetryRow = {
  id: 999,
  recorded_at: new Date().toISOString(),
  plant_name: "Usina Solar Diego Hahn (16 kW)",
  total_nominal_capacity_kw: 16.0,
  total_power_w: 15200.0,
  total_power_kw: 15.2,
  total_today_kwh: 58.4,
  total_lifetime_kwh: 52840.0,
  capacity_factor_pct: 95.0,
  inverters_count: 3,
  created_at: new Date().toISOString(),
  inverters_data: [
    {
      id: "inv_1",
      name: "Inversor 1 (Solis 6kW)",
      brand: "Solis",
      ip: "10.0.0.18",
      status: "online",
      power_w: 5820.0,
      energy_today_kwh: 22.8,
      energy_total_kwh: 51840.0,
      nominal_kw: 6.0,
      temperature_c: 42.5,
      vgrid: 224.2,
      igrid: 25.9,
      pv1: { v: 345, i: 8.8, w: 3036 },
      pv2: { v: 340, i: 8.2, w: 2788 },
      wifi_rssi: "92%",
    },
    {
      id: "inv_2",
      name: "Inversor 2 (GoodWe 5kW - Inv 19)",
      brand: "GoodWe",
      ip: "10.0.0.19",
      status: "online",
      power_w: 4750.0,
      energy_today_kwh: 18.1,
      energy_total_kwh: 4980.0,
      nominal_kw: 5.0,
      temperature_c: 39.8,
      vgrid: 223.5,
      igrid: 21.2,
      pv1: { v: 320, i: 7.5, w: 2400 },
      pv2: { v: 315, i: 7.4, w: 2331 },
    },
    {
      id: "inv_3",
      name: "Inversor 3 (GoodWe 5kW - Inv 20)",
      brand: "GoodWe",
      ip: "10.0.0.20",
      status: "online",
      power_w: 4630.0,
      energy_today_kwh: 17.5,
      energy_total_kwh: 4920.0,
      nominal_kw: 5.0,
      temperature_c: 40.2,
      vgrid: 224.0,
      igrid: 20.7,
      pv1: { v: 318, i: 7.3, w: 2321 },
      pv2: { v: 316, i: 7.3, w: 2307 },
    },
  ],
};

/** Curva solar intraday (06:00 às 18:30) com pico excedendo 16 kW nominal (16.9 kW às 12:30) */
export const mockTodaySunCurve: SunCurvePoint[] = [
  { time: "06:00", power_kw: 0.0, nominal_cap_kw: 16.0, solis_kw: 0.0, goodwe1_kw: 0.0, goodwe2_kw: 0.0 },
  { time: "06:30", power_kw: 0.5, nominal_cap_kw: 16.0, solis_kw: 0.2, goodwe1_kw: 0.15, goodwe2_kw: 0.15 },
  { time: "07:00", power_kw: 1.4, nominal_cap_kw: 16.0, solis_kw: 0.5, goodwe1_kw: 0.45, goodwe2_kw: 0.45 },
  { time: "07:30", power_kw: 2.8, nominal_cap_kw: 16.0, solis_kw: 1.1, goodwe1_kw: 0.85, goodwe2_kw: 0.85 },
  { time: "08:00", power_kw: 4.6, nominal_cap_kw: 16.0, solis_kw: 1.8, goodwe1_kw: 1.4, goodwe2_kw: 1.4 },
  { time: "08:30", power_kw: 6.8, nominal_cap_kw: 16.0, solis_kw: 2.6, goodwe1_kw: 2.1, goodwe2_kw: 2.1 },
  { time: "09:00", power_kw: 8.9, nominal_cap_kw: 16.0, solis_kw: 3.4, goodwe1_kw: 2.75, goodwe2_kw: 2.75 },
  { time: "09:30", power_kw: 10.7, nominal_cap_kw: 16.0, solis_kw: 4.1, goodwe1_kw: 3.3, goodwe2_kw: 3.3 },
  { time: "10:00", power_kw: 12.4, nominal_cap_kw: 16.0, solis_kw: 4.7, goodwe1_kw: 3.85, goodwe2_kw: 3.85 },
  { time: "10:30", power_kw: 13.8, nominal_cap_kw: 16.0, solis_kw: 5.2, goodwe1_kw: 4.3, goodwe2_kw: 4.3 },
  { time: "11:00", power_kw: 14.9, nominal_cap_kw: 16.0, solis_kw: 5.6, goodwe1_kw: 4.65, goodwe2_kw: 4.65 },
  { time: "11:30", power_kw: 15.9, nominal_cap_kw: 16.0, solis_kw: 6.0, goodwe1_kw: 4.95, goodwe2_kw: 4.95 },
  // PICO SOLAR (excedendo 16 kWp nominal devido a irradiância alta / céu limpo)
  { time: "12:00", power_kw: 16.6, nominal_cap_kw: 16.0, solis_kw: 6.2, goodwe1_kw: 5.2, goodwe2_kw: 5.2 },
  { time: "12:30", power_kw: 16.9, nominal_cap_kw: 16.0, solis_kw: 6.3, goodwe1_kw: 5.3, goodwe2_kw: 5.3 },
  { time: "13:00", power_kw: 16.4, nominal_cap_kw: 16.0, solis_kw: 6.1, goodwe1_kw: 5.15, goodwe2_kw: 5.15 },
  { time: "13:30", power_kw: 15.2, nominal_cap_kw: 16.0, solis_kw: 5.8, goodwe1_kw: 4.7, goodwe2_kw: 4.7 },
  { time: "14:00", power_kw: 13.9, nominal_cap_kw: 16.0, solis_kw: 5.3, goodwe1_kw: 4.3, goodwe2_kw: 4.3 },
  { time: "14:30", power_kw: 12.3, nominal_cap_kw: 16.0, solis_kw: 4.7, goodwe1_kw: 3.8, goodwe2_kw: 3.8 },
  { time: "15:00", power_kw: 10.4, nominal_cap_kw: 16.0, solis_kw: 3.9, goodwe1_kw: 3.25, goodwe2_kw: 3.25 },
  { time: "15:30", power_kw: 8.3, nominal_cap_kw: 16.0, solis_kw: 3.2, goodwe1_kw: 2.55, goodwe2_kw: 2.55 },
  { time: "16:00", power_kw: 6.1, nominal_cap_kw: 16.0, solis_kw: 2.3, goodwe1_kw: 1.9, goodwe2_kw: 1.9 },
  { time: "16:30", power_kw: 3.9, nominal_cap_kw: 16.0, solis_kw: 1.5, goodwe1_kw: 1.2, goodwe2_kw: 1.2 },
  { time: "17:00", power_kw: 1.9, nominal_cap_kw: 16.0, solis_kw: 0.7, goodwe1_kw: 0.6, goodwe2_kw: 0.6 },
  { time: "17:30", power_kw: 0.6, nominal_cap_kw: 16.0, solis_kw: 0.25, goodwe1_kw: 0.18, goodwe2_kw: 0.17 },
  { time: "18:00", power_kw: 0.1, nominal_cap_kw: 16.0, solis_kw: 0.05, goodwe1_kw: 0.03, goodwe2_kw: 0.02 },
  { time: "18:30", power_kw: 0.0, nominal_cap_kw: 16.0, solis_kw: 0.0, goodwe1_kw: 0.0, goodwe2_kw: 0.0 },
];

/** Geração por dia no mês atual (kWh/dia), com variação típica de nebulosidade */
export const mockMonthlyGeneration: GenerationPoint[] = [
  { label: "01", kwh: 61.2 },
  { label: "02", kwh: 58.4 },
  { label: "03", kwh: 34.1 },
  { label: "04", kwh: 22.8 },
  { label: "05", kwh: 45.6 },
  { label: "06", kwh: 63.7 },
  { label: "07", kwh: 66.2 },
  { label: "08", kwh: 59.8 },
  { label: "09", kwh: 41.3 },
  { label: "10", kwh: 28.5 },
  { label: "11", kwh: 52.9 },
  { label: "12", kwh: 64.4 },
  { label: "13", kwh: 67.1 },
  { label: "14", kwh: 60.5 },
  { label: "15", kwh: 38.2 },
  { label: "16", kwh: 57.9 },
  { label: "17", kwh: 62.3 },
  { label: "18", kwh: 65.8 },
  { label: "19", kwh: 44.7 },
  { label: "20", kwh: 30.1 },
  { label: "21", kwh: 55.2 },
  { label: "22", kwh: 61.9 },
  { label: "23", kwh: 63.4 },
  { label: "24", kwh: 47.8 },
  { label: "25", kwh: 58.6 },
  { label: "26", kwh: 64.9 },
  { label: "27", kwh: 66.5 },
  { label: "28", kwh: 59.1 },
  { label: "29", kwh: 42.6 },
  { label: "30", kwh: 60.3 },
];

/** Geração por mês no ano (kWh/mês) — sazonalidade do hemisfério sul (verão: dez-fev, inverno: jun-jul) */
export const mockYearlyGeneration: GenerationPoint[] = [
  { label: "Jan", kwh: 2050 },
  { label: "Fev", kwh: 1890 },
  { label: "Mar", kwh: 1780 },
  { label: "Abr", kwh: 1620 },
  { label: "Mai", kwh: 1410 },
  { label: "Jun", kwh: 1240 },
  { label: "Jul", kwh: 1290 },
  { label: "Ago", kwh: 1520 },
  { label: "Set", kwh: 1690 },
  { label: "Out", kwh: 1860 },
  { label: "Nov", kwh: 1980 },
  { label: "Dez", kwh: 2120 },
];

/**
 * Dados cadastrais, histórico de consumo e extrato GD da Cooperaliança.
 *
 * NÃO SÃO SINTÉTICOS: são os valores reais capturados por collector_utility.py
 * e salvos em data/cooperalianca_latest.json (snapshot de 31/08/2026), copiados aqui
 * porque o coletor da concessionária ainda não roda em loop populando o Supabase.
 *
 * TODO: quando collector_utility.py estiver rodando com regularidade (ver
 * run_utility.bat), trocar USE_MOCK para false em queries.ts e este bloco deixa
 * de ser necessário — a página passa a ler direto de public.utility_data.
 */
import cooperativaRealExtract from "./cooperativa_real_extract.json";
import type { BalancoEnergeticoMes, ExtratoGdEntry } from "./types";

/**
 * Snapshot dos dados da Cooperaliança (Içara/SC) extraídos da Useall API.
 * 12 meses de balanço energético (Injeção vs Compensação vs Saldo) e 166 transações do extrato GD.
 */
export const mockUtilityData: UtilityDataRow = {
  id: 1,
  updated_at: "2026-08-31T00:00:00.000Z",
  distribuidora: "Cooperaliança (Içara/SC)",
  titular: "TITULAR",
  cpf: "00000000000",
  tarifa_referencia: {
    classe: "RURAL",
    subclasse: "AGROPECUARIA URBANA",
    tipo_rede: "Trifásico",
    bandeira_vigente: "Bandeira amarela",
    tarifa_kwh: 0.77658,
    tusd_kwh: 0.49944,
    te_kwh: 0.27714,
    icms_aliquota: 17,
  },
  unidades_consumidoras: {
    "1000000001": {
      codigo_uc: "1000000001",
      geracao_distribuida: {
        CodigoUc: 1000000001,
        PotenciaInstalada: 16.0,
        PercentualFatUcGeradora: 100,
        ProximoSaldoVencer: "01/08/2031",
        ValorProximoSaldoVencer: 9066.0,
      },
      resumo_ultima_fatura: {
        AnoMes: "08/2026",
        ValorFatura: 161.29,
        KwhReal: 758,
        DataLProxima: "11/09/2026",
      },
      // Balanço Energético dos 12 meses (Injetado vs Compensado vs Saldo)
      balanco_energetico: cooperativaRealExtract.balanco as BalancoEnergeticoMes[],
      // Extrato completo com todas as 166 transações históricas da Cooperaliança
      extrato_gd: cooperativaRealExtract.extrato as ExtratoGdEntry[],
      // Últimos 24 meses de faturas
      historico_consumo: [
        { mes: "09/2024", kwh: 763, valor: 291.05 },
        { mes: "10/2024", kwh: 1737, valor: 1267.32 },
        { mes: "11/2024", kwh: 1997, valor: 1436.2 },
        { mes: "12/2024", kwh: 1961, valor: 1054.54 },
        { mes: "01/2025", kwh: 888, valor: 163.06 },
        { mes: "02/2025", kwh: 883, valor: 162.73 },
        { mes: "03/2025", kwh: 979, valor: 168.95 },
        { mes: "04/2025", kwh: 806, valor: 157.77 },
        { mes: "05/2025", kwh: 834, valor: 160.4 },
        { mes: "06/2025", kwh: 744, valor: 146.02 },
        { mes: "07/2025", kwh: 730, valor: 147.09 },
        { mes: "08/2025", kwh: 1020, valor: 189.88 },
        { mes: "09/2025", kwh: 1240, valor: 225.37 },
        { mes: "10/2025", kwh: 2609, valor: 337.5 },
        { mes: "11/2025", kwh: 2928, valor: 358.45 },
        { mes: "12/2025", kwh: 2493, valor: 743.8 },
        { mes: "01/2026", kwh: 1046, valor: 216.27 },
        { mes: "02/2026", kwh: 829, valor: 181.41 },
        { mes: "03/2026", kwh: 886, valor: 186.53 },
        { mes: "04/2026", kwh: 889, valor: 185.99 },
        { mes: "05/2026", kwh: 655, valor: 159.87 },
        { mes: "06/2026", kwh: 627, valor: 159.25 },
        { mes: "07/2026", kwh: 540, valor: 142.08 },
        { mes: "08/2026", kwh: 758, valor: 161.29 },
      ],
    },
  },
  created_at: "2026-08-31T00:00:00.000Z",
};
