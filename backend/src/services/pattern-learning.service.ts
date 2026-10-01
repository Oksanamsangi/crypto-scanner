import type { OutcomeStatus } from "./outcome-tracking.service.js";

export type PatternLearningState =
  | "STRONG_SUPPORT"
  | "SUPPORT"
  | "MIXED"
  | "WARNING"
  | "INSUFFICIENT_DATA";

export type PatternEvidenceState =
  | "STRONG_SUPPORT"
  | "SUPPORT"
  | "NEUTRAL"
  | "WARNING"
  | "STRONG_WARNING";

export interface PatternLearningObservation {
  outcomeStatus: OutcomeStatus;
  outcomeReturn: number;

  direction: "BUY" | "SELL";
  trend: string;
  momentum: string;
  volatility: string;
  volume: string;

  confidence: number;
  signalStrength: number;
  score: number;
  setupQuality?: number | null;

  fingerprint?: string | null;
}

export interface PatternCharacteristicEvidence {
  characteristic: string;
  value: string;
  sampleSize: number;
  wins: number;
  losses: number;
  breakevens: number;
  accuracy: number;
  averageReturn: number;
  evidenceScore: number;
  state: PatternEvidenceState;
  explanation: string;
}

export interface PatternLearningResult {
  state: PatternLearningState;
  learningScore: number;
  sampleSize: number;

  overall: {
    wins: number;
    losses: number;
    breakevens: number;
    accuracy: number;
    averageReturn: number;
  };

  characteristics: PatternCharacteristicEvidence[];

  strongestPatterns: string[];
  weakestPatterns: string[];

  supportingFactors: string[];
  warningFactors: string[];
  recommendations: string[];

  explanation: string;
}

interface CharacteristicBucket {
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

function getOutcomeAccuracy(
  wins: number,
  losses: number,
  breakevens: number,
): number {
  const total = wins + losses + breakevens;

  if (total === 0) {
    return 0;
  }

  return ((wins + breakevens * 0.5) / total) * 100;
}

function getEvidenceState(
  accuracy: number,
  averageReturn: number,
  sampleSize: number,
): PatternEvidenceState {
  if (sampleSize < 5) {
    return "NEUTRAL";
  }

  if (accuracy >= 75 && averageReturn > 0) {
    return "STRONG_SUPPORT";
  }

  if (accuracy >= 60 && averageReturn >= 0) {
    return "SUPPORT";
  }

  if (accuracy <= 35 && averageReturn < 0) {
    return "STRONG_WARNING";
  }

  if (accuracy < 50 || averageReturn < 0) {
    return "WARNING";
  }

  return "NEUTRAL";
}

function characteristicKey(
  characteristic: string,
  value: string,
): string {
  return `${characteristic}:${value}`;
}

function addObservation(
  buckets: Map<string, CharacteristicBucket>,
  characteristic: string,
  value: string,
  observation: PatternLearningObservation,
): void {
  const key = characteristicKey(characteristic, value);

  const existing = buckets.get(key);

  if (existing) {
    if (observation.outcomeStatus === "WIN") {
      existing.wins += 1;
    } else if (observation.outcomeStatus === "LOSS") {
      existing.losses += 1;
    } else {
      existing.breakevens += 1;
    }

    existing.totalReturn += observation.outcomeReturn;
    return;
  }

  buckets.set(key, {
    characteristic,
    value,
    wins: observation.outcomeStatus === "WIN" ? 1 : 0,
    losses: observation.outcomeStatus === "LOSS" ? 1 : 0,
    breakevens:
      observation.outcomeStatus === "BREAKEVEN" ? 1 : 0,
    totalReturn: observation.outcomeReturn,
  });
}

export function analyzePatternLearning(
  observations: PatternLearningObservation[],
): PatternLearningResult {
  if (observations.length === 0) {
    return {
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

      strongestPatterns: [],
      weakestPatterns: [],

      supportingFactors: [],
      warningFactors: [],

      recommendations: [
        "Collect more completed outcomes before evaluating recurring pattern characteristics.",
      ],

      explanation:
        "There is not enough completed outcome data to evaluate recurring pattern characteristics.",
    };
  }

  const buckets = new Map<string, CharacteristicBucket>();

  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let totalReturn = 0;

  for (const observation of observations) {
    if (observation.outcomeStatus === "WIN") {
      wins += 1;
    } else if (observation.outcomeStatus === "LOSS") {
      losses += 1;
    } else {
      breakevens += 1;
    }

    totalReturn += observation.outcomeReturn;

    addObservation(
      buckets,
      "direction",
      observation.direction,
      observation,
    );

    addObservation(
      buckets,
      "trend",
      observation.trend,
      observation,
    );

    addObservation(
      buckets,
      "momentum",
      observation.momentum,
      observation,
    );

    addObservation(
      buckets,
      "volatility",
      observation.volatility,
      observation,
    );

    addObservation(
      buckets,
      "volume",
      observation.volume,
      observation,
    );

    if (observation.setupQuality != null) {
      const qualityBand =
        observation.setupQuality >= 80
          ? "HIGH"
          : observation.setupQuality >= 60
            ? "MEDIUM"
            : "LOW";

      addObservation(
        buckets,
        "setupQuality",
        qualityBand,
        observation,
      );
    }

    if (observation.fingerprint) {
      addObservation(
        buckets,
        "fingerprint",
        observation.fingerprint,
        observation,
      );
    }
  }

  const sampleSize = observations.length;

  const accuracy = round(
    getOutcomeAccuracy(
      wins,
      losses,
      breakevens,
    ),
  );

  const averageReturn = round(
    totalReturn / sampleSize,
  );

  const characteristics: PatternCharacteristicEvidence[] =
    [...buckets.values()]
      .map((bucket) => {
        const bucketSample =
          bucket.wins +
          bucket.losses +
          bucket.breakevens;

        const bucketAccuracy = round(
          getOutcomeAccuracy(
            bucket.wins,
            bucket.losses,
            bucket.breakevens,
          ),
        );

        const bucketAverageReturn = round(
          bucket.totalReturn / bucketSample,
        );

        const state = getEvidenceState(
          bucketAccuracy,
          bucketAverageReturn,
          bucketSample,
        );

        const evidenceScore = round(
          clamp(
            bucketAccuracy * 0.7 +
              clamp(
                50 + bucketAverageReturn * 5,
              ) *
                0.3,
          ),
        );

        const explanation =
          state === "STRONG_SUPPORT"
            ? `${bucket.characteristic}=${bucket.value} shows strong positive historical evidence.`
            : state === "SUPPORT"
              ? `${bucket.characteristic}=${bucket.value} shows supportive historical evidence.`
              : state === "STRONG_WARNING"
                ? `${bucket.characteristic}=${bucket.value} shows strong negative historical evidence.`
                : state === "WARNING"
                  ? `${bucket.characteristic}=${bucket.value} shows warning evidence and should be reviewed.`
                  : `${bucket.characteristic}=${bucket.value} does not yet provide strong directional evidence.`;

        return {
          characteristic: bucket.characteristic,
          value: bucket.value,
          sampleSize: bucketSample,
          wins: bucket.wins,
          losses: bucket.losses,
          breakevens: bucket.breakevens,
          accuracy: bucketAccuracy,
          averageReturn: bucketAverageReturn,
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

  const strongestPatterns = characteristics
    .filter(
      (item) =>
        item.state === "STRONG_SUPPORT" ||
        item.state === "SUPPORT",
    )
    .slice(0, 5)
    .map(
      (item) =>
        `${item.characteristic}=${item.value}`,
    );

  const weakestPatterns = [...characteristics]
    .filter(
      (item) =>
        item.state === "STRONG_WARNING" ||
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
  } else if (averageReturn < 0) {
    learningScore += Math.max(
      -15,
      averageReturn * 2,
    );
  }

  learningScore = round(
    clamp(learningScore),
  );

  let state: PatternLearningState;

  if (sampleSize < 5) {
    state = "INSUFFICIENT_DATA";
  } else if (learningScore >= 75) {
    state = "STRONG_SUPPORT";
  } else if (learningScore >= 60) {
    state = "SUPPORT";
  } else if (learningScore <= 35) {
    state = "WARNING";
  } else {
    state = "MIXED";
  }

  const supportingFactors: string[] = [];
  const warningFactors: string[] = [];
  const recommendations: string[] = [];

  if (accuracy >= 70) {
    supportingFactors.push(
      "Historical outcomes show generally supportive pattern behavior.",
    );
  }

  if (accuracy <= 40) {
    warningFactors.push(
      "Historical outcomes show weak overall pattern reliability.",
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

  if (strongestPatterns.length > 0) {
    supportingFactors.push(
      `Strongest recurring characteristics: ${strongestPatterns.join(", ")}.`,
    );
  }

  if (weakestPatterns.length > 0) {
    warningFactors.push(
      `Weakest recurring characteristics: ${weakestPatterns.join(", ")}.`,
    );

    recommendations.push(
      "Review recurring characteristics associated with negative outcomes.",
    );
  }

  if (sampleSize < 25) {
    recommendations.push(
      "Collect more completed outcomes before making strong pattern-learning adjustments.",
    );
  }

  if (sampleSize < 5) {
    recommendations.push(
      "Continue collecting data before treating any characteristic as a reliable pattern.",
    );
  }

  const explanation =
    state === "STRONG_SUPPORT"
      ? "Historical outcomes provide strong evidence for recurring pattern characteristics."
      : state === "SUPPORT"
        ? "Historical outcomes provide supportive evidence for several recurring pattern characteristics."
        : state === "WARNING"
          ? "Historical outcomes indicate that recurring pattern characteristics require caution."
          : state === "MIXED"
            ? "Historical outcomes provide mixed evidence across recurring pattern characteristics."
            : "There is not enough completed outcome data to reliably evaluate recurring patterns.";

  return {
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

    strongestPatterns,
    weakestPatterns,

    supportingFactors: [
      ...new Set(supportingFactors),
    ],

    warningFactors: [
      ...new Set(warningFactors),
    ],

    recommendations: [
      ...new Set(recommendations),
    ],

    explanation,
  };
}
