import { BacktestService } from "./backtest.service.js";
export class MultiBacktestService {
    backtestService;
    constructor(backtestService = new BacktestService()) {
        this.backtestService = backtestService;
    }
    run(klinesBySymbol, timeframe, horizons = [1, 3, 6, 12], confidenceLevels = [70, 80, 85, 90, 95]) {
        const results = [];
        for (const [symbol, klines] of klinesBySymbol.entries()) {
            for (const horizon of horizons) {
                const backtest = this.backtestService.run(symbol, timeframe, klines, horizon);
                for (const confidenceLevel of confidenceLevels) {
                    const filtered = backtest.predictions.filter((prediction) => prediction.confidence >= confidenceLevel);
                    const totalPredictions = filtered.length;
                    const correctPredictions = filtered.filter((prediction) => prediction.correct).length;
                    const returns = filtered.map((prediction) => prediction.returnPercent);
                    const totalReturn = returns.reduce((sum, value) => sum + value, 0);
                    const averageReturn = returns.length > 0
                        ? totalReturn / returns.length
                        : 0;
                    const winningReturns = returns.filter((value) => value > 0);
                    const losingReturns = returns.filter((value) => value < 0);
                    const averageWin = winningReturns.length > 0
                        ? winningReturns.reduce((sum, value) => sum + value, 0) / winningReturns.length
                        : 0;
                    const averageLoss = losingReturns.length > 0
                        ? losingReturns.reduce((sum, value) => sum + value, 0) / losingReturns.length
                        : 0;
                    const grossProfit = winningReturns.reduce((sum, value) => sum + value, 0);
                    const grossLoss = Math.abs(losingReturns.reduce((sum, value) => sum + value, 0));
                    const profitFactor = grossLoss > 0
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
                    results.push({
                        symbol,
                        timeframe,
                        horizon,
                        minimumConfidence: confidenceLevel,
                        totalPredictions,
                        correctPredictions,
                        accuracy: totalPredictions > 0
                            ? (correctPredictions / totalPredictions) * 100
                            : 0,
                        totalReturn,
                        averageReturn,
                        averageWin,
                        averageLoss,
                        profitFactor,
                        maxDrawdown,
                    });
                }
            }
        }
        return {
            timeframe,
            symbols: Array.from(klinesBySymbol.keys()),
            horizons,
            confidenceLevels,
            results,
        };
    }
}
;
//# sourceMappingURL=multi-backtest.service.js.map