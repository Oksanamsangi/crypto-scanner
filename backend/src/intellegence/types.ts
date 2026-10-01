export type VolatilityLevel =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "EXTREME";

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface PriceMetrics {
  current: number;
  open: number;
  high: number;
  low: number;

  change: number;
  changePercent: number;
}

export interface VolumeMetrics {
  current: number;
  average: number;
  ratio: number;
}

export interface VolatilityMetrics {
  atr: number;
  atrPercent: number;
  level: VolatilityLevel;
}

export interface MomentumMetrics {
  rsi: number;
  roc: number;
}

export interface MarketSnapshot {
  symbol: string;
  interval: string;

  timestamp: number;

  candles: number;

  price: PriceMetrics;

  volume: VolumeMetrics;

  volatility: VolatilityMetrics;

  momentum: MomentumMetrics;
}