'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Clock,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Zone } from '@/types';
import type { QuickBooksSyncLog } from '@/lib/quickbooks/types';

interface QBOStatusResponse {
  isConnected: boolean;
  realmId?: string;
  companyName?: string;
  environment?: 'sandbox' | 'production';
  expiresAt?: string;
  lastSyncAt?: string;
  hasCredentials: boolean;
  recentLogs?: QuickBooksSyncLog[];
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'general');

  // General Settings State
  const [zones, setZones] = useState<Zone[]>([]);
  const [newZone, setNewZone] = useState({ name: '', city: '' });

  // QuickBooks State
  const [qboStatus, setQboStatus] = useState<QBOStatusResponse | null>(null);
  const [qboLoading, setQboLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Handle URL status messages after OAuth callback
  useEffect(() => {
    const status = searchParams.get('status');
    const error = searchParams.get('error');
    const company = searchParams.get('company');

    if (status === 'connected') {
      toast.success(
        company
          ? `Connected to QuickBooks: ${company}`
          : 'Successfully connected to QuickBooks Online!'
      );
    } else if (status === 'disconnected') {
      toast.info('QuickBooks has been disconnected.');
    } else if (error) {
      toast.error(`QuickBooks error: ${decodeURIComponent(error)}`);
    }
  }, [searchParams]);

  // Load Zones
  useEffect(() => {
    fetch('/api/zones')
      .then((r) => r.json())
      .then((d) => setZones(Array.isArray(d) ? d : []));
  }, []);

  // Load QuickBooks Status
  function loadQboStatus() {
    setQboLoading(true);
    fetch(`/api/integrations/quickbooks/status?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        setQboStatus(data);
        setQboLoading(false);
      })
      .catch(() => {
        setQboLoading(false);
      });
  }

  useEffect(() => {
    loadQboStatus();
  }, []);

  // Add Zone
  async function addZone() {
    if (!newZone.name || !newZone.city) {
      toast.error('Name and city required');
      return;
    }
    const res = await fetch('/api/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newZone),
    });
    if (res.ok) {
      const zone = await res.json();
      setZones([...zones, zone]);
      setNewZone({ name: '', city: '' });
      toast.success('Zone added');
    }
  }

  // Test Connection
  async function handleTestConnection() {
    setTesting(true);
    try {
      const res = await fetch('/api/integrations/quickbooks/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`QuickBooks connection verified (${data.companyName})`);
        loadQboStatus();
      } else {
        toast.error(`Test failed: ${data.error || 'Could not verify connection'}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  // Sync Pending Invoices
  async function handleSyncInvoices() {
    setSyncing(true);
    try {
      const res = await fetch('/api/integrations/quickbooks/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_pending_invoices' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          data.message || `Successfully synced ${data.syncedCount} invoices to QuickBooks!`
        );
        loadQboStatus();
      } else {
        toast.error(`Sync error: ${data.error || 'Failed to sync invoices'}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  // Disconnect QuickBooks
  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect QuickBooks? Automated syncing will be paused.')) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/quickbooks/disconnect', {
        method: 'POST',
      });
      if (res.ok) {
        toast.info('QuickBooks disconnected');
        loadQboStatus();
      } else {
        toast.error('Failed to disconnect');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Operations, pricing, and accounting integrations</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="general">Operations &amp; Pricing</TabsTrigger>
          <TabsTrigger value="quickbooks" className="flex items-center gap-2">
            QuickBooks
            {qboStatus?.isConnected && (
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── GENERAL TAB ─── */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Zones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {zones.map((z) => (
                  <Badge key={z.id} variant="outline" className="px-3 py-1.5">
                    {z.name} ({z.city})
                  </Badge>
                ))}
                {zones.length === 0 && (
                  <p className="text-sm text-muted-foreground">No zones yet</p>
                )}
              </div>
              <Separator />
              <div className="flex gap-3 items-end">
                <div>
                  <Label>Zone Name</Label>
                  <Input
                    value={newZone.name}
                    onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                    placeholder="e.g. North York"
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input
                    value={newZone.city}
                    onChange={(e) => setNewZone({ ...newZone, city: e.target.value })}
                    placeholder="e.g. Toronto"
                  />
                </div>
                <Button onClick={addZone}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default Pricing (CAD)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Standard Clean</span>
                <span className="font-medium">$180</span>
              </div>
              <div className="flex justify-between">
                <span>Deep Clean</span>
                <span className="font-medium">$280</span>
              </div>
              <div className="flex justify-between">
                <span>Move-In Clean</span>
                <span className="font-medium">$350</span>
              </div>
              <div className="flex justify-between">
                <span>Move-Out Clean</span>
                <span className="font-medium">$350</span>
              </div>
              <div className="flex justify-between">
                <span>Recurring Standard</span>
                <span className="font-medium">$160</span>
              </div>
              <div className="flex justify-between">
                <span>Recurring Deep</span>
                <span className="font-medium">$250</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── QUICKBOOKS TAB ─── */}
        <TabsContent value="quickbooks" className="space-y-6">
          {/* Connection Status Card */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">QuickBooks Online Integration</CardTitle>
                    {qboStatus?.isConnected ? (
                      <Badge className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Disconnected
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">
                    Automate partner invoices, customer synchronization, and completed job sales receipts.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadQboStatus}
                  disabled={qboLoading}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${qboLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {qboStatus?.isConnected ? (
                /* Connected State */
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border border-border">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> Company Name
                      </p>
                      <p className="text-sm font-semibold mt-0.5">
                        {qboStatus.companyName || 'QuickBooks Company'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> Realm ID (Company ID)
                      </p>
                      <p className="text-sm font-mono font-medium mt-0.5">
                        {qboStatus.realmId || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Environment &amp; Sync
                      </p>
                      <p className="text-sm font-medium mt-0.5 capitalize">
                        {qboStatus.environment || 'sandbox'} ·{' '}
                        {qboStatus.lastSyncAt
                          ? `Synced ${new Date(qboStatus.lastSyncAt).toLocaleTimeString()}`
                          : 'No syncs yet'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <Button
                      onClick={handleTestConnection}
                      disabled={testing}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      {testing ? 'Testing...' : 'Test Connection'}
                    </Button>

                    <Button
                      onClick={handleSyncInvoices}
                      disabled={syncing}
                      className="flex items-center gap-2"
                    >
                      <Zap className="h-4 w-4" />
                      {syncing ? 'Syncing...' : 'Sync Pending Invoices'}
                    </Button>

                    <Button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect QuickBooks'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Disconnected State */
                <div className="space-y-6">
                  {!qboStatus?.hasCredentials && (
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-1">
                      <p className="font-semibold flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-amber-700" /> Missing Intuit Developer Credentials
                      </p>
                      <p className="text-xs text-amber-800">
                        Add <code className="bg-amber-100 px-1 py-0.5 rounded">QUICKBOOKS_CLIENT_ID</code> and{' '}
                        <code className="bg-amber-100 px-1 py-0.5 rounded">QUICKBOOKS_CLIENT_SECRET</code> to your{' '}
                        <code className="bg-amber-100 px-1 py-0.5 rounded">.env.local</code> file to enable connection.
                      </p>
                    </div>
                  )}

                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-2xl">
                      qb
                    </div>
                    <div className="max-w-md">
                      <h3 className="text-lg font-semibold">Connect Sea of Blue to QuickBooks Online</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Authorizing QuickBooks allows automated pushing of partner billing invoices, sales receipts, and customer contact records.
                      </p>
                    </div>

                    <a href="/api/integrations/quickbooks/auth">
                      <Button
                        size="lg"
                        className="bg-[#2CA01C] hover:bg-[#238016] text-white font-semibold flex items-center gap-2 shadow-sm"
                      >
                        Connect to QuickBooks
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Automation Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Automatic Invoicing
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                When monthly partner invoices are generated, they are automatically formatted with all job line items and pushed into QuickBooks Online with Net-15 terms.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Customer Deduplication
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                Before creating invoices, Sea of Blue checks QuickBooks for existing customer records by company or client name to prevent duplicate profiles.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Token Refreshing
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                OAuth access tokens expire every 60 minutes. Sea of Blue silently refreshes your session tokens in the background so your connection never drops.
              </CardContent>
            </Card>
          </div>

          {/* Sync History Table */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base">Recent Sync Activity</CardTitle>
                  <CardDescription>Logs of sync events and communications with Intuit</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={loadQboStatus} className="text-xs">
                  Refresh Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {qboStatus?.recentLogs && qboStatus.recentLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[550px]">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">QBO ID</th>
                        <th className="pb-2 font-medium">Timestamp</th>
                        <th className="pb-2 font-medium">Details / Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {qboStatus.recentLogs.map((log) => (
                        <tr key={log.id} className="py-2">
                          <td className="py-2.5 font-medium uppercase text-[11px] text-foreground">
                            {log.entity_type.replace('_', ' ')}
                          </td>
                          <td className="py-2.5">
                            {log.status === 'success' ? (
                              <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200 text-[10px] py-0">
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200 text-[10px] py-0">
                                Failed
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 font-mono text-[11px] text-muted-foreground">
                            {log.qbo_id || '—'}
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-2.5 text-muted-foreground max-w-xs truncate">
                            {log.error_message || 'OK'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No sync events recorded yet. Connect QuickBooks and perform a test or sync to see logs here.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
