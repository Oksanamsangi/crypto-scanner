
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

export class StrategyOptimizerService {
  private readonly backtestService: BacktestService;

  constructor(
    backtestService: BacktestService = new BacktestService(),
  ) {
    this.backtestService = backtestService;
  }

  public optimize(
    symbol: string,
    timeframe: string,
    klines: Kline[],
  ): StrategyOptimizationResult {
    const candidates: OptimizationCandidate[] = [];

    const horizons = [1, 3, 6, 12];
    const confidenceLevels = [70, 80, 85, 90, 95];

    /*
     * IMPORTANT:
     *
     * buyThreshold / sellThreshold are recorded here as
     * optimization parameters.
     *
     * The current BacktestService uses the existing ScannerService.
     * We will connect these thresholds to the scanner in the next step.
     */

    const thresholdPairs = [
      { buyThreshold: 3, sellThreshold: -3 },
      { buyThreshold: 4, sellThreshold: -4 },
      { buyThreshold: 5, sellThreshold: -5 },
    ];

    for (const horizon of horizons) {
      const backtest = this.backtestService.run(
        symbol,
        timeframe,
        klines,
        horizon,
      );

      for (const confidenceLevel of confidenceLevels) {
        const filtered =
          backtest.predictions.filter(
            (prediction) =>
              prediction.confidence >= confidenceLevel,
          );

        const totalPredictions = filtered.length;

        if (totalPredictions < 30) {
          continue;
        }

        const correctPredictions =
          filtered.filter(
            (prediction) => prediction.correct,
          ).length;

        const accuracy =
          (correctPredictions / totalPredictions) * 100;

        const returns = filtered.map(
          (prediction) => prediction.returnPercent,
        );

        const totalReturn = returns.reduce(
          (sum, value) => sum + value,
          0,
        );

        const winningReturns = returns.filter(
          (value) => value > 0,
        );

        const losingReturns = returns.filter(
          (value) => value < 0,
        );

        const grossProfit =
          winningReturns.reduce(
            (sum, value) => sum + value,
            0,
          );

        const grossLoss = Math.abs(
          losingReturns.reduce(
            (sum, value) => sum + value,
            0,
          ),
        );

        const profitFactor =
          grossLoss > 0
            ? grossProfit / grossLoss
            : grossProfit > 0
              ? Infinity
              : 0;

        let equity = 0;
        let peak = 0;
        let maxDrawdown = 0;

        for (const value of returns) {
          equity += value;

          if (equity > peak) {
            peak = equity;
          }

          const drawdown = equity - peak;

          if (drawdown < maxDrawdown) {
            maxDrawdown = drawdown;
          }
        }

        for (const thresholds of thresholdPairs) {
          candidates.push({
            buyThreshold: thresholds.buyThreshold,
            sellThreshold: thresholds.sellThreshold,
            minimumConfidence: confidenceLevel,
            horizon,

            totalPredictions,
            accuracy,
            totalReturn,
            profitFactor,
            maxDrawdown,
          });
        }
      }
    }

    /*
     * We prefer candidates with:
     *
     * 1. Profit factor > 1
     * 2. Positive total return
     * 3. Smaller drawdown
     * 4. Higher accuracy
     *
     * The score prevents a single metric from dominating.
     */

    const ranked = [...candidates].sort(
      (a, b) => {
        const scoreA =
          this.calculateCandidateScore(a);

        const scoreB =
          this.calculateCandidateScore(b);

        return scoreB - scoreA;
      },
    );

    return {
      symbol,
      timeframe,
      candles: klines.length,
      best: ranked[0] ?? null,
      candidates: ranked,
    };
  }

  private calculateCandidateScore(
    candidate: OptimizationCandidate,
  ): number {
    if (candidate.totalPredictions < 30) {
      return -Infinity;
    }

    if (candidate.profitFactor <= 0) {
      return -Infinity;
    }

    const profitScore =
      Math.min(candidate.profitFactor, 3) * 40;

    const returnScore =
      Math.max(
        Math.min(candidate.totalReturn, 30),
        -30,
      );

    const accuracyScore =
      (candidate.accuracy - 50) * 0.5;

    const drawdownPenalty =
      Math.abs(candidate.maxDrawdown) * 0.25;

    return (
      profitScore +
      returnScore +
      accuracyScore -
      drawdownPenalty
    );
  }
};
