import React from 'react';
import CostPage from '../components/CostPage';

const fmt = (n) => n == null ? '-' : Math.round(n).toLocaleString('ko-KR');

const COLUMNS = [
  { key: 'date', label: '날짜', type: 'date' },
  { key: 'company', label: '업체' },
  { key: 'task', label: '직종' },
  { key: 'name', label: '성명' },
  { key: 'hours', label: '시간', type: 'number' },
  { key: 'price', label: '단가', type: 'number', format: fmt },
  { key: 'amount', label: '금액', type: 'number', format: fmt },
];

const DEFAULTS = {
  lab_type: '', company: '', task: '', name: '', date: '',
  hours: 0, price: 0, amount: 0, gongjong: ''
};

export default function LaborCostPage() {
  return <CostPage title="노무비" icon="👷" apiPath="labor-cost" columns={COLUMNS} defaults={DEFAULTS} />;
}
