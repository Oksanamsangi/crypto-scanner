import type { ScanResult } from "./scanner.service.js";

export interface SignalHistoryEntry {
  id: string;
  symbol: string;
  timeframe: string;
  signal: "BUY" | "SELL";
  signalStrength: "STRONG" | "MODERATE" | "WEAK" | "NONE";
  score: number;
  confidence: number;

  price: number;

  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskRewardRatio: number | null;

  timestamp: string;
}

export class SignalHistoryService {
  private readonly history: SignalHistoryEntry[] = [];

  public addSignal(result: ScanResult): SignalHistoryEntry | null {
    if (result.signal === "NEUTRAL") {
      return null;
    }

    if (result.currentPrice === null) {
      return null;
    }

    const lastSignal = this.history.at(-1);

    /*
     * Do not save the exact same signal repeatedly
     * when the scanner is refreshed.
     */
    if (
      lastSignal &&
      lastSignal.symbol === result.symbol &&
      lastSignal.timeframe === result.timeframe &&
      lastSignal.signal === result.signal &&
      lastSignal.score === result.score
    ) {
      return lastSignal;
    }

    const entry: SignalHistoryEntry = {
      id: crypto.randomUUID(),

      symbol: result.symbol,
      timeframe: result.timeframe,

      signal: result.signal,
      signalStrength: result.signalStrength,

      score: result.score,
      confidence: result.confidence,

      price: result.currentPrice,

      entryPrice: result.entryPrice,
      stopLoss: result.stopLoss,
      takeProfit: result.takeProfit,
      riskRewardRatio: result.riskRewardRatio,

      timestamp: new Date().toISOString(),
    };

    this.history.push(entry);

    /*
     * Keep memory usage under control.
     */
    const MAX_HISTORY = 5000;

    if (this.history.length > MAX_HISTORY) {
      this.history.splice(0, this.history.length - MAX_HISTORY);
    }

    return entry;
  }

  public addSignals(results: ScanResult[]): SignalHistoryEntry[] {
    const added: SignalHistoryEntry[] = [];

    for (const result of results) {
      const signal = this.addSignal(result);

      if (signal !== null) {
        added.push(signal);
      }
    }

    return added;
  }

  public getHistory(options?: {
    symbol?: string;
    timeframe?: string;
    signal?: "BUY" | "SELL";
    limit?: number;
  }): SignalHistoryEntry[] {
    let results = [...this.history];

    if (options?.symbol) {
      results = results.filter(
        (entry) => entry.symbol === options.symbol,
      );
    }

    if (options?.timeframe) {
      results = results.filter(
        (entry) => entry.timeframe === options.timeframe,
      );
    }

    if (options?.signal) {
      results = results.filter(
        (entry) => entry.signal === options.signal,
      );
    }

    results.reverse();

    const limit = options?.limit ?? 100;

    return results.slice(0, limit);
  }

  public getStats() {
    const total = this.history.length;

    const buySignals = this.history.filter(
      (entry) => entry.signal === "BUY",
    ).length;

    const sellSignals = this.history.filter(
      (entry) => entry.signal === "SELL",
    ).length;

    const strongSignals = this.history.filter(
      (entry) => entry.signalStrength === "STRONG",
    ).length;

    const moderateSignals = this.history.filter(
      (entry) => entry.signalStrength === "MODERATE",
    ).length;

    const weakSignals = this.history.filter(
      (entry) => entry.signalStrength === "WEAK",
    ).length;

    return {
      total,
      buySignals,
      sellSignals,
      strongSignals,
      moderateSignals,
      weakSignals,
    };
  }

  public clear(): void {
    this.history.length = 0;
  }
}