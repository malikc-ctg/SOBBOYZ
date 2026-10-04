'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  Boxes,
  DollarSign,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  ShoppingCart,
  Wrench,
  Copy,
  Check,
  User,
  Users,
  ExternalLink,
  Edit3,
  Info,
  Sparkles,
  ClipboardCheck,
  ArrowRight,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================
export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category?: string;
  unit: string;
  reorder_threshold: number;
  cost_per_unit: number | null;
  supplier_url?: string | null;
  home_depot_sku?: string | null;
  amazon_asin?: string | null;
  preferred_store?: string | null;
  dilution_ratio?: string | null;
}

export interface InventoryRow {
  id: string;
  item_id: string;
  zone_id: string | null;
  quantity_on_hand: number;
  is_low_stock: boolean;
  last_restocked_at: string | null;
  last_updated: string | null;
  item: InventoryItem;
  zone: { id?: string; name: string } | null;
}

export interface Employee {
  id: string;
  full_name: string;
  phone?: string;
  status?: string;
}

export interface ActiveCaddy {
  id: string;
  crewType: 'solo' | 'duo';
  cleanerName: string;
  partnerName?: string;
  label: string;
  dispatchedAt: string;
  notes?: string;
}

export interface StandardCaddyItem {
  name: string;
  category: 'chemical' | 'cleanser' | 'cloth' | 'ppe' | 'tool' | 'equipment';
  quantity: string;
  role: string;
}

// ============================================================================
// The Standard Sea of Blue Caddy (Serves 1–2 People Full Service)
// ============================================================================
const STANDARD_CADDY_ITEMS: StandardCaddyItem[] = [
  // Chemicals & Cleansers
  {
    name: 'APC (All Purpose Cleaner)',
    quantity: '2 Bottles (32oz)',
    category: 'chemical',
    role: 'Countertops, tabletops, appliances, high-touch disinfection (2 bottles for 1–2 cleaners)',
  },
  {
    name: 'Degreaser',
    quantity: '1 Bottle (32oz)',
    category: 'chemical',
    role: 'Stovetops, range hoods, baked grease, backsplashes, heavy kitchen build-up',
  },
  {
    name: 'Floor Cleaner',
    quantity: '1 Bottle',
    category: 'chemical',
    role: 'Neutral pH solution for hardwood, tile, and laminate floor care',
  },
  {
    name: 'Stainless Steel Cleaner',
    quantity: '1 Bottle / Can',
    category: 'chemical',
    role: 'Refrigerators, ovens, dishwashers, range hoods streak-free shine',
  },
  {
    name: 'STT (Shower Tub Tile Cleaner)',
    quantity: '1 Bottle (32oz)',
    category: 'chemical',
    role: 'Soap scum, limescale, bathroom tile walls, tubs, glass showers',
  },
  {
    name: 'Bar Keepers Friend',
    quantity: '1 Can / Bottle',
    category: 'cleanser',
    role: 'Stainless sinks, stubborn burnt pots, glass cooktops, porcelain tubs',
  },
  // Cloths, Tools & Floor Care
  {
    name: 'Microfiber Cloths',
    quantity: '1 Bundle (15–20 Cloths)',
    category: 'cloth',
    role: 'Color-coded: Blue (Glass/Mirrors), Yellow (Dust/General), Red (Bathrooms)',
  },
  {
    name: 'Nitrile Gloves',
    quantity: '1 Box / Pouch',
    category: 'ppe',
    role: 'Tear-resistant nitrile skin & bio protection for 1–2 cleaners',
  },
  {
    name: 'Mop & Mop Bucket',
    quantity: '1 Bucket + 1 Flat Mop',
    category: 'tool',
    role: 'Floor washing with wringer bucket and clean microfiber mop pads',
  },
  {
    name: 'Extendable Duster',
    quantity: '1 Duster',
    category: 'tool',
    role: 'Ceiling fans, high crown moulding, window blinds, corners',
  },
  {
    name: 'Broom & Dustpan',
    quantity: '1 Set',
    category: 'tool',
    role: 'Dry floor sweeping & quick debris collection before mopping',
  },
  {
    name: 'RIDGID Wet/Dry Shop Vac',
    quantity: '1 Unit',
    category: 'equipment',
    role: 'Heavy-duty HEPA vacuuming on floors, rugs, baseboards and construction dust',
  },
  {
    name: 'Contractor Trash Bags (55 Gal)',
    quantity: 'Roll (5–10 Bags)',
    category: 'ppe',
    role: 'Waste removal, debris haul-out, and heavy bin relining',
  },
];

export default function SupplyPage() {
  // Main Data States
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Main Navigation
  const [activeTab, setActiveTab] = useState<'caddy_standard' | 'supply_list' | 'store_run'>('caddy_standard');

  // Active Dispatched Caddies in Field (persisted in localStorage)
  const [activeCaddies, setActiveCaddies] = useState<ActiveCaddy[]>([]);

  // Dispatch Caddy Dialog State
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [crewType, setCrewType] = useState<'solo' | 'duo'>('solo');
  const [selectedCleaner1, setSelectedCleaner1] = useState('');
  const [selectedCleaner2, setSelectedCleaner2] = useState('');
  const [caddyLabel, setCaddyLabel] = useState('Caddy #1');
  const [caddyNotes, setCaddyNotes] = useState('');

  // Search & Filtering for Supply List
  const [search, setSearch] = useState('');
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState<'all' | 'chemical' | 'cloth' | 'ppe' | 'tool'>('all');

  // Inline Count Editing State
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [inlineQtyValue, setInlineQtyValue] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Add Item Dialog
  const [addOpen, setAddOpen] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'chemical',
    unit: 'bottles',
    initial_quantity: '4',
    reorder_threshold: '1',
    cost_per_unit: '12.00',
    preferred_store: 'Home Depot',
    home_depot_sku: '',
    amazon_asin: '',
  });

  // Restock Dialog
  const [restockOpen, setRestockOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<InventoryRow | null>(null);
  const [restockQty, setRestockQty] = useState<number>(4);
  const [restocking, setRestocking] = useState(false);

  // Copy Feedback
  const [copiedStore, setCopiedStore] = useState<'hd' | 'amz' | null>(null);

  // Load Saved Caddies from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sob_active_caddies_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setActiveCaddies(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const saveActiveCaddies = (updated: ActiveCaddy[]) => {
    setActiveCaddies(updated);
    try {
      localStorage.setItem('sob_active_caddies_v2', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Load Inventory & Active Cleaners
  async function loadAllData(isManual = false) {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [invRes, empRes] = await Promise.all([
        fetch('/api/supply/inventory'),
        fetch('/api/employees'),
      ]);

      const invData = await invRes.json();
      const empData = await empRes.json();

      setInventory(Array.isArray(invData) ? invData : []);
      if (Array.isArray(empData)) {
        setEmployees(empData.filter((e) => e.status !== 'deleted'));
      }
    } catch (err) {
      console.error('Failed to load supply data:', err);
      toast.error('Failed to load supply data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  // Quick Delta Adjustment (+1 / -1)
  async function handleQuickAdjust(row: InventoryRow, delta: number) {
    const newQty = Math.max(0, row.quantity_on_hand + delta);
    setUpdatingId(row.id);

    const category = (row.item?.category || '').toLowerCase();
    const isDurable = category === 'tool' || category === 'equipment';
    const threshold = row.item?.reorder_threshold ?? 1;

    setInventory((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              quantity_on_hand: newQty,
              is_low_stock: !isDurable && newQty <= threshold,
            }
          : r
      )
    );

    try {
      const res = await fetch(`/api/supply/inventory/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setInventory((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } catch {
      toast.error('Failed to update stock quantity');
      loadAllData(true);
    } finally {
      setUpdatingId(null);
    }
  }

  // Set Exact Quantity (Direct Physical Count Audit)
  async function handleSetExactQuantity(row: InventoryRow, exactQty: number) {
    const newQty = Math.max(0, exactQty);
    if (newQty === row.quantity_on_hand) return;

    setUpdatingId(row.id);
    const category = (row.item?.category || '').toLowerCase();
    const isDurable = category === 'tool' || category === 'equipment';
    const threshold = row.item?.reorder_threshold ?? 1;

    setInventory((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              quantity_on_hand: newQty,
              is_low_stock: !isDurable && newQty <= threshold,
            }
          : r
      )
    );

    try {
      const res = await fetch(`/api/supply/inventory/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity_on_hand: newQty }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setInventory((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      toast.success(`Updated ${row.item?.name} to ${newQty} in stock`);
    } catch {
      toast.error('Failed to save stock quantity');
      loadAllData(true);
    } finally {
      setUpdatingId(null);
    }
  }

  // Filtered Inventory List for Central Stash
  const filteredInventory = useMemo(() => {
    const q = search.toLowerCase().trim();
    return inventory.filter((row) => {
      const item = row.item || {};
      const cat = (item.category || 'consumable').toLowerCase();
      const name = (item.name || '').toLowerCase();

      const matchSearch =
        !q ||
        name.includes(q) ||
        item.home_depot_sku?.toLowerCase().includes(q) ||
        item.amazon_asin?.toLowerCase().includes(q);

      const matchCategory =
        supplyCategoryFilter === 'all'
          ? true
          : supplyCategoryFilter === 'chemical'
          ? cat === 'chemical' || name.includes('cleaner') || name.includes('degreaser') || name.includes('disinfectant') || name.includes('barkeeper') || name.includes('polish')
          : supplyCategoryFilter === 'cloth'
          ? (cat === 'consumable' && (name.includes('cloth') || name.includes('towel') || name.includes('sponge') || name.includes('scrub')))
          : supplyCategoryFilter === 'ppe'
          ? (cat === 'ppe' || name.includes('glove') || name.includes('bag') || name.includes('mask'))
          : cat === 'tool' || cat === 'equipment' || name.includes('mop') || name.includes('bucket') || name.includes('duster') || name.includes('broom') || name.includes('vac');

      return matchSearch && matchCategory;
    });
  }, [inventory, search, supplyCategoryFilter]);

  // Low Stock Items (Consumables only)
  const lowStockItems = useMemo(() => {
    return inventory.filter((r) => {
      const cat = (r.item?.category || '').toLowerCase();
      const isDurable = cat === 'tool' || cat === 'equipment';
      return !isDurable && r.is_low_stock;
    });
  }, [inventory]);

  // Home Depot vs Amazon low lists
  const homeDepotLowList = useMemo(() => {
    return lowStockItems.filter(
      (r) =>
        r.item?.home_depot_sku ||
        r.item?.preferred_store === 'Home Depot' ||
        (!r.item?.amazon_asin && r.item?.preferred_store !== 'Amazon')
    );
  }, [lowStockItems]);

  const amazonLowList = useMemo(() => {
    return lowStockItems.filter(
      (r) => r.item?.amazon_asin || r.item?.preferred_store === 'Amazon'
    );
  }, [lowStockItems]);

  // Quick Restock Modal Confirm
  async function handleConfirmRestock() {
    if (!selectedRow || restockQty <= 0) return;
    setRestocking(true);
    try {
      const res = await fetch('/api/supply/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: selectedRow.item_id,
          zone_id: selectedRow.zone_id,
          quantity_ordered: restockQty,
          auto_receive: true,
        }),
      });
      if (!res.ok) throw new Error('Restock failed');
      toast.success(`Restocked +${restockQty} ${selectedRow.item.unit} of ${selectedRow.item.name}!`);
      setRestockOpen(false);
      await loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restock');
    } finally {
      setRestocking(false);
    }
  }

  // Handle Add Item
  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    setSubmittingItem(true);
    try {
      const res = await fetch('/api/supply/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create item');
      }
      const createdRow = await res.json();
      setInventory((prev) => [createdRow, ...prev]);
      toast.success(`${newItem.name} added to supply list!`);
      setAddOpen(false);
      setNewItem({
        name: '',
        category: 'chemical',
        unit: 'bottles',
        initial_quantity: '4',
        reorder_threshold: '1',
        cost_per_unit: '12.00',
        preferred_store: 'Home Depot',
        home_depot_sku: '',
        amazon_asin: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create item');
    } finally {
      setSubmittingItem(false);
    }
  }

  // Handle Dispatch Caddy
  function handleDispatchCaddy(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCleaner1) {
      toast.error('Please select a cleaner');
      return;
    }
    if (crewType === 'duo' && !selectedCleaner2) {
      toast.error('Please select partner cleaner for the duo team');
      return;
    }

    const cleaner1 = employees.find((emp) => emp.id === selectedCleaner1);
    const cleaner2 = employees.find((emp) => emp.id === selectedCleaner2);

    const newCaddy: ActiveCaddy = {
      id: `caddy-${Date.now()}`,
      crewType,
      cleanerName: cleaner1?.full_name || 'Cleaner',
      partnerName: crewType === 'duo' ? cleaner2?.full_name : undefined,
      label: caddyLabel.trim() || 'Standard Caddy',
      dispatchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      notes: caddyNotes.trim() || undefined,
    };

    saveActiveCaddies([newCaddy, ...activeCaddies]);
    toast.success(
      `${caddyLabel} dispatched with ${cleaner1?.full_name}${cleaner2 ? ` & ${cleaner2.full_name}` : ''}!`
    );
    setDispatchOpen(false);
    setSelectedCleaner1('');
    setSelectedCleaner2('');
    setCaddyNotes('');
  }

  // Handle Return Caddy
  function handleReturnCaddy(id: string) {
    const target = activeCaddies.find((c) => c.id === id);
    saveActiveCaddies(activeCaddies.filter((c) => c.id !== id));
    toast.success(`${target?.label || 'Caddy'} marked returned & ready to restock!`);
  }

  // Copy Store Lists
  function copyStoreList(store: 'hd' | 'amz') {
    const list = store === 'hd' ? homeDepotLowList : amazonLowList;
    const storeTitle = store === 'hd' ? 'HOME DEPOT SUPPLY RUN' : 'AMAZON SUPPLY RESTOCK';

    if (list.length === 0) {
      toast.info(`No items currently low for ${store === 'hd' ? 'Home Depot' : 'Amazon'}!`);
      return;
    }

    const text = [
      `=== ${storeTitle} ===`,
      `Date: ${new Date().toLocaleDateString()} | Sea of Blue Ops`,
      '',
      ...list.map((r) => {
        const item = r.item;
        const code = store === 'hd' ? item.home_depot_sku : item.amazon_asin;
        return `[ ] 2x ${item.name} (${item.unit})${code ? ` — Code: ${code}` : ''} [Have: ${r.quantity_on_hand}]`;
      }),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedStore(store);
    toast.success(`${store === 'hd' ? 'Home Depot' : 'Amazon'} list copied to clipboard!`);
    setTimeout(() => setCopiedStore(null), 2500);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Package className="h-6 w-6 text-primary" />
            Supply & Caddy Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Standard 1–2 person cleaning caddies, active field dispatches, and central refill stash.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAllData(true)}
            disabled={refreshing}
            className="h-9 text-xs"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setCaddyLabel(`Caddy #${activeCaddies.length + 1}`);
              setDispatchOpen(true);
            }}
            className="h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <ClipboardCheck className="h-4 w-4 mr-1.5" />
            Dispatch Caddy to Job
          </Button>
        </div>
      </div>

      {/* Main Operational Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <div className="bg-muted/40 p-1 rounded-xl border">
          <TabsList className="grid grid-cols-3 h-auto gap-1 bg-transparent p-0">
            <TabsTrigger
              value="caddy_standard"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs py-2.5 font-semibold"
            >
              <Boxes className="h-4 w-4 mr-2 text-primary" />
              The Standard Caddy
              {activeCaddies.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                  {activeCaddies.length} Out
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="supply_list"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs py-2.5 font-semibold"
            >
              <Boxes className="h-4 w-4 mr-2 text-blue-600" />
              Central Refill Stash
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground font-mono">
                {inventory.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="store_run"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs py-2.5 font-semibold"
            >
              <ShoppingCart className="h-4 w-4 mr-2 text-indigo-600" />
              Store Restock Run
              {lowStockItems.length > 0 ? (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-700 font-bold">
                  {lowStockItems.length} Low
                </span>
              ) : (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-700 font-semibold">
                  Stocked
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: THE STANDARD CADDY (1 CADDY SERVES 1-2 CLEANERS)                   */}
        {/* ========================================================================= */}
        <TabsContent value="caddy_standard" className="space-y-6 m-0">
          {/* Active Dispatched Caddies in Field */}
          {activeCaddies.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/20 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-950">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      Active Caddies Out on Jobs ({activeCaddies.length})
                    </CardTitle>
                    <CardDescription className="text-xs text-blue-800/80">
                      Currently dispatched with your cleaning crew in the field
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activeCaddies.map((caddy) => (
                    <div
                      key={caddy.id}
                      className="p-3.5 rounded-xl border bg-background shadow-xs space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            caddy.crewType === 'solo'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}
                        >
                          {caddy.crewType === 'solo' ? 'Solo (1 Person)' : 'Duo Team (2 People)'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Out at {caddy.dispatchedAt}
                        </span>
                      </div>

                      <div>
                        <p className="font-bold text-sm text-foreground">{caddy.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {caddy.crewType === 'solo' ? (
                            <span>Cleaner: <strong>{caddy.cleanerName}</strong></span>
                          ) : (
                            <span>Crew: <strong>{caddy.cleanerName}</strong> & <strong>{caddy.partnerName}</strong></span>
                          )}
                        </p>
                        {caddy.notes && (
                          <p className="text-[11px] text-muted-foreground italic mt-1 line-clamp-1">
                            &quot;{caddy.notes}&quot;
                          </p>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReturnCaddy(caddy.id)}
                        className="w-full h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-semibold"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Mark Returned & Restocked
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Standard Caddy Specification & Packing Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-foreground">
                      The Standard Sea of Blue Cleaning Caddy
                    </CardTitle>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                      Full Service for 1–2 People
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    Every caddy carries the exact same standardized equipment and chemical loadout. 1 caddy fully equips 1 solo cleaner or a 2-person duo team.
                  </CardDescription>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setCaddyLabel(`Caddy #${activeCaddies.length + 1}`);
                    setDispatchOpen(true);
                  }}
                  className="h-8 text-xs font-semibold shrink-0"
                >
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                  Dispatch Caddy
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Highlight Banner */}
              <div className="p-4 bg-muted/30 border-b text-xs flex items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Package className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <span className="font-bold text-foreground">1 Standard Caddy = Complete Service: </span>
                    <span className="text-muted-foreground">
                      2x APC bottles (so both people have plenty), Degreaser, Floor cleaner, Stainless steel, STT descaler, Bar Keepers Friend, plus cloths, gloves, mop & bucket, duster, broom, and vacuum.
                    </span>
                  </div>
                </div>
              </div>

              {/* Standard Caddy Checklist Table */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 text-xs">
                    <TableHead className="w-[300px]">Caddy Item</TableHead>
                    <TableHead className="w-[180px]">Quantity Packed</TableHead>
                    <TableHead>Service Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {STANDARD_CADDY_ITEMS.map((item, idx) => (
                    <TableRow key={idx} className="text-xs hover:bg-muted/10">
                      <TableCell>
                        <div>
                          <p className="font-bold text-foreground text-sm leading-tight">
                            {item.name}
                          </p>
                          <Badge variant="outline" className="text-[10px] capitalize mt-0.5">
                            {item.category === 'chemical'
                              ? 'Spray Bottle'
                              : item.category === 'cleanser'
                              ? 'Specialty Cleanser'
                              : item.category === 'cloth'
                              ? 'Cloths & Towels'
                              : item.category === 'ppe'
                              ? 'PPE & Waste'
                              : item.category === 'tool'
                              ? 'Cleaning Tool'
                              : 'Machinery'}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-bold px-2.5 py-1 rounded-md text-xs inline-block bg-primary/10 text-primary">
                          {item.quantity}
                        </span>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-xs">
                        {item.role}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: CENTRAL REFILL STASH (THE SUPPLY LIST)                             */}
        {/* ========================================================================= */}
        <TabsContent value="supply_list" className="space-y-4 m-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Boxes className="h-4 w-4 text-primary" />
                Central Refill Stash (Our Supply List)
              </h3>
              <p className="text-xs text-muted-foreground">
                The bulk jugs, towel bundles, boxes, and machines on your shelves used to restock the caddies.
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="h-8 text-xs font-semibold self-start sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Item to Supply List
            </Button>
          </div>

          {/* Category Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {(
                [
                  { id: 'all', label: 'All Supplies' },
                  { id: 'chemical', label: 'Chemicals & Cleansers' },
                  { id: 'cloth', label: 'Cloths & Towels' },
                  { id: 'ppe', label: 'Gloves & Trash Bags' },
                  { id: 'tool', label: 'Mops, Vacuums & Tools' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSupplyCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    supplyCategoryFilter === cat.id
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search supplies or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* Main Supply Stash Table */}
          <Card className="shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 text-xs">
                  <TableHead className="w-[340px]">Supply Item & Store Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center w-[160px]">Shelf Count</TableHead>
                  <TableHead className="text-center w-[100px]">Alert Level</TableHead>
                  <TableHead className="text-center w-[110px]">Status</TableHead>
                  <TableHead>Store Link</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-primary" />
                      Loading supplies...
                    </TableCell>
                  </TableRow>
                ) : filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                      No supplies found matching this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory.map((row) => {
                    const isEditing = editingQtyId === row.id;
                    const cat = (row.item?.category || '').toLowerCase();
                    const isDurable = cat === 'tool' || cat === 'equipment';

                    return (
                      <TableRow key={row.id} className="text-xs hover:bg-muted/20">
                        {/* Item Name */}
                        <TableCell>
                          <div>
                            <p className="font-semibold text-foreground text-sm leading-tight">
                              {row.item?.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-muted-foreground">
                              {row.item?.home_depot_sku && (
                                <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">
                                  HD #{row.item.home_depot_sku}
                                </span>
                              )}
                              {row.item?.amazon_asin && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                  ASIN: {row.item.amazon_asin}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Category */}
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {row.item?.category || 'consumable'}
                          </Badge>
                        </TableCell>

                        {/* Shelf Count (Stepper + Click-to-type) */}
                        <TableCell className="text-center">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                autoFocus
                                value={inlineQtyValue}
                                onChange={(e) => setInlineQtyValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSetExactQuantity(row, parseInt(inlineQtyValue, 10) || 0);
                                    setEditingQtyId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingQtyId(null);
                                  }
                                }}
                                onBlur={() => {
                                  handleSetExactQuantity(row, parseInt(inlineQtyValue, 10) || 0);
                                  setEditingQtyId(null);
                                }}
                                className="w-16 h-7 text-center text-xs font-bold border-primary shadow-xs"
                              />
                            </div>
                          ) : (
                            <div className="inline-flex items-center border rounded-lg overflow-hidden bg-background shadow-xs">
                              <button
                                onClick={() => handleQuickAdjust(row, -1)}
                                disabled={updatingId === row.id || row.quantity_on_hand <= 0}
                                className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingQtyId(row.id);
                                  setInlineQtyValue(row.quantity_on_hand.toString());
                                }}
                                className={`px-2.5 py-1 text-xs font-bold min-w-[2.5rem] text-center hover:bg-muted/60 transition-colors cursor-pointer group flex items-center justify-center gap-1 ${
                                  row.is_low_stock ? 'text-amber-700 bg-amber-50/50' : 'text-foreground'
                                }`}
                                title="Click to type exact count"
                              >
                                <span>{row.quantity_on_hand}</span>
                                <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-70 text-muted-foreground" />
                              </button>
                              <button
                                onClick={() => handleQuickAdjust(row, +1)}
                                disabled={updatingId === row.id}
                                className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {row.item?.unit || 'units'}
                          </div>
                        </TableCell>

                        {/* Alert Level */}
                        <TableCell className="text-center text-xs font-mono text-muted-foreground">
                          {isDurable ? '—' : row.item?.reorder_threshold ?? 1}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          {isDurable ? (
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[10px]">
                              Durable Tool
                            </Badge>
                          ) : row.is_low_stock ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold hover:bg-amber-100">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Low
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Stocked
                            </Badge>
                          )}
                        </TableCell>

                        {/* Store Link */}
                        <TableCell>
                          {row.item?.home_depot_sku ? (
                            <a
                              href={`https://www.homedepot.ca/en/home/search.html?q=${encodeURIComponent(row.item.home_depot_sku)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium hover:underline text-[11px]"
                            >
                              Home Depot <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : row.item?.amazon_asin ? (
                            <a
                              href={`https://www.amazon.ca/dp/${row.item.amazon_asin}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium hover:underline text-[11px]"
                            >
                              Amazon <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">
                              {row.item?.preferred_store || 'Standard'}
                            </span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => {
                              setSelectedRow(row);
                              setRestockQty(4);
                              setRestockOpen(true);
                            }}
                          >
                            + Refill
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: STORE RESTOCK RUN (HOME DEPOT & AMAZON)                            */}
        {/* ========================================================================= */}
        <TabsContent value="store_run" className="space-y-6 m-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-gradient-to-r from-blue-50/60 to-indigo-50/60">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Store Restock Run (Refill Needs)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supplies running low in your central stash. Copy the checklist to text whoever is heading to the store.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyStoreList('hd')}
                disabled={homeDepotLowList.length === 0}
                className="h-8 text-xs border-orange-300 text-orange-800 hover:bg-orange-50 font-semibold"
              >
                {copiedStore === 'hd' ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1 text-orange-600" /> Copy Home Depot Run
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => copyStoreList('amz')}
                disabled={amazonLowList.length === 0}
                className="h-8 text-xs border-blue-300 text-blue-800 hover:bg-blue-50 font-semibold"
              >
                {copiedStore === 'amz' ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1 text-blue-600" /> Copy Amazon Order
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* The Home Depot Card */}
            <Card className="shadow-sm border-orange-200">
              <CardHeader className="bg-orange-50/40 border-b border-orange-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-500 text-white font-black text-xs flex items-center justify-center">
                      HD
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground">
                        The Home Depot
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Chemical concentrates, spray bottles & contractor bags
                      </CardDescription>
                    </div>
                  </div>

                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 text-xs">
                    {homeDepotLowList.length} items low
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {homeDepotLowList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-foreground">Home Depot supplies are well-stocked!</p>
                    <p className="mt-0.5">No immediate store run needed.</p>
                  </div>
                ) : (
                  homeDepotLowList.map((row) => (
                    <div
                      key={row.id}
                      className="p-3 rounded-lg border bg-card flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-foreground text-sm leading-tight">
                          {row.item?.name}
                        </p>
                        {row.item?.home_depot_sku && (
                          <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                            Home Depot SKU: {row.item.home_depot_sku}
                          </p>
                        )}
                        <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                          Only {row.quantity_on_hand} {row.item?.unit} left on shelf
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {row.item?.home_depot_sku && (
                          <a
                            href={`https://www.homedepot.ca/en/home/search.html?q=${encodeURIComponent(row.item.home_depot_sku)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 hover:underline text-[11px] font-semibold"
                          >
                            Open on HD <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Amazon Card */}
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="bg-blue-50/40 border-b border-blue-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center">
                      a
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground">
                        Amazon Restock
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Bulk microfiber packs, nitrile gloves & PPE
                      </CardDescription>
                    </div>
                  </div>

                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                    {amazonLowList.length} items low
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {amazonLowList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-foreground">Amazon supplies are well-stocked!</p>
                    <p className="mt-0.5">No immediate reorder needed.</p>
                  </div>
                ) : (
                  amazonLowList.map((row) => (
                    <div
                      key={row.id}
                      className="p-3 rounded-lg border bg-card flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-foreground text-sm leading-tight">
                          {row.item?.name}
                        </p>
                        {row.item?.amazon_asin && (
                          <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                            ASIN: {row.item.amazon_asin}
                          </p>
                        )}
                        <p className="text-[11px] text-blue-700 mt-0.5 font-medium">
                          Only {row.quantity_on_hand} {row.item?.unit} left on shelf
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {row.item?.amazon_asin && (
                          <a
                            href={`https://www.amazon.ca/dp/${row.item.amazon_asin}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline text-[11px] font-semibold"
                          >
                            Open on Amazon <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* DIALOG: DISPATCH STANDARD CADDY TO JOB                                    */}
      {/* ========================================================================= */}
      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch Caddy to Job</DialogTitle>
            <DialogDescription className="text-xs">
              Every caddy has the same standardized loadout to perform a full service for 1 person or a duo team.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDispatchCaddy} className="space-y-4 pt-2 text-xs">
            {/* Crew size selection */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg border">
              <button
                type="button"
                onClick={() => setCrewType('solo')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  crewType === 'solo'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                Solo Cleaner (1 Person)
              </button>
              <button
                type="button"
                onClick={() => setCrewType('duo')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  crewType === 'duo'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Duo Team (2 People)
              </button>
            </div>

            <div>
              <Label htmlFor="cleaner-1">
                {crewType === 'solo' ? 'Assigned Cleaner *' : 'Cleaner 1 (Lead) *'}
              </Label>
              <Select value={selectedCleaner1} onValueChange={setSelectedCleaner1}>
                <SelectTrigger id="cleaner-1" className="mt-1 text-xs">
                  <SelectValue placeholder="Select cleaner..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {crewType === 'duo' && (
              <div>
                <Label htmlFor="cleaner-2">Cleaner 2 (Partner) *</Label>
                <Select value={selectedCleaner2} onValueChange={setSelectedCleaner2}>
                  <SelectTrigger id="cleaner-2" className="mt-1 text-xs">
                    <SelectValue placeholder="Select partner cleaner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((emp) => emp.id !== selectedCleaner1)
                      .map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="caddy-label">Caddy Tag / ID</Label>
              <Input
                id="caddy-label"
                value={caddyLabel}
                onChange={(e) => setCaddyLabel(e.target.value)}
                placeholder="e.g. Caddy #1, Caddy #2, Van Blue"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="caddy-notes">Job Notes (Optional)</Label>
              <Input
                id="caddy-notes"
                value={caddyNotes}
                onChange={(e) => setCaddyNotes(e.target.value)}
                placeholder="e.g. Move-out clean, 3 bedrooms"
                className="mt-1 text-xs"
              />
            </div>

            {/* Standardized Checklist Summary */}
            <div className="p-3 rounded-lg bg-muted/40 border space-y-1.5 text-[11px] text-muted-foreground">
              <p className="font-semibold text-foreground">Included in this Caddy:</p>
              <p className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" /> 2x APC, 1x Degreaser, 1x Floor Cleaner, 1x Stainless Steel, 1x STT</p>
              <p className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" /> 1x Bar Keepers Friend cleanser</p>
              <p className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" /> Microfiber cloths bundle, Nitrile gloves & Contractor bags</p>
              <p className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" /> Mop & bucket, Duster, Broom & dustpan, RIDGID Shop Vac</p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDispatchOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-semibold">
                Confirm & Dispatch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG: QUICK REFILL / RESTOCK                                            */}
      {/* ========================================================================= */}
      <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Shelf Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-xs">
            <div className="rounded-lg bg-muted p-3">
              <p className="font-semibold text-sm">{selectedRow?.item?.name}</p>
              <div className="flex items-center justify-between text-muted-foreground mt-1">
                <span>Current on hand: {selectedRow?.quantity_on_hand} {selectedRow?.item?.unit}</span>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Quick Presets</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {[2, 4, 8, 12].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={restockQty === preset ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={() => setRestockQty(preset)}
                  >
                    +{preset}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="custom-qty">Custom Units to Add</Label>
              <Input
                id="custom-qty"
                type="number"
                min="1"
                value={restockQty}
                onChange={(e) => setRestockQty(parseInt(e.target.value, 10) || 0)}
                className="mt-1"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRestockOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmRestock}
                disabled={restocking || restockQty <= 0}
                className="text-xs font-semibold"
              >
                {restocking ? 'Adding...' : `Add +${restockQty} Units`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG: ADD NEW ITEM TO SUPPLY LIST                                       */}
      {/* ========================================================================= */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Item to Supply List</DialogTitle>
            <DialogDescription className="text-xs">
              Add a cleaning chemical, microfiber pack, or equipment to your stash.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateItem} className="space-y-3.5 pt-2 text-xs">
            <div>
              <Label htmlFor="item-name">Item Name *</Label>
              <Input
                id="item-name"
                placeholder="e.g. Heavy-Duty Citrus Degreaser"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                required
                className="mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="item-category">Category</Label>
                <Select
                  value={newItem.category}
                  onValueChange={(val) => setNewItem({ ...newItem, category: val })}
                >
                  <SelectTrigger id="item-category" className="mt-1 text-xs capitalize">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chemical">Chemicals & Cleaners</SelectItem>
                    <SelectItem value="consumable">Microfiber & Towels</SelectItem>
                    <SelectItem value="ppe">Gloves & Trash Bags</SelectItem>
                    <SelectItem value="tool">Tools & Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="item-unit">Unit</Label>
                <Input
                  id="item-unit"
                  placeholder="e.g. bottles, packs, boxes"
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="hd-sku">Home Depot SKU (Optional)</Label>
                <Input
                  id="hd-sku"
                  placeholder="e.g. 1001-554-921"
                  value={newItem.home_depot_sku}
                  onChange={(e) => setNewItem({ ...newItem, home_depot_sku: e.target.value })}
                  className="mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <Label htmlFor="amz-asin">Amazon ASIN (Optional)</Label>
                <Input
                  id="amz-asin"
                  placeholder="e.g. B08X4W9K2L"
                  value={newItem.amazon_asin}
                  onChange={(e) => setNewItem({ ...newItem, amazon_asin: e.target.value })}
                  className="mt-1 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="initial-stock">Starting Quantity</Label>
                <Input
                  id="initial-stock"
                  type="number"
                  min="0"
                  value={newItem.initial_quantity}
                  onChange={(e) => setNewItem({ ...newItem, initial_quantity: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="min-reorder">Low Alert At (Threshold)</Label>
                <Input
                  id="min-reorder"
                  type="number"
                  min="1"
                  value={newItem.reorder_threshold}
                  onChange={(e) => setNewItem({ ...newItem, reorder_threshold: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={submittingItem} className="text-xs font-semibold">
                {submittingItem ? 'Saving...' : 'Add to Supply List'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
