import type { ConfidenceCalibrationResult } from "./confidence-calibration.service.js";
import type { SignalReliabilityResult } from "./signal-reliability.service.js";
import type { HistoricalAccuracyResult } from "./historical-accuracy.service.js";
import type { SetupQualityScoreResult } from "./setup-quality-score.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";
import type { RiskContradictionResult } from "./risk-contradiction.service.js";

export type TrustScoreGrade =
  | "A+"
  | "A"
  | "B"
  | "C"
  | "D"
  | "F";

export type TrustScoreState =
  | "VERY_HIGH"
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "UNTRUSTWORTHY";

export interface TrustScoreInput {
  confidence: number;
  calibration?: ConfidenceCalibrationResult | null;
  reliability?: SignalReliabilityResult | null;
  historicalAccuracy?: HistoricalAccuracyResult | null;
  setupQuality?: SetupQualityScoreResult | null;
  falseSignal?: FalseSignalResult | null;
  conflicts?: SignalConflictResult | null;
  riskContradiction?: RiskContradictionResult | null;
}

export interface TrustScoreComponent {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  reason: string;
}

export interface TrustScoreResult {
  trustScore: number;
  grade: TrustScoreGrade;
  state: TrustScoreState;
  confidence: number;
  sampleSize: number;
  components: TrustScoreComponent[];
  supportingFactors: string[];
  riskFactors: string[];
  warnings: string[];
  explanation: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getGrade(score: number): TrustScoreGrade {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function getState(score: number): TrustScoreState {
  if (score >= 90) return "VERY_HIGH";
  if (score >= 80) return "HIGH";
  if (score >= 65) return "MODERATE";
  if (score >= 50) return "LOW";
  return "UNTRUSTWORTHY";
}

function buildComponent(
  name: string,
  score: number,
  weight: number,
  reason: string
): TrustScoreComponent {
  const normalizedScore = clamp(score);

  return {
    name,
    score: round(normalizedScore),
    weight,
    contribution: round(normalizedScore * weight),
    reason,
  };
}

export function calculateTrustScore(
  input: TrustScoreInput
): TrustScoreResult {
  const confidence = clamp(input.confidence);

  const calibration = input.calibration ?? null;
  const reliability = input.reliability ?? null;
  const historicalAccuracy = input.historicalAccuracy ?? null;
  const setupQuality = input.setupQuality ?? null;
  const falseSignal = input.falseSignal ?? null;
  const conflicts = input.conflicts ?? null;
  const riskContradiction = input.riskContradiction ?? null;

  const sampleSize = Math.max(
    0,
    Math.round(
      historicalAccuracy?.sampleSize ??
        reliability?.sampleSize ??
        calibration?.sampleSize ??
        0
    )
  );

  const components: TrustScoreComponent[] = [];

  components.push(
    buildComponent(
      "Signal Confidence",
      confidence,
      0.15,
      "Higher confidence supports stronger trust."
    )
  );

  components.push(
    buildComponent(
      "Signal Reliability",
      reliability?.reliabilityScore ?? 50,
      0.2,
      reliability
        ? "Signal reliability summarizes current and historical signal quality."
        : "Signal reliability data is unavailable."
    )
  );

  components.push(
    buildComponent(
      "Historical Accuracy",
      historicalAccuracy?.accuracy ?? 50,
      0.2,
      historicalAccuracy
        ? "Historical accuracy measures completed signal outcomes."
        : "Historical accuracy data is unavailable."
    )
  );

  components.push(
    buildComponent(
      "Confidence Calibration",
      calibration
        ? clamp(100 - calibration.calibrationError)
        : 50,
      0.1,
      calibration
        ? "Lower calibration error indicates better confidence accuracy."
        : "Confidence calibration data is unavailable."
    )
  );

  components.push(
    buildComponent(
      "Setup Quality",
      setupQuality?.qualityScore ?? 50,
      0.1,
      setupQuality
        ? "Setup quality measures the structural quality of the signal."
        : "Setup quality data is unavailable."
    )
  );

  if (falseSignal) {
    const score =
      falseSignal.state === "PASS"
        ? 100
        : falseSignal.state === "CAUTION"
          ? 60
          : 15;

    components.push(
      buildComponent(
        "False Signal Protection",
        score,
        0.1,
        "Lower false-signal risk supports stronger trust."
      )
    );
  } else {
    components.push(
      buildComponent(
        "False Signal Protection",
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
          : 15;

    components.push(
      buildComponent(
        "Signal Alignment",
        score,
        0.05,
        "Aligned signal components increase trust."
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
          ? 15
          : 50;

    components.push(
      buildComponent(
        "Risk Consistency",
        score,
        0.1,
        "Consistent risk conditions increase trust."
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

  const weightedScore =
    components.reduce(
      (sum, component) => sum + component.contribution,
      0
    ) / totalWeight;

  let trustScore = clamp(weightedScore);

  const supportingFactors: string[] = [];
  const riskFactors: string[] = [];
  const warnings: string[] = [];

  if (confidence >= 80) {
    supportingFactors.push("High signal confidence.");
  }

  if (
    reliability &&
    reliability.reliabilityScore >= 80
  ) {
    supportingFactors.push("Strong signal reliability.");
  }

  if (
    historicalAccuracy &&
    historicalAccuracy.accuracy >= 70
  ) {
    supportingFactors.push("Strong historical accuracy.");
  }

  if (
    calibration &&
    calibration.calibrationState === "WELL_CALIBRATED"
  ) {
    supportingFactors.push("Confidence is well calibrated.");
  }

  if (
    setupQuality &&
    setupQuality.qualityScore >= 80
  ) {
    supportingFactors.push("Strong setup quality.");
  }

  if (
    falseSignal &&
    falseSignal.state === "PASS"
  ) {
    supportingFactors.push("False-signal checks passed.");
  }

  if (
    conflicts &&
    conflicts.state === "ALIGNED"
  ) {
    supportingFactors.push("Signal components are aligned.");
  }

  if (
    riskContradiction &&
    riskContradiction.state === "ALIGNED"
  ) {
    supportingFactors.push("Risk conditions are aligned.");
  }

  if (
    calibration &&
    calibration.calibrationState === "OVERCONFIDENT"
  ) {
    trustScore -= 8;
    riskFactors.push(
      "Confidence is historically overconfident."
    );
  }

  if (
    calibration &&
    calibration.calibrationState === "UNDERCONFIDENT"
  ) {
    riskFactors.push(
      "Confidence is historically underconfident."
    );
  }

  if (
    falseSignal &&
    falseSignal.state !== "PASS"
  ) {
    trustScore -= 10;
    riskFactors.push(
      "False-signal risk is elevated."
    );
  }

  if (
    conflicts &&
    conflicts.state !== "ALIGNED"
  ) {
    trustScore -= 8;
    riskFactors.push(
      "Signal components are not fully aligned."
    );
  }

  if (
    riskContradiction &&
    riskContradiction.state !== "ALIGNED"
  ) {
    trustScore -= 12;
    riskFactors.push(
      "Risk conditions contradict the signal."
    );
  }

  if (sampleSize === 0) {
    warnings.push(
      "No historical sample is available."
    );
  } else if (sampleSize < 25) {
    warnings.push(
      "Historical sample size is limited."
    );
  }

  if (!reliability) {
    warnings.push(
      "Signal reliability assessment is unavailable."
    );
  }

  if (!historicalAccuracy) {
    warnings.push(
      "Historical accuracy assessment is unavailable."
    );
  }

  trustScore = clamp(trustScore);

  const grade = getGrade(trustScore);
  const state = getState(trustScore);

  const explanation =
    sampleSize === 0
      ? `Trust score is ${trustScore} because historical evidence is unavailable and the score relies primarily on current signal quality.`
      : `Trust score is ${trustScore} based on signal confidence, reliability, historical accuracy, calibration, setup quality, signal alignment, and risk consistency.`;

  return {
    trustScore: round(trustScore),
    grade,
    state,
    confidence: round(confidence),
    sampleSize,
    components,
    supportingFactors: [
      ...new Set(supportingFactors),
    ],
    riskFactors: [
      ...new Set(riskFactors),
    ],
    warnings: [
      ...new Set(warnings),
    ],
    explanation,
  };
}
