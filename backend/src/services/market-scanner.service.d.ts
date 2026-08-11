import { type ScanResult } from './scanner.service.js';
import type { KlineInterval } from '../types/market.js';
export interface MarketScanResult {
    scanned: number;
    results: ScanResult[];
}
export declare class MarketScannerService {
    private readonly binanceService;
    private readonly scannerService;
    constructor();
    scanMarket(interval?: KlineInterval, limit?: number): Promise<MarketScanResult>;
    private getUsdtTickers;
}
//# sourceMappingURL=market-scanner.service.d.ts.map