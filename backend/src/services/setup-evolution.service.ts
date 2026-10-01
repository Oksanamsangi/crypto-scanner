import type {
  SetupDirection,
  SetupFingerprint,
} from "./setup-fingerprint.service.js";

export type SetupEvolutionState =
  | "STRENGTHENING"
  | "WEAKENING"
  | "STABLE"
  | "REVERSING"
  | "EMERGING"
  | "FADING"
  | "NEUTRAL";

export type SetupEvolutionDirection =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export interface SetupEvolutionPoint {
  setupId: string;
  observedAtIndex: number;

  direction: SetupDirection;
  confidence: number;
  signalStrength: number;
  score: number;

  trend: SetupFingerprint["trend"];
  momentum: SetupFingerprint["momentum"];
  volatility: SetupFingerprint["volatility"];
  volume: SetupFingerprint["volume"];

  setupQuality: number | null;

  fingerprint: string;
}

export interface SetupEvolutionResult {
  state: SetupEvolutionState;

  direction: SetupEvolutionDirection;

  evolutionScore: number;

  confidenceChange: number;
  signalStrengthChange: number;
  scoreChange: number;
  qualityChange: number;

  trendChanged: boolean;
  momentumChanged: boolean;
  volatilityChanged: boolean;
  volumeChanged: boolean;

  directionChanged: boolean;

  historyLength: number;

  timeline: SetupEvolutionPoint[];

  reasons: string[];
  warnings: string[];

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

function directionOf(
  setup: SetupFingerprint,
): SetupEvolutionDirection {
  if (setup.direction === "BUY") {
    return "BULLISH";
  }

  if (setup.direction === "SELL") {
    return "BEARISH";
  }

  if (
    setup.trend === "STRONG_UP" ||
    setup.trend === "UP"
  ) {
    return "BULLISH";
  }

  if (
    setup.trend === "STRONG_DOWN" ||
    setup.trend === "DOWN"
  ) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

function directionalScore(
  setup: SetupFingerprint,
): number {
  if (setup.direction === "BUY") {
    return 1;
  }

  if (setup.direction === "SELL") {
    return -1;
  }

  if (
    setup.trend === "STRONG_UP" ||
    setup.trend === "UP"
  ) {
    return 0.5;
  }

  if (
    setup.trend === "STRONG_DOWN" ||
    setup.trend === "DOWN"
  ) {
    return -0.5;
  }

  return 0;
}

function qualityOf(
  setup: SetupFingerprint,
): number {
  return (
    setup.setupQuality ??
    setup.contextConfidence ??
    setup.confidence
  );
}

function buildTimeline(
  history: SetupFingerprint[],
): SetupEvolutionPoint[] {
  return history.map(
    (setup, index) => ({
      setupId: setup.id,

      observedAtIndex: index,

      direction:
        setup.direction,

      confidence:
        setup.confidence,

      signalStrength:
        setup.signalStrength,

      score:
        setup.score,

      trend:
        setup.trend,

      momentum:
        setup.momentum,

      volatility:
        setup.volatility,

      volume:
        setup.volume,

      setupQuality:
        setup.setupQuality,

      fingerprint:
        setup.fingerprint,
    }),
  );
}

function calculateChange(
  current: number,
  previous: number,
): number {
  return Number(
    (current - previous).toFixed(2),
  );
}

function getRecentHistory(
  current: SetupFingerprint,
  historicalSetups: SetupFingerprint[],
  limit: number,
): SetupFingerprint[] {
  const candidates =
    historicalSetups
      .filter(
        (setup) =>
          setup.symbol === current.symbol &&
          setup.interval === current.interval &&
          setup.id !== current.id,
      )
      .slice(0, limit);

  return [
    ...candidates,
    current,
  ];
}

function detectDirectionChange(
  previous: SetupFingerprint,
  current: SetupFingerprint,
): boolean {
  const previousDirection =
    directionOf(previous);

  const currentDirection =
    directionOf(current);

  return (
    previousDirection !==
    currentDirection &&
    previousDirection !== "NEUTRAL" &&
    currentDirection !== "NEUTRAL"
  );
}

function buildExplanation(
  state: SetupEvolutionState,
  direction: SetupEvolutionDirection,
  evolutionScore: number,
): string {
  const directionText =
    direction === "BULLISH"
      ? "bullish"
      : direction === "BEARISH"
        ? "bearish"
        : "neutral";

  const stateText =
    state
      .toLowerCase()
      .replaceAll("_", " ");

  return (
    `Setup is ${stateText} with ${directionText} ` +
    `direction and an evolution score of ` +
    `${evolutionScore}.`
  );
}

export function analyzeSetupEvolution(
  current: SetupFingerprint,
  historicalSetups: SetupFingerprint[],
  historyLimit = 10,
): SetupEvolutionResult {
  const history =
    getRecentHistory(
      current,
      historicalSetups,
      Math.max(
        1,
        Math.min(historyLimit, 50),
      ),
    );

  const timeline =
    buildTimeline(history);

  if (history.length <= 1) {
    return {
      state: "EMERGING",

      direction:
        directionOf(current),

      evolutionScore: 50,

      confidenceChange: 0,
      signalStrengthChange: 0,
      scoreChange: 0,
      qualityChange: 0,

      trendChanged: false,
      momentumChanged: false,
      volatilityChanged: false,
      volumeChanged: false,

      directionChanged: false,

      historyLength:
        history.length,

      timeline,

      reasons: [
        "No previous setup observation is available.",
        "Current setup is treated as an emerging pattern.",
      ],

      warnings: [
        "Evolution confidence is limited by short history.",
      ],

      explanation:
        "Setup is emerging because there is not enough historical observation to determine a stable evolution.",
    };
  }

  const previous =
    history[history.length - 2]!;

  const currentDirection =
    directionOf(current);

  const previousDirection =
    directionOf(previous);

  const confidenceChange =
    calculateChange(
      current.confidence,
      previous.confidence,
    );

  const signalStrengthChange =
    calculateChange(
      current.signalStrength,
      previous.signalStrength,
    );

  const scoreChange =
    calculateChange(
      current.score,
      previous.score,
    );

  const qualityChange =
    calculateChange(
      qualityOf(current),
      qualityOf(previous),
    );

  const trendChanged =
    current.trend !==
    previous.trend;

  const momentumChanged =
    current.momentum !==
    previous.momentum;

  const volatilityChanged =
    current.volatility !==
    previous.volatility;

  const volumeChanged =
    current.volume !==
    previous.volume;

  const directionChanged =
    detectDirectionChange(
      previous,
      current,
    );

  const previousDirectionalScore =
    directionalScore(previous);

  const currentDirectionalScore =
    directionalScore(current);

  const directionMove =
    currentDirectionalScore -
    previousDirectionalScore;

  const strengthening =
    confidenceChange >= 5 ||
    signalStrengthChange >= 5 ||
    scoreChange >= 10 ||
    qualityChange >= 5;

  const weakening =
    confidenceChange <= -5 ||
    signalStrengthChange <= -5 ||
    scoreChange <= -10 ||
    qualityChange <= -5;

  const absoluteMomentum =
    Math.abs(
      currentDirectionalScore,
    );

  const directionalAlignment =
    currentDirection === previousDirection;

  let evolutionScore =
    50;

  evolutionScore +=
    confidenceChange * 0.25;

  evolutionScore +=
    signalStrengthChange * 0.25;

  evolutionScore +=
    scoreChange * 0.20;

  evolutionScore +=
    qualityChange * 0.20;

  evolutionScore +=
    directionMove * 10;

  if (
    directionalAlignment
  ) {
    evolutionScore += 5;
  }

  if (
    directionChanged
  ) {
    evolutionScore -= 25;
  }

  evolutionScore =
    Math.round(
      clamp(
        evolutionScore,
        0,
        100,
      ),
    );

  let state: SetupEvolutionState;

  if (
    directionChanged &&
    (
      strengthening ||
      Math.abs(directionMove) >= 1
    )
  ) {
    state = "REVERSING";
  } else if (
    strengthening &&
    absoluteMomentum >= 0.5
  ) {
    state = "STRENGTHENING";
  } else if (
    weakening &&
    absoluteMomentum >= 0.5
  ) {
    state = "WEAKENING";
  } else if (
    weakening &&
    Math.abs(
      current.score,
    ) < 20
  ) {
    state = "FADING";
  } else if (
    Math.abs(
      confidenceChange,
    ) <= 4 &&
    Math.abs(
      signalStrengthChange,
    ) <= 4 &&
    Math.abs(
      scoreChange,
    ) <= 8 &&
    Math.abs(
      qualityChange,
    ) <= 4
  ) {
    state = "STABLE";
  } else {
    state = "NEUTRAL";
  }

  const reasons: string[] = [];
  const warnings: string[] = [];

  if (
    confidenceChange >= 5
  ) {
    reasons.push(
      `Confidence increased by ${confidenceChange}.`,
    );
  }

  if (
    confidenceChange <= -5
  ) {
    warnings.push(
      `Confidence decreased by ${Math.abs(confidenceChange)}.`,
    );
  }

  if (
    signalStrengthChange >= 5
  ) {
    reasons.push(
      `Signal strength increased by ${signalStrengthChange}.`,
    );
  }

  if (
    signalStrengthChange <= -5
  ) {
    warnings.push(
      `Signal strength decreased by ${Math.abs(signalStrengthChange)}.`,
    );
  }

  if (
    scoreChange >= 10
  ) {
    reasons.push(
      `Setup score improved by ${scoreChange}.`,
    );
  }

  if (
    scoreChange <= -10
  ) {
    warnings.push(
      `Setup score weakened by ${Math.abs(scoreChange)}.`,
    );
  }

  if (
    qualityChange >= 5
  ) {
    reasons.push(
      `Setup quality improved by ${qualityChange}.`,
    );
  }

  if (
    qualityChange <= -5
  ) {
    warnings.push(
      `Setup quality declined by ${Math.abs(qualityChange)}.`,
    );
  }

  if (
    trendChanged
  ) {
    reasons.push(
      `Trend changed from ${previous.trend} to ${current.trend}.`,
    );
  }

  if (
    momentumChanged
  ) {
    reasons.push(
      `Momentum changed from ${previous.momentum} to ${current.momentum}.`,
    );
  }

  if (
    volatilityChanged
  ) {
    reasons.push(
      `Volatility changed from ${previous.volatility} to ${current.volatility}.`,
    );
  }

  if (
    volumeChanged
  ) {
    reasons.push(
      `Volume state changed from ${previous.volume} to ${current.volume}.`,
    );
  }

  if (
    directionChanged
  ) {
    warnings.push(
      `Directional regime shifted from ${previousDirection} to ${currentDirection}.`,
    );
  }

  if (
    state === "STRENGTHENING"
  ) {
    reasons.push(
      "Multiple setup quality metrics are improving.",
    );
  }

  if (
    state === "WEAKENING"
  ) {
    warnings.push(
      "Multiple setup quality metrics are deteriorating.",
    );
  }

  if (
    state === "FADING"
  ) {
    warnings.push(
      "Directional strength is fading toward neutral.",
    );
  }

  if (
    history.length < 3
  ) {
    warnings.push(
      "Only a small number of observations are available.",
    );
  }

  return {
    state,

    direction:
      currentDirection,

    evolutionScore,

    confidenceChange,
    signalStrengthChange,
    scoreChange,
    qualityChange,

    trendChanged,
    momentumChanged,
    volatilityChanged,
    volumeChanged,

    directionChanged,

    historyLength:
      history.length,

    timeline,

    reasons,
    warnings,

    explanation:
      buildExplanation(
        state,
        currentDirection,
        evolutionScore,
      ),
  };
}
