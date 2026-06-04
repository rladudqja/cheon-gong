import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';

const fmt = (n) => n == null ? '-' : Math.round(n).toLocaleString('ko-KR');
const METHODS = ['T4', '토네이도', '트리콘', '근입', '타설', '케이싱설치'];
const GEOLOGIES = ['토사', '풍화암', '연암', '보통암', '경암'];

const EMPTY = { gongjong: '', method: 'T4', geology: '토사', unit: 'm', qty: 0, price: 0 };

export default function PriceTablePage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [config, setConfig] = useState({});

  useEffect(() => { api.get('/config').then(setConfig); }, []);
  const load = () => api.get('/price-table').then(setItems);
  useEffect(load, []);

  const handleSubmit = async () => {
    if (!form.method) return alert('공법을 선택하세요');
    const data = { ...form, gongjong: form.gongjong || config.gongjong || '' };
    if (editId) {
      await api.put(`/price-table/${editId}`, data);
    } else {
      await api.post('/price-table', data);
    }
    setForm({ ...EMPTY, gongjong: config.gongjong });
    setEditId(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.del(`/price-table/${id}`);
    load();
  };

  // 부대항목 판별
  const isSubItem = (m) => ['근입', '타설', '케이싱설치'].some(s => m?.includes(s));

  // 공법별 그룹
  const groups = {};
  items.forEach(it => {
    const g = isSubItem(it.method) ? '부대항목' : (it.method || '기타');
    if (!groups[g]) groups[g] = [];
    groups[g].push(it);
  });

  const totalAmt = items.reduce((s, i) => s + ((i.qty || 0) * (i.price || 0)), 0);

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📄 기성양식 (계약 단가표)</span>
        <button className="btn btn-primary" onClick={() => {
          setForm({ ...EMPTY, gongjong: config.gongjong }); setEditId(null); setShowForm(!showForm);
        }}>
          {showForm ? '닫기' : '+ 항목 추가'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">{editId ? '수정' : '항목 추가'}</div>
          <div className="form-grid">
            <div className="form-group">
              <label>공법</label>
              <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>지질</label>
              <select value={form.geology || ''} onChange={e => setForm(p => ({ ...p, geology: e.target.value }))}>
                <option value="">없음 (부대항목)</option>
                {GEOLOGIES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>수량 (m)</label>
              <input type="number" value={form.qty} onChange={e => setForm(p => ({ ...p, qty: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="form-group">
              <label>단가 (원)</label>
              <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={handleSubmit}>{editId ? '수정' : '추가'}</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12, fontSize: 13, color: '#555' }}>
        총 계약금액: <strong style={{ color: '#1e3c72', fontSize: 16 }}>{fmt(totalAmt)}원</strong>
        <span style={{ marginLeft: 8 }}>({items.length}항목)</span>
      </div>

      {Object.entries(groups).map(([groupName, groupItems]) => (
        <div className="card" key={groupName}>
          <div className="card-title">{groupName}</div>
          <table className="data-table">
            <thead>
              <tr><th>공법</th><th>지질</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th><th></th></tr>
            </thead>
            <tbody>
              {groupItems.map(it => (
                <tr key={it.id}>
                  <td>{it.method}</td>
                  <td>{it.geology || '-'}</td>
                  <td>{it.unit}</td>
                  <td>{fmt(it.qty)}</td>
                  <td>{fmt(it.price)}</td>
                  <td style={{ fontWeight: 'bold' }}>{fmt((it.qty || 0) * (it.price || 0))}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => { setForm(it); setEditId(it.id); setShowForm(true); }}>수정</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(it.id)}>삭제</button>
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#f1f3f5', fontWeight: 'bold' }}>
                <td colSpan={5}>소계</td>
                <td>{fmt(groupItems.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0))}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {items.length === 0 && <div className="card" style={{ textAlign: 'center', color: '#888' }}>단가표가 비어있습니다. 항목을 추가해주세요.</div>}
    </div>
  );
}
