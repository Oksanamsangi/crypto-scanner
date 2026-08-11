import type { Kline } from "../types/market.js";
import { IndicatorService } from "./indicator.service.js";
export type ScannerSignal = "BUY" | "SELL" | "NEUTRAL";
export type SignalStrength = "STRONG" | "MODERATE" | "WEAK" | "NONE";
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
    entryPrice: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    riskRewardRatio: number | null;
    score: number;
    confidence: number;
    signal: ScannerSignal;
    signalStrength: SignalStrength;
    reasons: string[];
}
export declare class ScannerService {
    private readonly indicatorService;
    constructor(indicatorService?: IndicatorService);
    scan(symbol: string, timeframe: string, klines: Kline[]): ScanResult;
}
//# sourceMappingURL=scanner.service.d.ts.map