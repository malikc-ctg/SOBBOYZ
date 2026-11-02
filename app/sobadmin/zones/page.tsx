'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Globe, Save, X, RefreshCw } from 'lucide-react';
import type { Zone } from '@/types';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';

export default function AdminZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newZoneMode, setNewZoneMode] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    city: '',
    areas: [] as string[],
    newArea: '',
  });

  async function fetchZones() {
    setLoading(true);
    try {
      const res = await fetch('/api/zones');
      const data = await res.json();
      setZones(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch zones');
    } finally {
      setLoading(false);
    }
  }

  async function handleScanAllAddresses() {
    setScanning(true);
    toast.info('Scanning all current addresses and reconciling zone coverage...');
    try {
      const res = await fetch('/api/zones/scan', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to scan addresses');
      const data = await res.json();
      toast.success(`Scanned ${data.totalJobsScanned} addresses: updated ${data.updatedJobsCount} jobs, created ${data.newlyCreatedZonesCount} new zones.`);
      fetchZones();
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => { fetchZones(); }, []);

  async function handleSave() {
    try {
      const isEditing = !!editingId;
      const url = '/api/zones';
      const method = isEditing ? 'PATCH' : 'POST';
      const body = isEditing 
        ? { id: editingId, ...formData }
        : { name: formData.name, city: formData.city, areas: formData.areas };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save');
      
      toast.success(isEditing ? 'Zone updated' : 'Zone created');
      setEditingId(null);
      setNewZoneMode(false);
      resetForm();
      fetchZones();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure? This may affect employees assigned to this zone.')) return;
    try {
      const res = await fetch(`/api/zones?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Zone deleted');
      fetchZones();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function resetForm() {
    setFormData({ name: '', city: '', areas: [], newArea: '' });
  }

  function startEditing(zone: Zone) {
    setEditingId(zone.id);
    setFormData({
      name: zone.name,
      city: zone.city,
      areas: zone.areas || [],
      newArea: '',
    });
    setNewZoneMode(false);
  }

  function addArea() {
    if (!formData.newArea.trim()) return;
    if (formData.areas.includes(formData.newArea.trim())) {
      toast.error('Area already exists');
      return;
    }
    setFormData({
      ...formData,
      areas: [...formData.areas, formData.newArea.trim()],
      newArea: '',
    });
  }

  function removeArea(area: string) {
    setFormData({
      ...formData,
      areas: formData.areas.filter(a => a !== area),
    });
  }

  return (
    <div className="space-y-6 max-w-6xl min-w-0">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" /> Regional Zones
          </h1>
          <p className="text-muted-foreground text-sm">Manage service areas and neighborhood dispersal groups.</p>
        </div>
        {!newZoneMode && !editingId && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleScanAllAddresses}
              disabled={scanning}
              className="gap-2 h-10 md:h-9 text-xs font-semibold"
            >
              <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">{scanning ? 'Scanning Addresses...' : 'Scan & Auto-Sync Zones'}</span>
              <span className="sm:hidden">{scanning ? 'Scanning...' : 'Auto-Sync'}</span>
            </Button>
            <Button onClick={() => { setNewZoneMode(true); resetForm(); }} className="gap-2 h-10 md:h-9 text-xs font-semibold">
              <Plus className="h-4 w-4" /> Add Zone
            </Button>
          </div>
        )}
      </div>

      {(newZoneMode || editingId) && (
        <Card className="border-blue-200 bg-blue-50/10">
          <CardHeader>
            <CardTitle className="text-lg">{editingId ? 'Edit Zone' : 'Create New Zone'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zone Name (e.g. Downtown Toronto)</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Zone Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Main City</Label>
                <AddressAutocomplete 
                  value={formData.city} 
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  onAddressSelect={addr => {
                    // Extract just the city from the address object
                    const cityVal = addr.city || addr.address_line1.split(',')[0];
                    setFormData({ ...formData, city: cityVal });
                    if (!formData.name) setFormData(prev => ({ ...prev, name: cityVal }));
                  }}
                  placeholder="Search city..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Neighborhoods / Areas</Label>
              <div className="flex gap-2">
                <Input 
                  value={formData.newArea} 
                  onChange={e => setFormData({ ...formData, newArea: e.target.value })}
                  placeholder="Add a neighborhood..."
                  onKeyDown={e => e.key === 'Enter' && addArea()}
                />
                <Button type="button" variant="outline" onClick={addArea}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 p-3 bg-muted/50 rounded-lg min-h-[50px]">
                {formData.areas.length === 0 && <p className="text-xs text-muted-foreground italic">No areas added yet.</p>}
                {formData.areas.map(area => (
                  <Badge key={area} variant="secondary" className="pl-3 pr-1 py-1 gap-1 flex items-center">
                    {area}
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="h-4 w-4 p-0 hover:text-destructive" 
                      onClick={() => removeArea(area)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setEditingId(null); setNewZoneMode(false); }}>Cancel</Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" /> {editingId ? 'Update Zone' : 'Create Zone'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {loading ? (
          <p>Loading zones...</p>
        ) : zones.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground italic">
            No zones defined yet. Click &quot;Add New Zone&quot; to begin.
          </Card>
        ) : (
          zones.map(zone => (
            <Card key={zone.id} className="hover:border-blue-200 transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg">{zone.name}</h3>
                      <Badge variant="outline" className="text-xs">{zone.city}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-w-2xl">
                      {zone.areas && zone.areas.length > 0 ? (
                        zone.areas.map(area => (
                          <span key={area} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground border">
                            {area}
                          </span>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No areas defined</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => startEditing(zone)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(zone.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
