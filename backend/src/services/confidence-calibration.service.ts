export type CalibrationState =
  | "WELL_CALIBRATED"
  | "OVERCONFIDENT"
  | "UNDERCONFIDENT"
  | "INSUFFICIENT_DATA";

export type CalibrationReliability =
  | "VERY_HIGH"
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "UNKNOWN";

export interface ConfidenceObservation {
  confidence: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
}

export interface ConfidenceCalibrationResult {
  rawConfidence: number;
  calibratedConfidence: number;
  calibrationError: number;
  historicalAccuracy: number;
  reliability: CalibrationReliability;
  sampleSize: number;
  confidenceBand: string;
  calibrationState: CalibrationState;
  reasons: string[];
  warnings: string[];
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

function getConfidenceBand(confidence: number): string {
  if (confidence >= 90) {
    return "90-100";
  }

  if (confidence >= 80) {
    return "80-89";
  }

  if (confidence >= 70) {
    return "70-79";
  }

  if (confidence >= 60) {
    return "60-69";
  }

  if (confidence >= 50) {
    return "50-59";
  }

  return "0-49";
}

function getReliability(
  sampleSize: number,
  calibrationError: number,
): CalibrationReliability {
  if (sampleSize < 10) {
    return "UNKNOWN";
  }

  if (sampleSize >= 100 && calibrationError <= 5) {
    return "VERY_HIGH";
  }

  if (sampleSize >= 50 && calibrationError <= 8) {
    return "HIGH";
  }

  if (sampleSize >= 25 && calibrationError <= 12) {
    return "MODERATE";
  }

  return "LOW";
}

export function calibrateConfidence(
  rawConfidence: number,
  observations: ConfidenceObservation[],
): ConfidenceCalibrationResult {
  const confidence = clamp(rawConfidence);
  const sampleSize = observations.length;

  if (sampleSize === 0) {
    return {
      rawConfidence: round(confidence),
      calibratedConfidence: round(confidence),
      calibrationError: 0,
      historicalAccuracy: 0,
      reliability: "UNKNOWN",
      sampleSize: 0,
      confidenceBand: getConfidenceBand(confidence),
      calibrationState: "INSUFFICIENT_DATA",
      reasons: [
        "No historical outcomes are available for confidence calibration.",
      ],
      warnings: [
        "Calibrated confidence cannot be validated without historical observations.",
      ],
    };
  }

  const wins = observations.filter(
    (observation) => observation.outcome === "WIN",
  ).length;

  const breakevens = observations.filter(
    (observation) => observation.outcome === "BREAKEVEN",
  ).length;

  const effectiveWins = wins + breakevens * 0.5;

  const historicalAccuracy = clamp(
    (effectiveWins / sampleSize) * 100,
  );

  const calibrationError = Math.abs(
    confidence - historicalAccuracy,
  );

  /*
   * Move raw confidence toward the observed historical accuracy.
   *
   * Larger samples receive more calibration weight, but the raw
   * confidence still contributes to avoid overreacting to limited data.
   */
  const historicalWeight = clamp(
    0.2 + Math.min(sampleSize, 100) / 100 * 0.6,
    0.2,
    0.8,
  );

  const calibratedConfidence = clamp(
    confidence * (1 - historicalWeight) +
      historicalAccuracy * historicalWeight,
  );

  let calibrationState: CalibrationState;

  if (calibrationError <= 5) {
    calibrationState = "WELL_CALIBRATED";
  } else if (confidence > historicalAccuracy) {
    calibrationState = "OVERCONFIDENT";
  } else {
    calibrationState = "UNDERCONFIDENT";
  }

  const reliability = getReliability(
    sampleSize,
    calibrationError,
  );

  const reasons: string[] = [];
  const warnings: string[] = [];

  if (calibrationState === "WELL_CALIBRATED") {
    reasons.push(
      "Model confidence is closely aligned with historical accuracy.",
    );
  }

  if (calibrationState === "OVERCONFIDENT") {
    reasons.push(
      "Historical accuracy is below the raw confidence estimate.",
    );
    warnings.push(
      "Confidence may be overstating historical reliability.",
    );
  }

  if (calibrationState === "UNDERCONFIDENT") {
    reasons.push(
      "Historical accuracy is above the raw confidence estimate.",
    );
    warnings.push(
      "Confidence may be understating historical reliability.",
    );
  }

  if (sampleSize < 25) {
    warnings.push(
      "Historical sample size is limited.",
    );
  }

  if (sampleSize >= 25) {
    reasons.push(
      "Historical sample size is sufficient for a stronger calibration estimate.",
    );
  }

  return {
    rawConfidence: round(confidence),
    calibratedConfidence: round(calibratedConfidence),
    calibrationError: round(calibrationError),
    historicalAccuracy: round(historicalAccuracy),
    reliability,
    sampleSize,
    confidenceBand: getConfidenceBand(confidence),
    calibrationState,
    reasons: [...new Set(reasons)],
    warnings: [...new Set(warnings)],
  };
}
