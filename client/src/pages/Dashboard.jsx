import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#1e3c72', '#e65100', '#6a1b9a', '#2e7d32', '#c62828'];
const fmt = (n) => n == null ? '0' : Math.round(n).toLocaleString('ko-KR');

export default function Dashboard() {
  const [config, setConfig] = useState({});
  const [summary, setSummary] = useState(null);
  const [costSummary, setCostSummary] = useState(null);

  useEffect(() => {
    api.get('/config').then(setConfig);
    const today = new Date().toISOString().slice(0, 10);
    api.get(`/work-log/summary?to=${today}`).then(setSummary);
    api.get(`/costs/summary?to=${today}`).then(setCostSummary);
  }, []);

  if (!summary) return <div className="page-title">로딩 중...</div>;

  const totalQty = summary.total?.total_qty || 0;
  const workDays = summary.total?.work_days || 0;
  const hogiCount = summary.total?.hogi_count || 0;
  const contractQty = parseFloat(config.contract_qty) || 0;
  const remainQty = contractQty - totalQty;
  const progressRate = contractQty > 0 ? (totalQty / contractQty * 100) : 0;
  const dailyAvg = workDays > 0 ? totalQty / workDays : 0;
  const totalCost = costSummary?.total || 0;

  return (
    <div>
      <div className="page-title">종합 현황</div>

      {/* KPI */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">계약물량</div>
          <div className="value">{fmt(contractQty)}<span style={{fontSize:14}}>m</span></div>
        </div>
        <div className="kpi">
          <div className="label">누계 천공</div>
          <div className="value">{fmt(totalQty)}<span style={{fontSize:14}}>m</span></div>
          <div className="sub">{workDays}일 / {hogiCount}대</div>
        </div>
        <div className="kpi">
          <div className="label">잔여물량</div>
          <div className="value" style={{color: remainQty > 0 ? '#333' : '#dc3545'}}>{fmt(remainQty)}<span style={{fontSize:14}}>m</span></div>
        </div>
        <div className="kpi">
          <div className="label">진행률</div>
          <div className="value" style={{color: progressRate >= 80 ? '#28a745' : '#fd7e14'}}>{progressRate.toFixed(1)}%</div>
        </div>
        <div className="kpi">
          <div className="label">일평균</div>
          <div className="value">{dailyAvg.toFixed(1)}<span style={{fontSize:14}}>m</span></div>
        </div>
        <div className="kpi">
          <div className="label">총 투입비</div>
          <div className="value" style={{fontSize:18}}>{fmt(totalCost)}<span style={{fontSize:12}}>원</span></div>
        </div>
      </div>

      <div className="grid-2">
        {/* 일별 천공량 차트 */}
        <div className="card">
          <div className="card-title">일별 천공량 추이</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={(summary.byDate || []).slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{fontSize:10}} />
              <Tooltip formatter={(v) => v.toFixed(1) + 'm'} />
              <Bar dataKey="qty" fill="#1e3c72" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 공법별 비율 */}
        <div className="card">
          <div className="card-title">공법별 비율</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={(summary.byMethod || []).filter(d => d.qty > 0)}
                dataKey="qty"
                nameKey="method"
                cx="50%" cy="50%"
                outerRadius={90}
                label={({method, qty}) => `${method} ${(qty/totalQty*100).toFixed(1)}%`}
              >
                {(summary.byMethod || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v) + 'm'} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 호기별 천공량 */}
        <div className="card">
          <div className="card-title">호기별 천공량</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={summary.byHogi || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{fontSize:10}} />
              <YAxis dataKey="hogi" type="category" tick={{fontSize:11}} width={60} />
              <Tooltip formatter={(v) => fmt(v) + 'm'} />
              <Bar dataKey="qty" fill="#2a5298" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 투입비 구성 */}
        {costSummary && (
          <div className="card">
            <div className="card-title">투입비 구성</div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: '장비대', value: costSummary.equipment },
                    { name: '유류비', value: costSummary.fuel },
                    { name: '자재비', value: costSummary.material },
                    { name: '노무비', value: costSummary.labor },
                  ].filter(d => d.value > 0)}
                  dataKey="value"
                  cx="50%" cy="50%"
                  outerRadius={90}
                  label={({name, value}) => `${name} ${fmt(value)}`}
                >
                  {[0,1,2,3].map(i => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v) + '원'} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
