import axios from "axios";
import type { AxiosError, AxiosInstance } from "axios";
import type {
  ExchangeInfo,
  Kline,
  KlineInterval,
  SymbolInfo,
  Ticker24h,
} from "../types/market.js";

const BINANCE_BASE_URL = "https://data-api.binance.vision";
const REQUEST_TIMEOUT_MS = 10_000;

interface RawTicker24h {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
}

type RawKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

interface RawSymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

interface RawExchangeInfo {
  timezone: string;
  serverTime: number;
  symbols: RawSymbolInfo[];
}

export class BinanceServiceError extends Error {
  public readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "BinanceServiceError";
    this.status = status;
  }
}

export class BinanceService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BINANCE_BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }

  public async get24hTicker(symbol: string): Promise<Ticker24h> {
    const raw = await this.request<RawTicker24h>("/api/v3/ticker/24hr", {
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

  public async getKlines(
    symbol: string,
    interval: KlineInterval,
    limit = 500,
  ): Promise<Kline[]> {
    const raw = await this.request<RawKline[]>("/api/v3/klines", {
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

  public async getAll24hTickers(): Promise<Ticker24h[]> {
    const raw = await this.request<RawTicker24h[]>("/api/v3/ticker/24hr");

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

  public async getExchangeInfo(): Promise<ExchangeInfo> {
    const raw = await this.request<RawExchangeInfo>("/api/v3/exchangeInfo");

    const symbols: SymbolInfo[] = raw.symbols.map((symbol) => ({
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

  private async request<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T> {
    try {
      const response = await this.client.get<T>(path, { params });
      return response.data;
    } catch (error) {
      throw this.toServiceError(error, path);
    }
  }

  private toServiceError(error: unknown, path: string): BinanceServiceError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ msg?: string }>;
      const status = axiosError.response?.status;

      if (axiosError.code === "ECONNABORTED") {
        return new BinanceServiceError(
          `Binance request to ${path} timed out`,
          status,
        );
      }

      const message =
        axiosError.response?.data?.msg ??
        axiosError.message ??
        "Unknown Binance API error";

      return new BinanceServiceError(
        `Binance request to ${path} failed: ${message}`,
        status,
      );
    }

    return new BinanceServiceError(`Unexpected error calling Binance ${path}`);
  }
}
