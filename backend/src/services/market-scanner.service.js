import { BinanceService } from './binance.service.js';
import { ScannerService, } from './scanner.service.js';
export class MarketScannerService {
    binanceService;
    scannerService;
    constructor() {
        this.binanceService = new BinanceService();
        this.scannerService = new ScannerService();
    }
    async scanMarket(interval = '1h', limit = 100) {
        // Get all 24h ticker data from Binance.
        const tickers = await this.getUsdtTickers();
        // Sort by quote volume so we scan the most liquid pairs first.
        const sortedTickers = tickers.sort((a, b) => b.quoteVolume - a.quoteVolume);
        const results = [];
        // Scan the most liquid pairs.
        for (const ticker of sortedTickers) {
            try {
                const klines = await this.binanceService.getKlines(ticker.symbol, interval, limit);
                const result = this.scannerService.scan(ticker.symbol, interval, klines);
                results.push(result);
            }
            catch (error) {
                console.error(`Failed to scan ${ticker.symbol}:`, error);
            }
        }
        // Strongest signals first.
        results.sort((a, b) => b.score - a.score);
        return {
            scanned: results.length,
            results,
        };
    }
    async getUsdtTickers() {
        const exchangeInfo = await this.binanceService.getExchangeInfo();
        const usdtSymbols = new Set(exchangeInfo.symbols
            .filter((symbol) => symbol.quoteAsset === 'USDT' &&
            symbol.status === 'TRADING')
            .map((symbol) => symbol.symbol));
        // BinanceService currently exposes single-symbol
        // ticker requests, so fetch them individually.
        const results = [];
        for (const symbol of usdtSymbols) {
            try {
                const ticker = await this.binanceService.get24hTicker(symbol);
                results.push(ticker);
            }
            catch (error) {
                console.error(`Failed to get ticker for ${symbol}:`, error);
            }
        }
        return results;
    }
}
//# sourceMappingURL=market-scanner.service.js.map