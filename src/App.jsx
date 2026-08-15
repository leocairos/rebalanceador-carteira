import React, { useState, useMemo } from "react";

const PALETTE = ["#5B8DEF", "#34C795", "#E2793F", "#C77DFF", "#F2C14E", "#4EC5F1", "#F17EAA"];

const COLORS = {
  bg: "#0B0F14",
  panel: "#12181F",
  panelAlt: "#0F151B",
  border: "#212B35",
  borderSoft: "#1A222B",
  text: "#E7ECF2",
  muted: "#7E8FA1",
  mutedSoft: "#586573",
  buy: "#34C795",
  buyDim: "#1E4A3C",
  sell: "#E2793F",
  sellDim: "#4A2F1E",
  warn: "#F2C14E",
};

const fmtUSD = (n) =>
  (isFinite(n) ? n : 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const fmtBRL = (n) =>
  (isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const fmtPct = (n) => `${(isFinite(n) ? n : 0).toFixed(1)}%`;

let nextId = 6;

const DEFAULT_ASSETS = [
  { id: 1, name: "Ações BR", value: 3400, target: 25 },
  { id: 2, name: "Renda Fixa", value: 6000, target: 35 },
  { id: 3, name: "Fundos Imobiliários", value: 1700, target: 15 },
  { id: 4, name: "Internacional", value: 1100, target: 15 },
  { id: 5, name: "Caixa / Reserva", value: 1900, target: 10 },
];

export default function PortfolioRebalancer() {
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [aporte, setAporte] = useState({
    valor: 1000,
    moeda: "BRL",
    cotacao: 5.35,
    objetivo: "reajustar",
  });

  const totalValue = useMemo(() => assets.reduce((s, a) => s + (Number(a.value) || 0), 0), [assets]);
  const totalTarget = useMemo(() => assets.reduce((s, a) => s + (Number(a.target) || 0), 0), [assets]);

  const rows = useMemo(() => {
    return assets.map((a, i) => {
      const value = Number(a.value) || 0;
      const target = Number(a.target) || 0;
      const currentPct = totalValue > 0 ? (value / totalValue) * 100 : 0;
      const targetValue = (target / 100) * totalValue;
      const diff = targetValue - value;
      return {
        ...a,
        value,
        target,
        currentPct,
        targetValue,
        diff,
        color: PALETTE[i % PALETTE.length],
      };
    });
  }, [assets, totalValue]);

  const maxAbsDiff = useMemo(() => rows.reduce((m, r) => Math.max(m, Math.abs(r.diff)), 0), [rows]);
  const totalDrift = useMemo(
    () => rows.reduce((s, r) => s + Math.abs(r.currentPct - r.target), 0) / 2,
    [rows]
  );
  const isBalanced = totalDrift < 1.5;
  const targetOff = Math.abs(totalTarget - 100) > 0.05;

  // ---- Aporte (contribution) math ----
  const aporteValorNum = Number(aporte.valor) || 0;
  const cotacaoNum = Number(aporte.cotacao) || 0;
  const cotacaoValida = cotacaoNum > 0;
  const aporteUSD = aporte.moeda === "USD" ? aporteValorNum : cotacaoValida ? aporteValorNum / cotacaoNum : 0;
  const aporteBRL = aporte.moeda === "BRL" ? aporteValorNum : aporteValorNum * cotacaoNum;
  const newTotalValue = totalValue + aporteUSD;

  const aporteRows = useMemo(() => {
    if (aporteUSD <= 0) {
      return rows.map((r) => ({ ...r, alloc: 0 }));
    }
    if (aporte.objetivo === "manter") {
      return rows.map((r) => {
        const share = totalValue > 0 ? r.value / totalValue : rows.length ? 1 / rows.length : 0;
        return { ...r, alloc: share * aporteUSD };
      });
    }
    // objetivo === 'reajustar': cobre déficits em relação à meta, sem vender nada
    const newTotal = totalValue + aporteUSD;
    const targetVals = rows.map((r) => (r.target / 100) * newTotal);
    const deficits = rows.map((r, i) => Math.max(0, targetVals[i] - r.value));
    const totalDeficit = deficits.reduce((s, d) => s + d, 0);
    const totalTargetWeight = totalTarget > 0 ? totalTarget : rows.length ? 100 : 0;

    let allocs;
    if (totalDeficit <= 0) {
      allocs = rows.map((r) => (totalTargetWeight > 0 ? (r.target / totalTargetWeight) * aporteUSD : 0));
    } else if (aporteUSD <= totalDeficit) {
      allocs = deficits.map((d) => (totalDeficit > 0 ? (d / totalDeficit) * aporteUSD : 0));
    } else {
      const remaining = aporteUSD - totalDeficit;
      allocs = rows.map(
        (r, i) => deficits[i] + (totalTargetWeight > 0 ? (r.target / totalTargetWeight) * remaining : 0)
      );
    }
    return rows.map((r, i) => ({ ...r, alloc: allocs[i] }));
  }, [rows, aporteUSD, aporte.objetivo, totalValue, totalTarget]);

  const maxAlloc = useMemo(() => aporteRows.reduce((m, r) => Math.max(m, r.alloc), 0), [aporteRows]);

  function updateAsset(id, field, raw) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: raw } : a)));
  }

  function addAsset() {
    nextId += 1;
    setAssets((prev) => [...prev, { id: nextId, name: "Novo ativo", value: 0, target: 0 }]);
  }

  function removeAsset(id) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  function autoNormalizeTargets() {
    if (totalTarget <= 0) return;
    setAssets((prev) =>
      prev.map((a) => ({
        ...a,
        target: Math.round(((Number(a.target) || 0) / totalTarget) * 1000) / 10,
      }))
    );
  }

  return (
    <div
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
        minHeight: "100%",
        width: "100%",
        boxSizing: "border-box",
      }}
      className="rb-page"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        .rb-page { padding: 32px 16px; }
        @media (min-width: 640px) { .rb-page { padding: 32px; } }
        .rb-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        .rb-input {
          background: ${COLORS.panelAlt};
          border: 1px solid ${COLORS.border};
          color: ${COLORS.text};
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 13px;
          width: 100%;
          outline: none;
          transition: border-color .15s ease;
        }
        .rb-input:focus { border-color: ${COLORS.muted}; }
        .rb-input::-webkit-outer-spin-button, .rb-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .rb-row:hover .rb-remove { opacity: 1; }
        .rb-remove { opacity: 0; transition: opacity .15s ease; }
        .rb-btn {
          background: ${COLORS.panelAlt};
          border: 1px solid ${COLORS.border};
          color: ${COLORS.text};
          border-radius: 6px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all .15s ease;
        }
        .rb-btn:hover { border-color: ${COLORS.muted}; background: ${COLORS.border}; }
        .rb-seg {
          display: inline-flex;
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          overflow: hidden;
        }
        .rb-seg button {
          background: ${COLORS.panelAlt};
          color: ${COLORS.muted};
          border: none;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all .15s ease;
        }
        .rb-seg button + button { border-left: 1px solid ${COLORS.border}; }
        .rb-seg button.active { background: ${COLORS.border}; color: ${COLORS.text}; }
        .rb-seg button:hover:not(.active) { color: ${COLORS.text}; }
        .rb-label {
          font-size: 11px;
          color: ${COLORS.mutedSoft};
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 6px;
          display: block;
        }
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div
            className="rb-mono"
            style={{ fontSize: 11, letterSpacing: "0.18em", color: COLORS.muted, textTransform: "uppercase", marginBottom: 8 }}
          >
            Simulador de alocação · carteira em USD
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
            Rebalanceador de carteira
          </h1>
          <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 6, maxWidth: 620 }}>
            Ajuste valores atuais e pesos-alvo. Simule aportes em USD ou BRL — a conversão usa a
            cotação que você informar — e escolha se o aporte deve reajustar a carteira às novas
            metas ou manter a proporção atual.
          </p>
        </div>

        {/* Summary strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 1,
            background: COLORS.border,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <SummaryCell label="Patrimônio total" value={fmtUSD(totalValue)} mono />
          <SummaryCell label="Soma dos alvos" value={fmtPct(totalTarget)} mono tone={targetOff ? COLORS.warn : COLORS.text} />
          <SummaryCell label="Desvio total" value={fmtPct(totalDrift)} mono />
          <SummaryCell label="Status" value={isBalanced ? "Balanceada" : "Requer ajuste"} tone={isBalanced ? COLORS.buy : COLORS.sell} />
        </div>

        {targetOff && (
          <div
            style={{
              background: "#241C0F",
              border: `1px solid #4A3A1A`,
              color: COLORS.warn,
              fontSize: 13,
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>Os pesos-alvo somam {fmtPct(totalTarget)}, não 100%. Os cálculos usam os alvos como estão.</span>
            <button className="rb-btn" onClick={autoNormalizeTargets} style={{ flexShrink: 0 }}>
              Normalizar para 100%
            </button>
          </div>
        )}

        {/* Allocation bars */}
        <Panel title="Alocação — atual vs. meta">
          <StackedBar rows={rows} field="currentPct" label="Atual" />
          <div style={{ height: 12 }} />
          <StackedBar rows={rows} field="target" label="Meta" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.borderSoft}` }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.muted }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: "inline-block" }} />
                {r.name || "—"}
              </div>
            ))}
          </div>
        </Panel>

        {/* Editor */}
        <Panel title="Ativos da carteira" style={{ marginTop: 20 }}>
          <div
            className="rb-mono"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1.6fr) 1fr 0.8fr 0.8fr 24px",
              gap: 10,
              fontSize: 11,
              color: COLORS.mutedSoft,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "0 4px 8px",
            }}
          >
            <span>Ativo</span>
            <span>Valor atual (USD)</span>
            <span>% atual</span>
            <span>Meta %</span>
            <span></span>
          </div>

          {rows.map((r) => (
            <div
              key={r.id}
              className="rb-row"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1.6fr) 1fr 0.8fr 0.8fr 24px",
                gap: 10,
                alignItems: "center",
                padding: "6px 4px",
                borderTop: `1px solid ${COLORS.borderSoft}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                <input className="rb-input" value={r.name} onChange={(e) => updateAsset(r.id, "name", e.target.value)} placeholder="Nome do ativo" />
              </div>
              <input
                className="rb-input rb-mono"
                type="number"
                min="0"
                value={r.value}
                onChange={(e) => updateAsset(r.id, "value", e.target.value === "" ? 0 : Number(e.target.value))}
              />
              <div className="rb-mono" style={{ fontSize: 13, color: COLORS.muted, paddingLeft: 4 }}>
                {fmtPct(r.currentPct)}
              </div>
              <input
                className="rb-input rb-mono"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={r.target}
                onChange={(e) => updateAsset(r.id, "target", e.target.value === "" ? 0 : Number(e.target.value))}
              />
              <button
                className="rb-remove"
                onClick={() => removeAsset(r.id)}
                aria-label={`Remover ${r.name}`}
                style={{ background: "transparent", border: "none", color: COLORS.mutedSoft, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4 }}
              >
                ×
              </button>
            </div>
          ))}

          <button className="rb-btn" onClick={addAsset} style={{ marginTop: 14 }}>
            + Adicionar ativo
          </button>
        </Panel>

        {/* Aporte */}
        <Panel title="Simular aporte" subtitle="Informe o valor, a moeda e o objetivo do novo dinheiro" style={{ marginTop: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <div>
              <span className="rb-label">Valor do aporte</span>
              <input
                className="rb-input rb-mono"
                type="number"
                min="0"
                value={aporte.valor}
                onChange={(e) => setAporte((p) => ({ ...p, valor: e.target.value === "" ? 0 : Number(e.target.value) }))}
              />
            </div>
            <div>
              <span className="rb-label">Moeda do aporte</span>
              <div className="rb-seg">
                <button className={aporte.moeda === "BRL" ? "active" : ""} onClick={() => setAporte((p) => ({ ...p, moeda: "BRL" }))}>
                  BRL
                </button>
                <button className={aporte.moeda === "USD" ? "active" : ""} onClick={() => setAporte((p) => ({ ...p, moeda: "USD" }))}>
                  USD
                </button>
              </div>
            </div>
            <div>
              <span className="rb-label">Cotação USD/BRL (R$ por US$)</span>
              <input
                className="rb-input rb-mono"
                type="number"
                min="0"
                step="0.01"
                value={aporte.cotacao}
                onChange={(e) => setAporte((p) => ({ ...p, cotacao: e.target.value === "" ? 0 : Number(e.target.value) }))}
              />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <span className="rb-label">Objetivo do aporte</span>
            <div className="rb-seg" style={{ width: "100%" }}>
              <button
                className={aporte.objetivo === "reajustar" ? "active" : ""}
                style={{ flex: 1 }}
                onClick={() => setAporte((p) => ({ ...p, objetivo: "reajustar" }))}
              >
                Reajustar com novos alvos
              </button>
              <button
                className={aporte.objetivo === "manter" ? "active" : ""}
                style={{ flex: 1 }}
                onClick={() => setAporte((p) => ({ ...p, objetivo: "manter" }))}
              >
                Manter proporção atual
              </button>
            </div>
            <p style={{ fontSize: 12, color: COLORS.mutedSoft, marginTop: 8, lineHeight: 1.5 }}>
              {aporte.objetivo === "reajustar"
                ? "O aporte é direcionado primeiro aos ativos mais abaixo da meta, sem vender nada. Se sobrar valor após cobrir os déficits, o restante é distribuído conforme os pesos-alvo."
                : "O aporte é dividido na mesma proporção que a carteira já tem hoje, sem alterar o desvio em relação às metas."}
            </p>
          </div>

          {aporte.moeda === "BRL" && !cotacaoValida && (
            <div
              style={{
                background: "#241C0F",
                border: `1px solid #4A3A1A`,
                color: COLORS.warn,
                fontSize: 13,
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 18,
              }}
            >
              Informe uma cotação USD/BRL válida para converter o aporte.
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 24px",
              paddingBottom: 16,
              marginBottom: 16,
              borderBottom: `1px solid ${COLORS.borderSoft}`,
              fontSize: 13,
            }}
          >
            <span style={{ color: COLORS.mutedSoft }}>
              Aporte em USD:{" "}
              <span className="rb-mono" style={{ color: COLORS.text, fontWeight: 600 }}>
                {fmtUSD(aporteUSD)}
              </span>
            </span>
            <span style={{ color: COLORS.mutedSoft }}>
              Aporte em BRL:{" "}
              <span className="rb-mono" style={{ color: COLORS.text, fontWeight: 600 }}>
                {fmtBRL(aporteBRL)}
              </span>
            </span>
            <span style={{ color: COLORS.mutedSoft }}>
              Novo patrimônio total:{" "}
              <span className="rb-mono" style={{ color: COLORS.text, fontWeight: 600 }}>
                {fmtUSD(newTotalValue)}
              </span>
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {aporteRows.map((r) => (
              <AporteRow key={r.id} row={r} maxAlloc={maxAlloc} newTotalValue={newTotalValue} cotacao={cotacaoNum} />
            ))}
          </div>
        </Panel>

        {/* Rebalancing ledger (sell/buy, no new money) */}
        <Panel title="Ordem de rebalanceamento (via compra e venda)" subtitle="Ajuste sem aporte, movimentando o que já está investido" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {rows.map((r) => (
              <LedgerRow key={r.id} row={r} maxAbsDiff={maxAbsDiff} />
            ))}
          </div>
        </Panel>

        <div style={{ textAlign: "center", color: COLORS.mutedSoft, fontSize: 11, marginTop: 24 }}>
          Simulação educacional. Não considera custos de transação, spread cambial, impostos ou liquidez.
        </div>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, mono, tone }) {
  return (
    <div style={{ background: COLORS.panel, padding: "14px 16px" }}>
      <div className="rb-mono" style={{ fontSize: 10, color: COLORS.mutedSoft, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        {label}
      </div>
      <div className={mono ? "rb-mono" : ""} style={{ fontSize: 17, fontWeight: 600, color: tone || COLORS.text }}>
        {value}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, style }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 20, ...style }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function StackedBar({ rows, field, label }) {
  const total = field === "currentPct" || field === "target" ? 100 : rows.reduce((s, r) => s + r[field], 0);
  return (
    <div>
      <div className="rb-mono" style={{ fontSize: 11, color: COLORS.mutedSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", background: COLORS.panelAlt, border: `1px solid ${COLORS.borderSoft}` }}>
        {rows.map((r) => {
          const val = r[field] || 0;
          const pct = total > 0 ? (val / total) * 100 : 0;
          if (pct <= 0) return null;
          return <div key={r.id} title={`${r.name}: ${fmtPct(pct)}`} style={{ width: `${pct}%`, background: r.color, minWidth: pct > 0 ? 2 : 0 }} />;
        })}
      </div>
    </div>
  );
}

function LedgerRow({ row, maxAbsDiff }) {
  const { name, color, value, targetValue, diff, currentPct, target } = row;
  const isBuy = diff > 1;
  const isSell = diff < -1;
  const action = isBuy ? "Comprar" : isSell ? "Vender" : "Manter";
  const actionColor = isBuy ? COLORS.buy : isSell ? COLORS.sell : COLORS.mutedSoft;
  const barPct = maxAbsDiff > 0 ? (Math.abs(diff) / maxAbsDiff) * 50 : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "—"}</span>
          <span className="rb-mono" style={{ fontSize: 11, color: COLORS.mutedSoft }}>
            {fmtPct(currentPct)} → {fmtPct(target)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
          <span
            className="rb-mono"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: actionColor,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "2px 8px",
              borderRadius: 4,
              background: isBuy ? COLORS.buyDim : isSell ? COLORS.sellDim : "transparent",
            }}
          >
            {action}
          </span>
          <span className="rb-mono" style={{ fontSize: 13, fontWeight: 600, color: actionColor, minWidth: 90, textAlign: "right" }}>
            {diff === 0 ? "—" : `${diff > 0 ? "+" : "−"}${fmtUSD(Math.abs(diff))}`}
          </span>
        </div>
      </div>
      <div style={{ position: "relative", height: 8, background: COLORS.panelAlt, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: COLORS.borderSoft }} />
        {diff > 0 && (
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: `${barPct}%`, background: COLORS.buy, borderRadius: "0 4px 4px 0" }} />
        )}
        {diff < 0 && (
          <div style={{ position: "absolute", right: "50%", top: 0, bottom: 0, width: `${barPct}%`, background: COLORS.sell, borderRadius: "4px 0 0 4px" }} />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span className="rb-mono" style={{ fontSize: 10, color: COLORS.mutedSoft }}>
          Atual: {fmtUSD(value)}
        </span>
        <span className="rb-mono" style={{ fontSize: 10, color: COLORS.mutedSoft }}>
          Meta: {fmtUSD(targetValue)}
        </span>
      </div>
    </div>
  );
}

function AporteRow({ row, maxAlloc, newTotalValue, cotacao }) {
  const { name, color, value, alloc, target } = row;
  const newValue = value + alloc;
  const newPct = newTotalValue > 0 ? (newValue / newTotalValue) * 100 : 0;
  const deltaToTarget = newPct - target;
  const barPct = maxAlloc > 0 ? (alloc / maxAlloc) * 100 : 0;
  const allocBRL = alloc * (cotacao || 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "—"}</span>
          <span className="rb-mono" style={{ fontSize: 11, color: COLORS.mutedSoft }}>
            nova posição: {fmtPct(newPct)} (meta {fmtPct(target)})
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexShrink: 0 }}>
          <span className="rb-mono" style={{ fontSize: 13, fontWeight: 600, color: COLORS.buy }}>
            {alloc > 0 ? `+${fmtUSD(alloc)}` : "—"}
          </span>
          {cotacao > 0 && alloc > 0 && (
            <span className="rb-mono" style={{ fontSize: 11, color: COLORS.mutedSoft }}>
              ({fmtBRL(allocBRL)})
            </span>
          )}
        </div>
      </div>
      <div style={{ height: 8, background: COLORS.panelAlt, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${barPct}%`, background: COLORS.buy }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span className="rb-mono" style={{ fontSize: 10, color: COLORS.mutedSoft }}>
          Posição após aporte: {fmtUSD(newValue)}
        </span>
        <span className="rb-mono" style={{ fontSize: 10, color: Math.abs(deltaToTarget) < 0.5 ? COLORS.mutedSoft : deltaToTarget > 0 ? COLORS.warn : COLORS.sell }}>
          {Math.abs(deltaToTarget) < 0.05 ? "na meta" : `${deltaToTarget > 0 ? "+" : ""}${deltaToTarget.toFixed(1)}pp vs meta`}
        </span>
      </div>
    </div>
  );
}
