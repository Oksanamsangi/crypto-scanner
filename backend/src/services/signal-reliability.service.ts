import type { ConfidenceCalibrationResult } from "./confidence-calibration.service.js";
import type { FalseSignalResult } from "./false-signal-detector.service.js";
import type { SignalConflictResult } from "./signal-conflict-detector.service.js";
import type { PatternRecognitionResult } from "./pattern-recognition.service.js";
import type { SetupQualityScoreResult } from "./setup-quality-score.service.js";

export type SignalReliabilityGrade =
  | "A+"
  | "A"
  | "B"
  | "C"
  | "D"
  | "F";

export type SignalReliabilityState =
  | "VERY_HIGH"
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "UNRELIABLE";

export interface SignalReliabilityInput {
  confidence: number;
  setupQuality?: number | null;
  calibration?: ConfidenceCalibrationResult | null;
  falseSignal?: FalseSignalResult | null;
  conflicts?: SignalConflictResult | null;
  pattern?: PatternRecognitionResult | null;
  marketConfirmation?: number | null;
  sampleSize?: number;
}

export interface SignalReliabilityComponent {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  reason: string;
}

export interface SignalReliabilityResult {
  reliabilityScore: number;
  grade: SignalReliabilityGrade;
  state: SignalReliabilityState;
  confidence: number;
  historicalAccuracy: number;
  calibrationError: number;
  sampleSize: number;
  components: SignalReliabilityComponent[];
  supportingFactors: string[];
  riskFactors: string[];
  warnings: string[];
  explanation: string;
}

function clamp(
  value: number,
  min = 0,
  max = 100,
): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getGrade(score: number): SignalReliabilityGrade {
  if (score >= 90) {
    return "A+";
  }

  if (score >= 80) {
    return "A";
  }

  if (score >= 70) {
    return "B";
  }

  if (score >= 60) {
    return "C";
  }

  if (score >= 50) {
    return "D";
  }

  return "F";
}

function getState(score: number): SignalReliabilityState {
  if (score >= 90) {
    return "VERY_HIGH";
  }

  if (score >= 80) {
    return "HIGH";
  }

  if (score >= 65) {
    return "MODERATE";
  }

  if (score >= 50) {
    return "LOW";
  }

  return "UNRELIABLE";
}

function buildComponent(
  name: string,
  score: number,
  weight: number,
  reason: string,
): SignalReliabilityComponent {
  const normalizedScore = clamp(score);

  return {
    name,
    score: round(normalizedScore),
    weight,
    contribution: round(normalizedScore * weight),
    reason,
  };
}

export function assessSignalReliability(
  input: SignalReliabilityInput,
): SignalReliabilityResult {
  const confidence = clamp(input.confidence);
  const setupQuality = clamp(input.setupQuality ?? 50);

  const calibration = input.calibration ?? null;
  const falseSignal = input.falseSignal ?? null;
  const conflicts = input.conflicts ?? null;
  const pattern = input.pattern ?? null;

  const sampleSize = Math.max(
    0,
    Math.round(
      input.sampleSize ??
        calibration?.sampleSize ??
        0,
    ),
  );

  const historicalAccuracy = round(
    calibration?.historicalAccuracy ?? 0,
  );

  const calibrationError = round(
    calibration?.calibrationError ?? 0,
  );

  const components: SignalReliabilityComponent[] = [];

  components.push(
    buildComponent(
      "Signal Confidence",
      confidence,
      0.2,
      "Higher signal confidence supports stronger reliability.",
    ),
  );

  components.push(
    buildComponent(
      "Setup Quality",
      setupQuality,
      0.15,
      "Higher setup quality indicates stronger structural conditions.",
    ),
  );

  if (calibration) {
    components.push(
      buildComponent(
        "Historical Accuracy",
        historicalAccuracy,
        0.2,
        "Historical accuracy measures how often comparable signals produced the expected outcome.",
      ),
    );

    components.push(
      buildComponent(
        "Confidence Calibration",
        clamp(100 - calibrationError),
        0.1,
        "Lower calibration error indicates better alignment between confidence and historical outcomes.",
      ),
    );
  } else {
    components.push(
      buildComponent(
        "Historical Accuracy",
        50,
        0.2,
        "No historical calibration data is available.",
      ),
    );

    components.push(
      buildComponent(
        "Confidence Calibration",
        50,
        0.1,
        "No calibration history is available.",
      ),
    );
  }

  if (falseSignal) {
    const falseSignalScore =
      falseSignal.state === "PASS"
        ? 100
        : falseSignal.state === "CAUTION"
          ? 65
          : 20;

    components.push(
      buildComponent(
        "False Signal Protection",
        falseSignalScore,
        0.1,
        "Lower false-signal risk supports higher reliability.",
      ),
    );
  } else {
    components.push(
      buildComponent(
        "False Signal Protection",
        50,
        0.1,
        "False-signal assessment is unavailable.",
      ),
    );
  }

  if (conflicts) {
    const conflictScore =
      conflicts.state === "ALIGNED"
        ? 100
        : conflicts.state === "MIXED"
          ? 60
          : 20;

    components.push(
      buildComponent(
        "Signal Alignment",
        conflictScore,
        0.1,
        "Aligned signal components support stronger reliability.",
      ),
    );
  } else {
    components.push(
      buildComponent(
        "Signal Alignment",
        50,
        0.1,
        "Signal conflict assessment is unavailable.",
      ),
    );
  }

  if (pattern) {
    const patternScore = pattern.recognized
      ? clamp(pattern.patternConfidence)
      : 35;

    components.push(
      buildComponent(
        "Pattern Confirmation",
        patternScore,
        0.05,
        "Recognized historical patterns provide additional signal support.",
      ),
    );
  } else {
    components.push(
      buildComponent(
        "Pattern Confirmation",
        50,
        0.05,
        "Pattern confirmation is unavailable.",
      ),
    );
  }

  if (
    input.marketConfirmation !== null &&
    input.marketConfirmation !== undefined
  ) {
    components.push(
      buildComponent(
        "Market Confirmation",
        clamp(input.marketConfirmation),
        0.1,
        "Market confirmation measures alignment with broader market conditions.",
      ),
    );
  } else {
    components.push(
      buildComponent(
        "Market Confirmation",
        50,
        0.1,
        "Market confirmation is unavailable.",
      ),
    );
  }

  const totalWeight = components.reduce(
    (sum, component) => sum + component.weight,
    0,
  );

  const weightedScore =
    components.reduce(
      (sum, component) => sum + component.contribution,
      0,
    ) / totalWeight;

  let reliabilityScore = clamp(weightedScore);

  const supportingFactors: string[] = [];
  const riskFactors: string[] = [];
  const warnings: string[] = [];

  if (confidence >= 80) {
    supportingFactors.push(
      "High signal confidence.",
    );
  }

  if (setupQuality >= 80) {
    supportingFactors.push(
      "Strong setup quality.",
    );
  }

  if (historicalAccuracy >= 70) {
    supportingFactors.push(
      "Strong historical accuracy.",
    );
  }

  if (
    calibration &&
    calibration.calibrationState === "WELL_CALIBRATED"
  ) {
    supportingFactors.push(
      "Confidence is well calibrated.",
    );
  }

  if (
    falseSignal &&
    falseSignal.state === "PASS"
  ) {
    supportingFactors.push(
      "False-signal checks passed.",
    );
  }

  if (
    conflicts &&
    conflicts.state === "ALIGNED"
  ) {
    supportingFactors.push(
      "Signal components are aligned.",
    );
  }

  if (
    pattern &&
    pattern.recognized
  ) {
    supportingFactors.push(
      "Historical pattern confirmation is available.",
    );
  }

  if (
    input.marketConfirmation !== null &&
    input.marketConfirmation !== undefined &&
    input.marketConfirmation >= 70
  ) {
    supportingFactors.push(
      "Strong market confirmation.",
    );
  }

  if (
    calibration &&
    calibration.calibrationState === "OVERCONFIDENT"
  ) {
    reliabilityScore -= 8;
    riskFactors.push(
      "Confidence is historically overconfident.",
    );
  }

  if (
    calibration &&
    calibration.calibrationState === "UNDERCONFIDENT"
  ) {
    riskFactors.push(
      "Confidence is historically underconfident.",
    );
  }

  if (
    falseSignal &&
    falseSignal.state !== "PASS"
  ) {
    reliabilityScore -= 10;
    riskFactors.push(
      "False-signal risk is elevated.",
    );
  }

  if (
    conflicts &&
    conflicts.state !== "ALIGNED"
  ) {
    reliabilityScore -= 10;
    riskFactors.push(
      "Signal components are not fully aligned.",
    );
  }

  if (
    pattern &&
    !pattern.recognized
  ) {
    riskFactors.push(
      "Historical pattern confirmation is weak.",
    );
  }

  if (sampleSize === 0) {
    warnings.push(
      "No historical sample is available.",
    );
  } else if (sampleSize < 25) {
    warnings.push(
      "Historical sample size is limited.",
    );
  }

  if (sampleSize < 10) {
    reliabilityScore -= 8;
  } else if (sampleSize < 25) {
    reliabilityScore -= 4;
  }

  reliabilityScore = clamp(reliabilityScore);

  const grade = getGrade(reliabilityScore);
  const state = getState(reliabilityScore);

  const explanation =
    sampleSize === 0
      ? "Signal reliability is based primarily on current signal quality because historical data is unavailable."
      : `Signal reliability is ${state.toLowerCase()} based on confidence, setup quality, historical accuracy, calibration, signal alignment, and market confirmation.`;

  return {
    reliabilityScore: round(reliabilityScore),
    grade,
    state,
    confidence: round(confidence),
    historicalAccuracy,
    calibrationError,
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
