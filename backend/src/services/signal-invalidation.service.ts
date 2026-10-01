import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { SetupEvolutionResult } from "./setup-evolution.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";

export type SignalInvalidationState =
  | "VALID"
  | "AT_RISK"
  | "INVALIDATED";

export type SignalInvalidationSeverity =
  | "INFO"
  | "WARNING"
  | "HIGH"
  | "CRITICAL";

export type SignalInvalidationDirection =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export type SignalInvalidationReasonCode =
  | "DIRECTION_CHANGED"
  | "TREND_BROKEN"
  | "MOMENTUM_REVERSED"
  | "EMA_STRUCTURE_BROKEN"
  | "PRICE_STRUCTURE_BROKEN"
  | "VOLUME_COLLAPSE"
  | "MARKET_REGIME_CHANGED"
  | "BREADTH_INVALIDATED"
  | "CROSS_MARKET_INVALIDATED"
  | "FALSE_SIGNAL_REJECTED"
  | "SIGNAL_CONFLICTED"
  | "SETUP_FADING"
  | "SETUP_EXPIRED"
  | "CONFIDENCE_COLLAPSED";

export interface SignalInvalidationReason {
  code: SignalInvalidationReasonCode;
  severity: SignalInvalidationSeverity;
  score: number;
  title: string;
  explanation: string;
}

export interface SignalInvalidationInput {
  setup: SetupFingerprint;

  previous?: SetupFingerprint | null;

  evolution?: SetupEvolutionResult | null;

  conflicts?: SignalConflictResult | null;

  falseSignal?: FalseSignalResult | null;

  market?: {
    regime?: string | null;
    breadthScore?: number | null;
    crossMarketScore?: number | null;
    momentum?: string | null;
    volatilityState?: string | null;
  } | null;

  maxAgeMinutes?: number;
  observedAt?: Date;
  currentTime?: Date;
}

export interface SignalInvalidationResult {
  state: SignalInvalidationState;
  invalidated: boolean;
  invalidationScore: number;
  confidence: number;

  direction: SignalInvalidationDirection;

  reasons: SignalInvalidationReason[];

  criticalReasons: string[];
  warnings: string[];

  validConditions: string[];
  invalidationConditions: string[];

  explanation: string;
}

function clamp(
  value: number,
  min = 0,
  max = 100,
): number {
  return Math.max(min, Math.min(max, value));
}

function signalDirection(
  signal: SetupFingerprint["direction"],
): SignalInvalidationDirection {
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
): SignalInvalidationSeverity {
  if (score >= 85) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "WARNING";
  return "INFO";
}

function createReason(
  code: SignalInvalidationReasonCode,
  score: number,
  title: string,
  explanation: string,
): SignalInvalidationReason {
  return {
    code,
    severity: severityFromScore(score),
    score: clamp(Math.round(score)),
    title,
    explanation,
  };
}

export function detectSignalInvalidation(
  input: SignalInvalidationInput,
): SignalInvalidationResult {
  const {
    setup,
    previous,
    evolution,
    conflicts,
    falseSignal,
    market,
    maxAgeMinutes = 180,
    observedAt,
    currentTime = new Date(),
  } = input;

  const direction = signalDirection(
    setup.direction,
  );

  const reasons: SignalInvalidationReason[] = [];
  const criticalReasons: string[] = [];
  const warnings: string[] = [];
  const validConditions: string[] = [];
  const invalidationConditions: string[] = [];

  // ------------------------------------------------------------
  // 1. NEUTRAL / NO-DIRECTION SETUP
  // ------------------------------------------------------------

  if (direction === "NEUTRAL") {
    reasons.push(
      createReason(
        "DIRECTION_CHANGED",
        90,
        "Signal has no valid direction",
        "The setup no longer contains a directional BUY or SELL signal.",
      ),
    );

    criticalReasons.push(
      "Signal has no valid direction",
    );

    invalidationConditions.push(
      "Directional signal must remain BUY or SELL",
    );
  }

  // ------------------------------------------------------------
  // 2. CURRENT VS PREVIOUS DIRECTION
  // ------------------------------------------------------------

  if (
    previous &&
    previous.direction !== setup.direction &&
    previous.direction !== "NEUTRAL" &&
    setup.direction !== "NEUTRAL"
  ) {
    reasons.push(
      createReason(
        "DIRECTION_CHANGED",
        95,
        "Signal direction changed",
        `The previous signal was ${previous.direction}, but the current signal is ${setup.direction}.`,
      ),
    );

    criticalReasons.push(
      "Signal direction changed",
    );

    invalidationConditions.push(
      "Signal direction must remain consistent",
    );
  }

  // ------------------------------------------------------------
  // 3. TREND BREAK
  // ------------------------------------------------------------

  if (
    (direction === "BULLISH" &&
      isBearish(setup.trend)) ||
    (direction === "BEARISH" &&
      isBullish(setup.trend))
  ) {
    const score = setup.trend.startsWith("STRONG_")
      ? 90
      : 70;

    reasons.push(
      createReason(
        "TREND_BROKEN",
        score,
        "Trend no longer supports the signal",
        `The ${setup.trend.toLowerCase().replace("_", " ")} trend conflicts with the ${setup.direction} setup.`,
      ),
    );

    invalidationConditions.push(
      "Trend must remain aligned with signal direction",
    );

    if (score >= 85) {
      criticalReasons.push(
        "Trend has broken against the signal",
      );
    } else {
      warnings.push(
        "Trend is weakening against the signal",
      );
    }
  } else {
    validConditions.push(
      "Trend remains aligned",
    );
  }

  // ------------------------------------------------------------
  // 4. MOMENTUM REVERSAL
  // ------------------------------------------------------------

  if (
    (direction === "BULLISH" &&
      isBearish(setup.momentum)) ||
    (direction === "BEARISH" &&
      isBullish(setup.momentum))
  ) {
    const score =
      setup.momentum.startsWith("STRONG_")
        ? 90
        : 70;

    reasons.push(
      createReason(
        "MOMENTUM_REVERSED",
        score,
        "Momentum reversed against the signal",
        `Momentum is currently ${setup.momentum.toLowerCase().replace("_", " ")} while the setup remains ${setup.direction}.`,
      ),
    );

    invalidationConditions.push(
      "Momentum must remain aligned with signal direction",
    );

    if (score >= 85) {
      criticalReasons.push(
        "Momentum reversed against the signal",
      );
    } else {
      warnings.push(
        "Momentum is moving against the signal",
      );
    }
  } else {
    validConditions.push(
      "Momentum remains aligned",
    );
  }

  // ------------------------------------------------------------
  // 5. EMA STRUCTURE
  // ------------------------------------------------------------

  if (
    (direction === "BULLISH" &&
      setup.emaStructure === "BEARISH") ||
    (direction === "BEARISH" &&
      setup.emaStructure === "BULLISH")
  ) {
    reasons.push(
      createReason(
        "EMA_STRUCTURE_BROKEN",
        85,
        "EMA structure broke",
        `EMA structure is ${setup.emaStructure.toLowerCase()} and no longer supports the ${setup.direction} signal.`,
      ),
    );

    criticalReasons.push(
      "EMA structure broke against the signal",
    );

    invalidationConditions.push(
      "EMA structure must remain aligned",
    );
  } else {
    validConditions.push(
      "EMA structure remains compatible",
    );
  }

  // ------------------------------------------------------------
  // 6. PRICE STRUCTURE
  // ------------------------------------------------------------

  if (
    (direction === "BULLISH" &&
      setup.priceVsEma === "BELOW_BOTH") ||
    (direction === "BEARISH" &&
      setup.priceVsEma === "ABOVE_BOTH")
  ) {
    reasons.push(
      createReason(
        "PRICE_STRUCTURE_BROKEN",
        80,
        "Price structure broke",
        `Price is ${setup.priceVsEma.toLowerCase().replace("_", " ")} the EMAs, contradicting the ${setup.direction} setup.`,
      ),
    );

    invalidationConditions.push(
      "Price must remain on the correct side of the EMA structure",
    );

    criticalReasons.push(
      "Price structure broke against the signal",
    );
  }

  // ------------------------------------------------------------
  // 7. VOLUME COLLAPSE
  // ------------------------------------------------------------

  if (
    setup.volume === "VERY_WEAK"
  ) {
    reasons.push(
      createReason(
        "VOLUME_COLLAPSE",
        65,
        "Volume confirmation collapsed",
        "Volume is very weak and no longer provides meaningful confirmation.",
      ),
    );

    warnings.push(
      "Volume confirmation has collapsed",
    );

    invalidationConditions.push(
      "Volume should remain at least normal or supportive",
    );
  }

  // ------------------------------------------------------------
  // 8. MARKET REGIME
  // ------------------------------------------------------------

  if (
    (direction === "BULLISH" &&
      isBearish(market?.regime)) ||
    (direction === "BEARISH" &&
      isBullish(market?.regime))
  ) {
    reasons.push(
      createReason(
        "MARKET_REGIME_CHANGED",
        85,
        "Market regime changed against the setup",
        `The broader market regime is ${market?.regime}, which conflicts with the ${setup.direction} setup.`,
      ),
    );

    criticalReasons.push(
      "Market regime changed against the signal",
    );

    invalidationConditions.push(
      "Market regime must remain compatible",
    );
  }

  // ------------------------------------------------------------
  // 9. MARKET BREADTH
  // ------------------------------------------------------------

  if (
    market?.breadthScore !== null &&
    market?.breadthScore !== undefined
  ) {
    const breadth = market.breadthScore;

    const contradicted =
      (direction === "BULLISH" && breadth <= -40) ||
      (direction === "BEARISH" && breadth >= 40);

    if (contradicted) {
      const score = clamp(
        55 + Math.abs(breadth) * 0.4,
      );

      reasons.push(
        createReason(
          "BREADTH_INVALIDATED",
          score,
          "Market breadth moved against the setup",
          `Market breadth is ${Math.round(breadth)}, showing broad participation against the signal direction.`,
        ),
      );

      invalidationConditions.push(
        "Market breadth must remain supportive",
      );

      if (score >= 70) {
        criticalReasons.push(
          "Market breadth invalidated the setup",
        );
      } else {
        warnings.push(
          "Market breadth is no longer supportive",
        );
      }
    } else {
      validConditions.push(
        "Market breadth remains supportive",
      );
    }
  }

  // ------------------------------------------------------------
  // 10. CROSS-MARKET
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
        55 + Math.abs(crossMarket) * 0.4,
      );

      reasons.push(
        createReason(
          "CROSS_MARKET_INVALIDATED",
          score,
          "Cross-market confirmation disappeared",
          `Cross-market confirmation is ${Math.round(crossMarket)}, indicating external market conditions are moving against the setup.`,
        ),
      );

      invalidationConditions.push(
        "Cross-market confirmation must remain supportive",
      );

      if (score >= 70) {
        criticalReasons.push(
          "Cross-market confirmation invalidated the setup",
        );
      } else {
        warnings.push(
          "Cross-market confirmation weakened",
        );
      }
    } else {
      validConditions.push(
        "Cross-market confirmation remains supportive",
      );
    }
  }

  // ------------------------------------------------------------
  // 11. FALSE SIGNAL REJECTION
  // ------------------------------------------------------------

  if (
    falseSignal?.state === "REJECT"
  ) {
    reasons.push(
      createReason(
        "FALSE_SIGNAL_REJECTED",
        95,
        "False-signal defense rejected the setup",
        `The false-signal detector classified the setup as ${falseSignal.risk.toLowerCase()} risk.`,
      ),
    );

    criticalReasons.push(
      "False-signal defense rejected the setup",
    );

    invalidationConditions.push(
      "False-signal defense must not reject the setup",
    );
  }

  // ------------------------------------------------------------
  // 12. SIGNAL CONFLICT
  // ------------------------------------------------------------

  if (
    conflicts?.state === "CONFLICTED"
  ) {
    reasons.push(
      createReason(
        "SIGNAL_CONFLICTED",
        90,
        "Signal became conflicted",
        conflicts.explanation,
      ),
    );

    criticalReasons.push(
      "Signal conflict became critical",
    );

    invalidationConditions.push(
      "Core confirmation layers must remain aligned",
    );
  }

  // ------------------------------------------------------------
  // 13. SETUP EVOLUTION
  // ------------------------------------------------------------

  if (
    evolution?.state === "FADING"
  ) {
    reasons.push(
      createReason(
        "SETUP_FADING",
        75,
        "Setup is fading",
        evolution.explanation,
      ),
    );

    criticalReasons.push(
      "Setup is fading",
    );

    invalidationConditions.push(
      "Setup strength must remain stable or improve",
    );
  } else if (
    evolution?.state === "WEAKENING"
  ) {
    reasons.push(
      createReason(
        "SETUP_FADING",
        55,
        "Setup is weakening",
        evolution.explanation,
      ),
    );

    warnings.push(
      "Setup strength is weakening",
    );

    invalidationConditions.push(
      "Setup should not continue weakening",
    );
  } else if (
    evolution?.state === "STRENGTHENING"
  ) {
    validConditions.push(
      "Setup evolution is strengthening",
    );
  }

  // ------------------------------------------------------------
  // 14. CONFIDENCE COLLAPSE
  // ------------------------------------------------------------

  if (
    previous &&
    previous.confidence >= 50 &&
    setup.confidence < previous.confidence - 25
  ) {
    reasons.push(
      createReason(
        "CONFIDENCE_COLLAPSED",
        75,
        "Signal confidence collapsed",
        `Confidence dropped from ${previous.confidence} to ${setup.confidence}.`,
      ),
    );

    warnings.push(
      "Signal confidence collapsed",
    );

    invalidationConditions.push(
      "Signal confidence must remain stable",
    );
  }

  // ------------------------------------------------------------
  // 15. SETUP EXPIRATION
  // ------------------------------------------------------------

  if (observedAt) {
    const ageMinutes =
      Math.max(
        0,
        currentTime.getTime() -
          observedAt.getTime(),
      ) / 60000;

    if (ageMinutes > maxAgeMinutes) {
      reasons.push(
        createReason(
          "SETUP_EXPIRED",
          80,
          "Setup has expired",
          `The setup is ${Math.round(ageMinutes)} minutes old, exceeding the ${maxAgeMinutes}-minute validity window.`,
        ),
      );

      criticalReasons.push(
        "Setup validity window expired",
      );

      invalidationConditions.push(
        `Setup must be refreshed within ${maxAgeMinutes} minutes`,
      );
    }
  }

  // ------------------------------------------------------------
  // FINAL SCORE
  // ------------------------------------------------------------

  const maxReasonScore =
    reasons.length > 0
      ? Math.max(
          ...reasons.map(
            (reason) => reason.score,
          ),
        )
      : 0;

  const averageReasonScore =
    reasons.length > 0
      ? reasons.reduce(
          (sum, reason) =>
            sum + reason.score,
          0,
        ) / reasons.length
      : 0;

  const criticalBonus = Math.min(
    30,
    criticalReasons.length * 10,
  );

  const warningBonus = Math.min(
    15,
    warnings.length * 4,
  );

  const invalidationScore = clamp(
    Math.round(
      maxReasonScore * 0.55 +
      averageReasonScore * 0.25 +
      criticalBonus +
      warningBonus,
    ),
  );

  const evidenceSources =
    1 +
    Number(Boolean(previous)) +
    Number(Boolean(evolution)) +
    Number(Boolean(conflicts)) +
    Number(Boolean(falseSignal)) +
    Number(Boolean(market));

  const confidence = clamp(
    Math.round(
      Math.min(
        95,
        evidenceSources * 13 +
          reasons.length * 3,
      ),
    ),
  );

  const invalidated =
    criticalReasons.length > 0 ||
    invalidationScore >= 70;

  const state: SignalInvalidationState =
    invalidated
      ? "INVALIDATED"
      : invalidationScore >= 35
        ? "AT_RISK"
        : "VALID";

  let explanation: string;

  if (state === "INVALIDATED") {
    explanation =
      `The ${setup.direction} setup is invalidated because ` +
      `${criticalReasons.length} critical invalidation condition(s) were detected.`;
  } else if (state === "AT_RISK") {
    explanation =
      `The ${setup.direction} setup remains active but is at risk because ` +
      `${reasons.length} invalidation condition(s) require monitoring.`;
  } else {
    explanation =
      `The ${setup.direction} setup remains valid. ` +
      `No critical invalidation condition was detected.`;
  }

  return {
    state,
    invalidated,
    invalidationScore,
    confidence,
    direction,
    reasons,
    criticalReasons,
    warnings,
    validConditions,
    invalidationConditions,
    explanation,
  };
}

export const signalInvalidation = {
  analyze: detectSignalInvalidation,
};
