import type {
  SetupDirection,
  SetupFingerprint,
  SetupMomentum,
  SetupTrend,
  SetupVolatility,
  SetupVolume,
} from "./setup-fingerprint.service.js";

import {
  findMostSimilarSetups,
} from "./historical-similarity.service.js";

export type SetupPattern =
  | "TREND_CONTINUATION"
  | "BREAKOUT"
  | "REVERSAL"
  | "MOMENTUM"
  | "RANGE"
  | "VOLATILITY_EXPANSION"
  | "VOLATILITY_COMPRESSION"
  | "ACCUMULATION"
  | "DISTRIBUTION"
  | "MIXED";

export type PatternDirection =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export interface PatternMatch {
  setupId: string;
  symbol: string;
  interval: string;
  similarity: number;
  pattern: SetupPattern;
  direction: PatternDirection;
}

export interface PatternRecognitionResult {
  pattern: SetupPattern;
  direction: PatternDirection;

  patternConfidence: number;
  patternFrequency: number;

  recognized: boolean;

  matches: PatternMatch[];

  supportingCharacteristics: string[];
  conflictingCharacteristics: string[];

  explanation: string;
}

interface PatternCandidate {
  pattern: SetupPattern;
  score: number;
  reasons: string[];
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function directionFromSetup(
  setup: SetupFingerprint,
): PatternDirection {
  if (setup.direction === "BUY") {
    return "BULLISH";
  }

  if (setup.direction === "SELL") {
    return "BEARISH";
  }

  if (
    setup.trend === "STRONG_UP" ||
    setup.trend === "UP"
  ) {
    return "BULLISH";
  }

  if (
    setup.trend === "STRONG_DOWN" ||
    setup.trend === "DOWN"
  ) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

function hasStrongTrend(
  setup: SetupFingerprint,
): boolean {
  return (
    setup.trend === "STRONG_UP" ||
    setup.trend === "STRONG_DOWN"
  );
}

function hasTrend(
  setup: SetupFingerprint,
): boolean {
  return (
    setup.trend === "STRONG_UP" ||
    setup.trend === "UP" ||
    setup.trend === "STRONG_DOWN" ||
    setup.trend === "DOWN"
  );
}

function isBullish(
  setup: SetupFingerprint,
): boolean {
  return (
    setup.direction === "BUY" ||
    setup.trend === "UP" ||
    setup.trend === "STRONG_UP"
  );
}

function isBearish(
  setup: SetupFingerprint,
): boolean {
  return (
    setup.direction === "SELL" ||
    setup.trend === "DOWN" ||
    setup.trend === "STRONG_DOWN"
  );
}

function detectBreakout(
  setup: SetupFingerprint,
): PatternCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (
    setup.volume === "HIGH" ||
    setup.volume === "VERY_HIGH"
  ) {
    score += 30;
    reasons.push("elevated volume");
  }

  if (
    setup.volatility === "HIGH" ||
    setup.volatility === "EXTREME"
  ) {
    score += 20;
    reasons.push("expanded volatility");
  }

  if (
    setup.priceVsEma === "ABOVE_BOTH" ||
    setup.priceVsEma === "BELOW_BOTH"
  ) {
    score += 20;
    reasons.push("price displaced from EMA structure");
  }

  if (
    Math.abs(setup.changePercent ?? 0) >= 1
  ) {
    score += 20;
    reasons.push("strong price expansion");
  }

  if (
    hasStrongTrend(setup)
  ) {
    score += 10;
    reasons.push("strong directional trend");
  }

  return {
    pattern: "BREAKOUT",
    score,
    reasons,
  };
}

function detectTrendContinuation(
  setup: SetupFingerprint,
): PatternCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (hasTrend(setup)) {
    score += 25;
    reasons.push("directional trend");
  }

  if (
    setup.emaStructure === "BULLISH" ||
    setup.emaStructure === "BEARISH"
  ) {
    score += 25;
    reasons.push("aligned EMA structure");
  }

  if (
    setup.momentum === "BULLISH" ||
    setup.momentum === "STRONG_BULLISH" ||
    setup.momentum === "BEARISH" ||
    setup.momentum === "STRONG_BEARISH"
  ) {
    score += 25;
    reasons.push("directional momentum");
  }

  if (
    setup.priceVsEma === "ABOVE_BOTH" ||
    setup.priceVsEma === "BELOW_BOTH"
  ) {
    score += 15;
    reasons.push("price aligned with trend");
  }

  if (
    setup.volume === "NORMAL" ||
    setup.volume === "HIGH" ||
    setup.volume === "VERY_HIGH"
  ) {
    score += 10;
    reasons.push("supportive volume");
  }

  return {
    pattern: "TREND_CONTINUATION",
    score,
    reasons,
  };
}

function detectReversal(
  setup: SetupFingerprint,
): PatternCandidate {
  let score = 0;
  const reasons: string[] = [];

  const change =
    setup.changePercent ?? 0;

  if (
    setup.rsi !== null &&
    (setup.rsi <= 35 || setup.rsi >= 65)
  ) {
    score += 30;
    reasons.push("extreme RSI");
  }

  if (
    setup.momentum === "STRONG_BULLISH" ||
    setup.momentum === "STRONG_BEARISH"
  ) {
    score += 20;
    reasons.push("strong momentum extreme");
  }

  if (
    setup.priceVsEma === "BETWEEN"
  ) {
    score += 20;
    reasons.push("price inside EMA structure");
  }

  if (
    Math.abs(change) >= 1
  ) {
    score += 15;
    reasons.push("large directional move");
  }

  if (
    setup.direction === "BUY" &&
    setup.rsi !== null &&
    setup.rsi <= 40
  ) {
    score += 15;
    reasons.push("bullish signal from weak momentum");
  }

  if (
    setup.direction === "SELL" &&
    setup.rsi !== null &&
    setup.rsi >= 60
  ) {
    score += 15;
    reasons.push("bearish signal from strong momentum");
  }

  return {
    pattern: "REVERSAL",
    score,
    reasons,
  };
}

function detectMomentum(
  setup: SetupFingerprint,
): PatternCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (
    setup.momentum === "STRONG_BULLISH" ||
    setup.momentum === "STRONG_BEARISH"
  ) {
    score += 45;
    reasons.push("strong directional momentum");
  }

  if (
    setup.signalStrength >= 70
  ) {
    score += 25;
    reasons.push("high signal strength");
  }

  if (
    Math.abs(setup.changePercent ?? 0) >= 1
  ) {
    score += 15;
    reasons.push("strong price movement");
  }

  if (
    setup.volume === "HIGH" ||
    setup.volume === "VERY_HIGH"
  ) {
    score += 15;
    reasons.push("high volume");
  }

  return {
    pattern: "MOMENTUM",
    score,
    reasons,
  };
}

function detectRange(
  setup: SetupFingerprint,
): PatternCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (
    setup.trend === "NEUTRAL"
  ) {
    score += 35;
    reasons.push("neutral trend");
  }

  if (
    setup.volatility === "LOW"
  ) {
    score += 30;
    reasons.push("low volatility");
  }

  if (
    setup.priceVsEma === "BETWEEN"
  ) {
    score += 20;
    reasons.push("price between EMAs");
  }

  if (
    setup.momentum === "NEUTRAL"
  ) {
    score += 15;
    reasons.push("neutral momentum");
  }

  return {
    pattern: "RANGE",
    score,
    reasons,
  };
}

function detectVolatilityExpansion(
  setup: SetupFingerprint,
): PatternCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (
    setup.volatility === "HIGH" ||
    setup.volatility === "EXTREME"
  ) {
    score += 55;
    reasons.push("high volatility");
  }

  if (
    setup.volume === "HIGH" ||
    setup.volume === "VERY_HIGH"
  ) {
    score += 25;
    reasons.push("volume expansion");
  }

  if (
    Math.abs(setup.changePercent ?? 0) >= 1
  ) {
    score += 20;
    reasons.push("price expansion");
  }

  return {
    pattern: "VOLATILITY_EXPANSION",
    score,
    reasons,
  };
}

function detectVolatilityCompression(
  setup: SetupFingerprint,
): PatternCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (
    setup.volatility === "LOW"
  ) {
    score += 60;
    reasons.push("low volatility");
  }

  if (
    setup.volume === "WEAK" ||
    setup.volume === "VERY_WEAK"
  ) {
    score += 25;
    reasons.push("weak volume");
  }

  if (
    Math.abs(setup.changePercent ?? 0) < 0.5
  ) {
    score += 15;
    reasons.push("limited price movement");
  }

  return {
    pattern: "VOLATILITY_COMPRESSION",
    score,
    reasons,
  };
}

function detectAccumulation(
  setup: SetupFingerprint,
): PatternCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (
    setup.marketPhase === "ACCUMULATION"
  ) {
    score += 50;
    reasons.push("market accumulation phase");
  }

  if (
    setup.volatility === "LOW"
  ) {
    score += 20;
    reasons.push("compressed volatility");
  }

  if (
    setup.direction === "BUY"
  ) {
    score += 20;
    reasons.push("bullish setup direction");
  }

  if (
    setup.volume === "NORMAL" ||
    setup.volume === "HIGH"
  ) {
    score += 10;
    reasons.push("supportive volume");
  }

  return {
    pattern: "ACCUMULATION",
    score,
    reasons,
  };
}

function detectDistribution(
  setup: SetupFingerprint,
): PatternCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (
    setup.marketPhase === "DISTRIBUTION"
  ) {
    score += 50;
    reasons.push("market distribution phase");
  }

  if (
    setup.priceVsEma === "ABOVE_BOTH"
  ) {
    score += 20;
    reasons.push("price above EMA structure");
  }

  if (
    setup.direction === "SELL"
  ) {
    score += 20;
    reasons.push("bearish setup direction");
  }

  if (
    setup.volume === "WEAK" ||
    setup.volume === "VERY_WEAK"
  ) {
    score += 10;
    reasons.push("weakening volume");
  }

  return {
    pattern: "DISTRIBUTION",
    score,
    reasons,
  };
}

function detectCandidates(
  setup: SetupFingerprint,
): PatternCandidate[] {
  return [
    detectBreakout(setup),
    detectTrendContinuation(setup),
    detectReversal(setup),
    detectMomentum(setup),
    detectRange(setup),
    detectVolatilityExpansion(setup),
    detectVolatilityCompression(setup),
    detectAccumulation(setup),
    detectDistribution(setup),
  ];
}

function classifyHistoricalPattern(
  setup: SetupFingerprint,
): SetupPattern {
  const candidates =
    detectCandidates(setup)
      .sort(
        (a, b) =>
          b.score - a.score,
      );

  return (
    candidates[0]?.pattern ??
    "MIXED"
  );
}

function buildExplanation(
  pattern: SetupPattern,
  direction: PatternDirection,
  confidence: number,
  frequency: number,
): string {
  const directionText =
    direction === "BULLISH"
      ? "bullish"
      : direction === "BEARISH"
        ? "bearish"
        : "neutral";

  if (!frequency) {
    return `No recurring ${pattern.toLowerCase().replaceAll("_", " ")} pattern was found in available history.`;
  }

  return (
    `${pattern.toLowerCase().replaceAll("_", " ")} pattern ` +
    `with ${directionText} direction, ` +
    `${confidence}% recognition confidence, ` +
    `observed in ${frequency}% of comparable historical setups.`
  );
}

function uniqueStrings(
  values: string[],
): string[] {
  return [
    ...new Set(values),
  ];
}

export function recognizePattern(
  current: SetupFingerprint,
  historicalSetups: SetupFingerprint[],
  limit = 10,
): PatternRecognitionResult {
  const candidates =
    detectCandidates(current)
      .sort(
        (a, b) =>
          b.score - a.score,
      );

  const winner =
    candidates[0] ?? {
      pattern: "MIXED" as SetupPattern,
      score: 0,
      reasons: [],
    };

  const currentDirection =
    directionFromSetup(current);

  const similar =
    findMostSimilarSetups(
      current,
      historicalSetups,
      Math.max(1, Math.min(limit, 20)),
    );

  const historicalPatterns =
    similar.map((item) => ({
      ...item,
      pattern:
        classifyHistoricalPattern(item),
      direction:
        directionFromSetup(item),
    }));

  const matchingPatternCount =
    historicalPatterns.filter(
      (item) =>
        item.pattern === winner.pattern,
    ).length;

  const matchingDirectionCount =
    historicalPatterns.filter(
      (item) =>
        item.direction === currentDirection,
    ).length;

  const comparableCount =
    historicalPatterns.length;

  const patternFrequency =
    comparableCount > 0
      ? Math.round(
          (matchingPatternCount /
            comparableCount) *
            100,
        )
      : 0;

  const historicalSimilarity =
    comparableCount > 0
      ? historicalPatterns.reduce(
          (sum, item) =>
            sum + item.similarity.similarity,
          0,
        ) / comparableCount
      : 0;

  const directionAgreement =
    comparableCount > 0
      ? (matchingDirectionCount /
          comparableCount) *
        100
      : 0;

  const patternConfidence =
    comparableCount > 0
      ? Math.round(
          clamp(
            winner.score * 0.45 +
              historicalSimilarity * 0.35 +
              directionAgreement * 0.20,
            0,
            100,
          ),
        )
      : Math.round(
          clamp(
            winner.score,
            0,
            100,
          ),
        );

  const matches: PatternMatch[] =
    historicalPatterns
      .filter(
        (item) =>
          item.pattern === winner.pattern,
      )
      .map((item) => ({
        setupId: item.id,
        symbol: item.symbol,
        interval: item.interval,
        similarity: item.similarity.similarity,
        pattern: item.pattern,
        direction: item.direction,
      }));

  const supportingCharacteristics =
    uniqueStrings([
      ...winner.reasons,
      ...current.characteristics,
    ]).slice(0, 12);

  const conflictingCharacteristics =
    uniqueStrings(
      historicalPatterns
        .filter(
          (item) =>
            item.direction !==
            currentDirection,
        )
        .flatMap(
          (item) =>
            item.characteristics,
        ),
    ).slice(0, 8);

  const recognized =
    patternConfidence >= 55 &&
    (
      patternFrequency >= 30 ||
      comparableCount === 0
    );

  return {
    pattern: winner.pattern,
    direction: currentDirection,

    patternConfidence,
    patternFrequency,

    recognized,

    matches,

    supportingCharacteristics,
    conflictingCharacteristics,

    explanation:
      buildExplanation(
        winner.pattern,
        currentDirection,
        patternConfidence,
        patternFrequency,
      ),
  };
}
