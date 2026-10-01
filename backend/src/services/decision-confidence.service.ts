import type { ConfidenceCalibrationResult } from "./confidence-calibration.service.js";
import type { SignalReliabilityResult } from "./signal-reliability.service.js";
import type { HistoricalAccuracyResult } from "./historical-accuracy.service.js";
import type { TrustScoreResult } from "./trust-score.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";
import type { RiskContradictionResult } from "./risk-contradiction.service.js";
import type { StrategyExecutionInput } from "./strategy-execution-engine.service.js";
import type { ExecutionPlan } from "./strategy-execution-engine.service.js";


export type DecisionConfidenceGrade =
  | "A+"
  | "A"
  | "B"
  | "C"
  | "D"
  | "F";

export type DecisionConfidenceState =
  | "VERY_HIGH"
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "INSUFFICIENT";

export interface DecisionConfidenceInput {
  confidence: number;
  calibration?: ConfidenceCalibrationResult | null;
  reliability?: SignalReliabilityResult | null;
  historicalAccuracy?: HistoricalAccuracyResult | null;
  trustScore?: TrustScoreResult | null;
  falseSignal?: FalseSignalResult | null;
  conflicts?: SignalConflictResult | null;
  riskContradiction?: RiskContradictionResult | null;
  execution?: StrategyExecutionInput | ExecutionPlan | null;
}

export interface DecisionConfidenceComponent {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  reason: string;
}

export interface DecisionConfidenceResult {
  decisionConfidence: number;
  grade: DecisionConfidenceGrade;
  state: DecisionConfidenceState;
  confidence: number;
  sampleSize: number;
  executionState: "APPROVED" | "CONDITIONAL" | "BLOCKED" | "UNKNOWN";
  components: DecisionConfidenceComponent[];
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

function getGrade(score: number): DecisionConfidenceGrade {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function getState(score: number): DecisionConfidenceState {
  if (score >= 90) return "VERY_HIGH";
  if (score >= 80) return "HIGH";
  if (score >= 65) return "MODERATE";
  if (score >= 50) return "LOW";
  return "INSUFFICIENT";
}

function buildComponent(
  name: string,
  score: number,
  weight: number,
  reason: string
): DecisionConfidenceComponent {
  const normalizedScore = clamp(score);

  return {
    name,
    score: round(normalizedScore),
    weight,
    contribution: round(normalizedScore * weight),
    reason,
  };
}

function getExecutionState(
  execution: StrategyExecutionInput | ExecutionPlan | null
): "APPROVED" | "CONDITIONAL" | "BLOCKED" | "UNKNOWN" {
  if (!execution) return "UNKNOWN";

  const candidate = execution as {
    state?: string;
    executionState?: string;
  };

  const state = candidate.state ?? candidate.executionState;

  if (state === "APPROVED") return "APPROVED";
  if (state === "CONDITIONAL") return "CONDITIONAL";
  if (state === "BLOCKED") return "BLOCKED";

  return "UNKNOWN";
}

export function calculateDecisionConfidence(
  input: DecisionConfidenceInput
): DecisionConfidenceResult {
  const confidence = clamp(input.confidence);

  const calibration = input.calibration ?? null;
  const reliability = input.reliability ?? null;
  const historicalAccuracy = input.historicalAccuracy ?? null;
  const trustScore = input.trustScore ?? null;
  const falseSignal = input.falseSignal ?? null;
  const conflicts = input.conflicts ?? null;
  const riskContradiction = input.riskContradiction ?? null;
  const execution = input.execution ?? null;

  const sampleSize = Math.max(
    0,
    Math.round(
      historicalAccuracy?.sampleSize ??
        reliability?.sampleSize ??
        calibration?.sampleSize ??
        trustScore?.sampleSize ??
        0
    )
  );

  const executionState = getExecutionState(execution);

  const components: DecisionConfidenceComponent[] = [];

  components.push(
    buildComponent(
      "Calibrated Confidence",
      calibration?.calibratedConfidence ?? confidence,
      0.15,
      calibration
        ? "Calibrated confidence adjusts the raw signal confidence using historical outcomes."
        : "No calibration result is available, so raw confidence is used."
    )
  );

  components.push(
    buildComponent(
      "Signal Reliability",
      reliability?.reliabilityScore ?? 50,
      0.15,
      reliability
        ? "Signal reliability summarizes the quality of the signal."
        : "Signal reliability is unavailable."
    )
  );

  components.push(
    buildComponent(
      "Historical Accuracy",
      historicalAccuracy?.accuracy ?? 50,
      0.15,
      historicalAccuracy
        ? "Historical accuracy measures completed signal outcomes."
        : "Historical accuracy is unavailable."
    )
  );

  components.push(
    buildComponent(
      "Trust Score",
      trustScore?.trustScore ?? 50,
      0.2,
      trustScore
        ? "Trust score combines reliability, calibration, history, setup quality and defenses."
        : "Trust score is unavailable."
    )
  );

  components.push(
    buildComponent(
      "Current Signal Quality",
      reliability?.confidence ?? confidence,
      0.1,
      "Current signal confidence represents immediate signal quality."
    )
  );

  if (falseSignal) {
    const score =
      falseSignal.state === "PASS"
        ? 100
        : falseSignal.state === "CAUTION"
          ? 60
          : 10;

    components.push(
      buildComponent(
        "False Signal Defense",
        score,
        0.1,
        "False-signal protection reduces decision confidence when signal quality is questionable."
      )
    );
  } else {
    components.push(
      buildComponent(
        "False Signal Defense",
        50,
        0.1,
        "False-signal assessment is unavailable."
      )
    );
  }

  if (conflicts) {
    const score =
      conflicts.state === "ALIGNED"
        ? 100
        : conflicts.state === "MIXED"
          ? 60
          : 10;

    components.push(
      buildComponent(
        "Signal Alignment",
        score,
        0.05,
        "Agreement between signal components supports decision confidence."
      )
    );
  } else {
    components.push(
      buildComponent(
        "Signal Alignment",
        50,
        0.05,
        "Signal conflict assessment is unavailable."
      )
    );
  }

  if (riskContradiction) {
    const score =
      riskContradiction.state === "ALIGNED"
        ? 100
        : riskContradiction.state === "CONTRADICTED"
          ? 10
          : 50;

    components.push(
      buildComponent(
        "Risk Consistency",
        score,
        0.1,
        "Decision confidence increases when risk conditions support the signal."
      )
    );
  } else {
    components.push(
      buildComponent(
        "Risk Consistency",
        50,
        0.1,
        "Risk contradiction assessment is unavailable."
      )
    );
  }

  const totalWeight = components.reduce(
    (sum, component) => sum + component.weight,
    0
  );

  let decisionConfidence =
    components.reduce(
      (sum, component) => sum + component.contribution,
      0
    ) / totalWeight;

  const reasons: string[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (confidence >= 80) {
    reasons.push("High current signal confidence.");
  }

  if (calibration?.calibrationState === "WELL_CALIBRATED") {
    reasons.push("Confidence is well calibrated.");
  }

  if (reliability && reliability.reliabilityScore >= 80) {
    reasons.push("Signal reliability is strong.");
  }

  if (historicalAccuracy && historicalAccuracy.accuracy >= 70) {
    reasons.push("Historical accuracy supports the decision.");
  }

  if (trustScore && trustScore.trustScore >= 80) {
    reasons.push("Trust score strongly supports the decision.");
  }

  if (falseSignal?.state === "PASS") {
    reasons.push("False-signal defenses passed.");
  }

  if (conflicts?.state === "ALIGNED") {
    reasons.push("Signal components are aligned.");
  }

  if (riskContradiction?.state === "ALIGNED") {
    reasons.push("Risk conditions support the decision.");
  }

  if (executionState === "APPROVED") {
    reasons.push("Strategy execution is approved.");
  }

  if (executionState === "CONDITIONAL") {
    decisionConfidence -= 8;
    warnings.push("Strategy execution is conditional.");
  }

  if (executionState === "BLOCKED") {
    blockers.push("Strategy execution is blocked.");
  }

  if (calibration?.calibrationState === "OVERCONFIDENT") {
    decisionConfidence -= 8;
    warnings.push("Confidence is historically overconfident.");
  }

  if (falseSignal && falseSignal.state !== "PASS") {
    decisionConfidence -= 12;
    blockers.push("False-signal defense is not fully passed.");
  }

  if (conflicts && conflicts.state !== "ALIGNED") {
    decisionConfidence -= 10;
    blockers.push("Signal components are not fully aligned.");
  }

  if (
    riskContradiction &&
    riskContradiction.state !== "ALIGNED"
  ) {
    decisionConfidence -= 15;
    blockers.push("Risk conditions contradict the signal.");
  }

  if (sampleSize === 0) {
    warnings.push("No historical sample is available.");
  } else if (sampleSize < 25) {
    warnings.push("Historical sample size is limited.");
  }

  if (!calibration) {
    warnings.push("Confidence calibration is unavailable.");
  }

  if (!historicalAccuracy) {
    warnings.push("Historical accuracy is unavailable.");
  }

  decisionConfidence = clamp(decisionConfidence);

  const grade = getGrade(decisionConfidence);
  const state = getState(decisionConfidence);

  if (state === "INSUFFICIENT") {
    warnings.push(
      "Decision confidence is insufficient for a strong conclusion."
    );
  }

  const explanation =
    blockers.length > 0
      ? `Decision confidence is ${decisionConfidence} because one or more decision safeguards are blocking or weakening the signal.`
      : sampleSize === 0
        ? `Decision confidence is ${decisionConfidence}, based primarily on current signal evidence because historical data is unavailable.`
        : `Decision confidence is ${decisionConfidence}, based on calibrated confidence, reliability, historical accuracy, trust, signal defenses, and risk consistency.`;

  return {
    decisionConfidence: round(decisionConfidence),
    grade,
    state,
    confidence: round(confidence),
    sampleSize,
    executionState,
    components,
    reasons: [...new Set(reasons)],
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    explanation,
  };
}
