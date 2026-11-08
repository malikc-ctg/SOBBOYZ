'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Trash2, Calendar, Clock } from 'lucide-react';
import type { DayOfWeek, TimeWindow } from '@/types';

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WINDOWS: TimeWindow[] = ['morning', 'afternoon', 'evening'];
const WINDOW_LABELS = { morning: 'AM', afternoon: 'PM', evening: 'Eve' };
const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

interface AvailabilityBlock {
  id: string;
  date: string;
  window: TimeWindow;
  reason: string;
}

export function AvailabilityModal() {
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    DAYS.forEach(d => WINDOWS.forEach(w => { initial[`${d}-${w}`] = true; }));
    return initial;
  });
  const [blockDate, setBlockDate] = useState('');
  const [blockWindow, setBlockWindow] = useState<TimeWindow>('morning');
  const [blockReason, setBlockReason] = useState('');
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAvailability = useCallback(async () => {
    try {
      const res = await fetch('/api/employees/me/availability');
      if (res.ok) {
        const data = await res.json();
        if (data.weekly_grid) setGrid(data.weekly_grid);
        if (data.blocks) setBlocks(data.blocks);
      }
    } catch (err) {
      console.error('Failed to load availability:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    if (open) {
      fetchAvailability(); 
    }
  }, [open, fetchAvailability]);

  async function toggleCell(day: DayOfWeek, window: TimeWindow) {
    const key = `${day}-${window}`;
    const newGrid = { ...grid, [key]: !grid[key] };
    setGrid(newGrid);

    // Persist immediately
    try {
      const res = await fetch('/api/employees/me/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_grid: newGrid }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success(`${DAY_LABELS[day]} ${WINDOW_LABELS[window]} ${grid[key] ? 'blocked' : 'available'}`);
    } catch {
      // Revert on failure
      setGrid(grid);
      toast.error('Failed to save change');
    }
  }

  async function addBlock() {
    if (!blockDate) { toast.error('Select a date'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/employees/me/availability/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: blockDate, window: blockWindow, reason: blockReason }),
      });
      if (!res.ok) throw new Error('Save failed');
      const newBlock = await res.json();
      setBlocks(prev => [newBlock, ...prev]);
      toast.success(`Blocked ${blockDate} ${WINDOW_LABELS[blockWindow]}`);
      setBlockDate('');
      setBlockReason('');
    } catch {
      toast.error('Failed to add block');
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(id: string) {
    try {
      const res = await fetch(`/api/employees/me/availability/blocks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setBlocks(prev => prev.filter(b => b.id !== id));
      toast.success('Block removed');
    } catch {
      toast.error('Failed to remove block');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start h-14">
          <Clock className="mr-2 h-5 w-5 text-blue-500" />
          <div className="flex flex-col items-start">
            <span className="font-semibold text-sm">Manage Availability</span>
            <span className="text-xs text-muted-foreground font-normal">Set your weekly schedule and time off</span>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Availability</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Weekly Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Grid header */}
                <div className="grid grid-cols-4 gap-1 mb-2">
                  <div />
                  {WINDOWS.map(w => (
                    <div key={w} className="text-center text-xs font-medium text-muted-foreground">
                      {WINDOW_LABELS[w]}
                    </div>
                  ))}
                </div>
                {/* Grid rows */}
                {DAYS.map(day => (
                  <div key={day} className="grid grid-cols-4 gap-1 mb-1">
                    <div className="text-sm font-medium flex items-center">{DAY_LABELS[day]}</div>
                    {WINDOWS.map(window => {
                      const key = `${day}-${window}`;
                      const available = grid[key];
                      return (
                        <button
                          key={key}
                          onClick={() => toggleCell(day, window)}
                          className={`h-10 rounded-md font-medium text-xs transition-colors ${
                            available
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {available ? '✓' : '✗'}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Block Specific Date</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Date</Label><DatePicker value={blockDate} onChange={(val) => setBlockDate(val)} className="h-10" /></div>
                <div><Label>Window</Label>
                  <Select value={blockWindow} onValueChange={v => setBlockWindow(v as TimeWindow)}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Reason (optional)</Label><Input value={blockReason} onChange={e => setBlockReason(e.target.value)} className="h-10" placeholder="e.g. Doctor's appointment" /></div>
                <Button onClick={addBlock} className="w-full h-10" disabled={saving}>
                  {saving ? 'Saving...' : 'Block Date'}
                </Button>
              </CardContent>
            </Card>

            {/* Active Blocks */}
            {blocks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Blocked Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {blocks.map(block => (
                    <div key={block.id} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{new Date(block.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                        <p className="text-xs text-muted-foreground">{WINDOW_LABELS[block.window]}{block.reason ? ` — ${block.reason}` : ''}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => removeBlock(block.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
