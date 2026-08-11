import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type Signal = "BUY" | "SELL" | "NEUTRAL";
type SignalStrength = "STRONG" | "MODERATE" | "WEAK";

interface ScanResult {
  symbol: string;
  timeframe: string;

  currentPrice: number | null;

  ema20: number | null;
  ema50: number | null;
  rsi14: number | null;

  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;

  atr14: number | null;

  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  riskRewardRatio?: number | null;

  score: number;
  confidence: number;
  signal: Signal;
  signalStrength?: SignalStrength;

  reasons: string[];
}

interface ScannerResponse {
  results?: ScanResult[];
  data?: ScanResult[];
  signals?: ScanResult[];
}

const TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d"];

function getResults(payload: ScannerResponse | ScanResult[]): ScanResult[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.signals)) {
    return payload.signals;
  }

  return [];
}

function getStrength(result: ScanResult): SignalStrength {
  if (result.signalStrength) {
    return result.signalStrength;
  }

  const absoluteScore = Math.abs(result.score);

  if (absoluteScore >= 5) return "STRONG";
  if (absoluteScore >= 3) return "MODERATE";

  return "WEAK";
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (value >= 1) {
    return `$${value.toFixed(4)}`;
  }

  if (value >= 0.01) {
    return `$${value.toFixed(6)}`;
  }

  if (value >= 0.0001) {
    return `$${value.toFixed(7)}`;
  }

  return `$${value.toFixed(10)}`;
}

function formatIndicator(
  value: number | null | undefined,
  decimals = 4,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return value.toFixed(decimals);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
}

function App() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [timeframe, setTimeframe] = useState("1h");
  const [limit, setLimit] = useState(60);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [selectedSignal, setSelectedSignal] = useState<ScanResult | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/scanner?interval=${encodeURIComponent(
          timeframe,
        )}&limit=${limit}`,
      );

      if (!response.ok) {
        throw new Error(`Scanner returned HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ScannerResponse | ScanResult[];

      const nextResults = getResults(payload);

      setResults(nextResults);
      setLastUpdated(new Date());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to connect to scanner.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [timeframe, limit]);

  useEffect(() => {
    scan();
  }, [scan]);

  const buySignals = useMemo(
    () =>
      results
        .filter((item) => item.signal === "BUY")
        .sort((a, b) => b.score - a.score || b.confidence - a.confidence),
    [results],
  );

  const sellSignals = useMemo(
    () =>
      results
        .filter((item) => item.signal === "SELL")
        .sort((a, b) => a.score - b.score || b.confidence - a.confidence),
    [results],
  );

  const topBuy = buySignals[0] ?? null;
  const topSell = sellSignals[0] ?? null;

  const strongSignals = results.filter(
    (item) => getStrength(item) === "STRONG",
  ).length;

  const buyCount = buySignals.length;
  const sellCount = sellSignals.length;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>

          <div>
            <div className="brand-name">VELORA</div>
            <div className="brand-subtitle">MARKET INTELLIGENCE</div>
          </div>
        </div>

        <div className="topbar-center">
          <div className="terminal-status">
            <span className="status-dot" />
            LIVE MARKET SCANNER
          </div>

          <div className="exchange-label">BINANCE · SPOT</div>
        </div>

        <button
          className="refresh-button"
          onClick={scan}
          disabled={loading}
          aria-label="Refresh market"
        >
          <span className={loading ? "spin" : ""}>↻</span>
          <span className="refresh-text">REFRESH</span>
        </button>
      </header>

      <main className="main-content">
        <section className="hero">
          <div>
            <div className="eyebrow">QUANTITATIVE MARKET SCANNER</div>

            <h1>
              Find the signal.
              <br />
              <span>Read the market.</span>
            </h1>

            <p>
              Technical indicator agreement across Binance markets, presented as
              actionable intelligence.
            </p>
          </div>

          <div className="scanner-controls">
            <div className="control-label">TIMEFRAME</div>

            <div className="timeframe-list">
              {TIMEFRAMES.map((item) => (
                <button
                  key={item}
                  className={
                    timeframe === item ? "timeframe active" : "timeframe"
                  }
                  onClick={() => setTimeframe(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="limit-control">
              <span>CANDLES</span>

              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              >
                <option value={60}>60</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          <StatCard
            label="MARKETS SCANNED"
            value={results.length.toString()}
            caption={`${timeframe} timeframe`}
          />

          <StatCard
            label="BUY SIGNALS"
            value={buyCount.toString()}
            caption="bullish setups"
            accent="buy"
          />

          <StatCard
            label="SELL SIGNALS"
            value={sellCount.toString()}
            caption="bearish setups"
            accent="sell"
          />

          <StatCard
            label="STRONG SIGNALS"
            value={strongSignals.toString()}
            caption="high agreement"
            accent="rose"
          />
        </section>

        {error && (
          <section className="error-panel">
            <div className="error-icon">!</div>

            <div>
              <strong>SCANNER CONNECTION ERROR</strong>
              <p>{error}</p>
              <small>Make sure the backend is running on {API_URL}</small>
            </div>

            <button onClick={scan}>RETRY</button>
          </section>
        )}

        <section className="signals-header">
          <div>
            <div className="section-kicker">PRIMARY SIGNALS</div>
            <h2>Market opportunities</h2>
          </div>

          <div className="updated">
            <span className="live-pulse" />
            {lastUpdated
              ? `UPDATED ${lastUpdated.toLocaleTimeString()}`
              : "WAITING FOR DATA"}
          </div>
        </section>

        <section className="primary-signals">
          <SignalHeroCard
            type="BUY"
            result={topBuy}
            onDetails={setSelectedSignal}
          />

          <SignalHeroCard
            type="SELL"
            result={topSell}
            onDetails={setSelectedSignal}
          />
        </section>

        <section className="market-section">
          <div className="section-heading-row">
            <div>
              <div className="section-kicker">MARKET INTELLIGENCE</div>
              <h2>All active signals</h2>
            </div>

            <div className="result-count">{results.length} MARKETS</div>
          </div>

          <div className="market-table-wrapper">
            <table className="market-table">
              <thead>
                <tr>
                  <th>PAIR</th>
                  <th>SIGNAL</th>
                  <th>PRICE</th>
                  <th>SCORE</th>
                  <th>CONFIDENCE</th>
                  <th>RSI</th>
                  <th>STRENGTH</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {results
                  .slice()
                  .sort((a, b) => {
                    if (a.signal !== b.signal) {
                      if (a.signal === "BUY") return -1;
                      if (b.signal === "BUY") return 1;
                    }

                    return b.confidence - a.confidence;
                  })
                  .map((result) => (
                    <MarketRow
                      key={`${result.symbol}-${result.timeframe}`}
                      result={result}
                      onDetails={setSelectedSignal}
                    />
                  ))}
              </tbody>
            </table>

            {!loading && results.length === 0 && !error && (
              <div className="empty-state">NO MARKET SIGNALS AVAILABLE</div>
            )}

            {loading && (
              <div className="loading-state">
                <div className="loader" />
                <span>SCANNING BINANCE MARKETS...</span>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>VELORA TERMINAL</div>
        <div>TECHNICAL INTELLIGENCE · NOT FINANCIAL ADVICE</div>
        <div>v1.0.0</div>
      </footer>

      {selectedSignal && (
        <SignalModal
          result={selectedSignal}
          onClose={() => setSelectedSignal(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: string;
  caption: string;
  accent?: "buy" | "sell" | "rose";
}) {
  return (
    <div className={`stat-card ${accent ?? ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-caption">{caption}</div>
    </div>
  );
}

function SignalHeroCard({
  type,
  result,
  onDetails,
}: {
  type: "BUY" | "SELL";
  result: ScanResult | null;
  onDetails: (result: ScanResult) => void;
}) {
  const strength = result ? getStrength(result) : "WEAK";

  return (
    <article className={`signal-hero ${type.toLowerCase()}`}>
      <div className="signal-hero-glow" />

      <div className="signal-card-top">
        <div>
          <div className="signal-card-label">TOP {type}</div>

          <div className="signal-card-title">{result?.symbol ?? "—"}</div>
        </div>

        <div className="signal-badge">{type}</div>
      </div>

      {result ? (
        <>
          <div className="signal-main">
            <div className="signal-price">
              {formatPrice(result.currentPrice)}
            </div>

            <div className="signal-score">
              <span>SCORE</span>
              <strong>
                {result.score > 0 ? "+" : ""}
                {result.score}
              </strong>
            </div>
          </div>

          <div className="signal-metrics">
            <Metric label="CONFIDENCE" value={`${result.confidence}%`} />

            <Metric label="STRENGTH" value={strength} />

            <Metric
              label="R/R"
              value={
                result.riskRewardRatio
                  ? `1:${result.riskRewardRatio.toFixed(2)}`
                  : "—"
              }
            />
          </div>

          <div className="signal-footer">
            <div className="signal-timeframe">
              {result.timeframe} · Binance Spot
            </div>

            <button
              className="details-button"
              onClick={() => onDetails(result)}
            >
              VIEW SIGNAL
              <span>→</span>
            </button>
          </div>
        </>
      ) : (
        <div className="no-signal">
          <div className="no-signal-mark">—</div>
          <span>NO {type} SIGNAL AVAILABLE</span>
          <small>The scanner did not return a qualifying setup.</small>
        </div>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MarketRow({
  result,
  onDetails,
}: {
  result: ScanResult;
  onDetails: (result: ScanResult) => void;
}) {
  const strength = getStrength(result);

  return (
    <tr>
      <td>
        <div className="pair-cell">
          <span className="pair-symbol">{result.symbol}</span>
          <span className="pair-timeframe">{result.timeframe}</span>
        </div>
      </td>

      <td>
        <span className={`table-signal ${result.signal.toLowerCase()}`}>
          {result.signal}
        </span>
      </td>

      <td className="price-cell">{formatPrice(result.currentPrice)}</td>

      <td>
        <span
          className={
            result.score > 0
              ? "score positive"
              : result.score < 0
                ? "score negative"
                : "score"
          }
        >
          {result.score > 0 ? "+" : ""}
          {result.score}
        </span>
      </td>

      <td>
        <div className="confidence-cell">
          <div className="confidence-bar">
            <span
              style={{
                width: `${Math.min(result.confidence, 100)}%`,
              }}
            />
          </div>
          <span>{result.confidence}%</span>
        </div>
      </td>

      <td>{formatIndicator(result.rsi14, 2)}</td>

      <td>
        <span className={`strength ${strength.toLowerCase()}`}>{strength}</span>
      </td>

      <td>
        <button className="row-details" onClick={() => onDetails(result)}>
          →
        </button>
      </td>
    </tr>
  );
}

function SignalModal({
  result,
  onClose,
}: {
  result: ScanResult;
  onClose: () => void;
}) {
  const strength = getStrength(result);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="signal-modal">
        <div className="modal-glow" />

        <header className="modal-header">
          <div>
            <div className="modal-symbol">{result.symbol}</div>

            <div className="modal-timeframe">
              Binance Spot · {result.timeframe}
            </div>
          </div>

          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal-signal-row">
          <div className={`modal-signal ${result.signal.toLowerCase()}`}>
            {result.signal}
          </div>

          <div className="modal-score">
            <span>SCORE</span>
            <strong>
              {result.score > 0 ? "+" : ""}
              {result.score}
            </strong>
          </div>

          <div className="modal-strength">
            <span>STRENGTH</span>
            <strong>{strength}</strong>
          </div>

          <div className="modal-confidence">
            <span>INDICATOR CONFIDENCE</span>
            <strong>{result.confidence}%</strong>
          </div>
        </div>

        <ModalSection title="MARKET DATA">
          <DataGrid>
            <DataItem
              label="CURRENT PRICE"
              value={formatPrice(result.currentPrice)}
              highlight
            />

            <DataItem label="EMA 20" value={formatIndicator(result.ema20)} />

            <DataItem label="EMA 50" value={formatIndicator(result.ema50)} />

            <DataItem label="RSI 14" value={formatIndicator(result.rsi14, 2)} />

            <DataItem label="MACD" value={formatIndicator(result.macd, 6)} />

            <DataItem
              label="MACD SIGNAL"
              value={formatIndicator(result.macdSignal, 6)}
            />

            <DataItem
              label="MACD HISTOGRAM"
              value={formatIndicator(result.macdHistogram, 6)}
            />

            <DataItem label="ATR 14" value={formatIndicator(result.atr14)} />
          </DataGrid>
        </ModalSection>

        <ModalSection title="TRADE LEVELS">
          <div className="trade-levels">
            <TradeLevel label="ENTRY" value={formatPrice(result.entryPrice)} />

            <TradeLevel
              label="STOP LOSS"
              value={formatPrice(result.stopLoss)}
              danger={result.signal === "BUY"}
            />

            <TradeLevel
              label="TAKE PROFIT"
              value={formatPrice(result.takeProfit)}
              positive
            />

            <TradeLevel
              label="RISK / REWARD"
              value={
                result.riskRewardRatio
                  ? `1:${result.riskRewardRatio.toFixed(2)}`
                  : "—"
              }
            />
          </div>
        </ModalSection>

        <ModalSection title="SIGNAL REASONING">
          <div className="reasoning-list">
            {result.reasons.map((reason, index) => (
              <div className="reason" key={`${reason}-${index}`}>
                <span className="reason-number">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span>{reason}</span>
              </div>
            ))}
          </div>
        </ModalSection>

        <div className="warning-box">
          <div className="warning-mark">!</div>

          <div>
            <strong>INDICATOR CONFIDENCE</strong>

            <p>
              Indicator confidence is an agreement score between technical
              indicators. It is not a probability of profit and does not
              guarantee future price movement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="modal-section">
      <div className="modal-section-title">{title}</div>

      {children}
    </section>
  );
}

function DataGrid({ children }: { children: React.ReactNode }) {
  return <div className="data-grid">{children}</div>;
}

function DataItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="data-item">
      <span>{label}</span>

      <strong className={highlight ? "highlight" : ""}>{value}</strong>
    </div>
  );
}

function TradeLevel({
  label,
  value,
  danger,
  positive,
}: {
  label: string;
  value: string;
  danger?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`trade-level ${
        danger ? "danger" : ""
      } ${positive ? "positive" : ""}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
