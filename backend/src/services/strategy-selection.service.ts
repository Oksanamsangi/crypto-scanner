import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { PatternRecognitionResult } from "./pattern-recognition.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";
import type { RiskContradictionResult } from "./risk-contradiction.service.js";
import type { StrategyDefinition } from "./strategy-definition.service.js";
import type { StrategyRulesResult } from "./strategy-rules-engine.service.js";
import type { ExecutionPlan } from "./strategy-execution-engine.service.js";
import type { StrategyPerformanceResult } from "./strategy-performance.service.js";

export type StrategySelectionState =
  | "SELECTED"
  | "ALTERNATIVE"
  | "NO_STRATEGY";

export interface StrategySelectionInput {
  strategy: StrategyDefinition;
  setup: SetupFingerprint;
  rules: StrategyRulesResult;
  execution: ExecutionPlan;
  performance?: StrategyPerformanceResult | null;
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

export interface StrategySelectionCandidate {
  strategyId: string;
  strategyName: string;
  state: StrategySelectionState;
  score: number;
  confidence: number;
  ruleScore: number;
  performanceScore: number;
  executionState: "APPROVED" | "CONDITIONAL" | "BLOCKED";
  reasons: string[];
  blockers: string[];
  warnings: string[];
}

export interface StrategySelectionResult {
  state: StrategySelectionState;
  selectedStrategyId: string | null;
  selectedStrategyName: string | null;
  score: number;
  confidence: number;
  candidates: StrategySelectionCandidate[];
  reasons: string[];
  blockers: string[];
  warnings: string[];
  explanation: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildCandidate(
  input: StrategySelectionInput,
): StrategySelectionCandidate {
  const {
    strategy,
    setup,
    rules,
    execution,
    performance,
    pattern,
    falseSignal,
    conflicts,
    riskContradiction,
    market,
  } = input;

  let score =
    rules.ruleScore * 0.25 +
    setup.confidence * 0.15 +
    setup.signalStrength * 0.1 +
    (performance?.performanceScore ?? 50) * 0.2 +
    (performance?.confidence ?? 50) * 0.1;

  const reasons: string[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (rules.state === "PASS") {
    score += 8;
    reasons.push("Strategy rules passed.");
  } else if (rules.state === "CAUTION") {
    score -= 5;
    warnings.push("Strategy rules passed with caution.");
  } else {
    score -= 30;
    blockers.push("STRATEGY_RULES_FAILED");
  }

  if (execution.state === "APPROVED") {
    score += 8;
    reasons.push("Execution plan is approved.");
  } else if (execution.state === "CONDITIONAL") {
    score -= 4;
    warnings.push("Execution plan is conditional.");
  } else {
    score -= 30;
    blockers.push("EXECUTION_BLOCKED");
  }

  if (falseSignal) {
    if (falseSignal.state === "PASS") {
      score += 5;
      reasons.push("False-signal checks passed.");
    } else if (falseSignal.state === "CAUTION") {
      score -= 8;
      warnings.push("False-signal risk requires caution.");
    } else {
      score -= 25;
      blockers.push("FALSE_SIGNAL_REJECT");
    }
  }

  if (conflicts) {
    if (conflicts.state === "ALIGNED") {
      score += 5;
      reasons.push("Signal components are aligned.");
    } else if (conflicts.state === "MIXED") {
      score -= 6;
      warnings.push("Signal components are mixed.");
    } else {
      score -= 20;
      blockers.push("SIGNAL_CONFLICT");
    }
  }

  if (riskContradiction) {
    if (riskContradiction.state === "ALIGNED") {
      score += 5;
      reasons.push("Risk checks are aligned.");
    } else if (riskContradiction.state === "CAUTION") {
      score -= 6;
      warnings.push("Risk contradiction requires caution.");
    } else if (riskContradiction.state === "CONTRADICTED") {
      score -= 18;
      blockers.push("RISK_CONTRADICTION");
    } else {
      score -= 30;
      blockers.push("CRITICAL_RISK_CONTRADICTION");
    }
  }

  if (pattern) {
    if (pattern.recognized) {
      score += clamp(pattern.patternConfidence) * 0.08;
      reasons.push(
        `Recognized ${pattern.pattern} pattern with supporting history.`,
      );
    } else {
      warnings.push("No sufficiently confirmed historical pattern.");
    }
  }

  if (market) {
    if (
      market.breadthScore !== null &&
      market.breadthScore !== undefined
    ) {
      const breadthAlignment =
        setup.direction === "BUY"
          ? market.breadthScore
          : setup.direction === "SELL"
            ? -market.breadthScore
            : 50;

      if (breadthAlignment >= 60) {
        score += 5;
        reasons.push("Market breadth supports the setup direction.");
      } else if (breadthAlignment <= 40) {
        score -= 8;
        warnings.push("Market breadth contradicts the setup direction.");
      }
    }

    if (
      market.crossMarketScore !== null &&
      market.crossMarketScore !== undefined
    ) {
      const crossAlignment =
        setup.direction === "BUY"
          ? market.crossMarketScore
          : setup.direction === "SELL"
            ? -market.crossMarketScore
            : 50;

      if (crossAlignment >= 60) {
        score += 5;
        reasons.push("Cross-market confirmation supports the setup.");
      } else if (crossAlignment <= 40) {
        score -= 8;
        warnings.push("Cross-market confirmation is weak or contradictory.");
      }
    }

    if (market.regime) {
      const regime = market.regime.toUpperCase();

      if (
        (setup.direction === "BUY" &&
          ["BULLISH", "TRENDING_UP", "BREAKOUT"].includes(regime)) ||
        (setup.direction === "SELL" &&
          ["BEARISH", "TRENDING_DOWN"].includes(regime))
      ) {
        score += 4;
        reasons.push("Market regime supports the setup direction.");
      }
    }
  }

  score = clamp(score);

  const confidence = Math.round(
    clamp(
      rules.confidence * 0.4 +
        setup.confidence * 0.25 +
        (performance?.confidence ?? 50) * 0.2 +
        (execution.state === "APPROVED"
          ? 100
          : execution.state === "CONDITIONAL"
            ? 70
            : 30) *
          0.15,
    ),
  );

  let state: StrategySelectionState;

  if (blockers.length > 0 || execution.state === "BLOCKED") {
    state = "NO_STRATEGY";
  } else if (score >= 75 && confidence >= 65) {
    state = "SELECTED";
  } else {
    state = "ALTERNATIVE";
  }

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    state,
    score: round(score),
    confidence,
    ruleScore: round(rules.ruleScore),
    performanceScore: round(performance?.performanceScore ?? 0),
    executionState: execution.state,
    reasons: [...new Set(reasons)],
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
  };
}

export function selectStrategy(
  inputs: StrategySelectionInput[],
): StrategySelectionResult {
  if (inputs.length === 0) {
    return {
      state: "NO_STRATEGY",
      selectedStrategyId: null,
      selectedStrategyName: null,
      score: 0,
      confidence: 0,
      candidates: [],
      reasons: [],
      blockers: ["NO_STRATEGIES_AVAILABLE"],
      warnings: [],
      explanation: "No strategy candidates are available for selection.",
    };
  }

  const uniqueInputs = Array.from(
    new Map(
      inputs.map((input) => [input.strategy.id, input]),
    ).values(),
  );

  const candidates = uniqueInputs
    .map(buildCandidate)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.confidence - a.confidence;
    });

  const selected = candidates.find(
    (candidate) => candidate.state === "SELECTED",
  );

  if (!selected) {
    const alternative = candidates.find(
      (candidate) => candidate.state === "ALTERNATIVE",
    );

    if (!alternative) {
      return {
        state: "NO_STRATEGY",
        selectedStrategyId: null,
        selectedStrategyName: null,
        score: 0,
        confidence: 0,
        candidates,
        reasons: [],
        blockers: [
          ...new Set(
            candidates.flatMap((candidate) => candidate.blockers),
          ),
        ],
        warnings: [
          ...new Set(
            candidates.flatMap((candidate) => candidate.warnings),
          ),
        ],
        explanation:
          "No strategy satisfies the required selection conditions.",
      };
    }

    return {
      state: "ALTERNATIVE",
      selectedStrategyId: alternative.strategyId,
      selectedStrategyName: alternative.strategyName,
      score: alternative.score,
      confidence: alternative.confidence,
      candidates,
      reasons: alternative.reasons,
      blockers: alternative.blockers,
      warnings: alternative.warnings,
      explanation:
        `${alternative.strategyName} is the strongest available alternative, ` +
        "but it does not meet the full selection threshold.",
    };
  }

  return {
    state: "SELECTED",
    selectedStrategyId: selected.strategyId,
    selectedStrategyName: selected.strategyName,
    score: selected.score,
    confidence: selected.confidence,
    candidates,
    reasons: selected.reasons,
    blockers: selected.blockers,
    warnings: selected.warnings,
    explanation:
      `${selected.strategyName} is the selected strategy based on rules, ` +
      "setup quality, execution readiness, historical performance, and market alignment.",
  };
}
