import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';

const METHODS = ['T4', '토네이도', '트리콘'];
const GEOLOGIES = ['토사', '풍화암', '연암', '보통암', '경암'];
const STATUSES = ['정상', '반일', '우천', '고장', '민원', '대기'];

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  gongjong:'', hogi:'', date: today(), method:'T4', geology:'토사',
  qty:0, time_min:0, memo:'', section:'', status:'정상', company:'', spec:''
};

export default function WorkLogPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterDate, setFilterDate] = useState(today());
  const [config, setConfig] = useState({});
  const [hogis, setHogis] = useState([]);

  useEffect(() => {
    api.get('/config').then(c => {
      setConfig(c);
      setForm(prev => ({ ...prev, gongjong: c.gongjong || '' }));
    });
    api.get('/equipment').then(eqs => {
      const set = new Set(eqs.map(e => e.hogi));
      setHogis([...set].sort());
    });
  }, []);

  const load = () => {
    const params = filterDate ? `?date=${filterDate}` : '?from=' + today();
    api.get('/work-log' + params).then(setItems);
  };
  useEffect(load, [filterDate]);

  const handleSubmit = async () => {
    if (!form.hogi || !form.qty) return alert('호기와 수량을 입력하세요');
    const data = { ...form, gongjong: form.gongjong || config.gongjong || '' };
    if (editId) {
      await api.put(`/work-log/${editId}`, data);
    } else {
      await api.post('/work-log', data);
    }
    setForm({ ...EMPTY, gongjong: config.gongjong, date: form.date });
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
    await api.del(`/work-log/${id}`);
    load();
  };

  const dayTotal = items.reduce((s, i) => s + (i.qty || 0), 0);

  return (
    <div>
      <div className="page-title" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <span>📋 작업일지</span>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            style={{padding:'6px 10px', border:'1px solid #ddd', borderRadius:6, fontSize:13}} />
          <button className="btn btn-primary" onClick={() => { setForm({...EMPTY, gongjong: config.gongjong, date: filterDate}); setEditId(null); setShowForm(!showForm); }}>
            {showForm ? '닫기' : '+ 작업 추가'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">{editId ? '수정' : '작업 추가'}</div>
          <div className="form-grid">
            <div className="form-group">
              <label>날짜</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>호기</label>
              <select value={form.hogi} onChange={e => setForm(p => ({...p, hogi: e.target.value}))}>
                <option value="">선택</option>
                {hogis.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>공법</label>
              <select value={form.method} onChange={e => setForm(p => ({...p, method: e.target.value}))}>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>지질</label>
              <select value={form.geology} onChange={e => setForm(p => ({...p, geology: e.target.value}))}>
                {GEOLOGIES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>수량 (m)</label>
              <input type="number" step="0.1" value={form.qty} onChange={e => setForm(p => ({...p, qty: parseFloat(e.target.value)||0}))} />
            </div>
            <div className="form-group">
              <label>소요시간 (분)</label>
              <input type="number" value={form.time_min} onChange={e => setForm(p => ({...p, time_min: parseFloat(e.target.value)||0}))} />
            </div>
            <div className="form-group">
              <label>상태</label>
              <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>구간</label>
              <input type="text" value={form.section} onChange={e => setForm(p => ({...p, section: e.target.value}))} />
            </div>
            <div className="form-group" style={{gridColumn:'span 2'}}>
              <label>메모</label>
              <input type="text" value={form.memo} onChange={e => setForm(p => ({...p, memo: e.target.value}))} />
            </div>
          </div>
          <div style={{marginTop:12}}>
            <button className="btn btn-primary" onClick={handleSubmit}>{editId ? '수정' : '추가'}</button>
            {editId && <button className="btn" onClick={() => {setForm({...EMPTY, gongjong: config.gongjong, date: filterDate}); setEditId(null);}}>취소</button>}
          </div>
        </div>
      )}

      {/* 일일 합계 */}
      <div style={{marginBottom:12, fontSize:13, color:'#555'}}>
        {filterDate} 합계: <strong style={{color:'#1e3c72', fontSize:16}}>{dayTotal.toFixed(1)}m</strong>
        <span style={{marginLeft:8}}>({items.length}건)</span>
      </div>

      <div className="card" style={{padding:0, overflow:'auto'}}>
        <table className="data-table">
          <thead>
            <tr>
              <th>날짜</th><th>호기</th><th>공법</th><th>지질</th><th>수량(m)</th>
              <th>시간(분)</th><th>상태</th><th>구간</th><th>메모</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.date}</td>
                <td>{it.hogi}</td>
                <td>{it.method}</td>
                <td>{it.geology}</td>
                <td style={{fontWeight:'bold'}}>{it.qty}</td>
                <td>{it.time_min || '-'}</td>
                <td style={{color: it.status !== '정상' ? '#dc3545' : '#28a745', fontWeight:'bold'}}>{it.status}</td>
                <td>{it.section}</td>
                <td style={{fontSize:11, maxWidth:150, overflow:'hidden', textOverflow:'ellipsis'}}>{it.memo}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => handleEdit(it)}>수정</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(it.id)}>삭제</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={10} style={{color:'#888', padding:20}}>해당 날짜에 작업 기록이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
