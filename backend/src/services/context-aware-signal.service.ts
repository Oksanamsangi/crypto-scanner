
export type MarketRegime =
  | "TRENDING_UP"
  | "TRENDING_DOWN"
  | "RANGING"
  | "TRANSITION"
  | "UNKNOWN";

export type SetupQuality =
  | "EXCELLENT"
  | "GOOD"
  | "CAUTION"
  | "POOR"
  | "INVALID";

export interface BaseSignal {
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  signalStrength: "STRONG" | "MODERATE" | "WEAK" | "NONE";
  score: number;
}

export interface MarketIntelligence {
  regime: {
    regime: MarketRegime;
    confidence: number;
    trendStrength: number;
    marketPhase: string;
    volatilityState: string;
    momentumState: string;
    volumeState: string;
    pricePosition: number;
    reasons?: string[];
  };
}

export interface ContextAwareResult {
  baseSignal: BaseSignal;

  finalSignal: "BUY" | "SELL" | "NEUTRAL";
  baseConfidence: number;
  finalConfidence: number;

  adjustment: number;

  setupQuality: SetupQuality;

  context: {
    regime: MarketRegime;
    regimeConfidence: number;
    trendStrength: number;
    marketPhase: string;
    volatilityState: string;
    momentumState: string;
    volumeState: string;
    pricePosition: number;
  };

  decision: "TRADE" | "WAIT" | "AVOID";

  reasons: string[];
}

export class ContextAwareSignalService {
  public analyze(
    baseSignal: BaseSignal,
    intelligence: MarketIntelligence,
  ): ContextAwareResult {
    const regime = intelligence.regime;

    let adjustment = 0;
    const reasons: string[] = [];

    /*
     * NEUTRAL signals do not receive
     * aggressive directional adjustments.
     */
    if (baseSignal.signal === "NEUTRAL") {
      return {
        baseSignal,

        finalSignal: "NEUTRAL",

        baseConfidence: baseSignal.confidence,
        finalConfidence: baseSignal.confidence,

        adjustment: 0,

        setupQuality: "POOR",

        context: {
          regime: regime.regime,
          regimeConfidence: regime.confidence,
          trendStrength: regime.trendStrength,
          marketPhase: regime.marketPhase,
          volatilityState: regime.volatilityState,
          momentumState: regime.momentumState,
          volumeState: regime.volumeState,
          pricePosition: regime.pricePosition,
        },

        decision: "WAIT",

        reasons: [
          "Base scanner did not identify a directional signal.",
          "Context engine recommends waiting for stronger confirmation.",
        ],
      };
    }

    /*
     * -------------------------------------------------
     * 1. MARKET REGIME
     * -------------------------------------------------
     */

    if (
      baseSignal.signal === "BUY" &&
      regime.regime === "TRENDING_UP"
    ) {
      adjustment += 12;

      reasons.push(
        "BUY is aligned with the current upward market regime (+12).",
      );
    }

    if (
      baseSignal.signal === "SELL" &&
      regime.regime === "TRENDING_DOWN"
    ) {
      adjustment += 12;

      reasons.push(
        "SELL is aligned with the current downward market regime (+12).",
      );
    }

    /*
     * Trading directly against a strong trend
     * receives a significant penalty.
     */

    if (
      baseSignal.signal === "BUY" &&
      regime.regime === "TRENDING_DOWN" &&
      regime.trendStrength >= 70
    ) {
      adjustment -= 25;

      reasons.push(
        "BUY conflicts with a strong downward market regime (-25).",
      );
    }

    if (
      baseSignal.signal === "SELL" &&
      regime.regime === "TRENDING_UP" &&
      regime.trendStrength >= 70
    ) {
      adjustment -= 25;

      reasons.push(
        "SELL conflicts with a strong upward market regime (-25).",
      );
    }

    /*
     * TRANSITION means the market is changing state.
     * Directional signals receive a moderate penalty.
     */

    if (regime.regime === "TRANSITION") {
      adjustment -= 10;

      reasons.push(
        "Market is in transition; directional conviction is weaker (-10).",
      );
    }

    /*
     * -------------------------------------------------
     * 2. VOLUME CONFIRMATION
     * -------------------------------------------------
     */

    if (
      regime.volumeState === "STRONG" ||
      regime.volumeState === "ABOVE_AVERAGE"
    ) {
      adjustment += 8;

      reasons.push(
        "Volume confirms the move (+8).",
      );
    }

    if (regime.volumeState === "WEAK") {
      adjustment -= 8;

      reasons.push(
        "Weak volume reduces signal reliability (-8).",
      );
    }

    if (regime.volumeState === "VERY_WEAK") {
      adjustment -= 15;

      reasons.push(
        "Very weak volume significantly reduces signal reliability (-15).",
      );
    }

    /*
     * -------------------------------------------------
     * 3. MOMENTUM
     * -------------------------------------------------
     */

    if (
      baseSignal.signal === "BUY" &&
      regime.momentumState === "BULLISH"
    ) {
      adjustment += 8;

      reasons.push(
        "Momentum confirms the BUY direction (+8).",
      );
    }

    if (
      baseSignal.signal === "SELL" &&
      regime.momentumState === "BEARISH"
    ) {
      adjustment += 8;

      reasons.push(
        "Momentum confirms the SELL direction (+8).",
      );
    }

    if (regime.momentumState === "NEUTRAL") {
      adjustment -= 5;

      reasons.push(
        "Momentum is neutral and does not confirm the directional signal (-5).",
      );
    }

    /*
     * -------------------------------------------------
     * 4. PRICE POSITION
     * -------------------------------------------------
     *
     * Avoid chasing moves at extreme positions.
     */

    if (
      baseSignal.signal === "BUY" &&
      regime.pricePosition >= 90
    ) {
      adjustment -= 12;

      reasons.push(
        "BUY is occurring near the upper end of the recent price range (-12).",
      );
    }

    if (
      baseSignal.signal === "SELL" &&
      regime.pricePosition <= 10
    ) {
      adjustment -= 12;

      reasons.push(
        "SELL is occurring near the lower end of the recent price range (-12).",
      );
    }

    /*
     * -------------------------------------------------
     * 5. VOLATILITY
     * -------------------------------------------------
     */

    if (regime.volatilityState === "LOW") {
      adjustment -= 3;

      reasons.push(
        "Low volatility reduces the expected strength of the move (-3).",
      );
    }

    if (regime.volatilityState === "HIGH") {
      adjustment -= 5;

      reasons.push(
        "High volatility increases uncertainty (-5).",
      );
    }

    /*
     * -------------------------------------------------
     * FINAL CONFIDENCE
     * -------------------------------------------------
     */

    const finalConfidence = Math.max(
      0,
      Math.min(
        100,
        Math.round(baseSignal.confidence + adjustment),
      ),
    );

    /*
     * -------------------------------------------------
     * SETUP QUALITY
     * -------------------------------------------------
     */

    let setupQuality: SetupQuality;

    if (finalConfidence >= 90) {
      setupQuality = "EXCELLENT";
    } else if (finalConfidence >= 80) {
      setupQuality = "GOOD";
    } else if (finalConfidence >= 65) {
      setupQuality = "CAUTION";
    } else if (finalConfidence >= 45) {
      setupQuality = "POOR";
    } else {
      setupQuality = "INVALID";
    }

    /*
     * -------------------------------------------------
     * DECISION
     * -------------------------------------------------
     */

    let decision: "TRADE" | "WAIT" | "AVOID";

    if (finalConfidence >= 80) {
      decision = "TRADE";
    } else if (finalConfidence >= 60) {
      decision = "WAIT";
    } else {
      decision = "AVOID";
    }

    /*
     * A very weak setup should not be presented
     * as a strong directional opportunity.
     */

    let finalSignal: "BUY" | "SELL" | "NEUTRAL" =
  baseSignal.signal;

    if (decision === "AVOID") {
      finalSignal = "NEUTRAL";

      reasons.push(
        "Context risk is too high; directional signal has been neutralized.",
      );
    }

    reasons.push(
      `Base confidence: ${baseSignal.confidence}%.`,
    );

    reasons.push(
      `Context adjustment: ${adjustment >= 0 ? "+" : ""}${adjustment}.`,
    );

    reasons.push(
      `Final confidence: ${finalConfidence}%.`,
    );

    reasons.push(
      `Setup quality: ${setupQuality}.`,
    );

    reasons.push(
      `Final decision: ${decision}.`,
    );

    return {
      baseSignal,

      finalSignal,

      baseConfidence: baseSignal.confidence,
      finalConfidence,

      adjustment,

      setupQuality,

      context: {
        regime: regime.regime,
        regimeConfidence: regime.confidence,
        trendStrength: regime.trendStrength,
        marketPhase: regime.marketPhase,
        volatilityState: regime.volatilityState,
        momentumState: regime.momentumState,
        volumeState: regime.volumeState,
        pricePosition: regime.pricePosition,
      },

      decision,

      reasons,
    };
  }
}

