import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';

const fmt = (n) => n == null ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtD = (n) => n == null ? '0' : Number(n).toFixed(1);
const fmtSign = (n) => (n >= 0 ? '+' : '') + fmt(n);
const pct = (n) => (n * 100).toFixed(1) + '%';
const pc = (v) => v >= 0 ? 'var(--pos)' : 'var(--neg)';
const COLORS = ['#1e3c72', '#e65100', '#6a1b9a', '#2e7d32', '#c62828', '#00695c'];
const M_BG = { 'T4': '#e8f5e9', '토네이도': '#fff3e0', '트리콘': '#f3e5f5' };

export default function TimeAnalysisPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);

  const load = () => api.get(`/reports/time-analysis?to=${date}`).then(setData);
  useEffect(load, [date]);

  if (!data) return <div className="page-title">로딩 중...</div>;

  const { hogiList, hogisWithTime, hogisNoTime, timeComparison, hogiAlloc, allItems, ranks, totalCost, totalQty, timeDateCount } = data;
  const avgCPM = totalQty > 0 ? Math.round(totalCost / totalQty) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>⏱️ 호기별(시간)분석</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '8px 12px', border: '2px solid var(--primary)', borderRadius: 8, fontSize: 14, fontWeight: 'bold' }} />
      </div>

      {/* 안내 */}
      {hogisNoTime.length > 0 && (
        <div style={{ background: '#fff3e0', padding: '8px 14px', borderRadius: 6, marginBottom: 12, fontSize: 12, border: '1px solid #ffc107' }}>
          ⚠️ 시간미입력: <strong>{hogisNoTime.join(', ')}</strong> → 물량균등배분 적용
        </div>
      )}

      {/* ═══ 1. KPI ═══ */}
      <Section title="1. KPI 요약">
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <KPI label="총 투입비" value={fmt(totalCost) + '원'} />
          <KPI label="총 물량" value={fmtD(totalQty) + 'm'} />
          <KPI label="평균원가/m" value={fmt(avgCPM) + '원'} />
          <KPI label="호기수" value={hogiList.length + '대'} sub={'시간측정 ' + hogisWithTime.length + '대'} />
          <KPI label="시간측정" value={timeDateCount + '회'} />
        </div>
      </Section>

      {/* ═══ 2. 호기별 평균 소요시간 비교 ═══ */}
      <Section title="2. 호기별 평균 소요시간 비교 (분/1공)">
        <div style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>공법</th><th>지질</th><th>전체평균</th>
                {hogiList.map(h => (
                  <th key={h} style={{ color: hogisNoTime.includes(h) ? '#999' : '#333' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeComparison.map(tc => (
                <tr key={tc.key}>
                  <td style={{ fontWeight: 'bold', background: M_BG[tc.method] || '#fff' }}>{tc.method}</td>
                  <td>{tc.geo}</td>
                  <td style={{ fontWeight: 'bold' }}>{tc.globalAvg > 0 ? fmtD(tc.globalAvg) : '-'}</td>
                  {hogiList.map(h => {
                    const v = tc.hogiTimes[h] || 0;
                    let color = '#333';
                    if (v > 0 && tc.globalAvg > 0) {
                      if (v < tc.globalAvg * 0.95) color = 'var(--pos)';
                      else if (v > tc.globalAvg * 1.05) color = 'var(--neg)';
                    }
                    return (
                      <td key={h} style={{ color, fontWeight: v > 0 && v !== tc.globalAvg ? 'bold' : 'normal' }}>
                        {v > 0 ? fmtD(v) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 소요시간 바 차트 */}
        {timeComparison.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timeComparison.filter(tc => tc.globalAvg > 0)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="geo" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: '분', position: 'insideLeft', style: { fontSize: 10 } }} />
                <Tooltip formatter={v => fmtD(v) + '분'} />
                <Legend />
                <Bar dataKey="globalAvg" name="전체평균" fill="#95a5a6" />
                {hogiList.map((h, i) => (
                  <Bar key={h} dataKey={d => d.hogiTimes[h] || 0} name={h} fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      {/* ═══ 3. 호기별 원가단가표 ═══ */}
      <Section title="3. 호기별 원가단가표 (공법+지질)">
        {hogiList.map((hogi, hi) => {
          const ha = hogiAlloc[hogi];
          if (!ha) return null;
          const sortedItems = Object.entries(ha.items).sort(([a], [b]) => {
            const MO = ['T4', '토네이도', '트리콘'], GO = ['토사', '풍화암', '연암', '보통암', '경암'];
            const pa = a.split('|'), pb = b.split('|');
            const mi = MO.indexOf(pa[0]) < 0 ? 99 : MO.indexOf(pa[0]);
            const mj = MO.indexOf(pb[0]) < 0 ? 99 : MO.indexOf(pb[0]);
            if (mi !== mj) return mi - mj;
            return (GO.indexOf(pa[1]) < 0 ? 99 : GO.indexOf(pa[1])) - (GO.indexOf(pb[1]) < 0 ? 99 : GO.indexOf(pb[1]));
          });

          return (
            <div key={hogi} style={{ marginBottom: 16 }}>
              <div style={{
                padding: '8px 12px', borderRadius: '6px 6px 0 0', fontWeight: 'bold', fontSize: 12,
                background: ha.hasTime ? '#e3f2fd' : '#fff3e0',
                borderLeft: `4px solid ${COLORS[hi % COLORS.length]}`
              }}>
                📌 {hogi} | 투입비: {fmt(ha.totalCost)}원
                <span style={{ fontSize: 10, color: '#888', marginLeft: 8 }}>
                  [직접 {fmt(ha.directCost)} + 공통 {fmt(ha.commonCost)}]
                </span>
                {!ha.hasTime && <span style={{ color: '#e65100', marginLeft: 8 }}>⚠️ 시간미입력(균등배분)</span>}
              </div>
              <table className="data-table" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>공법</th><th>지질</th><th>물량(m)</th><th>시간(분)</th>
                    <th>시간비율</th><th>배분비</th><th>원가/m</th><th>계약단가</th><th>차이</th><th>판정</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map(([key, it]) => (
                    <tr key={key}>
                      <td style={{ background: M_BG[it.method] || '#fff', fontWeight: 'bold' }}>{it.method}</td>
                      <td>{it.geo}</td>
                      <td>{fmtD(it.qty)}</td>
                      <td style={{ color: it.timeSource === 'own' ? '#333' : '#999' }}>
                        {it.timeSource === 'own' ? fmtD(it.avgTime) : it.timeSource === 'no_data' ? '균등' : '-'}
                      </td>
                      <td>{pct(it.timeRatio)}</td>
                      <td>{fmt(it.allocated)}</td>
                      <td style={{ fontWeight: 'bold' }}>{fmt(it.unitCost)}</td>
                      <td>{it.contractPrice > 0 ? fmt(it.contractPrice) : '-'}</td>
                      <td style={{ fontWeight: 'bold', color: pc(it.diff) }}>
                        {it.contractPrice > 0 ? fmtSign(it.diff) : '-'}
                      </td>
                      <td style={{ fontWeight: 'bold', color: it.judge === '이익' ? 'var(--pos)' : it.judge === '손실' ? 'var(--neg)' : '#888' }}>
                        {it.judge}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#fff9e6', fontWeight: 'bold' }}>
                    <td colSpan={2}>{hogi} 합계</td>
                    <td>{fmtD(ha.totalQty)}</td>
                    <td></td><td>100%</td>
                    <td>{fmt(ha.totalCost)}</td>
                    <td>{ha.totalQty > 0 ? fmt(Math.round(ha.totalCost / ha.totalQty)) : '-'}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </Section>

      {/* ═══ 4. 전체 원가 vs 계약단가 ═══ */}
      <Section title="4. 전체 원가 vs 계약단가 비교">
        <div className="grid-2-1">
          <table className="data-table">
            <thead>
              <tr><th>공법</th><th>지질</th><th>물량(m)</th><th>투입비</th><th>원가/m</th><th>계약단가</th><th>차이</th><th>판정</th></tr>
            </thead>
            <tbody>
              {Object.entries(allItems).sort(([a], [b]) => {
                const MO = ['T4', '토네이도', '트리콘'], GO = ['토사', '풍화암', '연암', '보통암', '경암'];
                const pa = a.split('|'), pb = b.split('|');
                return ((MO.indexOf(pa[0]) < 0 ? 99 : MO.indexOf(pa[0])) - (MO.indexOf(pb[0]) < 0 ? 99 : MO.indexOf(pb[0]))) ||
                  ((GO.indexOf(pa[1]) < 0 ? 99 : GO.indexOf(pa[1])) - (GO.indexOf(pb[1]) < 0 ? 99 : GO.indexOf(pb[1])));
              }).map(([key, it]) => (
                <tr key={key}>
                  <td style={{ background: M_BG[it.method], fontWeight: 'bold' }}>{it.method}</td>
                  <td>{it.geo}</td>
                  <td>{fmtD(it.qty)}</td>
                  <td>{fmt(it.cost)}</td>
                  <td style={{ fontWeight: 'bold' }}>{fmt(it.unitCost)}</td>
                  <td>{it.contractPrice > 0 ? fmt(it.contractPrice) : '-'}</td>
                  <td style={{ fontWeight: 'bold', color: pc(it.diff) }}>{it.contractPrice > 0 ? fmtSign(it.diff) : '-'}</td>
                  <td style={{ fontWeight: 'bold', color: it.judge === '이익' ? 'var(--pos)' : it.judge === '손실' ? 'var(--neg)' : '#888' }}>{it.judge}</td>
                </tr>
              ))}
              <tr style={{ background: '#fff9e6', fontWeight: 'bold' }}>
                <td colSpan={2}>합계</td>
                <td>{fmtD(totalQty)}</td>
                <td>{fmt(totalCost)}</td>
                <td>{fmt(avgCPM)}</td>
                <td>{totalQty > 0 ? fmt(Math.round(Object.values(allItems).reduce((s, i) => s + i.qty * i.contractPrice, 0) / totalQty)) : '-'}</td>
                <td></td><td></td>
              </tr>
            </tbody>
          </table>

          {/* 원가 vs 계약단가 바 차트 */}
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={Object.values(allItems).filter(i => i.contractPrice > 0)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 9 }} />
              <YAxis dataKey={d => d.method + ' ' + d.geo} type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={v => fmt(v) + '원'} />
              <Legend />
              <Bar dataKey="unitCost" name="원가/m" fill="#c62828" />
              <Bar dataKey="contractPrice" name="계약단가" fill="#2e7d32" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* ═══ 5. 호기별 효율 순위 ═══ */}
      <Section title="5. 호기별 효율 순위">
        <table className="data-table" style={{ maxWidth: 600 }}>
          <thead>
            <tr><th>순위</th><th>호기</th><th>평균원가/m</th><th>원가효율</th><th>비고</th></tr>
          </thead>
          <tbody>
            {ranks.map(r => (
              <tr key={r.hogi} style={r.rank === 1 ? { background: '#e8f5e9' } : {}}>
                <td style={{ fontWeight: 'bold' }}>{r.rank}위</td>
                <td style={{ fontWeight: 'bold' }}>{r.hogi}</td>
                <td style={{ fontWeight: 'bold' }}>{fmt(r.avgUC)}원</td>
                <td style={{ fontWeight: 'bold', color: r.efficiency >= 0.9 ? 'var(--pos)' : 'var(--warn)' }}>{pct(r.efficiency)}</td>
                <td style={{ color: '#ff9800' }}>{!r.hasTime ? '시간미입력' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return <div className="card"><div className="card-title">{title}</div>{children}</div>;
}
function KPI({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: 16 }}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
