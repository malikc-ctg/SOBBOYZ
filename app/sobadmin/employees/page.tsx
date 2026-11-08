'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Star, Trash2, ShieldCheck, ShieldAlert, ShieldX, Eye, Check, Pencil, DollarSign, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Employee } from '@/types';
import Link from 'next/link';
import { TimesheetsTab } from '@/components/admin/employees/TimesheetsTab';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [wageModalOpen, setWageModalOpen] = useState(false);
  const [selectedEmployeeForWage, setSelectedEmployeeForWage] = useState<{ id: string; name: string; wage: number } | null>(null);
  const [newWageInput, setNewWageInput] = useState('25.00');
  const [savingWage, setSavingWage] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    hourly_wage: '25.00', max_jobs_per_day: '2',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function fetchEmployees() {
    const res = await fetch('/api/employees');
    const data = await res.json();
    setEmployees(Array.isArray(data) ? data : []);
    setLoadingEmployees(false);
  }

  useEffect(() => {
    fetchEmployees();
    fetch('/api/zones').then(r => r.json()).then(d => setZones(Array.isArray(d) ? d : []));
  }, []);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/employees/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          hourly_wage: parseFloat(form.hourly_wage) || 25.00,
          max_jobs_per_day: parseInt(form.max_jobs_per_day) || 2,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');
      
      toast.success('Employee invited! Email sent.');
      setDrawerOpen(false);
      setForm({
        full_name: '', email: '', phone: '',
        hourly_wage: '25.00', max_jobs_per_day: '2',
      });
      fetchEmployees();
    } catch (err: any) { 
      toast.error(err.message || 'Failed to invite employee'); 
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to completely delete the employee "${name}"? This action cannot be undone and will remove their ability to log in.`)) return;
    
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Employee deleted permanently');
      fetchEmployees();
    } catch {
      toast.error('Failed to delete employee');
    }
  }

  async function handleActivate(id: string, name: string) {
    if (!confirm(`Are you sure you want to activate "${name}"? They will be able to receive and accept jobs.`)) return;
    
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
      if (!res.ok) throw new Error('Failed to activate');
      toast.success('Employee activated successfully');
      fetchEmployees();
    } catch {
      toast.error('Failed to activate employee');
    }
  }

  function openWageModal(id: string, name: string, currentWage: number) {
    setSelectedEmployeeForWage({ id, name, wage: currentWage });
    setNewWageInput(currentWage.toFixed(2));
    setWageModalOpen(true);
  }

  async function handleSaveWage() {
    if (!selectedEmployeeForWage) return;
    const wageNum = parseFloat(newWageInput);
    if (isNaN(wageNum) || wageNum <= 0) {
      toast.error('Please enter a valid hourly wage');
      return;
    }
    setSavingWage(true);
    try {
      const res = await fetch(`/api/employees/${selectedEmployeeForWage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hourly_wage: wageNum })
      });
      if (!res.ok) throw new Error('Failed to update wage');
      toast.success(`Updated ${selectedEmployeeForWage.name}'s wage to $${wageNum.toFixed(2)}/hr`);
      setWageModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update wage');
    } finally {
      setSavingWage(false);
    }
  }

  function getEmployeeWage(c: Employee): number {
    let wage = 25;
    try {
      const notes = c.notes ? JSON.parse(c.notes) : {};
      if (notes.hourly_wage) wage = Number(notes.hourly_wage);
      else if ((c as any).hourly_wage) wage = Number((c as any).hourly_wage);
    } catch { /* no-op */ }
    return wage;
  }

  function statusBadgeClass(status: string) {
    return status === 'active' ? 'bg-green-100 text-green-700' : status === 'probation' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  }

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground text-sm">Manage service providers, log hours, and review timesheets</p>
        </div>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Employee</Button></SheetTrigger>
          <SheetContent className="w-full sm:w-[420px] overflow-y-auto">
            <SheetHeader><SheetTitle>New Employee</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-6">
              <div><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div>
                <Label>Hourly Wage ($/hr)</Label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground font-semibold">$</span>
                  <Input 
                    type="number" 
                    step="0.50" 
                    min="15" 
                    className="pl-7" 
                    placeholder="25.00" 
                    value={form.hourly_wage} 
                    onChange={e => setForm({ ...form, hourly_wage: e.target.value })} 
                  />
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Sending Invite...' : 'Send Invite'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-4 overflow-x-auto scrollbar-none w-full justify-start">
          <TabsTrigger value="active" className="shrink-0">Active ({employees.length})</TabsTrigger>
          <TabsTrigger value="timesheets" className="flex items-center gap-1.5 shrink-0">
            <Clock className="h-4 w-4" />
            Time Sheets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {loadingEmployees ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3.5 w-16" />
                        <Skeleton className="h-3.5 w-16" />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <Skeleton className="h-9 w-24 rounded-md" />
                        <Skeleton className="h-9 w-20 rounded-md" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : employees.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No employees yet</CardContent></Card>
            ) : employees.map(c => {
              const wage = getEmployeeWage(c);
              return (
                <Card key={c.id}>
                  <CardContent className="p-3 space-y-2">
                    <Link href={`/sobadmin/employees/${c.id}`} className="block min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium min-w-0 truncate">{c.full_name}</span>
                        <Badge variant="outline" className={`text-xs capitalize shrink-0 ${statusBadgeClass(c.status)}`}>{c.status}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {c.phone && <span className="truncate">{c.phone}</span>}
                        <span>{(c as any).zone?.name ?? '—'}</span>
                        <span className="inline-flex items-center"><Star className="h-3 w-3 mr-1 text-amber-500" />{c.score}</span>
                        <span>Supplies {c.brings_own_supplies ? '✓' : '—'}</span>
                      </div>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => openWageModal(c.id, c.full_name, wage)}
                        className="flex items-center gap-1.5 h-10 text-xs font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 px-3 rounded border border-indigo-200"
                      >
                        ${wage.toFixed(2)}/hr
                        <Pencil className="h-3 w-3" />
                      </button>
                      {c.status === 'invited' && (
                        <Button variant="ghost" size="sm" className="h-10 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleActivate(c.id, c.full_name)}>
                          <Check className="h-4 w-4 mr-1" /> Activate
                        </Button>
                      )}
                      <Link href={`/sobadmin/employees/${c.id}`} className="ml-auto">
                        <Button variant="outline" size="sm" className="h-10">View</Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(c.id, c.full_name)} aria-label="Delete employee">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Wage</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Supplies</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEmployees ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20 rounded-md ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : employees.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No employees yet</TableCell></TableRow>
                  ) : employees.map(c => {
                    const wage = getEmployeeWage(c);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.full_name}</TableCell>
                        <TableCell className="text-xs">{c.phone}</TableCell>
                        <TableCell className="text-xs">{(c as any).zone?.name ?? '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-xs capitalize ${statusBadgeClass(c.status)}`}>{c.status}</Badge></TableCell>
                        <TableCell>
                          <button
                            onClick={() => openWageModal(c.id, c.full_name, wage)}
                            className="group flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 px-2 py-1 rounded border border-indigo-200 transition-colors"
                            title="Click to edit wage"
                          >
                            ${wage.toFixed(2)}/hr
                            <Pencil className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                          </button>
                        </TableCell>
                        <TableCell className="text-xs"><Star className="h-3 w-3 inline mr-1 text-amber-500" />{c.score}</TableCell>
                        <TableCell className="text-xs">{c.brings_own_supplies ? '✓' : '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            Company Policy
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.status === 'invited' && (
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleActivate(c.id, c.full_name)}>
                                <Check className="h-4 w-4 mr-1" /> Activate
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                              onClick={() => openWageModal(c.id, c.full_name, wage)}
                            >
                              Edit Wage
                            </Button>
                            <Link href={`/sobadmin/employees/${c.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(c.id, c.full_name)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timesheets">
          <TimesheetsTab employees={employees} />
        </TabsContent>
      </Tabs>

      {/* Edit Wage Dialog */}
      <Dialog open={wageModalOpen} onOpenChange={setWageModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-indigo-600" />
              Edit Hourly Wage
            </DialogTitle>
            <DialogDescription>
              Update the base hourly compensation rate for <span className="font-semibold text-foreground">{selectedEmployeeForWage?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Hourly Wage ($/hr)</Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground font-semibold">$</span>
                <Input
                  type="number"
                  step="0.50"
                  min="15"
                  className="pl-7 text-base font-semibold"
                  placeholder="25.00"
                  value={newWageInput}
                  onChange={e => setNewWageInput(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Estimated Job Pay Breakdown:</p>
              <div className="flex justify-between">
                <span>Standard 3-hour clean:</span>
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  ${((parseFloat(newWageInput) || 0) * 3).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Full 8-hour workday:</span>
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  ${((parseFloat(newWageInput) || 0) * 8).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWageModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWage} disabled={savingWage} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {savingWage ? 'Saving...' : 'Save Wage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
