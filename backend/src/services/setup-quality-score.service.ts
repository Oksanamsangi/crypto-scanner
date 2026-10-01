import type {
  SetupFingerprint,
} from "./setup-fingerprint.service.js";

import type {
  HistoricalSimilarity,
} from "./historical-similarity.service.js";

import type {
  PatternRecognitionResult,
} from "./pattern-recognition.service.js";

import type {
  SetupEvolutionResult,
} from "./setup-evolution.service.js";

export type SetupQualityGrade =
  | "A+"
  | "A"
  | "B"
  | "C"
  | "D"
  | "F";

export type SetupQualityState =
  | "EXCELLENT"
  | "STRONG"
  | "ACCEPTABLE"
  | "WEAK"
  | "POOR";

export interface SetupQualityComponent {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  reason: string;
}

export interface SetupQualityScoreResult {
  qualityScore: number;
  grade: SetupQualityGrade;
  state: SetupQualityState;

  confidence: number;

  components: SetupQualityComponent[];

  strengths: string[];
  weaknesses: string[];
  warnings: string[];

  pattern: {
    type: PatternRecognitionResult["pattern"];
    confidence: number;
    frequency: number;
    recognized: boolean;
  };

  similarity: {
    score: number;
    comparable: boolean;
  };

  evolution: {
    state: SetupEvolutionResult["state"];
    score: number;
    directionChanged: boolean;
  };

  explanation: string;
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function round(
  value: number,
): number {
  return Math.round(
    value * 100,
  ) / 100;
}

function gradeFromScore(
  score: number,
): SetupQualityGrade {
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

function stateFromGrade(
  grade: SetupQualityGrade,
): SetupQualityState {
  if (grade === "A+") {
    return "EXCELLENT";
  }

  if (grade === "A") {
    return "STRONG";
  }

  if (grade === "B" || grade === "C") {
    return "ACCEPTABLE";
  }

  if (grade === "D") {
    return "WEAK";
  }

  return "POOR";
}

function signalQuality(
  setup: SetupFingerprint,
): number {
  return clamp(
    setup.confidence * 0.55 +
      setup.signalStrength * 0.45,
    0,
    100,
  );
}

function trendQuality(
  setup: SetupFingerprint,
): number {
  switch (setup.trend) {
    case "STRONG_UP":
    case "STRONG_DOWN":
      return 100;

    case "UP":
    case "DOWN":
      return 82;

    case "NEUTRAL":
      return 48;

    default:
      return 40;
  }
}

function momentumQuality(
  setup: SetupFingerprint,
): number {
  switch (setup.momentum) {
    case "STRONG_BULLISH":
    case "STRONG_BEARISH":
      return 100;

    case "BULLISH":
    case "BEARISH":
      return 82;

    case "NEUTRAL":
      return 50;

    default:
      return 45;
  }
}

function volumeQuality(
  setup: SetupFingerprint,
): number {
  switch (setup.volume) {
    case "VERY_HIGH":
      return 100;

    case "HIGH":
      return 90;

    case "NORMAL":
      return 72;

    case "WEAK":
      return 48;

    case "VERY_WEAK":
      return 30;

    default:
      return 50;
  }
}

function volatilityQuality(
  setup: SetupFingerprint,
): number {
  switch (setup.volatility) {
    case "NORMAL":
      return 88;

    case "LOW":
      return 72;

    case "HIGH":
      return 62;

    case "EXTREME":
      return 35;

    default:
      return 50;
  }
}

function structureQuality(
  setup: SetupFingerprint,
): number {
  let score = 50;

  if (
    setup.emaStructure === "BULLISH" ||
    setup.emaStructure === "BEARISH"
  ) {
    score += 30;
  }

  if (
    setup.priceVsEma === "ABOVE_BOTH" ||
    setup.priceVsEma === "BELOW_BOTH"
  ) {
    score += 20;
  }

  if (
    setup.priceVsEma === "BETWEEN"
  ) {
    score -= 10;
  }

  if (
    setup.emaStructure === "UNKNOWN"
  ) {
    score -= 20;
  }

  return clamp(
    score,
    0,
    100,
  );
}

function contextQuality(
  setup: SetupFingerprint,
): number {
  const values: number[] = [];

  if (
    setup.setupQuality !== null
  ) {
    values.push(
      clamp(
        setup.setupQuality,
        0,
        100,
      ),
    );
  }

  if (
    setup.contextConfidence !== null
  ) {
    values.push(
      clamp(
        setup.contextConfidence,
        0,
        100,
      ),
    );
  }

  if (
    setup.breadthScore !== null
  ) {
    values.push(
      clamp(
        50 +
          Math.abs(
            setup.breadthScore,
          ) * 0.5,
        0,
        100,
      ),
    );
  }

  if (
    setup.crossMarketScore !== null
  ) {
    values.push(
      clamp(
        50 +
          Math.abs(
            setup.crossMarketScore,
          ) * 0.5,
        0,
        100,
      ),
    );
  }

  if (!values.length) {
    return 50;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length
  );
}

function similarityQuality(
  similarity:
    | HistoricalSimilarity
    | null
    | undefined,
): number {
  if (!similarity) {
    return 50;
  }

  return clamp(
    similarity.similarity,
    0,
    100,
  );
}

function patternQuality(
  pattern:
    | PatternRecognitionResult
    | null
    | undefined,
): number {
  if (!pattern) {
    return 50;
  }

  let score =
    pattern.patternConfidence * 0.65 +
    pattern.patternFrequency * 0.35;

  if (
    pattern.recognized
  ) {
    score += 10;
  }

  return clamp(
    score,
    0,
    100,
  );
}

function evolutionQuality(
  evolution:
    | SetupEvolutionResult
    | null
    | undefined,
): number {
  if (!evolution) {
    return 50;
  }

  switch (evolution.state) {
    case "STRENGTHENING":
      return clamp(
        evolution.evolutionScore + 10,
        0,
        100,
      );

    case "STABLE":
      return evolution.evolutionScore;

    case "EMERGING":
      return 60;

    case "WEAKENING":
      return clamp(
        evolution.evolutionScore - 10,
        0,
        100,
      );

    case "FADING":
      return clamp(
        evolution.evolutionScore - 20,
        0,
        100,
      );

    case "REVERSING":
      return clamp(
        evolution.evolutionScore - 25,
        0,
        100,
      );

    case "NEUTRAL":
    default:
      return evolution.evolutionScore;
  }
}

function component(
  name: string,
  score: number,
  weight: number,
  reason: string,
): SetupQualityComponent {
  const normalizedScore =
    clamp(score, 0, 100);

  return {
    name,
    score: round(
      normalizedScore,
    ),
    weight,
    contribution: round(
      normalizedScore *
        weight,
    ),
    reason,
  };
}

function buildStrengths(
  components: SetupQualityComponent[],
): string[] {
  return components
    .filter(
      (item) =>
        item.score >= 80,
    )
    .sort(
      (a, b) =>
        b.score - a.score,
    )
    .slice(0, 5)
    .map(
      (item) =>
        `${item.name}: ${item.reason}`,
    );
}

function buildWeaknesses(
  components: SetupQualityComponent[],
): string[] {
  return components
    .filter(
      (item) =>
        item.score < 55,
    )
    .sort(
      (a, b) =>
        a.score - b.score,
    )
    .slice(0, 5)
    .map(
      (item) =>
        `${item.name}: ${item.reason}`,
    );
}

function buildWarnings(
  setup: SetupFingerprint,
  similarity:
    | HistoricalSimilarity
    | null
    | undefined,
  pattern:
    | PatternRecognitionResult
    | null
    | undefined,
  evolution:
    | SetupEvolutionResult
    | null
    | undefined,
): string[] {
  const warnings: string[] = [];

  if (
    setup.volatility === "EXTREME"
  ) {
    warnings.push(
      "Extreme volatility reduces setup quality.",
    );
  }

  if (
    setup.volume === "VERY_WEAK"
  ) {
    warnings.push(
      "Very weak volume reduces confirmation.",
    );
  }

  if (
    setup.emaStructure === "UNKNOWN"
  ) {
    warnings.push(
      "EMA structure is unavailable.",
    );
  }

  if (
    similarity &&
    !similarity.comparable
  ) {
    warnings.push(
      "Historical similarity is below the comparable threshold.",
    );
  }

  if (
    pattern &&
    !pattern.recognized
  ) {
    warnings.push(
      "No sufficiently recurring historical pattern was recognized.",
    );
  }

  if (
    evolution &&
    (
      evolution.state === "WEAKENING" ||
      evolution.state === "FADING" ||
      evolution.state === "REVERSING"
    )
  ) {
    warnings.push(
      `Setup evolution is ${evolution.state.toLowerCase().replaceAll("_", " ")}.`,
    );
  }

  return warnings;
}

function buildExplanation(
  score: number,
  grade: SetupQualityGrade,
  state: SetupQualityState,
): string {
  return (
    `Setup quality is ${state.toLowerCase()} ` +
    `with a ${grade} grade and a score of ${score}/100.`
  );
}

export function calculateSetupQualityScore(
  setup: SetupFingerprint,
  similarity:
    | HistoricalSimilarity
    | null
    | undefined,
  pattern:
    | PatternRecognitionResult
    | null
    | undefined,
  evolution:
    | SetupEvolutionResult
    | null
    | undefined,
): SetupQualityScoreResult {
  const components = [
    component(
      "Signal",
      signalQuality(setup),
      0.16,
      "Signal confidence and strength are aligned.",
    ),

    component(
      "Trend",
      trendQuality(setup),
      0.12,
      "Trend structure supports directional continuation.",
    ),

    component(
      "Momentum",
      momentumQuality(setup),
      0.12,
      "Momentum provides directional confirmation.",
    ),

    component(
      "Volume",
      volumeQuality(setup),
      0.10,
      "Volume provides participation confirmation.",
    ),

    component(
      "Volatility",
      volatilityQuality(setup),
      0.08,
      "Volatility environment is compatible with the setup.",
    ),

    component(
      "Structure",
      structureQuality(setup),
      0.12,
      "EMA and price structure provide technical alignment.",
    ),

    component(
      "Context",
      contextQuality(setup),
      0.10,
      "Market context provides additional confirmation.",
    ),

    component(
      "Historical Similarity",
      similarityQuality(similarity),
      0.08,
      "Historical setups provide comparable structure.",
    ),

    component(
      "Pattern Recognition",
      patternQuality(pattern),
      0.07,
      "Recurring historical pattern supports recognition.",
    ),

    component(
      "Evolution",
      evolutionQuality(evolution),
      0.05,
      "Setup evolution indicates whether the structure is strengthening or weakening.",
    ),
  ];

  const rawScore =
    components.reduce(
      (sum, item) =>
        sum + item.contribution,
      0,
    );

  let qualityScore =
    Math.round(
      clamp(
        rawScore,
        0,
        100,
      ),
    );

  const warnings =
    buildWarnings(
      setup,
      similarity,
      pattern,
      evolution,
    );

  if (
    warnings.length >= 3
  ) {
    qualityScore =
      Math.max(
        0,
        qualityScore - 8,
      );
  } else if (
    warnings.length === 2
  ) {
    qualityScore =
      Math.max(
        0,
        qualityScore - 4,
      );
  }

  if (
    pattern?.recognized &&
    (pattern.patternConfidence >= 80)
  ) {
    qualityScore =
      Math.min(
        100,
        qualityScore + 3,
      );
  }

  if (
    evolution?.state ===
    "STRENGTHENING"
  ) {
    qualityScore =
      Math.min(
        100,
        qualityScore + 3,
      );
  }

  if (
    evolution?.state ===
      "REVERSING" ||
    evolution?.state ===
      "FADING"
  ) {
    qualityScore =
      Math.max(
        0,
        qualityScore - 5,
      );
  }

  qualityScore =
    Math.round(
      clamp(
        qualityScore,
        0,
        100,
      ),
    );

  const grade =
    gradeFromScore(
      qualityScore,
    );

  const state =
    stateFromGrade(
      grade,
    );

  const confidence =
    Math.round(
      clamp(
        signalQuality(setup) * 0.35 +
          similarityQuality(similarity) * 0.20 +
          patternQuality(pattern) * 0.20 +
          evolutionQuality(evolution) * 0.15 +
          contextQuality(setup) * 0.10,
        0,
        100,
      ),
    );

  const strengths =
    buildStrengths(
      components,
    );

  const weaknesses =
    buildWeaknesses(
      components,
    );

  return {
    qualityScore,
    grade,
    state,

    confidence,

    components,

    strengths,
    weaknesses,
    warnings,

    pattern: {
      type:
        pattern?.pattern ??
        "MIXED",

      confidence:
        pattern?.patternConfidence ??
        0,

      frequency:
        pattern?.patternFrequency ??
        0,

      recognized:
        pattern?.recognized ??
        false,
    },

    similarity: {
      score:
        similarity?.similarity ??
        0,

      comparable:
        similarity?.comparable ??
        false,
    },

    evolution: {
      state:
        evolution?.state ??
        "NEUTRAL",

      score:
        evolution?.evolutionScore ??
        50,

      directionChanged:
        evolution?.directionChanged ??
        false,
    },

    explanation:
      buildExplanation(
        qualityScore,
        grade,
        state,
      ),
  };
}
