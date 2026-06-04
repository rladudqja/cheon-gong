import React, { useEffect, useState } from 'react';
import { api } from '../api/fetch';

export default function SyncPage() {
  const [status, setStatus] = useState(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [interval, setInterval2] = useState(30);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState([]);

  const loadStatus = () => api.get('/sync/status').then(s => {
    setStatus(s);
    if (s.intervalMinutes > 0) setInterval2(s.intervalMinutes);
    if (s.selectedSheets?.length > 0) setSelectedSheets(s.selectedSheets);
  });

  useEffect(() => { loadStatus(); }, []);

  const extractId = (input) => {
    const m = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    if (input.match(/^[a-zA-Z0-9_-]{20,}$/)) return input;
    return '';
  };

  const handleSetSheet = async () => {
    const id = extractId(sheetUrl);
    if (!id) return alert('올바른 스프레드시트 URL 또는 ID를 입력하세요');
    await api.post('/sync/set-sheet', { spreadsheetId: id });
    setSheetUrl('');
    setPreview(null);
    setSelectedSheets([]);
    loadStatus();
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    setPreview(null);
    const r = await api.get('/sync/preview');
    setPreview(r);
    if (r.ok && r.sheets) {
      // 기존 선택이 없으면 임포트 가능한 시트 전부 선택
      if (selectedSheets.length === 0) {
        setSelectedSheets(r.sheets.filter(s => s.importable).map(s => s.name));
      }
    }
    setLoadingPreview(false);
  };

  const toggleSheet = (name) => {
    setSelectedSheets(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const selectAll = () => {
    if (preview?.sheets) setSelectedSheets(preview.sheets.filter(s => s.importable).map(s => s.name));
  };
  const selectNone = () => setSelectedSheets([]);

  const handleSaveSelection = async () => {
    await api.post('/sync/select-sheets', { sheets: selectedSheets });
    loadStatus();
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setResult(null);
    // 선택한 시트만 동기화
    const r = await api.post('/sync/now', { sheets: selectedSheets.length > 0 ? selectedSheets : undefined });
    setResult(r);
    setSyncing(false);
    loadStatus();
  };

  const handleAutoSync = async (enabled) => {
    // 자동 동기화 전에 선택 저장
    if (enabled) await api.post('/sync/select-sheets', { sheets: selectedSheets });
    await api.post('/sync/auto', { enabled, intervalMinutes: interval });
    loadStatus();
  };

  const fmt = (n) => Math.round(n).toLocaleString();

  return (
    <div>
      <div className="page-title">🔄 스프레드시트 자동 동기화</div>

      {/* 사용 방법 */}
      <div className="card">
        <div className="card-title">설정 방법</div>
        <div style={{ fontSize: 13, lineHeight: 2, color: '#555' }}>
          <strong>1단계:</strong> Google 스프레드시트 → 공유 → <strong>"링크가 있는 모든 사용자"</strong> → 뷰어<br />
          <strong>2단계:</strong> 아래에 스프레드시트 URL을 붙여넣기<br />
          <strong>3단계:</strong> "탭 미리보기" → 원하는 탭 선택<br />
          <strong>4단계:</strong> "지금 동기화" 클릭
        </div>
      </div>

      {/* 스프레드시트 연결 */}
      <div className="card">
        <div className="card-title">📎 스프레드시트 연결</div>
        {status?.spreadsheetId ? (
          <div style={{ padding: '10px 14px', background: '#e8f5e9', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
            ✅ 연결됨: <strong style={{ wordBreak: 'break-all' }}>{status.spreadsheetId}</strong>
            <a href={`https://docs.google.com/spreadsheets/d/${status.spreadsheetId}`}
              target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontSize: 12 }}>[열기]</a>
          </div>
        ) : (
          <div style={{ padding: '10px 14px', background: '#fff3e0', borderRadius: 6, marginBottom: 12, fontSize: 13, border: '1px solid #ffc107' }}>
            ⚠️ 스프레드시트가 연결되지 않았습니다
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="스프레드시트 URL 또는 ID 붙여넣기" value={sheetUrl}
            onChange={e => setSheetUrl(e.target.value)}
            style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
          <button className="btn btn-primary" onClick={handleSetSheet}>연결</button>
        </div>
      </div>

      {/* 탭 선택 */}
      {status?.spreadsheetId && (
        <div className="card">
          <div className="card-title">📋 동기화할 탭(시트) 선택</div>

          {!preview && (
            <button className="btn btn-primary" onClick={handlePreview} disabled={loadingPreview}>
              {loadingPreview ? '⏳ 불러오는 중...' : '📋 탭 미리보기'}
            </button>
          )}

          {preview && !preview.ok && (
            <div style={{ padding: '10px 14px', background: '#ffebee', borderRadius: 6, color: '#c62828' }}>
              {preview.error}
            </div>
          )}

          {preview?.ok && preview.sheets && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className="btn btn-sm" onClick={selectAll}>전체 선택</button>
                <button className="btn btn-sm" onClick={selectNone}>전체 해제</button>
                <button className="btn btn-sm btn-primary" onClick={handleSaveSelection}>선택 저장</button>
                <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>
                  {selectedSheets.length}개 선택됨
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {preview.sheets.map(s => {
                  const checked = selectedSheets.includes(s.name);
                  const canImport = s.importable;
                  return (
                    <div
                      key={s.name}
                      onClick={() => canImport && toggleSheet(s.name)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: `2px solid ${checked ? 'var(--primary)' : canImport ? '#ddd' : '#f0f0f0'}`,
                        background: checked ? '#e3f2fd' : canImport ? '#fff' : '#f8f8f8',
                        cursor: canImport ? 'pointer' : 'default',
                        opacity: canImport ? 1 : 0.5,
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 16, marginRight: 6 }}>
                            {checked ? '☑' : canImport ? '☐' : '⏭️'}
                          </span>
                          <strong style={{ fontSize: 13 }}>{s.name}</strong>
                        </div>
                        <span style={{ fontSize: 11, color: '#888' }}>{s.rows}행</span>
                      </div>
                      {!canImport && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>보고서 (임포트 불가)</div>}
                    </div>
                  );
                })}
              </div>

              {/* 현재 저장된 선택 표시 */}
              {status?.selectedSheets?.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#888' }}>
                  저장된 선택: {status.selectedSheets.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 동기화 실행 */}
      {status?.spreadsheetId && (
        <div className="card">
          <div className="card-title">⚡ 동기화 실행</div>

          {selectedSheets.length > 0 && (
            <div style={{ padding: '8px 12px', background: '#e3f2fd', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
              동기화 대상: <strong>{selectedSheets.join(', ')}</strong> ({selectedSheets.length}개 탭)
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={handleSyncNow}
              disabled={syncing || selectedSheets.length === 0}
              style={{ padding: '12px 24px', fontSize: 15, opacity: syncing ? 0.6 : 1 }}>
              {syncing ? '⏳ 동기화 중...' : '🔄 지금 동기화'}
            </button>
            {selectedSheets.length === 0 && (
              <span style={{ fontSize: 12, color: '#dc3545' }}>위에서 탭을 선택하세요</span>
            )}
            {status?.lastSync && (
              <span style={{ fontSize: 12, color: '#888' }}>
                마지막: {new Date(status.lastSync).toLocaleString('ko-KR')}
              </span>
            )}
          </div>

          {/* 자동 동기화 */}
          <div style={{ padding: '14px', background: '#f8f9fa', borderRadius: 8 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 13 }}>⏰ 자동 동기화</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={interval} onChange={e => setInterval2(parseInt(e.target.value))}
                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}>
                <option value={10}>10분</option>
                <option value={30}>30분</option>
                <option value={60}>1시간</option>
                <option value={180}>3시간</option>
              </select>
              <span style={{ fontSize: 12, color: '#888' }}>간격</span>
              {status?.autoSync ? (
                <button className="btn btn-danger btn-sm" onClick={() => handleAutoSync(false)}>중지</button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={() => handleAutoSync(true)}
                  disabled={selectedSheets.length === 0}>시작</button>
              )}
              {status?.autoSync && (
                <span style={{ fontSize: 12, color: '#28a745', fontWeight: 'bold' }}>
                  ✅ {status.intervalMinutes}분 간격 실행 중
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 동기화 결과 */}
      {result && (
        <div className="card">
          <div className="card-title" style={{ color: result.ok ? '#28a745' : '#dc3545' }}>
            {result.ok ? '✅ 동기화 완료' : '❌ 동기화 실패'}
          </div>
          {result.error && (
            <div style={{ background: '#ffebee', padding: '10px 14px', borderRadius: 6, marginBottom: 12, color: '#c62828', fontSize: 13 }}>
              {result.error}
            </div>
          )}
          {result.imported && Object.keys(result.imported).length > 0 && (
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
          )}
          {result.skipped?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#aaa' }}>건너뛴 시트: {result.skipped.join(', ')}</div>
          )}
        </div>
      )}
    </div>
  );
}
