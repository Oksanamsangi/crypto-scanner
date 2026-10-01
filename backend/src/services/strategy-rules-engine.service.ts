import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { StrategyDefinition } from "./strategy-definition.service.js";
import type { PatternRecognitionResult } from "./pattern-recognition.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";
import type { RiskContradictionResult } from "./risk-contradiction.service.js";

export type StrategyRuleState =
  | "PASS"
  | "CAUTION"
  | "FAIL";

export type StrategyRuleSeverity =
  | "INFO"
  | "WARNING"
  | "HIGH"
  | "CRITICAL";

export interface StrategyRuleResult {
  code: string;
  name: string;
  state: StrategyRuleState;
  severity: StrategyRuleSeverity;
  score: number;
  required: boolean;
  reason: string;
}

export interface StrategyRulesInput {
  strategy: StrategyDefinition;
  setup: SetupFingerprint;

  pattern?: PatternRecognitionResult | null;
  falseSignal?: FalseSignalResult | null;
  conflicts?: SignalConflictResult | null;
  riskContradiction?: RiskContradictionResult | null;

  market?: {
    regime?: string | null;
    breadthScore?: number | null;
    crossMarketScore?: number | null;
  } | null;
}

export interface StrategyRulesResult {
  state: StrategyRuleState;

  ruleScore: number;
  confidence: number;

  rules: StrategyRuleResult[];

  passedRules: string[];
  cautionRules: string[];
  failedRules: string[];
  blockers: string[];
  warnings: string[];

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

function isLong(
  direction: string,
): boolean {
  return (
    direction === "LONG" ||
    direction === "BUY" ||
    direction === "BULLISH"
  );
}

function isShort(
  direction: string,
): boolean {
  return (
    direction === "SHORT" ||
    direction === "SELL" ||
    direction === "BEARISH"
  );
}

function addRule(
  rules: StrategyRuleResult[],
  rule: StrategyRuleResult,
): void {
  rules.push(rule);
}

export function evaluateStrategyRules(
  input: StrategyRulesInput,
): StrategyRulesResult {
  const {
    strategy,
    setup,
    pattern,
    falseSignal,
    conflicts,
    riskContradiction,
    market,
  } = input;

  const rules: StrategyRuleResult[] = [];

  // ------------------------------------------------------------
  // 1. DIRECTION
  // ------------------------------------------------------------

  const directionPass =
    strategy.direction === "BOTH" ||
    (strategy.direction === "LONG" &&
      setup.direction === "BUY") ||
    (strategy.direction === "SHORT" &&
      setup.direction === "SELL");

  addRule(rules, {
    code: "DIRECTION",
    name: "Strategy direction",
    state: directionPass
      ? "PASS"
      : "FAIL",
    severity: directionPass
      ? "INFO"
      : "CRITICAL",
    score: directionPass ? 100 : 0,
    required: true,
    reason: directionPass
      ? "Setup direction matches strategy."
      : "Setup direction is not allowed by the strategy.",
  });

  // ------------------------------------------------------------
  // 2. CONFIDENCE
  // ------------------------------------------------------------

  const confidencePass =
    setup.confidence >=
    strategy.minConfidence;

  addRule(rules, {
    code: "MIN_CONFIDENCE",
    name: "Minimum confidence",
    state: confidencePass
      ? "PASS"
      : "FAIL",
    severity: confidencePass
      ? "INFO"
      : "HIGH",
    score: clamp(
      setup.confidence,
    ),
    required: true,
    reason: confidencePass
      ? `Confidence ${setup.confidence} meets the ${strategy.minConfidence} threshold.`
      : `Confidence ${setup.confidence} is below the ${strategy.minConfidence} threshold.`,
  });

  // ------------------------------------------------------------
  // 3. SETUP QUALITY
  // ------------------------------------------------------------

  if (
    setup.setupQuality !== null &&
    setup.setupQuality !== undefined
  ) {
    const qualityPass =
      setup.setupQuality >=
      strategy.minSetupQuality;

    addRule(rules, {
      code: "SETUP_QUALITY",
      name: "Minimum setup quality",
      state: qualityPass
        ? "PASS"
        : "FAIL",
      severity: qualityPass
        ? "INFO"
        : "HIGH",
      score: clamp(
        setup.setupQuality,
      ),
      required: true,
      reason: qualityPass
        ? `Setup quality ${setup.setupQuality} meets the ${strategy.minSetupQuality} threshold.`
        : `Setup quality ${setup.setupQuality} is below the ${strategy.minSetupQuality} threshold.`,
    });
  }

  // ------------------------------------------------------------
  // 4. SIGNAL STRENGTH
  // ------------------------------------------------------------

  const strengthPass =
    setup.signalStrength >=
    strategy.entryFramework
      .minSignalStrength;

  addRule(rules, {
    code: "SIGNAL_STRENGTH",
    name: "Signal strength",
    state: strengthPass
      ? "PASS"
      : "FAIL",
    severity: strengthPass
      ? "INFO"
      : "HIGH",
    score: clamp(
      setup.signalStrength,
    ),
    required: true,
    reason: strengthPass
      ? `Signal strength ${setup.signalStrength} meets the required threshold.`
      : `Signal strength ${setup.signalStrength} is below the required threshold.`,
  });

  // ------------------------------------------------------------
  // 5. MOMENTUM
  // ------------------------------------------------------------

  const momentumScore =
    setup.momentum ===
      "STRONG_BULLISH"
      ? 100
      : setup.momentum ===
          "BULLISH"
        ? 75
        : setup.momentum ===
            "NEUTRAL"
          ? 50
          : setup.momentum ===
              "BEARISH"
            ? 25
            : 0;

  const momentumDirectionPass =
    setup.direction === "BUY"
      ? momentumScore >=
        strategy.entryFramework
          .minMomentumScore
      : setup.direction === "SELL"
        ? momentumScore <=
          100 -
            strategy.entryFramework
              .minMomentumScore
        : true;

  addRule(rules, {
    code: "MOMENTUM",
    name: "Momentum alignment",
    state: momentumDirectionPass
      ? "PASS"
      : "FAIL",
    severity: momentumDirectionPass
      ? "INFO"
      : "HIGH",
    score: momentumScore,
    required: false,
    reason: momentumDirectionPass
      ? "Momentum supports the setup direction."
      : "Momentum does not fully support the setup direction.",
  });

  // ------------------------------------------------------------
  // 6. TREND
  // ------------------------------------------------------------

  const trendBullish =
    setup.trend === "STRONG_UP" ||
    setup.trend === "UP";

  const trendBearish =
    setup.trend === "STRONG_DOWN" ||
    setup.trend === "DOWN";

  const trendPass =
    !strategy.requireTrendAlignment ||
    (setup.direction === "BUY" &&
      trendBullish) ||
    (setup.direction === "SELL" &&
      trendBearish);

  addRule(rules, {
    code: "TREND_ALIGNMENT",
    name: "Trend alignment",
    state: trendPass
      ? "PASS"
      : "FAIL",
    severity: trendPass
      ? "INFO"
      : "HIGH",
    score:
      setup.trend === "STRONG_UP" ||
      setup.trend === "STRONG_DOWN"
        ? 100
        : setup.trend === "UP" ||
            setup.trend === "DOWN"
          ? 75
          : 40,
    required:
      strategy.requireTrendAlignment,
    reason: trendPass
      ? "Trend is aligned with the setup."
      : "Trend conflicts with the setup direction.",
  });

  // ------------------------------------------------------------
  // 7. VOLUME
  // ------------------------------------------------------------

  const volumePass =
    !strategy.requireVolumeConfirmation ||
    setup.volume === "VERY_HIGH" ||
    setup.volume === "HIGH" ||
    setup.volume === "NORMAL";

  addRule(rules, {
    code: "VOLUME_CONFIRMATION",
    name: "Volume confirmation",
    state: volumePass
      ? "PASS"
      : "FAIL",
    severity: volumePass
      ? "INFO"
      : "HIGH",
    score:
      setup.volume === "VERY_HIGH"
        ? 100
        : setup.volume === "HIGH"
          ? 85
          : setup.volume === "NORMAL"
            ? 70
            : setup.volume === "WEAK"
              ? 40
              : 15,
    required:
      strategy.requireVolumeConfirmation,
    reason: volumePass
      ? "Volume provides sufficient confirmation."
      : "Volume confirmation is too weak.",
  });

  // ------------------------------------------------------------
  // 8. MARKET CONFIRMATION
  // ------------------------------------------------------------

  if (
    strategy.requireMarketConfirmation &&
    market
  ) {
    const breadth =
      market.breadthScore;

    const crossMarket =
      market.crossMarketScore;

    const breadthPass =
      breadth === null ||
      breadth === undefined ||
      (setup.direction === "BUY" &&
        breadth > -20) ||
      (setup.direction === "SELL" &&
        breadth < 20);

    const crossPass =
      crossMarket === null ||
      crossMarket === undefined ||
      (setup.direction === "BUY" &&
        crossMarket > -20) ||
      (setup.direction === "SELL" &&
        crossMarket < 20);

    const marketPass =
      breadthPass && crossPass;

    addRule(rules, {
      code: "MARKET_CONFIRMATION",
      name: "Market confirmation",
      state: marketPass
        ? "PASS"
        : "FAIL",
      severity: marketPass
        ? "INFO"
        : "HIGH",
      score: clamp(
        50 +
          ((breadth ?? 0) +
            (crossMarket ?? 0)) /
            4,
      ),
      required: true,
      reason: marketPass
        ? "Market conditions support the setup."
        : "Market conditions contradict the setup.",
    });
  }

  // ------------------------------------------------------------
  // 9. FALSE SIGNAL
  // ------------------------------------------------------------

  if (falseSignal) {
    const score =
      falseSignal.falseSignalScore;

    const pass =
      score <=
      strategy.maxFalseSignalScore;

    addRule(rules, {
      code: "FALSE_SIGNAL",
      name: "False-signal protection",
      state: pass
        ? "PASS"
        : "FAIL",
      severity: pass
        ? "INFO"
        : "CRITICAL",
      score: 100 - score,
      required: true,
      reason: pass
        ? `False-signal score ${score} is within the allowed limit.`
        : `False-signal score ${score} exceeds the allowed limit of ${strategy.maxFalseSignalScore}.`,
    });
  }

  // ------------------------------------------------------------
  // 10. SIGNAL CONFLICT
  // ------------------------------------------------------------

  if (conflicts) {
    const score =
      conflicts.conflictScore;

    const pass =
      score <=
      strategy.maxConflictScore;

    addRule(rules, {
      code: "SIGNAL_CONFLICT",
      name: "Signal conflict protection",
      state: pass
        ? "PASS"
        : "FAIL",
      severity: pass
        ? "INFO"
        : "CRITICAL",
      score: 100 - score,
      required: true,
      reason: pass
        ? `Conflict score ${score} is within the allowed limit.`
        : `Conflict score ${score} exceeds the allowed limit of ${strategy.maxConflictScore}.`,
    });
  }

  // ------------------------------------------------------------
  // 11. RISK CONTRADICTION
  // ------------------------------------------------------------

  if (riskContradiction) {
    const score =
      riskContradiction.contradictionScore;

    const pass =
      score <=
      strategy.maxRiskContradictionScore;

    addRule(rules, {
      code: "RISK_CONTRADICTION",
      name: "Risk contradiction protection",
      state: pass
        ? "PASS"
        : "FAIL",
      severity: pass
        ? "INFO"
        : "CRITICAL",
      score: 100 - score,
      required: true,
      reason: pass
        ? `Risk contradiction score ${score} is within the allowed limit.`
        : `Risk contradiction score ${score} exceeds the allowed limit of ${strategy.maxRiskContradictionScore}.`,
    });
  }

  // ------------------------------------------------------------
  // 12. PATTERN
  // ------------------------------------------------------------

  if (
    strategy.requirePatternConfirmation
  ) {
    const patternPass =
      Boolean(pattern?.recognized);

    addRule(rules, {
      code: "PATTERN_CONFIRMATION",
      name: "Pattern confirmation",
      state: patternPass
        ? "PASS"
        : "FAIL",
      severity: patternPass
        ? "INFO"
        : "HIGH",
      score:
        pattern?.patternConfidence ??
        0,
      required: true,
      reason: patternPass
        ? "Historical pattern confirmation is present."
        : "Required historical pattern confirmation is missing.",
    });
  }

  // ------------------------------------------------------------
  // 13. STRATEGY-SPECIFIC PATTERNS
  // ------------------------------------------------------------

  if (
    setup.characteristics.includes(
      "breakout",
    ) &&
    !strategy.entryFramework
      .allowBreakouts
  ) {
    addRule(rules, {
      code: "BREAKOUT_ALLOWED",
      name: "Breakout permission",
      state: "FAIL",
      severity: "HIGH",
      score: 0,
      required: true,
      reason:
        "Breakout setups are disabled for this strategy.",
    });
  }

  if (
    setup.characteristics.includes(
      "reversal",
    ) &&
    !strategy.entryFramework
      .allowReversals
  ) {
    addRule(rules, {
      code: "REVERSAL_ALLOWED",
      name: "Reversal permission",
      state: "FAIL",
      severity: "HIGH",
      score: 0,
      required: true,
      reason:
        "Reversal setups are disabled for this strategy.",
    });
  }

  // ------------------------------------------------------------
  // 14. SCORE
  // ------------------------------------------------------------

  const requiredRules =
    rules.filter(
      (rule) => rule.required,
    );

  const passedRules =
    requiredRules.filter(
      (rule) =>
        rule.state === "PASS",
    );

  const cautionRules =
    requiredRules.filter(
      (rule) =>
        rule.state === "CAUTION",
    );

  const failedRules =
    requiredRules.filter(
      (rule) =>
        rule.state === "FAIL",
    );

  const blockers =
    rules
      .filter(
        (rule) =>
          rule.state === "FAIL" &&
          rule.required,
      )
      .map(
        (rule) =>
          rule.code,
      );

  const warnings =
    rules
      .filter(
        (rule) =>
          rule.state === "CAUTION",
      )
      .map(
        (rule) =>
          rule.reason,
      );

  const ruleScore =
    requiredRules.length === 0
      ? 0
      : clamp(
          Math.round(
            requiredRules.reduce(
              (sum, rule) =>
                sum + rule.score,
              0,
            ) /
              requiredRules.length,
          ),
        );

  let state: StrategyRuleState;

  if (failedRules.length > 0) {
    state = "FAIL";
  } else if (
    cautionRules.length > 0 ||
    ruleScore < 90
  ) {
    state = "CAUTION";
  } else {
    state = "PASS";
  }

  // ------------------------------------------------------------
  // 15. CONFIDENCE
  // ------------------------------------------------------------

  const confidence = clamp(
    Math.round(
      requiredRules.length * 7 +
        passedRules.length * 2 +
        failedRules.length * 3,
    ),
  );

  // ------------------------------------------------------------
  // 16. EXPLANATION
  // ------------------------------------------------------------

  const explanation =
    state === "PASS"
      ? `Strategy rules passed for the ${setup.direction} setup.`
      : state === "CAUTION"
        ? `Strategy rules are conditionally satisfied for the ${setup.direction} setup.`
        : `Strategy rules failed for the ${setup.direction} setup.`;

  return {
    state,
    ruleScore,
    confidence,
    rules,
    passedRules:
      passedRules.map(
        (rule) => rule.code,
      ),
    cautionRules:
      cautionRules.map(
        (rule) => rule.code,
      ),
    failedRules:
      failedRules.map(
        (rule) => rule.code,
      ),
    blockers,
    warnings,
    explanation,
  };
}

export const strategyRulesEngine = {
  evaluate: evaluateStrategyRules,
};
