import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { SetupQualityScoreResult } from "./setup-quality-score.service.js";
import type { PatternRecognitionResult } from "./pattern-recognition.service.js";
import type { SetupEvolutionResult } from "./setup-evolution.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";
import type { SignalInvalidationResult } from "./signal-invalidation.service.js";
import type { RiskContradictionResult } from "./risk-contradiction.service.js";

export type FinalTradeDecision =
  | "ACCEPT"
  | "CAUTION"
  | "REJECT";

export type FinalTradeState =
  | "APPROVED"
  | "CONDITIONAL"
  | "BLOCKED";

export type FinalTradeRisk =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "EXTREME";

export interface FinalTradeBlocker {
  code: string;
  source: string;
  severity: "WARNING" | "HIGH" | "CRITICAL";
  score: number;
  reason: string;
}

export interface FinalTradeFilterInput {
  setup: SetupFingerprint;

  quality?: SetupQualityScoreResult | null;
  pattern?: PatternRecognitionResult | null;
  evolution?: SetupEvolutionResult | null;

  falseSignal?: FalseSignalResult | null;
  conflicts?: SignalConflictResult | null;
  invalidation?: SignalInvalidationResult | null;
  riskContradiction?: RiskContradictionResult | null;

  market?: {
    regime?: string | null;
    breadthScore?: number | null;
    crossMarketScore?: number | null;
    volatilityState?: string | null;
  } | null;
}

export interface FinalTradeFilterResult {
  decision: FinalTradeDecision;
  state: FinalTradeState;
  risk: FinalTradeRisk;

  finalScore: number;
  confidence: number;

  blockers: FinalTradeBlocker[];
  warnings: string[];
  protections: string[];

  passedChecks: string[];
  failedChecks: string[];

  explanation: string;
}

function clamp(
  value: number,
  min = 0,
  max = 100,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function riskFromScore(
  score: number,
): FinalTradeRisk {
  if (score >= 80) return "EXTREME";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MODERATE";

  return "LOW";
}

function addBlocker(
  blockers: FinalTradeBlocker[],
  code: string,
  source: string,
  severity: FinalTradeBlocker["severity"],
  score: number,
  reason: string,
): void {
  blockers.push({
    code,
    source,
    severity,
    score: clamp(Math.round(score)),
    reason,
  });
}

export function applyFinalTradeFilter(
  input: FinalTradeFilterInput,
): FinalTradeFilterResult {
  const {
    setup,
    quality,
    pattern,
    evolution,
    falseSignal,
    conflicts,
    invalidation,
    riskContradiction,
  } = input;

  const blockers: FinalTradeBlocker[] = [];
  const warnings: string[] = [];
  const protections: string[] = [];
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];

  // ------------------------------------------------------------
  // 1. HARD INVALIDATION
  // ------------------------------------------------------------

  if (
    invalidation?.state === "INVALIDATED"
  ) {
    addBlocker(
      blockers,
      "SETUP_INVALIDATED",
      "Signal Invalidation",
      "CRITICAL",
      100,
      invalidation.explanation,
    );

    failedChecks.push(
      "Signal invalidation",
    );
  } else if (
    invalidation?.state === "AT_RISK"
  ) {
    warnings.push(
      "Setup is approaching invalidation",
    );

    failedChecks.push(
      "Signal invalidation",
    );
  } else {
    passedChecks.push(
      "Signal remains valid",
    );
  }

  // ------------------------------------------------------------
  // 2. FALSE SIGNAL
  // ------------------------------------------------------------

  if (
    falseSignal?.state === "REJECT"
  ) {
    addBlocker(
      blockers,
      "FALSE_SIGNAL_REJECT",
      "False Signal Detector",
      "CRITICAL",
      Math.max(
        80,
        falseSignal.falseSignalScore,
      ),
      "False-signal defense rejected the setup.",
    );

    failedChecks.push(
      "False-signal defense",
    );
  } else if (
    falseSignal?.state === "CAUTION"
  ) {
    warnings.push(
      "False-signal risk requires caution",
    );

    failedChecks.push(
      "False-signal defense",
    );
  } else if (
    falseSignal?.state === "PASS"
  ) {
    passedChecks.push(
      "False-signal defense passed",
    );
  }

  // ------------------------------------------------------------
  // 3. SIGNAL CONFLICT
  // ------------------------------------------------------------

  if (
    conflicts?.state === "CONFLICTED"
  ) {
    addBlocker(
      blockers,
      "SIGNAL_CONFLICT",
      "Signal Conflict Detector",
      "CRITICAL",
      Math.max(
        75,
        conflicts.conflictScore,
      ),
      conflicts.explanation,
    );

    failedChecks.push(
      "Signal conflict",
    );
  } else if (
    conflicts?.state === "MIXED"
  ) {
    warnings.push(
      "Signal confirmation is mixed",
    );

    failedChecks.push(
      "Signal conflict",
    );
  } else if (
    conflicts?.state === "ALIGNED"
  ) {
    passedChecks.push(
      "Signal layers aligned",
    );
  }

  // ------------------------------------------------------------
  // 4. RISK CONTRADICTION
  // ------------------------------------------------------------

  if (
    riskContradiction?.state ===
      "CRITICAL" ||
    riskContradiction?.state ===
      "CONTRADICTED"
  ) {
    addBlocker(
      blockers,
      "RISK_CONTRADICTION",
      "Risk Contradiction",
      riskContradiction.state ===
        "CRITICAL"
        ? "CRITICAL"
        : "HIGH",
      riskContradiction.contradictionScore,
      riskContradiction.explanation,
    );

    failedChecks.push(
      "Risk contradiction",
    );
  } else if (
    riskContradiction?.state ===
      "CAUTION"
  ) {
    warnings.push(
      "Risk conditions require caution",
    );

    failedChecks.push(
      "Risk contradiction",
    );
  } else if (
    riskContradiction?.state ===
      "ALIGNED"
  ) {
    passedChecks.push(
      "Risk conditions aligned",
    );
  }

  // ------------------------------------------------------------
  // 5. QUALITY
  // ------------------------------------------------------------

  if (quality) {
    if (
      quality.qualityScore < 50
    ) {
      addBlocker(
        blockers,
        "POOR_SETUP_QUALITY",
        "Setup Quality",
        "HIGH",
        85,
        `Setup quality is ${quality.qualityScore}/100.`,
      );

      failedChecks.push(
        "Setup quality",
      );
    } else if (
      quality.qualityScore < 65
    ) {
      warnings.push(
        `Setup quality is only ${quality.qualityScore}/100`,
      );

      failedChecks.push(
        "Setup quality",
      );
    } else {
      passedChecks.push(
        `Setup quality passed (${quality.qualityScore}/100)`,
      );
    }
  }

  // ------------------------------------------------------------
  // 6. PATTERN
  // ------------------------------------------------------------

  if (pattern) {
    if (
      pattern.recognized &&
      pattern.patternConfidence >= 65
    ) {
      protections.push(
        `Recognized ${pattern.pattern} pattern`,
      );

      passedChecks.push(
        "Pattern recognition",
      );
    } else if (
      !pattern.recognized
    ) {
      warnings.push(
        "No strong historical pattern confirmation",
      );
    }
  }

  // ------------------------------------------------------------
  // 7. EVOLUTION
  // ------------------------------------------------------------

  if (evolution) {
    if (
      evolution.state === "FADING"
    ) {
      addBlocker(
        blockers,
        "SETUP_FADING",
        "Setup Evolution",
        "HIGH",
        75,
        evolution.explanation,
      );

      failedChecks.push(
        "Setup evolution",
      );
    } else if (
      evolution.state === "WEAKENING"
    ) {
      warnings.push(
        "Setup is weakening",
      );

      failedChecks.push(
        "Setup evolution",
      );
    } else if (
      evolution.state === "STRENGTHENING"
    ) {
      protections.push(
        "Setup is strengthening",
      );

      passedChecks.push(
        "Setup evolution",
      );
    }
  }

  // ------------------------------------------------------------
  // 8. MARKET PROTECTION
  // ------------------------------------------------------------

  if (input.market) {
    const breadth =
      input.market.breadthScore;

    const crossMarket =
      input.market.crossMarketScore;

    if (
      breadth !== null &&
      breadth !== undefined
    ) {
      if (
        (setup.direction === "BUY" &&
          breadth <= -40) ||
        (setup.direction === "SELL" &&
          breadth >= 40)
      ) {
        warnings.push(
          "Market breadth contradicts setup",
        );

        failedChecks.push(
          "Market breadth",
        );
      } else {
        passedChecks.push(
          "Market breadth",
        );
      }
    }

    if (
      crossMarket !== null &&
      crossMarket !== undefined
    ) {
      if (
        (setup.direction === "BUY" &&
          crossMarket <= -40) ||
        (setup.direction === "SELL" &&
          crossMarket >= 40)
      ) {
        warnings.push(
          "Cross-market confirmation contradicts setup",
        );

        failedChecks.push(
          "Cross-market confirmation",
        );
      } else {
        passedChecks.push(
          "Cross-market confirmation",
        );
      }
    }
  }

  // ------------------------------------------------------------
  // 9. HARD DECISION RULES
  // ------------------------------------------------------------

  const criticalBlockers =
    blockers.filter(
      (blocker) =>
        blocker.severity ===
        "CRITICAL",
    );

  const highBlockers =
    blockers.filter(
      (blocker) =>
        blocker.severity ===
        "HIGH",
    );

  const blockerScore =
    blockers.length > 0
      ? blockers.reduce(
          (sum, blocker) =>
            sum + blocker.score,
          0,
        ) / blockers.length
      : 0;

  const warningPenalty =
    Math.min(
      20,
      warnings.length * 4,
    );

  const protectionBonus =
    Math.min(
      15,
      protections.length * 2,
    );

  const finalScore = clamp(
    Math.round(
      blockerScore +
        criticalBlockers.length * 12 +
        highBlockers.length * 5 +
        warningPenalty -
        protectionBonus,
    ),
  );

  let decision: FinalTradeDecision;
  let state: FinalTradeState;

  if (
    criticalBlockers.length > 0 ||
    finalScore >= 70
  ) {
    decision = "REJECT";
    state = "BLOCKED";
  } else if (
    highBlockers.length > 0 ||
    warnings.length > 0 ||
    finalScore >= 35
  ) {
    decision = "CAUTION";
    state = "CONDITIONAL";
  } else {
    decision = "ACCEPT";
    state = "APPROVED";
  }

  const risk = riskFromScore(
    finalScore,
  );

  // ------------------------------------------------------------
  // 10. CONFIDENCE
  // ------------------------------------------------------------

  const evidenceSources =
    1 +
    Number(Boolean(quality)) +
    Number(Boolean(pattern)) +
    Number(Boolean(evolution)) +
    Number(Boolean(falseSignal)) +
    Number(Boolean(conflicts)) +
    Number(Boolean(invalidation)) +
    Number(Boolean(riskContradiction)) +
    Number(Boolean(input.market));

  const confidence = clamp(
    Math.round(
      evidenceSources * 9 +
        passedChecks.length * 3 +
        failedChecks.length * 2,
    ),
  );

  // ------------------------------------------------------------
  // 11. EXPLANATION
  // ------------------------------------------------------------

  let explanation: string;

  if (
    decision === "REJECT"
  ) {
    explanation =
      `VELORA rejects the ${setup.direction} setup. ` +
      `${blockers.length} blocking condition(s) were detected.`;
  } else if (
    decision === "CAUTION"
  ) {
    explanation =
      `VELORA allows the ${setup.direction} setup only conditionally. ` +
      `${warnings.length} warning condition(s) require attention.`;
  } else {
    explanation =
      `VELORA approves the ${setup.direction} setup. ` +
      `No blocking defensive condition was detected.`;
  }

  return {
    decision,
    state,
    risk,
    finalScore,
    confidence,
    blockers,
    warnings,
    protections,
    passedChecks,
    failedChecks,
    explanation,
  };
}

export const finalTradeFilter = {
  analyze: applyFinalTradeFilter,
};
