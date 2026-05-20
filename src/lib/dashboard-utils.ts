import { LeadRow, ProductMergeGroup } from './dashboard-store';

// Normalize CS name: uppercase + trim
export function normalizeCSName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
}

// Apply merge groups to a product name
export function applyProductMerge(productName: string, groups: ProductMergeGroup[]): string {
  for (const group of groups) {
    if (group.products.some((p) => p.toLowerCase() === productName.toLowerCase())) {
      return group.displayName;
    }
  }
  return productName;
}

// Get the display name for a product (after merging)
export function getDisplayProductName(productName: string, groups: ProductMergeGroup[]): string {
  return applyProductMerge(productName, groups);
}

export interface CSProductData {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
}

export interface CSAggregate {
  csName: string;
  products: Record<string, CSProductData>;
  totalLeads: number;
  totalCompleted: number;
  totalPending: number;
  totalCancelled: number;
  closingRate: number;
}

export interface ProductAggregate {
  productName: string;
  totalLeads: number;
  totalCompleted: number;
  totalPending: number;
  totalCancelled: number;
  closingRate: number;
}

export interface ProcessedData {
  csData: CSAggregate[];
  products: string[];
  productTotals: ProductAggregate[];
  overallTotal: number;
  overallCompleted: number;
  overallPending: number;
  overallCancelled: number;
  overallClosingRate: number;
}

export function processLeadData(
  leads: LeadRow[],
  csOrder: string[],
  productOrder: string[],
  mergeGroups: ProductMergeGroup[]
): ProcessedData {
  const csMap = new Map<string, CSAggregate>();
  const productSet = new Set<string>();

  for (const lead of leads) {
    const csName = lead.handledBy ? normalizeCSName(lead.handledBy) : 'UNASSIGNED';
    const productName = getDisplayProductName(lead.product || 'Unknown', mergeGroups);
    const status = lead.status || 'pending';

    productSet.add(productName);

    if (!csMap.has(csName)) {
      csMap.set(csName, {
        csName,
        products: {},
        totalLeads: 0,
        totalCompleted: 0,
        totalPending: 0,
        totalCancelled: 0,
        closingRate: 0,
      });
    }

    const csData = csMap.get(csName)!;

    if (!csData.products[productName]) {
      csData.products[productName] = { total: 0, completed: 0, pending: 0, cancelled: 0 };
    }

    csData.products[productName].total += 1;
    csData.totalLeads += 1;

    if (status === 'completed') {
      csData.products[productName].completed += 1;
      csData.totalCompleted += 1;
    } else if (status === 'pending') {
      csData.products[productName].pending += 1;
      csData.totalPending += 1;
    } else if (status === 'cancelled') {
      csData.products[productName].cancelled += 1;
      csData.totalCancelled += 1;
    } else {
      csData.products[productName].pending += 1;
      csData.totalPending += 1;
    }
  }

  // Calculate closing rates
  for (const csData of csMap.values()) {
    csData.closingRate = csData.totalLeads > 0
      ? Math.round((csData.totalCompleted / csData.totalLeads) * 10000) / 100
      : 0;
  }

  // Sort CS data by csOrder
  const csDataArray = Array.from(csMap.values());
  if (csOrder.length > 0) {
    csDataArray.sort((a, b) => {
      const aIdx = csOrder.indexOf(a.csName);
      const bIdx = csOrder.indexOf(b.csName);
      if (aIdx === -1 && bIdx === -1) return a.csName.localeCompare(b.csName);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }

  // Sort products by productOrder
  const allProducts = Array.from(productSet);
  if (productOrder.length > 0) {
    allProducts.sort((a, b) => {
      const aIdx = productOrder.indexOf(a);
      const bIdx = productOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  } else {
    allProducts.sort();
  }

  // Product totals
  const productTotals: ProductAggregate[] = allProducts.map((productName) => {
    let totalLeads = 0;
    let totalCompleted = 0;
    let totalPending = 0;
    let totalCancelled = 0;
    for (const csData of csMap.values()) {
      if (csData.products[productName]) {
        totalLeads += csData.products[productName].total;
        totalCompleted += csData.products[productName].completed;
        totalPending += csData.products[productName].pending;
        totalCancelled += csData.products[productName].cancelled;
      }
    }
    return {
      productName,
      totalLeads,
      totalCompleted,
      totalPending,
      totalCancelled,
      closingRate: totalLeads > 0 ? Math.round((totalCompleted / totalLeads) * 10000) / 100 : 0,
    };
  });

  // Overall
  const overallTotal = leads.length;
  const overallCompleted = leads.filter((l) => l.status === 'completed').length;
  const overallPending = leads.filter((l) => l.status === 'pending').length;
  const overallCancelled = leads.filter((l) => l.status === 'cancelled').length;
  const overallClosingRate = overallTotal > 0
    ? Math.round((overallCompleted / overallTotal) * 10000) / 100
    : 0;

  return {
    csData: csDataArray,
    products: allProducts,
    productTotals,
    overallTotal,
    overallCompleted,
    overallPending,
    overallCancelled,
    overallClosingRate,
  };
}

// Get unique product names from leads (before merge)
export function getUniqueProducts(leads: LeadRow[]): string[] {
  const products = new Set<string>();
  for (const lead of leads) {
    products.add(lead.product || 'Unknown');
  }
  return Array.from(products).sort();
}

// Get unique CS names from leads (after normalization)
export function getUniqueCSNames(leads: LeadRow[]): string[] {
  const names = new Set<string>();
  for (const lead of leads) {
    names.add(lead.handledBy ? normalizeCSName(lead.handledBy) : 'UNASSIGNED');
  }
  return Array.from(names).sort();
}
