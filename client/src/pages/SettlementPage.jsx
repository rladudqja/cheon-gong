import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const fmt = (n) => n == null ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtD = (n) => n == null ? '0' : Number(n).toFixed(1);
const fmtSign = (n) => (n >= 0 ? '+' : '') + fmt(n);
const pct = (n) => (n * 100).toFixed(1) + '%';
const pc = (v) => v >= 0 ? 'var(--pos)' : 'var(--neg)';
const monthLabel = (m) => { const [y, mo] = m.split('-'); return parseInt(mo) + '월'; };

export default function SettlementPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);

  const load = () => api.get(`/reports/settlement?to=${month}`).then(setData);
  useEffect(load, [month]);

  if (!data) return <div className="page-title">로딩 중...</div>;

  const { contract: ct, gisung: g, cost, profit, profitRate, kpi, hogiAnalysis, monthlyTrend, comments, bestAvg } = data;

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>📋 정산보고서</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: '8px 12px', border: '2px solid var(--primary)', borderRadius: 8, fontSize: 14, fontWeight: 'bold' }} />
      </div>

      {/* ═══ 상단 KPI 3블록 ═══ */}
      <div style={{ background: 'var(--primary)', color: '#fff', padding: '8px 16px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 'bold', textAlign: 'center', letterSpacing: 1 }}>
        총공사기간 | 투입일수 {fmt(kpi.totalDeployDays)}일 | 실가동일수 {fmt(kpi.totalDays)}일
      </div>
      <div className="grid-3" style={{ gap: 0, marginBottom: 20 }}>
        <Block title="1. 계약금액 (직접비)" rows={[
          ['당초계약', fmt(ct.sumA0) + '원'],
          ['변경계약', fmt(ct.sumA1) + '원'],
          ['증감', fmtSign(ct.sumA1 - ct.sumA0) + '원 (' + pct(ct.sumA0 > 0 ? (ct.sumA1 - ct.sumA0) / ct.sumA0 : 0) + ')', ct.sumA1 >= ct.sumA0 ? 'var(--pos)' : 'var(--neg)'],
        ]} border="left" />
        <Block title="2. 투입·손익 (직접비)" rows={[
          ['투입비총액', fmt(cost.total) + '원'],
          ['손익', fmtSign(g.direct1 - cost.total) + '원 (' + pct(g.direct1 > 0 ? (g.direct1 - cost.total) / g.direct1 : 0) + ')', pc(g.direct1 - cost.total)],
          ['', '장비대·유류·자재·노무 합계', '#888'],
        ]} border="" />
        <Block title="3. 일평균 지표" rows={[
          ['일평균천공', fmtD(kpi.totalAvg) + ' m/일'],
          ['', '(정상 ' + fmtD(kpi.normalAvg) + 'm/일 · 효율 ' + kpi.normalRate.toFixed(1) + '%)', '#888'],
          ['일평균일대', fmt(kpi.avgDailyRent) + ' 원/일'],
        ]} border="right" />
      </div>

      {/* ═══ 1. 계약 비교 ═══ */}
      <Section title="1. 계약 비교 (당초 → 변경 → 실기성)">
        <div style={{ overflow: 'auto' }}>
          <table className="data-table" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th>공법</th><th>지질</th><th>단가</th>
                <th colSpan={2}>당초</th><th colSpan={2}>변경</th>
                <th colSpan={2} style={{ background: '#fff3e0' }}>변경−당초</th>
                <th colSpan={2}>실기성</th>
                <th colSpan={2}>실기성−변경</th>
              </tr>
              <tr>
                <th></th><th></th><th></th>
                <th>수량</th><th>금액</th><th>수량</th><th>금액</th>
                <th>수량</th><th>금액</th>
                <th>수량</th><th>금액</th><th>수량</th><th>금액</th>
              </tr>
            </thead>
            <tbody>
              {ct.items.map((r, i) => {
                const dq1 = r.q1 - r.q0, da1 = r.a1 - r.a0;
                const dqA = r.qA - r.q1, daA = r.aA - r.a1;
                return (
                  <tr key={i} style={i % 2 === 1 ? { background: '#fafafa' } : {}}>
                    <td>{r.method}</td><td>{r.geology}</td><td>{fmt(r.price)}</td>
                    <td>{fmt(r.q0)}</td><td>{fmt(r.a0)}</td>
                    <td>{fmt(r.q1)}</td><td>{fmt(r.a1)}</td>
                    <td style={{ color: pc(dq1), fontWeight: dq1 !== 0 ? 'bold' : '' }}>{dq1 !== 0 ? fmtSign(dq1) : '-'}</td>
                    <td style={{ color: pc(da1), fontWeight: da1 !== 0 ? 'bold' : '' }}>{da1 !== 0 ? fmtSign(da1) : '-'}</td>
                    <td>{fmt(r.qA)}</td><td>{fmt(r.aA)}</td>
                    <td style={{ color: pc(dqA) }}>{dqA !== 0 ? fmtSign(dqA) : '-'}</td>
                    <td style={{ color: pc(daA) }}>{daA !== 0 ? fmtSign(daA) : '-'}</td>
                  </tr>
                );
              })}
              {/* 부대항목 */}
              {ct.subItems.map((si, i) => (
                <tr key={'sub' + i} style={{ background: '#f8f9fa' }}>
                  <td>{si.method}</td><td>-</td><td>{fmt(si.price)}</td>
                  <td>{fmt(si.qty_orig)}</td><td>{fmt(si.amt_orig)}</td>
                  <td>{fmt(si.qty_mod)}</td><td>{fmt(si.amt_mod)}</td>
                  <td style={{ color: pc(si.qty_mod - si.qty_orig) }}>{fmtSign(si.qty_mod - si.qty_orig)}</td>
                  <td style={{ color: pc(si.amt_mod - si.amt_orig) }}>{fmtSign(si.amt_mod - si.amt_orig)}</td>
                  <td colSpan={4} style={{ color: '#888' }}>부대항목</td>
                </tr>
              ))}
              {/* 합계 */}
              <tr style={{ background: 'var(--primary)', color: '#fff', fontWeight: 'bold' }}>
                <td colSpan={3}>합계</td>
                <td></td><td>{fmt(ct.sumA0)}</td>
                <td></td><td>{fmt(ct.sumA1)}</td>
                <td></td><td style={{ color: ct.sumA1 >= ct.sumA0 ? '#b8f0c1' : '#f5b0b8' }}>{fmtSign(ct.sumA1 - ct.sumA0)}</td>
                <td></td><td>{fmt(data.actDirectTotal)}</td>
                <td></td><td style={{ color: data.actDirectTotal >= ct.sumA1 ? '#b8f0c1' : '#f5b0b8' }}>{fmtSign(data.actDirectTotal - ct.sumA1)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 공법별 비교 요약 */}
        {Object.keys(ct.methodSums).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>공법별 물량 비교 (당초 vs 변경)</div>
            <table className="data-table" style={{ maxWidth: 600 }}>
              <thead><tr><th>공법</th><th>당초</th><th>변경</th><th>증감</th></tr></thead>
              <tbody>
                {Object.entries(ct.methodSums).map(([m, ms]) => {
                  const d = ms.q1 - ms.q0;
                  return (
                    <tr key={m}>
                      <td style={{ fontWeight: 'bold' }}>{m}</td>
                      <td>{fmt(ms.q0)}m</td><td>{fmt(ms.q1)}m</td>
                      <td style={{ fontWeight: 'bold', color: pc(d) }}>{d !== 0 ? fmtSign(d) + 'm' : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ═══ 2. 손익 분석 ═══ */}
      <Section title="2. 손익 분석 (기성 vs 투입비)">
        <div className="grid-2" style={{ marginBottom: 16 }}>
          {/* 기성 블록 */}
          <div style={{ border: '2px solid #2e7d32', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: '#2e7d32', color: '#fff', padding: '8px 12px', fontWeight: 'bold', textAlign: 'center' }}>기성 (변경계약 기준)</div>
            <div style={{ padding: 12 }}>
              <Row k="직접비" v={fmt(g.direct1)} />
              <Row k="간접비" v={fmt(g.ind1)} sub={g.indItems.map(i => i.item + ' ' + (i.rate * 100).toFixed(1) + '%').join(' + ')} />
              <div style={{ borderTop: '2px solid #2e7d32', marginTop: 8, paddingTop: 8, fontWeight: 'bold', fontSize: 16, textAlign: 'right' }}>
                합계: {fmt(g.total1)}원
              </div>
            </div>
          </div>
          {/* 투입비 블록 */}
          <div style={{ border: '2px solid #c62828', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: '#c62828', color: '#fff', padding: '8px 12px', fontWeight: 'bold', textAlign: 'center' }}>투입비</div>
            <div style={{ padding: 12 }}>
              <Row k="장비대" v={fmt(cost.equipment)} />
              <Row k="유류비" v={fmt(cost.fuel)} />
              <Row k="자재비" v={fmt(cost.material)} />
              <Row k="노무비" v={fmt(cost.labor)} />
              <Row k="직접비 합계" v={fmt(cost.total)} bold />
              <Row k="간접비" v={fmt(cost.indirect)} sub={data.cost.indItems?.map(i => i.item + ' ' + (i.rate * 100).toFixed(1) + '%').join(' + ')} />
              <div style={{ borderTop: '2px solid #c62828', marginTop: 8, paddingTop: 8, fontWeight: 'bold', fontSize: 16, textAlign: 'right' }}>
                합계: {fmt(cost.grandTotal)}원
              </div>
            </div>
          </div>
        </div>

        {/* 손익 바 */}
        <div style={{
          padding: '12px 20px', borderRadius: 8, textAlign: 'center', fontWeight: 'bold', fontSize: 14,
          background: profit >= 0 ? '#e8f5e9' : '#ffebee',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12
        }}>
          <span style={{ background: 'var(--primary)', color: '#fff', padding: '4px 14px', borderRadius: 4 }}>손익</span>
          <span>기성 {fmt(g.total1)} − 투입 {fmt(cost.grandTotal)} =</span>
          <span style={{ fontSize: 22, color: pc(profit) }}>{fmtSign(profit)}원</span>
          <span style={{ color: pc(profit) }}>({pct(profitRate)})</span>
        </div>

        {/* 평균단가 */}
        <table className="data-table" style={{ maxWidth: 500, margin: '16px auto 0' }}>
          <thead><tr><th>구분</th><th>기성 평균단가</th><th>투입 평균단가</th><th>차이</th></tr></thead>
          <tbody>
            <tr>
              <td>간접비 포함</td>
              <td>{data.actTotalQty > 0 ? fmt(Math.round(g.total1 / data.actTotalQty)) : '-'}원</td>
              <td>{data.actTotalQty > 0 ? fmt(Math.round(cost.grandTotal / data.actTotalQty)) : '-'}원</td>
              <td style={{ fontWeight: 'bold', color: pc(g.total1 - cost.grandTotal) }}>
                {data.actTotalQty > 0 ? fmtSign(Math.round((g.total1 - cost.grandTotal) / data.actTotalQty)) + '원' : '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* ═══ 3. 월별 손익 추이 ═══ */}
      <Section title="3. 월별 손익 추이">
        <div className="grid-2">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={monthLabel} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => (v / 10000).toFixed(0) + '만'} />
              <Tooltip formatter={v => fmt(v) + '원'} />
              <Legend />
              <Bar dataKey="gisungTotal" name="기성" fill="#2e7d32" opacity={0.7} />
              <Bar dataKey="toipTotal" name="투입" fill="#c62828" opacity={0.7} />
              <Line dataKey="profit" name="손익" stroke="#1e3c72" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={monthLabel} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => (v / 10000).toFixed(0) + '만'} />
              <Tooltip formatter={v => fmt(v) + '원'} />
              <Line dataKey="cumProfit" name="누적손익" stroke="#1e3c72" strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead><tr><th>월</th><th>물량</th><th>기성</th><th>투입</th><th>손익</th><th>누적손익</th></tr></thead>
          <tbody>
            {monthlyTrend.map((m, i) => (
              <tr key={m.month} style={i % 2 === 1 ? { background: '#fafafa' } : {}}>
                <td>{monthLabel(m.month)}</td><td>{fmtD(m.qty)}m</td>
                <td>{fmt(m.gisungTotal)}</td><td>{fmt(m.toipTotal)}</td>
                <td style={{ fontWeight: 'bold', color: pc(m.profit) }}>{fmtSign(m.profit)}</td>
                <td style={{ fontWeight: 'bold', color: pc(m.cumProfit) }}>{fmtSign(m.cumProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ═══ 4. 호기별 효율 ═══ */}
      <Section title="4. 호기별 효율 분석">
        <table className="data-table">
          <thead><tr><th>순위</th><th>호기</th><th>업체</th><th>규격</th><th>천공(m)</th><th>가동일</th><th>일평균</th><th>투입비</th><th>m당단가</th><th>1위대비</th></tr></thead>
          <tbody>
            {hogiAnalysis.map(h => (
              <tr key={h.hogi} style={h.rank === 1 ? { background: '#fff9e6' } : {}}>
                <td style={{ fontWeight: 'bold' }}>{h.rank}위</td>
                <td style={{ fontWeight: 'bold' }}>{h.hogi}</td>
                <td>{h.company}</td><td>{h.spec}</td>
                <td>{fmtD(h.qty)}</td><td>{h.days}일</td>
                <td style={{ fontWeight: 'bold' }}>{fmtD(h.avg)}m</td>
                <td>{fmt(h.cost)}</td>
                <td>{fmt(Math.round(h.cpm))}</td>
                <td style={{ fontWeight: 'bold', color: bestAvg > 0 && h.avg / bestAvg >= 0.8 ? 'var(--pos)' : 'var(--neg)' }}>
                  {bestAvg > 0 ? (h.avg / bestAvg * 100).toFixed(0) + '%' : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ═══ 5. 총평 ═══ */}
      <Section title="5. 총평">
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <KPI label="당초계약금액" value={fmt(g.total0)} sub="간접비 포함" />
          <KPI label="변경계약금액" value={fmt(g.total1)} sub="간접비 포함" />
          <KPI label="증감" value={fmtSign(g.total1 - g.total0)} color={pc(g.total1 - g.total0)} />
          <KPI label="총투입비" value={fmt(cost.grandTotal)} />
          <KPI label="최종 손익" value={fmtSign(profit)} sub={pct(profitRate)} color={pc(profit)} />
        </div>

        <div style={{ background: '#f8f9fa', padding: '14px 18px', borderRadius: 8, marginTop: 12 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>📝 종합 의견</div>
          {comments.map((c, i) => (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.8 }}>• {c}</div>
          ))}
        </div>

        <div style={{
          textAlign: 'center', padding: '10px 16px', borderRadius: 8, marginTop: 12, fontWeight: 'bold', fontSize: 14,
          background: profit >= 0 ? '#e8f5e9' : '#ffebee', color: pc(profit)
        }}>
          → 최종 손익: {fmtSign(profit)}원 ({pct(profitRate)})
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return <div className="card"><div className="card-title">{title}</div>{children}</div>;
}

function KPI({ label, value, sub, color }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: 15, color: color || 'var(--primary)' }}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function Block({ title, rows, border }) {
  const borderStyle = border === 'left' ? { borderLeft: '2px solid var(--primary)', borderTop: '2px solid var(--primary)', borderBottom: '2px solid var(--primary)', borderRadius: '0 0 0 8px' }
    : border === 'right' ? { borderRight: '2px solid var(--primary)', borderTop: '2px solid var(--primary)', borderBottom: '2px solid var(--primary)', borderRadius: '0 0 8px 0' }
    : { borderTop: '2px solid var(--primary)', borderBottom: '2px solid var(--primary)' };
  return (
    <div style={{ ...borderStyle, padding: 12, background: '#fff' }}>
      <div style={{ fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 8, textAlign: 'center' }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: i > 0 ? '1px dashed #e0e0e0' : '' }}>
          <span style={{ fontSize: 11, color: '#888', fontWeight: 'bold' }}>{r[0]}</span>
          <span style={{ fontSize: r[2] === '#888' ? 10 : 14, fontWeight: 'bold', color: r[2] || 'var(--primary)' }}>{r[1]}</span>
        </div>
      ))}
    </div>
  );
}

function Row({ k, v, sub, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #eee' }}>
      <div>
        <span style={{ fontSize: 11, color: '#888' }}>{k}</span>
        {sub && <div style={{ fontSize: 9, color: '#bbb' }}>{sub}</div>}
      </div>
      <span style={{ fontWeight: bold ? 'bold' : 'normal', fontSize: 13 }}>{v}원</span>
    </div>
  );
}
