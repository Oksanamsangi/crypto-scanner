export type ScannerSignal = "BUY" | "SELL" | "NEUTRAL";

export type SignalStrength =
  | "VERY_STRONG"
  | "STRONG"
  | "MODERATE"
  | "WEAK"
  | "NEUTRAL";

export interface ScanResult {
  symbol: string;
  timeframe: string;

  currentPrice: number | null;

  ema20: number | null;
  ema50: number | null;
  rsi14: number | null;

  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;

  atr14: number | null;

  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  riskRewardRatio?: number | null;

  score: number;
  confidence: number;

  signal: ScannerSignal;
  signalStrength?: SignalStrength;

  reasons: string[];
}

export interface ScannerResponse {
  interval: string;
  candles: number;
  scannedPairs: number;
  topBuy: ScanResult[];
  topSell: ScanResult[];
  results: ScanResult[];
}

export interface HealthResponse {
  status: string;
  service: string;
}
