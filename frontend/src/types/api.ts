export type ScannerSignal =
  | "BUY"
  | "SELL"
  | "NEUTRAL";

export type SignalStrength =
  | "VERY_STRONG"
  | "STRONG"
  | "MODERATE"
  | "WEAK"
  | "NEUTRAL";

export type SetupQuality =
  | "EXCELLENT"
  | "GOOD"
  | "CAUTION"
  | "POOR"
  | "INVALID";

export type ContextDecision =
  | "TRADE"
  | "WAIT"
  | "AVOID";

export type DecisionPriority =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export interface DecisionResult {
  decisionScore: number;
  priority: DecisionPriority;
  reasons: string[];
}

export interface ContextAwareResult {
  finalSignal: ScannerSignal;
  baseConfidence: number;
  finalConfidence: number;
  adjustment: number;

  setupQuality: SetupQuality;
  decision: ContextDecision;

  context: {
    regime: string;
    regimeConfidence: number;
    trendStrength: number;
    marketPhase: string;
    volatilityState: string;
    momentumState: string;
    volumeState: string;
    pricePosition: number;
  };

  reasons: string[];
}

export interface ScanResult {
  symbol: string;
  timeframe: string;

  currentPrice: number | null;

  ema20: number | null;
  ema50: number | null;
  rsi14: number | null;

  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;

  atr14: number | null;

  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  riskRewardRatio?: number | null;

  score: number;
  confidence: number;

  signal: ScannerSignal;
  signalStrength?: SignalStrength;

  reasons: string[];

  context?: ContextAwareResult | null;
  decision?: DecisionResult | null;
}

export interface MarketIntelligence {
  regime:
    | "BULLISH"
    | "BEARISH"
    | "MIXED";

  confidence: number;

  breadth: {
    bullish: number;
    bearish: number;
    neutral: number;

    bullishPercentage: number;
    bearishPercentage: number;
    neutralPercentage: number;
  };

  momentum: string;
  risk: string;
  opinion: string;
  recommendedAction: string;

  signals: {
    strong: number;
    buy: number;
    sell: number;
  };
}

export interface ScannerResponse {
  interval?: string;
  candles?: number;
  scannedPairs?: number;

  topBuy?: ScanResult[];
  topSell?: ScanResult[];

  results?: ScanResult[];
  data?: ScanResult[];
  signals?: ScanResult[];

  intelligence?: MarketIntelligence;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export type AIIntelligenceState =
  | "HIGH_CONVICTION"
  | "SUPPORTED"
  | "CONDITIONAL"
  | "LOW_CONVICTION"
  | "BLOCKED";

export interface AIIntelligenceAnalysis {
  state: AIIntelligenceState;
  summary: string;

  market: {
    outlook: string;
    summary: string;
    risk: string;
  };

  setup: {
    assessment: string;
    summary: string;
    qualityScore: number | null;
  };

  signal: {
    assessment: string;
    summary: string;
    confidence: number;
    blockers: string[];
  };

  decision: {
    assessment: string;
    summary: string;
    confidence: number;
    trustScore: number | null;
    blockers: string[];
  };

  strategy: {
    assessment: string;
    summary: string;
    selected: boolean;
    executionState: string;
  };

  supportingFactors: string[];
  conflicts: string[];
  risks: string[];
  watchItems: string[];
  recommendedFocus: string;
}
