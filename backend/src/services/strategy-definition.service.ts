export type StrategyDirection =
  | "LONG"
  | "SHORT"
  | "BOTH";

export type StrategyTimeframe =
  | "SCALP"
  | "INTRADAY"
  | "SWING"
  | "POSITION";

export type StrategyRiskProfile =
  | "CONSERVATIVE"
  | "BALANCED"
  | "AGGRESSIVE";

export type StrategyStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "RETIRED";

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;

  direction: StrategyDirection;
  timeframe: StrategyTimeframe;
  riskProfile: StrategyRiskProfile;
  status: StrategyStatus;

  minConfidence: number;
  minSetupQuality: number;
  maxFalseSignalScore: number;
  maxConflictScore: number;
  maxRiskContradictionScore: number;

  requirePatternConfirmation: boolean;
  requireMarketConfirmation: boolean;
  requireVolumeConfirmation: boolean;
  requireTrendAlignment: boolean;

  entryFramework: {
    minSignalStrength: number;
    minMomentumScore: number;
    allowBreakouts: boolean;
    allowReversals: boolean;
    allowTrendContinuation: boolean;
  };

  exitFramework: {
    takeProfitRatio: number;
    stopLossRatio: number;
    trailingStopEnabled: boolean;
    trailingStopRatio: number;
    maxHoldingMinutes: number;
  };

  positionFramework: {
    maxPositionRiskPercent: number;
    maxConcurrentPositions: number;
    scaleInEnabled: boolean;
    scaleOutEnabled: boolean;
  };

  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StrategyDefinitionInput {
  id?: string;
  name: string;
  description?: string;

  direction?: StrategyDirection;
  timeframe?: StrategyTimeframe;
  riskProfile?: StrategyRiskProfile;
  status?: StrategyStatus;

  minConfidence?: number;
  minSetupQuality?: number;
  maxFalseSignalScore?: number;
  maxConflictScore?: number;
  maxRiskContradictionScore?: number;

  requirePatternConfirmation?: boolean;
  requireMarketConfirmation?: boolean;
  requireVolumeConfirmation?: boolean;
  requireTrendAlignment?: boolean;

  entryFramework?: Partial<
    StrategyDefinition["entryFramework"]
  >;

  exitFramework?: Partial<
    StrategyDefinition["exitFramework"]
  >;

  positionFramework?: Partial<
    StrategyDefinition["positionFramework"]
  >;

  tags?: string[];
}

function clamp(
  value: number,
  min = 0,
  max = 100,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function createId(
  name: string,
): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `strategy_${normalized || "custom"}`;
}

function defaultsForRisk(
  riskProfile: StrategyRiskProfile,
) {
  if (riskProfile === "CONSERVATIVE") {
    return {
      minConfidence: 75,
      minSetupQuality: 75,
      maxFalseSignalScore: 20,
      maxConflictScore: 20,
      maxRiskContradictionScore: 25,
      maxPositionRiskPercent: 0.5,
      maxConcurrentPositions: 2,
      stopLossRatio: 1,
      takeProfitRatio: 2,
      trailingStopRatio: 0.7,
    };
  }

  if (riskProfile === "AGGRESSIVE") {
    return {
      minConfidence: 55,
      minSetupQuality: 55,
      maxFalseSignalScore: 40,
      maxConflictScore: 40,
      maxRiskContradictionScore: 45,
      maxPositionRiskPercent: 1.5,
      maxConcurrentPositions: 5,
      stopLossRatio: 1.5,
      takeProfitRatio: 3,
      trailingStopRatio: 1,
    };
  }

  return {
    minConfidence: 65,
    minSetupQuality: 65,
    maxFalseSignalScore: 30,
    maxConflictScore: 30,
    maxRiskContradictionScore: 35,
    maxPositionRiskPercent: 1,
    maxConcurrentPositions: 3,
    stopLossRatio: 1.2,
    takeProfitRatio: 2.5,
    trailingStopRatio: 0.8,
  };
}

export function defineStrategy(
  input: StrategyDefinitionInput,
): StrategyDefinition {
  const now = new Date().toISOString();

  const riskProfile =
    input.riskProfile ?? "BALANCED";

  const riskDefaults =
    defaultsForRisk(riskProfile);

  const definition: StrategyDefinition = {
    id: input.id ?? createId(input.name),

    name: input.name.trim(),

    description:
      input.description?.trim() ??
      "VELORA strategy definition",

    direction:
      input.direction ?? "BOTH",

    timeframe:
      input.timeframe ?? "INTRADAY",

    riskProfile,

    status:
      input.status ?? "DRAFT",

    minConfidence: clamp(
      input.minConfidence ??
        riskDefaults.minConfidence,
    ),

    minSetupQuality: clamp(
      input.minSetupQuality ??
        riskDefaults.minSetupQuality,
    ),

    maxFalseSignalScore: clamp(
      input.maxFalseSignalScore ??
        riskDefaults.maxFalseSignalScore,
    ),

    maxConflictScore: clamp(
      input.maxConflictScore ??
        riskDefaults.maxConflictScore,
    ),

    maxRiskContradictionScore: clamp(
      input.maxRiskContradictionScore ??
        riskDefaults.maxRiskContradictionScore,
    ),

    requirePatternConfirmation:
      input.requirePatternConfirmation ??
      false,

    requireMarketConfirmation:
      input.requireMarketConfirmation ??
      true,

    requireVolumeConfirmation:
      input.requireVolumeConfirmation ??
      true,

    requireTrendAlignment:
      input.requireTrendAlignment ??
      true,

    entryFramework: {
      minSignalStrength: clamp(
        input.entryFramework
          ?.minSignalStrength ?? 65,
      ),

      minMomentumScore: clamp(
        input.entryFramework
          ?.minMomentumScore ?? 55,
      ),

      allowBreakouts:
        input.entryFramework
          ?.allowBreakouts ?? true,

      allowReversals:
        input.entryFramework
          ?.allowReversals ?? false,

      allowTrendContinuation:
        input.entryFramework
          ?.allowTrendContinuation ?? true,
    },

    exitFramework: {
      takeProfitRatio:
        input.exitFramework
          ?.takeProfitRatio ??
        riskDefaults.takeProfitRatio,

      stopLossRatio:
        input.exitFramework
          ?.stopLossRatio ??
        riskDefaults.stopLossRatio,

      trailingStopEnabled:
        input.exitFramework
          ?.trailingStopEnabled ?? true,

      trailingStopRatio:
        input.exitFramework
          ?.trailingStopRatio ??
        riskDefaults.trailingStopRatio,

      maxHoldingMinutes:
        input.exitFramework
          ?.maxHoldingMinutes ??
        1440,
    },

    positionFramework: {
      maxPositionRiskPercent:
        input.positionFramework
          ?.maxPositionRiskPercent ??
        riskDefaults.maxPositionRiskPercent,

      maxConcurrentPositions:
        input.positionFramework
          ?.maxConcurrentPositions ??
        riskDefaults.maxConcurrentPositions,

      scaleInEnabled:
        input.positionFramework
          ?.scaleInEnabled ?? false,

      scaleOutEnabled:
        input.positionFramework
          ?.scaleOutEnabled ?? true,
    },

    tags: [
      ...(input.tags ?? []),
    ],

    createdAt: now,
    updatedAt: now,
  };

  return definition;
}

export function validateStrategyDefinition(
  strategy: StrategyDefinition,
): string[] {
  const errors: string[] = [];

  if (!strategy.name.trim()) {
    errors.push("Strategy name is required");
  }

  if (
    strategy.minConfidence < 0 ||
    strategy.minConfidence > 100
  ) {
    errors.push(
      "Minimum confidence must be between 0 and 100",
    );
  }

  if (
    strategy.minSetupQuality < 0 ||
    strategy.minSetupQuality > 100
  ) {
    errors.push(
      "Minimum setup quality must be between 0 and 100",
    );
  }

  if (
    strategy.maxFalseSignalScore < 0 ||
    strategy.maxFalseSignalScore > 100
  ) {
    errors.push(
      "Maximum false-signal score must be between 0 and 100",
    );
  }

  if (
    strategy.maxConflictScore < 0 ||
    strategy.maxConflictScore > 100
  ) {
    errors.push(
      "Maximum conflict score must be between 0 and 100",
    );
  }

  if (
    strategy.maxRiskContradictionScore < 0 ||
    strategy.maxRiskContradictionScore > 100
  ) {
    errors.push(
      "Maximum risk-contradiction score must be between 0 and 100",
    );
  }

  if (
    strategy.entryFramework.minSignalStrength < 0 ||
    strategy.entryFramework.minSignalStrength > 100
  ) {
    errors.push(
      "Minimum signal strength must be between 0 and 100",
    );
  }

  if (
    strategy.entryFramework.minMomentumScore < 0 ||
    strategy.entryFramework.minMomentumScore > 100
  ) {
    errors.push(
      "Minimum momentum score must be between 0 and 100",
    );
  }

  if (
    strategy.exitFramework.takeProfitRatio <= 0
  ) {
    errors.push(
      "Take-profit ratio must be greater than 0",
    );
  }

  if (
    strategy.exitFramework.stopLossRatio <= 0
  ) {
    errors.push(
      "Stop-loss ratio must be greater than 0",
    );
  }

  if (
    strategy.exitFramework.maxHoldingMinutes <= 0
  ) {
    errors.push(
      "Maximum holding time must be greater than 0",
    );
  }

  if (
    strategy.positionFramework
      .maxPositionRiskPercent <= 0
  ) {
    errors.push(
      "Maximum position risk must be greater than 0",
    );
  }

  if (
    strategy.positionFramework
      .maxConcurrentPositions < 1
  ) {
    errors.push(
      "Maximum concurrent positions must be at least 1",
    );
  }

  return errors;
}

export const strategyDefinition = {
  define: defineStrategy,
  validate: validateStrategyDefinition,
};
