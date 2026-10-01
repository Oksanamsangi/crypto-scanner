import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

interface BinanceChartProps {
  symbol: string;
  interval: string;
}


function BinanceChart({ symbol, interval }: BinanceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const chartRef = useRef<IChartApi | null>(null);

  const seriesRef =
    useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 480,

      layout: {
        background: {
          type: ColorType.Solid,
          color: "transparent",
        },
        textColor: "#8f96a3",
      },

      grid: {
        vertLines: {
          color: "rgba(255,255,255,0.04)",
        },
        horzLines: {
          color: "rgba(255,255,255,0.04)",
        },
      },

      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },

      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },

      crosshair: {
        vertLine: {
          color: "rgba(255,255,255,0.25)",
        },
        horzLine: {
          color: "rgba(255,255,255,0.25)",
        },
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

    async function loadCandles() {
      if (!seriesRef.current) {
        return;
      }

      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
            symbol,
          )}&interval=${encodeURIComponent(interval)}&limit=200`,
        );

        if (!response.ok) {
          throw new Error(
            `Binance returned HTTP ${response.status}`,
          );
        }

        const data = (await response.json()) as unknown[][];

        const candles: CandlestickData[] = data.map(
          (item) => ({
            time: Math.floor(Number(item[0]) / 1000) as Time,
            open: Number(item[1]),
            high: Number(item[2]),
            low: Number(item[3]),
            close: Number(item[4]),
          }),
        );

        if (cancelled || !seriesRef.current) {
          return;
        }

        seriesRef.current.setData(candles);

        chartRef.current?.timeScale().fitContent();
      } catch (error) {
        console.error("Unable to load Binance candles:", error);
      }
    }

    loadCandles();

    const refreshInterval = window.setInterval(
      loadCandles,
      5000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [symbol, interval]);

  return (
    <section className="live-chart-panel">
      <div className="live-chart-header">
        <div>
          <div className="live-chart-kicker">
            LIVE MARKET
          </div>

          <div className="live-chart-symbol">
            {symbol}
          </div>
        </div>

        <div className="live-chart-meta">
          <span className="live-chart-status">
            <span className="live-chart-dot" />
            LIVE
          </span>

          <span>{interval}</span>

          <span>BINANCE SPOT</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="live-chart-container"
      />
    </section>
  );
}

export default BinanceChart;