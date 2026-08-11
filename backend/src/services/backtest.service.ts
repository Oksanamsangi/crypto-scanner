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

export class BacktestService {
  private readonly scannerService: ScannerService;

  constructor(scannerService: ScannerService = new ScannerService()) {
    this.scannerService = scannerService;
  }

  public run(
    symbol: string,
    timeframe: string,
    klines: Kline[],
    horizon = 6,
  ): BacktestResult {
    const predictions: BacktestPrediction[] = [];

    const minimumCandles = 60;

    if (horizon < 1) {
      throw new Error("Horizon must be at least 1 candle");
    }

    if (klines.length < minimumCandles + horizon) {
      return this.createEmptyResult(symbol, timeframe, klines.length, horizon);
    }

    /*
     * Scan every historical candle.
     *
     * IMPORTANT:
     * The scanner only receives candles that
     * existed at that historical moment.
     *
     * Future candles are used only for validation.
     */
    for (let index = minimumCandles; index < klines.length - horizon; index++) {
      const historicalKlines = klines.slice(0, index + 1);

      const scan = this.scannerService.scan(
        symbol,
        timeframe,
        historicalKlines,
      );

      /*
       * Ignore neutral signals.
       */
      if (scan.signal === "NEUTRAL") {
        continue;
      }

      /*
       * ATR levels must exist for a trade.
       */
      if (
        scan.entryPrice === null ||
        scan.stopLoss === null ||
        scan.takeProfit === null
      ) {
        continue;
      }

      const entryCandle = klines[index];

      if (!entryCandle) {
        continue;
      }

      const entryPrice = scan.entryPrice;

      const stopLoss = scan.stopLoss;

      const takeProfit = scan.takeProfit;

      const direction: BacktestDirection =
        scan.signal === "BUY" ? "UP" : "DOWN";

      let outcome: BacktestOutcome = "TIMEOUT";

      let holdingCandles = horizon;

      let exitPrice = klines[index + horizon]?.close ?? entryPrice;

      /*
       * Walk through every future candle.
       *
       * We check the candle's high/low to determine
       * whether TP or SL was touched.
       */
      for (
        let futureIndex = index + 1;
        futureIndex <= index + horizon;
        futureIndex++
      ) {
        const futureCandle = klines[futureIndex];

        if (!futureCandle) {
          break;
        }

        const hitStopLoss =
          direction === "UP"
            ? futureCandle.low <= stopLoss
            : futureCandle.high >= stopLoss;

        const hitTakeProfit =
          direction === "UP"
            ? futureCandle.high >= takeProfit
            : futureCandle.low <= takeProfit;

        /*
         * If both TP and SL are inside the same candle,
         * we cannot know which happened first from OHLC data.
         *
         * We conservatively classify this as STOP_LOSS.
         */
        if (hitStopLoss && hitTakeProfit) {
          outcome = "STOP_LOSS";

          holdingCandles = futureIndex - index;

          exitPrice = stopLoss;

          break;
        }

        if (hitTakeProfit) {
          outcome = "TAKE_PROFIT";

          holdingCandles = futureIndex - index;

          exitPrice = takeProfit;

          break;
        }

        if (hitStopLoss) {
          outcome = "STOP_LOSS";

          holdingCandles = futureIndex - index;

          exitPrice = stopLoss;

          break;
        }
      }

      /*
       * If neither TP nor SL was hit,
       * close the trade at the horizon candle close.
       */
      if (outcome === "TIMEOUT") {
        exitPrice = klines[index + horizon]?.close ?? entryPrice;
      }

      const actualDirection: BacktestDirection =
        exitPrice > entryPrice ? "UP" : "DOWN";

      const correct = outcome === "TAKE_PROFIT";

      /*
       * Return is calculated according to
       * the trade direction.
       */
      const returnPercent =
        direction === "UP"
          ? ((exitPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - exitPrice) / entryPrice) * 100;

      predictions.push({
        candleIndex: index,

        entryPrice,
        stopLoss,
        takeProfit,

        futurePrice: exitPrice,

        direction,
        actualDirection,

        confidence: scan.confidence,

        outcome,

        correct,

        returnPercent,

        holdingCandles,
      });
    }

    const confidenceLevels = [70, 80, 85, 90, 95];

    const confidenceBacktests = confidenceLevels.map((minimumConfidence) =>
      this.calculateConfidenceBacktest(predictions, minimumConfidence),
    );

    const statistics = this.calculateStatistics(predictions);

    return {
      symbol,
      timeframe,

      candles: klines.length,
      horizon,

      totalPredictions: statistics.totalPredictions,

      correctPredictions: statistics.correctPredictions,

      accuracy: statistics.accuracy,

      upPredictions: statistics.upPredictions,

      upCorrect: statistics.upCorrect,

      upAccuracy: statistics.upAccuracy,

      downPredictions: statistics.downPredictions,

      downCorrect: statistics.downCorrect,

      downAccuracy: statistics.downAccuracy,

      takeProfitHits: statistics.takeProfitHits,

      stopLossHits: statistics.stopLossHits,

      timeouts: statistics.timeouts,

      totalReturn: statistics.totalReturn,

      averageReturn: statistics.averageReturn,

      averageWin: statistics.averageWin,

      averageLoss: statistics.averageLoss,

      profitFactor: statistics.profitFactor,

      maxDrawdown: statistics.maxDrawdown,

      confidenceBacktests,

      predictions,
    };
  }

  private calculateConfidenceBacktest(
    predictions: BacktestPrediction[],
    minimumConfidence: number,
  ): ConfidenceBacktest {
    const filtered = predictions.filter(
      (prediction) => prediction.confidence >= minimumConfidence,
    );

    const statistics = this.calculateStatistics(filtered);

    return {
      minimumConfidence,

      totalPredictions: statistics.totalPredictions,

      correctPredictions: statistics.correctPredictions,

      accuracy: statistics.accuracy,

      totalReturn: statistics.totalReturn,

      averageReturn: statistics.averageReturn,

      averageWin: statistics.averageWin,

      averageLoss: statistics.averageLoss,

      profitFactor: statistics.profitFactor,

      maxDrawdown: statistics.maxDrawdown,
    };
  }

  private calculateStatistics(predictions: BacktestPrediction[]) {
    const totalPredictions = predictions.length;

    const correctPredictions = predictions.filter(
      (prediction) => prediction.correct,
    ).length;

    const upPredictions = predictions.filter(
      (prediction) => prediction.direction === "UP",
    );

    const downPredictions = predictions.filter(
      (prediction) => prediction.direction === "DOWN",
    );

    const upCorrect = upPredictions.filter(
      (prediction) => prediction.correct,
    ).length;

    const downCorrect = downPredictions.filter(
      (prediction) => prediction.correct,
    ).length;

    const takeProfitHits = predictions.filter(
      (prediction) => prediction.outcome === "TAKE_PROFIT",
    ).length;

    const stopLossHits = predictions.filter(
      (prediction) => prediction.outcome === "STOP_LOSS",
    ).length;

    const timeouts = predictions.filter(
      (prediction) => prediction.outcome === "TIMEOUT",
    ).length;

    const returns = predictions.map((prediction) => prediction.returnPercent);

    const totalReturn = returns.reduce((sum, value) => sum + value, 0);

    const averageReturn = returns.length > 0 ? totalReturn / returns.length : 0;

    const winningReturns = returns.filter((value) => value > 0);

    const losingReturns = returns.filter((value) => value < 0);

    const averageWin =
      winningReturns.length > 0
        ? winningReturns.reduce((sum, value) => sum + value, 0) /
          winningReturns.length
        : 0;

    const averageLoss =
      losingReturns.length > 0
        ? losingReturns.reduce((sum, value) => sum + value, 0) /
          losingReturns.length
        : 0;

    const grossProfit = winningReturns.reduce((sum, value) => sum + value, 0);

    const grossLoss = Math.abs(
      losingReturns.reduce((sum, value) => sum + value, 0),
    );

    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    /*
     * Equity curve and max drawdown.
     */
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

    return {
      totalPredictions,

      correctPredictions,

      accuracy:
        totalPredictions > 0
          ? (correctPredictions / totalPredictions) * 100
          : 0,

      upPredictions: upPredictions.length,

      upCorrect,

      upAccuracy:
        upPredictions.length > 0 ? (upCorrect / upPredictions.length) * 100 : 0,

      downPredictions: downPredictions.length,

      downCorrect,

      downAccuracy:
        downPredictions.length > 0
          ? (downCorrect / downPredictions.length) * 100
          : 0,

      takeProfitHits,

      stopLossHits,

      timeouts,

      totalReturn,

      averageReturn,

      averageWin,

      averageLoss,

      profitFactor,

      maxDrawdown,
    };
  }

  private createEmptyResult(
    symbol: string,
    timeframe: string,
    candles: number,
    horizon: number,
  ): BacktestResult {
    const emptyConfidenceBacktests = [70, 80, 85, 90, 95].map(
      (minimumConfidence) => ({
        minimumConfidence,

        totalPredictions: 0,
        correctPredictions: 0,

        accuracy: 0,

        totalReturn: 0,
        averageReturn: 0,

        averageWin: 0,
        averageLoss: 0,

        profitFactor: 0,
        maxDrawdown: 0,
      }),
    );

    return {
      symbol,
      timeframe,

      candles,
      horizon,

      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,

      upPredictions: 0,
      upCorrect: 0,
      upAccuracy: 0,

      downPredictions: 0,
      downCorrect: 0,
      downAccuracy: 0,

      takeProfitHits: 0,
      stopLossHits: 0,
      timeouts: 0,

      totalReturn: 0,
      averageReturn: 0,

      averageWin: 0,
      averageLoss: 0,

      profitFactor: 0,
      maxDrawdown: 0,

      confidenceBacktests: emptyConfidenceBacktests,

      predictions: [],
    };
  }
}
