import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';

const EMPTY = {
  hogi:'', equip_type:'', car_no:'', equip_name:'', spec:'', company:'', driver:'',
  start_date:'', end_date:'', monthly_rent:0, daily_rent:0, drill_diameter:0, adjust_factor:1
};

export default function EquipmentPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => api.get('/equipment').then(setItems);
  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.hogi) return alert('호기를 입력하세요');
    if (editId) {
      await api.put(`/equipment/${editId}`, form);
    } else {
      await api.post('/equipment', form);
    }
    setForm({ ...EMPTY });
    setEditId(null);
    setShowForm(false);
    load();
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.del(`/equipment/${id}`);
    load();
  };

  // 호기별 그룹
  const byHogi = {};
  items.forEach(it => {
    if (!byHogi[it.hogi]) byHogi[it.hogi] = [];
    byHogi[it.hogi].push(it);
  });

  return (
    <div>
      <div className="page-title" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <span>🔧 장비구분표</span>
        <button className="btn btn-primary" onClick={() => { setForm({...EMPTY}); setEditId(null); setShowForm(!showForm); }}>
          {showForm ? '닫기' : '+ 장비 추가'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">{editId ? '장비 수정' : '장비 추가'}</div>
          <div className="form-grid">
            {[
              ['hogi','호기','text','예: 1호기'],
              ['equip_type','장비타입','text','예: 메인장비, 항타기'],
              ['car_no','차량번호','text',''],
              ['equip_name','장비명','text',''],
              ['spec','규격','text',''],
              ['company','업체','text',''],
              ['driver','운전자','text',''],
              ['start_date','투입시작일','date',''],
              ['end_date','투입종료일','date',''],
              ['monthly_rent','월대(원)','number',''],
              ['daily_rent','일대(원)','number',''],
              ['drill_diameter','작업구경(mm)','number',''],
              ['adjust_factor','보정계수','number','기본 1.0'],
            ].map(([key, label, type, ph]) => (
              <div className="form-group" key={key}>
                <label>{label}</label>
                <input
                  type={type}
                  placeholder={ph}
                  value={form[key] || ''}
                  onChange={e => setForm(prev => ({...prev, [key]: type==='number' ? parseFloat(e.target.value)||0 : e.target.value}))}
                />
              </div>
            ))}
          </div>
          <div style={{marginTop:12}}>
            <button className="btn btn-primary" onClick={handleSubmit}>{editId ? '수정' : '추가'}</button>
            {editId && <button className="btn" onClick={() => {setForm({...EMPTY}); setEditId(null);}}>취소</button>}
          </div>
        </div>
      )}

      {Object.entries(byHogi).sort().map(([hogi, eqs]) => (
        <div className="card" key={hogi}>
          <div className="card-title">{hogi} ({eqs.length}대)</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>타입</th><th>차량번호</th><th>장비명</th><th>규격</th>
                <th>업체</th><th>운전자</th><th>투입기간</th><th>월대</th><th>구경</th><th></th>
              </tr>
            </thead>
            <tbody>
              {eqs.map(eq => (
                <tr key={eq.id}>
                  <td>{eq.equip_type}</td>
                  <td>{eq.car_no}</td>
                  <td>{eq.equip_name}</td>
                  <td>{eq.spec}</td>
                  <td>{eq.company}</td>
                  <td>{eq.driver}</td>
                  <td style={{fontSize:11}}>{eq.start_date ? eq.start_date.slice(5) : ''}{eq.end_date ? '~'+eq.end_date.slice(5) : '~'}</td>
                  <td>{eq.monthly_rent ? eq.monthly_rent.toLocaleString() : '-'}</td>
                  <td>{eq.drill_diameter || '-'}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => handleEdit(eq)}>수정</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(eq.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {items.length === 0 && <div className="card" style={{textAlign:'center', color:'#888'}}>등록된 장비가 없습니다. 장비를 추가해주세요.</div>}
    </div>
  );
}
