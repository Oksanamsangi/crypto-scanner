import type {
  LearningFeedbackResult,
} from "./learning-feedback.service.js";

import type {
  PatternLearningResult,
} from "./pattern-learning.service.js";

import type {
  StrategyLearningResult,
} from "./strategy-learning.service.js";

import type {
  ConfidenceAdaptationResult,
} from "./confidence-adaptation.service.js";

export type SelfLearningState =
  | "LEARNING"
  | "POSITIVE_LEARNING"
  | "NEGATIVE_LEARNING"
  | "MIXED_LEARNING"
  | "INSUFFICIENT_DATA";

export interface SelfLearningInput {
  learningFeedback: LearningFeedbackResult;
  patternLearning: PatternLearningResult;
  strategyLearning: StrategyLearningResult;
  confidenceAdaptation: ConfidenceAdaptationResult;
}

export interface SelfLearningResult {
  state: SelfLearningState;

  learningScore: number;
  confidenceAdjustment: number;

  evidence: {
    feedbackState: LearningFeedbackResult["state"];
    patternState: PatternLearningResult["state"];
    strategyState: StrategyLearningResult["state"];
    confidenceState: ConfidenceAdaptationResult["state"];
  };

  strengths: string[];
  weaknesses: string[];
  learningSignals: string[];

  recommendations: string[];
  watchItems: string[];

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

export function orchestrateSelfLearning(
  input: SelfLearningInput,
): SelfLearningResult {
  const {
    learningFeedback,
    patternLearning,
    strategyLearning,
    confidenceAdaptation,
  } = input;

  const patternScore =
    patternLearning.sampleSize > 0
      ? patternLearning.learningScore
      : 0;

  const strategyScore =
    strategyLearning.sampleSize > 0
      ? strategyLearning.learningScore
      : 0;

  const feedbackScore =
    learningFeedback.state ===
    "INSUFFICIENT_DATA"
      ? 0
      : learningFeedback.learningScore;

  const confidenceScore =
    confidenceAdaptation.state ===
    "INSUFFICIENT_DATA"
      ? 0
      : clamp(
          100 -
            confidenceAdaptation.calibrationError,
        );

  const availableScores = [
    patternLearning.sampleSize > 0
      ? patternScore
      : null,
    strategyLearning.sampleSize > 0
      ? strategyScore
      : null,
    learningFeedback.state !==
    "INSUFFICIENT_DATA"
      ? feedbackScore
      : null,
    confidenceAdaptation.state !==
    "INSUFFICIENT_DATA"
      ? confidenceScore
      : null,
  ].filter(
    (score): score is number =>
      score !== null,
  );

  if (availableScores.length === 0) {
    return {
      state: "INSUFFICIENT_DATA",
      learningScore: 0,
      confidenceAdjustment: 0,

      evidence: {
        feedbackState:
          learningFeedback.state,
        patternState:
          patternLearning.state,
        strategyState:
          strategyLearning.state,
        confidenceState:
          confidenceAdaptation.state,
      },

      strengths: [],
      weaknesses: [
        "There is not enough completed historical evidence for meaningful self-learning.",
      ],

      learningSignals: [
        "COLLECT_MORE_DATA",
      ],

      recommendations: [
        "Continue collecting completed outcomes before making learning conclusions.",
      ],

      watchItems: [
        "Pattern evidence",
        "Strategy evidence",
        "Confidence calibration",
      ],

      explanation:
        "The learning system does not yet have enough completed evidence to produce a reliable unified learning state.",
    };
  }

  const learningScore = round(
    availableScores.reduce(
      (sum, score) => sum + score,
      0,
    ) / availableScores.length,
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const learningSignals: string[] = [];
  const recommendations: string[] = [];
  const watchItems: string[] = [];

  if (
    patternLearning.state ===
      "STRONG_SUPPORT" ||
    patternLearning.state ===
      "SUPPORT"
  ) {
    strengths.push(
      "Historical pattern evidence supports recurring setup characteristics.",
    );

    learningSignals.push(
      "PATTERN_SUPPORT",
    );
  }

  if (
    patternLearning.state ===
      "WARNING"
  ) {
    weaknesses.push(
      "Historical pattern evidence contains recurring warning characteristics.",
    );

    learningSignals.push(
      "PATTERN_WARNING",
    );
  }

  if (
    patternLearning.state ===
      "INSUFFICIENT_DATA"
  ) {
    watchItems.push(
      "Pattern history needs more observations.",
    );
  }

  if (
    strategyLearning.state ===
      "STRONG_SUPPORT" ||
    strategyLearning.state ===
      "SUPPORT"
  ) {
    strengths.push(
      "Historical strategy evidence supports the observed strategy characteristics.",
    );

    learningSignals.push(
      "STRATEGY_SUPPORT",
    );
  }

  if (
    strategyLearning.state ===
      "WARNING"
  ) {
    weaknesses.push(
      "Historical strategy evidence contains recurring weaknesses.",
    );

    learningSignals.push(
      "STRATEGY_WARNING",
    );
  }

  if (
    strategyLearning.state ===
      "INSUFFICIENT_DATA"
  ) {
    watchItems.push(
      "Strategy history needs more observations.",
    );
  }

  if (
    learningFeedback.state ===
      "POSITIVE"
  ) {
    strengths.push(
      "The latest completed outcome provides positive learning evidence.",
    );
  }

  if (
    learningFeedback.state ===
      "NEGATIVE"
  ) {
    weaknesses.push(
      "The latest completed outcome provides negative learning evidence.",
    );
  }

  if (
    learningFeedback.state ===
      "INSUFFICIENT_DATA"
  ) {
    watchItems.push(
      "Reliability feedback requires additional completed outcomes.",
    );
  }

  if (
    confidenceAdaptation.state ===
      "INCREASE"
  ) {
    strengths.push(
      "Historical accuracy currently exceeds observed confidence.",
    );

    learningSignals.push(
      "CONFIDENCE_UNDERSTATED",
    );
  }

  if (
    confidenceAdaptation.state ===
      "DECREASE"
  ) {
    weaknesses.push(
      "Historical confidence currently exceeds observed accuracy.",
    );

    learningSignals.push(
      "CONFIDENCE_OVERSTATED",
    );
  }

  if (
    confidenceAdaptation.state ===
      "MAINTAIN"
  ) {
    learningSignals.push(
      "CONFIDENCE_CALIBRATED",
    );
  }

  if (
    confidenceAdaptation.state ===
      "INSUFFICIENT_DATA"
  ) {
    watchItems.push(
      "Confidence adaptation requires more history.",
    );
  }

  if (
    learningScore >= 75 &&
    weaknesses.length === 0
  ) {
    recommendations.push(
      "Continue using the current learning evidence as positive historical support.",
    );
  }

  if (
    weaknesses.length > 0
  ) {
    recommendations.push(
      "Review recurring weaknesses before increasing confidence in the affected evidence.",
    );
  }

  if (
    availableScores.length < 3
  ) {
    recommendations.push(
      "Collect additional evidence across patterns, strategies, and confidence calibration.",
    );
  }

  const confidenceAdjustment =
    round(
      confidenceAdaptation.adjustment,
    );

  let state: SelfLearningState;

  if (
    availableScores.length < 2
  ) {
    state = "LEARNING";
  } else if (
    learningScore >= 75 &&
    weaknesses.length === 0
  ) {
    state = "POSITIVE_LEARNING";
  } else if (
    learningScore <= 35
  ) {
    state = "NEGATIVE_LEARNING";
  } else {
    state = "MIXED_LEARNING";
  }

  return {
    state,
    learningScore,
    confidenceAdjustment,

    evidence: {
      feedbackState:
        learningFeedback.state,
      patternState:
        patternLearning.state,
      strategyState:
        strategyLearning.state,
      confidenceState:
        confidenceAdaptation.state,
    },

    strengths: unique(strengths),
    weaknesses: unique(weaknesses),
    learningSignals: unique(
      learningSignals,
    ),

    recommendations: unique(
      recommendations,
    ),

    watchItems: unique(
      watchItems,
    ),

    explanation:
      state === "POSITIVE_LEARNING"
        ? "Historical evidence is currently producing a positive unified learning state."
        : state === "NEGATIVE_LEARNING"
          ? "Historical evidence is currently producing a negative unified learning state and should be reviewed before stronger confidence is assigned."
          : state === "MIXED_LEARNING"
            ? "Historical evidence contains both supporting and warning signals, so the learning state remains mixed."
            : "The system is continuing to learn from the available historical evidence.",
  };
}
