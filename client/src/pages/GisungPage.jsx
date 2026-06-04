import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n) => n == null ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtD = (n) => n == null ? '0' : Number(n).toFixed(1);
const pct = (n) => (n * 100).toFixed(1) + '%';
const COLORS = ['#1e3c72', '#e65100', '#6a1b9a', '#2e7d32', '#c62828'];
const GEO_COLORS = { '토사': '#66bb6a', '풍화암': '#42a5f5', '연암': '#ffa726', '보통암': '#ef5350', '경암': '#ab47bc' };

export default function GisungPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [expandedHogi, setExpandedHogi] = useState({});

  const load = () => api.get(`/reports/gisung?to=${date}`).then(setData);
  useEffect(load, [date]);

  if (!data) return <div className="page-title">로딩 중...</div>;

  const { allBlock, hogiBlocks, ratioMatrix, methods, geologies, totalActualQty, config: cfg } = data;
  const contractQty = parseFloat(cfg.contract_qty) || 0;

  const toggleHogi = (hogi) => setExpandedHogi(prev => ({ ...prev, [hogi]: !prev[hogi] }));

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>💰 기성산출</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '8px 12px', border: '2px solid var(--primary)', borderRadius: 8, fontSize: 14, fontWeight: 'bold' }} />
      </div>

      {/* KPI */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <KPI label="계약금액" value={fmt(allBlock.grandTotal.contractAmount)} />
        <KPI label="당일 기성" value={fmt(allBlock.grandTotal.dailyAmount)}
          sub={fmtD(allBlock.grandTotal.dailyQty) + 'm'} color="#2e7d32" />
        <KPI label="누계 기성" value={fmt(allBlock.grandTotal.totalAmount)}
          sub={fmtD(allBlock.grandTotal.totalQty) + 'm'} color="#1e3c72" />
        <KPI label="잔여 기성" value={fmt(allBlock.grandTotal.remainAmount)}
          color={allBlock.grandTotal.remainAmount > 0 ? '#333' : '#dc3545'} />
        <KPI label="진행률" value={pct(allBlock.grandTotal.progress)}
          color={allBlock.grandTotal.progress >= 0.8 ? '#28a745' : '#fd7e14'} />
      </div>

      {/* ═══ 전체 합계 블록 ═══ */}
      <GisungBlock block={allBlock} showDaily={true} />

      {/* ═══ 공법별·지질별 비율 매트릭스 ═══ */}
      <div className="card">
        <div className="card-title">공법별·지질별 굴진 비율 (누계 기준)</div>
        <div className="grid-2-1">
          <table className="data-table">
            <thead>
              <tr>
                <th>공법</th>
                {geologies.map(g => <th key={g}>{g}</th>)}
                <th style={{ background: '#e8eaf6' }}>합계</th>
              </tr>
            </thead>
            <tbody>
              {methods.map(m => {
                const mTotal = geologies.reduce((s, g) => s + (ratioMatrix[m]?.[g]?.qty || 0), 0);
                return (
                  <tr key={m}>
                    <td style={{ fontWeight: 'bold' }}>{m}</td>
                    {geologies.map(g => {
                      const d = ratioMatrix[m]?.[g] || { qty: 0, ratio: 0 };
                      return (
                        <td key={g} style={{
                          background: d.ratio > 0.1 ? GEO_COLORS[g] + '33' : 'transparent',
                          fontWeight: d.ratio > 0.1 ? 'bold' : 'normal'
                        }}>
                          {d.qty > 0 ? fmtD(d.qty) : '-'}
                          {d.ratio > 0 && <div style={{ fontSize: 10, color: '#888' }}>{pct(d.ratio)}</div>}
                        </td>
                      );
                    })}
                    <td style={{ fontWeight: 'bold', background: '#f0f4ff' }}>
                      {fmt(mTotal)}
                      <div style={{ fontSize: 10, color: '#2471a3' }}>
                        {totalActualQty > 0 ? pct(mTotal / totalActualQty) : '-'}
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: '#e8eaf6', fontWeight: 'bold' }}>
                <td>합계</td>
                {geologies.map(g => {
                  const gTotal = methods.reduce((s, m) => s + (ratioMatrix[m]?.[g]?.qty || 0), 0);
                  return (
                    <td key={g}>
                      {fmt(gTotal)}
                      <div style={{ fontSize: 10, color: GEO_COLORS[g] || '#555' }}>
                        {totalActualQty > 0 ? pct(gTotal / totalActualQty) : '-'}
                      </div>
                    </td>
                  );
                })}
                <td>{fmt(totalActualQty)}</td>
              </tr>
            </tbody>
          </table>

          {/* 파이차트 */}
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={methods.map(m => ({
                  name: m,
                  value: geologies.reduce((s, g) => s + (ratioMatrix[m]?.[g]?.qty || 0), 0)
                })).filter(d => d.value > 0)}
                dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={90} innerRadius={40}
                label={({ name, value }) => `${name} ${pct(value / totalActualQty)}`}
              >
                {methods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmtD(v) + 'm'} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ 호기별 블록 (접기 가능) ═══ */}
      {hogiBlocks.map((block, i) => (
        <div key={block.label}>
          <div
            className="card" style={{ cursor: 'pointer', padding: '12px 20px', marginBottom: expandedHogi[block.label] ? 0 : 16,
              borderRadius: expandedHogi[block.label] ? '8px 8px 0 0' : '8px',
              background: COLORS[i % COLORS.length] + '11',
              borderLeft: `4px solid ${COLORS[i % COLORS.length]}` }}
            onClick={() => toggleHogi(block.label)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: 15, color: COLORS[i % COLORS.length] }}>
                {expandedHogi[block.label] ? '▼' : '▶'} {block.label} 상세
              </span>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <span>천공: <strong>{fmtD(block.drillTotal.totalQty)}m</strong></span>
                <span>기성: <strong>{fmt(block.drillTotal.totalAmount)}</strong></span>
                <span>잔여: <strong style={{ color: block.drillTotal.remainQty < 0 ? '#dc3545' : '#333' }}>
                  {fmtD(block.drillTotal.remainQty)}m</strong></span>
              </div>
            </div>
          </div>
          {expandedHogi[block.label] && (
            <div style={{ borderLeft: `4px solid ${COLORS[i % COLORS.length]}`, borderRadius: '0 0 8px 8px', marginBottom: 16 }}>
              <GisungBlock block={block} showDaily={true} compact />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 기성 블록 컴포넌트 ──
function GisungBlock({ block, showDaily, compact }) {
  const { items, methodSubtotals, drillTotal, subItems, grandTotal } = block;
  return (
    <div className="card" style={compact ? { borderRadius: '0 0 8px 8px', marginBottom: 0 } : {}}>
      {!compact && <div className="card-title">📊 {block.label} 기성산출</div>}
      <div style={{ overflow: 'auto' }}>
        <table className="data-table" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>공법</th><th>지질</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th>
              {showDaily && <><th style={{ background: '#ebf5fb' }}>금일수량</th><th style={{ background: '#ebf5fb' }}>금일금액</th></>}
              <th>누계수량</th><th>누계금액</th><th>비율</th><th>잔여수량</th><th>잔여금액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              if (it.type === 'geoSubtotal') {
                return (
                  <tr key={'geo-' + it.geology} style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                    <td>소계</td><td style={{ color: GEO_COLORS[it.geology] || '#333' }}>{it.geology}</td>
                    <td></td><td>{fmt(it.contractQty)}</td><td></td><td>{fmt(it.contractAmount)}</td>
                    {showDaily && <><td>{it.dailyQty > 0 ? fmtD(it.dailyQty) : ''}</td><td>{it.dailyAmount > 0 ? fmt(it.dailyAmount) : ''}</td></>}
                    <td>{it.totalQty > 0 ? fmtD(it.totalQty) : ''}</td><td>{it.totalAmount > 0 ? fmt(it.totalAmount) : ''}</td>
                    <td></td>
                    <td>{fmtD(it.remainQty)}</td><td>{fmt(it.remainAmount)}</td>
                  </tr>
                );
              }
              return (
                <tr key={i} style={i % 2 === 1 ? { background: '#fafafa' } : {}}>
                  <td>{it.method}</td><td>{it.geology}</td><td>{it.unit}</td>
                  <td>{fmt(it.contractQty)}</td><td>{fmt(it.contractPrice)}</td><td>{fmt(it.contractAmount)}</td>
                  {showDaily && <>
                    <td style={{ background: it.dailyQty > 0 ? '#ebf5fb' : '', fontWeight: it.dailyQty > 0 ? 'bold' : '' }}>
                      {it.dailyQty > 0 ? fmtD(it.dailyQty) : ''}
                    </td>
                    <td style={{ background: it.dailyQty > 0 ? '#ebf5fb' : '' }}>{it.dailyAmount > 0 ? fmt(it.dailyAmount) : ''}</td>
                  </>}
                  <td>{it.totalQty > 0 ? fmtD(it.totalQty) : ''}</td>
                  <td>{it.totalAmount > 0 ? fmt(it.totalAmount) : ''}</td>
                  <td>{it.ratio > 0 ? pct(it.ratio) : '-'}</td>
                  <td style={{ color: it.remainQty < 0 ? '#dc3545' : '', fontWeight: it.remainQty < 0 ? 'bold' : '' }}>
                    {fmtD(it.remainQty)}
                  </td>
                  <td style={{ color: it.remainAmount < 0 ? '#dc3545' : '' }}>{fmt(it.remainAmount)}</td>
                </tr>
              );
            })}

            {/* 공법별 소계 */}
            {methodSubtotals.map(ms => (
              <tr key={'ms-' + ms.method} style={{ background: '#f0f4f8', fontWeight: 'bold' }}>
                <td colSpan={3}>{ms.method} 합계</td>
                <td>{fmt(ms.contractQty)}</td><td></td><td>{fmt(ms.contractAmount)}</td>
                {showDaily && <><td>{ms.dailyQty > 0 ? fmtD(ms.dailyQty) : ''}</td><td>{ms.dailyAmount > 0 ? fmt(ms.dailyAmount) : ''}</td></>}
                <td>{ms.totalQty > 0 ? fmtD(ms.totalQty) : ''}</td><td>{ms.totalAmount > 0 ? fmt(ms.totalAmount) : ''}</td>
                <td></td>
                <td>{fmtD(ms.remainQty)}</td><td>{fmt(ms.remainAmount)}</td>
              </tr>
            ))}

            {/* 천공 합계 */}
            <tr style={{ background: '#e8eaf6', fontWeight: 'bold' }}>
              <td colSpan={3}>천공 합계</td>
              <td>{fmt(drillTotal.contractQty)}</td><td></td><td>{fmt(drillTotal.contractAmount)}</td>
              {showDaily && <><td>{drillTotal.dailyQty > 0 ? fmtD(drillTotal.dailyQty) : ''}</td><td>{drillTotal.dailyAmount > 0 ? fmt(drillTotal.dailyAmount) : ''}</td></>}
              <td>{drillTotal.totalQty > 0 ? fmtD(drillTotal.totalQty) : ''}</td>
              <td>{drillTotal.totalAmount > 0 ? fmt(drillTotal.totalAmount) : ''}</td>
              <td></td>
              <td>{fmtD(drillTotal.remainQty)}</td><td>{fmt(drillTotal.remainAmount)}</td>
            </tr>

            {/* 부대항목 */}
            {subItems.map((si, i) => (
              <tr key={'sub-' + i} style={{ background: '#eafaf1' }}>
                <td>{si.method}</td><td>{si.qtyType === 'all' ? '-' : si.qtyType}</td><td>m</td>
                <td>{fmt(si.contractQty)}</td><td>{fmt(si.price)}</td><td>{fmt(si.contractAmount)}</td>
                {showDaily && <>
                  <td style={{ background: si.dailyQty > 0 ? '#d5f5e3' : '' }}>{si.dailyQty > 0 ? fmtD(si.dailyQty) : ''}</td>
                  <td style={{ background: si.dailyQty > 0 ? '#d5f5e3' : '' }}>{si.dailyAmount > 0 ? fmt(si.dailyAmount) : ''}</td>
                </>}
                <td>{si.totalQty > 0 ? fmtD(si.totalQty) : ''}</td>
                <td>{si.totalAmount > 0 ? fmt(si.totalAmount) : ''}</td>
                <td>-</td>
                <td style={{ color: si.remainQty < 0 ? '#dc3545' : '' }}>{fmtD(si.remainQty)}</td>
                <td style={{ color: si.remainAmount < 0 ? '#dc3545' : '' }}>{fmt(si.remainAmount)}</td>
              </tr>
            ))}

            {/* 총합계 */}
            <tr style={{ background: '#fef9e7', fontWeight: 'bold', fontSize: 12 }}>
              <td colSpan={3}>합계</td>
              <td></td><td></td><td>{fmt(grandTotal.contractAmount)}</td>
              {showDaily && <><td>{grandTotal.dailyQty > 0 ? fmtD(grandTotal.dailyQty) : ''}</td><td>{fmt(grandTotal.dailyAmount)}</td></>}
              <td>{grandTotal.totalQty > 0 ? fmtD(grandTotal.totalQty) : ''}</td>
              <td style={{ color: '#2471a3' }}>{fmt(grandTotal.totalAmount)}</td>
              <td style={{ color: '#2471a3' }}>{pct(grandTotal.progress)}</td>
              <td></td><td>{fmt(grandTotal.remainAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, color }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: 16, color: color || 'var(--primary)' }}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
