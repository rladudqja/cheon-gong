import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => n == null ? '0' : Math.round(n).toLocaleString('ko-KR');

export default function CostPage({ title, icon, apiPath, columns, defaults }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ ...defaults, date: today() });
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterMonth, setFilterMonth] = useState(today().slice(0, 7));
  const [config, setConfig] = useState({});
  const [hogis, setHogis] = useState([]);

  useEffect(() => {
    api.get('/config').then(setConfig);
    api.get('/equipment').then(eqs => {
      setHogis([...new Set(eqs.map(e => e.hogi))].sort());
    });
  }, []);

  const load = () => {
    const from = filterMonth + '-01';
    const toDate = new Date(parseInt(filterMonth.slice(0, 4)), parseInt(filterMonth.slice(5, 7)), 0);
    const to = toDate.toISOString().slice(0, 10);
    api.get(`/costs/${apiPath}?from=${from}&to=${to}`).then(setItems);
  };
  useEffect(load, [filterMonth, apiPath]);

  const handleSubmit = async () => {
    if (!form.date) return alert('날짜를 입력하세요');
    const data = {
      ...form,
      month: form.date.slice(0, 7),
      gongjong: form.gongjong || config.gongjong || '',
      amount: form.amount || (form.qty || form.hours || form.fuel_qty || 0) * (form.price || 0)
    };
    if (editId) {
      await api.put(`/costs/${apiPath}/${editId}`, data);
    } else {
      await api.post(`/costs/${apiPath}`, data);
    }
    setForm({ ...defaults, date: form.date, gongjong: config.gongjong });
    setEditId(null);
    load();
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.del(`/costs/${apiPath}/${id}`);
    load();
  };

  const monthTotal = items.reduce((s, i) => s + (i.amount || 0), 0);

  // 컬럼 중 호기가 있으면 select로 렌더
  const renderInput = (col) => {
    const val = form[col.key] ?? '';
    if (col.key === 'hogi') {
      return (
        <select value={val} onChange={e => setForm(p => ({ ...p, [col.key]: e.target.value }))}>
          <option value="">미지정</option>
          {hogis.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      );
    }
    if (col.options) {
      return (
        <select value={val} onChange={e => setForm(p => ({ ...p, [col.key]: e.target.value }))}>
          <option value="">선택</option>
          {col.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input
        type={col.type || 'text'}
        step={col.type === 'number' ? '0.01' : undefined}
        placeholder={col.placeholder || ''}
        value={val}
        onChange={e => setForm(p => ({
          ...p,
          [col.key]: col.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
        }))}
      />
    );
  };

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{icon} {title}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
          <button className="btn btn-primary" onClick={() => {
            setForm({ ...defaults, date: today(), gongjong: config.gongjong });
            setEditId(null);
            setShowForm(!showForm);
          }}>
            {showForm ? '닫기' : '+ 추가'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">{editId ? '수정' : '추가'}</div>
          <div className="form-grid">
            {columns.filter(c => !c.hideForm).map(col => (
              <div className="form-group" key={col.key}>
                <label>{col.label}</label>
                {renderInput(col)}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={handleSubmit}>{editId ? '수정' : '추가'}</button>
            {editId && <button className="btn" onClick={() => { setForm({ ...defaults, date: today(), gongjong: config.gongjong }); setEditId(null); }}>취소</button>}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12, fontSize: 13, color: '#555' }}>
        {filterMonth} 합계: <strong style={{ color: '#1e3c72', fontSize: 16 }}>{fmt(monthTotal)}원</strong>
        <span style={{ marginLeft: 8 }}>({items.length}건)</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.filter(c => !c.hideTable).map(c => <th key={c.key}>{c.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                {columns.filter(c => !c.hideTable).map(c => (
                  <td key={c.key} style={c.key === 'amount' ? { fontWeight: 'bold' } : {}}>
                    {c.format ? c.format(it[c.key]) : (it[c.key] ?? '-')}
                  </td>
                ))}
                <td>
                  <button className="btn btn-sm" onClick={() => handleEdit(it)}>수정</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(it.id)}>삭제</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={columns.length + 1} style={{ color: '#888', padding: 20 }}>데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
