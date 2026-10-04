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
  type: 'solo' | 'duo';
  cleanerName: string;
  partnerName?: string;
  label: string;
  dispatchedAt: string;
  notes?: string;
}

export interface CaddyBlueprintItem {
  name: string;
  category: 'chemical' | 'cloth' | 'ppe' | 'tool' | 'equipment';
  soloQty: string;
  duoQty: string;
  icon: string;
  purpose: string;
}

// ============================================================================
// Standard Caddy Blueprint (Solo vs Duo)
// ============================================================================
const CADDY_CHECKLIST: CaddyBlueprintItem[] = [
  {
    name: 'All-Purpose Surface Disinfectant',
    category: 'chemical',
    soloQty: '1 Bottle (32oz)',
    duoQty: '2 Bottles (32oz)',
    icon: '🧴',
    purpose: 'Countertops, tabletops, appliances, high-touch areas',
  },
  {
    name: 'Streak-Free Glass & Mirror Polish',
    category: 'chemical',
    soloQty: '1 Bottle (32oz)',
    duoQty: '2 Bottles (32oz)',
    icon: '✨',
    purpose: 'Mirrors, windows, glass shower panels, chrome fixtures',
  },
  {
    name: 'Heavy-Duty Kitchen Degreaser',
    category: 'chemical',
    soloQty: '1 Bottle (32oz)',
    duoQty: '2 Bottles (32oz)',
    icon: '🍳',
    purpose: 'Stovetops, range hoods, baked-on grease, backsplashes',
  },
  {
    name: 'Shower, Tub & Tile Acid Descaler',
    category: 'chemical',
    soloQty: '1 Bottle (32oz)',
    duoQty: '2 Bottles (32oz)',
    icon: '🚿',
    purpose: 'Soap scum, hard water scale, grout lines, tile walls',
  },
  {
    name: 'Color-Coded Microfiber Cloths',
    category: 'cloth',
    soloQty: '12–15 Towels',
    duoQty: '25–30 Towels',
    icon: '🧽',
    purpose: 'Blue (Glass), Yellow (Dusting/General), Red (Bathrooms)',
  },
  {
    name: 'Non-Scratch Sponges & Detail Scrubber',
    category: 'cloth',
    soloQty: '2 Sponges + 1 Brush',
    duoQty: '4 Sponges + 2 Brushes',
    icon: '🪥',
    purpose: 'Grout lines, corners, sink edges, tight crevices',
  },
  {
    name: 'Nitrile Gloves (Powder-Free)',
    category: 'ppe',
    soloQty: '1 Box / Pouch',
    duoQty: '2 Boxes / Pouches',
    icon: '🧤',
    purpose: 'Chemical protection and hygiene safety',
  },
  {
    name: 'Heavy Duty Contractor Trash Bags (55 Gal)',
    category: 'ppe',
    soloQty: 'Roll (3–5 Bags)',
    duoQty: 'Roll (6–10 Bags)',
    icon: '🗑️',
    purpose: 'Waste removal and bin relining',
  },
  {
    name: 'Extendable Microfiber Duster Kit',
    category: 'tool',
    soloQty: '1 Duster',
    duoQty: '2 Dusters',
    icon: '🪶',
    purpose: 'Ceiling fans, high crown moulding, window blinds',
  },
  {
    name: 'Microfiber Flat Flip Mop',
    category: 'tool',
    soloQty: '1 Mop + 2 Pads',
    duoQty: '1–2 Mops + 4 Pads',
    icon: '🧹',
    purpose: 'Hardwood, tile, and laminate floor care',
  },
  {
    name: 'RIDGID Wet/Dry Shop Vacuum (HEPA)',
    category: 'equipment',
    soloQty: '1 Unit',
    duoQty: '1 Unit (Shared)',
    icon: '⚡',
    purpose: 'Full house vacuuming, edge crevice, and debris extraction',
  },
];

export default function SupplyPage() {
  // Main Data States
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Main Navigation: Caddies first!
  const [activeTab, setActiveTab] = useState<'caddies' | 'supply_list' | 'store_run'>('caddies');

  // Caddy Prep Mode
  const [caddyMode, setCaddyMode] = useState<'solo' | 'duo'>('solo');

  // Active Dispatched Caddies (persisted locally)
  const [activeCaddies, setActiveCaddies] = useState<ActiveCaddy[]>([]);

  // Dispatch Caddy Form Modal
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [selectedCleaner1, setSelectedCleaner1] = useState('');
  const [selectedCleaner2, setSelectedCleaner2] = useState('');
  const [caddyLabel, setCaddyLabel] = useState('Caddy #1');
  const [caddyNotes, setCaddyNotes] = useState('');

  // Search & Filtering for Supply List
  const [search, setSearch] = useState('');
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState<'all' | 'chemical' | 'consumable' | 'ppe' | 'tool'>('all');

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
      const saved = localStorage.getItem('sob_active_caddies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setActiveCaddies(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Save Caddies to LocalStorage
  const saveActiveCaddies = (updated: ActiveCaddy[]) => {
    setActiveCaddies(updated);
    try {
      localStorage.setItem('sob_active_caddies', JSON.stringify(updated));
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
        // filter active cleaners
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

  // Filtered Inventory List
  const filteredInventory = useMemo(() => {
    const q = search.toLowerCase().trim();
    return inventory.filter((row) => {
      const item = row.item || {};
      const cat = (item.category || 'consumable').toLowerCase();

      const matchSearch =
        !q ||
        item.name?.toLowerCase().includes(q) ||
        item.home_depot_sku?.toLowerCase().includes(q) ||
        item.amazon_asin?.toLowerCase().includes(q);

      const matchCategory =
        supplyCategoryFilter === 'all'
          ? true
          : supplyCategoryFilter === 'chemical'
          ? cat === 'chemical'
          : supplyCategoryFilter === 'consumable'
          ? cat === 'consumable' && !item.name.toLowerCase().includes('glove') && !item.name.toLowerCase().includes('bag')
          : supplyCategoryFilter === 'ppe'
          ? cat === 'ppe' || item.name.toLowerCase().includes('glove') || item.name.toLowerCase().includes('bag')
          : cat === 'tool' || cat === 'equipment';

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
    if (caddyMode === 'duo' && !selectedCleaner2) {
      toast.error('Please select both cleaners for a duo team');
      return;
    }

    const cleaner1 = employees.find((emp) => emp.id === selectedCleaner1);
    const cleaner2 = employees.find((emp) => emp.id === selectedCleaner2);

    const newCaddy: ActiveCaddy = {
      id: `caddy-${Date.now()}`,
      type: caddyMode,
      cleanerName: cleaner1?.full_name || 'Assigned Cleaner',
      partnerName: caddyMode === 'duo' ? cleaner2?.full_name : undefined,
      label: caddyLabel.trim() || (caddyMode === 'solo' ? 'Solo Caddy' : 'Duo Kit'),
      dispatchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      notes: caddyNotes.trim() || undefined,
    };

    saveActiveCaddies([newCaddy, ...activeCaddies]);
    toast.success(
      `${caddyMode === 'solo' ? 'Solo Caddy' : 'Duo Kit'} dispatched with ${cleaner1?.full_name}${
        cleaner2 ? ` & ${cleaner2.full_name}` : ''
      }!`
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
            Pack standard cleaning caddies for solo cleaners or duos, track active kits, and manage refill stock.
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
            onClick={() => setDispatchOpen(true)}
            className="h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <ClipboardCheck className="h-4 w-4 mr-1.5" />
            Pack & Dispatch Caddy
          </Button>
        </div>
      </div>

      {/* Top 3 High-Clarity Operational Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <div className="bg-muted/40 p-1 rounded-xl border">
          <TabsList className="grid grid-cols-3 h-auto gap-1 bg-transparent p-0">
            <TabsTrigger
              value="caddies"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs py-2.5 font-semibold"
            >
              <Users className="h-4 w-4 mr-2 text-primary" />
              Caddies (Solo & Duo)
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
              Our Supply Stash
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
        {/* TAB 1: CADDIES (SOLO VS DUO OPERATIONS)                                   */}
        {/* ========================================================================= */}
        <TabsContent value="caddies" className="space-y-6 m-0">
          {/* Active Caddies in the Field */}
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
                      Cleaners currently carrying a stocked caddy in the field
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
                            caddy.type === 'solo'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}
                        >
                          {caddy.type === 'solo' ? '👤 1-Person Solo' : '👥 2-Person Duo'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Out since {caddy.dispatchedAt}
                        </span>
                      </div>

                      <div>
                        <p className="font-bold text-sm text-foreground">{caddy.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {caddy.type === 'solo' ? (
                            <span>Cleaner: <strong>{caddy.cleanerName}</strong></span>
                          ) : (
                            <span>Duo: <strong>{caddy.cleanerName}</strong> & <strong>{caddy.partnerName}</strong></span>
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

          {/* Caddy Setup / Blueprint Toggle Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-primary" />
                    Standard Caddy Checklist: Solo vs Duo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Choose 1 Person or Duo below to see the exact items packed into that caddy setup.
                  </CardDescription>
                </div>

                {/* Solo vs Duo Mode Switcher */}
                <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl self-start sm:self-auto border">
                  <button
                    onClick={() => setCaddyMode('solo')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      caddyMode === 'solo'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <User className="h-3.5 w-3.5 text-blue-600" />
                    Solo Caddy (1 Person)
                  </button>

                  <button
                    onClick={() => setCaddyMode('duo')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      caddyMode === 'duo'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5 text-purple-600" />
                    Duo Kit (2 People)
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Highlight Banner */}
              <div
                className={`p-4 border-b text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  caddyMode === 'solo' ? 'bg-blue-50/40 text-blue-900' : 'bg-purple-50/40 text-purple-900'
                }`}
              >
                <div>
                  <p className="font-bold text-sm">
                    {caddyMode === 'solo' ? '👤 1-Person Solo Cleaner Caddy' : '👥 2-Person Duo Team Kit'}
                  </p>
                  <p className="text-xs opacity-90 mt-0.5">
                    {caddyMode === 'solo'
                      ? 'Single primary caddy with the 4 core spray bottles, 12–15 towels, gloves, duster, mop & vacuum.'
                      : 'Dual chemical sets (so both cleaners can work separate rooms without sharing bottles), 25–30 towels, 2x gloves, and shared vacuum/mop.'}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setCaddyLabel(caddyMode === 'solo' ? 'Solo Caddy' : 'Duo Kit');
                    setDispatchOpen(true);
                  }}
                  className={`h-8 text-xs font-semibold shrink-0 ${
                    caddyMode === 'solo' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  Pack This {caddyMode === 'solo' ? 'Solo Caddy' : 'Duo Kit'}
                </Button>
              </div>

              {/* Blueprint Checklist Table */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 text-xs">
                    <TableHead className="w-[340px]">Caddy Item</TableHead>
                    <TableHead className="w-[180px]">Quantity to Pack</TableHead>
                    <TableHead>What It&apos;s Used For</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CADDY_CHECKLIST.map((item, idx) => {
                    const qty = caddyMode === 'solo' ? item.soloQty : item.duoQty;

                    return (
                      <TableRow key={idx} className="text-xs hover:bg-muted/10">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{item.icon}</span>
                            <div>
                              <p className="font-bold text-foreground text-sm leading-tight">
                                {item.name}
                              </p>
                              <Badge variant="outline" className="text-[10px] capitalize mt-0.5">
                                {item.category === 'chemical'
                                  ? 'Core Spray Bottle'
                                  : item.category === 'cloth'
                                  ? 'Wipes & Scrub'
                                  : item.category === 'ppe'
                                  ? 'PPE & Waste'
                                  : item.category === 'tool'
                                  ? 'Hand Tool'
                                  : 'Floor Care'}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span
                            className={`font-bold px-2 py-1 rounded-md text-xs inline-block ${
                              caddyMode === 'solo'
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-purple-100 text-purple-900'
                            }`}
                          >
                            {qty}
                          </span>
                        </TableCell>

                        <TableCell className="text-muted-foreground text-xs">
                          {item.purpose}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: OUR SUPPLY STASH (THE REFILL INVENTORY)                           */}
        {/* ========================================================================= */}
        <TabsContent value="supply_list" className="space-y-4 m-0">
          {/* Header Description & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Boxes className="h-4 w-4 text-primary" />
                Central Refill Stash
              </h3>
              <p className="text-xs text-muted-foreground">
                The bulk jugs, towel bundles, and boxes you keep on your shelves to refill the Solo and Duo caddies.
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
                  { id: 'chemical', label: 'Solutions & Refills' },
                  { id: 'consumable', label: 'Microfiber & Towels' },
                  { id: 'ppe', label: 'Gloves & Trash Bags' },
                  { id: 'tool', label: 'Machinery & Tools' },
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
      {/* DIALOG: PACK & DISPATCH CADDY                                             */}
      {/* ========================================================================= */}
      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pack & Dispatch Caddy</DialogTitle>
            <DialogDescription className="text-xs">
              Assign a Solo (1 Person) or Duo (2 People) caddy kit to your cleaners heading out on jobs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDispatchCaddy} className="space-y-4 pt-2 text-xs">
            {/* Mode selection inside modal */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg border">
              <button
                type="button"
                onClick={() => setCaddyMode('solo')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                  caddyMode === 'solo'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                👤 Solo Caddy (1 Person)
              </button>
              <button
                type="button"
                onClick={() => setCaddyMode('duo')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                  caddyMode === 'duo'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                👥 Duo Kit (2 People)
              </button>
            </div>

            <div>
              <Label htmlFor="cleaner-1">
                {caddyMode === 'solo' ? 'Assigned Cleaner *' : 'Cleaner 1 (Lead) *'}
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

            {caddyMode === 'duo' && (
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
              <Label htmlFor="caddy-label">Caddy Identifier / Tag</Label>
              <Input
                id="caddy-label"
                value={caddyLabel}
                onChange={(e) => setCaddyLabel(e.target.value)}
                placeholder="e.g. Caddy #1, Blue Caddy, Van 1"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="caddy-notes">Job / Shift Notes (Optional)</Label>
              <Input
                id="caddy-notes"
                value={caddyNotes}
                onChange={(e) => setCaddyNotes(e.target.value)}
                placeholder="e.g. 2-bedroom deep clean, morning shift"
                className="mt-1 text-xs"
              />
            </div>

            {/* Quick Confirmation */}
            <div className="p-3 rounded-lg bg-muted/40 border space-y-1.5 text-[11px] text-muted-foreground">
              <p className="font-semibold text-foreground">Packing Confirmation:</p>
              <p>✓ {caddyMode === 'solo' ? '4 Core Spray Bottles' : '8 Spray Bottles (Dual Caddies)'}</p>
              <p>✓ {caddyMode === 'solo' ? '12–15 Towels + Sponges' : '25–30 Towels + Sponges'}</p>
              <p>✓ Contractor bags, gloves & extendable duster</p>
              <p>✓ RIDGID Shop Vac & Flip Mop</p>
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
                    <SelectItem value="chemical">Solutions & Cleaners</SelectItem>
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
