'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Plus,
  DollarSign,
  Users,
  Timer,
  Calendar,
  AlertCircle,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { toast } from 'sonner';

interface TimesheetsTabProps {
  employees: any[];
}

export function TimesheetsTab({ employees }: TimesheetsTabProps) {
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total_hours: 0,
    total_minutes: 0,
    total_wages: 0,
    active_clocked_in: 0,
    pending_approval: 0,
    total_entries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [timePreset, setTimePreset] = useState<'today' | 'this_week' | 'last_week' | 'this_month' | 'all'>('this_week');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<any>(null);

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    employee_id: '',
    work_date: format(new Date(), 'yyyy-MM-dd'),
    clock_in_time: '08:30',
    clock_out_time: '16:30',
    total_minutes: '480',
    status: 'approved',
    notes: '',
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    work_date: '',
    clock_in_time: '',
    clock_out_time: '',
    total_minutes: '',
    status: '',
    notes: '',
  });

  // Calculate dates based on preset
  useEffect(() => {
    const today = new Date();
    if (timePreset === 'today') {
      const d = format(today, 'yyyy-MM-dd');
      setStartDate(d);
      setEndDate(d);
    } else if (timePreset === 'this_week') {
      const s = startOfWeek(today, { weekStartsOn: 1 });
      const e = endOfWeek(today, { weekStartsOn: 1 });
      setStartDate(format(s, 'yyyy-MM-dd'));
      setEndDate(format(e, 'yyyy-MM-dd'));
    } else if (timePreset === 'last_week') {
      const prevWeek = subWeeks(today, 1);
      const s = startOfWeek(prevWeek, { weekStartsOn: 1 });
      const e = endOfWeek(prevWeek, { weekStartsOn: 1 });
      setStartDate(format(s, 'yyyy-MM-dd'));
      setEndDate(format(e, 'yyyy-MM-dd'));
    } else if (timePreset === 'this_month') {
      const s = startOfMonth(today);
      const e = endOfMonth(today);
      setStartDate(format(s, 'yyyy-MM-dd'));
      setEndDate(format(e, 'yyyy-MM-dd'));
    } else if (timePreset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  }, [timePreset]);

  const fetchTimesheets = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedEmployeeId && selectedEmployeeId !== 'all') {
        params.append('employee_id', selectedEmployeeId);
      }
      if (selectedStatus && selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }
      if (startDate) {
        params.append('start_date', startDate);
      }
      if (endDate) {
        params.append('end_date', endDate);
      }

      const res = await fetch(`/api/sobadmin/timesheets?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load timesheets');
      const data = await res.json();
      setTimesheets(data.timesheets || []);
      setSummary(data.summary || {});
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Could not load timesheets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedEmployeeId, selectedStatus, startDate, endDate]);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  // Handle Quick Status Change (Approve / Reject)
  async function handleStatusChange(id: string, newStatus: 'approved' | 'rejected') {
    try {
      const res = await fetch(`/api/sobadmin/timesheets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`Failed to update status to ${newStatus}`);
      toast.success(`Timesheet ${newStatus === 'approved' ? 'approved' : 'rejected'}`);
      fetchTimesheets(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Handle Force Clock-Out for open shifts
  async function handleForceClockOut(id: string, employeeName: string) {
    if (!confirm(`Force clock out for ${employeeName}? This will set clock-out to right now and compute hours.`)) return;
    try {
      const res = await fetch(`/api/sobadmin/timesheets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_clock_out: true, status: 'completed' }),
      });
      if (!res.ok) throw new Error('Failed to force clock out');
      toast.success(`${employeeName} clocked out successfully`);
      fetchTimesheets(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Handle Delete
  async function handleDeleteTimesheet(id: string) {
    if (!confirm('Are you sure you want to delete this timesheet entry?')) return;
    try {
      const res = await fetch(`/api/sobadmin/timesheets/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete timesheet');
      toast.success('Timesheet deleted');
      fetchTimesheets(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Handle Manual Log Submission
  async function handleCreateManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualForm.employee_id) {
      toast.error('Please select an employee');
      return;
    }

    try {
      // Build ISO strings for clock in and clock out if times provided
      let inIso = null;
      let outIso = null;
      if (manualForm.clock_in_time) {
        inIso = new Date(`${manualForm.work_date}T${manualForm.clock_in_time}:00`).toISOString();
      }
      if (manualForm.clock_out_time) {
        outIso = new Date(`${manualForm.work_date}T${manualForm.clock_out_time}:00`).toISOString();
      }

      const totalMins = parseInt(manualForm.total_minutes, 10);

      const res = await fetch('/api/sobadmin/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: manualForm.employee_id,
          work_date: manualForm.work_date,
          clock_in_time: inIso,
          clock_out_time: outIso,
          total_minutes: isNaN(totalMins) ? null : totalMins,
          status: manualForm.status,
          notes: manualForm.notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create timesheet');
      }

      toast.success('Hours logged successfully');
      setManualModalOpen(false);
      setManualForm({
        employee_id: '',
        work_date: format(new Date(), 'yyyy-MM-dd'),
        clock_in_time: '08:30',
        clock_out_time: '16:30',
        total_minutes: '480',
        status: 'approved',
        notes: '',
      });
      fetchTimesheets();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Open Edit Dialog
  function openEdit(ts: any) {
    setSelectedTimesheet(ts);
    setEditForm({
      work_date: ts.work_date,
      clock_in_time: ts.clock_in_time ? format(new Date(ts.clock_in_time), 'HH:mm') : '',
      clock_out_time: ts.clock_out_time ? format(new Date(ts.clock_out_time), 'HH:mm') : '',
      total_minutes: ts.total_minutes !== null ? String(ts.total_minutes) : '',
      status: ts.status,
      notes: ts.notes || '',
    });
    setEditModalOpen(true);
  }

  // Submit Edit Dialog
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTimesheet) return;

    try {
      let inIso = selectedTimesheet.clock_in_time;
      let outIso = selectedTimesheet.clock_out_time;

      if (editForm.clock_in_time) {
        inIso = new Date(`${editForm.work_date}T${editForm.clock_in_time}:00`).toISOString();
      }
      if (editForm.clock_out_time) {
        outIso = new Date(`${editForm.work_date}T${editForm.clock_out_time}:00`).toISOString();
      }

      const totalMins = editForm.total_minutes ? parseInt(editForm.total_minutes, 10) : undefined;

      const res = await fetch(`/api/sobadmin/timesheets/${selectedTimesheet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_date: editForm.work_date,
          clock_in_time: inIso,
          clock_out_time: outIso,
          total_minutes: totalMins,
          status: editForm.status,
          notes: editForm.notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update timesheet');
      }

      toast.success('Timesheet updated');
      setEditModalOpen(false);
      fetchTimesheets(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Helper formatting for durations
  const formatMinutes = (mins: number) => {
    if (!mins || mins <= 0) return '0h 0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Hours Card */}
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Hours Worked</p>
              <h3 className="text-2xl font-black tracking-tight mt-1 text-foreground">
                {summary.total_hours} <span className="text-sm font-normal text-muted-foreground">hrs</span>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{summary.total_entries} shifts logged</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Active Clocked In Card */}
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clocked In Now</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${summary.active_clocked_in > 0 ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${summary.active_clocked_in > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                </span>
                <h3 className="text-2xl font-black tracking-tight text-foreground">
                  {summary.active_clocked_in}
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {summary.active_clocked_in > 0 ? 'Currently on active shift' : 'No active shifts'}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Timer className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Estimated Payroll Wages Card */}
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Est. Total Wages</p>
              <h3 className="text-2xl font-black tracking-tight mt-1 text-foreground">
                ${summary.total_wages?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Gross labor cost in period</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals Card */}
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs Approval</p>
              <h3 className="text-2xl font-black tracking-tight mt-1 text-foreground">
                {summary.pending_approval}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting manager sign-off</p>
            </div>
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${summary.pending_approval > 0 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <Card className="border shadow-sm">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Quick Time Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground mr-1">Period:</span>
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'this_week', label: 'This Week' },
                  { id: 'last_week', label: 'Last Week' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant={timePreset === preset.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => setTimePreset(preset.id)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => fetchTimesheets(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                onClick={() => setManualModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Log Manual Hours
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t">
            {/* Custom Dates */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">From:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setTimePreset('all');
                    setStartDate(e.target.value);
                  }}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">To:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setTimePreset('all');
                    setEndDate(e.target.value);
                  }}
                  className="h-8 w-36 text-xs"
                />
              </div>
            </div>

            {/* Employee Filter */}
            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Staff:</span>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees ({employees.length})</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 min-w-[170px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Status:</span>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">🟢 Clocked In (Live)</SelectItem>
                  <SelectItem value="completed">🟡 Needs Review</SelectItem>
                  <SelectItem value="approved">✅ Approved</SelectItem>
                  <SelectItem value="rejected">❌ Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Timesheets Table */}
        <CardContent className="p-0 border-t overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Employee</TableHead>
                <TableHead>Work Date</TableHead>
                <TableHead>Clock In / Out</TableHead>
                <TableHead>Breaks</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Rate & Est. Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading timesheets & hours...
                    </div>
                  </TableCell>
                </TableRow>
              ) : timesheets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Clock className="h-8 w-8 text-muted-foreground/50 mb-1" />
                      <p className="font-semibold text-sm">No timesheets found</p>
                      <p className="text-xs text-muted-foreground">
                        No work shifts match the selected date period or filters.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 text-xs"
                        onClick={() => setManualModalOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Log Hours
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                timesheets.map((ts) => {
                  const emp = ts.employee || {};
                  const isLive = ts.status === 'open';
                  const breaks = ts.location_data?.breaks || [];
                  const breakMins = breaks.reduce((acc: number, b: any) => {
                    if (b.start && b.end) {
                      return acc + Math.floor((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000);
                    }
                    return acc;
                  }, 0);

                  return (
                    <TableRow key={ts.id} className="hover:bg-muted/30 transition-colors">
                      {/* Employee Column */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 border">
                            {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-xs leading-tight text-foreground">
                              {emp.full_name || 'Unknown Staff'}
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                              {emp.phone || emp.email || '—'}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Work Date */}
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {ts.work_date ? format(new Date(ts.work_date + 'T12:00:00'), 'EEE, MMM d, yyyy') : '—'}
                      </TableCell>

                      {/* Clock In / Out Times */}
                      <TableCell className="text-xs whitespace-nowrap">
                        {isLive ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            <span>In: {ts.clock_in_time ? format(new Date(ts.clock_in_time), 'h:mm a') : '—'}</span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground font-mono text-[11px]">
                            {ts.clock_in_time ? format(new Date(ts.clock_in_time), 'h:mm a') : '—'}
                            {' → '}
                            {ts.clock_out_time ? format(new Date(ts.clock_out_time), 'h:mm a') : '—'}
                          </div>
                        )}
                        {ts.notes && (
                          <p className="text-[10px] text-muted-foreground italic truncate max-w-[180px] mt-0.5" title={ts.notes}>
                            📝 {ts.notes}
                          </p>
                        )}
                      </TableCell>

                      {/* Breaks */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {breaks.length > 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            ☕ {breaks.length} ({breakMins}m)
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {formatMinutes(ts.effective_minutes)}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-1 font-mono">
                          ({(ts.effective_minutes / 60).toFixed(2)}h)
                        </span>
                      </TableCell>

                      {/* Rate & Est Pay */}
                      <TableCell className="whitespace-nowrap">
                        <div className="text-xs font-semibold text-foreground">
                          ${ts.est_pay?.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          @ ${ts.hourly_wage?.toFixed(2)}/hr
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="whitespace-nowrap">
                        {ts.status === 'open' && (
                          <Badge variant="outline" className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                            🟢 Clocked In
                          </Badge>
                        )}
                        {ts.status === 'completed' && (
                          <Badge variant="outline" className="text-[11px] font-semibold bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                            🟡 Needs Review
                          </Badge>
                        )}
                        {ts.status === 'approved' && (
                          <Badge variant="outline" className="text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                            ✅ Approved
                          </Badge>
                        )}
                        {ts.status === 'rejected' && (
                          <Badge variant="outline" className="text-[11px] font-semibold bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300">
                            ❌ Rejected
                          </Badge>
                        )}
                      </TableCell>

                      {/* Action Buttons */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Force Clock Out if Open */}
                          {isLive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2"
                              title="Force clock out"
                              onClick={() => handleForceClockOut(ts.id, emp.full_name || 'Staff')}
                            >
                              <LogOut className="h-3.5 w-3.5 mr-1" /> Force Out
                            </Button>
                          )}

                          {/* Quick Approve if Completed */}
                          {ts.status === 'completed' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                                title="Approve timesheet"
                                onClick={() => handleStatusChange(ts.id, 'approved')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-1.5"
                                title="Reject timesheet"
                                onClick={() => handleStatusChange(ts.id, 'rejected')}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}

                          {/* Edit / Adjust Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-slate-600 hover:text-slate-900 px-2"
                            title="Edit or adjust timesheet"
                            onClick={() => openEdit(ts)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-1.5"
                            title="Delete entry"
                            onClick={() => handleDeleteTimesheet(ts.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manual Hour Logging Dialog */}
      <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <form onSubmit={handleCreateManual}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-blue-600" />
                Log Manual Employee Hours
              </DialogTitle>
              <DialogDescription>
                Record hours worked for an employee or backfill a past shift.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label className="text-xs font-semibold">Select Employee *</Label>
                <Select
                  value={manualForm.employee_id}
                  onValueChange={(val) => setManualForm({ ...manualForm, employee_id: val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name} ({e.phone || e.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Work Date *</Label>
                <DatePicker
                  value={manualForm.work_date}
                  onChange={(date) => setManualForm({ ...manualForm, work_date: date })}
                  className="mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Clock In</Label>
                  <Input
                    type="time"
                    value={manualForm.clock_in_time}
                    onChange={(e) => setManualForm({ ...manualForm, clock_in_time: e.target.value })}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Clock Out</Label>
                  <Input
                    type="time"
                    value={manualForm.clock_out_time}
                    onChange={(e) => setManualForm({ ...manualForm, clock_out_time: e.target.value })}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Total Minutes</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 480 (8 hrs)"
                    value={manualForm.total_minutes}
                    onChange={(e) => setManualForm({ ...manualForm, total_minutes: e.target.value })}
                    className="mt-1 font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {manualForm.total_minutes ? `${(parseInt(manualForm.total_minutes, 10) / 60 || 0).toFixed(2)} hours` : 'Auto-calc from times'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Status</Label>
                  <Select
                    value={manualForm.status}
                    onValueChange={(val) => setManualForm({ ...manualForm, status: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="completed">Completed / Needs Review</SelectItem>
                      <SelectItem value="open">Open (Currently Active)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Notes / Shift Memo</Label>
                <Input
                  placeholder="e.g. Standard clean job #1042, extra 30m overtime"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setManualModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                Save & Log Hours
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit / Adjust Timesheet Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Pencil className="h-5 w-5 text-indigo-600" />
                Adjust Timesheet Entry
              </DialogTitle>
              <DialogDescription>
                Modify recorded shift hours for {selectedTimesheet?.employee?.full_name || 'Staff'}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label className="text-xs font-semibold">Work Date</Label>
                <Input
                  type="date"
                  value={editForm.work_date}
                  onChange={(e) => setEditForm({ ...editForm, work_date: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Clock In Time</Label>
                  <Input
                    type="time"
                    value={editForm.clock_in_time}
                    onChange={(e) => setEditForm({ ...editForm, clock_in_time: e.target.value })}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Clock Out Time</Label>
                  <Input
                    type="time"
                    value={editForm.clock_out_time}
                    onChange={(e) => setEditForm({ ...editForm, clock_out_time: e.target.value })}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Total Minutes</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Minutes worked"
                    value={editForm.total_minutes}
                    onChange={(e) => setEditForm({ ...editForm, total_minutes: e.target.value })}
                    className="mt-1 font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {editForm.total_minutes ? `${(parseInt(editForm.total_minutes, 10) / 60 || 0).toFixed(2)} hours` : 'Auto-calc from times'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(val) => setEditForm({ ...editForm, status: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">🟢 Open (Clocked In)</SelectItem>
                      <SelectItem value="completed">🟡 Needs Review</SelectItem>
                      <SelectItem value="approved">✅ Approved</SelectItem>
                      <SelectItem value="rejected">❌ Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Adjustment Notes / Memo</Label>
                <Input
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="mt-1 text-xs"
                  placeholder="Reason for adjustment"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Update Timesheet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
