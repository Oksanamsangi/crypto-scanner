
import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

interface LiveChartProps {
  symbol?: string;
  interval?: string;
  coins?: Coin[];
  onSymbolChange?: (symbol: string) => void;
}

export interface Coin {
  symbol: string;
  name: string;
  short: string;
}

interface BinanceKline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  closeTime: number;
}

const DEFAULT_COINS: Coin[] = [
  { symbol: "BTCUSDT", name: "Bitcoin", short: "BTC" },
  { symbol: "ETHUSDT", name: "Ethereum", short: "ETH" },
  { symbol: "BNBUSDT", name: "BNB", short: "BNB" },
  { symbol: "SOLUSDT", name: "Solana", short: "SOL" },
  { symbol: "XRPUSDT", name: "XRP", short: "XRP" },
  { symbol: "ADAUSDT", name: "Cardano", short: "ADA" },
  { symbol: "DOGEUSDT", name: "Dogecoin", short: "DOGE" },
  { symbol: "AVAXUSDT", name: "Avalanche", short: "AVAX" },
  { symbol: "LINKUSDT", name: "Chainlink", short: "LINK" },
  { symbol: "DOTUSDT", name: "Polkadot", short: "DOT" },
];

const BINANCE_API = "https://api.binance.com/api/v3/klines";

function intervalToMilliseconds(interval: string): number {
  switch (interval) {
    case "1m":
      return 60_000;
    case "3m":
      return 180_000;
    case "5m":
      return 300_000;
    case "15m":
      return 900_000;
    case "30m":
      return 1_800_000;
    case "1h":
      return 3_600_000;
    case "2h":
      return 7_200_000;
    case "4h":
      return 14_400_000;
    case "6h":
      return 21_600_000;
    case "8h":
      return 28_800_000;
    case "12h":
      return 43_200_000;
    case "1d":
      return 86_400_000;
    default:
      return 3_600_000;
  }
}

async function fetchCandles(
  symbol: string,
  interval: string,
): Promise<BinanceKline[]> {
  const response = await fetch(
    `${BINANCE_API}?symbol=${encodeURIComponent(
      symbol,
    )}&interval=${encodeURIComponent(interval)}&limit=200`,
  );

  if (!response.ok) {
    throw new Error(`Binance returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as unknown[][];

  return data.map((item) => ({
    openTime: Number(item[0]),
    open: Number(item[1]),
    high: Number(item[2]),
    low: Number(item[3]),
    close: Number(item[4]),
    closeTime: Number(item[6]),
  }));
}

function LiveChart({
  symbol = "BTCUSDT",
  interval = "1h",
  coins = DEFAULT_COINS,
  onSymbolChange,
}: LiveChartProps) {
  const [selectedSymbol, setSelectedSymbol] = useState(symbol);
  const [candles, setCandles] = useState<BinanceKline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    setSelectedSymbol(symbol);
  }, [symbol]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 500,

      layout: {
        background: {
          type: ColorType.Solid,
          color: "#09090d",
        },
        textColor: "#737384",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        attributionLogo: false,
      },

      grid: {
        vertLines: {
          color: "rgba(255,255,255,0.025)",
        },
        horzLines: {
          color: "rgba(255,255,255,0.025)",
        },
      },

      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.055)",
        textColor: "#747481",
        scaleMargins: {
          top: 0.08,
          bottom: 0.08,
        },
      },

      timeScale: {
        borderColor: "rgba(255,255,255,0.055)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 8,
        minBarSpacing: 4,
      },

      crosshair: {
        mode: 1,

        vertLine: {
          color: "rgba(139,92,246,0.45)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#7c3aed",
        },

        horzLine: {
          color: "rgba(139,92,246,0.45)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#7c3aed",
        },
      },

      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },

      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#35d07f",
      downColor: "#ff5c7a",
      borderUpColor: "#35d07f",
      borderDownColor: "#ff5c7a",
      wickUpColor: "#35d07f",
      wickDownColor: "#ff5c7a",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth) {
        return;
      }

      chart.applyOptions({
        width: container.clientWidth,
      });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();

      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");
      setCandles([]);

      try {
        const data = await fetchCandles(
          selectedSymbol,
          interval,
        );

        if (cancelled) {
          return;
        }

        setCandles(data);

        if (seriesRef.current) {
          const formatted: CandlestickData[] = data.map(
            (candle) => ({
              time: Math.floor(candle.openTime / 1000) as Time,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
            }),
          );

          seriesRef.current.setData(formatted);

          chartRef.current?.timeScale().fitContent();
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load Binance market data.",
        );

        seriesRef.current?.setData([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, interval]);

  useEffect(() => {
    const refreshMs = Math.min(
      intervalToMilliseconds(interval),
      10_000,
    );

    const timer = window.setInterval(async () => {
      try {
        const data = await fetchCandles(
          selectedSymbol,
          interval,
        );

        const latest = data[data.length - 1];

        if (!latest || !seriesRef.current) {
          return;
        }

        seriesRef.current.update({
          time: Math.floor(latest.openTime / 1000) as Time,
          open: latest.open,
          high: latest.high,
          low: latest.low,
          close: latest.close,
        });
      } catch {
        return;
      }
    }, refreshMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [selectedSymbol, interval]);

  const handleCoinChange = (coin: Coin) => {
    setSelectedSymbol(coin.symbol);
    onSymbolChange?.(coin.symbol);
  };

  const selectedCoin =
    coins.find((coin) => coin.symbol === selectedSymbol) ??
    DEFAULT_COINS.find((coin) => coin.symbol === selectedSymbol);

  const displaySymbol =
    selectedCoin?.short ??
    selectedSymbol.replace("USDT", "");

  const displayName =
    selectedCoin?.name ?? "Market";

  return (
    <section className="live-chart-panel">
      <div className="live-chart-top-line" />

      <header className="live-chart-header">
        <div className="live-chart-heading">
          <div className="live-chart-kicker">
            <span className="live-chart-kicker-line" />
            <span>LIVE MARKET</span>
          </div>

          <div className="live-chart-title-row">
            <span className="live-chart-symbol">
              {displaySymbol}
            </span>

            <span className="live-chart-pair">
              / USDT
            </span>
          </div>

          <div className="live-chart-name">
            {displayName}
          </div>
        </div>

        <div className="live-chart-meta">
          <div className="live-chart-status">
            <span className="live-chart-dot" />
            <span>LIVE</span>
          </div>

          <div className="live-chart-meta-divider" />

          <div className="live-chart-meta-item">
            <span className="meta-label">INTERVAL</span>
            <strong>{interval}</strong>
          </div>

          <div className="live-chart-meta-divider" />

          <div className="live-chart-meta-item">
            <span className="meta-label">EXCHANGE</span>
            <strong>BINANCE SPOT</strong>
          </div>
        </div>
      </header>

      <div className="coin-selector-header">
        <div className="coin-selector-heading">
          <span className="coin-selector-title">MARKETS</span>
          <span className="coin-selector-subtitle">
            SELECT ASSET
          </span>
        </div>

        <div className="coin-selector-line" />
      </div>

      <div className="coin-selector">
        {coins.map((coin) => {
          const active = selectedSymbol === coin.symbol;

          return (
            <button
              key={coin.symbol}
              type="button"
              className={`coin-button ${
                active ? "active" : ""
              }`}
              onClick={() => handleCoinChange(coin)}
            >
              <span className="coin-button-symbol">
                {coin.short}
              </span>

              <span className="coin-button-name">
                {coin.name}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="live-chart-error">
          <span className="live-chart-error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      <div className="live-chart-stage">
        <div className="chart-stage-label">
          <span className="chart-stage-symbol">
            {selectedSymbol}
          </span>

          <span className="chart-stage-interval">
            {interval}
          </span>
        </div>

        <div
          ref={containerRef}
          className="live-chart-container"
        />

        {loading && (
          <div className="live-chart-loading">
            <div className="chart-loader" />

            <div className="chart-loading-copy">
              <strong>LOADING MARKET DATA</strong>
              <span>
                {selectedSymbol} · {interval}
              </span>
            </div>
          </div>
        )}
      </div>

      {!loading && candles.length > 0 && (
        <footer className="live-chart-footer">
          <div className="chart-footer-item">
            <span className="footer-dot" />
            <span>MARKET DATA</span>
          </div>

          <div className="chart-footer-divider" />

          <div className="chart-footer-item">
            {selectedSymbol}
          </div>

          <div className="chart-footer-divider" />

          <div className="chart-footer-item">
            {candles.length} CANDLES
          </div>

          <div className="chart-footer-spacer" />

          <div className="chart-footer-live">
            REAL-TIME
          </div>
        </footer>
      )}
    </section>
  );
}

export default LiveChart;
