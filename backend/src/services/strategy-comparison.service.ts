import type {
  StrategyPerformanceResult,
} from "./strategy-performance.service.js";

export interface StrategyComparisonInput {
  performances: StrategyPerformanceResult[];
}

export interface StrategyComparisonMetric {
  name: string;
  winnerStrategyId: string | null;
  values: Record<string, number>;
  explanation: string;
}

export interface StrategyComparisonResult {
  comparedStrategies: string[];
  winnerStrategyId: string | null;
  winnerScore: number;

  metrics: StrategyComparisonMetric[];

  ranking: Array<{
    strategyId: string;
    rank: number;
    score: number;
    grade: StrategyPerformanceResult["grade"];
    confidence: number;
  }>;

  strengths: Record<string, string[]>;
  weaknesses: Record<string, string[]>;

  explanation: string;
}

function round(
  value: number,
  decimals = 2,
): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function findWinner(
  performances: StrategyPerformanceResult[],
  selector: (
    performance: StrategyPerformanceResult,
  ) => number,
): string | null {
  if (performances.length === 0) {
    return null;
  }

  return performances.reduce(
    (winner, current) =>
      selector(current) > selector(winner)
        ? current
        : winner,
  ).strategyId;
}

function buildMetric(
  name: string,
  performances: StrategyPerformanceResult[],
  selector: (
    performance: StrategyPerformanceResult,
  ) => number,
  explanation: string,
): StrategyComparisonMetric {
  const values: Record<string, number> = {};

  for (const performance of performances) {
    values[performance.strategyId] = round(
      selector(performance),
    );
  }

  return {
    name,
    winnerStrategyId: findWinner(
      performances,
      selector,
    ),
    values,
    explanation,
  };
}

export function compareStrategies(
  input: StrategyComparisonInput,
): StrategyComparisonResult {
  const performances = input.performances;

  if (performances.length === 0) {
    return {
      comparedStrategies: [],
      winnerStrategyId: null,
      winnerScore: 0,
      metrics: [],
      ranking: [],
      strengths: {},
      weaknesses: {},
      explanation:
        "No strategy performance data is available for comparison.",
    };
  }

  const unique = new Map<
    string,
    StrategyPerformanceResult
  >();

  for (const performance of performances) {
    unique.set(
      performance.strategyId,
      performance,
    );
  }

  const strategies = [...unique.values()];

  const metrics: StrategyComparisonMetric[] = [
    buildMetric(
      "Performance Score",
      strategies,
      (performance) =>
        performance.performanceScore,
      "Higher performance score indicates stronger overall historical performance.",
    ),

    buildMetric(
      "Win Rate",
      strategies,
      (performance) =>
        performance.winRate,
      "Higher win rate indicates a greater percentage of profitable outcomes.",
    ),

    buildMetric(
      "Profit Factor",
      strategies,
      (performance) =>
        Number.isFinite(
          performance.profitFactor,
        )
          ? performance.profitFactor
          : 100,
      "Higher profit factor indicates stronger gross-profit relative to gross-loss performance.",
    ),

    buildMetric(
      "Expectancy",
      strategies,
      (performance) =>
        performance.expectancy,
      "Higher expectancy indicates stronger average outcome per completed trade.",
    ),

    buildMetric(
      "Total Return",
      strategies,
      (performance) =>
        performance.totalReturn,
      "Higher total return indicates stronger aggregate historical return.",
    ),

    buildMetric(
      "Confidence",
      strategies,
      (performance) =>
        performance.confidence,
      "Higher confidence indicates a more reliable performance assessment.",
    ),

    buildMetric(
      "Sample Size",
      strategies,
      (performance) =>
        performance.sampleSize,
      "Larger sample size provides more historical observations for evaluation.",
    ),
  ];

  const weightedScores = new Map<
    string,
    number
  >();

  for (const strategy of strategies) {
    const score =
      strategy.performanceScore * 0.4 +
      strategy.winRate * 0.15 +
      Math.min(
        100,
        strategy.profitFactor * 50,
      ) * 0.15 +
      Math.max(
        0,
        Math.min(
          100,
          50 + strategy.expectancy * 20,
        ),
      ) * 0.15 +
      Math.max(
        0,
        Math.min(
          100,
          50 + strategy.totalReturn * 5,
        ),
      ) * 0.1 +
      strategy.confidence * 0.05;

    weightedScores.set(
      strategy.strategyId,
      round(score),
    );
  }

  const ranking = strategies
    .map((strategy) => ({
      strategyId: strategy.strategyId,
      rank: 0,
      score:
        weightedScores.get(
          strategy.strategyId,
        ) ?? 0,
      grade: strategy.grade,
      confidence: strategy.confidence,
    }))
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const winner = ranking[0] ?? null;

  const strengths: Record<
    string,
    string[]
  > = {};

  const weaknesses: Record<
    string,
    string[]
  > = {};

  for (const strategy of strategies) {
    strengths[strategy.strategyId] = [
      ...new Set(strategy.strengths),
    ];

    weaknesses[strategy.strategyId] = [
      ...new Set(strategy.weaknesses),
    ];

    if (strategy.winRate >= 60) {
      strengths[strategy.strategyId]!.push(
        "Strong win rate",
      );
    }

    if (strategy.profitFactor >= 2) {
      strengths[strategy.strategyId]!.push(
        "Strong profit factor",
      );
    }

    if (strategy.expectancy > 0) {
      strengths[strategy.strategyId]!.push(
        "Positive expectancy",
      );
    }

    if (strategy.sampleSize < 30) {
      weaknesses[strategy.strategyId]!.push(
        "Limited historical sample",
      );
    }

    if (strategy.performanceScore < 60) {
      weaknesses[strategy.strategyId]!.push(
        "Low performance score",
      );
    }

    strengths[strategy.strategyId] = [
      ...new Set(strengths[strategy.strategyId]),
    ];

    weaknesses[strategy.strategyId] = [
      ...new Set(weaknesses[strategy.strategyId]),
    ];
  }

  const explanation =
    winner === null
      ? "No strategy could be selected."
      : strategies.length === 1
        ? `Only ${winner.strategyId} was available, so it is ranked first by default.`
        : `The comparison ranks ${winner.strategyId} first based on weighted performance, profitability, expectancy, return, and confidence.`;

  return {
    comparedStrategies: strategies.map(
      (strategy) => strategy.strategyId,
    ),
    winnerStrategyId:
      winner?.strategyId ?? null,
    winnerScore:
      winner?.score ?? 0,
    metrics,
    ranking,
    strengths,
    weaknesses,
    explanation,
  };
}
