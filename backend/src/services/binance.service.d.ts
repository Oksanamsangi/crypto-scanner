import type { ExchangeInfo, Kline, KlineInterval, Ticker24h } from "../types/market.js";
export declare class BinanceServiceError extends Error {
    readonly status: number | undefined;
    constructor(message: string, status?: number);
}
export declare class BinanceService {
    private readonly client;
    constructor();
    get24hTicker(symbol: string): Promise<Ticker24h>;
    getKlines(symbol: string, interval: KlineInterval, limit?: number): Promise<Kline[]>;
    getAll24hTickers(): Promise<Ticker24h[]>;
    getExchangeInfo(): Promise<ExchangeInfo>;
    private request;
    private toServiceError;
}
//# sourceMappingURL=binance.service.d.ts.map