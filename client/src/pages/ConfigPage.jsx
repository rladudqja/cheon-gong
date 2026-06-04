import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';

const FIELDS = [
  { key: 'name', label: '현장명', type: 'text' },
  { key: 'gongjong', label: '공종', type: 'text' },
  { key: 'contract_qty', label: '계약물량 (m)', type: 'number' },
  { key: 'start_date', label: '공사시작일', type: 'date' },
  { key: 'end_date', label: '공사종료일', type: 'date' },
  { key: 'work_days_per_month', label: '월 작업일수', type: 'number' },
  { key: 'daily_target', label: '일일목표 (m/대)', type: 'number' },
  { key: 'settlement_day', label: '정산일', type: 'number' },
  { key: 'est_monthly_rent', label: '예상월대 (원)', type: 'number' },
  { key: 'est_daily_rent', label: '예상일대 (원)', type: 'number' },
];

export default function ConfigPage() {
  const [config, setConfig] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/config').then(setConfig);
  }, []);

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    await api.put('/config', config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="page-title">⚙️ 기본정보 설정</div>
      <div className="card">
        <div className="form-grid">
          {FIELDS.map(f => (
            <div className="form-group" key={f.key}>
              <label>{f.label}</label>
              <input
                type={f.type}
                value={config[f.key] || ''}
                onChange={e => handleChange(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-primary" onClick={handleSave}>저장</button>
          {saved && <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ 저장 완료</span>}
        </div>
      </div>
    </div>
  );
}
