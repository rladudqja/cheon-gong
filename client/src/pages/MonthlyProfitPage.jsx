import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, ComposedChart
} from 'recharts';

const fmt = (n) => n == null ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtD = (n) => n == null ? '0' : Number(n).toFixed(1);
const fmtSign = (n) => (n >= 0 ? '+' : '') + fmt(n);
const pct = (n) => (n * 100).toFixed(1) + '%';
const COLORS = ['#1e3c72', '#e65100', '#6a1b9a', '#2e7d32', '#c62828'];
const pc = (v) => v >= 0 ? 'var(--pos)' : 'var(--neg)';

export default function MonthlyProfitPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);

  const load = () => api.get(`/reports/monthly-profit?month=${month}`).then(setData);
  useEffect(load, [month]);

  if (!data) return <div className="page-title">로딩 중...</div>;

  const { prev, cur, total, target, period, monthlyTrend, curByMethod, curByGeology, costBreakdown, indirectConfig: indCfg } = data;

  const monthLabel = (m) => { const [y, mo] = m.split('-'); return y + '년 ' + parseInt(mo) + '월'; };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>📊 월간손익보고서</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: '8px 12px', border: '2px solid var(--primary)', borderRadius: 8, fontSize: 14, fontWeight: 'bold' }} />
        </div>
      </div>

      {/* 정산기간 안내 */}
      <div style={{ background: '#2a5298', color: '#fff', padding: '8px 16px', borderRadius: 6, marginBottom: 16, fontSize: 12, textAlign: 'center' }}>
        {monthLabel(month)} | 정산기간: {period.start} ~ {period.end} (매월 {period.settlementDay}일 기준)
      </div>

      {/* ═══ KPI 카드 ═══ */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <KPI label="계약금액" value={fmt(data.contractAmt)} />
        <KPI label="금월 기성" value={fmt(cur.indirect.gisungTotal)} sub={'직접비 ' + fmt(cur.indirect.gisungDirect)} color="#2e7d32" />
        <KPI label="누계 기성" value={fmt(total.indirect.gisungTotal)} />
        <KPI label="금월 투입" value={fmt(cur.indirect.toipTotal)} sub={'직접비 ' + fmt(cur.cost.total)} color="#c62828" />
        <KPI label="금월 손익" value={fmtSign(cur.indirect.profit)} color={pc(cur.indirect.profit)}
          sub={total.indirect.gisungTotal > 0 ? pct(cur.indirect.profitRate) : '-'} />
        <KPI label="누계 손익" value={fmtSign(total.indirect.profit)} color={pc(total.indirect.profit)}
          sub={pct(total.indirect.profitRate)} />
      </div>

      {/* ═══ 1. 월간 목표 대비 실적 ═══ */}
      <Section title="1. 월간 목표 대비 실적">
        <div style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>일일목표(1대)</th><th>작업일수/월</th><th>월목표(1대)</th><th>가동대수</th><th>목표합산</th>
                <th style={{ background: '#e8f5e9' }}>실기성(금월)</th>
                <th style={{ background: '#e8f5e9' }}>달성률</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 'bold', fontSize: 14 }}>{target.dailyTarget > 0 ? target.dailyTarget + 'm' : '-'}</td>
                <td>{data.config.work_days_per_month || 25}일</td>
                <td>{target.monthTarget > 0 ? fmt(target.monthTarget) + 'm' : '-'}</td>
                <td>{target.unitCount}대</td>
                <td>{target.totalTarget > 0 ? fmt(target.totalTarget) + 'm' : '-'}</td>
                <td style={{ fontWeight: 'bold', fontSize: 14 }}>{fmtD(cur.revenue.qty)}m</td>
                <td style={{ fontWeight: 'bold', fontSize: 14, color: target.achRate >= 1 ? 'var(--pos)' : target.achRate >= 0.8 ? 'var(--warn)' : 'var(--neg)' }}>
                  {target.totalTarget > 0 ? pct(target.achRate) : '-'}
                </td>
                <td style={{ fontSize: 11 }}>
                  {target.hogiDays?.map(h => h.hogi + ':' + h.days + '일').join(', ')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ═══ 2. 기성·투입·손익 종합 ═══ */}
      <Section title="2. 기성·투입·손익 종합 (확정기성 기준)">
        <div style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th rowSpan={2}>구분</th>
                <th colSpan={3} style={{ background: '#e8f5e9' }}>기성</th>
                <th colSpan={3} style={{ background: '#ffebee' }}>투입</th>
                <th colSpan={2} style={{ background: '#e3f2fd' }}>손익</th>
              </tr>
              <tr>
                <th>직접비</th><th>간접비</th><th>합계</th>
                <th>직접비</th><th>간접비</th><th>합계</th>
                <th>금액</th><th>손익률</th>
              </tr>
            </thead>
            <tbody>
              <ProfitRow label="전월" d={prev.indirect} />
              <ProfitRow label="금월" d={cur.indirect} highlight />
              <ProfitRow label="누계" d={total.indirect} bold />
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 10, color: '#888', marginTop: 6 }}>
          ※ 기성 간접비: 직접비×{(indCfg.gisungIndRate * 100).toFixed(1)}%
          ({indCfg.gisungIndItems?.map(i => i.item + ' ' + (i.rate * 100).toFixed(1) + '%').join(' + ')})
          | 투입 간접비: 직접비×{(indCfg.toipIndRate * 100).toFixed(1)}%
        </div>
      </Section>

      {/* ═══ 3. 투입비 내역 ═══ */}
      <Section title="3. 투입비 내역 (비목별)">
        <div className="grid-2-1">
          <table className="data-table">
            <thead>
              <tr><th>구분</th><th>전월</th><th>금월</th><th>누계</th><th>비율</th></tr>
            </thead>
            <tbody>
              {[['장비대', 'equipment'], ['유류비', 'fuel'], ['자재비', 'material'], ['노무비', 'labor']].map(([name, key]) => (
                <tr key={key}>
                  <td>{name}</td>
                  <td>{fmt(costBreakdown.prev[key])}</td>
                  <td style={{ fontWeight: 'bold' }}>{fmt(costBreakdown.cur[key])}</td>
                  <td>{fmt(costBreakdown.total[key])}</td>
                  <td>{costBreakdown.total.total > 0 ? pct(costBreakdown.total[key] / costBreakdown.total.total) : '-'}</td>
                </tr>
              ))}
              <tr style={{ background: '#ffebee', fontWeight: 'bold' }}>
                <td>직접비 합계</td>
                <td>{fmt(costBreakdown.prev.total)}</td>
                <td>{fmt(costBreakdown.cur.total)}</td>
                <td>{fmt(costBreakdown.total.total)}</td>
                <td>100%</td>
              </tr>
            </tbody>
          </table>

          {/* 금월 투입비 파이 */}
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={[
                  { name: '장비대', value: costBreakdown.cur.equipment },
                  { name: '유류비', value: costBreakdown.cur.fuel },
                  { name: '자재비', value: costBreakdown.cur.material },
                  { name: '노무비', value: costBreakdown.cur.labor },
                ].filter(d => d.value > 0)}
                dataKey="value" cx="50%" cy="50%" outerRadius={70}
                label={({ name }) => name}
              >
                {[0, 1, 2, 3].map(i => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v) + '원'} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* ═══ 4. 월별 손익 추이 ═══ */}
      <Section title="4. 월별 손익 추이">
        <div className="grid-2">
          {/* 월별 기성 vs 투입 차트 */}
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={m => m.slice(2)} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => (v / 10000).toFixed(0) + '만'} />
              <Tooltip formatter={v => fmt(v) + '원'} labelFormatter={l => monthLabel(l)} />
              <Legend />
              <Bar dataKey="gisungTotal" name="기성" fill="#2e7d32" opacity={0.7} />
              <Bar dataKey="toipTotal" name="투입" fill="#c62828" opacity={0.7} />
              <Line dataKey="profit" name="손익" stroke="#1e3c72" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* 누적 손익 차트 */}
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={m => m.slice(2)} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => (v / 10000).toFixed(0) + '만'} />
              <Tooltip formatter={v => fmt(v) + '원'} labelFormatter={l => monthLabel(l)} />
              <Line dataKey="cumProfit" name="누적손익" stroke="#1e3c72" strokeWidth={2} dot={{ r: 4 }}
                fill="url(#cumGrad)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 월별 테이블 */}
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>월</th><th>물량(m)</th><th>기성(합계)</th><th>투입(합계)</th>
              <th>손익</th><th>손익률</th><th>누계손익</th>
            </tr>
          </thead>
          <tbody>
            {monthlyTrend.map((m, i) => (
              <tr key={m.month} style={m.month === month ? { background: '#fff9e6', fontWeight: 'bold' } : i % 2 === 1 ? { background: '#fafafa' } : {}}>
                <td>{monthLabel(m.month)}</td>
                <td>{fmtD(m.qty)}</td>
                <td>{fmt(m.gisungTotal)}</td>
                <td>{fmt(m.toipTotal)}</td>
                <td style={{ fontWeight: 'bold', color: pc(m.profit) }}>{fmtSign(m.profit)}</td>
                <td style={{ color: pc(m.profit) }}>{m.gisungTotal > 0 ? pct(m.profit / m.gisungTotal) : '-'}</td>
                <td style={{ fontWeight: 'bold', color: pc(m.cumProfit) }}>{fmtSign(m.cumProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ═══ 5. 금월 공법/지질별 구성 ═══ */}
      <Section title="5. 금월 공법별·지질별 구성">
        <div className="grid-2">
          <div>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>공법별</div>
            <table className="data-table">
              <thead><tr><th>공법</th><th>물량(m)</th><th>비율</th></tr></thead>
              <tbody>
                {curByMethod.map(m => (
                  <tr key={m.method}>
                    <td style={{ fontWeight: 'bold' }}>{m.method}</td>
                    <td>{fmtD(m.qty)}</td>
                    <td>{cur.revenue.qty > 0 ? pct(m.qty / cur.revenue.qty) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>지질별</div>
            <table className="data-table">
              <thead><tr><th>지질</th><th>물량(m)</th><th>비율</th></tr></thead>
              <tbody>
                {curByGeology.map(g => (
                  <tr key={g.geology}>
                    <td style={{ fontWeight: 'bold' }}>{g.geology}</td>
                    <td>{fmtD(g.qty)}</td>
                    <td>{cur.revenue.qty > 0 ? pct(g.qty / cur.revenue.qty) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {children}
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

function ProfitRow({ label, d, highlight, bold }) {
  const bg = highlight ? '#e3f2fd' : bold ? '#f8f9fa' : '#fff';
  const fw = bold ? 'bold' : 'normal';
  return (
    <tr style={{ background: bg, fontWeight: fw }}>
      <td style={{ fontWeight: 'bold' }}>{label}</td>
      <td>{fmt(d.gisungDirect)}</td>
      <td style={{ color: '#888' }}>{fmt(d.gisungIndirect)}</td>
      <td style={{ background: highlight ? '#c8e6c9' : '', fontWeight: 'bold' }}>{fmt(d.gisungTotal)}</td>
      <td>{fmt(d.toipDirect)}</td>
      <td style={{ color: '#888' }}>{fmt(d.toipIndirect)}</td>
      <td style={{ background: highlight ? '#ffcdd2' : '', fontWeight: 'bold' }}>{fmt(d.toipTotal)}</td>
      <td style={{ fontWeight: 'bold', color: d.profit >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtSign(d.profit)}</td>
      <td style={{ color: d.profit >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{pct(d.profitRate)}</td>
    </tr>
  );
}
