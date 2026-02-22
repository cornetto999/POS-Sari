// Mock data and state management for the sari-sari store POS
import { useState, useCallback } from 'react';

export interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  minStockLevel: number;
  barcode?: string;
  image?: string;
}

export interface Customer {
  id: string;
  fullName: string;
  contactNumber?: string;
  notes?: string;
  totalBalance: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Sale {
  id: string;
  items: { productName: string; qty: number; price: number; total: number }[];
  total: number;
  paymentType: 'cash' | 'utang';
  cashReceived?: number;
  change?: number;
  customerId?: string;
  customerName?: string;
  cashier: string;
  date: string;
}

export interface UtangRecord {
  id: string;
  customerId: string;
  saleId?: string;
  amount: number;
  type: 'credit' | 'payment';
  note?: string;
  date: string;
}

export const CATEGORIES = ['Beverages', 'Snacks', 'Canned Goods', 'Condiments', 'Personal Care', 'Household', 'Frozen', 'Bread & Bakery', 'Others'];

export const SAMPLE_PRODUCTS: Product[] = [
  { id: '1', name: 'Lucky Me Pancit Canton', category: 'Snacks', costPrice: 10, sellingPrice: 14, stockQty: 48, minStockLevel: 10, image: '' },
  { id: '2', name: 'Coca-Cola 250ml', category: 'Beverages', costPrice: 12, sellingPrice: 18, stockQty: 36, minStockLevel: 12, image: '' },
  { id: '3', name: 'Argentina Corned Beef', category: 'Canned Goods', costPrice: 28, sellingPrice: 38, stockQty: 20, minStockLevel: 5, image: '' },
  { id: '4', name: 'Safeguard Soap', category: 'Personal Care', costPrice: 22, sellingPrice: 32, stockQty: 15, minStockLevel: 5, image: '' },
  { id: '5', name: 'C2 Apple 250ml', category: 'Beverages', costPrice: 10, sellingPrice: 15, stockQty: 30, minStockLevel: 10, image: '' },
  { id: '6', name: 'Boy Bawang Garlic', category: 'Snacks', costPrice: 8, sellingPrice: 12, stockQty: 40, minStockLevel: 10, image: '' },
  { id: '7', name: 'Century Tuna 155g', category: 'Canned Goods', costPrice: 24, sellingPrice: 35, stockQty: 18, minStockLevel: 5, image: '' },
  { id: '8', name: 'Tide Powder 65g', category: 'Household', costPrice: 7, sellingPrice: 11, stockQty: 50, minStockLevel: 15, image: '' },
  { id: '9', name: 'Kopiko Brown 25g', category: 'Beverages', costPrice: 5, sellingPrice: 8, stockQty: 60, minStockLevel: 20, image: '' },
  { id: '10', name: 'SkyFlakes Crackers', category: 'Snacks', costPrice: 6, sellingPrice: 10, stockQty: 35, minStockLevel: 10, image: '' },
  { id: '11', name: 'Silver Swan Soy Sauce', category: 'Condiments', costPrice: 8, sellingPrice: 13, stockQty: 25, minStockLevel: 8, image: '' },
  { id: '12', name: 'Gardenia Bread', category: 'Bread & Bakery', costPrice: 50, sellingPrice: 62, stockQty: 8, minStockLevel: 3, image: '' },
];

export const SAMPLE_CUSTOMERS: Customer[] = [
  { id: '1', fullName: 'Maria Santos', contactNumber: '0917-123-4567', notes: 'Regular customer', totalBalance: 250 },
  { id: '2', fullName: 'Juan Dela Cruz', contactNumber: '0918-987-6543', notes: '', totalBalance: 180 },
  { id: '3', fullName: 'Ana Reyes', notes: 'Pays weekly', totalBalance: 0 },
];

export const SAMPLE_UTANG: UtangRecord[] = [
  { id: '1', customerId: '1', amount: 150, type: 'credit', note: 'Groceries', date: '2026-02-19' },
  { id: '2', customerId: '1', amount: 100, type: 'credit', note: 'Snacks', date: '2026-02-20' },
  { id: '3', customerId: '2', amount: 180, type: 'credit', note: 'Weekly groceries', date: '2026-02-18' },
];

export const SAMPLE_SALES: Sale[] = [
  { id: '1', items: [{ productName: 'Lucky Me Pancit Canton', qty: 3, price: 14, total: 42 }, { productName: 'Coca-Cola 250ml', qty: 2, price: 18, total: 36 }], total: 78, paymentType: 'cash', cashReceived: 100, change: 22, cashier: 'Admin', date: '2026-02-21T08:30:00' },
  { id: '2', items: [{ productName: 'Argentina Corned Beef', qty: 1, price: 38, total: 38 }, { productName: 'Gardenia Bread', qty: 1, price: 62, total: 62 }], total: 100, paymentType: 'utang', customerId: '1', customerName: 'Maria Santos', cashier: 'Admin', date: '2026-02-21T09:15:00' },
  { id: '3', items: [{ productName: 'Tide Powder 65g', qty: 5, price: 11, total: 55 }], total: 55, paymentType: 'cash', cashReceived: 60, change: 5, cashier: 'Admin', date: '2026-02-20T14:00:00' },
];
