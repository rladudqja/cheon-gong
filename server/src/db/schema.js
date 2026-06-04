// ============================================
// DB 스키마 정의 — GAS 코드의 시트 구조를 테이블로 변환
// ============================================

export function initDB(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── 1. 기본정보 (key-value) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_config (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // ── 2. 장비구분표 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      hogi           TEXT NOT NULL,          -- '1호기', '2호기' ...
      equip_type     TEXT,                   -- '메인장비', '항타기', '압축기' ...
      car_no         TEXT,
      equip_name     TEXT,
      spec           TEXT,
      company        TEXT,
      driver         TEXT,
      start_date     TEXT,                   -- 'yyyy-MM-dd'
      end_date       TEXT,
      monthly_rent   REAL DEFAULT 0,
      daily_rent     REAL DEFAULT 0,
      apply_days     REAL DEFAULT 0,
      set_group      TEXT,
      drill_diameter REAL DEFAULT 0,         -- 작업구경 (mm)
      adjust_factor  REAL DEFAULT 1.0,       -- 구경할증 계수
      created_at     TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // ── 3. 기성양식 (계약 단가표) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_table (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      gongjong TEXT NOT NULL,
      hogi     TEXT,
      method   TEXT NOT NULL,                -- 'T4', '토네이도', '근입' ...
      geology  TEXT,                         -- '토사', '풍화암' ... (부대항목은 NULL)
      unit     TEXT DEFAULT 'm',
      qty      REAL DEFAULT 0,
      price    REAL DEFAULT 0,
      amount   REAL DEFAULT 0
    )
  `);

  // ── 4. 확정기성 (월별 확정물량) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS confirmed_qty (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      gongjong   TEXT NOT NULL,
      method     TEXT NOT NULL,
      geology    TEXT,
      month      TEXT NOT NULL,              -- 'yyyy-MM'
      qty        REAL DEFAULT 0
    )
  `);

  // ── 5. 작업일지 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_log (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      gongjong TEXT NOT NULL,
      hogi     TEXT,
      company  TEXT,
      spec     TEXT,
      date     TEXT NOT NULL,                -- 'yyyy-MM-dd'
      month    TEXT,                         -- 'yyyy-MM'
      method   TEXT NOT NULL,                -- 'T4', '토네이도', '트리콘'
      geology  TEXT,                         -- '토사', '풍화암' ...
      qty      REAL DEFAULT 0,
      time_min REAL DEFAULT 0,              -- 1공당 소요시간(분)
      memo     TEXT,
      section  TEXT,                         -- 구간
      status   TEXT DEFAULT '정상'           -- '정상', '반일', '우천', '고장' ...
    )
  `);

  // ── 6. 장비대 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS equip_cost (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      equip_type TEXT,
      equip_name TEXT,
      spec       TEXT,
      car_no     TEXT,
      company    TEXT,
      date       TEXT NOT NULL,
      hours      REAL DEFAULT 0,
      price      REAL DEFAULT 0,
      amount     REAL DEFAULT 0,
      month      TEXT,
      gongjong   TEXT,
      hogi       TEXT
    )
  `);

  // ── 7. 유류비 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_cost (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      fuel_type  TEXT,                       -- '경유', '휘발유' ...
      station    TEXT,
      equip_name TEXT,
      spec       TEXT,
      car_no     TEXT,
      company    TEXT,
      date       TEXT NOT NULL,
      fuel_qty   REAL DEFAULT 0,
      price      REAL DEFAULT 0,
      amount     REAL DEFAULT 0,
      month      TEXT,
      gongjong   TEXT,
      hogi       TEXT
    )
  `);

  // ── 8. 자재비 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS material_cost (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      mat_type TEXT,
      company  TEXT,
      date     TEXT NOT NULL,
      month    TEXT,
      item     TEXT,
      unit     TEXT,
      qty      REAL DEFAULT 0,
      price    REAL DEFAULT 0,
      amount   REAL DEFAULT 0,
      gongjong TEXT
    )
  `);

  // ── 9. 노무비 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS labor_cost (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      lab_type TEXT,
      company  TEXT,
      task     TEXT,
      name     TEXT,
      date     TEXT NOT NULL,
      hours    REAL DEFAULT 0,
      price    REAL DEFAULT 0,
      amount   REAL DEFAULT 0,
      month    TEXT,
      gongjong TEXT
    )
  `);

  // ── 10. 변경계약 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS contract_change (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      gongjong  TEXT NOT NULL,
      method    TEXT NOT NULL,
      geology   TEXT,
      unit      TEXT DEFAULT 'm',
      price     REAL DEFAULT 0,              -- 계약단가
      qty_orig  REAL DEFAULT 0,              -- 당초 수량
      amt_orig  REAL DEFAULT 0,              -- 당초 금액
      qty_mod   REAL DEFAULT 0,              -- 변경 수량
      amt_mod   REAL DEFAULT 0,              -- 변경 금액
      price_exec REAL DEFAULT 0,             -- 실행단가
      amt_exec   REAL DEFAULT 0              -- 실행금액
    )
  `);

  // ── 11. 간접비 설정 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS indirect_config (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      item    TEXT NOT NULL,
      gubun   TEXT NOT NULL,                 -- '기성' or '투입'
      rate    REAL DEFAULT 0,
      formula TEXT
    )
  `);

  // ── 12. 공통조정 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS common_adjust (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      hogi   TEXT NOT NULL,
      amount REAL DEFAULT 0
    )
  `);

  // ── 인덱스 ──
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_work_date     ON work_log(date);
    CREATE INDEX IF NOT EXISTS idx_work_hogi     ON work_log(hogi);
    CREATE INDEX IF NOT EXISTS idx_work_gongjong ON work_log(gongjong);
    CREATE INDEX IF NOT EXISTS idx_equip_cost_date ON equip_cost(date);
    CREATE INDEX IF NOT EXISTS idx_fuel_cost_date  ON fuel_cost(date);
    CREATE INDEX IF NOT EXISTS idx_material_date   ON material_cost(date);
    CREATE INDEX IF NOT EXISTS idx_labor_date      ON labor_cost(date);
  `);

  // ── 기본정보 초기값 ──
  const defaults = {
    name: '',
    gongjong: '',
    contract_qty: '0',
    start_date: '',
    end_date: '',
    work_days_per_month: '25',
    daily_target: '0',
    settlement_day: '25',
    est_monthly_rent: '0',
    est_daily_rent: '0'
  };

  const upsert = db.prepare(
    'INSERT OR IGNORE INTO project_config (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of Object.entries(defaults)) {
    upsert.run(k, v);
  }
}
