'use client';

import { create } from 'zustand';

// ===== Types =====
export interface LeadRow {
  orderId: number;
  product: string;
  customerName: string | null;
  phone: string | null;
  status: string;
  paymentStatus: string;
  productPrice: number | null;
  quantity: number | null;
  grossRevenue: number | null;
  netRevenue: number | null;
  handledBy: string | null;
  productCode: string | null;
  createdAt: string | null;
}

export interface ProductMergeGroup {
  id: string;
  displayName: string;
  products: string[]; // original product names to merge
}

export interface DashboardState {
  // Data
  leads: LeadRow[];
  
  // Config
  csOrder: string[];
  productOrder: string[];
  productMergeGroups: ProductMergeGroup[];
  
  // Actions
  setLeads: (leads: LeadRow[]) => void;
  clearLeads: () => void;
  setCsOrder: (order: string[]) => void;
  setProductOrder: (order: string[]) => void;
  addMergeGroup: (group: ProductMergeGroup) => void;
  updateMergeGroup: (id: string, group: Partial<ProductMergeGroup>) => void;
  removeMergeGroup: (id: string) => void;
}

const DEFAULT_CS_ORDER = [
  'CS GITA',
  'CS SITI',
  'CS RAMA',
  'CS RENO',
  'CS MIRA',
  'CS ALYA',
  'CS AZA',
  'CS RUDY',
  'CS SAKILA',
  'CS ALIN',
  'CS CANDRA',
  'CS DIMAS',
  'CS NIA',
  'CS RIKIE',
  'CS NAUFAL',
  'CS ADINDA',
];

export const useDashboardStore = create<DashboardState>()((set) => ({
  leads: [],
  csOrder: DEFAULT_CS_ORDER,
  productOrder: [],
  productMergeGroups: [],

  setLeads: (leads) => set({ leads }),
  clearLeads: () => set({ leads: [] }),
  setCsOrder: (csOrder) => set({ csOrder }),
  setProductOrder: (productOrder) => set({ productOrder }),
  addMergeGroup: (group) =>
    set((state) => ({ productMergeGroups: [...state.productMergeGroups, group] })),
  updateMergeGroup: (id, updates) =>
    set((state) => ({
      productMergeGroups: state.productMergeGroups.map((g) =>
        g.id === id ? { ...g, ...updates } : g
      ),
    })),
  removeMergeGroup: (id) =>
    set((state) => ({
      productMergeGroups: state.productMergeGroups.filter((g) => g.id !== id),
    })),
}));
