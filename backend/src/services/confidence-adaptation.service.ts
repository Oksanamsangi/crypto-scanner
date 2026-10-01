import type { OutcomeStatus } from "./outcome-tracking.service.js";

export type ConfidenceAdaptationState =
  | "INCREASE"
  | "DECREASE"
  | "MAINTAIN"
  | "INSUFFICIENT_DATA";

export type ConfidenceAdaptationReason =
  | "OVERCONFIDENCE"
  | "UNDERCONFIDENCE"
  | "CALIBRATED"
  | "MIXED_EVIDENCE"
  | "INSUFFICIENT_HISTORY";

export interface ConfidenceAdaptationObservation {
  outcomeStatus: OutcomeStatus;
  confidence: number;
  returnPercent: number;
}

export interface ConfidenceAdaptationInput {
  currentConfidence: number;
  observations: ConfidenceAdaptationObservation[];

  minimumSampleSize?: number;
  adaptationStrength?: number;
}

export interface ConfidenceAdaptationResult {
  state: ConfidenceAdaptationState;

  currentConfidence: number;
  adaptedConfidence: number;

  adjustment: number;

  historicalAccuracy: number;
  sampleSize: number;

  calibrationError: number;

  reason: ConfidenceAdaptationReason;

  supportingFactors: string[];
  warningFactors: string[];
  recommendations: string[];

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

function getHistoricalAccuracy(
  observations: ConfidenceAdaptationObservation[],
): number {
  if (observations.length === 0) {
    return 0;
  }

  const wins = observations.filter(
    (observation) =>
      observation.outcomeStatus === "WIN",
  ).length;

  const breakevens = observations.filter(
    (observation) =>
      observation.outcomeStatus ===
      "BREAKEVEN",
  ).length;

  return (
    (wins + breakevens * 0.5) /
    observations.length
  ) * 100;
}

function getAverageConfidence(
  observations: ConfidenceAdaptationObservation[],
): number {
  if (observations.length === 0) {
    return 0;
  }

  const total = observations.reduce(
    (sum, observation) =>
      sum + clamp(observation.confidence),
    0,
  );

  return total / observations.length;
}

export function adaptConfidence(
  input: ConfidenceAdaptationInput,
): ConfidenceAdaptationResult {
  const currentConfidence = clamp(
    input.currentConfidence,
  );

  const observations =
    input.observations.filter(
      (observation) =>
        Number.isFinite(
          observation.confidence,
        ) &&
        Number.isFinite(
          observation.returnPercent,
        ),
    );

  const sampleSize =
    observations.length;

  const minimumSampleSize = Math.max(
    1,
    Math.floor(
      input.minimumSampleSize ?? 10,
    ),
  );

  const adaptationStrength = clamp(
    input.adaptationStrength ?? 0.25,
    0,
    1,
  );

  if (
    sampleSize <
    minimumSampleSize
  ) {
    return {
      state: "INSUFFICIENT_DATA",

      currentConfidence:
        round(currentConfidence),

      adaptedConfidence:
        round(currentConfidence),

      adjustment: 0,

      historicalAccuracy: round(
        getHistoricalAccuracy(
          observations,
        ),
      ),

      sampleSize,

      calibrationError: 0,

      reason:
        "INSUFFICIENT_HISTORY",

      supportingFactors: [],

      warningFactors: [
        "There is not enough completed outcome history for reliable confidence adaptation.",
      ],

      recommendations: [
        "Collect more completed outcomes before adapting confidence.",
      ],

      explanation:
        "Confidence remains unchanged because the historical sample is too small for reliable adaptation.",
    };
  }

  const historicalAccuracy =
    round(
      getHistoricalAccuracy(
        observations,
      ),
    );

  const averageConfidence =
    round(
      getAverageConfidence(
        observations,
      ),
    );

  const calibrationError = round(
    Math.abs(
      averageConfidence -
        historicalAccuracy,
    ),
  );

  const difference =
    historicalAccuracy -
    averageConfidence;

  let state: ConfidenceAdaptationState;
  let reason: ConfidenceAdaptationReason;

  if (difference >= 10) {
    state = "INCREASE";
    reason = "UNDERCONFIDENCE";
  } else if (difference <= -10) {
    state = "DECREASE";
    reason = "OVERCONFIDENCE";
  } else if (calibrationError <= 5) {
    state = "MAINTAIN";
    reason = "CALIBRATED";
  } else {
    state = "MAINTAIN";
    reason = "MIXED_EVIDENCE";
  }

  const rawAdjustment =
    difference *
    adaptationStrength;

  const adjustment =
    state === "MAINTAIN"
      ? 0
      : round(
          clamp(
            rawAdjustment,
            -10,
            10,
          ),
        );

  const adaptedConfidence =
    round(
      clamp(
        currentConfidence +
          adjustment,
      ),
    );

  const supportingFactors: string[] =
    [];

  const warningFactors: string[] =
    [];

  const recommendations: string[] =
    [];

  if (
    state === "INCREASE"
  ) {
    supportingFactors.push(
      "Historical outcomes indicate that observed confidence has been lower than historical accuracy.",
    );

    recommendations.push(
      "Allow a modest upward confidence adjustment while preserving the underlying signal logic.",
    );
  }

  if (
    state === "DECREASE"
  ) {
    warningFactors.push(
      "Historical outcomes indicate that observed confidence has exceeded historical accuracy.",
    );

    recommendations.push(
      "Apply a modest downward confidence adjustment to reduce overconfidence.",
    );
  }

  if (
    state === "MAINTAIN"
  ) {
    supportingFactors.push(
      "Historical confidence is sufficiently aligned with observed outcomes.",
    );

    recommendations.push(
      "Keep the current confidence level unchanged.",
    );
  }

  if (
    calibrationError > 15
  ) {
    warningFactors.push(
      "Historical calibration error is materially elevated.",
    );
  }

  if (
    sampleSize < 25
  ) {
    recommendations.push(
      "Continue collecting completed outcomes before making stronger confidence adjustments.",
    );
  }

  return {
    state,

    currentConfidence:
      round(currentConfidence),

    adaptedConfidence,

    adjustment,

    historicalAccuracy,

    sampleSize,

    calibrationError,

    reason,

    supportingFactors: [
      ...new Set(
        supportingFactors,
      ),
    ],

    warningFactors: [
      ...new Set(
        warningFactors,
      ),
    ],

    recommendations: [
      ...new Set(
        recommendations,
      ),
    ],

    explanation:
      state === "INCREASE"
        ? "Historical outcomes support a modest increase in confidence because observed accuracy exceeds historical confidence."
        : state === "DECREASE"
          ? "Historical outcomes support a modest decrease in confidence because historical confidence exceeds observed accuracy."
          : "Historical evidence does not justify changing the current confidence level.",
  };
}
