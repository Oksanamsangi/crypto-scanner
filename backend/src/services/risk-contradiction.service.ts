import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { SetupQualityScoreResult } from "./setup-quality-score.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";
import type { SignalInvalidationResult } from "./signal-invalidation.service.js";

export type RiskContradictionState =
  | "ALIGNED"
  | "CAUTION"
  | "CONTRADICTED"
  | "CRITICAL";

export type RiskContradictionSeverity =
  | "INFO"
  | "WARNING"
  | "HIGH"
  | "CRITICAL";

export type RiskLevel =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "EXTREME";

export interface RiskContradictionFactor {
  code: string;
  severity: RiskContradictionSeverity;
  score: number;
  weight: number;
  contribution: number;
  title: string;
  explanation: string;
}

export interface RiskContradictionInput {
  setup: SetupFingerprint;

  quality?: SetupQualityScoreResult | null;

  falseSignal?: FalseSignalResult | null;

  conflicts?: SignalConflictResult | null;

  invalidation?: SignalInvalidationResult | null;

  market?: {
    regime?: string | null;
    breadthScore?: number | null;
    crossMarketScore?: number | null;
    volatilityState?: string | null;
    volatilityEnvironment?: string | null;
  } | null;
}

export interface RiskContradictionResult {
  state: RiskContradictionState;

  riskLevel: RiskLevel;

  contradictionScore: number;

  confidence: number;

  factors: RiskContradictionFactor[];

  contradictions: string[];

  warnings: string[];

  protections: string[];

  explanation: string;
}

function clamp(
  value: number,
  min = 0,
  max = 100,
): number {
  return Math.max(min, Math.min(max, value));
}

function directionOf(
  signal: SetupFingerprint["direction"],
): "BULLISH" | "BEARISH" | "NEUTRAL" {
  if (signal === "BUY") return "BULLISH";
  if (signal === "SELL") return "BEARISH";

  return "NEUTRAL";
}

function isBullish(
  value: string | null | undefined,
): boolean {
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

function isBearish(
  value: string | null | undefined,
): boolean {
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

function severityFromScore(
  score: number,
): RiskContradictionSeverity {
  if (score >= 85) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "WARNING";

  return "INFO";
}

function riskLevelFromScore(
  score: number,
): RiskLevel {
  if (score >= 80) return "EXTREME";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MODERATE";

  return "LOW";
}

function createFactor(
  code: string,
  score: number,
  weight: number,
  title: string,
  explanation: string,
): RiskContradictionFactor {
  const normalizedScore = clamp(
    Math.round(score),
  );

  return {
    code,
    severity: severityFromScore(
      normalizedScore,
    ),
    score: normalizedScore,
    weight,
    contribution: Number(
      (
        normalizedScore *
        weight
      ).toFixed(2),
    ),
    title,
    explanation,
  };
}

export function detectRiskContradiction(
  input: RiskContradictionInput,
): RiskContradictionResult {
  const {
    setup,
    quality,
    falseSignal,
    conflicts,
    invalidation,
    market,
  } = input;

  const factors: RiskContradictionFactor[] = [];
  const contradictions: string[] = [];
  const warnings: string[] = [];
  const protections: string[] = [];

  const direction = directionOf(
    setup.direction,
  );

  // ------------------------------------------------------------
  // 1. FALSE SIGNAL RISK
  // ------------------------------------------------------------

  if (falseSignal) {
    if (
      falseSignal.risk === "CRITICAL"
    ) {
      factors.push(
        createFactor(
          "FALSE_SIGNAL_CRITICAL",
          95,
          0.18,
          "Critical false-signal risk",
          "The false-signal detector identifies critical conditions that undermine the reliability of the setup.",
        ),
      );

      contradictions.push(
        "Critical false-signal risk",
      );
    } else if (
      falseSignal.risk === "HIGH"
    ) {
      factors.push(
        createFactor(
          "FALSE_SIGNAL_HIGH",
          75,
          0.18,
          "High false-signal risk",
          "The setup has elevated risk of producing a false directional signal.",
        ),
      );

      contradictions.push(
        "High false-signal risk",
      );
    } else if (
      falseSignal.risk === "MODERATE"
    ) {
      factors.push(
        createFactor(
          "FALSE_SIGNAL_MODERATE",
          40,
          0.18,
          "Moderate false-signal risk",
          "Some evidence suggests the signal may be unreliable.",
        ),
      );

      warnings.push(
        "Moderate false-signal risk",
      );
    } else {
      protections.push(
        "False-signal detector reports low risk",
      );
    }
  }

  // ------------------------------------------------------------
  // 2. SIGNAL CONFLICT
  // ------------------------------------------------------------

  if (conflicts) {
    if (
      conflicts.state === "CONFLICTED"
    ) {
      factors.push(
        createFactor(
          "SIGNAL_CONFLICT",
          90,
          0.18,
          "Core signal conflict",
          conflicts.explanation,
        ),
      );

      contradictions.push(
        "Core signal layers are conflicted",
      );
    } else if (
      conflicts.state === "MIXED"
    ) {
      factors.push(
        createFactor(
          "SIGNAL_MIXED",
          50,
          0.18,
          "Mixed signal confirmation",
          conflicts.explanation,
        ),
      );

      warnings.push(
        "Signal confirmation is mixed",
      );
    } else {
      protections.push(
        "Signal layers are aligned",
      );
    }
  }

  // ------------------------------------------------------------
  // 3. QUALITY VS RISK
  // ------------------------------------------------------------

  if (quality) {
    if (
      quality.qualityScore < 50
    ) {
      factors.push(
        createFactor(
          "POOR_SETUP_QUALITY",
          85,
          0.14,
          "Poor setup quality",
          `Setup quality is only ${quality.qualityScore}/100, which is inconsistent with accepting elevated risk.`,
        ),
      );

      contradictions.push(
        "Setup quality is too weak for the risk",
      );
    } else if (
      quality.qualityScore < 65
    ) {
      factors.push(
        createFactor(
          "MODERATE_SETUP_QUALITY",
          45,
          0.14,
          "Moderate setup quality",
          `Setup quality is ${quality.qualityScore}/100 and provides only partial protection against risk.`,
        ),
      );

      warnings.push(
        "Setup quality provides limited protection",
      );
    } else {
      protections.push(
        `Setup quality is supportive at ${quality.qualityScore}/100`,
      );
    }
  }

  // ------------------------------------------------------------
  // 4. EXTREME VOLATILITY
  // ------------------------------------------------------------

  const volatility =
    market?.volatilityState ??
    setup.volatility;

  const volatilityEnvironment =
    market?.volatilityEnvironment;

  if (
    volatility === "EXTREME" ||
    volatilityEnvironment === "EXPANSION" &&
      setup.volatility === "EXTREME"
  ) {
    factors.push(
      createFactor(
        "EXTREME_VOLATILITY",
        90,
        0.16,
        "Extreme volatility",
        "Extreme volatility increases execution uncertainty and reduces the reliability of directional confirmation.",
      ),
    );

    contradictions.push(
      "Extreme volatility",
    );
  } else if (
    volatility === "HIGH"
  ) {
    factors.push(
      createFactor(
        "HIGH_VOLATILITY",
        60,
        0.16,
        "High volatility",
        "High volatility increases uncertainty around the setup.",
      ),
    );

    warnings.push(
      "High volatility",
    );
  } else {
    protections.push(
      "Volatility is not currently extreme",
    );
  }

  // ------------------------------------------------------------
  // 5. MARKET BREADTH VS SIGNAL
  // ------------------------------------------------------------

  if (
    market?.breadthScore !== null &&
    market?.breadthScore !== undefined
  ) {
    const breadth =
      market.breadthScore;

    const contradicted =
      (direction === "BULLISH" &&
        breadth <= -40) ||
      (direction === "BEARISH" &&
        breadth >= 40);

    if (contradicted) {
      const score = clamp(
        55 +
          Math.abs(breadth) *
            0.45,
      );

      factors.push(
        createFactor(
          "BREADTH_CONTRADICTION",
          score,
          0.10,
          "Market breadth contradicts risk",
          `Breadth is ${Math.round(breadth)}, showing broad market participation against the setup direction.`,
        ),
      );

      contradictions.push(
        "Market breadth contradicts the setup",
      );
    } else {
      protections.push(
        "Market breadth remains supportive",
      );
    }
  }

  // ------------------------------------------------------------
  // 6. CROSS-MARKET VS SIGNAL
  // ------------------------------------------------------------

  if (
    market?.crossMarketScore !== null &&
    market?.crossMarketScore !== undefined
  ) {
    const crossMarket =
      market.crossMarketScore;

    const contradicted =
      (direction === "BULLISH" &&
        crossMarket <= -40) ||
      (direction === "BEARISH" &&
        crossMarket >= 40);

    if (contradicted) {
      const score = clamp(
        55 +
          Math.abs(crossMarket) *
            0.45,
      );

      factors.push(
        createFactor(
          "CROSS_MARKET_CONTRADICTION",
          score,
          0.10,
          "Cross-market confirmation contradicts setup",
          `Cross-market confirmation is ${Math.round(crossMarket)}, indicating external markets are moving against the setup.`,
        ),
      );

      contradictions.push(
        "Cross-market confirmation contradicts the setup",
      );
    } else {
      protections.push(
        "Cross-market confirmation remains supportive",
      );
    }
  }

  // ------------------------------------------------------------
  // 7. MARKET REGIME
  // ------------------------------------------------------------

  if (
    (direction === "BULLISH" &&
      isBearish(market?.regime)) ||
    (direction === "BEARISH" &&
      isBullish(market?.regime))
  ) {
    factors.push(
      createFactor(
        "MARKET_REGIME_CONTRADICTION",
        85,
        0.12,
        "Market regime contradicts setup",
        `The broader market regime is ${market?.regime}, which conflicts with the ${setup.direction} direction.`,
      ),
    );

    contradictions.push(
      "Market regime contradicts the setup",
    );
  } else if (
    market?.regime
  ) {
    protections.push(
      "Market regime is compatible with setup",
    );
  }

  // ------------------------------------------------------------
  // 8. INVALIDATION STATE
  // ------------------------------------------------------------

  if (
    invalidation?.state ===
    "INVALIDATED"
  ) {
    factors.push(
      createFactor(
        "SETUP_INVALIDATED",
        100,
        0.20,
        "Setup has been invalidated",
        invalidation.explanation,
      ),
    );

    contradictions.push(
      "Setup is already invalidated",
    );
  } else if (
    invalidation?.state ===
    "AT_RISK"
  ) {
    factors.push(
      createFactor(
        "SETUP_AT_RISK",
        55,
        0.20,
        "Setup is at risk of invalidation",
        invalidation.explanation,
      ),
    );

    warnings.push(
      "Setup is approaching invalidation",
    );
  } else if (
    invalidation?.state === "VALID"
  ) {
    protections.push(
      "Setup has no current invalidation condition",
    );
  }

  // ------------------------------------------------------------
  // 9. WEAK VOLUME
  // ------------------------------------------------------------

  if (
    setup.volume === "VERY_WEAK"
  ) {
    factors.push(
      createFactor(
        "VOLUME_RISK",
        70,
        0.07,
        "Very weak volume",
        "The setup lacks sufficient participation to provide strong confirmation.",
      ),
    );

    warnings.push(
      "Volume confirmation is very weak",
    );
  } else if (
    setup.volume === "WEAK"
  ) {
    factors.push(
      createFactor(
        "VOLUME_RISK",
        40,
        0.07,
        "Weak volume",
        "Volume confirmation is below normal.",
      ),
    );

    warnings.push(
      "Volume confirmation is weak",
    );
  } else {
    protections.push(
      "Volume provides confirmation",
    );
  }

  // ------------------------------------------------------------
  // FINAL SCORE
  // ------------------------------------------------------------

  const weightedScore =
    factors.length > 0
      ? factors.reduce(
          (sum, factor) =>
            sum +
            factor.contribution,
          0,
        ) /
        Math.max(
          0.01,
          factors.reduce(
            (sum, factor) =>
              sum + factor.weight,
            0,
          ),
        )
      : 0;

  const contradictionBonus =
    Math.min(
      20,
      contradictions.length * 4,
    );

  const warningBonus =
    Math.min(
      10,
      warnings.length * 2,
    );

  const protectionReduction =
    Math.min(
      12,
      protections.length * 1.5,
    );

  const contradictionScore =
    clamp(
      Math.round(
        weightedScore +
          contradictionBonus +
          warningBonus -
          protectionReduction,
      ),
    );

  const evidenceSources =
    1 +
    Number(Boolean(quality)) +
    Number(Boolean(falseSignal)) +
    Number(Boolean(conflicts)) +
    Number(Boolean(invalidation)) +
    Number(Boolean(market));

  const confidence = clamp(
    Math.round(
      evidenceSources * 13 +
        factors.length * 3,
    ),
  );

  const riskLevel =
    riskLevelFromScore(
      contradictionScore,
    );

  let state: RiskContradictionState;

  if (
    contradictionScore >= 80 ||
    invalidation?.state ===
      "INVALIDATED"
  ) {
    state = "CRITICAL";
  } else if (
    contradictionScore >= 60
  ) {
    state = "CONTRADICTED";
  } else if (
    contradictionScore >= 30
  ) {
    state = "CAUTION";
  } else {
    state = "ALIGNED";
  }

  let explanation: string;

  if (state === "CRITICAL") {
    explanation =
      `Risk conditions critically contradict the ${setup.direction} setup. ` +
      `${contradictions.length} major contradiction(s) were detected.`;
  } else if (
    state === "CONTRADICTED"
  ) {
    explanation =
      `Risk conditions contradict the ${setup.direction} setup. ` +
      `The setup should not be treated as low-risk.`;
  } else if (
    state === "CAUTION"
  ) {
    explanation =
      `The ${setup.direction} setup remains possible, but several risk factors require caution.`;
  } else {
    explanation =
      `Risk conditions are broadly aligned with the ${setup.direction} setup.`;
  }

  return {
    state,
    riskLevel,
    contradictionScore,
    confidence,
    factors,
    contradictions,
    warnings,
    protections,
    explanation,
  };
}

export const riskContradiction = {
  analyze: detectRiskContradiction,
};
