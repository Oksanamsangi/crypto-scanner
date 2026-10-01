import type { OutcomeStatus } from "./outcome-tracking.service.js";

export type StrategyLearningState =
  | "STRONG_SUPPORT"
  | "SUPPORT"
  | "MIXED"
  | "WARNING"
  | "INSUFFICIENT_DATA";

export type StrategyEvidenceState =
  | "STRONG_SUPPORT"
  | "SUPPORT"
  | "NEUTRAL"
  | "WARNING"
  | "STRONG_WARNING";

export interface StrategyLearningObservation {
  strategyId: string;
  strategyName: string;

  outcomeStatus: OutcomeStatus;
  outcomeReturn: number;

  direction: "LONG" | "SHORT";
  timeframe: "SCALP" | "INTRADAY" | "SWING" | "POSITION";
  riskProfile:
    | "CONSERVATIVE"
    | "BALANCED"
    | "AGGRESSIVE";

  confidence: number;
  ruleScore: number;
  performanceScore: number;
  executionState:
    | "APPROVED"
    | "CONDITIONAL"
    | "BLOCKED";

  setupQuality?: number | null;
}

export interface StrategyCharacteristicEvidence {
  characteristic: string;
  value: string;

  sampleSize: number;
  wins: number;
  losses: number;
  breakevens: number;

  accuracy: number;
  averageReturn: number;
  evidenceScore: number;

  state: StrategyEvidenceState;
  explanation: string;
}

export interface StrategyLearningResult {
  strategyId: string;
  strategyName: string;

  state: StrategyLearningState;
  learningScore: number;
  sampleSize: number;

  overall: {
    wins: number;
    losses: number;
    breakevens: number;
    accuracy: number;
    averageReturn: number;
  };

  characteristics: StrategyCharacteristicEvidence[];

  strongestCharacteristics: string[];
  weakestCharacteristics: string[];

  supportingFactors: string[];
  warningFactors: string[];
  recommendations: string[];

  explanation: string;
}

interface StrategyCharacteristicBucket {
  characteristic: string;
  value: string;

  wins: number;
  losses: number;
  breakevens: number;

  totalReturn: number;
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

function getAccuracy(
  wins: number,
  losses: number,
  breakevens: number,
): number {
  const total =
    wins +
    losses +
    breakevens;

  if (total === 0) {
    return 0;
  }

  return (
    (wins + breakevens * 0.5) /
    total
  ) * 100;
}

function getEvidenceState(
  accuracy: number,
  averageReturn: number,
  sampleSize: number,
): StrategyEvidenceState {
  if (sampleSize < 5) {
    return "NEUTRAL";
  }

  if (
    accuracy >= 75 &&
    averageReturn > 0
  ) {
    return "STRONG_SUPPORT";
  }

  if (
    accuracy >= 60 &&
    averageReturn >= 0
  ) {
    return "SUPPORT";
  }

  if (
    accuracy <= 35 &&
    averageReturn < 0
  ) {
    return "STRONG_WARNING";
  }

  if (
    accuracy < 50 ||
    averageReturn < 0
  ) {
    return "WARNING";
  }

  return "NEUTRAL";
}

function addObservation(
  buckets: Map<
    string,
    StrategyCharacteristicBucket
  >,
  characteristic: string,
  value: string,
  observation: StrategyLearningObservation,
): void {
  const key =
    `${characteristic}:${value}`;

  const existing = buckets.get(key);

  if (existing) {
    if (
      observation.outcomeStatus ===
      "WIN"
    ) {
      existing.wins += 1;
    } else if (
      observation.outcomeStatus ===
      "LOSS"
    ) {
      existing.losses += 1;
    } else {
      existing.breakevens += 1;
    }

    existing.totalReturn +=
      observation.outcomeReturn;

    return;
  }

  buckets.set(key, {
    characteristic,
    value,

    wins:
      observation.outcomeStatus ===
      "WIN"
        ? 1
        : 0,

    losses:
      observation.outcomeStatus ===
      "LOSS"
        ? 1
        : 0,

    breakevens:
      observation.outcomeStatus ===
      "BREAKEVEN"
        ? 1
        : 0,

    totalReturn:
      observation.outcomeReturn,
  });
}

export function analyzeStrategyLearning(
  strategyId: string,
  strategyName: string,
  observations: StrategyLearningObservation[],
): StrategyLearningResult {
  const strategyObservations =
    observations.filter(
      (observation) =>
        observation.strategyId ===
        strategyId,
    );

  if (
    strategyObservations.length ===
    0
  ) {
    return {
      strategyId,
      strategyName,

      state: "INSUFFICIENT_DATA",
      learningScore: 0,
      sampleSize: 0,

      overall: {
        wins: 0,
        losses: 0,
        breakevens: 0,
        accuracy: 0,
        averageReturn: 0,
      },

      characteristics: [],

      strongestCharacteristics: [],
      weakestCharacteristics: [],

      supportingFactors: [],
      warningFactors: [],

      recommendations: [
        "Collect more completed outcomes before evaluating strategy behavior.",
      ],

      explanation:
        "There is not enough completed outcome data to evaluate this strategy.",
    };
  }

  const buckets = new Map<
    string,
    StrategyCharacteristicBucket
  >();

  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let totalReturn = 0;

  for (
    const observation of
      strategyObservations
  ) {
    if (
      observation.outcomeStatus ===
      "WIN"
    ) {
      wins += 1;
    } else if (
      observation.outcomeStatus ===
      "LOSS"
    ) {
      losses += 1;
    } else {
      breakevens += 1;
    }

    totalReturn +=
      observation.outcomeReturn;

    addObservation(
      buckets,
      "direction",
      observation.direction,
      observation,
    );

    addObservation(
      buckets,
      "timeframe",
      observation.timeframe,
      observation,
    );

    addObservation(
      buckets,
      "riskProfile",
      observation.riskProfile,
      observation,
    );

    addObservation(
      buckets,
      "execution",
      observation.executionState,
      observation,
    );

    const confidenceBand =
      observation.confidence >= 80
        ? "HIGH"
        : observation.confidence >= 60
          ? "MEDIUM"
          : "LOW";

    addObservation(
      buckets,
      "confidence",
      confidenceBand,
      observation,
    );

    const ruleBand =
      observation.ruleScore >= 80
        ? "HIGH"
        : observation.ruleScore >= 60
          ? "MEDIUM"
          : "LOW";

    addObservation(
      buckets,
      "ruleScore",
      ruleBand,
      observation,
    );

    const performanceBand =
      observation.performanceScore >=
      80
        ? "HIGH"
        : observation.performanceScore >=
            60
          ? "MEDIUM"
          : "LOW";

    addObservation(
      buckets,
      "performanceScore",
      performanceBand,
      observation,
    );

    if (
      observation.setupQuality != null
    ) {
      const qualityBand =
        observation.setupQuality >= 80
          ? "HIGH"
          : observation.setupQuality >=
              60
            ? "MEDIUM"
            : "LOW";

      addObservation(
        buckets,
        "setupQuality",
        qualityBand,
        observation,
      );
    }
  }

  const sampleSize =
    strategyObservations.length;

  const accuracy = round(
    getAccuracy(
      wins,
      losses,
      breakevens,
    ),
  );

  const averageReturn = round(
    totalReturn / sampleSize,
  );

  const characteristics: StrategyCharacteristicEvidence[] =
    [...buckets.values()]
      .map((bucket) => {
        const bucketSample =
          bucket.wins +
          bucket.losses +
          bucket.breakevens;

        const bucketAccuracy =
          round(
            getAccuracy(
              bucket.wins,
              bucket.losses,
              bucket.breakevens,
            ),
          );

        const bucketAverageReturn =
          round(
            bucket.totalReturn /
              bucketSample,
          );

        const state =
          getEvidenceState(
            bucketAccuracy,
            bucketAverageReturn,
            bucketSample,
          );

        const evidenceScore =
          round(
            clamp(
              bucketAccuracy * 0.7 +
                clamp(
                  50 +
                    bucketAverageReturn *
                      5,
                ) *
                  0.3,
            ),
          );

        const explanation =
          state ===
          "STRONG_SUPPORT"
            ? `${bucket.characteristic}=${bucket.value} shows strong positive historical evidence for this strategy.`
            : state === "SUPPORT"
              ? `${bucket.characteristic}=${bucket.value} shows supportive historical evidence for this strategy.`
              : state ===
                  "STRONG_WARNING"
                ? `${bucket.characteristic}=${bucket.value} shows strong negative historical evidence for this strategy.`
                : state === "WARNING"
                  ? `${bucket.characteristic}=${bucket.value} shows warning evidence and should be reviewed.`
                  : `${bucket.characteristic}=${bucket.value} does not yet provide strong directional evidence.`;

        return {
          characteristic:
            bucket.characteristic,
          value: bucket.value,

          sampleSize: bucketSample,
          wins: bucket.wins,
          losses: bucket.losses,
          breakevens:
            bucket.breakevens,

          accuracy:
            bucketAccuracy,

          averageReturn:
            bucketAverageReturn,

          evidenceScore,

          state,
          explanation,
        };
      })
      .sort(
        (a, b) =>
          b.evidenceScore -
          a.evidenceScore,
      );

  const strongestCharacteristics =
    characteristics
      .filter(
        (item) =>
          item.state ===
            "STRONG_SUPPORT" ||
          item.state === "SUPPORT",
      )
      .slice(0, 5)
      .map(
        (item) =>
          `${item.characteristic}=${item.value}`,
      );

  const weakestCharacteristics =
    [...characteristics]
      .filter(
        (item) =>
          item.state ===
            "STRONG_WARNING" ||
          item.state === "WARNING",
      )
      .sort(
        (a, b) =>
          a.evidenceScore -
          b.evidenceScore,
      )
      .slice(0, 5)
      .map(
        (item) =>
          `${item.characteristic}=${item.value}`,
      );

  let learningScore = accuracy;

  if (averageReturn > 0) {
    learningScore += Math.min(
      15,
      averageReturn * 2,
    );
  } else if (
    averageReturn < 0
  ) {
    learningScore += Math.max(
      -15,
      averageReturn * 2,
    );
  }

  learningScore = round(
    clamp(learningScore),
  );

  let state: StrategyLearningState;

  if (sampleSize < 5) {
    state = "INSUFFICIENT_DATA";
  } else if (
    learningScore >= 75
  ) {
    state = "STRONG_SUPPORT";
  } else if (
    learningScore >= 60
  ) {
    state = "SUPPORT";
  } else if (
    learningScore <= 35
  ) {
    state = "WARNING";
  } else {
    state = "MIXED";
  }

  const supportingFactors: string[] =
    [];

  const warningFactors: string[] =
    [];

  const recommendations: string[] =
    [];

  if (accuracy >= 70) {
    supportingFactors.push(
      "Historical outcomes show generally supportive strategy behavior.",
    );
  }

  if (accuracy <= 40) {
    warningFactors.push(
      "Historical outcomes show weak overall strategy reliability.",
    );
  }

  if (averageReturn > 0) {
    supportingFactors.push(
      "Average completed outcome return is positive.",
    );
  }

  if (averageReturn < 0) {
    warningFactors.push(
      "Average completed outcome return is negative.",
    );
  }

  if (
    strongestCharacteristics.length >
    0
  ) {
    supportingFactors.push(
      `Strongest strategy characteristics: ${strongestCharacteristics.join(", ")}.`,
    );
  }

  if (
    weakestCharacteristics.length >
    0
  ) {
    warningFactors.push(
      `Weakest strategy characteristics: ${weakestCharacteristics.join(", ")}.`,
    );

    recommendations.push(
      "Review strategy characteristics associated with negative outcomes.",
    );
  }

  if (sampleSize < 25) {
    recommendations.push(
      "Collect more completed outcomes before making strong strategy-learning adjustments.",
    );
  }

  const explanation =
    state === "STRONG_SUPPORT"
      ? "Historical outcomes provide strong evidence supporting the observed strategy behavior."
      : state === "SUPPORT"
        ? "Historical outcomes provide supportive evidence for the observed strategy behavior."
        : state === "WARNING"
          ? "Historical outcomes indicate that the observed strategy behavior requires caution."
          : state === "MIXED"
            ? "Historical outcomes provide mixed evidence for the observed strategy behavior."
            : "There is not enough completed outcome data to reliably evaluate this strategy.";

  return {
    strategyId,
    strategyName,

    state,
    learningScore,
    sampleSize,

    overall: {
      wins,
      losses,
      breakevens,
      accuracy,
      averageReturn,
    },

    characteristics,

    strongestCharacteristics,
    weakestCharacteristics,

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

    explanation,
  };
}
