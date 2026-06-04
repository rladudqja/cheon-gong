import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDB } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'cheon-gong.db');

let rawDb = null;
let wrapper = null;

// sql.js를 better-sqlite3 호환 래퍼로 감싸기
function createWrapper(db) {
  function save() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  // 자동 저장 (5초마다)
  let dirty = false;
  setInterval(() => { if (dirty) { save(); dirty = false; } }, 5000);

  return {
    exec(sql) { db.run(sql); dirty = true; },
    pragma(s) { try { db.run(`PRAGMA ${s}`); } catch(e) {} },
    prepare(sql) {
      return {
        run(...params) {
          db.run(sql, params);
          dirty = true;
          const id = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] || 0;
          return { lastInsertRowid: id, changes: db.getRowsModified() };
        },
        get(...params) {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            stmt.free();
            const row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const rows = [];
          const stmt = db.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
            rows.push(row);
          }
          stmt.free();
          return rows;
        }
      };
    },
    transaction(fn) {
      return (...args) => {
        db.run('BEGIN');
        try { fn(...args); db.run('COMMIT'); dirty = true; }
        catch(e) { db.run('ROLLBACK'); throw e; }
      };
    },
    save
  };
}

export async function initDBConnection() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(buf);
  } else {
    rawDb = new SQL.Database();
  }
  wrapper = createWrapper(rawDb);
  initDB(wrapper);
  wrapper.save();
  return wrapper;
}

export function getDB() {
  if (!wrapper) throw new Error('DB not initialized. Call initDBConnection() first.');
  return wrapper;
}
