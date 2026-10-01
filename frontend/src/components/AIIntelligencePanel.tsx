import type { CSSProperties } from "react";

type AIAnalyst = {
  action: "BUY" | "SELL" | "WAIT" | "AVOID";
  confidence: number;
  risk: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  upside: "LOW" | "MEDIUM" | "HIGH";
  downside: "LOW" | "MEDIUM" | "HIGH";
  marketView: string;
  bullCase: string;
  bearCase: string;
  thesis: string;
  risks: string[];
  whyDecision: string[];
  entryView: string;
  confirmation: string;
  invalidation: string;
  finalAssessment: string;
};

type Props = {
  analysis: any;
  symbol?: string;
};

const card: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 18,
  background: "rgba(255,255,255,0.025)",
};

function actionStyle(
  action: AIAnalyst["action"],
): CSSProperties {
  if (action === "BUY") {
    return {
      color: "#55e6a5",
      borderColor: "rgba(85,230,165,0.35)",
      background: "rgba(85,230,165,0.08)",
    };
  }

  if (action === "SELL") {
    return {
      color: "#ff7070",
      borderColor: "rgba(255,112,112,0.35)",
      background: "rgba(255,112,112,0.08)",
    };
  }

  if (action === "AVOID") {
    return {
      color: "#ff9d6c",
      borderColor: "rgba(255,157,108,0.35)",
      background: "rgba(255,157,108,0.08)",
    };
  }

  return {
    color: "#f0c96a",
    borderColor: "rgba(240,201,106,0.35)",
    background: "rgba(240,201,106,0.08)",
  };
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        ...card,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          opacity: 0.5,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 7,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 17,
          fontWeight: 750,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        ...card,
        borderColor: accent
          ? `${accent}45`
          : "rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontWeight: 750,
          textTransform: "uppercase",
          letterSpacing: 1.1,
          opacity: 0.58,
          marginBottom: 10,
        }}
      >
        {accent && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: accent,
              display: "inline-block",
            }}
          />
        )}

        {title}
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          opacity: 0.9,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function EvidenceList({
  items,
}: {
  items: string[];
}) {
  if (items.length === 0) {
    return (
      <div style={{ opacity: 0.55 }}>
        No material evidence is currently reported.
      </div>
    );
  }

  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: 19,
      }}
    >
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          style={{
            marginBottom: 7,
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function AIIntelligencePanel({
  analysis,
  symbol,
}: Props) {
  const analyst =
    analysis?.aiAnalyst as AIAnalyst | undefined;

  if (!analyst) {
    return (
      <section
        style={{
          ...card,
          marginTop: 20,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            opacity: 0.6,
          }}
        >
          VELORA AI ANALYST
        </div>

        <div
          style={{
            marginTop: 12,
            opacity: 0.6,
            fontSize: 14,
          }}
        >
          Select a ticker to generate its complete
          VELORA synthesis.
        </div>
      </section>
    );
  }

  const badge = actionStyle(analyst.action);

  const confidence = Number.isFinite(
    analyst.confidence,
  )
    ? Math.round(analyst.confidence)
    : 0;

  return (
    <section
      style={{
        marginTop: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 750,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              opacity: 0.5,
            }}
          >
            VELORA AI ANALYST
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            {symbol ?? "Selected Asset"}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              opacity: 0.45,
            }}
          >
            Evidence synthesis across existing VELORA layers
          </div>
        </div>

        <div
          style={{
            ...badge,
            border: "1px solid",
            borderRadius: 12,
            padding: "11px 22px",
            textAlign: "center",
            minWidth: 120,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 1,
            }}
          >
            {analyst.action}
          </div>

          <div
            style={{
              fontSize: 10,
              marginTop: 3,
              opacity: 0.75,
              letterSpacing: 0.8,
            }}
          >
            FINAL VIEW
          </div>
        </div>
      </div>

      {/* FINAL ASSESSMENT */}
      <div
        style={{
          ...card,
          borderColor: `${badge.color ?? "#ffffff"}35`,
          fontSize: 15,
          lineHeight: 1.6,
          fontWeight: 600,
        }}
      >
        {analyst.finalAssessment}
      </div>

      {/* DECISION METRICS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        <Metric
          label="Decision Confidence"
          value={`${confidence}%`}
        />

        <Metric
          label="Risk"
          value={analyst.risk}
        />

        <Metric
          label="Upside"
          value={analyst.upside}
        />

        <Metric
          label="Downside"
          value={analyst.downside}
        />
      </div>

      {/* THESIS */}
      <Section title="Thesis">
        {analyst.thesis}
      </Section>

      {/* MARKET */}
      <Section title="Market View">
        {analyst.marketView}
      </Section>

      {/* BULL / BEAR */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        <Section
          title="Bull Case"
          accent="#55e6a5"
        >
          {analyst.bullCase}
        </Section>

        <Section
          title="Bear Case"
          accent="#ff7070"
        >
          {analyst.bearCase}
        </Section>
      </div>

      {/* WHY */}
      <Section title="Why This Decision">
        <EvidenceList
          items={analyst.whyDecision ?? []}
        />
      </Section>

      {/* ENTRY / CONFIRMATION */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        <Section title="Entry View">
          {analyst.entryView}
        </Section>

        <Section title="Confirmation">
          {analyst.confirmation}
        </Section>
      </div>

      {/* INVALIDATION */}
      <Section
        title="Invalidation"
        accent="#ff9d6c"
      >
        {analyst.invalidation}
      </Section>

      {/* FOOTNOTE */}
      <div
        style={{
          padding: "4px 4px 0",
          fontSize: 10,
          lineHeight: 1.55,
          opacity: 0.38,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        Decision confidence reflects agreement and
        validation within existing VELORA layers. It is
        not a probability of profit and does not guarantee
        future price movement.
      </div>
    </section>
  );
}