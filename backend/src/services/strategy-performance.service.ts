export type StrategyPerformanceGrade =
  | "A+"
  | "A"
  | "B"
  | "C"
  | "D"
  | "F";

export interface StrategyTradeOutcome {
  id: string;
  strategyId: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  returnPercent: number;
  holdingMinutes?: number | null;
  outcome:
    | "WIN"
    | "LOSS"
    | "BREAKEVEN";
  completedAt?: Date | string;
}

export interface StrategyPerformanceResult {
  strategyId: string;

  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;

  winRate: number;

  averageReturn: number;
  totalReturn: number;

  averageWin: number;
  averageLoss: number;

  maxWin: number;
  maxLoss: number;

  profitFactor: number;
  expectancy: number;

  averageHoldingMinutes: number;

  performanceScore: number;
  grade: StrategyPerformanceGrade;
  confidence: number;

  sampleSize: number;

  strengths: string[];
  weaknesses: string[];

  explanation: string;
}

function clamp(
  value: number,
  min = 0,
  max = 100,
): number {
  return Math.max(min, Math.min(max, value));
}

function round(
  value: number,
  decimals = 2,
): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function resolveGrade(
  score: number,
): StrategyPerformanceGrade {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function analyzeStrategyPerformance(
  strategyId: string,
  trades: StrategyTradeOutcome[],
): StrategyPerformanceResult {
  const strategyTrades = trades.filter(
    (trade) => trade.strategyId === strategyId,
  );

  const totalTrades = strategyTrades.length;

  const winningTrades = strategyTrades.filter(
    (trade) => trade.outcome === "WIN",
  );

  const losingTrades = strategyTrades.filter(
    (trade) => trade.outcome === "LOSS",
  );

  const breakevenTrades = strategyTrades.filter(
    (trade) => trade.outcome === "BREAKEVEN",
  );

  const winCount = winningTrades.length;
  const lossCount = losingTrades.length;

  const returns = strategyTrades.map(
    (trade) => trade.returnPercent,
  );

  const winningReturns = winningTrades.map(
    (trade) => trade.returnPercent,
  );

  const losingReturns = losingTrades.map(
    (trade) => trade.returnPercent,
  );

  const totalReturn = returns.reduce(
    (sum, value) => sum + value,
    0,
  );

  const averageReturn =
    totalTrades > 0
      ? totalReturn / totalTrades
      : 0;

  const averageWin =
    winCount > 0
      ? winningReturns.reduce(
          (sum, value) => sum + value,
          0,
        ) / winCount
      : 0;

  const averageLoss =
    lossCount > 0
      ? Math.abs(
          losingReturns.reduce(
            (sum, value) => sum + value,
            0,
          ) / lossCount,
        )
      : 0;

  const grossProfit = winningReturns.reduce(
    (sum, value) => sum + Math.max(0, value),
    0,
  );

  const grossLoss = losingReturns.reduce(
    (sum, value) => sum + Math.abs(Math.min(0, value)),
    0,
  );

  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Number.POSITIVE_INFINITY
        : 0;

  const expectancy =
    totalTrades > 0
      ? (
          (winCount / totalTrades) * averageWin
        ) -
        (
          (lossCount / totalTrades) * averageLoss
        )
      : 0;

  const maxWin =
    winningReturns.length > 0
      ? Math.max(...winningReturns)
      : 0;

  const maxLoss =
    losingReturns.length > 0
      ? Math.min(...losingReturns)
      : 0;

  const holdingTimes = strategyTrades
    .map((trade) => trade.holdingMinutes)
    .filter(
      (value): value is number =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0,
    );

  const averageHoldingMinutes =
    holdingTimes.length > 0
      ? holdingTimes.reduce(
          (sum, value) => sum + value,
          0,
        ) / holdingTimes.length
      : 0;

  const winRate =
    totalTrades > 0
      ? (winCount / totalTrades) * 100
      : 0;

  /*
   * Performance score:
   * - Win rate: 30%
   * - Expectancy: 25%
   * - Profit factor: 25%
   * - Total return: 20%
   */

  const winRateScore = clamp(winRate);

  const expectancyScore = clamp(
    50 + expectancy * 20,
  );

  const profitFactorScore = clamp(
    profitFactor === Number.POSITIVE_INFINITY
      ? 100
      : profitFactor * 50,
  );

  const totalReturnScore = clamp(
    50 + totalReturn * 5,
  );

  const performanceScore =
    totalTrades === 0
      ? 0
      : Math.round(
          clamp(
            winRateScore * 0.3 +
              expectancyScore * 0.25 +
              profitFactorScore * 0.25 +
              totalReturnScore * 0.2,
          ),
        );

  const grade = resolveGrade(
    performanceScore,
  );

  const confidence =
    totalTrades === 0
      ? 0
      : Math.round(
          clamp(
            Math.min(totalTrades, 100) * 0.7 +
              Math.min(
                30,
                Math.abs(performanceScore - 50) * 0.3,
              ),
          ),
        );

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (winRate >= 60) {
    strengths.push("Win rate is strong");
  }

  if (profitFactor >= 1.5) {
    strengths.push(
      "Profit factor shows favorable payoff",
    );
  }

  if (expectancy > 0) {
    strengths.push(
      "Expectancy is positive",
    );
  }

  if (totalReturn > 0) {
    strengths.push(
      "Total return is positive",
    );
  }

  if (winRate < 45 && totalTrades > 0) {
    weaknesses.push(
      "Win rate is weak",
    );
  }

  if (
    profitFactor > 0 &&
    profitFactor < 1
  ) {
    weaknesses.push(
      "Profit factor is below 1",
    );
  }

  if (expectancy < 0) {
    weaknesses.push(
      "Expectancy is negative",
    );
  }

  if (totalReturn < 0) {
    weaknesses.push(
      "Total return is negative",
    );
  }

  if (totalTrades < 30) {
    weaknesses.push(
      "Sample size is limited",
    );
  }

  let explanation: string;

  if (totalTrades === 0) {
    explanation =
      "No completed trades are available for this strategy.";
  } else if (performanceScore >= 80) {
    explanation =
      "Strategy performance is strong across the available sample.";
  } else if (performanceScore >= 60) {
    explanation =
      "Strategy performance is acceptable but should be monitored.";
  } else {
    explanation =
      "Strategy performance is weak and requires further evaluation.";
  }

  return {
    strategyId,

    totalTrades,
    winningTrades: winCount,
    losingTrades: lossCount,
    breakevenTrades: breakevenTrades.length,

    winRate: round(winRate),

    averageReturn: round(averageReturn),
    totalReturn: round(totalReturn),

    averageWin: round(averageWin),
    averageLoss: round(averageLoss),

    maxWin: round(maxWin),
    maxLoss: round(maxLoss),

    profitFactor:
      profitFactor === Number.POSITIVE_INFINITY
        ? Number.POSITIVE_INFINITY
        : round(profitFactor),

    expectancy: round(expectancy),

    averageHoldingMinutes: round(
      averageHoldingMinutes,
    ),

    performanceScore,
    grade,
    confidence,

    sampleSize: totalTrades,

    strengths,
    weaknesses,

    explanation,
  };
}
