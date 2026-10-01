
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import "./App.css";
import LiveChart from "./components/LiveChart";
import Auth from "./components/Auth";
import AIIntelligencePanel from "./components/AIIntelligencePanel";
import type {
  AIIntelligenceAnalysis,
  MarketIntelligence,
  ScanResult,
  ScannerResponse,
  SignalStrength,
} from "./types/api";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
  subscriptionPlan: "FREE" | "PRO";
  subscriptionStatus: "ACTIVE" | "CANCELED" | "EXPIRED";
  subscriptionExpiresAt: string | null;
}

const TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d"];

const CORE_COINS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOTUSDT",
];

function getResults(
  payload: ScannerResponse | ScanResult[],
): ScanResult[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.signals)) return payload.signals;
  return [];
}

function getStrength(result: ScanResult): SignalStrength {
  if (result.signalStrength) return result.signalStrength;

  const score = Math.abs(result.score);

  if (score >= 5) return "STRONG";
  if (score >= 3) return "MODERATE";
  return "WEAK";
}

function formatPrice(value: number | null | undefined): string {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (value >= 1) return `$${value.toFixed(4)}`;
  if (value >= 0.01) return `$${value.toFixed(6)}`;
  if (value >= 0.0001) return `$${value.toFixed(7)}`;

  return `$${value.toFixed(10)}`;
}

function formatIndicator(
  value: number | null | undefined,
  decimals = 4,
): string {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return value.toFixed(decimals);
}

function shortSymbol(symbol: string): string {
  return symbol.replace("USDT", "");
}

function calculateTrend(result: ScanResult): number {
  if (result.ema20 === null || result.ema50 === null) return 50;

  if (result.signal === "BUY") {
    return result.ema20 > result.ema50 ? 90 : 68;
  }

  if (result.signal === "SELL") {
    return result.ema20 < result.ema50 ? 90 : 68;
  }

  return 50;
}

function calculateMomentum(result: ScanResult): number {
  if (result.rsi14 === null) return 50;

  const distance = Math.abs(result.rsi14 - 50);
  return Math.min(96, Math.round(50 + distance * 1.4));
}

function calculateMacdStrength(result: ScanResult): number {
  if (
    result.macd === null ||
    result.macdSignal === null
  ) {
    return 50;
  }

  const aligned =
    result.signal === "BUY"
      ? result.macd > result.macdSignal
      : result.signal === "SELL"
        ? result.macd < result.macdSignal
        : false;

  return aligned ? 88 : 48;
}

function calculateStructure(result: ScanResult): number {
  const trend = calculateTrend(result);
  const macd = calculateMacdStrength(result);
  return Math.round((trend + macd + result.confidence) / 3);
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem("velora_user");

    if (!saved) return null;

    try {
      return JSON.parse(saved) as AuthUser;
    } catch {
      localStorage.removeItem("velora_user");
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("velora_token"),
  );

  const isPro = user?.subscriptionPlan === "PRO";

  const [results, setResults] = useState<ScanResult[]>([]);
  const [intelligence, setIntelligence] =
    useState<MarketIntelligence | null>(null);

  const [aiAnalyses, setAiAnalyses] =
    useState<Record<string, AIIntelligenceAnalysis>>({});

  const [timeframe, setTimeframe] = useState("1h");
  const [limit, setLimit] = useState(60);
  const [selectedSymbol, setSelectedSymbol] =
    useState("BTCUSDT");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const [selectedSignal, setSelectedSignal] =
    useState<ScanResult | null>(null);

  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleLogin = (
    loggedInUser: AuthUser,
    authToken: string,
  ) => {
    localStorage.setItem(
      "velora_user",
      JSON.stringify(loggedInUser),
    );
    localStorage.setItem("velora_token", authToken);

    setUser(loggedInUser);
    setToken(authToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("velora_user");
    localStorage.removeItem("velora_token");

    setUser(null);
    setToken(null);
  };

  const analyzeWithAI = useCallback(
    async (
      result: ScanResult,
      market: MarketIntelligence,
    ) => {
      console.log("[VELORA AI REQUEST]", {
        symbol: result.symbol,
        timeframe: result.timeframe,
        price: result.currentPrice,
        signal: result.signal,
        confidence: result.confidence,
      });

      try {
        const response = await fetch(
          `${API_URL}/api/ai-intelligence/analyze`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              result,
              market,
            }),
          },
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              `AI returned HTTP ${response.status}`,
          );
        }

        if (payload?.analysis) {
          setAiAnalyses((prev) => ({
            ...prev,
            [result.symbol]: payload.analysis as AIIntelligenceAnalysis,
          }));
        }
      } catch (err) {
        console.warn(
          "AI intelligence unavailable:",
          err,
        );

        setAiAnalyses((prev) => {
          const next = { ...prev };
          delete next[result.symbol];
          return next;
        });
      }
    },
    [],
  );

  const scan = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/scanner?interval=${encodeURIComponent(
          timeframe,
        )}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        if (
          response.status === 403 &&
          payload?.code === "PRO_REQUIRED"
        ) {
          setShowUpgrade(true);
          throw new Error(
            "This timeframe requires a PRO subscription.",
          );
        }

        if (
          response.status === 429 &&
          payload?.code === "FREE_SCAN_LIMIT_REACHED"
        ) {
          setShowUpgrade(true);
          throw new Error(
            `Daily free scan limit reached: ${
              payload.limit ?? 10
            } scans.`,
          );
        }

        if (response.status === 401) {
          handleLogout();
          return;
        }

        throw new Error(
          payload?.error ||
            `Scanner returned HTTP ${response.status}`,
        );
      }

      const scannerPayload =
        payload as ScannerResponse | ScanResult[];

      const nextResults = getResults(scannerPayload);

      setResults(nextResults);

      if (
        !Array.isArray(scannerPayload) &&
        scannerPayload.intelligence
      ) {
        setIntelligence(scannerPayload.intelligence);
      } else {
        setIntelligence(null);
      }

      setAiAnalyses({});

      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to scanner.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    timeframe,
    limit,
    token,
  ]);

  const selectSignal = useCallback(
    async (result: ScanResult) => {
      console.log("[VELORA SELECTED SIGNAL]", {
        symbol: result.symbol,
        timeframe: result.timeframe,
        signal: result.signal,
        score: result.score,
        confidence: result.confidence,
      });

      setSelectedSignal(result);
      setSelectedSymbol(result.symbol);

      if (intelligence) {
        await analyzeWithAI(result, intelligence);
      }
    },
    [intelligence, analyzeWithAI],
  );

  useEffect(() => {
    if (user && token) {
      scan();
    }
  }, [scan, user, token]);

  useEffect(() => {
    if (!selectedSymbol || !intelligence) return;

    const selectedResult = results.find(
      (item) => item.symbol === selectedSymbol,
    );

    if (!selectedResult) return;

    analyzeWithAI(
      selectedResult,
      intelligence,
    );
  }, [
    selectedSymbol,
    results,
    intelligence,
    analyzeWithAI,
  ]);

  const buySignals = useMemo(
    () =>
      results
        .filter((item) => item.signal === "BUY")
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.confidence - a.confidence,
        ),
    [results],
  );

  const sellSignals = useMemo(
    () =>
      results
        .filter((item) => item.signal === "SELL")
        .sort(
          (a, b) =>
            a.score - b.score ||
            b.confidence - a.confidence,
        ),
    [results],
  );

  const strongSignals = results.filter(
    (item) => getStrength(item) === "STRONG",
  ).length;

  const bullishPercentage =
    intelligence?.breadth.bullishPercentage ??
    (results.length
      ? Math.round(
          (buySignals.length / results.length) * 100,
        )
      : 0);

  const bearishPercentage =
    intelligence?.breadth.bearishPercentage ??
    (results.length
      ? Math.round(
          (sellSignals.length / results.length) * 100,
        )
      : 0);

  const neutralPercentage =
    intelligence?.breadth.neutralPercentage ??
    Math.max(
      0,
      100 - bullishPercentage - bearishPercentage,
    );

  const marketRegime =
    intelligence?.regime ??
    (bullishPercentage >= bearishPercentage + 15
      ? "BULLISH"
      : bearishPercentage >= bullishPercentage + 15
        ? "BEARISH"
        : "MIXED");

  const marketOpinion =
    intelligence?.opinion ??
    (marketRegime === "BULLISH"
      ? "Upside setups currently dominate the scanned market."
      : marketRegime === "BEARISH"
        ? "Downside setups currently dominate the scanned market."
        : "Directional conviction remains fragmented across the market.");

  const recommendedAction =
    intelligence?.recommendedAction ??
    (marketRegime === "BULLISH"
      ? "FOCUS ON HIGH-CONVICTION LONG SETUPS"
      : marketRegime === "BEARISH"
        ? "FOCUS ON HIGH-CONVICTION SHORT SETUPS"
        : "WAIT FOR STRONGER DIRECTIONAL CONFIRMATION");

const marketConfidence =
  intelligence?.confidence ??
  Math.round(
    results.length
      ? results.reduce(
          (sum, item) =>
            sum +
            (item.context?.finalConfidence ??
              item.confidence),
          0,
        ) / results.length
      : 0,
  );

  const topSignals = useMemo(() => {
  return [...results]
    .sort(
      (a, b) =>
        (b.context?.finalConfidence ?? b.confidence) -
          (a.context?.finalConfidence ?? a.confidence) ||
        Math.abs(b.score) - Math.abs(a.score),
    )
    .slice(0, 6);
}, [results]);

  const marketPulse = useMemo(() => {
    return CORE_COINS.map((symbol) => {
      const result = results.find(
        (item) => item.symbol === symbol,
      );

      return {
        symbol,
        result: result ?? null,
      };
    });
  }, [results]);

  if (!user || !token) {
    return <Auth onLogin={handleLogin} />;
  }

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
            <div className="brand-subtitle">
              MARKET INTELLIGENCE
            </div>
          </div>
        </div>

        <div className="topbar-center">
          <div className="terminal-status">
            <span className="status-dot" />
            LIVE MARKET SCANNER
          </div>

          <div className="exchange-label">
            BINANCE · SPOT
          </div>
        </div>

        <div className="account-panel">
          <div className="account-identity">
            <span className="account-plan">
              {isPro ? "PRO" : "FREE"}
            </span>

            <span className="account-email">
              {user.email}
            </span>
          </div>

          {!isPro && (
            <button
              className="account-upgrade"
              onClick={() => setShowUpgrade(true)}
            >
              UPGRADE
            </button>
          )}

          <button
            className="account-logout"
            onClick={handleLogout}
          >
            LOGOUT
          </button>

          <button
            className="account-refresh"
            onClick={scan}
            disabled={loading}
          >
            <span className={loading ? "spin" : ""}>
              ↻
            </span>
          </button>
        </div>
      </header>

      <nav className="terminal-nav" aria-label="Terminal navigation">
        <a href="#overview">OVERVIEW</a>
        <a href="#market">MARKET</a>
        <a href="#signals">SIGNALS</a>
        <a href="#chart">CHART</a>
        <a href="#setups">SETUPS</a>
      </nav>

      <main className="main-content">
        <section id="overview" className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              VELORA / INTELLIGENCE TERMINAL
            </div>

            <h1>
              Read the market
              <span>before the signal.</span>
            </h1>

            <p>
              A multi-indicator intelligence layer designed
              to turn market structure, momentum and signal
              agreement into a single readable view.
            </p>
          </div>

          <div className="scanner-controls">
            <div className="control-block">
              <span className="control-label">
                TIMEFRAME
              </span>

              <div className="timeframe-list">
                {TIMEFRAMES.map((item) => {
                  const locked = !isPro && item !== "1h";

                  return (
                    <button
                      key={item}
                      className={`timeframe ${
                        timeframe === item ? "active" : ""
                      } ${locked ? "locked" : ""}`}
                      onClick={() => {
                        if (locked) {
                          setShowUpgrade(true);
                          return;
                        }

                        setTimeframe(item);
                      }}
                    >
                      {item}
                      {locked && (
                        <span className="lock-icon">
                          ◆
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="limit-control">
              <span>CANDLES</span>

              <select
                value={limit}
                onChange={(event) =>
                  setLimit(Number(event.target.value))
                }
              >
                <option value={60}>60</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>

            <button
              className="scan-market-button"
              onClick={scan}
              disabled={loading}
            >
              <span className={loading ? "spin" : ""}>
                ↻
              </span>
              {loading ? "SCANNING..." : "SCAN MARKET"}
            </button>
          </div>
        </section>

        <section id="market" className="intelligence-core">
          <div className="core-main">
            <div className="section-kicker">
              VELORA INTELLIGENCE CORE
            </div>

            <div className="core-title-row">
              <h2>MARKET REGIME</h2>

              <span
                className={`regime-badge ${marketRegime.toLowerCase()}`}
              >
                <i />
                {marketRegime}
              </span>
            </div>

            <p className="core-opinion">
              {marketOpinion}
            </p>

            <div className="core-action">
              <span>RECOMMENDED ACTION</span>
              <strong>{recommendedAction}</strong>
            </div>
          </div>

          <div className="core-confidence">
            <div className="confidence-ring">
              <div>
                <strong>{marketConfidence}</strong>
                <span>%</span>
              </div>
            </div>

            <span>CONVICTION</span>
          </div>

          <div className="core-metrics">
            <IntelligenceMetric
              label="BULLISH"
              value={`${bullishPercentage}%`}
              percentage={bullishPercentage}
              tone="positive"
            />

            <IntelligenceMetric
              label="BEARISH"
              value={`${bearishPercentage}%`}
              percentage={bearishPercentage}
              tone="negative"
            />

            <IntelligenceMetric
              label="NEUTRAL"
              value={`${neutralPercentage}%`}
              percentage={neutralPercentage}
              tone="neutral"
            />

            <IntelligenceMetric
              label="STRONG SIGNALS"
              value={String(strongSignals)}
              percentage={Math.min(
                100,
                strongSignals * 10,
              )}
              tone="accent"
            />
          </div>
        </section>

        <section className="pulse-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                MARKET PULSE
              </span>
              <h2>Cross-market pressure</h2>
            </div>

            <div className="updated-indicator">
              <span />
              {lastUpdated
                ? lastUpdated.toLocaleTimeString()
                : "WAITING"}
            </div>
          </div>

          <div className="pulse-grid">
            {marketPulse.map(({ symbol, result }) => (
              <PulseCard
                key={symbol}
                symbol={symbol}
                result={result}
                onClick={() => {
                  setSelectedSymbol(symbol);
                  window.scrollTo({
                    top: document.body.scrollHeight,
                    behavior: "smooth",
                  });
                }}
              />
            ))}
          </div>
        </section>

        <section className="market-map-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                MARKET MAP
              </span>
              <h2>Signal landscape</h2>
            </div>

            <span className="map-caption">
              {results.length} ASSETS SCANNED
            </span>
          </div>

          <div className="market-map">
            <div className="map-axis-label map-top">
              BULLISH PRESSURE
            </div>

            <div className="map-axis-label map-bottom">
              BEARISH PRESSURE
            </div>

            <div className="map-center">
              MARKET
              <span>NEUTRAL ZONE</span>
            </div>

            <div className="map-horizontal" />
            <div className="map-vertical" />

            {topSignals.map((result, index) => (
              <MarketNode
                key={`${result.symbol}-${index}`}
                result={result}
                index={index}
                onClick={() => selectSignal(result)}
              />
            ))}
          </div>
        </section>

        <section id="chart" className="chart-section">
          <LiveChart
            symbol={selectedSymbol}
            interval={timeframe}
            onSymbolChange={setSelectedSymbol}
          />
        </section>

        <section id="setups" className="signal-dna-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                SIGNAL DNA
              </span>
              <h2>Why the market is moving</h2>
            </div>

            <span className="map-caption">
              TOP CONVICTION SETUPS
            </span>
          </div>

          <div className="dna-grid">
            {topSignals.slice(0, 3).map((result) => (
              <SignalDNA
                key={result.symbol}
                result={result}
                onDetails={() => selectSignal(result)}
              />
            ))}
          </div>
        </section>

        {error && (
          <section className="error-panel">
            <div className="error-icon">!</div>

            <div>
              <strong>SCANNER CONNECTION ERROR</strong>
              <p>{error}</p>
            </div>

            <button onClick={scan}>RETRY</button>
          </section>
        )}

        <section id="signals" className="signals-table-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                TERMINAL DATA
              </span>
              <h2>All active signals</h2>
            </div>

            <span className="map-caption">
              {results.length} MARKETS
            </span>
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
                  <th>DECISION</th>
                  <th>PRIORITY</th>
                  <th>RSI</th>
                  <th>STRENGTH</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {results
                  .slice()
                  .sort(
                    (a, b) =>
                      (b.decision?.decisionScore ??
                        Math.abs(b.score)) -
                      (a.decision?.decisionScore ??
                        Math.abs(a.score)),
                  )
                  .map((result) => (
                    <MarketRow
                      key={`${result.symbol}-${result.timeframe}`}
                      result={result}
                      onDetails={selectSignal}
                    />
                  ))}
              </tbody>
            </table>

            {!loading &&
              results.length === 0 &&
              !error && (
                <div className="empty-state">
                  NO MARKET SIGNALS AVAILABLE
                </div>
              )}

            {loading && (
              <div className="loading-state">
                <div className="loader" />
                SCANNING BINANCE MARKETS
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>VELORA TERMINAL</span>
        <span>
          TECHNICAL INTELLIGENCE · NOT FINANCIAL ADVICE
        </span>
        <span>v1.0.0</span>
      </footer>

      {selectedSignal && (
        <SignalModal
          result={selectedSignal}
          analysis={aiAnalyses[selectedSignal.symbol] ?? null}
          onClose={() => setSelectedSignal(null)}
        />
      )}

      {showUpgrade && (
        <UpgradeModal
          token={token}
          onActivated={(updatedUser) => {
            localStorage.setItem(
              "velora_user",
              JSON.stringify(updatedUser),
            );
            setUser(updatedUser);
          }}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}

function IntelligenceMetric({
  label,
  value,
  percentage,
  tone,
}: {
  label: string;
  value: string;
  percentage: number;
  tone: "positive" | "negative" | "neutral" | "accent";
}) {
  return (
    <div className="intelligence-metric">
      <div className="metric-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div className="metric-track">
        <i
          className={tone}
          style={{
            width: `${Math.min(100, Math.max(0, percentage))}%`,
          }}
        />
      </div>
    </div>
  );
}

function PulseCard({
  symbol,
  result,
  onClick,
}: {
  symbol: string;
  result: ScanResult | null;
  onClick: () => void;
}) {
  const signal = result?.signal ?? "NEUTRAL";
  const strength = result ? getStrength(result) : "WEAK";

  return (
    <button
      className={`pulse-card ${signal.toLowerCase()}`}
      onClick={onClick}
    >
      <div className="pulse-card-top">
        <span>{shortSymbol(symbol)}</span>

        <i
          className={`pulse-direction ${signal.toLowerCase()}`}
        >
          {signal === "BUY"
            ? "↑"
            : signal === "SELL"
              ? "↓"
              : "—"}
        </i>
      </div>

      <strong>
        {result ? formatPrice(result.currentPrice) : "—"}
      </strong>

      <div className="pulse-card-bottom">
        <span>{result ? `${result.confidence}%` : "—"}</span>
        <span>{strength}</span>
      </div>
    </button>
  );
}

function MarketNode({
  result,
  index,
  onClick,
}: {
  result: ScanResult;
  index: number;
  onClick: () => void;
}) {
  const positive = result.signal === "BUY";

  const left =
    12 +
    ((index * 19) % 70);

  const top = positive
    ? 12 + ((index * 23) % 31)
    : 58 + ((index * 17) % 27);

  const size = 42 + Math.min(24, Math.abs(result.score) * 3);

  return (
    <button
      className={`market-node ${result.signal.toLowerCase()}`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: size,
        height: size,
      }}
      onClick={onClick}
      title={result.symbol}
    >
      <span>{shortSymbol(result.symbol)}</span>
      <small>{result.confidence}</small>
    </button>
  );
}

function SignalDNA({
  result,
  onDetails,
}: {
  result: ScanResult;
  onDetails: () => void;
}) {
  const trend = calculateTrend(result);
  const momentum = calculateMomentum(result);
  const macd = calculateMacdStrength(result);
  const structure = calculateStructure(result);

  const contextConfidence =
    result.context?.finalConfidence ??
    result.confidence;

  const contextDecision =
    result.context?.decision ??
    "WAIT";

  const contextQuality =
    result.context?.setupQuality ??
    "CAUTION";

  const decisionScore =
    result.decision?.decisionScore ??
    contextConfidence;

  const decisionPriority =
    result.decision?.priority ??
    "LOW";

  return (
    <article className="dna-card">
      <div className="dna-header">
        <div>
          <span className="dna-kicker">SETUP</span>
          <h3>{shortSymbol(result.symbol)}</h3>
        </div>

        <div
  className={`dna-signal ${
    (result.context?.finalSignal ?? result.signal).toLowerCase()
  }`}
>
  {result.context?.finalSignal ?? result.signal}
</div>
      </div>

   <div className="dna-score">
  <span>CONVICTION</span>
  <strong>{contextConfidence}%</strong>
</div>

      <div className="dna-context-status">
        <span>{contextQuality}</span>
        <strong>{contextDecision}</strong>
      </div>

      <div className="dna-context-status">
        <span>DECISION SCORE</span>
        <strong>{decisionScore}</strong>
      </div>

      <div className="dna-context-status">
        <span>PRIORITY</span>
        <strong>{decisionPriority}</strong>
      </div>

      <div className="dna-bars">
        <DNABar label="TREND" value={trend} />
        <DNABar label="MOMENTUM" value={momentum} />
        <DNABar label="MACD" value={macd} />
        <DNABar label="STRUCTURE" value={structure} />
      </div>

      <div className="dna-footer">
        <span>
          {formatPrice(result.currentPrice)}
        </span>

        <button onClick={onDetails}>
          ANALYZE →
        </button>
      </div>
    </article>
  );
}

function DNABar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="dna-bar-row">
      <span>{label}</span>

      <div className="dna-track">
        <i style={{ width: `${value}%` }} />
      </div>

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

  const finalSignal =
    result.context?.finalSignal ??
    result.signal;

  const finalConfidence =
    result.context?.finalConfidence ??
    result.confidence;

  const decisionPriority =
    result.decision?.priority ??
    "LOW";

  const decisionScore =
    result.decision?.decisionScore ??
    0;

  return (
    <tr>
      <td>
        <div className="pair-cell">
          <span className="pair-symbol">
            {result.symbol}
          </span>

          <span className="pair-timeframe">
            {result.timeframe}
          </span>
        </div>
      </td>

      <td>
        <span
          className={`table-signal ${finalSignal.toLowerCase()}`}
        >
          {finalSignal}
        </span>
      </td>

      <td className="price-cell">
        {formatPrice(result.currentPrice)}
      </td>

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
                width: `${Math.min(
                  finalConfidence,
                  100,
                )}%`,
              }}
            />
          </div>

          <span>{finalConfidence}%</span>
        </div>
      </td>

      <td>
        <span className="decision-score">
          {decisionScore}
        </span>
      </td>

      <td>
        <span
          className={`decision-priority ${decisionPriority.toLowerCase()}`}
        >
          {decisionPriority}
        </span>
      </td>

      <td>
        {formatIndicator(result.rsi14, 2)}
      </td>

      <td>
        <span
          className={`strength ${strength.toLowerCase()}`}
        >
          {strength}
        </span>
      </td>

      <td>
        <button
          className="row-details"
          onClick={() => onDetails(result)}
        >
          →
        </button>
      </td>
    </tr>
  );
}

function SignalModal({
  result,
  onClose,
  analysis,
}: {
  result: ScanResult;
  onClose: () => void;
  analysis: AIIntelligenceAnalysis | null;
}) {
  const strength = getStrength(result);

  const finalSignal =
    result.context?.finalSignal ??
    result.signal;

  const finalConfidence =
    result.context?.finalConfidence ??
    result.confidence;

  const setupQuality =
    result.context?.setupQuality ??
    "CAUTION";

  const contextDecision =
    result.context?.decision ??
    "WAIT";

  const decisionScore =
    result.decision?.decisionScore ??
    0;

  const decisionPriority =
    result.decision?.priority ??
    "LOW";

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
        <header className="modal-header">
          <div>
            <div className="modal-symbol">
              {result.symbol}
            </div>

            <div className="modal-timeframe">
              Binance Spot · {result.timeframe}
            </div>
          </div>

          <button
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="modal-signal-row">
          <div
            className={`modal-signal ${finalSignal.toLowerCase()}`}
          >
            {finalSignal}
          </div>

          <div className="modal-score">
            <span>SCORE</span>
            <strong>
              {result.score > 0 ? "+" : ""}
              {result.score}
            </strong>
          </div>

          <div className="modal-confidence">
            <span>CONFIDENCE</span>
            <strong>{finalConfidence}%</strong>
          </div>

          <div className="modal-confidence">
            <span>STRENGTH</span>
            <strong>{strength}</strong>
          </div>
        </div>

        <div className="dna-context-status">
          <span>SETUP QUALITY</span>
          <strong>{setupQuality}</strong>
        </div>

        <div className="dna-context-status">
          <span>DECISION</span>
          <strong>{contextDecision}</strong>
        </div>

        <div className="dna-context-status">
          <span>DECISION SCORE</span>
          <strong>{decisionScore}</strong>
        </div>

        <div className="dna-context-status">
          <span>PRIORITY</span>
          <strong>{decisionPriority}</strong>
        </div>

        <ModalSection title="MARKET DATA">
          <DataGrid>
            <DataItem
              label="CURRENT PRICE"
              value={formatPrice(result.currentPrice)}
              highlight
            />
            <DataItem
              label="EMA 20"
              value={formatIndicator(result.ema20)}
            />
            <DataItem
              label="EMA 50"
              value={formatIndicator(result.ema50)}
            />
            <DataItem
              label="RSI 14"
              value={formatIndicator(result.rsi14, 2)}
            />
            <DataItem
              label="MACD"
              value={formatIndicator(result.macd, 6)}
            />
            <DataItem
              label="MACD SIGNAL"
              value={formatIndicator(
                result.macdSignal,
                6,
              )}
            />
            <DataItem
              label="MACD HISTOGRAM"
              value={formatIndicator(
                result.macdHistogram,
                6,
              )}
            />
            <DataItem
              label="ATR 14"
              value={formatIndicator(result.atr14)}
            />
          </DataGrid>
        </ModalSection>

        <ModalSection title="TRADE LEVELS">
          <div className="trade-levels">
            <TradeLevel
              label="ENTRY"
              value={formatPrice(result.entryPrice)}
            />
            <TradeLevel
              label="STOP LOSS"
              value={formatPrice(result.stopLoss)}
              danger
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
              <div
                className="reason"
                key={`${reason}-${index}`}
              >
                <span className="reason-number">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span>{reason}</span>
              </div>
            ))}
          </div>
        </ModalSection>

        <AIIntelligencePanel
          analysis={analysis}
          symbol={result.symbol}
        />

        <div className="warning-box">
          <strong>INDICATOR CONFIDENCE</strong>
          <p>
            Confidence represents agreement between
            technical indicators. It is not a probability
            of profit and does not guarantee future price
            movement.
          </p>
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
  children: ReactNode;
}) {
  return (
    <section className="modal-section">
      <div className="modal-section-title">
        {title}
      </div>
      {children}
    </section>
  );
}

function DataGrid({
  children,
}: {
  children: ReactNode;
}) {
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
      <strong className={highlight ? "highlight" : ""}>
        {value}
      </strong>
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

function UpgradeModal({
  onClose,
  token,
  onActivated,
}: {
  onClose: () => void;
  token: string;
  onActivated: (user: AuthUser) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activateTrial = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/subscription/trial`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Unable to activate PRO.",
        );
      }

      onActivated(payload.user);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to activate PRO.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="upgrade-modal">
        <button
          className="close-button"
          onClick={onClose}
        >
          ×
        </button>

        <span className="upgrade-kicker">
          VELORA PRO
        </span>

        <h2>
          Unlock the full
          <span> intelligence layer.</span>
        </h2>

        <p>
          Access every timeframe, expanded market
          coverage and the complete VELORA scanner.
        </p>

        <div className="pricing-comparison">
          <div className="pricing-card free-plan">
            <span className="pricing-card-label">
              FREE
            </span>

            <strong>$0</strong>
            <small>forever</small>

            <div className="pricing-divider" />

            <div className="pricing-features">
              <div>✓ 1 timeframe</div>
              <div>✓ Limited scanning</div>
              <div>✓ Basic signals</div>
              <div>✓ Technical indicators</div>
            </div>

            <div className="current-plan">
              CURRENT PLAN
            </div>
          </div>

          <div className="pricing-card pro-plan">
            <span className="pro-label">
              3-DAY ACCESS
            </span>

            <span className="pricing-card-label">
              PRO
            </span>

            <strong>$1.99</strong>
            <small>one-time</small>

            <div className="pricing-divider" />

            <div className="pricing-features">
              <div>✓ All timeframes</div>
              <div>✓ Full market coverage</div>
              <div>✓ Unlimited scanning</div>
              <div>✓ Advanced intelligence</div>
              <div>✓ Full signal access</div>
            </div>

            <button
              className="upgrade-submit"
              onClick={activateTrial}
              disabled={loading}
            >
              {loading
                ? "ACTIVATING..."
                : "GET 3 DAYS PRO"}
              <span>→</span>
            </button>

            {error && (
              <div className="pricing-error">
                {error}
              </div>
            )}
          </div>
        </div>

        <small className="pricing-note">
          One-time $1.99 payment. No automatic renewal.
        </small>
      </div>
    </div>
  );
}

export default App;

