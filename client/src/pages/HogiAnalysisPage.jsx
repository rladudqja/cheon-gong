import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';

const fmt = (n) => n == null ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtD = (n) => n == null ? '0' : Number(n).toFixed(1);
const fmtSign = (n) => (n >= 0 ? '+' : '') + fmt(n);
const pct = (n) => (n * 100).toFixed(1) + '%';
const COLORS = ['#1e3c72', '#e65100', '#6a1b9a', '#2e7d32', '#c62828', '#00695c', '#f57c00'];
const profitColor = (v) => v >= 0 ? 'var(--pos)' : 'var(--neg)';
const rankColor = (eff) => eff >= 90 ? 'var(--pos)' : eff >= 80 ? 'var(--warn)' : 'var(--neg)';
const trendColor = (t) => t.includes('↑') ? 'var(--pos)' : t.includes('↓') ? 'var(--neg)' : 'var(--text-muted)';

export default function HogiAnalysisPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);

  const load = () => api.get(`/reports/hogi-analysis?to=${date}`).then(setData);
  useEffect(load, [date]);

  if (!data) return <div className="page-title">로딩 중...</div>;

  const { hogiDetails, summary: sum } = data;
  const wdpm = parseInt(data.config?.work_days_per_month) || 25;

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>🔧 호기별 효율분석</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '8px 12px', border: '2px solid var(--primary)', borderRadius: 8, fontSize: 14, fontWeight: 'bold' }} />
      </div>

      {/* KPI */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <KPI label="가동 호기" value={sum.hogiCount + '대'} />
        <KPI label="총 천공" value={fmtD(sum.totalQty) + 'm'} sub={sum.totalWorkDays + '일'} />
        <KPI label="총 기성" value={fmt(sum.totalRevenue)} sub="직접비" />
        <KPI label="총 투입비" value={fmt(sum.totalCostAll)} sub={'미배분 ' + fmt(sum.unassignedCost)} />
        <KPI label="최고 일평균" value={fmtD(sum.bestAdjAvg) + 'm'} sub="보정값 기준" />
        <KPI label="최저 L/m" value={sum.bestLM > 0 ? sum.bestLM.toFixed(2) : '-'} sub="유류효율 1위" />
      </div>

      {/* ═══ 1. 호기별 작업내역 ═══ */}
      <Section title="1. 호기별 작업내역 (일일/누계) — 직접비 기준">
        <div style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>호기</th><th>업체</th><th>규격</th><th>운전자</th><th>댓수</th>
                <th>구경</th><th>투입기간</th><th>실가동<br/>(투입일)</th>
                <th>천공(m)</th><th>기성</th><th>투입비</th><th>손익</th>
                <th>일평균</th><th>순위</th><th>1위대비</th><th>m/단가</th><th>평균일대</th>
              </tr>
            </thead>
            <tbody>
              {hogiDetails.map(h => {
                const profit = h.revenue - h.totalCost;
                const avgMonthly = h.deployDays >= wdpm ? h.avgDailyRent * wdpm : 0;
                return (
                  <tr key={h.hogi} style={h.rank === 1 ? { background: '#fff9e6' } : {}}>
                    <td style={{ fontWeight: 'bold' }}>{h.hogi}</td>
                    <td>{h.company}</td>
                    <td>{h.spec}</td>
                    <td>{h.driver}</td>
                    <td>{h.equipCount}대</td>
                    <td>{h.diameter ? h.diameter + 'mm' : '-'}</td>
                    <td style={{ fontSize: 11 }}>
                      {h.startDate ? h.startDate.slice(5) : ''}{h.endDate ? '~' + h.endDate.slice(5) : '~'}
                    </td>
                    <td>{h.workDays}일({h.deployDays}일)</td>
                    <td style={{ fontWeight: 'bold' }}>{fmtD(h.totalQty)}</td>
                    <td>{fmt(h.revenue)}</td>
                    <td>{fmt(h.totalCost)}</td>
                    <td style={{ fontWeight: 'bold', color: profitColor(profit) }}>{fmtSign(profit)}</td>
                    <td>
                      {fmtD(h.dailyAvg)}
                      {h.adjFactor > 1 && <span style={{ color: '#0d6efd', fontSize: 10 }}><br/>({fmtD(h.adjAvg)})</span>}
                    </td>
                    <td style={{ fontWeight: 'bold' }}>{h.rank}위</td>
                    <td style={{ fontWeight: 'bold', color: rankColor(h.efficiency) }}>{h.efficiency.toFixed(1)}%</td>
                    <td>{fmt(h.mPerDanga)}</td>
                    <td>{fmt(h.avgDailyRent)}</td>
                  </tr>
                );
              })}
              {/* 합계 */}
              <tr style={{ background: '#e9ecef', fontWeight: 'bold' }}>
                <td>합계</td><td>{sum.hogiCount}대</td><td colSpan={3}></td><td></td><td></td>
                <td>{sum.totalWorkDays}일({sum.totalDeployDays}일)</td>
                <td>{fmtD(sum.totalQty)}</td>
                <td>{fmt(sum.totalRevenue)}</td>
                <td>{fmt(sum.totalCostAll)}</td>
                <td style={{ color: profitColor(sum.totalRevenue - sum.totalCostAll) }}>
                  {fmtSign(sum.totalRevenue - sum.totalCostAll)}
                </td>
                <td>{sum.totalWorkDays > 0 ? fmtD(sum.totalQty / sum.totalWorkDays) : '-'}</td>
                <td colSpan={2}></td>
                <td>{sum.totalQty > 0 ? fmt(Math.round(sum.totalCostAll / sum.totalQty)) : '-'}</td>
                <td>{sum.totalDeployDays > 0 ? fmt(Math.round(sum.totalCostAll / sum.totalDeployDays)) : '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ═══ 2. 투입비 상세 ═══ */}
      <Section title="2. 투입비 상세 (장비대/유류비 분리)">
        <div style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>호기</th><th>업체</th>
                {getEquipTypes(hogiDetails).map(t => (
                  <React.Fragment key={t}>
                    <th style={{ background: '#e3f2fd', fontSize: 10 }}>{t}<br/>장비대</th>
                    <th style={{ background: '#fff3e0', fontSize: 10 }}>{t}<br/>유류비</th>
                  </React.Fragment>
                ))}
                <th>공통분배</th><th style={{ fontWeight: 'bold' }}>총투입비</th><th>평균일대</th>
              </tr>
            </thead>
            <tbody>
              {hogiDetails.map(h => (
                <tr key={h.hogi}>
                  <td style={{ fontWeight: 'bold' }}>{h.hogi}</td>
                  <td>{h.company}</td>
                  {getEquipTypes(hogiDetails).map(t => {
                    const d = h.cost.byEquipType[t] || {};
                    return (
                      <React.Fragment key={t}>
                        <td style={{ color: '#0d6efd' }}>{d.equipCost ? fmt(d.equipCost) : '-'}</td>
                        <td style={{ color: '#e65100' }}>{d.fuelCost ? fmt(d.fuelCost) : '-'}</td>
                      </React.Fragment>
                    );
                  })}
                  <td>{fmt(h.commonCost)}</td>
                  <td style={{ fontWeight: 'bold' }}>{fmt(h.totalCost)}</td>
                  <td>{fmt(h.avgDailyRent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          ※ 미배분 투입비 {fmt(sum.unassignedCost)}원 → 가동일수 비례 분배
        </div>
      </Section>

      {/* ═══ 3. 기간별 효율 비교 ═══ */}
      <Section title="3. 호기별 기간별 효율 비교">
        <div style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th rowSpan={2}>호기</th><th rowSpan={2}>업체</th>
                <th colSpan={4} style={{ background: '#e3f2fd' }}>T4 (m/일)</th>
                <th colSpan={4} style={{ background: '#fff3e0' }}>토네이도 (m/일)</th>
                <th colSpan={4} style={{ background: '#e8f5e9' }}>합계 (m/일)</th>
                <th rowSpan={2}>추세</th><th rowSpan={2}>평가</th>
              </tr>
              <tr>
                {[0, 1, 2].map(i => (
                  <React.Fragment key={i}>
                    <th style={{ fontSize: 10 }}>5일</th><th style={{ fontSize: 10 }}>10일</th>
                    <th style={{ fontSize: 10 }}>20일</th><th style={{ fontSize: 10 }}>한달</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {hogiDetails.map(h => {
                const ps = h.periodStats;
                return (
                  <tr key={h.hogi} style={
                    h.trendLabel === '개선' ? { background: '#d4edda' } :
                    h.trendLabel === '악화' ? { background: '#f8d7da' } :
                    h.trendLabel === '주의' ? { background: '#fff3cd' } : {}
                  }>
                    <td style={{ fontWeight: 'bold' }}>{h.hogi}</td>
                    <td>{h.company}</td>
                    <PeriodCells ps={ps} method="t4" />
                    <PeriodCells ps={ps} method="tornado" />
                    <PeriodCells ps={ps} method="total" />
                    <td style={{ fontWeight: 'bold', color: trendColor(h.trend), fontSize: 16 }}>{h.trend}</td>
                    <td style={{ fontWeight: 'bold', color: trendColor(h.trend) }}>{h.trendLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ═══ 4. 정상/비정상 가동일 통계 ═══ */}
      <Section title="4. 정상/비정상 가동일 통계">
        <div style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>호기</th><th>업체</th>
                <th style={{ background: '#e8f5e9' }}>정상일수</th>
                <th style={{ background: '#e8f5e9' }}>정상물량</th>
                <th style={{ background: '#e8f5e9' }}>정상평균</th>
                <th style={{ background: '#ffebee' }}>비정상일수</th>
                <th style={{ background: '#ffebee' }}>비정상물량</th>
                <th>전체일수</th><th>전체평균</th>
                <th>차이<br/>(정상-전체)</th>
                <th>비정상 사유</th>
              </tr>
            </thead>
            <tbody>
              {hogiDetails.map(h => {
                const diff = h.normal.avg - (h.workDays > 0 ? h.totalQty / h.workDays : 0);
                const reasons = Object.entries(h.abnormal.details).map(([k, v]) => `${k}(${v.days}일)`).join(', ');
                return (
                  <tr key={h.hogi}>
                    <td style={{ fontWeight: 'bold' }}>{h.hogi}</td>
                    <td>{h.company}</td>
                    <td>{h.normal.days}일</td>
                    <td>{fmtD(h.normal.qty)}</td>
                    <td style={{ fontWeight: 'bold' }}>{fmtD(h.normal.avg)}m</td>
                    <td style={{ color: h.abnormal.days > 0 ? 'var(--neg)' : 'inherit', fontWeight: h.abnormal.days > 0 ? 'bold' : 'normal' }}>
                      {h.abnormal.days > 0 ? h.abnormal.days + '일' : '-'}
                    </td>
                    <td>{h.abnormal.qty > 0 ? fmtD(h.abnormal.qty) : '-'}</td>
                    <td>{h.workDays}일</td>
                    <td>{fmtD(h.dailyAvg)}m</td>
                    <td style={{ fontWeight: 'bold', color: profitColor(diff) }}>{diff >= 0 ? '+' : ''}{fmtD(diff)}m</td>
                    <td style={{ fontSize: 11 }}>{reasons || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ═══ 5. 유류 효율 분석 ═══ */}
      <Section title="5. 유류 효율 분석 (L/m — 낮을수록 효율적)">
        <div className="grid-2-1">
          <table className="data-table">
            <thead>
              <tr>
                <th>호기</th><th>업체</th><th>천공(m)</th><th>경유(L)</th>
                <th style={{ background: '#fff3e0' }}>L/m</th><th>순위</th><th>평가</th>
                <th>유류금액</th><th>일평균유류비</th>
              </tr>
            </thead>
            <tbody>
              {hogiDetails.map(h => {
                const dailyFuel = h.workDays > 0 ? Math.round(h.cost.fuel / h.workDays) : 0;
                const evalText = h.lmRank === 1 ? '최고' :
                  h.lmEff >= 90 ? '우수' : h.lmEff >= 80 ? '양호' : h.lmEff >= 70 ? '보통' : '과다';
                const evalColor = h.lmRank === 1 ? '#ffc107' :
                  h.lmEff >= 90 ? 'var(--pos)' : h.lmEff >= 80 ? '#17a2b8' : h.lmEff >= 70 ? 'var(--text-muted)' : 'var(--neg)';
                return (
                  <tr key={h.hogi} style={h.lmRank === 1 ? { background: '#fff9e6' } : {}}>
                    <td style={{ fontWeight: 'bold' }}>{h.hogi}</td>
                    <td>{h.company}</td>
                    <td>{fmtD(h.totalQty)}</td>
                    <td>{fmt(h.cost.fuelQty)}</td>
                    <td style={{ fontWeight: 'bold', background: '#fff8ef' }}>{h.lPerM > 0 ? h.lPerM.toFixed(2) : '-'}</td>
                    <td style={{ fontWeight: 'bold' }}>{h.lmRank !== '-' ? h.lmRank + '위' : '-'}</td>
                    <td style={{ fontWeight: 'bold', color: evalColor }}>{h.lPerM > 0 ? evalText : '-'}</td>
                    <td>{fmt(h.cost.fuel)}</td>
                    <td>{fmt(dailyFuel)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* L/m 비교 바 차트 */}
          <div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hogiDetails.filter(h => h.lPerM > 0)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="hogi" type="category" tick={{ fontSize: 11 }} width={55} />
                <Tooltip formatter={v => v.toFixed(2) + ' L/m'} />
                <Bar dataKey="lPerM" fill="#e65100" radius={[0, 4, 4, 0]} name="L/m" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* ═══ 6. 비효율 호기 경보 ═══ */}
      {(() => {
        const warnings = hogiDetails.filter(h => h.efficiency < 80 && h.dailyAvg > 0);
        if (warnings.length === 0) {
          return (
            <Section title="6. 비효율 호기 경보">
              <div style={{ padding: 16, background: '#d4edda', borderRadius: 8, textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>
                전체 {sum.hogiCount}대 정상 (1위 대비 80% 이상) — 비효율 경보 없음
              </div>
            </Section>
          );
        }
        return (
          <Section title={'6. 비효율 호기 경보 — ' + warnings.length + '대 (' + warnings.map(w => w.hogi).join(', ') + ')'}>
            <div style={{ background: '#fff3cd', padding: 12, borderRadius: 8, marginBottom: 12, fontWeight: 'bold' }}>
              ⚠️ {warnings.length}대 비효율 / 전체 {sum.hogiCount}대
            </div>
            <table className="data-table">
              <thead>
                <tr><th>호기</th><th>업체/운전자</th><th>순위</th><th>일평균</th><th>1위대비</th><th>추세</th><th>원인</th><th>권장조치</th></tr>
              </thead>
              <tbody>
                {warnings.map(h => {
                  const gap = sum.bestAdjAvg - h.adjAvg;
                  const cause = h.trend.includes('↓') ? '하락 추세' : '전반 저효율';
                  const action = h.trend === '⛔' ? '가동확인' : '1위(' + hogiDetails[0]?.hogi + ') 벤치마킹';
                  return (
                    <tr key={h.hogi} style={{ background: '#f8d7da' }}>
                      <td style={{ fontWeight: 'bold' }}>{h.hogi}</td>
                      <td>{h.company}/{h.driver}</td>
                      <td>{h.rank}위</td>
                      <td>{fmtD(h.dailyAvg)}</td>
                      <td style={{ color: 'var(--neg)', fontWeight: 'bold' }}>{h.efficiency.toFixed(0)}% (−{fmtD(gap)}m)</td>
                      <td style={{ color: trendColor(h.trend), fontWeight: 'bold' }}>{h.trend}</td>
                      <td>{cause}</td>
                      <td style={{ color: 'var(--neg)', fontWeight: 'bold' }}>{action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        );
      })()}

      {/* ═══ 7. 레이더 차트 (호기 비교) ═══ */}
      {hogiDetails.length >= 2 && (
        <Section title="7. 호기별 종합 비교">
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={buildRadarData(hogiDetails, sum)}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
              {hogiDetails.map((h, i) => (
                <Radar key={h.hogi} name={h.hogi} dataKey={h.hogi}
                  stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
              ))}
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </Section>
      )}
    </div>
  );
}

// ── 하위 컴포넌트 ──

function KPI({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: 18 }}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
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

function PeriodCells({ ps, method }) {
  const keys = ['d5', 'd10', 'd20', 'd30'];
  return keys.map(k => {
    const v = ps[k]?.[method]?.avg || 0;
    return <td key={k}>{v > 0 ? fmtD(v) : '-'}</td>;
  });
}

function getEquipTypes(hogiDetails) {
  const set = new Set();
  hogiDetails.forEach(h => {
    Object.keys(h.cost.byEquipType).forEach(t => set.add(t));
  });
  const priority = { '항타기': 1, '압축기': 2 };
  return [...set].sort((a, b) => (priority[a] || 99) - (priority[b] || 99));
}

function buildRadarData(details, sum) {
  const metrics = [
    { label: '일평균(m)', key: 'dailyAvg', max: sum.bestAdjAvg * 1.2 || 1 },
    { label: '정상가동률', key: h => h.workDays > 0 ? h.normal.days / h.workDays * 100 : 0, max: 100 },
    { label: '유류효율', key: h => h.lPerM > 0 ? (sum.bestLM / h.lPerM) * 100 : 0, max: 100 },
    { label: '비용효율', key: h => h.mPerDanga > 0 ? (Math.min(...details.map(d => d.mPerDanga || 999999)) / h.mPerDanga) * 100 : 0, max: 100 },
    { label: '추세', key: h => h.trend.includes('↑↑') ? 100 : h.trend.includes('↑') ? 80 : h.trend === '→' ? 60 : h.trend.includes('↓↓') ? 20 : 40, max: 100 },
  ];
  return metrics.map(m => {
    const row = { metric: m.label };
    details.forEach(h => {
      const raw = typeof m.key === 'function' ? m.key(h) : h[m.key] || 0;
      row[h.hogi] = Math.min(Math.round(raw / m.max * 100), 100);
    });
    return row;
  });
}

PeriodCells.displayName = 'PeriodCells';
