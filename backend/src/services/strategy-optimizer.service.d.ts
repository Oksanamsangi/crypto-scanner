import type { Kline } from "../types/market.js";
import { BacktestService } from "./backtest.service.js";
export interface OptimizationCandidate {
    buyThreshold: number;
    sellThreshold: number;
    minimumConfidence: number;
    horizon: number;
    totalPredictions: number;
    accuracy: number;
    totalReturn: number;
    profitFactor: number;
    maxDrawdown: number;
}
export interface StrategyOptimizationResult {
    symbol: string;
    timeframe: string;
    candles: number;
    best: OptimizationCandidate | null;
    candidates: OptimizationCandidate[];
}
export declare class StrategyOptimizerService {
    private readonly backtestService;
    constructor(backtestService?: BacktestService);
    optimize(symbol: string, timeframe: string, klines: Kline[]): StrategyOptimizationResult;
    private calculateCandidateScore;
}
//# sourceMappingURL=strategy-optimizer.service.d.ts.map