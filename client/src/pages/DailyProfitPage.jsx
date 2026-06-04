import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const fmt = (n) => n == null ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtD = (n) => n == null ? '0' : Number(n).toFixed(1);
const fmtSign = (n) => (n >= 0 ? '+' : '') + fmt(n);
const pct = (n) => (n * 100).toFixed(1) + '%';
const COLORS = ['#1e3c72', '#e65100', '#6a1b9a', '#2e7d32', '#c62828'];
const METHOD_COLORS = { 'T4': '#1e3c72', '토네이도': '#e65100', '트리콘': '#6a1b9a' };

export default function DailyProfitPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);

  const load = () => api.get(`/reports/daily-profit?date=${date}`).then(setData);
  useEffect(load, [date]);

  if (!data) return <div className="page-title">로딩 중...</div>;

  const { daily, total, progress, contract, hogiDetails, trend, byMethod, byGeology, maxAvg, config: cfg } = data;

  const dailyTarget = parseFloat(cfg.daily_target) || 0;
  const totalHogiDays = total.totalHogiDays || 1;
  const profitColor = (v) => v >= 0 ? 'var(--pos)' : 'var(--neg)';

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>📋 일일손익분석</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '8px 12px', border: '2px solid var(--primary)', borderRadius: 8, fontSize: 14, fontWeight: 'bold' }} />
      </div>

      {/* ═══ KPI 카드 (상단) ═══ */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className="kpi">
          <div className="label">계약물량</div>
          <div className="value" style={{ fontSize: 18 }}>{fmt(contract.qty)}<small>m</small></div>
        </div>
        <div className="kpi">
          <div className="label">누계 천공</div>
          <div className="value" style={{ fontSize: 18 }}>{fmtD(total.qty)}<small>m</small></div>
          <div className="sub">{total.workDays}일 / {total.hogiCount}대</div>
        </div>
        <div className="kpi">
          <div className="label">잔여물량</div>
          <div className="value" style={{ fontSize: 18, color: progress.remainQty > 0 ? '#333' : 'var(--neg)' }}>
            {fmt(progress.remainQty)}<small>m</small>
          </div>
        </div>
        <div className="kpi">
          <div className="label">진행률</div>
          <div className="value" style={{ fontSize: 18, color: progress.progressRate >= 0.8 ? 'var(--pos)' : 'var(--warn)' }}>
            {pct(progress.progressRate)}
          </div>
        </div>
        <div className="kpi">
          <div className="label">일평균 (1대)</div>
          <div className="value" style={{ fontSize: 18 }}>{fmtD(total.dailyAvg)}<small>m</small></div>
          <div className="sub">1대 {fmtD(total.perUnitAvg)}m</div>
        </div>
        <div className="kpi">
          <div className="label">잔여 기간</div>
          <div className="value" style={{ fontSize: 18 }}>{progress.remainDays}<small>일</small></div>
          <div className="sub">필요 {fmtD(progress.requiredDaily)}m/일</div>
        </div>
      </div>

      {/* ═══ 당일 / 누계 손익 요약 (가로 2블록) ═══ */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* 당일 */}
        <div className="card" style={{ borderTop: '3px solid var(--primary)' }}>
          <div className="card-title">💰 당일 ({date})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            <div>
              <div className="text-muted" style={{ fontSize: 11 }}>천공</div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{fmtD(daily.qty)}m</div>
              <div className="text-muted" style={{ fontSize: 10 }}>{daily.unitCount}대 가동</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 11 }}>기성</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#2e7d32' }}>{fmt(daily.revenue)}</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 11 }}>투입비</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#c62828' }}>{fmt(daily.cost.total)}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 10, padding: '8px 0',
            background: daily.profit >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: '#666' }}>손익: </span>
            <span style={{ fontSize: 20, fontWeight: 'bold', color: profitColor(daily.profit) }}>
              {fmtSign(daily.profit)}원
            </span>
          </div>
        </div>

        {/* 누계 */}
        <div className="card" style={{ borderTop: '3px solid #2a5298' }}>
          <div className="card-title">📊 누계 (착공~{date})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            <div>
              <div className="text-muted" style={{ fontSize: 11 }}>천공</div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{fmtD(total.qty)}m</div>
              <div className="text-muted" style={{ fontSize: 10 }}>{total.workDays}일 가동</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 11 }}>기성</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#2e7d32' }}>{fmt(total.revenue)}</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 11 }}>투입비</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#c62828' }}>{fmt(total.cost.total)}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 10, padding: '8px 0',
            background: total.profit >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: '#666' }}>손익: </span>
            <span style={{ fontSize: 20, fontWeight: 'bold', color: profitColor(total.profit) }}>
              {fmtSign(total.profit)}원
            </span>
            <span style={{ fontSize: 12, color: profitColor(total.profit), marginLeft: 8 }}>
              ({total.revenue > 0 ? pct(total.profit / total.revenue) : '-'})
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 호기별 작업내역 ═══ */}
      <div className="card">
        <div className="card-title">
          1. 호기별 작업내역 — 가동: {daily.unitCount}대 | 합계: {fmtD(daily.qty)}m
          {daily.unitCount > 0 && <span> (1대 평균 {fmtD(daily.qty / daily.unitCount)}m)</span>}
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>호기</th><th>업체</th><th>규격</th><th>운전자</th>
              <th>투입기간</th><th>실가동일</th>
              <th style={{ background: '#e3f2fd' }}>일일천공</th>
              <th>누계천공</th><th>일평균</th>
              <th>누계투입비</th><th>1위대비</th>
            </tr>
          </thead>
          <tbody>
            {hogiDetails.map(h => {
              const rankPct = maxAvg > 0 ? h.dailyAvg / maxAvg * 100 : 0;
              const isActive = h.dailyQty > 0;
              return (
                <tr key={h.hogi} style={{ color: isActive ? '#333' : '#aaa' }}>
                  <td style={{ fontWeight: 'bold' }}>{h.hogi}</td>
                  <td>{h.company}</td>
                  <td>{h.spec}</td>
                  <td>{h.driver}</td>
                  <td style={{ fontSize: 11 }}>{h.startDate ? h.startDate.slice(5) : ''}{h.endDate ? '~' + h.endDate.slice(5) : '~'}</td>
                  <td>{h.workDays}일</td>
                  <td style={{ fontWeight: 'bold', color: isActive ? '#1565c0' : '#aaa', background: '#f0f7ff' }}>
                    {h.dailyQty > 0 ? fmtD(h.dailyQty) : '-'}
                  </td>
                  <td>{fmtD(h.totalQty)}</td>
                  <td>{fmtD(h.dailyAvg)}</td>
                  <td>{fmt(h.cost.total)}</td>
                  <td style={{
                    fontWeight: 'bold',
                    color: rankPct >= 100 ? '#1565c0' : rankPct >= 80 ? '#495057' : '#dc3545'
                  }}>
                    {rankPct > 0 ? Math.round(rankPct) + '%' : '-'}
                  </td>
                </tr>
              );
            })}
            {/* 합계행 */}
            <tr style={{ background: '#fff9e6', fontWeight: 'bold' }}>
              <td>합계</td>
              <td>{total.hogiCount}대</td>
              <td colSpan={3}></td>
              <td>{total.workDays}일</td>
              <td style={{ background: '#e3f2fd' }}>{fmtD(daily.qty)}</td>
              <td>{fmtD(total.qty)}</td>
              <td>{fmtD(total.dailyAvg)}</td>
              <td>{fmt(total.cost.total)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        {/* 목표 달성률 */}
        {dailyTarget > 0 && daily.unitCount > 0 && (() => {
          const perUnit = daily.qty / daily.unitCount;
          const achRate = perUnit / dailyTarget;
          const icon = achRate >= 1 ? '✅' : achRate >= 0.8 ? '⚠️' : '❌';
          const color = achRate >= 1 ? 'var(--pos)' : achRate >= 0.8 ? 'var(--warn)' : 'var(--neg)';
          return (
            <div style={{ textAlign: 'center', marginTop: 8, padding: '6px', background: '#f8f9fa', borderRadius: 6, fontSize: 12 }}>
              {icon} 일일목표(1대) {dailyTarget}m 대비 달성률:
              <strong style={{ color, marginLeft: 4 }}>{pct(achRate)}</strong>
              <span style={{ color: '#888', marginLeft: 4 }}>({fmtD(perUnit)}/{dailyTarget}m)</span>
            </div>
          );
        })()}
      </div>

      {/* ═══ 차트 2열 ═══ */}
      <div className="grid-2">
        {/* 일별 추이 */}
        <div className="card">
          <div className="card-title">최근 14일 천공량 추이</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => fmtD(v) + 'm'} />
              <Bar dataKey="qty" fill="#1e3c72" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 투입비 구성 */}
        <div className="card">
          <div className="card-title">누계 투입비 구성</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={[
                  { name: '장비대', value: total.cost.equipment },
                  { name: '유류비', value: total.cost.fuel },
                  { name: '자재비', value: total.cost.material },
                  { name: '노무비', value: total.cost.labor },
                ].filter(d => d.value > 0)}
                dataKey="value" cx="50%" cy="50%" outerRadius={80}
                label={({ name, value }) => `${name} ${fmt(value)}`}
              >
                {[0, 1, 2, 3].map(i => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt(v) + '원'} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ 기성 실적 상세 ═══ */}
      <div className="card">
        <div className="card-title">기성 실적 상세 (공법/지질별)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
          {/* 상세 테이블 */}
          <table className="data-table">
            <thead>
              <tr><th>공법</th><th>지질</th><th>당일(m)</th><th>당일기성</th><th>누계(m)</th><th>누계기성</th></tr>
            </thead>
            <tbody>
              {Object.entries(total.byMethodGeo).map(([key, t]) => {
                const d = daily.byMethodGeo[key];
                return (
                  <tr key={key}>
                    <td>{t.method}</td><td>{t.geology}</td>
                    <td>{d ? fmtD(d.qty) : '-'}</td>
                    <td>{d ? fmt(d.amount) : '-'}</td>
                    <td style={{ fontWeight: 'bold' }}>{fmtD(t.qty)}</td>
                    <td>{fmt(t.amount)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: '#e8f5e9', fontWeight: 'bold' }}>
                <td colSpan={2}>합계</td>
                <td>{fmtD(daily.qty)}</td><td>{fmt(daily.revenue)}</td>
                <td>{fmtD(total.qty)}</td><td>{fmt(total.revenue)}</td>
              </tr>
            </tbody>
          </table>

          {/* 공법별 파이 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>공법별</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={byMethod.filter(m => m.qty > 0)} dataKey="qty" nameKey="method"
                  cx="50%" cy="50%" outerRadius={60} label={({ method }) => method}>
                  {byMethod.map((m, i) => <Cell key={i} fill={METHOD_COLORS[m.method] || COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={v => fmtD(v) + 'm'} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 지질별 파이 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4 }}>지질별</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={byGeology.filter(g => g.qty > 0)} dataKey="qty" nameKey="geology"
                  cx="50%" cy="50%" outerRadius={60} label={({ geology }) => geology}>
                  {byGeology.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmtD(v) + 'm'} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══ 잔여 분석 ═══ */}
      <div className="card">
        <div className="card-title">잔여물량 분석</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'center' }}>
          <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
            <div className="text-muted" style={{ fontSize: 11 }}>잔여물량</div>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{fmt(progress.remainQty)}m</div>
          </div>
          <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
            <div className="text-muted" style={{ fontSize: 11 }}>잔여기간</div>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{progress.remainDays}일</div>
          </div>
          <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
            <div className="text-muted" style={{ fontSize: 11 }}>필요 일천공</div>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{fmtD(progress.requiredDaily)}m/일</div>
          </div>
          <div style={{ padding: 12, background: progress.avgVsRequired >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: 8 }}>
            <div className="text-muted" style={{ fontSize: 11 }}>일평균 대비</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: profitColor(progress.avgVsRequired) }}>
              {progress.avgVsRequired >= 0 ? '+' : ''}{fmtD(progress.avgVsRequired)}m
            </div>
            <div style={{ fontSize: 11, color: profitColor(progress.avgVsRequired) }}>
              {progress.avgVsRequired >= 0 ? '여유' : '부족'}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 평균단가 분석 ═══ */}
      <div className="card">
        <div className="card-title">📊 평균단가 분석 (누계)</div>
        <table className="data-table" style={{ maxWidth: 500 }}>
          <thead>
            <tr><th>구분</th><th>기성 평균단가</th><th>투입 평균단가</th><th>차이</th></tr>
          </thead>
          <tbody>
            {(() => {
              const gAvg = total.qty > 0 ? Math.round(total.revenue / total.qty) : 0;
              const cAvg = total.qty > 0 ? Math.round(total.cost.total / total.qty) : 0;
              const diff = gAvg - cAvg;
              return (
                <tr>
                  <td>직접비 기준</td>
                  <td>{fmt(gAvg)}원</td>
                  <td>{fmt(cAvg)}원</td>
                  <td style={{ fontWeight: 'bold', color: profitColor(diff) }}>{fmtSign(diff)}원</td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
