import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api/fetch';

export default function ImportPage() {
  const [templateInfo, setTemplateInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    api.get('/import/template-info').then(setTemplateInfo);
  }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Excel 파일(.xlsx, .xls)만 업로드 가능합니다.');
      return;
    }

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import/excel', { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ ok: false, errors: [e.message] });
    }
    setUploading(false);
  };

  const onFileChange = (e) => handleUpload(e.target.files[0]);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files[0]);
  };

  const fmt = (n) => Math.round(n).toLocaleString();

  return (
    <div>
      <div className="page-title">📥 스프레드시트 가져오기</div>

      {/* 안내 */}
      <div className="card">
        <div className="card-title">사용 방법</div>
        <div style={{ fontSize: 13, lineHeight: 1.8, color: '#555' }}>
          <p>기존 Google 스프레드시트를 <strong>Excel(.xlsx)</strong>로 다운로드한 후 업로드하면,<br />
          시트명을 자동 인식하여 데이터를 가져옵니다.</p>
          <div style={{ background: '#fff3e0', padding: '10px 14px', borderRadius: 6, margin: '10px 0', border: '1px solid #ffc107' }}>
            ⚠️ <strong>주의:</strong> 기존 데이터가 모두 덮어쓰기됩니다. 필요하면 먼저 백업하세요.
          </div>
          <p style={{ fontSize: 12, color: '#888' }}>
            Google 스프레드시트 → 파일 → 다운로드 → Microsoft Excel(.xlsx) 선택
          </p>
        </div>
      </div>

      {/* 업로드 영역 */}
      <div className="card">
        <div className="card-title">파일 업로드</div>
        <div
          style={{
            border: `3px dashed ${dragOver ? 'var(--primary)' : '#d0d0d0'}`,
            borderRadius: 12,
            padding: '40px 20px',
            textAlign: 'center',
            background: dragOver ? '#e3f2fd' : '#fafafa',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {uploading ? (
            <div>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--primary)' }}>가져오는 중...</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#555' }}>
                Excel 파일을 드래그하거나 클릭하여 선택
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>.xlsx, .xls 지원 (최대 50MB)</div>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFileChange} />
        </div>
      </div>

      {/* 결과 */}
      {result && (
        <div className="card">
          <div className="card-title" style={{ color: result.ok ? 'var(--pos)' : 'var(--neg)' }}>
            {result.ok ? '✅ 가져오기 완료' : '⚠️ 일부 오류 발생'}
          </div>

          {/* 인식된 시트 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>인식된 시트</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {result.sheetsFound?.map(sn => {
                const imported = result.imported?.[sn] !== undefined;
                return (
                  <span key={sn} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 'bold',
                    background: imported ? '#e8f5e9' : '#f5f5f5',
                    color: imported ? '#2e7d32' : '#999',
                    border: `1px solid ${imported ? '#4caf50' : '#e0e0e0'}`
                  }}>
                    {imported ? '✅' : '⏭️'} {sn}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 가져온 데이터 */}
          {Object.keys(result.imported || {}).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 }}>가져온 데이터</div>
              <table className="data-table" style={{ maxWidth: 400 }}>
                <thead><tr><th>시트</th><th>건수</th></tr></thead>
                <tbody>
                  {Object.entries(result.imported).map(([sheet, count]) => (
                    <tr key={sheet}>
                      <td style={{ fontWeight: 'bold' }}>{sheet}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{fmt(count)}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 건너뛴 시트 */}
          {result.skipped?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#888', marginBottom: 4 }}>건너뛴 시트 (보고서 등)</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>{result.skipped.join(', ')}</div>
            </div>
          )}

          {/* 에러 */}
          {result.errors?.length > 0 && (
            <div style={{ background: '#ffebee', padding: '10px 14px', borderRadius: 6, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#c62828', marginBottom: 4 }}>오류</div>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: '#c62828' }}>• {e}</div>
              ))}
            </div>
          )}

          {/* 다시 업로드 */}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={() => { setResult(null); fileRef.current.value = ''; }}>
              다시 업로드
            </button>
          </div>
        </div>
      )}

      {/* 시트 매핑 안내 */}
      {templateInfo && (
        <div className="card">
          <div className="card-title">📋 시트 매핑 안내</div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
            아래 시트명과 열 구조에 맞게 스프레드시트를 구성하세요. 기존 GAS 시트 구조 그대로 사용 가능합니다.
          </div>
          <table className="data-table" style={{ fontSize: 11 }}>
            <thead>
              <tr><th>시트명</th><th>열 구조</th><th>필수</th></tr>
            </thead>
            <tbody>
              {templateInfo.sheets.map(s => (
                <tr key={s.name}>
                  <td style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{s.name}</td>
                  <td style={{ fontSize: 10, color: '#666' }}>{s.desc}</td>
                  <td style={{ color: s.required ? 'var(--neg)' : '#888' }}>{s.required ? '필수' : '선택'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
