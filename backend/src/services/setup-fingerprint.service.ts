export type SetupDirection =
  | "BUY"
  | "SELL"
  | "NEUTRAL";

export type SetupTrend =
  | "STRONG_UP"
  | "UP"
  | "NEUTRAL"
  | "DOWN"
  | "STRONG_DOWN";

export type SetupMomentum =
  | "STRONG_BULLISH"
  | "BULLISH"
  | "NEUTRAL"
  | "BEARISH"
  | "STRONG_BEARISH";

export type SetupVolatility =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "EXTREME";

export type SetupVolume =
  | "VERY_HIGH"
  | "HIGH"
  | "NORMAL"
  | "WEAK"
  | "VERY_WEAK";

export interface SetupFingerprintInput {
  symbol: string;
  interval: string;

  signal: SetupDirection;

  confidence: number;
  signalStrength: number;
  score: number;

  currentPrice?: number | null;

  ema20?: number | null;
  ema50?: number | null;

  rsi14?: number | null;
  atr14?: number | null;

  changePercent?: number | null;
  volumeRatio?: number | null;

  context?: {
    finalSignal?: SetupDirection | null;
    finalConfidence?: number | null;
    setupQuality?: number | null;
    decision?: string | null;
    contextScore?: number | null;
  };

  market?: {
    regime?: string | null;
    phase?: string | null;
    momentum?: string | null;
    volatility?: string | null;
    breadthScore?: number | null;
    crossMarketScore?: number | null;
  };
}

export interface SetupFingerprint {
  id: string;

  symbol: string;
  interval: string;

  direction: SetupDirection;

  trend: SetupTrend;
  momentum: SetupMomentum;
  volatility: SetupVolatility;
  volume: SetupVolume;

  confidence: number;
  signalStrength: number;
  score: number;

  rsi: number | null;
  atr: number | null;

  emaStructure:
    | "BULLISH"
    | "BEARISH"
    | "MIXED"
    | "UNKNOWN";

  priceVsEma:
    | "ABOVE_BOTH"
    | "BELOW_BOTH"
    | "BETWEEN"
    | "UNKNOWN";

  changePercent: number | null;
  volumeRatio: number | null;

  setupQuality: number | null;
  contextConfidence: number | null;

  marketRegime: string | null;
  marketPhase: string | null;

  breadthScore: number | null;
  crossMarketScore: number | null;

  characteristics: string[];

  fingerprint: string;
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

function normalizeNumber(
  value: number | null | undefined,
): number | null {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return Number(value.toFixed(2));
}

function classifyTrend(
  ema20: number | null | undefined,
  ema50: number | null | undefined,
  changePercent: number | null | undefined,
): SetupTrend {
  const change =
    changePercent ?? 0;

  if (
    ema20 !== null &&
    ema20 !== undefined &&
    ema50 !== null &&
    ema50 !== undefined
  ) {
    if (
      ema20 > ema50 &&
      change > 1
    ) {
      return "STRONG_UP";
    }

    if (
      ema20 > ema50
    ) {
      return "UP";
    }

    if (
      ema20 < ema50 &&
      change < -1
    ) {
      return "STRONG_DOWN";
    }

    if (
      ema20 < ema50
    ) {
      return "DOWN";
    }
  }

  if (change > 1) {
    return "UP";
  }

  if (change < -1) {
    return "DOWN";
  }

  return "NEUTRAL";
}

function classifyMomentum(
  rsi: number | null | undefined,
  score: number,
): SetupMomentum {
  const normalizedRsi =
    rsi ?? 50;

  if (
    normalizedRsi >= 65 &&
    score >= 50
  ) {
    return "STRONG_BULLISH";
  }

  if (
    normalizedRsi >= 55 &&
    score >= 20
  ) {
    return "BULLISH";
  }

  if (
    normalizedRsi <= 35 &&
    score <= -50
  ) {
    return "STRONG_BEARISH";
  }

  if (
    normalizedRsi <= 45 &&
    score <= -20
  ) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

function classifyVolatility(
  atr: number | null | undefined,
  currentPrice:
    | number
    | null
    | undefined,
): SetupVolatility {
  if (
    atr === null ||
    atr === undefined ||
    currentPrice === null ||
    currentPrice === undefined ||
    currentPrice <= 0
  ) {
    return "NORMAL";
  }

  const atrPercent =
    (atr / currentPrice) * 100;

  if (atrPercent >= 4) {
    return "EXTREME";
  }

  if (atrPercent >= 2) {
    return "HIGH";
  }

  if (atrPercent <= 0.7) {
    return "LOW";
  }

  return "NORMAL";
}

function classifyVolume(
  ratio:
    | number
    | null
    | undefined,
): SetupVolume {
  const value =
    ratio ?? 1;

  if (value >= 2) {
    return "VERY_HIGH";
  }

  if (value >= 1.3) {
    return "HIGH";
  }

  if (value >= 0.8) {
    return "NORMAL";
  }

  if (value >= 0.4) {
    return "WEAK";
  }

  return "VERY_WEAK";
}

function classifyEmaStructure(
  ema20: number | null | undefined,
  ema50: number | null | undefined,
): SetupFingerprint["emaStructure"] {
  if (
    ema20 === null ||
    ema20 === undefined ||
    ema50 === null ||
    ema50 === undefined
  ) {
    return "UNKNOWN";
  }

  if (ema20 > ema50) {
    return "BULLISH";
  }

  if (ema20 < ema50) {
    return "BEARISH";
  }

  return "MIXED";
}

function classifyPriceVsEma(
  currentPrice:
    | number
    | null
    | undefined,
  ema20: number | null | undefined,
  ema50: number | null | undefined,
): SetupFingerprint["priceVsEma"] {
  if (
    currentPrice === null ||
    currentPrice === undefined ||
    ema20 === null ||
    ema20 === undefined ||
    ema50 === null ||
    ema50 === undefined
  ) {
    return "UNKNOWN";
  }

  const upper =
    Math.max(ema20, ema50);

  const lower =
    Math.min(ema20, ema50);

  if (currentPrice > upper) {
    return "ABOVE_BOTH";
  }

  if (currentPrice < lower) {
    return "BELOW_BOTH";
  }

  return "BETWEEN";
}

function buildCharacteristics(
  fingerprint: Omit<
    SetupFingerprint,
    "id" | "fingerprint" | "characteristics"
  >,
): string[] {
  const characteristics: string[] = [];

  characteristics.push(
    `direction:${fingerprint.direction}`,
  );

  characteristics.push(
    `trend:${fingerprint.trend}`,
  );

  characteristics.push(
    `momentum:${fingerprint.momentum}`,
  );

  characteristics.push(
    `volatility:${fingerprint.volatility}`,
  );

  characteristics.push(
    `volume:${fingerprint.volume}`,
  );

  characteristics.push(
    `ema:${fingerprint.emaStructure}`,
  );

  characteristics.push(
    `price_vs_ema:${fingerprint.priceVsEma}`,
  );

  if (
    fingerprint.marketRegime
  ) {
    characteristics.push(
      `regime:${fingerprint.marketRegime}`,
    );
  }

  if (
    fingerprint.marketPhase
  ) {
    characteristics.push(
      `phase:${fingerprint.marketPhase}`,
    );
  }

  if (
    fingerprint.breadthScore !== null
  ) {
    characteristics.push(
      `breadth:${Math.round(
        fingerprint.breadthScore,
      )}`,
    );
  }

  if (
    fingerprint.crossMarketScore !== null
  ) {
    characteristics.push(
      `cross_market:${Math.round(
        fingerprint.crossMarketScore,
      )}`,
    );
  }

  return characteristics;
}

function createFingerprintId(
  symbol: string,
  interval: string,
  characteristics: string[],
): string {
  const raw =
    `${symbol}:${interval}:${characteristics.join("|")}`;

  let hash = 0;

  for (
    let index = 0;
    index < raw.length;
    index += 1
  ) {
    hash =
      (hash << 5) -
      hash +
      raw.charCodeAt(index);

    hash |= 0;
  }

  return `setup_${Math.abs(hash)}`;
}

export function buildSetupFingerprint(
  input: SetupFingerprintInput,
): SetupFingerprint {
  const finalSignal =
    input.context?.finalSignal ??
    input.signal;

  const finalConfidence =
    input.context?.finalConfidence ??
    input.confidence;

  const setupQuality =
    input.context?.setupQuality ??
    null;

  const trend =
    classifyTrend(
      input.ema20,
      input.ema50,
      input.changePercent,
    );

  const momentum =
    classifyMomentum(
      input.rsi14,
      input.score,
    );

  const volatility =
    classifyVolatility(
      input.atr14,
      input.currentPrice,
    );

  const volume =
    classifyVolume(
      input.volumeRatio,
    );

  const emaStructure =
    classifyEmaStructure(
      input.ema20,
      input.ema50,
    );

  const priceVsEma =
    classifyPriceVsEma(
      input.currentPrice,
      input.ema20,
      input.ema50,
    );

  const baseFingerprint = {
    symbol: input.symbol,
    interval: input.interval,

    direction: finalSignal,

    trend,
    momentum,
    volatility,
    volume,

    confidence: Math.round(
      clamp(
        finalConfidence,
        0,
        100,
      ),
    ),

    signalStrength: Math.round(
      clamp(
        input.signalStrength,
        0,
        100,
      ),
    ),

    score: Math.round(
      input.score,
    ),

    rsi:
      normalizeNumber(
        input.rsi14,
      ),

    atr:
      normalizeNumber(
        input.atr14,
      ),

    emaStructure,

    priceVsEma,

    changePercent:
      normalizeNumber(
        input.changePercent,
      ),

    volumeRatio:
      normalizeNumber(
        input.volumeRatio,
      ),

    setupQuality:
      setupQuality === null
        ? null
        : Math.round(
            clamp(
              setupQuality,
              0,
              100,
            ),
          ),

    contextConfidence:
      input.context?.finalConfidence ===
      undefined
        ? null
        : Math.round(
            clamp(
              input.context.finalConfidence ??
                0,
              0,
              100,
            ),
          ),

    marketRegime:
      input.market?.regime ??
      null,

    marketPhase:
      input.market?.phase ??
      null,

    breadthScore:
      input.market?.breadthScore ??
      null,

    crossMarketScore:
      input.market?.crossMarketScore ??
      null,
  };

  const characteristics =
    buildCharacteristics(
      baseFingerprint,
    );

  const id =
    createFingerprintId(
      input.symbol,
      input.interval,
      characteristics,
    );

  return {
    ...baseFingerprint,
    id,
    characteristics,
    fingerprint:
      characteristics.join("|"),
  };
}
