import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ConfigPage from './pages/ConfigPage';
import EquipmentPage from './pages/EquipmentPage';
import WorkLogPage from './pages/WorkLogPage';
import PriceTablePage from './pages/PriceTablePage';
import EquipCostPage from './pages/EquipCostPage';
import FuelCostPage from './pages/FuelCostPage';
import MaterialCostPage from './pages/MaterialCostPage';
import LaborCostPage from './pages/LaborCostPage';
import DrillingReportPage from './pages/DrillingReportPage';
import DailyProfitPage from './pages/DailyProfitPage';
import HogiAnalysisPage from './pages/HogiAnalysisPage';
import GisungPage from './pages/GisungPage';
import MonthlyProfitPage from './pages/MonthlyProfitPage';
import SettlementPage from './pages/SettlementPage';
import TimeAnalysisPage from './pages/TimeAnalysisPage';
import CostSummaryPage from './pages/CostSummaryPage';
import ImportPage from './pages/ImportPage';
import SyncPage from './pages/SyncPage';

const NAV = [
  { section: '대시보드' },
  { path: '/', label: '종합 현황', icon: '📊' },
  { section: '기본 설정' },
  { path: '/sync', label: '스프레드시트 동기화', icon: '🔄' },
  { path: '/import', label: 'Excel 가져오기', icon: '📥' },
  { path: '/config', label: '기본정보', icon: '⚙️' },
  { path: '/price-table', label: '기성양식 (단가표)', icon: '📄' },
  { path: '/equipment', label: '장비구분표', icon: '🔧' },
  { section: '데이터 입력' },
  { path: '/work-log', label: '작업일지', icon: '📋' },
  { path: '/equip-cost', label: '장비대', icon: '🚜' },
  { path: '/fuel-cost', label: '유류비', icon: '⛽' },
  { path: '/material-cost', label: '자재비', icon: '🪨' },
  { path: '/labor-cost', label: '노무비', icon: '👷' },
  { section: '보고서' },
  { path: '/report/daily-profit', label: '일일손익분석', icon: '💰' },
  { path: '/report/hogi', label: '호기별분석', icon: '🔧' },
  { path: '/report/gisung', label: '기성산출', icon: '💰' },
  { path: '/report/monthly', label: '월간손익', icon: '📊' },
  { path: '/report/settlement', label: '정산보고서', icon: '📋' },
  { path: '/report/cost-summary', label: '투입비집계', icon: '💵' },
  { path: '/report/time', label: '시간분석', icon: '⏱️' },
  { path: '/report/drilling', label: '천공량 집계', icon: '📈' },
];

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // 페이지 이동 시 사이드바 닫기
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const isReport = location.pathname.startsWith('/report');

  return (
    <div className="layout">
      {/* 모바일 햄버거 */}
      <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* 오버레이 */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* 사이드바 */}
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h1>천공 물량 분석</h1>
        {NAV.map((item, i) =>
          item.section ? (
            <div key={i} className="section-label">{item.section}</div>
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => isActive ? 'active' : ''}
              end={item.path === '/'}
            >
              {item.icon} {item.label}
            </NavLink>
          )
        )}
      </nav>

      {/* 메인 */}
      <main className="main">
        {/* 인쇄 버튼 (보고서 페이지만) */}
        {isReport && (
          <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              className="btn btn-sm"
              style={{ background: '#6c757d', color: '#fff' }}
              onClick={() => window.print()}
            >
              🖨️ 인쇄
            </button>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/price-table" element={<PriceTablePage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/work-log" element={<WorkLogPage />} />
          <Route path="/equip-cost" element={<EquipCostPage />} />
          <Route path="/fuel-cost" element={<FuelCostPage />} />
          <Route path="/material-cost" element={<MaterialCostPage />} />
          <Route path="/labor-cost" element={<LaborCostPage />} />
          <Route path="/report/daily-profit" element={<DailyProfitPage />} />
          <Route path="/report/hogi" element={<HogiAnalysisPage />} />
          <Route path="/report/gisung" element={<GisungPage />} />
          <Route path="/report/monthly" element={<MonthlyProfitPage />} />
          <Route path="/report/settlement" element={<SettlementPage />} />
          <Route path="/report/cost-summary" element={<CostSummaryPage />} />
          <Route path="/report/time" element={<TimeAnalysisPage />} />
          <Route path="/report/drilling" element={<DrillingReportPage />} />
        </Routes>
      </main>
    </div>
  );
}
