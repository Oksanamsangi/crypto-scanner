import type { Kline } from "../types/market.js";
import { BacktestService } from "./backtest.service.js";
export interface MultiBacktestItem {
    symbol: string;
    timeframe: string;
    horizon: number;
    minimumConfidence: number;
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    totalReturn: number;
    averageReturn: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
    maxDrawdown: number;
}
export interface MultiBacktestResult {
    timeframe: string;
    symbols: string[];
    horizons: number[];
    confidenceLevels: number[];
    results: MultiBacktestItem[];
}
export declare class MultiBacktestService {
    private readonly backtestService;
    constructor(backtestService?: BacktestService);
    run(klinesBySymbol: Map<string, Kline[]>, timeframe: string, horizons?: number[], confidenceLevels?: number[]): MultiBacktestResult;
}
//# sourceMappingURL=multi-backtest.service.d.ts.map