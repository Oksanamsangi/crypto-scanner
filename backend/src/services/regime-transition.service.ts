import type {
  MarketRegime,
  MarketRegimeResult,
} from "./market-regime.service.js";

export type RegimeTransitionState =
  | "NONE"
  | "EARLY_WARNING"
  | "TRANSITION"
  | "CONFIRMED";

export interface RegimeTransitionResult {
  previousRegime: MarketRegime | null;
  currentRegime: MarketRegime;

  changed: boolean;

  state: RegimeTransitionState;

  transitionStrength: number;

  earlyWarning: boolean;

  direction:
    | "BULLISH"
    | "BEARISH"
    | "NEUTRAL";

  reasons: string[];
}

interface StoredRegime {
  regime: MarketRegime;
  confidence: number;
  trendStrength: number;
  timestamp: number;
}

export class RegimeTransitionService {
  private readonly states =
    new Map<string, StoredRegime>();

  analyze(
    key: string,
    current: MarketRegimeResult,
  ): RegimeTransitionResult {
    const previous =
      this.states.get(key);

    const previousRegime =
      previous?.regime ?? null;

    const changed =
      previousRegime !== null &&
      previousRegime !== current.regime;

    const reasons: string[] = [];

    let state:
      RegimeTransitionState =
        "NONE";

    let earlyWarning = false;

    let transitionStrength = 0;

    let direction:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL" =
      "NEUTRAL";

    /*
     * ----------------------------------------
     * FIRST OBSERVATION
     * ----------------------------------------
     */

    if (!previous) {
      this.saveState(key, current);

      return {
        previousRegime: null,
        currentRegime:
          current.regime,

        changed: false,

        state: "NONE",

        transitionStrength: 0,

        earlyWarning: false,

        direction: "NEUTRAL",

        reasons: [
          "Initial market regime observation established.",
        ],
      };
    }

    /*
     * ----------------------------------------
     * REGIME DIRECTION
     * ----------------------------------------
     */

    const bullishRegimes:
      MarketRegime[] = [
        "TRENDING_UP",
        "BREAKOUT",
      ];

    const bearishRegimes:
      MarketRegime[] = [
        "TRENDING_DOWN",
      ];

    if (
      bullishRegimes.includes(
        current.regime,
      )
    ) {
      direction = "BULLISH";
    } else if (
      bearishRegimes.includes(
        current.regime,
      )
    ) {
      direction = "BEARISH";
    }

    /*
     * ----------------------------------------
     * CONFIRMED REGIME CHANGE
     * ----------------------------------------
     */

    if (changed) {
      transitionStrength =
        Math.round(
          Math.min(
            100,
            40 +
              Math.abs(
                current.trendStrength -
                  previous.trendStrength,
              ) *
                0.5 +
              Math.abs(
                current.confidence -
                  previous.confidence,
              ) *
                0.3,
          ),
        );

      state =
        transitionStrength >= 70
          ? "CONFIRMED"
          : "TRANSITION";

      reasons.push(
        `Market regime changed from ${previousRegime} to ${current.regime}.`,
      );

      if (
        current.regime ===
        "BREAKOUT"
      ) {
        reasons.push(
          "Price structure indicates a potential breakout transition.",
        );
      }

      if (
        current.regime ===
        "TRENDING_UP"
      ) {
        reasons.push(
          "Market structure is transitioning toward bullish trend conditions.",
        );
      }

      if (
        current.regime ===
        "TRENDING_DOWN"
      ) {
        reasons.push(
          "Market structure is transitioning toward bearish trend conditions.",
        );
      }

      if (
        current.regime ===
        "HIGH_VOLATILITY"
      ) {
        reasons.push(
          "Volatility expansion is materially changing the market environment.",
        );
      }

      if (
        current.regime ===
        "LOW_VOLATILITY"
      ) {
        reasons.push(
          "Volatility compression is changing the market environment.",
        );
      }
    }

    /*
     * ----------------------------------------
     * EARLY WARNING
     * ----------------------------------------
     *
     * The market may be approaching a regime
     * change even before the regime actually
     * changes.
     */

    const trendAcceleration =
      current.trendStrength -
      previous.trendStrength;

    const confidenceAcceleration =
      current.confidence -
      previous.confidence;

    const approachingTransition =
      Math.abs(
        trendAcceleration,
      ) >= 12 ||
      Math.abs(
        confidenceAcceleration,
      ) >= 10 ||
      current.regime ===
        "TRANSITION";

    if (
      !changed &&
      approachingTransition
    ) {
      earlyWarning = true;

      state =
        "EARLY_WARNING";

      transitionStrength =
        Math.round(
          Math.min(
            65,
            25 +
              Math.abs(
                trendAcceleration,
              ) *
                1.5 +
              Math.abs(
                confidenceAcceleration,
              ),
          ),
        );

      reasons.push(
        "Market structure is changing even though the primary regime has not changed yet.",
      );

      if (
        trendAcceleration > 0
      ) {
        reasons.push(
          "Trend strength is accelerating.",
        );
      } else if (
        trendAcceleration < 0
      ) {
        reasons.push(
          "Trend strength is weakening.",
        );
      }

      if (
        current.regime ===
        "TRANSITION"
      ) {
        reasons.push(
          "The regime engine itself identifies transitional conditions.",
        );
      }
    }

    /*
     * ----------------------------------------
     * NO TRANSITION
     * ----------------------------------------
     */

    if (
      !changed &&
      !earlyWarning
    ) {
      state = "NONE";

      transitionStrength = 0;

      reasons.push(
        "Market regime remains stable.",
      );
    }

    /*
     * ----------------------------------------
     * SAVE CURRENT STATE
     * ----------------------------------------
     */

    this.saveState(
      key,
      current,
    );

    return {
      previousRegime,

      currentRegime:
        current.regime,

      changed,

      state,

      transitionStrength,

      earlyWarning,

      direction,

      reasons,
    };
  }

  private saveState(
    key: string,
    result: MarketRegimeResult,
  ): void {
    this.states.set(
      key,
      {
        regime: result.regime,
        confidence:
          result.confidence,
        trendStrength:
          result.trendStrength,
        timestamp: Date.now(),
      },
    );
  }

  clear(): void {
    this.states.clear();
  }
}

export const regimeTransitionService =
  new RegimeTransitionService();
