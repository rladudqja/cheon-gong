import React from 'react';
import CostPage from '../components/CostPage';

const fmt = (n) => n == null ? '-' : Math.round(n).toLocaleString('ko-KR');

const COLUMNS = [
  { key: 'date', label: '날짜', type: 'date' },
  { key: 'hogi', label: '호기' },
  { key: 'equip_name', label: '장비명' },
  { key: 'car_no', label: '차량번호' },
  { key: 'fuel_type', label: '유종', options: ['경유', '휘발유', '등유'] },
  { key: 'station', label: '주유소' },
  { key: 'company', label: '업체' },
  { key: 'fuel_qty', label: '수량(L)', type: 'number' },
  { key: 'price', label: '단가', type: 'number', format: fmt },
  { key: 'amount', label: '금액', type: 'number', format: fmt },
];

const DEFAULTS = {
  fuel_type: '경유', station: '', equip_name: '', spec: '', car_no: '', company: '',
  date: '', fuel_qty: 0, price: 0, amount: 0, hogi: '', gongjong: ''
};

export default function FuelCostPage() {
  return <CostPage title="유류비" icon="⛽" apiPath="fuel-cost" columns={COLUMNS} defaults={DEFAULTS} />;
}
