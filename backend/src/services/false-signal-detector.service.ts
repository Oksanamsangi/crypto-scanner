import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { SetupQualityScoreResult } from "./setup-quality-score.service.js";
import type { PatternRecognitionResult } from "./pattern-recognition.service.js";
import type { SetupEvolutionResult } from "./setup-evolution.service.js";

export type FalseSignalRisk =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "CRITICAL";

export type FalseSignalState =
  | "PASS"
  | "CAUTION"
  | "REJECT";

export type FalseSignalSeverity =
  | "INFO"
  | "WARNING"
  | "HIGH"
  | "CRITICAL";

export interface FalseSignalFactor {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  severity: FalseSignalSeverity;
  reason: string;
}

export interface FalseSignalInput {
  setup: SetupFingerprint;

  quality?: SetupQualityScoreResult | null;
  pattern?: PatternRecognitionResult | null;
  evolution?: SetupEvolutionResult | null;

  market?: {
    breadthScore?: number | null;
    crossMarketScore?: number | null;
    regime?: string | null;
    volatilityState?: string | null;
  } | null;
}

export interface FalseSignalResult {
  state: FalseSignalState;
  risk: FalseSignalRisk;
  falseSignalScore: number;
  confidence: number;

  factors: FalseSignalFactor[];

  triggers: string[];
  protections: string[];

  explanation: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function getDirection(setup: SetupFingerprint): "BUY" | "SELL" | "NEUTRAL" {
  return setup.direction;
}

function addFactor(
  factors: FalseSignalFactor[],
  name: string,
  score: number,
  weight: number,
  severity: FalseSignalSeverity,
  reason: string,
): void {
  const normalizedScore = clamp(score);

  factors.push({
    name,
    score: normalizedScore,
    weight,
    contribution: normalizedScore * weight,
    severity,
    reason,
  });
}

function isBullishDirection(direction: string): boolean {
  return (
    direction === "BUY" ||
    direction === "BULLISH" ||
    direction === "STRONG_BULLISH" ||
    direction === "UP" ||
    direction === "STRONG_UP"
  );
}

function isBearishDirection(direction: string): boolean {
  return (
    direction === "SELL" ||
    direction === "BEARISH" ||
    direction === "STRONG_BEARISH" ||
    direction === "DOWN" ||
    direction === "STRONG_DOWN"
  );
}

function calculateRisk(score: number): FalseSignalRisk {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

function calculateState(score: number): FalseSignalState {
  if (score >= 50) return "REJECT";
  if (score >= 25) return "CAUTION";
  return "PASS";
}

export function detectFalseSignal(
  input: FalseSignalInput,
): FalseSignalResult {
  const { setup, quality, pattern, evolution, market } = input;
  const direction = getDirection(setup);

  const factors: FalseSignalFactor[] = [];
  const triggers: string[] = [];
  const protections: string[] = [];

  if (direction === "NEUTRAL") {
    addFactor(
      factors,
      "Signal Direction",
      100,
      0.08,
      "CRITICAL",
      "The setup has no actionable direction.",
    );

    triggers.push("No actionable signal direction");
  } else {
    addFactor(
      factors,
      "Signal Direction",
      0,
      0.08,
      "INFO",
      "The setup has a defined directional signal.",
    );

    protections.push("Directional signal is clearly defined");
  }

  if (
    setup.volume === "VERY_WEAK" ||
    setup.volume === "WEAK"
  ) {
    const score = setup.volume === "VERY_WEAK" ? 80 : 55;

    addFactor(
      factors,
      "Volume Confirmation",
      score,
      0.14,
      score >= 70 ? "HIGH" : "WARNING",
      `Volume state is ${setup.volume}, reducing confidence in the signal.`,
    );

    triggers.push("Weak volume confirmation");
  } else {
    addFactor(
      factors,
      "Volume Confirmation",
      0,
      0.14,
      "INFO",
      "Volume provides reasonable confirmation.",
    );

    protections.push("Volume confirmation is supportive");
  }

  const momentumContradiction =
    (direction === "BUY" &&
      isBearishDirection(setup.momentum)) ||
    (direction === "SELL" &&
      isBullishDirection(setup.momentum));

  if (momentumContradiction) {
    addFactor(
      factors,
      "Momentum Contradiction",
      85,
      0.13,
      "HIGH",
      `Signal direction conflicts with ${setup.momentum} momentum.`,
    );

    triggers.push("Momentum contradicts signal direction");
  } else {
    addFactor(
      factors,
      "Momentum Contradiction",
      0,
      0.13,
      "INFO",
      "Momentum is aligned with or neutral to the signal.",
    );

    protections.push("Momentum does not contradict the signal");
  }

  const trendContradiction =
    (direction === "BUY" &&
      (setup.trend === "DOWN" || setup.trend === "STRONG_DOWN")) ||
    (direction === "SELL" &&
      (setup.trend === "UP" || setup.trend === "STRONG_UP"));

  if (trendContradiction) {
    addFactor(
      factors,
      "Trend Contradiction",
      85,
      0.13,
      "HIGH",
      `Signal direction conflicts with ${setup.trend} trend structure.`,
    );

    triggers.push("Trend contradicts signal direction");
  } else {
    addFactor(
      factors,
      "Trend Contradiction",
      0,
      0.13,
      "INFO",
      "Trend structure does not directly contradict the signal.",
    );

    protections.push("Trend structure is supportive");
  }

  const emaContradiction =
    (direction === "BUY" && setup.emaStructure === "BEARISH") ||
    (direction === "SELL" && setup.emaStructure === "BULLISH");

  if (emaContradiction) {
    addFactor(
      factors,
      "EMA Structure Contradiction",
      80,
      0.10,
      "HIGH",
      `EMA structure is ${setup.emaStructure}, conflicting with the signal.`,
    );

    triggers.push("EMA structure contradicts signal");
  } else {
    addFactor(
      factors,
      "EMA Structure Contradiction",
      0,
      0.10,
      "INFO",
      "EMA structure does not directly contradict the signal.",
    );

    protections.push("EMA structure is not contradictory");
  }

  const breadthScore = market?.breadthScore ?? setup.breadthScore;

  if (breadthScore !== null && breadthScore !== undefined) {
    const breadthContradiction =
      (direction === "BUY" && breadthScore <= -35) ||
      (direction === "SELL" && breadthScore >= 35);

    if (breadthContradiction) {
      const score = clamp(55 + Math.abs(breadthScore) * 0.35);

      addFactor(
        factors,
        "Market Breadth Contradiction",
        score,
        0.09,
        score >= 70 ? "HIGH" : "WARNING",
        `Market breadth score (${breadthScore}) contradicts the setup direction.`,
      );

      triggers.push("Market breadth contradicts signal");
    } else {
      addFactor(
        factors,
        "Market Breadth Contradiction",
        0,
        0.09,
        "INFO",
        "Market breadth does not materially contradict the signal.",
      );

      protections.push("Market breadth is not strongly contradictory");
    }
  }

  const crossMarketScore =
    market?.crossMarketScore ?? setup.crossMarketScore;

  if (
    crossMarketScore !== null &&
    crossMarketScore !== undefined
  ) {
    const crossMarketContradiction =
      (direction === "BUY" && crossMarketScore <= -35) ||
      (direction === "SELL" && crossMarketScore >= 35);

    if (crossMarketContradiction) {
      const score = clamp(55 + Math.abs(crossMarketScore) * 0.35);

      addFactor(
        factors,
        "Cross-Market Contradiction",
        score,
        0.10,
        score >= 70 ? "HIGH" : "WARNING",
        `Cross-market score (${crossMarketScore}) conflicts with the setup direction.`,
      );

      triggers.push("Cross-market confirmation contradicts signal");
    } else {
      addFactor(
        factors,
        "Cross-Market Contradiction",
        0,
        0.10,
        "INFO",
        "Cross-market confirmation does not materially contradict the signal.",
      );

      protections.push("Cross-market context is not contradictory");
    }
  }

  const extremeVolatility =
    setup.volatility === "EXTREME" ||
    market?.volatilityState === "EXTREME";

  if (extremeVolatility) {
    addFactor(
      factors,
      "Volatility Trap",
      70,
      0.08,
      "HIGH",
      "Extreme volatility increases the probability of unstable or misleading signals.",
    );

    triggers.push("Extreme volatility environment");
  } else {
    addFactor(
      factors,
      "Volatility Trap",
      0,
      0.08,
      "INFO",
      "Volatility is not classified as extreme.",
    );

    protections.push("No extreme volatility trap detected");
  }

  if (pattern) {
    const patternRisk =
      !pattern.recognized
        ? pattern.patternConfidence < 40
          ? 75
          : 45
        : 0;

    addFactor(
      factors,
      "Pattern Recognition",
      patternRisk,
      0.07,
      patternRisk >= 70
        ? "HIGH"
        : patternRisk >= 40
          ? "WARNING"
          : "INFO",
      pattern.recognized
        ? `Pattern ${pattern.pattern} is historically recognized.`
        : "No sufficiently recognized historical pattern supports the setup.",
    );

    if (patternRisk > 0) {
      triggers.push("Weak historical pattern support");
    } else {
      protections.push("Historical pattern support is present");
    }
  }

  if (quality) {
    const qualityRisk =
      quality.qualityScore < 50
        ? 80
        : quality.qualityScore < 60
          ? 55
          : quality.qualityScore < 70
            ? 30
            : 0;

    addFactor(
      factors,
      "Setup Quality",
      qualityRisk,
      0.08,
      qualityRisk >= 70
        ? "HIGH"
        : qualityRisk >= 40
          ? "WARNING"
          : "INFO",
      `Setup quality is ${quality.qualityScore}/100.`,
    );

    if (qualityRisk > 0) {
      triggers.push("Low setup quality");
    } else {
      protections.push("Setup quality is acceptable or strong");
    }
  }

  if (evolution) {
    const evolutionRisk =
      evolution.state === "REVERSING"
        ? 80
        : evolution.state === "FADING"
          ? 70
          : evolution.state === "WEAKENING"
            ? 55
            : 0;

    addFactor(
      factors,
      "Setup Evolution",
      evolutionRisk,
      0.08,
      evolutionRisk >= 70
        ? "HIGH"
        : evolutionRisk >= 40
          ? "WARNING"
          : "INFO",
      `Setup evolution state is ${evolution.state}.`,
    );

    if (evolutionRisk > 0) {
      triggers.push("Setup evolution is weakening or reversing");
    } else {
      protections.push("Setup evolution is not showing deterioration");
    }
  }

  const totalWeight = factors.reduce(
    (sum, factor) => sum + factor.weight,
    0,
  );

  const weightedScore =
    factors.reduce(
      (sum, factor) => sum + factor.contribution,
      0,
    ) / totalWeight;

  const falseSignalScore = Math.round(clamp(weightedScore));

  const evidenceCount =
    factors.length +
    (market?.breadthScore !== undefined ? 1 : 0) +
    (market?.crossMarketScore !== undefined ? 1 : 0) +
    (quality ? 1 : 0) +
    (pattern ? 1 : 0) +
    (evolution ? 1 : 0);

  const confidence = Math.round(
    clamp(
      45 +
        Math.min(30, evidenceCount * 2) +
        (triggers.length >= 3 ? 10 : 0) +
        (protections.length >= 4 ? 10 : 0),
    ),
  );

  const risk = calculateRisk(falseSignalScore);
  const state = calculateState(falseSignalScore);

  let explanation: string;

  if (state === "REJECT") {
    explanation =
      "The setup contains multiple significant conditions associated with false or unreliable signals. It should not pass the signal-defense layer without further validation.";
  } else if (state === "CAUTION") {
    explanation =
      "The setup has some conditions that can reduce signal reliability. Additional confirmation is warranted before treating the signal as strong.";
  } else {
    explanation =
      "The setup currently has limited evidence of false-signal conditions and passes the initial signal-defense check.";
  }

  return {
    state,
    risk,
    falseSignalScore,
    confidence,
    factors,
    triggers,
    protections,
    explanation,
  };
}

export const falseSignalDetector = {
  detect: detectFalseSignal,
};
