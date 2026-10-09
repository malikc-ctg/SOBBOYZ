'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Shield, Search, ChevronDown, ChevronUp, RefreshCw,
  ArrowLeft, Filter, Clock, User, Briefcase, FileText, Camera, PhoneCall,
} from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhotoEvidenceTab } from '@/components/admin/audit/PhotoEvidenceTab';
import { SalesCallLogsTab } from '@/components/admin/audit/SalesCallLogsTab';

interface AuditLog {
  id: string;
  actor_id: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  'job.status_changed': 'bg-blue-500/15 text-blue-700 border-blue-200',
  'job.dispatched': 'bg-purple-500/15 text-purple-700 border-purple-200',
  'lead.updated': 'bg-amber-500/15 text-amber-700 border-amber-200',
  'lead.converted': 'bg-green-500/15 text-green-700 border-green-200',
  'lead.deleted': 'bg-red-500/15 text-red-700 border-red-200',
};

const ACTION_ICONS: Record<string, typeof Briefcase> = {
  'job.status_changed': Briefcase,
  'job.dispatched': Briefcase,
  'lead.updated': FileText,
  'lead.converted': FileText,
  'lead.deleted': FileText,
};

function DiffView({ label, oldVal, newVal }: { label: string; oldVal: any; newVal: any }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-muted-foreground font-medium min-w-[100px]">{label}</span>
      {oldVal !== undefined && (
        <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200 line-through">
          {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
        </span>
      )}
      <span className="text-muted-foreground">→</span>
      <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
        {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
      </span>
    </div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [page, setPage] = useState(0);
  const limit = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      if (filterAction) params.set('action', filterAction);
      if (filterEntity) params.set('entity_type', filterEntity);

      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.data ?? []);
      setCount(data.count ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterEntity]);

  useEffect(() => {
    fetchLogs();
    fetch('/api/employees')
      .then((r) => r.json())
      .then((d) => setEmployees(Array.isArray(d) ? d : []))
      .catch(() => setEmployees([]));
  }, [fetchLogs]);

  const filteredLogs = search
    ? logs.filter(
        (l) =>
          l.action.toLowerCase().includes(search.toLowerCase()) ||
          l.actor_email?.toLowerCase().includes(search.toLowerCase()) ||
          l.entity_id?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const totalPages = Math.ceil(count / limit);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sobadmin" className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <h1 className="text-2xl font-bold text-foreground">Audit &amp; Evidence Trail</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Permanent photo verification, checklist timestamps, and immutable activity logs
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="photos" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="photos" className="flex items-center gap-1.5 font-semibold">
            <Camera className="h-4 w-4 text-blue-600" />
            Job Photo Evidence &amp; Checklists
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1.5 font-semibold">
            <Shield className="h-4 w-4 text-slate-600" />
            System Activity Audit Logs
          </TabsTrigger>
          <TabsTrigger value="calls" className="flex items-center gap-1.5 font-semibold">
            <PhoneCall className="h-4 w-4 text-emerald-600" />
            Sales Call &amp; Dial Logs
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Photo Evidence & Checklists with Timestamps */}
        <TabsContent value="photos" className="space-y-6">
          <PhotoEvidenceTab employees={employees} />
        </TabsContent>

        {/* Tab 2: System Activity Logs */}
        <TabsContent value="logs" className="space-y-6">
          {/* Filters & Search */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search actions, emails, IDs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                setPage(0);
              }}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-background"
            >
              <option value="">All Actions</option>
              <option value="job.status_changed">Job Status Changed</option>
              <option value="job.dispatched">Job Dispatched</option>
              <option value="lead.updated">Lead Updated</option>
              <option value="lead.converted">Lead Converted</option>
              <option value="lead.deleted">Lead Deleted</option>
            </select>
            <select
              value={filterEntity}
              onChange={(e) => {
                setFilterEntity(e.target.value);
                setPage(0);
              }}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-background"
            >
              <option value="">All Entities</option>
              <option value="job">Jobs</option>
              <option value="lead">Leads</option>
              <option value="employee">Employees</option>
            </select>
            <span className="text-xs text-muted-foreground">{count} total entries</span>
            <button
              onClick={fetchLogs}
              className="ml-auto flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Log Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading audit logs...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">
                No audit logs found. Actions will appear here as they occur.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const colorClass = ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700 border-gray-200';
                  const IconComp = ACTION_ICONS[log.action] ?? Shield;

                  return (
                    <div key={log.id}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="w-full text-left px-5 py-3.5 hover:bg-muted/30 transition-colors flex items-center gap-4"
                      >
                        <IconComp className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${colorClass}`}>
                              {log.action.replace('.', ' → ')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              on <span className="font-medium text-foreground">{log.entity_type}</span>
                              {log.entity_id && (
                                <span className="text-muted-foreground"> #{log.entity_id.slice(0, 8)}</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.actor_email ?? log.actor_id?.slice(0, 8) ?? 'System'}
                            </span>
                            {log.actor_role && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">
                                {log.actor_role}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.created_at), 'MMM d, h:mm a')}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-5 py-4 bg-muted/20 border-t border-border space-y-3">
                          {/* Diff view */}
                          {log.old_values && log.new_values && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Changes
                              </p>
                              {Object.keys({ ...log.old_values, ...log.new_values }).map((key) => (
                                <DiffView
                                  key={key}
                                  label={key}
                                  oldVal={log.old_values?.[key]}
                                  newVal={log.new_values?.[key]}
                                />
                              ))}
                            </div>
                          )}
                          {log.new_values && !log.old_values && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                New Values
                              </p>
                              <pre className="text-xs bg-card border border-border rounded-lg p-3 overflow-x-auto">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.metadata && (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Metadata
                              </p>
                              <pre className="text-xs bg-card border border-border rounded-lg p-3 overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                            <div>
                              <span className="font-medium">IP:</span> {log.ip_address ?? 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Actor ID:</span> {log.actor_id?.slice(0, 12)}...
                            </div>
                            <div>
                              <span className="font-medium">Log ID:</span> {log.id.slice(0, 12)}...
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Sales Call & Dial Logs */}
        <TabsContent value="calls" className="space-y-6">
          <SalesCallLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
