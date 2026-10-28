'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plus, ReceiptText, Trash2, Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { EmployeeExpense, ExpenseCategory } from '@/types';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<EmployeeExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'supplies' as ExpenseCategory,
    amount: '',
    description: ''
  });

  async function fetchExpenses() {
    try {
      const res = await fetch('/api/employees/expenses');
      if (!res.ok) throw new Error('Failed to load expenses');
      const data = await res.json();
      setExpenses(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/employees/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Failed to save expense');
      
      toast.success('Expense saved');
      setDrawerOpen(false);
      setForm({ ...form, amount: '', description: '' });
      fetchExpenses();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return;
    try {
      const res = await fetch(`/api/employees/expenses?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete expense');
      toast.success('Expense deleted');
      fetchExpenses();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const totalThisMonth = expenses
    .filter(e => new Date(e.expense_date).getMonth() === new Date().getMonth() && new Date(e.expense_date).getFullYear() === new Date().getFullYear())
    .reduce((sum, e) => sum + e.amount, 0);

  const totalYTD = expenses
    .filter(e => new Date(e.expense_date).getFullYear() === new Date().getFullYear())
    .reduce((sum, e) => sum + e.amount, 0);

  if (loading) {
    return <div className="h-40" />;
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Log supplies, gas, and costs.</p>
        </div>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Log
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] sm:h-auto sm:max-w-lg mx-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>New Expense</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker 
                  value={form.expense_date}
                  onChange={(val) => setForm({...form, expense_date: val})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(val: any) => setForm({...form, category: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplies">Supplies</SelectItem>
                    <SelectItem value="gas">Gas / Fuel</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="maintenance">Vehicle Maintenance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    className="pl-9" 
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm({...form, amount: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Input 
                  placeholder="e.g. Microfiber cloths, Windex"
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Expense'}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">This Month</p>
            <p className="text-2xl font-bold">${totalThisMonth.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">YTD</p>
            <p className="text-2xl font-bold">${totalYTD.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-lg">Recent Expenses</h3>
        {expenses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <ReceiptText className="h-8 w-8 mb-2 opacity-50" />
              <p>No expenses logged yet</p>
            </CardContent>
          </Card>
        ) : (
          expenses.map(expense => (
            <Card key={expense.id} className="overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">${expense.amount.toFixed(2)}</span>
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {expense.category}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-col sm:flex-row sm:gap-2">
                    <span>{new Date(expense.expense_date).toLocaleDateString()}</span>
                    {expense.description && (
                      <span className="hidden sm:inline">&bull;</span>
                    )}
                    {expense.description && (
                      <span className="truncate max-w-[200px]">{expense.description}</span>
                    )}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => handleDelete(expense.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
