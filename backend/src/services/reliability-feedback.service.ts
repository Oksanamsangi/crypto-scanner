import type { ConfidenceCalibrationResult } from "./confidence-calibration.service.js";
import type { SignalReliabilityResult } from "./signal-reliability.service.js";
import type { HistoricalAccuracyResult } from "./historical-accuracy.service.js";

export type ReliabilityFeedbackOutcome =
  | "POSITIVE"
  | "NEGATIVE"
  | "NEUTRAL"
  | "INSUFFICIENT_DATA";

export type ReliabilityFeedbackAction =
  | "INCREASE_TRUST"
  | "DECREASE_TRUST"
  | "MAINTAIN_TRUST"
  | "COLLECT_MORE_DATA";

export interface ReliabilityFeedbackInput {
  predictedConfidence: number;
  actualOutcome: "WIN" | "LOSS" | "BREAKEVEN";
  returnPercent: number;
  calibration?: ConfidenceCalibrationResult | null;
  reliability?: SignalReliabilityResult | null;
  historicalAccuracy?: HistoricalAccuracyResult | null;
}

export interface ReliabilityFeedbackResult {
  outcome: ReliabilityFeedbackOutcome;
  action: ReliabilityFeedbackAction;
  feedbackScore: number;
  confidenceError: number;
  predictionCorrect: boolean;
  historicalAccuracyBefore: number;
  sampleSizeBefore: number;
  supportingFactors: string[];
  riskFactors: string[];
  recommendations: string[];
  explanation: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function assessReliabilityFeedback(
  input: ReliabilityFeedbackInput
): ReliabilityFeedbackResult {
  const predictedConfidence = clamp(input.predictedConfidence);

  const calibration = input.calibration ?? null;
  const reliability = input.reliability ?? null;
  const historicalAccuracy = input.historicalAccuracy ?? null;

  const historicalAccuracyBefore = round(
    historicalAccuracy?.accuracy ??
      calibration?.historicalAccuracy ??
      0
  );

  const sampleSizeBefore =
    historicalAccuracy?.sampleSize ??
    calibration?.sampleSize ??
    reliability?.sampleSize ??
    0;

  const confidenceError = round(
    Math.abs(
      predictedConfidence -
        (input.actualOutcome === "WIN"
          ? 100
          : input.actualOutcome === "LOSS"
            ? 0
            : 50)
    )
  );

  const predictionCorrect =
    input.actualOutcome === "WIN" && predictedConfidence >= 50
      ? true
      : input.actualOutcome === "LOSS" && predictedConfidence < 50
        ? true
        : input.actualOutcome === "BREAKEVEN";

  let feedbackScore = 50;

  if (predictionCorrect) {
    feedbackScore += 30;
  } else {
    feedbackScore -= 30;
  }

  if (input.returnPercent > 0) {
    feedbackScore += 10;
  } else if (input.returnPercent < 0) {
    feedbackScore -= 10;
  }

  if (
    reliability &&
    reliability.reliabilityScore >= 80 &&
    predictionCorrect
  ) {
    feedbackScore += 10;
  }

  if (
    reliability &&
    reliability.reliabilityScore < 50 &&
    !predictionCorrect
  ) {
    feedbackScore -= 5;
  }

  feedbackScore = clamp(feedbackScore);

  let outcome: ReliabilityFeedbackOutcome;

  if (sampleSizeBefore === 0) {
    outcome = "INSUFFICIENT_DATA";
  } else if (feedbackScore >= 70) {
    outcome = "POSITIVE";
  } else if (feedbackScore <= 35) {
    outcome = "NEGATIVE";
  } else {
    outcome = "NEUTRAL";
  }

  let action: ReliabilityFeedbackAction;

  if (outcome === "POSITIVE") {
    action = "INCREASE_TRUST";
  } else if (outcome === "NEGATIVE") {
    action = "DECREASE_TRUST";
  } else if (outcome === "NEUTRAL") {
    action = "MAINTAIN_TRUST";
  } else {
    action = "COLLECT_MORE_DATA";
  }

  const supportingFactors: string[] = [];
  const riskFactors: string[] = [];
  const recommendations: string[] = [];

  if (predictionCorrect) {
    supportingFactors.push(
      "Signal outcome was consistent with the prediction."
    );
  } else {
    riskFactors.push(
      "Signal outcome was inconsistent with the prediction."
    );
  }

  if (input.returnPercent > 0) {
    supportingFactors.push("Signal produced a positive return.");
  }

  if (input.returnPercent < 0) {
    riskFactors.push("Signal produced a negative return.");
  }

  if (predictedConfidence >= 80 && predictionCorrect) {
    supportingFactors.push(
      "High-confidence prediction was validated."
    );
  }

  if (predictedConfidence >= 80 && !predictionCorrect) {
    riskFactors.push(
      "High-confidence prediction was not validated."
    );
    recommendations.push(
      "Review calibration for high-confidence signals."
    );
  }

  if (
    calibration &&
    calibration.calibrationState === "OVERCONFIDENT"
  ) {
    riskFactors.push(
      "Historical calibration already indicates overconfidence."
    );
    recommendations.push(
      "Reduce confidence weighting until calibration improves."
    );
  }

  if (
    calibration &&
    calibration.calibrationState === "UNDERCONFIDENT"
  ) {
    supportingFactors.push(
      "Historical calibration indicates underconfidence."
    );
    recommendations.push(
      "Consider allowing stronger confidence when outcomes remain consistent."
    );
  }

  if (sampleSizeBefore < 25) {
    recommendations.push(
      "Collect more completed signals before making large reliability adjustments."
    );
  }

  if (outcome === "POSITIVE") {
    recommendations.push(
      "Use this outcome as positive evidence for future reliability assessment."
    );
  }

  if (outcome === "NEGATIVE") {
    recommendations.push(
      "Use this outcome as negative evidence for future reliability assessment."
    );
  }

  if (outcome === "INSUFFICIENT_DATA") {
    recommendations.push(
      "Continue collecting completed outcomes before drawing historical conclusions."
    );
  }

  const explanation =
    outcome === "POSITIVE"
      ? "The completed signal supports the current reliability assessment."
      : outcome === "NEGATIVE"
        ? "The completed signal contradicts the current reliability assessment."
        : outcome === "NEUTRAL"
          ? "The completed signal provides mixed evidence for reliability."
          : "There is not enough historical data to make a reliable feedback adjustment.";

  return {
    outcome,
    action,
    feedbackScore: round(feedbackScore),
    confidenceError,
    predictionCorrect,
    historicalAccuracyBefore,
    sampleSizeBefore,
    supportingFactors: [...new Set(supportingFactors)],
    riskFactors: [...new Set(riskFactors)],
    recommendations: [...new Set(recommendations)],
    explanation,
  };
}
