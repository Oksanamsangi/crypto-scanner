export type HistoricalOutcome = "WIN" | "LOSS" | "BREAKEVEN";
export type HistoricalDirection = "LONG" | "SHORT";

export type HistoricalAccuracyGrade =
  | "A+"
  | "A"
  | "B"
  | "C"
  | "D"
  | "F";

export type HistoricalAccuracyReliability =
  | "VERY_HIGH"
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "INSUFFICIENT";

export interface HistoricalSignal {
  id: string;
  confidence: number;
  direction: HistoricalDirection;
  outcome: HistoricalOutcome;
  returnPercent: number;
  completedAt?: Date | string | null;
}

export interface HistoricalAccuracyBand {
  band: string;
  totalSignals: number;
  wins: number;
  losses: number;
  breakevens: number;
  accuracy: number;
}

export interface HistoricalAccuracyDirection {
  direction: HistoricalDirection;
  totalSignals: number;
  wins: number;
  losses: number;
  breakevens: number;
  accuracy: number;
  averageReturn: number;
}

export interface HistoricalAccuracyResult {
  totalSignals: number;
  wins: number;
  losses: number;
  breakevens: number;
  accuracy: number;
  averageReturn: number;
  totalReturn: number;
  bestReturn: number;
  worstReturn: number;
  confidenceBands: HistoricalAccuracyBand[];
  directions: HistoricalAccuracyDirection[];
  reliability: HistoricalAccuracyReliability;
  grade: HistoricalAccuracyGrade;
  sampleSize: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getGrade(accuracy: number): HistoricalAccuracyGrade {
  if (accuracy >= 90) return "A+";
  if (accuracy >= 80) return "A";
  if (accuracy >= 70) return "B";
  if (accuracy >= 60) return "C";
  if (accuracy >= 50) return "D";
  return "F";
}

function getReliability(sampleSize: number): HistoricalAccuracyReliability {
  if (sampleSize >= 100) return "VERY_HIGH";
  if (sampleSize >= 50) return "HIGH";
  if (sampleSize >= 25) return "MODERATE";
  if (sampleSize >= 10) return "LOW";
  return "INSUFFICIENT";
}

function getBand(confidence: number): string {
  if (confidence >= 90) return "90-100";
  if (confidence >= 80) return "80-89";
  if (confidence >= 70) return "70-79";
  if (confidence >= 60) return "60-69";
  if (confidence >= 50) return "50-59";
  return "0-49";
}

function calculateAccuracy(
  wins: number,
  losses: number,
  breakevens: number
): number {
  const total = wins + losses + breakevens;

  if (total === 0) return 0;

  return round(((wins + breakevens * 0.5) / total) * 100);
}

export function calculateHistoricalAccuracy(
  signals: HistoricalSignal[]
): HistoricalAccuracyResult {
  const totalSignals = signals.length;

  const wins = signals.filter(
    (signal) => signal.outcome === "WIN"
  ).length;

  const losses = signals.filter(
    (signal) => signal.outcome === "LOSS"
  ).length;

  const breakevens = signals.filter(
    (signal) => signal.outcome === "BREAKEVEN"
  ).length;

  const accuracy = calculateAccuracy(wins, losses, breakevens);

  const returns = signals.map((signal) => signal.returnPercent);

  const totalReturn = round(
    returns.reduce((sum, value) => sum + value, 0)
  );

  const averageReturn =
    totalSignals > 0 ? round(totalReturn / totalSignals) : 0;

  const bestReturn =
    returns.length > 0 ? round(Math.max(...returns)) : 0;

  const worstReturn =
    returns.length > 0 ? round(Math.min(...returns)) : 0;

  const confidenceBands: HistoricalAccuracyBand[] = [];

  const bandNames = [
    "90-100",
    "80-89",
    "70-79",
    "60-69",
    "50-59",
    "0-49",
  ];

  for (const band of bandNames) {
    const bandSignals = signals.filter(
      (signal) => getBand(clamp(signal.confidence)) === band
    );

    const bandWins = bandSignals.filter(
      (signal) => signal.outcome === "WIN"
    ).length;

    const bandLosses = bandSignals.filter(
      (signal) => signal.outcome === "LOSS"
    ).length;

    const bandBreakevens = bandSignals.filter(
      (signal) => signal.outcome === "BREAKEVEN"
    ).length;

    confidenceBands.push({
      band,
      totalSignals: bandSignals.length,
      wins: bandWins,
      losses: bandLosses,
      breakevens: bandBreakevens,
      accuracy: calculateAccuracy(
        bandWins,
        bandLosses,
        bandBreakevens
      ),
    });
  }

  const directions: HistoricalAccuracyDirection[] = [];

  for (const direction of ["LONG", "SHORT"] as HistoricalDirection[]) {
    const directionSignals = signals.filter(
      (signal) => signal.direction === direction
    );

    const directionWins = directionSignals.filter(
      (signal) => signal.outcome === "WIN"
    ).length;

    const directionLosses = directionSignals.filter(
      (signal) => signal.outcome === "LOSS"
    ).length;

    const directionBreakevens = directionSignals.filter(
      (signal) => signal.outcome === "BREAKEVEN"
    ).length;

    const directionReturn = directionSignals.reduce(
      (sum, signal) => sum + signal.returnPercent,
      0
    );

    directions.push({
      direction,
      totalSignals: directionSignals.length,
      wins: directionWins,
      losses: directionLosses,
      breakevens: directionBreakevens,
      accuracy: calculateAccuracy(
        directionWins,
        directionLosses,
        directionBreakevens
      ),
      averageReturn:
        directionSignals.length > 0
          ? round(directionReturn / directionSignals.length)
          : 0,
    });
  }

  const reliability = getReliability(totalSignals);
  const grade = getGrade(accuracy);

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (accuracy >= 70) {
    strengths.push("Strong historical accuracy.");
  }

  if (accuracy >= 80) {
    strengths.push("High-quality historical signal outcomes.");
  }

  if (averageReturn > 0) {
    strengths.push("Positive average return.");
  }

  if (totalReturn > 0) {
    strengths.push("Positive cumulative return.");
  }

  const strongestBand = confidenceBands
    .filter((band) => band.totalSignals >= 5)
    .sort((a, b) => b.accuracy - a.accuracy)[0];

  if (strongestBand && strongestBand.accuracy >= 70) {
    strengths.push(
      `${strongestBand.band} confidence signals show strong accuracy.`
    );
  }

  if (accuracy < 60) {
    weaknesses.push("Historical accuracy is below 60%.");
  }

  if (averageReturn <= 0 && totalSignals > 0) {
    weaknesses.push("Average historical return is not positive.");
  }

  if (totalSignals < 25) {
    weaknesses.push("Historical sample size is limited.");
  }

  const longResult = directions.find(
    (direction) => direction.direction === "LONG"
  );

  const shortResult = directions.find(
    (direction) => direction.direction === "SHORT"
  );

  if (
    longResult &&
    shortResult &&
    longResult.totalSignals >= 5 &&
    shortResult.totalSignals >= 5 &&
    Math.abs(longResult.accuracy - shortResult.accuracy) >= 15
  ) {
    const stronger =
      longResult.accuracy > shortResult.accuracy ? "LONG" : "SHORT";

    weaknesses.push(
      `${stronger} and opposite-direction accuracy differ materially.`
    );
  }

  const explanation =
    totalSignals === 0
      ? "Historical accuracy cannot be established because no completed signals are available."
      : `Historical accuracy is ${accuracy}% across ${totalSignals} completed signals with ${reliability.toLowerCase()} statistical reliability.`;

  return {
    totalSignals,
    wins,
    losses,
    breakevens,
    accuracy: round(clamp(accuracy)),
    averageReturn,
    totalReturn,
    bestReturn,
    worstReturn,
    confidenceBands,
    directions,
    reliability,
    grade,
    sampleSize: totalSignals,
    strengths: [...new Set(strengths)],
    weaknesses: [...new Set(weaknesses)],
    explanation,
  };
}
