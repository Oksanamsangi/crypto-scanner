import type { OutcomeStatus } from "./outcome-tracking.service.js";

export type LearningFeedbackState =
  | "POSITIVE"
  | "NEGATIVE"
  | "MIXED"
  | "INSUFFICIENT_DATA";

export type LearningSignal =
  | "SETUP_VALIDATED"
  | "SETUP_REJECTED"
  | "CONFIDENCE_VALIDATED"
  | "CONFIDENCE_OVERSTATED"
  | "CONFIDENCE_UNDERSTATED"
  | "PATTERN_SUPPORT"
  | "PATTERN_WARNING"
  | "STRATEGY_SUPPORT"
  | "STRATEGY_WARNING"
  | "COLLECT_MORE_DATA";

export interface LearningFeedbackInput {
  outcomeStatus: OutcomeStatus;
  outcomeReturn: number;

  confidence: number;
  signalStrength: number;
  score: number;

  setupQuality?: number | null;

  trend?: string | null;
  momentum?: string | null;
  volatility?: string | null;
  volume?: string | null;

  sampleSize?: number;
}

export interface LearningFeedbackResult {
  state: LearningFeedbackState;

  learningScore: number;

  outcome: {
    status: OutcomeStatus;
    returnPercent: number;
    validated: boolean;
  };

  confidence: {
    predicted: number;
    expected: number;
    error: number;
    assessment:
      | "VALIDATED"
      | "OVERSTATED"
      | "UNDERSTATED"
      | "NEUTRAL";
  };

  setup: {
    quality: number | null;
    assessment:
      | "VALIDATED"
      | "REJECTED"
      | "NEUTRAL"
      | "UNKNOWN";
  };

  learningSignals: LearningSignal[];

  patternEvidence: string[];
  strategyEvidence: string[];
  confidenceEvidence: string[];

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

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function assessLearningFeedback(
  input: LearningFeedbackInput,
): LearningFeedbackResult {
  const confidence = clamp(input.confidence);
  const signalStrength = clamp(input.signalStrength);
  const score = clamp(input.score);

  const sampleSize = Math.max(
    0,
    Math.floor(input.sampleSize ?? 0),
  );

  const expectedConfidence =
    input.outcomeStatus === "WIN"
      ? 100
      : input.outcomeStatus === "LOSS"
        ? 0
        : 50;

  const confidenceError = round(
    Math.abs(confidence - expectedConfidence),
  );

  const validated =
    input.outcomeStatus === "WIN" ||
    input.outcomeStatus === "BREAKEVEN";

  let confidenceAssessment:
    | "VALIDATED"
    | "OVERSTATED"
    | "UNDERSTATED"
    | "NEUTRAL";

  if (input.outcomeStatus === "BREAKEVEN") {
    confidenceAssessment = "NEUTRAL";
  } else if (
    input.outcomeStatus === "LOSS" &&
    confidence >= 70
  ) {
    confidenceAssessment = "OVERSTATED";
  } else if (
    input.outcomeStatus === "WIN" &&
    confidence < 50
  ) {
    confidenceAssessment = "UNDERSTATED";
  } else {
    confidenceAssessment = "VALIDATED";
  }

  let setupAssessment:
    | "VALIDATED"
    | "REJECTED"
    | "NEUTRAL"
    | "UNKNOWN";

  if (input.setupQuality == null) {
    setupAssessment = "UNKNOWN";
  } else if (input.outcomeStatus === "WIN") {
    setupAssessment =
      input.setupQuality >= 70
        ? "VALIDATED"
        : "NEUTRAL";
  } else if (input.outcomeStatus === "LOSS") {
    setupAssessment =
      input.setupQuality >= 70
        ? "REJECTED"
        : "NEUTRAL";
  } else {
    setupAssessment = "NEUTRAL";
  }

  let learningScore = 50;

  if (input.outcomeStatus === "WIN") {
    learningScore += 30;
  } else if (input.outcomeStatus === "LOSS") {
    learningScore -= 30;
  }

  if (input.outcomeReturn > 0) {
    learningScore += 10;
  } else if (input.outcomeReturn < 0) {
    learningScore -= 10;
  }

  if (
    confidenceAssessment === "OVERSTATED"
  ) {
    learningScore -= 15;
  }

  if (
    confidenceAssessment === "UNDERSTATED"
  ) {
    learningScore += 5;
  }

  if (
    setupAssessment === "VALIDATED"
  ) {
    learningScore += 5;
  }

  if (
    setupAssessment === "REJECTED"
  ) {
    learningScore -= 5;
  }

  learningScore = round(clamp(learningScore));

  let state: LearningFeedbackState;

  if (sampleSize === 0) {
    state = "INSUFFICIENT_DATA";
  } else if (learningScore >= 70) {
    state = "POSITIVE";
  } else if (learningScore <= 35) {
    state = "NEGATIVE";
  } else {
    state = "MIXED";
  }

  const learningSignals: LearningSignal[] = [];
  const patternEvidence: string[] = [];
  const strategyEvidence: string[] = [];
  const confidenceEvidence: string[] = [];
  const recommendations: string[] = [];

  if (input.outcomeStatus === "WIN") {
    learningSignals.push(
      "SETUP_VALIDATED",
      "PATTERN_SUPPORT",
      "STRATEGY_SUPPORT",
    );

    patternEvidence.push(
      "The observed setup was followed by a positive outcome.",
    );

    strategyEvidence.push(
      "The signal outcome provides positive evidence for the associated strategy context.",
    );
  }

  if (input.outcomeStatus === "LOSS") {
    learningSignals.push(
      "SETUP_REJECTED",
      "PATTERN_WARNING",
      "STRATEGY_WARNING",
    );

    patternEvidence.push(
      "The observed setup was followed by a negative outcome.",
    );

    strategyEvidence.push(
      "The signal outcome provides negative evidence for the associated strategy context.",
    );
  }

  if (
    confidenceAssessment === "VALIDATED"
  ) {
    learningSignals.push(
      "CONFIDENCE_VALIDATED",
    );

    confidenceEvidence.push(
      "The confidence level was directionally consistent with the observed outcome.",
    );
  }

  if (
    confidenceAssessment === "OVERSTATED"
  ) {
    learningSignals.push(
      "CONFIDENCE_OVERSTATED",
    );

    confidenceEvidence.push(
      "The confidence level was high relative to an unsuccessful outcome.",
    );

    recommendations.push(
      "Review high-confidence predictions for possible overconfidence.",
    );
  }

  if (
    confidenceAssessment === "UNDERSTATED"
  ) {
    learningSignals.push(
      "CONFIDENCE_UNDERSTATED",
    );

    confidenceEvidence.push(
      "The signal succeeded despite relatively low predicted confidence.",
    );

    recommendations.push(
      "Review successful low-confidence signals for possible underconfidence.",
    );
  }

  if (
    input.outcomeStatus === "BREAKEVEN"
  ) {
    recommendations.push(
      "Treat the outcome as neutral evidence rather than strong validation or rejection.",
    );
  }

  if (
    input.setupQuality != null &&
    input.setupQuality >= 70 &&
    input.outcomeStatus === "LOSS"
  ) {
    recommendations.push(
      "Review high-quality setups that still produced negative outcomes for hidden failure conditions.",
    );
  }

  if (
    input.setupQuality != null &&
    input.setupQuality < 50 &&
    input.outcomeStatus === "WIN"
  ) {
    recommendations.push(
      "Review successful low-quality setups before treating them as repeatable patterns.",
    );
  }

  if (sampleSize < 25) {
    learningSignals.push(
      "COLLECT_MORE_DATA",
    );

    recommendations.push(
      "Collect more completed outcomes before making strong learning adjustments.",
    );
  }

  if (
    signalStrength >= 80 &&
    input.outcomeStatus === "LOSS"
  ) {
    recommendations.push(
      "Review strong signals that failed to identify conditions that invalidated the setup.",
    );
  }

  if (
    score >= 80 &&
    input.outcomeStatus === "LOSS"
  ) {
    recommendations.push(
      "Review high-scoring signals that produced negative outcomes.",
    );
  }

  if (
    input.trend &&
    input.momentum &&
    input.volume
  ) {
    patternEvidence.push(
      `Observed setup characteristics: trend=${input.trend}, momentum=${input.momentum}, volume=${input.volume}.`,
    );
  }

  if (input.volatility) {
    patternEvidence.push(
      `Observed volatility environment: ${input.volatility}.`,
    );
  }

  const explanation =
    state === "POSITIVE"
      ? "The completed outcome provides positive learning evidence for the current signal and setup characteristics."
      : state === "NEGATIVE"
        ? "The completed outcome provides negative learning evidence and should be reviewed for conditions associated with signal failure."
        : state === "MIXED"
          ? "The completed outcome provides mixed learning evidence and should not trigger a strong adaptation by itself."
          : "There is not enough historical outcome data to make a reliable learning adjustment.";

  return {
    state,
    learningScore,

    outcome: {
      status: input.outcomeStatus,
      returnPercent: round(input.outcomeReturn),
      validated,
    },

    confidence: {
      predicted: round(confidence),
      expected: expectedConfidence,
      error: confidenceError,
      assessment: confidenceAssessment,
    },

    setup: {
      quality:
        input.setupQuality == null
          ? null
          : round(clamp(input.setupQuality)),
      assessment: setupAssessment,
    },

    learningSignals: unique(learningSignals),

    patternEvidence: unique(patternEvidence),
    strategyEvidence: unique(strategyEvidence),
    confidenceEvidence: unique(confidenceEvidence),

    recommendations: unique(recommendations),

    explanation,
  };
}
