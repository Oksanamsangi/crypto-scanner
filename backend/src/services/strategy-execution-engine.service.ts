import type { SetupFingerprint } from "./setup-fingerprint.service.js";
import type { StrategyDefinition } from "./strategy-definition.service.js";
import type {
  StrategyRulesResult,
} from "./strategy-rules-engine.service.js";

export type ExecutionState =
  | "APPROVED"
  | "CONDITIONAL"
  | "BLOCKED";

export type ExecutionDirection =
  | "LONG"
  | "SHORT"
  | "NONE";

export type ExecutionCondition =
  | "RULES_PASSED"
  | "RULES_CAUTION"
  | "RULES_FAILED"
  | "BREAKOUT_ALLOWED"
  | "REVERSAL_ALLOWED"
  | "TREND_CONTINUATION_ALLOWED"
  | "TRAILING_STOP_ENABLED"
  | "MAX_HOLDING_TIME_SET"
  | "POSITION_LIMIT_SET";

export interface ExecutionPlan {
  state: ExecutionState;
  direction: ExecutionDirection;
  confidence: number;

  entry: {
    eligible: boolean;
    framework: string;
    signalStrength: number;
    momentum: string;
  };

  protection: {
    stopLossRatio: number;
    takeProfitRatio: number;
    trailingStopEnabled: boolean;
    trailingStopRatio: number;
    maxHoldingMinutes: number;
  };

  position: {
    maxPositionRiskPercent: number;
    maxConcurrentPositions: number;
    scaleInEnabled: boolean;
    scaleOutEnabled: boolean;
  };

  conditions: ExecutionCondition[];

  blockers: string[];
  warnings: string[];
  explanation: string;
}

export interface StrategyExecutionInput {
  strategy: StrategyDefinition;
  setup: SetupFingerprint;
  rules: StrategyRulesResult;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function resolveDirection(
  setup: SetupFingerprint,
  strategy: StrategyDefinition,
): ExecutionDirection {
  if (
    setup.direction === "BUY" &&
    (strategy.direction === "LONG" || strategy.direction === "BOTH")
  ) {
    return "LONG";
  }

  if (
    setup.direction === "SELL" &&
    (strategy.direction === "SHORT" || strategy.direction === "BOTH")
  ) {
    return "SHORT";
  }

  return "NONE";
}

function buildFramework(setup: SetupFingerprint): string {
  const characteristics = setup.characteristics.map((item) =>
    item.toLowerCase(),
  );

  if (characteristics.includes("breakout")) {
    return "BREAKOUT";
  }

  if (characteristics.includes("reversal")) {
    return "REVERSAL";
  }

  return "TREND_CONTINUATION";
}

export function buildStrategyExecutionPlan(
  input: StrategyExecutionInput,
): ExecutionPlan {
  const {
    strategy,
    setup,
    rules,
  } = input;

  const direction = resolveDirection(setup, strategy);
  const framework = buildFramework(setup);

  const blockers = [...rules.blockers];
  const warnings = [...rules.warnings];

  if (direction === "NONE") {
    blockers.push("STRATEGY_DIRECTION_MISMATCH");
  }

  if (
    framework === "BREAKOUT" &&
    !strategy.entryFramework.allowBreakouts
  ) {
    blockers.push("BREAKOUT_NOT_ALLOWED");
  }

  if (
    framework === "REVERSAL" &&
    !strategy.entryFramework.allowReversals
  ) {
    blockers.push("REVERSAL_NOT_ALLOWED");
  }

  if (
    framework === "TREND_CONTINUATION" &&
    !strategy.entryFramework.allowTrendContinuation
  ) {
    blockers.push("TREND_CONTINUATION_NOT_ALLOWED");
  }

  const uniqueBlockers = [...new Set(blockers)];
  const uniqueWarnings = [...new Set(warnings)];

  const conditions: ExecutionCondition[] = [];

  if (rules.state === "PASS") {
    conditions.push("RULES_PASSED");
  } else if (rules.state === "CAUTION") {
    conditions.push("RULES_CAUTION");
  } else {
    conditions.push("RULES_FAILED");
  }

  if (
    framework === "BREAKOUT" &&
    strategy.entryFramework.allowBreakouts
  ) {
    conditions.push("BREAKOUT_ALLOWED");
  }

  if (
    framework === "REVERSAL" &&
    strategy.entryFramework.allowReversals
  ) {
    conditions.push("REVERSAL_ALLOWED");
  }

  if (
    framework === "TREND_CONTINUATION" &&
    strategy.entryFramework.allowTrendContinuation
  ) {
    conditions.push("TREND_CONTINUATION_ALLOWED");
  }

  if (strategy.exitFramework.trailingStopEnabled) {
    conditions.push("TRAILING_STOP_ENABLED");
  }

  if (strategy.exitFramework.maxHoldingMinutes > 0) {
    conditions.push("MAX_HOLDING_TIME_SET");
  }

  if (strategy.positionFramework.maxConcurrentPositions > 0) {
    conditions.push("POSITION_LIMIT_SET");
  }

  let state: ExecutionState;

  if (uniqueBlockers.length > 0 || rules.state === "FAIL") {
    state = "BLOCKED";
  } else if (rules.state === "CAUTION") {
    state = "CONDITIONAL";
  } else {
    state = "APPROVED";
  }

  let confidence = clamp(
    rules.confidence * 0.65 +
      setup.confidence * 0.25 +
      setup.signalStrength * 0.1,
  );

  if (state === "CONDITIONAL") {
    confidence *= 0.85;
  }

  if (state === "BLOCKED") {
    confidence *= 0.6;
  }

  confidence = Math.round(clamp(confidence));

  let explanation: string;

  if (state === "APPROVED") {
    explanation =
      `Execution approved for ${direction} using the ${framework.toLowerCase()} framework. ` +
      "All required strategy rules passed.";
  } else if (state === "CONDITIONAL") {
    explanation =
      `Execution is conditional for ${direction} using the ${framework.toLowerCase()} framework. ` +
      "The strategy rules contain caution conditions.";
  } else {
    explanation =
      `Execution blocked for ${direction === "NONE" ? "this setup" : direction.toLowerCase()}. ` +
      "One or more strategy execution requirements failed.";
  }

  return {
    state,
    direction,
    confidence,
    entry: {
      eligible: state !== "BLOCKED",
      framework,
      signalStrength: setup.signalStrength,
      momentum: setup.momentum,
    },
    protection: {
      stopLossRatio: strategy.exitFramework.stopLossRatio,
      takeProfitRatio: strategy.exitFramework.takeProfitRatio,
      trailingStopEnabled:
        strategy.exitFramework.trailingStopEnabled,
      trailingStopRatio:
        strategy.exitFramework.trailingStopRatio,
      maxHoldingMinutes:
        strategy.exitFramework.maxHoldingMinutes,
    },
    position: {
      maxPositionRiskPercent:
        strategy.positionFramework.maxPositionRiskPercent,
      maxConcurrentPositions:
        strategy.positionFramework.maxConcurrentPositions,
      scaleInEnabled:
        strategy.positionFramework.scaleInEnabled,
      scaleOutEnabled:
        strategy.positionFramework.scaleOutEnabled,
    },
    conditions,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    explanation,
  };
}
