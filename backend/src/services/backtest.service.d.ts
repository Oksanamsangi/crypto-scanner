import type { Kline } from "../types/market.js";
import { ScannerService } from "./scanner.service.js";
export type BacktestDirection = "UP" | "DOWN";
export type BacktestOutcome = "TAKE_PROFIT" | "STOP_LOSS" | "TIMEOUT";
export interface BacktestPrediction {
    candleIndex: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    futurePrice: number;
    direction: BacktestDirection;
    actualDirection: BacktestDirection;
    confidence: number;
    outcome: BacktestOutcome;
    correct: boolean;
    returnPercent: number;
    holdingCandles: number;
}
export interface ConfidenceBacktest {
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
export interface BacktestResult {
    symbol: string;
    timeframe: string;
    candles: number;
    horizon: number;
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    upPredictions: number;
    upCorrect: number;
    upAccuracy: number;
    downPredictions: number;
    downCorrect: number;
    downAccuracy: number;
    takeProfitHits: number;
    stopLossHits: number;
    timeouts: number;
    totalReturn: number;
    averageReturn: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
    maxDrawdown: number;
    confidenceBacktests: ConfidenceBacktest[];
    predictions: BacktestPrediction[];
}
export declare class BacktestService {
    private readonly scannerService;
    constructor(scannerService?: ScannerService);
    run(symbol: string, timeframe: string, klines: Kline[], horizon?: number): BacktestResult;
    private calculateConfidenceBacktest;
    private calculateStatistics;
    private createEmptyResult;
}
//# sourceMappingURL=backtest.service.d.ts.map