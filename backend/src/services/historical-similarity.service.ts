import type {
  SetupFingerprint,
} from "./setup-fingerprint.service.js";

export type SimilarityStrength =
  | "VERY_HIGH"
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "VERY_LOW";

export interface SimilarityComponent {
  name: string;
  score: number;
  weight: number;
  matched: boolean;
}

export interface HistoricalSimilarity {
  similarity: number;
  strength: SimilarityStrength;

  comparable: boolean;

  matches: string[];
  conflicts: string[];

  components: SimilarityComponent[];
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

function categoricalScore(
  current: string | null | undefined,
  historical: string | null | undefined,
): number {
  if (
    !current ||
    !historical
  ) {
    return 50;
  }

  return current === historical
    ? 100
    : 0;
}

function numericScore(
  current: number | null,
  historical: number | null,
  tolerance: number,
): number {
  if (
    current === null ||
    historical === null
  ) {
    return 50;
  }

  const difference =
    Math.abs(
      current - historical,
    );

  if (difference >= tolerance) {
    return 0;
  }

  return Math.round(
    100 -
      (difference / tolerance) * 100,
  );
}

function directionalScore(
  current: number,
  historical: number,
): number {
  if (
    current === 0 ||
    historical === 0
  ) {
    return 50;
  }

  return Math.sign(current) ===
    Math.sign(historical)
    ? 100
    : 0;
}

function addComponent(
  components: SimilarityComponent[],
  name: string,
  score: number,
  weight: number,
): void {
  components.push({
    name,
    score: Math.round(
      clamp(score, 0, 100),
    ),
    weight,
    matched: score >= 70,
  });
}

export function compareHistoricalSetup(
  current: SetupFingerprint,
  historical: SetupFingerprint,
): HistoricalSimilarity {
  const components: SimilarityComponent[] = [];

  const matches: string[] = [];
  const conflicts: string[] = [];

  /*
   * Direction
   */

  addComponent(
    components,
    "direction",
    categoricalScore(
      current.direction,
      historical.direction,
    ),
    15,
  );

  /*
   * Trend
   */

  addComponent(
    components,
    "trend",
    categoricalScore(
      current.trend,
      historical.trend,
    ),
    15,
  );

  /*
   * Momentum
   */

  addComponent(
    components,
    "momentum",
    categoricalScore(
      current.momentum,
      historical.momentum,
    ),
    12,
  );

  /*
   * Volatility
   */

  addComponent(
    components,
    "volatility",
    categoricalScore(
      current.volatility,
      historical.volatility,
    ),
    8,
  );

  /*
   * Volume
   */

  addComponent(
    components,
    "volume",
    categoricalScore(
      current.volume,
      historical.volume,
    ),
    7,
  );

  /*
   * EMA structure
   */

  addComponent(
    components,
    "ema_structure",
    categoricalScore(
      current.emaStructure,
      historical.emaStructure,
    ),
    8,
  );

  /*
   * Price vs EMA
   */

  addComponent(
    components,
    "price_vs_ema",
    categoricalScore(
      current.priceVsEma,
      historical.priceVsEma,
    ),
    5,
  );

  /*
   * RSI
   */

  addComponent(
    components,
    "rsi",
    numericScore(
      current.rsi,
      historical.rsi,
      15,
    ),
    8,
  );

  /*
   * ATR
   *
   * ATR is scale-dependent, so use ATR percentage
   * through normalized volatility categories rather
   * than comparing raw ATR values.
   */

  addComponent(
    components,
    "atr",
    categoricalScore(
      current.volatility,
      historical.volatility,
    ),
    5,
  );

  /*
   * Price change
   */

  addComponent(
    components,
    "price_change",
    numericScore(
      current.changePercent,
      historical.changePercent,
      3,
    ),
    5,
  );

  /*
   * Volume ratio
   */

  addComponent(
    components,
    "volume_ratio",
    numericScore(
      current.volumeRatio,
      historical.volumeRatio,
      1.5,
    ),
    5,
  );

  /*
   * Market regime
   */

  addComponent(
    components,
    "market_regime",
    categoricalScore(
      current.marketRegime,
      historical.marketRegime,
    ),
    4,
  );

  /*
   * Market phase
   */

  addComponent(
    components,
    "market_phase",
    categoricalScore(
      current.marketPhase,
      historical.marketPhase,
    ),
    3,
  );

  /*
   * Breadth
   */

  addComponent(
    components,
    "breadth",
    numericScore(
      current.breadthScore,
      historical.breadthScore,
      40,
    ),
    3,
  );

  /*
   * Cross-market confirmation
   */

  addComponent(
    components,
    "cross_market",
    numericScore(
      current.crossMarketScore,
      historical.crossMarketScore,
      40,
    ),
    2,
  );

  /*
   * --------------------------------------------------
   * WEIGHTED SCORE
   * --------------------------------------------------
   */

  const totalWeight =
    components.reduce(
      (sum, component) =>
        sum + component.weight,
      0,
    );

  const weightedScore =
    components.reduce(
      (sum, component) =>
        sum +
        component.score *
          component.weight,
      0,
    );

  let similarity =
    totalWeight > 0
      ? weightedScore /
        totalWeight
      : 0;

  /*
   * --------------------------------------------------
   * DIRECTIONAL CONFLICT
   * --------------------------------------------------
   */

  if (
    current.direction !==
      "NEUTRAL" &&
    historical.direction !==
      "NEUTRAL" &&
    current.direction !==
      historical.direction
  ) {
    similarity *= 0.70;

    conflicts.push(
      "Setup direction conflicts with the historical setup.",
    );
  }

  /*
   * --------------------------------------------------
   * MARKET REGIME CONFLICT
   * --------------------------------------------------
   */

  if (
    current.marketRegime &&
    historical.marketRegime &&
    current.marketRegime !==
      historical.marketRegime
  ) {
    similarity *= 0.85;

    conflicts.push(
      "Market regimes are different.",
    );
  }

  /*
   * --------------------------------------------------
   * COLLECT MATCHES
   * --------------------------------------------------
   */

  for (
    const component of components
  ) {
    if (
      component.score >= 80
    ) {
      matches.push(
        `${component.name} closely matches`,
      );
    } else if (
      component.score <= 20
    ) {
      conflicts.push(
        `${component.name} differs significantly`,
      );
    }
  }

  similarity = Math.round(
    clamp(similarity, 0, 100),
  );

  /*
   * --------------------------------------------------
   * STRENGTH
   * --------------------------------------------------
   */

  let strength: SimilarityStrength;

  if (similarity >= 90) {
    strength = "VERY_HIGH";
  } else if (similarity >= 75) {
    strength = "HIGH";
  } else if (similarity >= 55) {
    strength = "MODERATE";
  } else if (similarity >= 35) {
    strength = "LOW";
  } else {
    strength = "VERY_LOW";
  }

  /*
   * --------------------------------------------------
   * COMPARABILITY
   * --------------------------------------------------
   */

  const comparable =
    similarity >= 55 &&
    current.symbol !==
      historical.symbol
      ? true
      : similarity >= 55;

  return {
    similarity,
    strength,
    comparable,
    matches,
    conflicts,
    components,
  };
}

export function findMostSimilarSetups(
  current: SetupFingerprint,
  historicalSetups: SetupFingerprint[],
  limit = 10,
): Array<
  SetupFingerprint & {
    similarity: HistoricalSimilarity;
  }
> {
  return historicalSetups
    .map((historical) => ({
      ...historical,
      similarity:
        compareHistoricalSetup(
          current,
          historical,
        ),
    }))
    .filter(
      (item) =>
        item.similarity.comparable,
    )
    .sort(
      (a, b) =>
        b.similarity.similarity -
        a.similarity.similarity,
    )
    .slice(
      0,
      Math.max(1, limit),
    );
}
