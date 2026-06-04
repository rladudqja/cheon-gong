import React from 'react';
import CostPage from '../components/CostPage';

const fmt = (n) => n == null ? '-' : Math.round(n).toLocaleString('ko-KR');

const COLUMNS = [
  { key: 'date', label: '날짜', type: 'date' },
  { key: 'company', label: '업체' },
  { key: 'item', label: '품명' },
  { key: 'unit', label: '단위' },
  { key: 'qty', label: '수량', type: 'number' },
  { key: 'price', label: '단가', type: 'number', format: fmt },
  { key: 'amount', label: '금액', type: 'number', format: fmt },
];

const DEFAULTS = {
  mat_type: '', company: '', date: '', item: '', unit: '',
  qty: 0, price: 0, amount: 0, gongjong: ''
};

export default function MaterialCostPage() {
  return <CostPage title="자재비" icon="🪨" apiPath="material-cost" columns={COLUMNS} defaults={DEFAULTS} />;
}
