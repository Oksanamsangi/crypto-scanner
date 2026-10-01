import prisma from "../lib/prisma.js";

export type OutcomeStatus =
  | "WIN"
  | "LOSS"
  | "BREAKEVEN";

export interface OutcomeTrackingInput {
  setupId: string;
  status: OutcomeStatus;
  returnPercent: number;
  outcomeAt?: Date;
}

export interface OutcomeTrackingResult {
  setupId: string;
  status: OutcomeStatus;
  returnPercent: number;
  outcomeAt: Date;
  recorded: boolean;
  explanation: string;
}

export class OutcomeTrackingService {
  async recordOutcome(
    input: OutcomeTrackingInput,
  ): Promise<OutcomeTrackingResult> {
    if (!Number.isFinite(input.returnPercent)) {
      throw new Error("returnPercent must be a finite number.");
    }

    const setup = await prisma.setupMemory.findUnique({
      where: {
        id: input.setupId,
      },
    });

    if (!setup) {
      throw new Error(
        `SetupMemory not found: ${input.setupId}`,
      );
    }

    if (setup.outcomeStatus !== null) {
      throw new Error(
        `Outcome already recorded for setup: ${input.setupId}`,
      );
    }

    const outcomeAt = input.outcomeAt ?? new Date();

    const updated = await prisma.setupMemory.update({
      where: {
        id: input.setupId,
      },
      data: {
        outcomeStatus: input.status,
        outcomeReturn: input.returnPercent,
        outcomeAt,
      },
    });

    return {
      setupId: updated.id,
      status: input.status,
      returnPercent: input.returnPercent,
      outcomeAt,
      recorded: true,
      explanation:
        "Outcome recorded successfully and is available for future learning and reliability analysis.",
    };
  }
}
