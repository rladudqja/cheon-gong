import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const fmt = (n) => n == null ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtD = (n) => n == null ? '0' : Number(n).toFixed(1);
const COLORS = ['#1e3c72', '#e65100', '#6a1b9a', '#2e7d32', '#c62828', '#00695c', '#f57c00', '#795548'];

export default function DrillingReportPage() {
  const [data, setData] = useState(null);
  const [config, setConfig] = useState({});
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { api.get('/config').then(setConfig); }, []);

  const load = () => {
    const gj = config.gongjong || '';
    api.get(`/reports/drilling?to=${toDate}${gj ? '&gongjong=' + gj : ''}`).then(setData);
  };
  useEffect(() => { if (config.gongjong !== undefined) load(); }, [toDate, config]);

  if (!data) return <div className="page-title">로딩 중...</div>;

  const { grand, byDate, byHogi, byGeology, byMethod, dateHogi } = data;
  const hogiList = byHogi.map(h => h.hogi);

  // 날짜별+호기별 매트릭스 데이터 구성
  const dateHogiMap = {};
  dateHogi.forEach(r => {
    if (!dateHogiMap[r.date]) dateHogiMap[r.date] = {};
    dateHogiMap[r.date][r.hogi] = r.qty;
  });
  const matrixData = byDate.map(d => {
    const row = { date: d.date, total: d.total };
    hogiList.forEach(h => { row[h] = dateHogiMap[d.date]?.[h] || 0; });
    return row;
  });

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📈 천공량 집계</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#666' }}>기준일:</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">총 천공량</div>
          <div className="value">{fmtD(grand.total)}<span style={{ fontSize: 14 }}>m</span></div>
          <div className="sub">{grand.count}건</div>
        </div>
        <div className="kpi">
          <div className="label">작업일수</div>
          <div className="value">{grand.days}<span style={{ fontSize: 14 }}>일</span></div>
        </div>
        <div className="kpi">
          <div className="label">가동 호기</div>
          <div className="value">{grand.hogis}<span style={{ fontSize: 14 }}>대</span></div>
        </div>
        <div className="kpi">
          <div className="label">일평균</div>
          <div className="value">{grand.days > 0 ? fmtD(grand.total / grand.days) : '-'}<span style={{ fontSize: 14 }}>m</span></div>
        </div>
        {parseFloat(config.contract_qty) > 0 && (
          <div className="kpi">
            <div className="label">진행률</div>
            <div className="value" style={{ color: '#28a745' }}>
              {(grand.total / parseFloat(config.contract_qty) * 100).toFixed(1)}%
            </div>
            <div className="sub">잔여 {fmtD(parseFloat(config.contract_qty) - grand.total)}m</div>
          </div>
        )}
      </div>

      {/* 호기별 + 지질별 요약 (나란히) */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-title">호기별 요약</div>
          <table className="data-table">
            <thead><tr><th>호기</th><th>물량(m)</th><th>가동일</th><th>일평균</th></tr></thead>
            <tbody>
              {byHogi.map(h => (
                <tr key={h.hogi}>
                  <td>{h.hogi}</td>
                  <td style={{ fontWeight: 'bold' }}>{fmtD(h.total)}</td>
                  <td>{h.days}일</td>
                  <td>{h.days > 0 ? fmtD(h.total / h.days) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">지질별 요약</div>
          <table className="data-table">
            <thead><tr><th>지질</th><th>물량(m)</th><th>비율</th></tr></thead>
            <tbody>
              {byGeology.map(g => (
                <tr key={g.geology}>
                  <td>{g.geology}</td>
                  <td style={{ fontWeight: 'bold' }}>{fmtD(g.total)}</td>
                  <td>{grand.total > 0 ? (g.total / grand.total * 100).toFixed(1) + '%' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">공법별 요약</div>
          <table className="data-table">
            <thead><tr><th>공법</th><th>물량(m)</th><th>비율</th></tr></thead>
            <tbody>
              {byMethod.map(m => (
                <tr key={m.method}>
                  <td>{m.method}</td>
                  <td style={{ fontWeight: 'bold' }}>{fmtD(m.total)}</td>
                  <td>{grand.total > 0 ? (m.total / grand.total * 100).toFixed(1) + '%' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 일별 호기별 차트 (스택 바) */}
      <div className="card">
        <div className="card-title">일별 천공량 (호기별 스택)</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={matrixData.slice(-30)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => fmtD(v) + 'm'} />
            <Legend />
            {hogiList.map((h, i) => (
              <Bar key={h} dataKey={h} stackId="a" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 날짜별 상세 테이블 */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <div style={{ padding: '12px 16px', fontWeight: 'bold', fontSize: 14, color: '#1e3c72', borderBottom: '2px solid #e0e0e0' }}>
          일자별 천공량 ({byDate.length}일)
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>날짜</th>
              {hogiList.map(h => <th key={h}>{h}</th>)}
              <th style={{ background: '#e8f4f8' }}>합계</th>
            </tr>
          </thead>
          <tbody>
            {/* 수량 합계 행 */}
            <tr style={{ background: '#fff9e6', fontWeight: 'bold' }}>
              <td>수량(m)</td>
              {hogiList.map(h => {
                const hData = byHogi.find(x => x.hogi === h);
                return <td key={h}>{hData ? fmtD(hData.total) : '-'}</td>;
              })}
              <td>{fmtD(grand.total)}</td>
            </tr>
            {matrixData.slice().reverse().map(row => {
              // 당일 최고/최저 찾기
              const vals = hogiList.map(h => row[h] || 0).filter(v => v > 0);
              const max = Math.max(...vals, 0);
              const min = vals.length >= 2 ? Math.min(...vals) : -1;
              return (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  {hogiList.map(h => {
                    const v = row[h] || 0;
                    let style = {};
                    if (v === max && v > 0) style = { color: '#1565c0', fontWeight: 'bold' };
                    else if (v === min && v > 0 && vals.length >= 2) style = { color: '#c62828', fontWeight: 'bold' };
                    return <td key={h} style={style}>{v > 0 ? fmtD(v) : '-'}</td>;
                  })}
                  <td style={{ fontWeight: 'bold' }}>{fmtD(row.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
