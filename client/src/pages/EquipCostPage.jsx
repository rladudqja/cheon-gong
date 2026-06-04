import React from 'react';
import CostPage from '../components/CostPage';

const fmt = (n) => n == null ? '-' : Math.round(n).toLocaleString('ko-KR');

const COLUMNS = [
  { key: 'date', label: '날짜', type: 'date' },
  { key: 'hogi', label: '호기' },
  { key: 'equip_name', label: '장비명' },
  { key: 'spec', label: '규격' },
  { key: 'car_no', label: '차량번호' },
  { key: 'company', label: '업체' },
  { key: 'hours', label: '시간', type: 'number' },
  { key: 'price', label: '단가', type: 'number', format: fmt },
  { key: 'amount', label: '금액', type: 'number', format: fmt },
];

const DEFAULTS = {
  equip_type: '', equip_name: '', spec: '', car_no: '', company: '',
  date: '', hours: 0, price: 0, amount: 0, hogi: '', gongjong: ''
};

export default function EquipCostPage() {
  return <CostPage title="장비대" icon="🚜" apiPath="equip-cost" columns={COLUMNS} defaults={DEFAULTS} />;
}
