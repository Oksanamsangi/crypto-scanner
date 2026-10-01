import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { SetupQualityScoreResult } from "./setup-quality-score.service.js";
import type { PatternRecognitionResult } from "./pattern-recognition.service.js";
import type { SetupEvolutionResult } from "./setup-evolution.service.js";

export type SignalConflictSeverity =
  | "INFO"
  | "WARNING"
  | "HIGH"
  | "CRITICAL";

export type SignalConflictState =
  | "ALIGNED"
  | "MIXED"
  | "CONFLICTED";

export type SignalConflictDirection =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export interface SignalConflict {
  name: string;
  severity: SignalConflictSeverity;
  score: number;
  direction: SignalConflictDirection;
  sides: {
    signal: string;
    opposing: string;
  };
  reason: string;
}

export interface SignalConflictInput {
  setup: SetupFingerprint;

  quality?: SetupQualityScoreResult | null;
  pattern?: PatternRecognitionResult | null;
  evolution?: SetupEvolutionResult | null;

  market?: {
    regime?: string | null;
    breadthScore?: number | null;
    crossMarketScore?: number | null;
    momentum?: string | null;
    volatilityState?: string | null;
  } | null;
}

export interface SignalConflictResult {
  state: SignalConflictState;
  conflictScore: number;
  confidence: number;

  dominantDirection: SignalConflictDirection;

  conflicts: SignalConflict[];
  agreements: string[];
  warnings: string[];

  explanation: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function isBullish(value: string | null | undefined): boolean {
  return (
    value === "BUY" ||
    value === "BULLISH" ||
    value === "STRONG_BULLISH" ||
    value === "UP" ||
    value === "STRONG_UP" ||
    value === "TRENDING_UP"
  );
}

function isBearish(value: string | null | undefined): boolean {
  return (
    value === "SELL" ||
    value === "BEARISH" ||
    value === "STRONG_BEARISH" ||
    value === "DOWN" ||
    value === "STRONG_DOWN" ||
    value === "TRENDING_DOWN"
  );
}

function signalDirection(
  signal: SetupFingerprint["direction"],
): SignalConflictDirection {
  if (signal === "BUY") return "BULLISH";
  if (signal === "SELL") return "BEARISH";
  return "NEUTRAL";
}

function oppositeDirection(
  direction: SignalConflictDirection,
): SignalConflictDirection {
  if (direction === "BULLISH") return "BEARISH";
  if (direction === "BEARISH") return "BULLISH";
  return "NEUTRAL";
}

function calculateState(score: number): SignalConflictState {
  if (score >= 50) return "CONFLICTED";
  if (score >= 20) return "MIXED";
  return "ALIGNED";
}

function calculateSeverity(score: number): SignalConflictSeverity {
  if (score >= 80) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 30) return "WARNING";
  return "INFO";
}

function addConflict(
  conflicts: SignalConflict[],
  name: string,
  score: number,
  direction: SignalConflictDirection,
  signal: string,
  opposing: string,
  reason: string,
): void {
  const normalizedScore = clamp(score);

  conflicts.push({
    name,
    severity: calculateSeverity(normalizedScore),
    score: normalizedScore,
    direction,
    sides: {
      signal,
      opposing,
    },
    reason,
  });
}

export function detectSignalConflicts(
  input: SignalConflictInput,
): SignalConflictResult {
  const { setup, quality, pattern, evolution, market } = input;

  const signalDirectionValue = signalDirection(setup.direction);
  const opposite = oppositeDirection(signalDirectionValue);

  const conflicts: SignalConflict[] = [];
  const agreements: string[] = [];
  const warnings: string[] = [];

  if (signalDirectionValue === "NEUTRAL") {
    addConflict(
      conflicts,
      "Undefined Signal Direction",
      90,
      "NEUTRAL",
      "NEUTRAL",
      "ACTIONABLE DIRECTION",
      "The setup does not provide a clear bullish or bearish direction.",
    );
  }

  // 1. Signal vs Trend
  const trendBullish = isBullish(setup.trend);
  const trendBearish = isBearish(setup.trend);

  if (
    (signalDirectionValue === "BULLISH" && trendBearish) ||
    (signalDirectionValue === "BEARISH" && trendBullish)
  ) {
    addConflict(
      conflicts,
      "Signal vs Trend",
      setup.trend.startsWith("STRONG_") ? 90 : 70,
      opposite,
      setup.direction,
      setup.trend,
      `The ${setup.direction} signal conflicts with ${setup.trend} trend structure.`,
    );
  } else if (
    (signalDirectionValue === "BULLISH" && trendBullish) ||
    (signalDirectionValue === "BEARISH" && trendBearish)
  ) {
    agreements.push("Signal and trend direction are aligned");
  }

  // 2. Signal vs Momentum
  const momentumBullish = isBullish(setup.momentum);
  const momentumBearish = isBearish(setup.momentum);

  if (
    (signalDirectionValue === "BULLISH" && momentumBearish) ||
    (signalDirectionValue === "BEARISH" && momentumBullish)
  ) {
    addConflict(
      conflicts,
      "Signal vs Momentum",
      setup.momentum.startsWith("STRONG_") ? 90 : 70,
      opposite,
      setup.direction,
      setup.momentum,
      `The ${setup.direction} signal conflicts with ${setup.momentum} momentum.`,
    );
  } else if (
    (signalDirectionValue === "BULLISH" && momentumBullish) ||
    (signalDirectionValue === "BEARISH" && momentumBearish)
  ) {
    agreements.push("Signal and momentum are aligned");
  }

  // 3. Signal vs EMA structure
  if (
    (signalDirectionValue === "BULLISH" &&
      setup.emaStructure === "BEARISH") ||
    (signalDirectionValue === "BEARISH" &&
      setup.emaStructure === "BULLISH")
  ) {
    addConflict(
      conflicts,
      "Signal vs EMA Structure",
      80,
      opposite,
      setup.direction,
      setup.emaStructure,
      `The ${setup.direction} signal conflicts with ${setup.emaStructure} EMA structure.`,
    );
  } else if (
    (signalDirectionValue === "BULLISH" &&
      setup.emaStructure === "BULLISH") ||
    (signalDirectionValue === "BEARISH" &&
      setup.emaStructure === "BEARISH")
  ) {
    agreements.push("Signal and EMA structure are aligned");
  }

  // 4. Signal vs price position
  if (
    (signalDirectionValue === "BULLISH" &&
      setup.priceVsEma === "BELOW_BOTH") ||
    (signalDirectionValue === "BEARISH" &&
      setup.priceVsEma === "ABOVE_BOTH")
  ) {
    addConflict(
      conflicts,
      "Signal vs Price Position",
      65,
      opposite,
      setup.direction,
      setup.priceVsEma,
      `Price position (${setup.priceVsEma}) conflicts with the ${setup.direction} signal.`,
    );
  }

  // 5. Signal vs market breadth
  const breadthScore =
    market?.breadthScore ?? setup.breadthScore;

  if (breadthScore !== null && breadthScore !== undefined) {
    if (
      (signalDirectionValue === "BULLISH" && breadthScore <= -30) ||
      (signalDirectionValue === "BEARISH" && breadthScore >= 30)
    ) {
      addConflict(
        conflicts,
        "Signal vs Market Breadth",
        clamp(50 + Math.abs(breadthScore) * 0.4),
        opposite,
        setup.direction,
        `Breadth ${breadthScore}`,
        `Market breadth score (${breadthScore}) points against the signal direction.`,
      );
    } else if (
      (signalDirectionValue === "BULLISH" && breadthScore >= 30) ||
      (signalDirectionValue === "BEARISH" && breadthScore <= -30)
    ) {
      agreements.push("Signal and market breadth are aligned");
    }
  }

  // 6. Signal vs cross-market confirmation
  const crossMarketScore =
    market?.crossMarketScore ?? setup.crossMarketScore;

  if (
    crossMarketScore !== null &&
    crossMarketScore !== undefined
  ) {
    if (
      (signalDirectionValue === "BULLISH" &&
        crossMarketScore <= -30) ||
      (signalDirectionValue === "BEARISH" &&
        crossMarketScore >= 30)
    ) {
      addConflict(
        conflicts,
        "Signal vs Cross-Market",
        clamp(50 + Math.abs(crossMarketScore) * 0.4),
        opposite,
        setup.direction,
        `Cross-market ${crossMarketScore}`,
        `Cross-market score (${crossMarketScore}) points against the signal direction.`,
      );
    } else if (
      (signalDirectionValue === "BULLISH" &&
        crossMarketScore >= 30) ||
      (signalDirectionValue === "BEARISH" &&
        crossMarketScore <= -30)
    ) {
      agreements.push("Signal and cross-market confirmation are aligned");
    }
  }

  // 7. Signal vs market regime
  const marketRegime =
    market?.regime ?? setup.marketRegime;

  if (marketRegime) {
    const regimeBullish = isBullish(marketRegime);
    const regimeBearish = isBearish(marketRegime);

    if (
      (signalDirectionValue === "BULLISH" && regimeBearish) ||
      (signalDirectionValue === "BEARISH" && regimeBullish)
    ) {
      addConflict(
        conflicts,
        "Signal vs Market Regime",
        75,
        opposite,
        setup.direction,
        marketRegime,
        `The ${setup.direction} signal conflicts with ${marketRegime} market regime.`,
      );
    } else if (
      (signalDirectionValue === "BULLISH" && regimeBullish) ||
      (signalDirectionValue === "BEARISH" && regimeBearish)
    ) {
      agreements.push("Signal and market regime are aligned");
    }
  }

  // 8. Pattern direction conflict
  if (pattern) {
    const patternBullish = pattern.direction === "BULLISH";
    const patternBearish = pattern.direction === "BEARISH";

    if (
      (signalDirectionValue === "BULLISH" && patternBearish) ||
      (signalDirectionValue === "BEARISH" && patternBullish)
    ) {
      addConflict(
        conflicts,
        "Signal vs Pattern",
        pattern.patternConfidence >= 70 ? 80 : 60,
        opposite,
        setup.direction,
        `${pattern.pattern} / ${pattern.direction}`,
        `Recognized pattern direction conflicts with the ${setup.direction} signal.`,
      );
    } else if (
      (signalDirectionValue === "BULLISH" && patternBullish) ||
      (signalDirectionValue === "BEARISH" && patternBearish)
    ) {
      agreements.push("Signal and recognized pattern direction are aligned");
    } else if (!pattern.recognized) {
      warnings.push("Pattern recognition does not provide strong confirmation");
    }
  }

  // 9. Evolution conflict
  if (evolution) {
    const evolutionBullish = evolution.direction === "BULLISH";
    const evolutionBearish = evolution.direction === "BEARISH";

    const directionConflict =
      (signalDirectionValue === "BULLISH" && evolutionBearish) ||
      (signalDirectionValue === "BEARISH" && evolutionBullish);

    const deterioration =
      evolution.state === "WEAKENING" ||
      evolution.state === "FADING" ||
      evolution.state === "REVERSING";

    if (directionConflict || deterioration) {
      const score =
        evolution.state === "REVERSING"
          ? 90
          : evolution.state === "FADING"
            ? 75
            : evolution.state === "WEAKENING"
              ? 60
              : 65;

      addConflict(
        conflicts,
        "Signal vs Setup Evolution",
        score,
        directionConflict ? opposite : signalDirectionValue,
        setup.direction,
        `${evolution.state} / ${evolution.direction}`,
        `Setup evolution (${evolution.state}) does not fully support the current signal.`,
      );
    } else if (
      (signalDirectionValue === "BULLISH" && evolutionBullish) ||
      (signalDirectionValue === "BEARISH" && evolutionBearish)
    ) {
      agreements.push("Signal and setup evolution are aligned");
    }
  }

  // 10. Quality conflict
  if (quality) {
    if (quality.qualityScore < 50) {
      addConflict(
        conflicts,
        "Signal vs Setup Quality",
        80,
        signalDirectionValue,
        setup.direction,
        `Quality ${quality.qualityScore}`,
        `The setup quality score is only ${quality.qualityScore}/100.`,
      );
    } else if (quality.qualityScore >= 75) {
      agreements.push("Setup quality strongly supports the signal");
    } else {
      warnings.push(
        `Setup quality is moderate at ${quality.qualityScore}/100`,
      );
    }
  }

  // 11. Volatility conflict
  const volatility =
    market?.volatilityState ?? setup.volatility;

  if (
    volatility === "EXTREME"
  ) {
    addConflict(
      conflicts,
      "Signal vs Volatility Environment",
      60,
      "NEUTRAL",
      setup.direction,
      "EXTREME_VOLATILITY",
      "Extreme volatility can make directional signals less reliable.",
    );

    warnings.push("Extreme volatility reduces signal stability");
  } else if (volatility === "LOW") {
    warnings.push("Low volatility may reduce breakout follow-through");
  }

  const totalConflictWeight =
    conflicts.reduce((sum, conflict) => {
      const weight =
        conflict.severity === "CRITICAL"
          ? 1.25
          : conflict.severity === "HIGH"
            ? 1
            : conflict.severity === "WARNING"
              ? 0.7
              : 0.4;

      return sum + conflict.score * weight;
    }, 0);

  const totalWeight = conflicts.reduce((sum, conflict) => {
    const weight =
      conflict.severity === "CRITICAL"
        ? 1.25
        : conflict.severity === "HIGH"
          ? 1
          : conflict.severity === "WARNING"
            ? 0.7
            : 0.4;

    return sum + weight;
  }, 0);

  const rawConflictScore =
    totalWeight > 0
      ? totalConflictWeight / totalWeight
      : 0;

  const agreementBonus = Math.min(
    15,
    agreements.length * 2,
  );

  const conflictScore = Math.round(
    clamp(rawConflictScore - agreementBonus),
  );

  const state = calculateState(conflictScore);

  const evidence =
    conflicts.length +
    agreements.length +
    warnings.length;

  const confidence = Math.round(
    clamp(
      45 +
        Math.min(35, evidence * 3) +
        (conflicts.length > 0 ? 5 : 0),
    ),
  );

  let explanation: string;

  if (state === "CONFLICTED") {
    explanation =
      "Multiple intelligence layers disagree with the current signal. The setup should be treated as conflicted until stronger confirmation appears.";
  } else if (state === "MIXED") {
    explanation =
      "The signal has both supporting and opposing evidence across intelligence layers. The setup is mixed rather than cleanly aligned.";
  } else {
    explanation =
      "The available intelligence layers are broadly aligned with the current signal and no major conflict is detected.";
  }

  return {
    state,
    conflictScore,
    confidence,
    dominantDirection: signalDirectionValue,
    conflicts,
    agreements,
    warnings,
    explanation,
  };
}

export const signalConflictDetector = {
  detect: detectSignalConflicts,
};
