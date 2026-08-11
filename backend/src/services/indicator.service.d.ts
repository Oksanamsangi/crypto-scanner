import type { Kline } from '../types/market.js';
export interface EmaResult {
    period: number;
    values: number[];
    latest: number | null;
}
export interface RsiResult {
    period: number;
    values: number[];
    latest: number | null;
}
export interface MacdResult {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
    macd: number[];
    signal: number[];
    histogram: number[];
    latest: {
        macd: number;
        signal: number;
        histogram: number;
    } | null;
}
export interface AtrResult {
    period: number;
    values: number[];
    latest: number | null;
}
export declare class IndicatorService {
    calculateEMA20(klines: Kline[]): EmaResult;
    calculateEMA50(klines: Kline[]): EmaResult;
    calculateRSI14(klines: Kline[]): RsiResult;
    calculateMACD(klines: Kline[]): MacdResult;
    calculateATR14(klines: Kline[]): AtrResult;
    private calculateEMA;
    private extractCloses;
}
//# sourceMappingURL=indicator.service.d.ts.map