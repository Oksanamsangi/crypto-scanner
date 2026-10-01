
import {
  getMarketSnapshot,
} from "../intellegence/marketData.js";

export type CrossMarketState =
  | "CONFIRMED"
  | "PARTIAL"
  | "CONTRADICTED";

export type CrossMarketDirection =
  | "BULLISH"
  | "BEARISH"
  | "MIXED";

export interface CrossMarketConfirmation {
  state: CrossMarketState;

  direction: CrossMarketDirection;

  score: number;

  btc: {
    direction: CrossMarketDirection;
    changePercent: number;
    momentum: number;
    volumeRatio: number;
  };

  eth: {
    direction: CrossMarketDirection;
    changePercent: number;
    momentum: number;
    volumeRatio: number;
  };

  btcEthAlignment: number;

  altcoinAlignment: number;

  btcAltConfirmation: number;

  ethAltConfirmation: number;

  reasons: string[];
}

interface ScannerResult {
  symbol: string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
}

interface MarketData {
  price: {
    changePercent: number;
  };

  volume: {
    ratio: number;
  };

  momentum: {
    rsi: number;
    roc: number;
  };
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

function getDirection(
  changePercent: number,
  rsi: number,
  roc: number,
): CrossMarketDirection {
  const bullish =
    Number(changePercent > 0) +
    Number(rsi >= 50) +
    Number(roc > 0);

  const bearish =
    Number(changePercent < 0) +
    Number(rsi < 50) +
    Number(roc < 0);

  if (bullish >= 2) {
    return "BULLISH";
  }

  if (bearish >= 2) {
    return "BEARISH";
  }

  return "MIXED";
}

function directionScore(
  data: MarketData,
): number {
  const priceScore =
    clamp(
      data.price.changePercent * 10,
      -100,
      100,
    );

  const rsiScore =
    clamp(
      (data.momentum.rsi - 50) * 2,
      -100,
      100,
    );

  const rocScore =
    clamp(
      data.momentum.roc * 10,
      -100,
      100,
    );

  return (
    priceScore * 0.4 +
    rsiScore * 0.35 +
    rocScore * 0.25
  );
}

function average(
  values: number[],
): number {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length
  );
}

export async function analyzeCrossMarket(
  results: ScannerResult[],
  interval: string,
): Promise<CrossMarketConfirmation> {
  const reasons: string[] = [];

  const btcSnapshot =
    await getMarketSnapshot(
      "BTCUSDT",
      interval,
    );

  const ethSnapshot =
    await getMarketSnapshot(
      "ETHUSDT",
      interval,
    );

  const btcData: MarketData =
    btcSnapshot;

  const ethData: MarketData =
    ethSnapshot;

  const btcScore =
    directionScore(btcData);

  const ethScore =
    directionScore(ethData);

  const btcDirection =
    getDirection(
      btcData.price.changePercent,
      btcData.momentum.rsi,
      btcData.momentum.roc,
    );

  const ethDirection =
    getDirection(
      ethData.price.changePercent,
      ethData.momentum.rsi,
      ethData.momentum.roc,
    );

  /*
   * ----------------------------------------
   * BTC ↔ ETH alignment
   * ----------------------------------------
   */

  const btcEthAlignment =
    Math.round(
      100 -
        Math.abs(
          btcScore - ethScore,
        ),
    );

  /*
   * ----------------------------------------
   * ALTCOIN alignment
   * ----------------------------------------
   *
   * Scanner signals represent the current
   * directional opinion of the alt universe.
   */

  const altResults =
    results.filter(
      (result) =>
        result.symbol !==
          "BTCUSDT" &&
        result.symbol !==
          "ETHUSDT",
    );

  const altScores =
    altResults.map(
      (result) => {
        if (
          result.signal ===
          "BUY"
        ) {
          return Math.max(
            0,
            result.confidence,
          );
        }

        if (
          result.signal ===
          "SELL"
        ) {
          return -Math.max(
            0,
            result.confidence,
          );
        }

        return 0;
      },
    );

  const altcoinAlignment =
    Math.round(
      clamp(
        average(altScores),
        -100,
        100,
      ),
    );

  /*
   * ----------------------------------------
   * BTC → ALT confirmation
   * ----------------------------------------
   */

  const btcAltConfirmation =
    Math.round(
      clamp(
        (
          btcScore +
          altcoinAlignment
        ) / 2,
        -100,
        100,
      ),
    );

  /*
   * ----------------------------------------
   * ETH → ALT confirmation
   * ----------------------------------------
   */

  const ethAltConfirmation =
    Math.round(
      clamp(
        (
          ethScore +
          altcoinAlignment
        ) / 2,
        -100,
        100,
      ),
    );

  /*
   * ----------------------------------------
   * FINAL CROSS-MARKET SCORE
   * ----------------------------------------
   */

  const score =
    Math.round(
      btcScore * 0.35 +
      ethScore * 0.25 +
      altcoinAlignment * 0.40,
    );

  /*
   * ----------------------------------------
   * FINAL DIRECTION
   * ----------------------------------------
   */

  let direction:
    CrossMarketDirection;

  if (score >= 20) {
    direction = "BULLISH";
  } else if (score <= -20) {
    direction = "BEARISH";
  } else {
    direction = "MIXED";
  }

  /*
   * ----------------------------------------
   * CONFIRMATION STATE
   * ----------------------------------------
   */

  const directionalAgreement =
    [
      btcScore,
      ethScore,
      altcoinAlignment,
    ].filter(
      (value) =>
        direction === "BULLISH"
          ? value >= 20
          : direction === "BEARISH"
            ? value <= -20
            : Math.abs(value) < 20,
    ).length;

  let state: CrossMarketState;

  if (
    directionalAgreement >= 3 &&
    Math.abs(score) >= 30
  ) {
    state = "CONFIRMED";
  } else if (
    directionalAgreement >= 2
  ) {
    state = "PARTIAL";
  } else {
    state = "CONTRADICTED";
  }

  /*
   * ----------------------------------------
   * REASONS
   * ----------------------------------------
   */

  if (
    btcDirection ===
    "BULLISH"
  ) {
    reasons.push(
      "BTC is providing bullish market leadership.",
    );
  } else if (
    btcDirection ===
    "BEARISH"
  ) {
    reasons.push(
      "BTC is providing bearish market leadership.",
    );
  } else {
    reasons.push(
      "BTC direction is mixed.",
    );
  }

  if (
    ethDirection ===
    "BULLISH"
  ) {
    reasons.push(
      "ETH is confirming bullish market momentum.",
    );
  } else if (
    ethDirection ===
    "BEARISH"
  ) {
    reasons.push(
      "ETH is confirming bearish market momentum.",
    );
  } else {
    reasons.push(
      "ETH direction is mixed.",
    );
  }

  if (
    altcoinAlignment >= 30
  ) {
    reasons.push(
      "Altcoin participation is broadly bullish.",
    );
  } else if (
    altcoinAlignment <= -30
  ) {
    reasons.push(
      "Altcoin participation is broadly bearish.",
    );
  } else {
    reasons.push(
      "Altcoin participation is mixed.",
    );
  }

  if (
    btcEthAlignment >= 70
  ) {
    reasons.push(
      "BTC and ETH are strongly aligned.",
    );
  } else if (
    btcEthAlignment >= 40
  ) {
    reasons.push(
      "BTC and ETH show partial directional alignment.",
    );
  } else {
    reasons.push(
      "BTC and ETH are showing meaningful divergence.",
    );
  }

  if (
    state === "CONFIRMED"
  ) {
    reasons.push(
      "Cross-market structure confirms the dominant direction.",
    );
  } else if (
    state === "PARTIAL"
  ) {
    reasons.push(
      "Cross-market structure provides only partial confirmation.",
    );
  } else {
    reasons.push(
      "Cross-market structure contradicts the dominant directional signal.",
    );
  }

  return {
    state,

    direction,

    score,

    btc: {
      direction:
        btcDirection,

      changePercent:
        Number(
          btcData.price.changePercent.toFixed(
            2,
          ),
        ),

      momentum:
        Math.round(
          clamp(
            btcScore,
            -100,
            100,
          ),
        ),

      volumeRatio:
        Number(
          btcData.volume.ratio.toFixed(
            2,
          ),
        ),
    },

    eth: {
      direction:
        ethDirection,

      changePercent:
        Number(
          ethData.price.changePercent.toFixed(
            2,
          ),
        ),

      momentum:
        Math.round(
          clamp(
            ethScore,
            -100,
            100,
          ),
        ),

      volumeRatio:
        Number(
          ethData.volume.ratio.toFixed(
            2,
          ),
        ),
    },

    btcEthAlignment,

    altcoinAlignment,

    btcAltConfirmation,

    ethAltConfirmation,

    reasons,
  };
}
