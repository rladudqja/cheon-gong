import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Line
} from 'recharts';

const fmt = (n) => n == null ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtD = (n) => n == null ? '0' : Number(n).toFixed(1);
const pct = (n) => (n * 100).toFixed(1) + '%';
const COLORS = ['#1e3c72', '#e65100', '#6a1b9a', '#2e7d32'];
const COST_KEYS = [
  { key: 'equipment', label: '장비대', color: '#1e3c72' },
  { key: 'fuel', label: '유류비', color: '#e65100' },
  { key: 'material', label: '자재비', color: '#6a1b9a' },
  { key: 'labor', label: '노무비', color: '#2e7d32' },
];

export default function CostSummaryPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailFilter, setDetailFilter] = useState('');

  const load = () => api.get(`/reports/cost-summary?to=${date}`).then(setData);
  useEffect(load, [date]);

  if (!data) return <div className="page-title">로딩 중...</div>;

  const { daily, total, byHogi, hogiList, byDate, byMonth, details, detailCount } = data;

  const filteredDetails = detailFilter
    ? details.filter(d => d.type === detailFilter)
    : details;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>💵 투입비 집계</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '8px 12px', border: '2px solid var(--primary)', borderRadius: 8, fontSize: 14, fontWeight: 'bold' }} />
      </div>

      {/* ═══ 1. 항목별 요약 (당일/누계) ═══ */}
      <Section title="1. 항목별 요약">
        <div className="grid-3">
          {/* 누계 테이블 */}
          <div>
            <table className="data-table">
              <thead><tr><th>구분</th><th>누계 금액</th><th>비율</th></tr></thead>
              <tbody>
                {COST_KEYS.map(ck => (
                  <tr key={ck.key}>
                    <td style={{ fontWeight: 'bold', color: ck.color }}>{ck.label}</td>
                    <td style={{ fontWeight: 'bold' }}>{fmt(total[ck.key])}</td>
                    <td>{total.total > 0 ? pct(total[ck.key] / total.total) : '-'}</td>
                  </tr>
                ))}
                <tr style={{ background: '#fff9e6', fontWeight: 'bold' }}>
                  <td>합계</td><td>{fmt(total.total)}</td><td>100%</td>
                </tr>
              </tbody>
            </table>
            {/* 당일 */}
            {daily.total > 0 && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#e3f2fd', borderRadius: 6, fontSize: 12 }}>
                당일({date}): <strong>{fmt(daily.total)}원</strong>
                <span style={{ color: '#888', marginLeft: 6 }}>
                  ({COST_KEYS.filter(c => daily[c.key] > 0).map(c => c.label + ' ' + fmt(daily[c.key])).join(' / ')})
                </span>
              </div>
            )}
          </div>

          {/* 파이차트 */}
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={COST_KEYS.map(ck => ({ name: ck.label, value: total[ck.key] })).filter(d => d.value > 0)}
                dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={35}
                label={({ name, value }) => `${name} ${pct(value / total.total)}`}
              >
                {COST_KEYS.map((ck, i) => <Cell key={i} fill={ck.color} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v) + '원'} />
            </PieChart>
          </ResponsiveContainer>

          {/* KPI 카드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="kpi" style={{ flex: 1 }}>
              <div className="label">총 투입비</div>
              <div className="value" style={{ fontSize: 22 }}>{fmt(total.total)}</div>
              <div className="sub">누계 기준</div>
            </div>
            <div className="kpi" style={{ flex: 1 }}>
              <div className="label">일평균</div>
              <div className="value" style={{ fontSize: 18 }}>
                {byDate.length > 0 ? fmt(Math.round(total.total / byDate.length)) : '-'}
              </div>
              <div className="sub">{byDate.length}일</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ 2. 호기별 투입비 ═══ */}
      {hogiList.length > 0 && (
        <Section title="2. 호기별 투입비">
          <div className="grid-2-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>호기</th>
                  {COST_KEYS.map(ck => <th key={ck.key} style={{ color: ck.color }}>{ck.label}</th>)}
                  <th>합계</th>
                </tr>
              </thead>
              <tbody>
                {hogiList.map(h => {
                  const hc = byHogi[h] || {};
                  return (
                    <tr key={h}>
                      <td style={{ fontWeight: 'bold' }}>{h}</td>
                      {COST_KEYS.map(ck => <td key={ck.key}>{hc[ck.key] ? fmt(hc[ck.key]) : '-'}</td>)}
                      <td style={{ fontWeight: 'bold' }}>{fmt(hc.total || 0)}</td>
                    </tr>
                  );
                })}
                {/* 미배분 */}
                {(() => {
                  const assigned = hogiList.reduce((s, h) => s + (byHogi[h]?.total || 0), 0);
                  const unassigned = total.total - assigned;
                  if (Math.abs(unassigned) < 1) return null;
                  return (
                    <tr style={{ color: '#888' }}>
                      <td>미배분</td>
                      {COST_KEYS.map(ck => <td key={ck.key}>-</td>)}
                      <td>{fmt(unassigned)}</td>
                    </tr>
                  );
                })()}
                <tr style={{ background: '#fff9e6', fontWeight: 'bold' }}>
                  <td>합계</td>
                  {COST_KEYS.map(ck => <td key={ck.key}>{fmt(total[ck.key])}</td>)}
                  <td>{fmt(total.total)}</td>
                </tr>
              </tbody>
            </table>

            {/* 호기별 스택 바 */}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hogiList.map(h => ({ hogi: h, ...(byHogi[h] || {}) }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => (v / 10000).toFixed(0) + '만'} />
                <YAxis dataKey="hogi" type="category" tick={{ fontSize: 11 }} width={55} />
                <Tooltip formatter={v => fmt(v) + '원'} />
                <Legend />
                {COST_KEYS.map(ck => (
                  <Bar key={ck.key} dataKey={ck.key} name={ck.label} stackId="a" fill={ck.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ═══ 3. 월별 추이 ═══ */}
      {byMonth.length > 1 && (
        <Section title="3. 월별 투입비 추이">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={m => m.slice(2)} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => (v / 10000).toFixed(0) + '만'} />
              <Tooltip formatter={v => fmt(v) + '원'} />
              <Legend />
              {COST_KEYS.map(ck => (
                <Bar key={ck.key} dataKey={ck.key} name={ck.label} stackId="a" fill={ck.color} />
              ))}
              <Line dataKey="total" name="합계" stroke="#333" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <table className="data-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>월</th>
                {COST_KEYS.map(ck => <th key={ck.key}>{ck.label}</th>)}
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((m, i) => (
                <tr key={m.month} style={i % 2 === 1 ? { background: '#fafafa' } : {}}>
                  <td>{m.month}</td>
                  {COST_KEYS.map(ck => <td key={ck.key}>{m[ck.key] > 0 ? fmt(m[ck.key]) : '-'}</td>)}
                  <td style={{ fontWeight: 'bold' }}>{fmt(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* ═══ 4. 날짜별 투입비 ═══ */}
      <Section title={'4. 날짜별 투입비 (' + byDate.length + '일)'}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byDate.slice(-30)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={v => (v / 10000).toFixed(0) + '만'} />
            <Tooltip formatter={v => fmt(v) + '원'} />
            <Legend />
            {COST_KEYS.map(ck => (
              <Bar key={ck.key} dataKey={ck.key} name={ck.label} stackId="a" fill={ck.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* ═══ 5. 상세내역 ═══ */}
      <Section title={'5. 상세내역 (' + detailCount + '건)'}>
        <div style={{ marginBottom: 8, display: 'flex', gap: 6 }}>
          <button className={`btn btn-sm ${!detailFilter ? 'btn-primary' : ''}`} onClick={() => setDetailFilter('')}>전체</button>
          {['장비대', '유류비', '자재비', '노무비'].map(t => (
            <button key={t} className={`btn btn-sm ${detailFilter === t ? 'btn-primary' : ''}`}
              onClick={() => setDetailFilter(detailFilter === t ? '' : t)}>{t}</button>
          ))}
          <button className={`btn btn-sm ${showDetails ? '' : 'btn-primary'}`} style={{ marginLeft: 'auto' }}
            onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? '접기' : '펼치기'} ({filteredDetails.length}건)
          </button>
        </div>

        {showDetails && (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <table className="data-table" style={{ fontSize: 11 }}>
              <thead>
                <tr><th>날짜</th><th>구분</th><th>업체</th><th>항목</th><th>수량</th><th>단가</th><th>금액</th><th>호기</th></tr>
              </thead>
              <tbody>
                {filteredDetails.map((d, i) => (
                  <tr key={i} style={i % 2 === 1 ? { background: '#fafafa' } : {}}>
                    <td>{d.date}</td>
                    <td style={{ fontWeight: 'bold' }}>{d.type}</td>
                    <td>{d.company || '-'}</td>
                    <td>{d.item || '-'}</td>
                    <td>{d.qty > 0 ? fmtD(d.qty) : '-'}</td>
                    <td>{d.price > 0 ? fmt(d.price) : '-'}</td>
                    <td style={{ fontWeight: 'bold' }}>{fmt(d.amount)}</td>
                    <td>{d.hogi || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return <div className="card"><div className="card-title">{title}</div>{children}</div>;
}
