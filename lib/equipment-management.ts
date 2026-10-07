// Sea of Blue — Equipment Fleet & Cleaner Custody Engine
// Tracks durable machinery (backpack vacuums, carpet extractors, ozone generators),
// live technician custody, condition inspections, and runtime maintenance logs.

import { createServiceClient } from '@/lib/supabase/server';

export interface EquipmentAsset {
  id: string;
  name: string;
  model_number?: string | null;
  serial_number?: string | null;
  asset_tag: string;
  zone_id?: string | null;
  current_holder_id?: string | null;
  status: 'available' | 'checked_out' | 'in_maintenance' | 'damaged' | 'retired';
  condition: 'pristine' | 'good' | 'worn' | 'maintenance_needed' | 'damaged';
  total_runtime_hours: number;
  last_inspected_at?: string | null;
  notes?: string | null;
  holder?: {
    id: string;
    full_name: string;
    phone?: string;
  } | null;
  zone?: {
    id: string;
    name: string;
  } | null;
}

// Fallback seed assets if DB table hasn't been migrated yet
const SEED_EQUIPMENT: EquipmentAsset[] = [
  {
    id: 'eq-vac-01',
    name: 'ProTeam Super Coach Pro 10qt HEPA Backpack Vacuum',
    model_number: '107310',
    serial_number: 'PT-2026-9941',
    asset_tag: 'EQ-VAC-01',
    status: 'checked_out',
    condition: 'good',
    total_runtime_hours: 142.5,
    last_inspected_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    notes: 'HEPA filter replaced last month. Includes hard floor + carpet attachments.',
    holder: { id: 'cleaner-1', full_name: 'Marcus Sterling', phone: '416-555-0192' },
    zone: { id: 'zone-1', name: 'Downtown Core Hub' },
  },
  {
    id: 'eq-vac-02',
    name: 'ProTeam Super Coach Pro 10qt HEPA Backpack Vacuum',
    model_number: '107310',
    serial_number: 'PT-2026-9942',
    asset_tag: 'EQ-VAC-02',
    status: 'available',
    condition: 'pristine',
    total_runtime_hours: 48.0,
    last_inspected_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    notes: 'Cleaned and ready for dispatch at Central Depot.',
    holder: null,
    zone: { id: 'zone-1', name: 'Downtown Core Hub' },
  },
  {
    id: 'eq-ext-01',
    name: 'Bissell BigGreen Commercial Carpet Extractor',
    model_number: 'BG10',
    serial_number: 'BIS-88214',
    asset_tag: 'EQ-EXT-01',
    status: 'checked_out',
    condition: 'good',
    total_runtime_hours: 210.0,
    last_inspected_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    notes: 'Used on deep move-out cleans. Hose flushed after every job.',
    holder: { id: 'cleaner-2', full_name: 'Elena Rostova', phone: '647-555-0144' },
    zone: { id: 'zone-2', name: 'Mississauga West Hub' },
  },
  {
    id: 'eq-ozn-01',
    name: 'Commercial High-Output Ozone Generator 10,000mg/h',
    model_number: 'OG-10K',
    serial_number: 'OZ-55102',
    asset_tag: 'EQ-OZN-01',
    status: 'available',
    condition: 'good',
    total_runtime_hours: 64.0,
    last_inspected_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    notes: 'Requires mandatory 2-hour post-treatment room airing protocol.',
    holder: null,
    zone: { id: 'zone-1', name: 'Downtown Core Hub' },
  },
  {
    id: 'eq-stm-01',
    name: 'Dupray Commercial Steam Cleaner 160°C Sanitizer',
    model_number: 'NEAT-PRO',
    serial_number: 'DP-33910',
    asset_tag: 'EQ-STM-01',
    status: 'in_maintenance',
    condition: 'maintenance_needed',
    total_runtime_hours: 310.5,
    last_inspected_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    notes: 'Descaling cycle required; replacement brass brush nozzles on order from Home Depot.',
    holder: null,
    zone: { id: 'zone-1', name: 'Downtown Core Hub' },
  },
];

const inMemoryEquipment = [...SEED_EQUIPMENT];

export async function getEquipmentAssets(zoneId?: string): Promise<EquipmentAsset[]> {
  const supabase = await createServiceClient();

  try {
    let query = supabase
      .from('equipment_assets')
      .select('*, holder:contractors(id, full_name, phone), zone:zones(id, name)')
      .order('created_at', { ascending: true });

    if (zoneId && zoneId !== 'all') {
      query = query.eq('zone_id', zoneId);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data as EquipmentAsset[];
    }
  } catch {}

  // Fallback to in-memory state if table not ready yet
  if (zoneId && zoneId !== 'all') {
    return inMemoryEquipment.filter((e) => e.zone_id === zoneId || !e.zone_id);
  }
  return inMemoryEquipment;
}

export async function updateEquipmentCustody(params: {
  assetId: string;
  action: 'checkout' | 'checkin' | 'maintenance';
  contractorId?: string | null;
  condition: 'pristine' | 'good' | 'worn' | 'maintenance_needed' | 'damaged';
  notes?: string;
}): Promise<EquipmentAsset> {
  const supabase = await createServiceClient();

  let newStatus: EquipmentAsset['status'] = 'available';
  let holderId: string | null = null;

  if (params.action === 'checkout') {
    newStatus = 'checked_out';
    holderId = params.contractorId || null;
  } else if (params.action === 'maintenance') {
    newStatus = 'in_maintenance';
    holderId = null;
  } else {
    // Check-in
    newStatus = params.condition === 'maintenance_needed' || params.condition === 'damaged'
      ? 'in_maintenance'
      : 'available';
    holderId = null;
  }

  try {
    const { data, error } = await supabase
      .from('equipment_assets')
      .update({
        status: newStatus,
        current_holder_id: holderId,
        condition: params.condition,
        last_inspected_at: new Date().toISOString(),
        notes: params.notes || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.assetId)
      .select('*, holder:contractors(id, full_name, phone), zone:zones(id, name)')
      .single();

    if (!error && data) {
      // Log custody transition
      await supabase.from('equipment_custody_logs').insert({
        asset_id: params.assetId,
        contractor_id: params.contractorId || holderId,
        action: params.action,
        condition_reported: params.condition,
        notes: params.notes,
      });

      return data as EquipmentAsset;
    }
  } catch {}

  // In-memory update
  const idx = inMemoryEquipment.findIndex((e) => e.id === params.assetId);
  if (idx !== -1) {
    let holderObj = null;
    if (holderId) {
      holderObj = { id: holderId, full_name: 'Assigned Cleaner' };
    }
    inMemoryEquipment[idx] = {
      ...inMemoryEquipment[idx],
      status: newStatus,
      current_holder_id: holderId,
      condition: params.condition,
      last_inspected_at: new Date().toISOString(),
      notes: params.notes || inMemoryEquipment[idx].notes,
      holder: holderObj,
    };
    return inMemoryEquipment[idx];
  }

  throw new Error('Equipment asset not found');
}
