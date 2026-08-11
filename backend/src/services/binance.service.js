import axios from "axios";
const BINANCE_BASE_URL = "https://api.binance.com";
const REQUEST_TIMEOUT_MS = 10_000;
export class BinanceServiceError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = "BinanceServiceError";
        this.status = status;
    }
}
export class BinanceService {
    client;
    constructor() {
        this.client = axios.create({
            baseURL: BINANCE_BASE_URL,
            timeout: REQUEST_TIMEOUT_MS,
        });
    }
    async get24hTicker(symbol) {
        const raw = await this.request("/api/v3/ticker/24hr", {
            symbol: symbol.toUpperCase(),
        });
        return {
            symbol: raw.symbol,
            priceChange: Number(raw.priceChange),
            priceChangePercent: Number(raw.priceChangePercent),
            lastPrice: Number(raw.lastPrice),
            openPrice: Number(raw.openPrice),
            highPrice: Number(raw.highPrice),
            lowPrice: Number(raw.lowPrice),
            volume: Number(raw.volume),
            quoteVolume: Number(raw.quoteVolume),
            openTime: raw.openTime,
            closeTime: raw.closeTime,
        };
    }
    async getKlines(symbol, interval, limit = 500) {
        const raw = await this.request("/api/v3/klines", {
            symbol: symbol.toUpperCase(),
            interval,
            limit,
        });
        return raw.map((entry) => ({
            openTime: entry[0],
            open: Number(entry[1]),
            high: Number(entry[2]),
            low: Number(entry[3]),
            close: Number(entry[4]),
            volume: Number(entry[5]),
            closeTime: entry[6],
            quoteAssetVolume: Number(entry[7]),
            numberOfTrades: entry[8],
        }));
    }
    async getAll24hTickers() {
        const raw = await this.request("/api/v3/ticker/24hr");
        return raw.map((ticker) => ({
            symbol: ticker.symbol,
            priceChange: Number(ticker.priceChange),
            priceChangePercent: Number(ticker.priceChangePercent),
            lastPrice: Number(ticker.lastPrice),
            openPrice: Number(ticker.openPrice),
            highPrice: Number(ticker.highPrice),
            lowPrice: Number(ticker.lowPrice),
            volume: Number(ticker.volume),
            quoteVolume: Number(ticker.quoteVolume),
            openTime: ticker.openTime,
            closeTime: ticker.closeTime,
        }));
    }
    async getExchangeInfo() {
        const raw = await this.request("/api/v3/exchangeInfo");
        const symbols = raw.symbols.map((symbol) => ({
            symbol: symbol.symbol,
            baseAsset: symbol.baseAsset,
            quoteAsset: symbol.quoteAsset,
            status: symbol.status,
        }));
        return {
            timezone: raw.timezone,
            serverTime: raw.serverTime,
            symbols,
        };
    }
    async request(path, params) {
        try {
            const response = await this.client.get(path, { params });
            return response.data;
        }
        catch (error) {
            throw this.toServiceError(error, path);
        }
    }
    toServiceError(error, path) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            const status = axiosError.response?.status;
            if (axiosError.code === "ECONNABORTED") {
                return new BinanceServiceError(`Binance request to ${path} timed out`, status);
            }
            const message = axiosError.response?.data?.msg ??
                axiosError.message ??
                "Unknown Binance API error";
            return new BinanceServiceError(`Binance request to ${path} failed: ${message}`, status);
        }
        return new BinanceServiceError(`Unexpected error calling Binance ${path}`);
    }
}
//# sourceMappingURL=binance.service.js.map