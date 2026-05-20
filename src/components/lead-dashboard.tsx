'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as XLSX from 'xlsx';
import { useTheme } from 'next-themes';
import {
  Upload,
  GripVertical,
  TrendingUp,
  Users,
  ShoppingCart,
  BarChart3,
  Trash2,
  Loader2,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowLeftRight,
  Settings2,
  Plus,
  X,
  Target,
  Package,
  UserCheck,
  Table2,
  Crown,
  Medal,
  Trophy,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDashboardStore } from '@/lib/dashboard-store';
import { useToast } from '@/hooks/use-toast';
import {
  processLeadData,
  getUniqueProducts,
  normalizeCSName,
  type ProcessedData,
  type CSAggregate,
  type ProductAggregate,
} from '@/lib/dashboard-utils';

// ===== Constants =====
const CS_COL_WIDTH = 150;
const PRODUCT_COL_ABS_MIN_WIDTH = 70; // absolute minimum, never go below this
const SUMMARY_COL_WIDTH = 75;

// Calculate minimum product column width based on longest product name
function calcProductColMinWidth(products: string[]): number {
  if (products.length === 0) return PRODUCT_COL_ABS_MIN_WIDTH;
  const longestName = products.reduce((a, b) => a.length > b.length ? a : b, '');
  // At ~6px per character for 9px uppercase font + padding
  const needed = Math.ceil(longestName.length * 6) + 30; // 30px for grip handle + padding
  return Math.max(PRODUCT_COL_ABS_MIN_WIDTH, Math.min(needed, 280)); // cap at 280px max
}

// ===== Rate Color Helpers =====
function getRateColor(rate: number) {
  if (rate >= 50) return { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500' };
  if (rate >= 25) return { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500' };
  return { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', bar: 'bg-red-500' };
}

// ===== Dark Mode Toggle =====
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg">
        <Sun className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="h-9 w-9 p-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-gray-500" />
      )}
    </Button>
  );
}

// ===== Sortable CS Row (each row is a full-width flex container) =====
function SortableCSRow({
  cs,
  products,
  id,
  mode,
  rowIndex,
  colWidth,
  colMinWidth,
}: {
  cs: CSAggregate;
  products: string[];
  id: string;
  mode: 'lead' | 'closing' | 'rate';
  rowIndex: number;
  colWidth: number;
  colMinWidth: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    minWidth: `${CS_COL_WIDTH + products.length * colWidth + SUMMARY_COL_WIDTH}px`,
    opacity: isDragging ? 0.4 : 1,
  };

  // Alternating row colors
  const isEven = rowIndex % 2 === 0;

  return (
    <div ref={setNodeRef} style={style} className="group">
      {/* CS Name Cell */}
      <div
        className={`sticky left-0 z-20 border-b flex items-center gap-2 shrink-0 shadow-[2px_0_8px_-3px_rgba(0,0,0,0.07)] dark:shadow-[2px_0_8px_-3px_rgba(0,0,0,0.3)] ${
          isEven
            ? 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
            : 'bg-slate-50 dark:bg-gray-800/60 border-gray-100 dark:border-gray-700/50'
        }`}
        style={{ width: CS_COL_WIDTH, minWidth: CS_COL_WIDTH }}
      >
        <button
          className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-all shrink-0 ml-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500 shrink-0" />
          <span className="font-semibold text-xs text-gray-800 dark:text-gray-200 truncate uppercase tracking-wide">
            {cs.csName.replace('CS ', '')}
          </span>
        </div>
      </div>

      {/* Product Cells */}
      {products.map((product) => {
        const data = cs.products[product];
        if (!data) {
          return (
            <div
              key={product}
              className={`border-b flex items-center justify-center shrink-0 ${
                isEven
                  ? 'bg-white dark:bg-gray-900 border-gray-50 dark:border-gray-800'
                  : 'bg-slate-50 dark:bg-gray-800/60 border-gray-50 dark:border-gray-700/50'
              }`}
              style={{ width: colWidth, minWidth: colMinWidth }}
            >
              <span className="text-gray-200 dark:text-gray-700 text-xs">—</span>
            </div>
          );
        }
        const rate = data.total > 0 ? (data.completed / data.total) * 100 : 0;
        const rc = getRateColor(rate);

        if (mode === 'lead') {
          return (
            <div
              key={product}
              className={`border-b flex items-center justify-center shrink-0 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors ${
                isEven
                  ? 'bg-white dark:bg-gray-900 border-gray-50 dark:border-gray-800'
                  : 'bg-slate-50 dark:bg-gray-800/60 border-gray-50 dark:border-gray-700/50'
              }`}
              style={{ width: colWidth, minWidth: colMinWidth }}
            >
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums cursor-default">{data.total}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-semibold mb-1">{product}</p>
                    <div className="space-y-0.5">
                      <p>Closing: {data.completed}</p>
                      <p>Pending: {data.pending}</p>
                      <p>Cancel: {data.cancelled}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        }

        if (mode === 'closing') {
          return (
            <div
              key={product}
              className={`border-b flex items-center justify-center shrink-0 transition-colors ${
                data.completed > 0
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                  : isEven
                    ? 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                    : 'bg-slate-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800'
              } border-gray-50 dark:border-gray-800`}
              style={{ width: colWidth, minWidth: colMinWidth }}
            >
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{data.completed}</span>
            </div>
          );
        }

        // rate mode
        return (
          <div
            key={product}
            className={`border-b flex flex-col items-center justify-center gap-0.5 shrink-0 ${rc.bg} transition-colors border-gray-50 dark:border-gray-800`}
            style={{ width: colWidth, minWidth: colMinWidth }}
          >
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-default flex flex-col items-center">
                    <span className={`text-sm font-bold tabular-nums ${rc.text}`}>{rate.toFixed(1)}%</span>
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums">{data.completed}/{data.total}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-semibold mb-1">{product}</p>
                  <div className="space-y-0.5">
                    <p>Closing: {data.completed}</p>
                    <p>Pending: {data.pending}</p>
                    <p>Cancel: {data.cancelled}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      })}

      {/* Summary Cell */}
      {mode === 'lead' && (
        <div
          className="border-b border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 bg-gray-50/80 dark:bg-gray-800/80"
          style={{ width: SUMMARY_COL_WIDTH, minWidth: SUMMARY_COL_WIDTH }}
        >
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300 tabular-nums">{cs.totalLeads}</span>
        </div>
      )}
      {mode === 'closing' && (
        <div
          className="border-b border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 bg-emerald-50/80 dark:bg-emerald-950/30"
          style={{ width: SUMMARY_COL_WIDTH, minWidth: SUMMARY_COL_WIDTH }}
        >
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{cs.totalCompleted}</span>
        </div>
      )}
      {mode === 'rate' && (
        <div
          className={`border-b border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 ${getRateColor(cs.closingRate).bg}`}
          style={{ width: SUMMARY_COL_WIDTH, minWidth: SUMMARY_COL_WIDTH }}
        >
          <span className={`text-sm font-bold tabular-nums ${getRateColor(cs.closingRate).text}`}>{cs.closingRate.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

// ===== Sortable Column Header =====
function SortableColHeader({ id, label, colWidth, colMinWidth }: { id: string; label: string; colWidth: number; colMinWidth: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: colWidth,
    minWidth: colMinWidth,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-slate-800 dark:bg-gray-950 border-b border-r border-slate-700 dark:border-gray-800 px-1.5 py-2 text-center shrink-0"
    >
      <div className="flex items-center justify-center gap-0.5">
        <button
          className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-slate-700 dark:hover:bg-gray-800 text-slate-500 hover:text-slate-300 dark:hover:text-gray-400 transition-colors shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3 h-3 rotate-90" />
        </button>
        <span className="text-[9px] font-bold text-slate-300 dark:text-gray-400 uppercase tracking-wider whitespace-normal break-words leading-tight" title={label}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ===== Merge Settings Dialog =====
function MergeSettingsDialog() {
  const { leads, productMergeGroups, addMergeGroup, removeMergeGroup } = useDashboardStore();
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const uniqueProducts = useMemo(() => getUniqueProducts(leads), [leads]);

  const handleAddGroup = () => {
    if (!newGroupName.trim() || selectedProducts.length === 0) return;
    addMergeGroup({
      id: crypto.randomUUID(),
      displayName: newGroupName.trim(),
      products: selectedProducts,
    });
    setNewGroupName('');
    setSelectedProducts([]);
  };

  const toggleProduct = (product: string) => {
    setSelectedProducts((prev) =>
      prev.includes(product) ? prev.filter((p) => p !== product) : [...prev, product]
    );
  };

  const availableProducts = useMemo(() => {
    const usedProducts = new Set(productMergeGroups.flatMap((g) => g.products));
    return uniqueProducts.filter((p) => !usedProducts.has(p));
  }, [uniqueProducts, productMergeGroups]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5 h-9 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg">
          <Settings2 className="w-3.5 h-3.5" />Merge Produk
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Pengaturan Merge Produk
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">Gabungkan beberapa nama produk menjadi satu untuk tampilan yang rapi.</p>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {productMergeGroups.length > 0 && (
              <div className="space-y-2">
                {productMergeGroups.map((group) => (
                  <div key={group.id} className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 p-3 bg-emerald-50/30 dark:bg-emerald-950/20">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {group.displayName}
                      </span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => removeMergeGroup(group.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {group.products.map((p) => (
                        <Badge key={p} variant="secondary" className="text-[10px] px-2 py-0 h-5 bg-white dark:bg-gray-800">{p}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Separator />
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Tambah Group Baru</h4>
              <Input placeholder="Nama produk gabungan (misal: Ochiban Black)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="text-sm" />
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Pilih produk yang ingin digabung:</p>
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                  {availableProducts.map((product) => (
                    <button
                      key={product}
                      onClick={() => toggleProduct(product)}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                        selectedProducts.includes(product)
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold shadow-sm'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                      }`}
                    >
                      {product}
                    </button>
                  ))}
                  {availableProducts.length === 0 && <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">Semua produk sudah di grup</p>}
                </div>
              </div>
              <Button size="sm" className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600" disabled={!newGroupName.trim() || selectedProducts.length === 0} onClick={handleAddGroup}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Gabung {selectedProducts.length} Produk → &quot;{newGroupName || '...'}&quot;
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ===== Confirm Dialog =====
function ConfirmDialog({ open, onClose, onConfirm, title, description }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm mx-4 border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{description}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-lg">Batal</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} className="rounded-lg">Hapus</Button>
        </div>
      </div>
    </div>
  );
}

// ===== Grid Dashboard =====
function DashboardGrid({ processed, mode }: { processed: ProcessedData; mode: 'lead' | 'closing' | 'rate' }) {
  const { csOrder, productOrder, setCsOrder, setProductOrder } = useDashboardStore();
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [activeColId, setActiveColId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width with ResizeObserver
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Calculate dynamic minimum column width based on product names
  const numProducts = processed.products.length;
  const productColMinWidth = useMemo(() => calcProductColMinWidth(processed.products), [processed.products]);
  const availableForProducts = containerWidth > 0 ? containerWidth - CS_COL_WIDTH - SUMMARY_COL_WIDTH : 0;
  const colWidth = numProducts > 0 && availableForProducts > 0
    ? Math.max(productColMinWidth, Math.floor(availableForProducts / numProducts))
    : productColMinWidth;

  const rowSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const colSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleRowDragEnd = useCallback((event: DragEndEvent) => {
    setActiveRowId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = processed.csData.findIndex((cs) => cs.csName === active.id);
    const newIdx = processed.csData.findIndex((cs) => cs.csName === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const newCsData = arrayMove(processed.csData, oldIdx, newIdx);
    setCsOrder(newCsData.map((cs) => cs.csName));
  }, [processed.csData, setCsOrder]);

  const handleColDragEnd = useCallback((event: DragEndEvent) => {
    setActiveColId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = processed.products.indexOf(String(active.id));
    const newIdx = processed.products.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const newProducts = arrayMove(processed.products, oldIdx, newIdx);
    setProductOrder(newProducts);
  }, [processed.products, setProductOrder]);

  const summaryLabel = mode === 'lead' ? 'TOTAL' : mode === 'closing' ? 'DONE' : 'CL RATE';
  const gridMinWidth = CS_COL_WIDTH + numProducts * productColMinWidth + SUMMARY_COL_WIDTH;
  // Use the wider of: min width or expanded width
  const actualWidth = CS_COL_WIDTH + numProducts * colWidth + SUMMARY_COL_WIDTH;
  const useFullWidth = actualWidth <= containerWidth || containerWidth === 0;

  return (
    <Card className="border border-gray-200/60 dark:border-gray-800 shadow-sm overflow-hidden rounded-xl bg-white dark:bg-gray-900" ref={containerRef}>
      <div className="overflow-auto max-h-[calc(100vh-310px)]" style={{ scrollbarWidth: 'thin' }}>
        {/* ===== HEADER ROW (Column DnD) ===== */}
        <DndContext sensors={colSensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveColId(String(e.active.id))} onDragEnd={handleColDragEnd}>
          <SortableContext items={processed.products} strategy={horizontalListSortingStrategy}>
            <div className="sticky top-0 z-10 flex" style={{ minWidth: `${gridMinWidth}px`, width: useFullWidth ? '100%' : undefined }}>
              {/* Corner Cell */}
              <div
                className="sticky left-0 z-30 bg-slate-800 dark:bg-gray-950 border-b border-r border-slate-700 dark:border-gray-800 px-3 py-3 flex items-center shrink-0 shadow-[2px_0_8px_-3px_rgba(0,0,0,0.3)]"
                style={{ width: CS_COL_WIDTH, minWidth: CS_COL_WIDTH }}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300 dark:text-gray-400 ml-7">NAMA CS</span>
              </div>
              {/* Product Headers */}
              {processed.products.map((p) => (
                <SortableColHeader key={p} id={p} label={p} colWidth={colWidth} colMinWidth={productColMinWidth} />
              ))}
              {/* Summary Header */}
              <div
                className="bg-slate-700 dark:bg-gray-900 border-b border-slate-600 dark:border-gray-800 px-2 py-3 text-center flex items-center justify-center shrink-0"
                style={{ width: SUMMARY_COL_WIDTH, minWidth: SUMMARY_COL_WIDTH }}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300 dark:text-gray-400">{summaryLabel}</span>
              </div>
            </div>
          </SortableContext>
          <DragOverlay>
            {activeColId ? (
              <div className="bg-slate-700 dark:bg-gray-800 text-white px-4 py-2.5 rounded-lg shadow-2xl text-xs font-bold border border-slate-600 dark:border-gray-700">{activeColId}</div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* ===== DATA ROWS (Row DnD) ===== */}
        <DndContext sensors={rowSensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveRowId(String(e.active.id))} onDragEnd={handleRowDragEnd}>
          <SortableContext items={processed.csData.map((cs) => cs.csName)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col" style={{ minWidth: `${gridMinWidth}px`, width: useFullWidth ? '100%' : undefined }}>
              {processed.csData.map((cs, idx) => (
                <SortableCSRow key={cs.csName} cs={cs} products={processed.products} id={cs.csName} mode={mode} rowIndex={idx} colWidth={colWidth} colMinWidth={productColMinWidth} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeRowId ? (
              <div className="bg-white dark:bg-gray-800 px-4 py-2.5 rounded-xl shadow-2xl text-sm font-bold border-2 border-emerald-400 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <GripVertical className="w-4 h-4 text-emerald-500" />{activeRowId}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* ===== FOOTER ROW ===== */}
        <div className="flex bg-gray-50/80 dark:bg-gray-800/80" style={{ minWidth: `${gridMinWidth}px`, width: useFullWidth ? '100%' : undefined }}>
          <div
            className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 border-t-2 border-r border-gray-200 dark:border-gray-700 px-3 py-2.5 flex items-center shrink-0 shadow-[2px_0_8px_-3px_rgba(0,0,0,0.07)] dark:shadow-[2px_0_8px_-3px_rgba(0,0,0,0.3)]"
            style={{ width: CS_COL_WIDTH, minWidth: CS_COL_WIDTH }}
          >
            <span className="ml-7 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">TOTAL</span>
          </div>
          {processed.products.map((product) => {
            const pt = processed.productTotals.find((p) => p.productName === product);
            if (!pt) return <div key={product} className="border-t-2 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0" style={{ width: colWidth, minWidth: productColMinWidth }}><span className="text-gray-200 dark:text-gray-700 text-xs">—</span></div>;
            const rc = getRateColor(pt.closingRate);

            if (mode === 'lead') {
              return <div key={product} className="border-t-2 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 bg-gray-50/60 dark:bg-gray-800/60" style={{ width: colWidth, minWidth: productColMinWidth }}><span className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums">{pt.totalLeads}</span></div>;
            }
            if (mode === 'closing') {
              return <div key={product} className="border-t-2 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 bg-emerald-50/60 dark:bg-emerald-950/30" style={{ width: colWidth, minWidth: productColMinWidth }}><span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{pt.totalCompleted}</span></div>;
            }
            return <div key={product} className={`border-t-2 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 ${rc.bg}`} style={{ width: colWidth, minWidth: productColMinWidth }}><span className={`text-sm font-bold tabular-nums ${rc.text}`}>{pt.closingRate.toFixed(1)}%</span></div>;
          })}
          {mode === 'lead' && (
            <div className="border-t-2 border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 bg-gray-100/80 dark:bg-gray-700/50" style={{ width: SUMMARY_COL_WIDTH, minWidth: SUMMARY_COL_WIDTH }}><span className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums">{processed.overallTotal.toLocaleString()}</span></div>
          )}
          {mode === 'closing' && (
            <div className="border-t-2 border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 bg-emerald-100/80 dark:bg-emerald-950/40" style={{ width: SUMMARY_COL_WIDTH, minWidth: SUMMARY_COL_WIDTH }}><span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{processed.overallCompleted.toLocaleString()}</span></div>
          )}
          {mode === 'rate' && (
            <div className={`border-t-2 border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 ${getRateColor(processed.overallClosingRate).bg}`} style={{ width: SUMMARY_COL_WIDTH, minWidth: SUMMARY_COL_WIDTH }}><span className={`text-sm font-bold tabular-nums ${getRateColor(processed.overallClosingRate).text}`}>{processed.overallClosingRate.toFixed(1)}%</span></div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ===== Closing Rate by Product Tab =====
function ClosingRateProductTab({ processed }: { processed: ProcessedData }) {
  const sorted = [...processed.productTotals].sort((a, b) => b.closingRate - a.closingRate);
  return (
    <Card className="border border-gray-200/60 dark:border-gray-800 shadow-sm overflow-hidden rounded-xl bg-white dark:bg-gray-900">
      <div className="overflow-y-auto max-h-[calc(100vh-310px)]" style={{ scrollbarWidth: 'thin' }}>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {/* Header */}
          <div className="sticky top-0 z-10 grid grid-cols-[40px_1fr_80px_80px_80px_130px] items-center bg-slate-800 dark:bg-gray-950">
            <div className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">#</div>
            <div className="px-3 py-3 text-[10px] font-bold text-slate-300 dark:text-gray-400 uppercase tracking-wider">Produk</div>
            <div className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-center">Lead</div>
            <div className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-center">Closing</div>
            <div className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-center">Pending</div>
            <div className="px-3 py-3 text-[10px] font-bold text-emerald-400 dark:text-emerald-500 uppercase tracking-wider text-center">Closing Rate</div>
          </div>
          {/* Rows */}
          {sorted.map((pt, i) => {
            const rc = getRateColor(pt.closingRate);
            const rankIcon = i === 0 ? <Crown className="w-4 h-4 text-yellow-500" /> : i === 1 ? <Medal className="w-4 h-4 text-gray-400" /> : i === 2 ? <Medal className="w-4 h-4 text-amber-600" /> : <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600">{i + 1}</span>;
            const isEven = i % 2 === 0;
            return (
              <div
                key={pt.productName}
                className={`grid grid-cols-[40px_1fr_80px_80px_80px_130px] items-center hover:bg-sky-50/50 dark:hover:bg-sky-950/20 transition-colors ${
                  isEven
                    ? 'bg-white dark:bg-gray-900'
                    : 'bg-slate-50 dark:bg-gray-800/50'
                }`}
              >
                <div className="px-3 py-3 flex items-center justify-center">{rankIcon}</div>
                <div className="px-3 py-3"><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{pt.productName}</span></div>
                <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-gray-700 dark:text-gray-300 tabular-nums">{pt.totalLeads}</span></div>
                <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{pt.totalCompleted}</span></div>
                <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">{pt.totalPending}</span></div>
                <div className={`px-3 py-3 ${rc.bg}`}>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className={`h-full rounded-full ${rc.bar} transition-all`} style={{ width: `${Math.min(pt.closingRate, 100)}%` }} />
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${rc.text}`}>{pt.closingRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Footer */}
          <div className="grid grid-cols-[40px_1fr_80px_80px_80px_130px] items-center bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700">
            <div className="px-3 py-3" />
            <div className="px-3 py-3 font-bold text-xs text-gray-700 dark:text-gray-300">TOTAL</div>
            <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-gray-800 dark:text-gray-200 tabular-nums">{processed.overallTotal.toLocaleString()}</span></div>
            <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{processed.overallCompleted.toLocaleString()}</span></div>
            <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">{processed.overallPending.toLocaleString()}</span></div>
            <div className={`px-3 py-3 ${getRateColor(processed.overallClosingRate).bg}`}>
              <div className="flex items-center justify-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className={`h-full rounded-full ${getRateColor(processed.overallClosingRate).bar}`} style={{ width: `${Math.min(processed.overallClosingRate, 100)}%` }} />
                </div>
                <span className={`text-xs font-bold tabular-nums ${getRateColor(processed.overallClosingRate).text}`}>{processed.overallClosingRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ===== Closing Rate by CS Tab =====
function ClosingRateCSTab({ processed }: { processed: ProcessedData }) {
  const sorted = [...processed.csData].sort((a, b) => b.closingRate - a.closingRate);
  return (
    <Card className="border border-gray-200/60 dark:border-gray-800 shadow-sm overflow-hidden rounded-xl bg-white dark:bg-gray-900">
      <div className="overflow-y-auto max-h-[calc(100vh-310px)]" style={{ scrollbarWidth: 'thin' }}>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {/* Header */}
          <div className="sticky top-0 z-10 grid grid-cols-[40px_1fr_70px_70px_70px_70px_130px] items-center bg-slate-800 dark:bg-gray-950">
            <div className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">#</div>
            <div className="px-3 py-3 text-[10px] font-bold text-slate-300 dark:text-gray-400 uppercase tracking-wider">CS</div>
            <div className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-center">Lead</div>
            <div className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-center">Closing</div>
            <div className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-center">Pending</div>
            <div className="px-3 py-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-center">Cancel</div>
            <div className="px-3 py-3 text-[10px] font-bold text-emerald-400 dark:text-emerald-500 uppercase tracking-wider text-center">Closing Rate</div>
          </div>
          {/* Rows */}
          {sorted.map((cs, i) => {
            const rc = getRateColor(cs.closingRate);
            const rankIcon = i === 0 ? <Trophy className="w-4 h-4 text-yellow-500" /> : i === 1 ? <Medal className="w-4 h-4 text-gray-400" /> : i === 2 ? <Medal className="w-4 h-4 text-amber-600" /> : <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600">{i + 1}</span>;
            const isEven = i % 2 === 0;
            return (
              <div
                key={cs.csName}
                className={`grid grid-cols-[40px_1fr_70px_70px_70px_70px_130px] items-center hover:bg-sky-50/50 dark:hover:bg-sky-950/20 transition-colors ${
                  isEven
                    ? 'bg-white dark:bg-gray-900'
                    : 'bg-slate-50 dark:bg-gray-800/50'
                }`}
              >
                <div className="px-3 py-3 flex items-center justify-center">{rankIcon}</div>
                <div className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center shrink-0 shadow-sm">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase">{cs.csName.replace('CS ', '').charAt(0)}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">{cs.csName}</span>
                  </div>
                </div>
                <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-gray-700 dark:text-gray-300 tabular-nums">{cs.totalLeads}</span></div>
                <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{cs.totalCompleted}</span></div>
                <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">{cs.totalPending}</span></div>
                <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-red-500 dark:text-red-400 tabular-nums">{cs.totalCancelled}</span></div>
                <div className={`px-3 py-3 ${rc.bg}`}>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${rc.bar}`} style={{ width: `${Math.min(cs.closingRate, 100)}%` }} />
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${rc.text}`}>{cs.closingRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Footer */}
          <div className="grid grid-cols-[40px_1fr_70px_70px_70px_70px_130px] items-center bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700">
            <div className="px-3 py-3" />
            <div className="px-3 py-3 font-bold text-xs text-gray-700 dark:text-gray-300">TOTAL</div>
            <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-gray-800 dark:text-gray-200 tabular-nums">{processed.overallTotal.toLocaleString()}</span></div>
            <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{processed.overallCompleted.toLocaleString()}</span></div>
            <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">{processed.overallPending.toLocaleString()}</span></div>
            <div className="px-3 py-3 text-center"><span className="text-xs font-bold text-red-500 dark:text-red-400 tabular-nums">{processed.overallCancelled.toLocaleString()}</span></div>
            <div className={`px-3 py-3 ${getRateColor(processed.overallClosingRate).bg}`}>
              <div className="flex items-center justify-center gap-2">
                <div className="w-16 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className={`h-full rounded-full ${getRateColor(processed.overallClosingRate).bar}`} style={{ width: `${Math.min(processed.overallClosingRate, 100)}%` }} />
                </div>
                <span className={`text-xs font-bold tabular-nums ${getRateColor(processed.overallClosingRate).text}`}>{processed.overallClosingRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ===== Main Dashboard Component =====
export default function LeadDashboard() {
  const { leads, csOrder, productOrder, productMergeGroups, setLeads, clearLeads, setCsOrder } = useDashboardStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadedRows, setUploadedRows] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('lead');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processed = useMemo(
    () => processLeadData(leads, csOrder, productOrder, productMergeGroups),
    [leads, csOrder, productOrder, productMergeGroups]
  );

  const hasData = leads.length > 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadedRows(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
            const totalRows = jsonData.length;
            setUploadTotal(totalRows);

            if (totalRows === 0) {
              toast({ title: 'Error', description: 'File kosong', variant: 'destructive' });
              setUploading(false);
              resolve();
              return;
            }

            const allLeads: typeof leads = [];
            for (let i = 0; i < totalRows; i++) {
              const row = jsonData[i];
              allLeads.push({
                orderId: Number(row.order_id) || 0,
                product: String(row.product || 'Unknown'),
                customerName: row.name ? String(row.name) : null,
                phone: row.phone ? String(row.phone) : null,
                status: String(row.status || 'pending'),
                paymentStatus: String(row.payment_status || 'unpaid'),
                productPrice: row.product_price ? Number(row.product_price) : null,
                quantity: row.quantity ? Number(row.quantity) : null,
                grossRevenue: row.gross_revenue ? Number(row.gross_revenue) : null,
                netRevenue: row.net_revenue ? Number(row.net_revenue) : null,
                handledBy: row.handled_by ? normalizeCSName(String(row.handled_by)) : null,
                productCode: row.product_code ? String(row.product_code) : null,
                createdAt: row.created_at ? String(row.created_at) : null,
              });
              if ((i + 1) % 500 === 0 || i === totalRows - 1) {
                setUploadProgress(Math.round(((i + 1) / totalRows) * 100));
                setUploadedRows(i + 1);
              }
            }

            setLeads(allLeads);
            const currentOrder = useDashboardStore.getState().csOrder;
            if (currentOrder.length === 0) {
              const csNames = [...new Set(allLeads.map((l) => l.handledBy || 'UNASSIGNED'))].sort();
              setCsOrder(csNames);
            }

            toast({ title: 'Upload Selesai!', description: `Berhasil memproses ${totalRows} baris data` });
            resolve();
          } catch (err) { reject(err); }
        }, 50);
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Upload Error', description: 'Gagal upload file. Silakan coba lagi.', variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadTotal(0);
      setUploadedRows(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col">
      <ConfirmDialog open={showClearConfirm} onClose={() => setShowClearConfirm(false)} onConfirm={() => { clearLeads(); setShowClearConfirm(false); }} title="Hapus Semua Data?" description="Data yang diupload akan dihapus permanen. Tindakan ini tidak bisa dibatalkan." />

      {/* ===== HEADER ===== */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200/60 dark:border-gray-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[2000px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                <BarChart3 className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-gray-900 dark:text-gray-100 leading-tight tracking-tight">Lead Dashboard</h1>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">Monitor &amp; track sales team performance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {hasData && (
                <>
                  <MergeSettingsDialog />
                  <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(true)} className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-9 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5 mr-1" />Hapus
                  </Button>
                </>
              )}
              <label htmlFor="excel-upload">
                <Button size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-md h-9 rounded-lg" disabled={uploading} asChild>
                  <span className="cursor-pointer">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                    {uploading ? 'Processing...' : 'Upload Excel'}
                  </span>
                </Button>
              </label>
              <input ref={fileInputRef} id="excel-upload" type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
            </div>
          </div>
        </div>
      </header>

      {/* ===== UPLOAD PROGRESS ===== */}
      {uploading && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50 px-4 sm:px-6 py-3">
          <div className="max-w-[2000px] mx-auto flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Processing... {uploadProgress}%</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{uploadedRows.toLocaleString()} / {uploadTotal.toLocaleString()} rows</span>
              </div>
              <Progress value={uploadProgress} className="h-1.5 bg-emerald-100 dark:bg-emerald-900/50" />
            </div>
          </div>
        </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 max-w-[2000px] mx-auto w-full px-4 sm:px-6 py-4">
        {!hasData ? (
          /* ===== EMPTY STATE ===== */
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-900/50">
                <FileSpreadsheet className="w-12 h-12 text-emerald-300 dark:text-emerald-700" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
                <Upload className="w-4 h-4 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 mb-2">Belum Ada Data</h2>
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-6 text-center max-w-sm leading-relaxed">Upload file Excel untuk mulai tracking lead dan monitoring performa sales team.</p>
            <label htmlFor="excel-upload">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-xl px-8 rounded-xl h-11 text-sm font-bold" disabled={uploading} asChild>
                <span className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />Upload Excel File</span>
              </Button>
            </label>
          </div>
        ) : (
          <>
            {/* ===== STATS CARDS ===== */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <Card className="border border-gray-200/60 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">Total Leads</p>
                      <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{processed.overallTotal.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-gray-200/60 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">Closing</p>
                      <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{processed.overallCompleted.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-gray-200/60 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">Total CS</p>
                      <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{processed.csData.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-gray-200/60 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getRateColor(processed.overallClosingRate).bg}`}>
                      <Target className={`w-5 h-5 ${getRateColor(processed.overallClosingRate).text}`} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">Closing Rate</p>
                      <p className={`text-xl font-extrabold tabular-nums leading-tight ${getRateColor(processed.overallClosingRate).text}`}>{processed.overallClosingRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ===== LEGEND + HINTS ===== */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                <span className="flex items-center gap-1"><ArrowUpDown className="w-3 h-3" />Drag CS untuk reorder</span>
                <span className="flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" />Drag header produk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mr-1">Closing Rate:</span>
                <Badge className="text-[9px] px-2 py-0 h-5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40">&ge;50%</Badge>
                <Badge className="text-[9px] px-2 py-0 h-5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 font-bold hover:bg-amber-50 dark:hover:bg-amber-950/40">25-49%</Badge>
                <Badge className="text-[9px] px-2 py-0 h-5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 font-bold hover:bg-red-50 dark:hover:bg-red-950/40">&lt;25%</Badge>
              </div>
            </div>

            {/* ===== TABS ===== */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-1 h-10 shadow-sm">
                <TabsTrigger value="lead" className="text-[11px] px-4 h-8 rounded-lg data-[state=active]:bg-slate-800 dark:data-[state=active]:bg-gray-100 data-[state=active]:text-white dark:data-[state=active]:text-gray-900 data-[state=active]:shadow-md gap-1.5 font-semibold transition-all">
                  <Table2 className="w-3.5 h-3.5" />Lead
                </TabsTrigger>
                <TabsTrigger value="closing" className="text-[11px] px-4 h-8 rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md gap-1.5 font-semibold transition-all">
                  <TrendingUp className="w-3.5 h-3.5" />Closing
                </TabsTrigger>
                <TabsTrigger value="rate-product" className="text-[11px] px-4 h-8 rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md gap-1.5 font-semibold transition-all">
                  <Package className="w-3.5 h-3.5" />CL Rate Produk
                </TabsTrigger>
                <TabsTrigger value="rate-cs" className="text-[11px] px-4 h-8 rounded-lg data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md gap-1.5 font-semibold transition-all">
                  <UserCheck className="w-3.5 h-3.5" />CL Rate CS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lead" className="mt-3">
                <DashboardGrid processed={processed} mode="lead" />
              </TabsContent>
              <TabsContent value="closing" className="mt-3">
                <DashboardGrid processed={processed} mode="closing" />
              </TabsContent>
              <TabsContent value="rate-product" className="mt-3">
                <ClosingRateProductTab processed={processed} />
              </TabsContent>
              <TabsContent value="rate-cs" className="mt-3">
                <ClosingRateCSTab processed={processed} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 mt-auto">
        <div className="max-w-[2000px] mx-auto px-4 sm:px-6 py-3">
          <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center font-medium">Lead Dashboard &copy; {new Date().getFullYear()} — Drag to reorder CS &amp; Products</p>
        </div>
      </footer>
    </div>
  );
}
