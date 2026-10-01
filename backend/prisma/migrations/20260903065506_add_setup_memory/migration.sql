-- CreateTable
CREATE TABLE "SetupMemory" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "trend" TEXT NOT NULL,
    "momentum" TEXT NOT NULL,
    "volatility" TEXT NOT NULL,
    "volume" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "signalStrength" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "rsi" DOUBLE PRECISION,
    "atr" DOUBLE PRECISION,
    "emaStructure" TEXT NOT NULL,
    "priceVsEma" TEXT NOT NULL,
    "changePercent" DOUBLE PRECISION,
    "volumeRatio" DOUBLE PRECISION,
    "setupQuality" INTEGER,
    "contextConfidence" INTEGER,
    "marketRegime" TEXT,
    "marketPhase" TEXT,
    "breadthScore" DOUBLE PRECISION,
    "crossMarketScore" DOUBLE PRECISION,
    "fingerprint" TEXT NOT NULL,
    "characteristics" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "outcomeStatus" TEXT,
    "outcomeReturn" DOUBLE PRECISION,
    "outcomeAt" TIMESTAMP(3),

    CONSTRAINT "SetupMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetupMemory_symbol_interval_observedAt_idx" ON "SetupMemory"("symbol", "interval", "observedAt");

-- CreateIndex
CREATE INDEX "SetupMemory_direction_interval_observedAt_idx" ON "SetupMemory"("direction", "interval", "observedAt");

-- CreateIndex
CREATE INDEX "SetupMemory_fingerprint_idx" ON "SetupMemory"("fingerprint");
