import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { SetupQualityScoreResult } from "./setup-quality-score.service.js";
import type { PatternRecognitionResult } from "./pattern-recognition.service.js";
import type { SetupEvolutionResult } from "./setup-evolution.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";

export type WhyNotSeverity =
  | "INFO"
  | "WARNING"
  | "HIGH"
  | "CRITICAL";

export type WhyNotRisk =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "CRITICAL";

export type WhyNotCategory =
  | "TREND"
  | "MOMENTUM"
  | "VOLUME"
  | "STRUCTURE"
  | "MARKET"
  | "CROSS_MARKET"
  | "PATTERN"
  | "EVOLUTION"
  | "QUALITY"
  | "VOLATILITY"
  | "FALSE_SIGNAL"
  | "CONFLICT";

export interface WhyNotReason {
  code: string;
  category: WhyNotCategory;
  severity: WhyNotSeverity;
  score: number;
  title: string;
  explanation: string;
}

export interface WhyNotInput {
  setup: SetupFingerprint;
  quality?: SetupQualityScoreResult | null;
  pattern?: PatternRecognitionResult | null;
  evolution?: SetupEvolutionResult | null;
  falseSignal?: FalseSignalResult | null;
  conflicts?: SignalConflictResult | null;
  market?: {
    regime?: string | null;
    breadthScore?: number | null;
    crossMarketScore?: number | null;
    momentum?: string | null;
    volatilityState?: string | null;
  } | null;
}

export interface WhyNotResult {
  shouldReject: boolean;
  rejectionScore: number;
  confidence: number;
  risk: WhyNotRisk;
  reasons: WhyNotReason[];
  blockers: string[];
  warnings: string[];
  supportingFactors: string[];
  explanation: string;
  recommendation:
    | "ACCEPT"
    | "CAUTION"
    | "DO_NOT_TRADE";
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function isBullish(value: string | null | undefined): boolean {
  if (!value) return false;

  return [
    "BUY",
    "BULLISH",
    "STRONG_BULLISH",
    "STRONG_UP",
    "UP",
    "TRENDING_UP",
  ].includes(value);
}

function isBearish(value: string | null | undefined): boolean {
  if (!value) return false;

  return [
    "SELL",
    "BEARISH",
    "STRONG_BEARISH",
    "STRONG_DOWN",
    "DOWN",
    "TRENDING_DOWN",
  ].includes(value);
}

function signalDirection(
  signal: SetupFingerprint["direction"],
): "BULLISH" | "BEARISH" | "NEUTRAL" {
  if (signal === "BUY") return "BULLISH";
  if (signal === "SELL") return "BEARISH";
  return "NEUTRAL";
}

function oppositeDirection(
  signal: SetupFingerprint["direction"],
  value: string | null | undefined,
): boolean {
  const direction = signalDirection(signal);

  if (direction === "BULLISH") return isBearish(value);
  if (direction === "BEARISH") return isBullish(value);

  return false;
}

function severityFromScore(score: number): WhyNotSeverity {
  if (score >= 80) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 30) return "WARNING";
  return "INFO";
}

function riskFromScore(score: number): WhyNotRisk {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

function createReason(
  code: string,
  category: WhyNotCategory,
  score: number,
  title: string,
  explanation: string,
): WhyNotReason {
  return {
    code,
    category,
    severity: severityFromScore(score),
    score: clamp(Math.round(score)),
    title,
    explanation,
  };
}

export function buildWhyNotEngine(
  input: WhyNotInput,
): WhyNotResult {
  const {
    setup,
    quality,
    pattern,
    evolution,
    falseSignal,
    conflicts,
    market,
  } = input;

  const reasons: WhyNotReason[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const supportingFactors: string[] = [];

  const direction = signalDirection(setup.direction);

  // ------------------------------------------------------------
  // 1. FALSE SIGNAL DEFENSE
  // ------------------------------------------------------------

  if (falseSignal) {
    if (falseSignal.state === "REJECT") {
      const score = Math.max(
        70,
        falseSignal.falseSignalScore,
      );

      reasons.push(
        createReason(
          "FALSE_SIGNAL_REJECT",
          "FALSE_SIGNAL",
          score,
          "False-signal defense rejected the setup",
          `The false-signal detector classified this ${setup.direction} setup as ${falseSignal.risk.toLowerCase()} risk.`,
        ),
      );

      blockers.push("FALSE_SIGNAL_REJECT");
    } else if (falseSignal.state === "CAUTION") {
      reasons.push(
        createReason(
          "FALSE_SIGNAL_CAUTION",
          "FALSE_SIGNAL",
          falseSignal.falseSignalScore,
          "False-signal risk requires caution",
          `The false-signal detector identified elevated ${falseSignal.risk.toLowerCase()} risk.`,
        ),
      );

      warnings.push("FALSE_SIGNAL_CAUTION");
    } else {
      supportingFactors.push(
        "False-signal defense passed",
      );
    }
  }

  // ------------------------------------------------------------
  // 2. SIGNAL CONFLICTS
  // ------------------------------------------------------------

  if (conflicts) {
    if (conflicts.state === "CONFLICTED") {
      const score = Math.max(
        65,
        conflicts.conflictScore,
      );

      reasons.push(
        createReason(
          "SIGNAL_CONFLICT",
          "CONFLICT",
          score,
          "Multiple signal layers conflict",
          conflicts.explanation,
        ),
      );

      blockers.push("SIGNAL_CONFLICT");
    } else if (conflicts.state === "MIXED") {
      reasons.push(
        createReason(
          "MIXED_SIGNAL",
          "CONFLICT",
          conflicts.conflictScore,
          "Signal confirmation is mixed",
          conflicts.explanation,
        ),
      );

      warnings.push("MIXED_SIGNAL");
    } else {
      supportingFactors.push(
        "Signal layers are aligned",
      );
    }
  }

  // ------------------------------------------------------------
  // 3. TREND
  // ------------------------------------------------------------

  if (oppositeDirection(setup.direction, setup.trend)) {
    const score =
      setup.trend.startsWith("STRONG_") ? 90 : 70;

    reasons.push(
      createReason(
        "TREND_CONFLICT",
        "TREND",
        score,
        "Trend contradicts signal direction",
        `${setup.direction} conflicts with the ${setup.trend.toLowerCase().replace("_", " ")} trend structure.`,
      ),
    );

    blockers.push("TREND_CONFLICT");
  } else {
    supportingFactors.push(
      "Trend supports signal direction",
    );
  }

  // ------------------------------------------------------------
  // 4. MOMENTUM
  // ------------------------------------------------------------

  if (oppositeDirection(setup.direction, setup.momentum)) {
    const score =
      setup.momentum.startsWith("STRONG_") ? 85 : 65;

    reasons.push(
      createReason(
        "MOMENTUM_CONFLICT",
        "MOMENTUM",
        score,
        "Momentum contradicts signal direction",
        `${setup.direction} is not supported by the current ${setup.momentum.toLowerCase().replace("_", " ")} momentum state.`,
      ),
    );

    blockers.push("MOMENTUM_CONFLICT");
  } else {
    supportingFactors.push(
      "Momentum supports signal direction",
    );
  }

  // ------------------------------------------------------------
  // 5. VOLUME
  // ------------------------------------------------------------

  if (
    setup.volume === "VERY_WEAK" ||
    setup.volume === "WEAK"
  ) {
    const score =
      setup.volume === "VERY_WEAK" ? 70 : 45;

    reasons.push(
      createReason(
        "WEAK_VOLUME",
        "VOLUME",
        score,
        "Volume confirmation is weak",
        `The setup has ${setup.volume.toLowerCase().replace("_", " ")} volume confirmation.`,
      ),
    );

    if (score >= 60) {
      blockers.push("WEAK_VOLUME");
    } else {
      warnings.push("WEAK_VOLUME");
    }
  } else {
    supportingFactors.push(
      "Volume provides confirmation",
    );
  }

  // ------------------------------------------------------------
  // 6. EMA STRUCTURE
  // ------------------------------------------------------------

  if (
    (direction === "BULLISH" &&
      setup.emaStructure === "BEARISH") ||
    (direction === "BEARISH" &&
      setup.emaStructure === "BULLISH")
  ) {
    reasons.push(
      createReason(
        "EMA_STRUCTURE_CONFLICT",
        "STRUCTURE",
        75,
        "EMA structure contradicts signal",
        `The EMA structure is ${setup.emaStructure.toLowerCase()}, which conflicts with the ${setup.direction} signal.`,
      ),
    );

    blockers.push("EMA_STRUCTURE_CONFLICT");
  } else {
    supportingFactors.push(
      "EMA structure is compatible with signal",
    );
  }

  // ------------------------------------------------------------
  // 7. MARKET BREADTH
  // ------------------------------------------------------------

  if (market?.breadthScore !== null &&
      market?.breadthScore !== undefined) {
    const breadth = market.breadthScore;

    if (
      (direction === "BULLISH" && breadth <= -30) ||
      (direction === "BEARISH" && breadth >= 30)
    ) {
      const score = clamp(
        45 + Math.abs(breadth) * 0.5,
      );

      reasons.push(
        createReason(
          "MARKET_BREADTH_CONFLICT",
          "MARKET",
          score,
          "Market breadth contradicts signal",
          `Market breadth is ${Math.round(breadth)}, indicating participation against the setup direction.`,
        ),
      );

      if (score >= 60) {
        blockers.push("MARKET_BREADTH_CONFLICT");
      } else {
        warnings.push("MARKET_BREADTH_CONFLICT");
      }
    } else {
      supportingFactors.push(
        "Market breadth supports the setup",
      );
    }
  }

  // ------------------------------------------------------------
  // 8. CROSS-MARKET
  // ------------------------------------------------------------

  if (
    market?.crossMarketScore !== null &&
    market?.crossMarketScore !== undefined
  ) {
    const crossMarket = market.crossMarketScore;

    if (
      (direction === "BULLISH" && crossMarket <= -30) ||
      (direction === "BEARISH" && crossMarket >= 30)
    ) {
      const score = clamp(
        45 + Math.abs(crossMarket) * 0.5,
      );

      reasons.push(
        createReason(
          "CROSS_MARKET_CONFLICT",
          "CROSS_MARKET",
          score,
          "Cross-market confirmation contradicts signal",
          `Cross-market confirmation is ${Math.round(crossMarket)}, indicating external market conditions are not supporting the setup.`,
        ),
      );

      if (score >= 60) {
        blockers.push("CROSS_MARKET_CONFLICT");
      } else {
        warnings.push("CROSS_MARKET_CONFLICT");
      }
    } else {
      supportingFactors.push(
        "Cross-market confirmation is supportive",
      );
    }
  }

  // ------------------------------------------------------------
  // 9. MARKET REGIME
  // ------------------------------------------------------------

  if (oppositeDirection(
    setup.direction,
    market?.regime,
  )) {
    reasons.push(
      createReason(
        "MARKET_REGIME_CONFLICT",
        "MARKET",
        70,
        "Market regime contradicts setup",
        `The broader market regime is ${market?.regime}, which conflicts with the ${setup.direction} setup.`,
      ),
    );

    blockers.push("MARKET_REGIME_CONFLICT");
  }

  // ------------------------------------------------------------
  // 10. VOLATILITY
  // ------------------------------------------------------------

  const volatilityState =
    market?.volatilityState ?? setup.volatility;

  if (
    volatilityState === "EXTREME" ||
    setup.volatility === "EXTREME"
  ) {
    reasons.push(
      createReason(
        "EXTREME_VOLATILITY",
        "VOLATILITY",
        80,
        "Extreme volatility increases rejection risk",
        "The current volatility environment is extreme, reducing the reliability of directional confirmation.",
      ),
    );

    blockers.push("EXTREME_VOLATILITY");
  }

  // ------------------------------------------------------------
  // 11. QUALITY
  // ------------------------------------------------------------

  if (quality) {
    if (quality.qualityScore < 50) {
      const score = 85;

      reasons.push(
        createReason(
          "LOW_SETUP_QUALITY",
          "QUALITY",
          score,
          "Setup quality is too weak",
          `The setup quality score is ${quality.qualityScore}/100 (${quality.grade}).`,
        ),
      );

      blockers.push("LOW_SETUP_QUALITY");
    } else if (quality.qualityScore < 65) {
      reasons.push(
        createReason(
          "MODERATE_SETUP_QUALITY",
          "QUALITY",
          45,
          "Setup quality is only moderate",
          `The setup quality score is ${quality.qualityScore}/100 (${quality.grade}).`,
        ),
      );

      warnings.push("MODERATE_SETUP_QUALITY");
    } else {
      supportingFactors.push(
        `Strong setup quality (${quality.qualityScore}/100)`,
      );
    }
  }

  // ------------------------------------------------------------
  // 12. PATTERN
  // ------------------------------------------------------------

  if (pattern) {
    if (
      pattern.recognized &&
      pattern.patternConfidence >= 65
    ) {
      supportingFactors.push(
        `Recognized ${pattern.pattern} pattern`,
      );
    } else if (
      pattern.recognized &&
      pattern.patternConfidence < 50
    ) {
      reasons.push(
        createReason(
          "WEAK_PATTERN_SUPPORT",
          "PATTERN",
          35,
          "Pattern support is weak",
          "Historical pattern recognition does not provide strong confirmation for this setup.",
        ),
      );

      warnings.push("WEAK_PATTERN_SUPPORT");
    }
  }

  // ------------------------------------------------------------
  // 13. EVOLUTION
  // ------------------------------------------------------------

  if (evolution) {
    if (
      evolution.state === "WEAKENING" ||
      evolution.state === "FADING"
    ) {
      const score =
        evolution.state === "FADING" ? 70 : 60;

      reasons.push(
        createReason(
          "SETUP_WEAKENING",
          "EVOLUTION",
          score,
          "Setup is losing strength",
          evolution.explanation,
        ),
      );

      if (score >= 60) {
        blockers.push("SETUP_WEAKENING");
      }
    } else if (evolution.state === "STRENGTHENING") {
      supportingFactors.push(
        "Setup evolution is strengthening",
      );
    }
  }

  // ------------------------------------------------------------
  // FINAL SCORE
  // ------------------------------------------------------------

  const weightedReasons =
    reasons.length === 0
      ? 0
      : reasons.reduce(
          (sum, reason) => sum + reason.score,
          0,
        ) / reasons.length;

  const blockerBonus = Math.min(
    25,
    blockers.length * 7,
  );

  const warningBonus = Math.min(
    10,
    warnings.length * 3,
  );

  const rejectionScore = clamp(
    Math.round(
      weightedReasons * 0.65 +
      blockerBonus +
      warningBonus,
    ),
  );

  const evidenceCount =
    1 +
    Number(Boolean(quality)) +
    Number(Boolean(pattern)) +
    Number(Boolean(evolution)) +
    Number(Boolean(falseSignal)) +
    Number(Boolean(conflicts)) +
    Number(Boolean(market));

  const evidenceCoverage = clamp(
    evidenceCount * 12.5,
  );

  const confidence = clamp(
    Math.round(
      evidenceCoverage * 0.65 +
      (reasons.length > 0 ? 25 : 10),
    ),
  );

  const shouldReject =
    blockers.length > 0 ||
    rejectionScore >= 60;

  const recommendation =
    shouldReject
      ? "DO_NOT_TRADE"
      : warnings.length > 0 || rejectionScore >= 25
        ? "CAUTION"
        : "ACCEPT";

  const risk = riskFromScore(
    Math.max(
      rejectionScore,
      blockers.length > 0 ? 50 : 0,
    ),
  );

  let explanation: string;

  if (shouldReject) {
    explanation =
      `VELORA should reject this ${setup.direction} setup because ` +
      `${blockers.length} blocking condition(s) were detected. ` +
      `${reasons
        .slice(0, 3)
        .map((reason) => reason.title)
        .join("; ")}.`;
  } else if (warnings.length > 0) {
    explanation =
      `VELORA should approach this ${setup.direction} setup with caution. ` +
      `${warnings.length} warning condition(s) were detected.`;
  } else {
    explanation =
      `No major rejection condition was detected for this ${setup.direction} setup. ` +
      `The available confirmation layers are sufficiently aligned.`;
  }

  return {
    shouldReject,
    rejectionScore,
    confidence,
    risk,
    reasons,
    blockers,
    warnings,
    supportingFactors,
    explanation,
    recommendation,
  };
}

export const whyNotEngine = {
  analyze: buildWhyNotEngine,
};
