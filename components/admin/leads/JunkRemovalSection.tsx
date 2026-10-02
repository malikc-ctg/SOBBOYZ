'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Copy, Truck, Info, Minus, Plus, FileText, Calculator, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  calcJunkRemoval,
  JUNK_VOLUME_TIERS,
  type JunkVolume,
} from '@/lib/pricing/junk-removal-calculator';
import { LeadContactFields, type LeadContactData } from './LeadContactFields';

interface JunkRemovalSectionProps {
  contact: LeadContactData;
  onContactChange: (field: keyof LeadContactData, value: string) => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

export function JunkRemovalSection({
  contact,
  onContactChange,
  onSuccess,
  onClose,
}: JunkRemovalSectionProps) {
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'breakdown'>('form');
  const [volume, setVolume] = useState<JunkVolume>('quarter');
  const [heavyMaterials, setHeavyMaterials] = useState(false);
  const [stairsCount, setStairsCount] = useState(0);
  const [appliancesCount, setAppliancesCount] = useState(0);
  const [disassemblyItemCount, setDisassemblyItemCount] = useState(0);

  const result = useMemo(() => {
    return calcJunkRemoval({
      volume,
      heavyMaterials,
      stairsCount,
      appliancesCount,
      disassemblyItemCount,
    });
  }, [volume, heavyMaterials, stairsCount, appliancesCount, disassemblyItemCount]);

  const displayTotal = fmt(result.total);

  const handleCopy = () => {
    if (!result) return;
    const lines: string[] = ['JUNK REMOVAL & HAULAWAY ESTIMATE', ''];
    lines.push(`Volume: ${result.volumeLabel} (${result.volumeDescription})`);
    lines.push(`Base Pickup Rate: ${fmt(result.basePrice)}`);
    if (result.addOnBreakdown.length > 0) {
      lines.push('');
      lines.push('Modifiers & Surcharges:');
      result.addOnBreakdown.forEach((a) => {
        lines.push(` • ${a.label}: ${fmt(a.price)}`);
      });
    }
    lines.push('—'.repeat(40));
    lines.push(`Total Quote: ${fmt(result.total)}`);
    lines.push(`Estimated Time on Site: ~${result.estimatedLaborMinutes} minutes`);
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Junk removal quote copied to clipboard');
  };

  const handleGenerateLead = async () => {
    if (!contact.customerName.trim()) {
      toast.error('Customer name is required to create a lead');
      return;
    }
    if (!result) return;

    setLoading(true);
    try {
      const notes = [
        contact.companyName ? `Company: ${contact.companyName}` : null,
        `Main Contact: ${contact.customerName}${contact.contactTitle ? ` (${contact.contactTitle})` : ''}`,
        `Junk Removal — ${result.volumeLabel} (${result.volumeDescription})`,
        `Base Rate: ${fmt(result.basePrice)}`,
        result.addOnBreakdown.length > 0
          ? `Add-ons: ${result.addOnBreakdown.map((a) => `${a.label} (${fmt(a.price)})`).join(', ')}`
          : null,
        `Total Quote: ${fmt(result.total)}`,
        `Est. Labor: ~${result.estimatedLaborMinutes} min`,
      ].filter(Boolean).join(' | ');

      const res = await fetch('/api/pricing-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: contact.companyName || null,
          customer_name: contact.customerName,
          contact_title: contact.contactTitle || null,
          customer_phone: contact.customerPhone,
          customer_email: contact.customerEmail,
          address: contact.address,
          source: contact.source,
          service_type: 'junk_removal',
          package_name: 'Junk Removal',
          calculated_price: result.total,
          estimated_hours: Math.round((result.estimatedLaborMinutes / 60) * 10) / 10,
          notes,
          breakdown: result,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate quote');
      }

      toast.success('Quote generated and lead created');
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
      {/* Mobile Segmented View Switcher */}
      <div className="md:hidden border-b bg-muted/40 p-1.5 flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('form')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
            mobileTab === 'form'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>1. Service Details</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('breakdown')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
            mobileTab === 'breakdown'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calculator className="h-3.5 w-3.5" />
          <span>2. Quote Breakdown ({displayTotal})</span>
        </button>
      </div>

      {/* ── LEFT: Form ── */}
      <div
        className={`w-full md:w-[60%] overflow-y-auto overscroll-contain touch-pan-y ${
          mobileTab === 'form' ? 'flex-1' : 'hidden md:block'
        } p-4 sm:p-5 space-y-6`}
      >
        {/* Contact Information */}
        <LeadContactFields contact={contact} onChange={onContactChange} isCommercial={true} />

        <hr className="border-muted" />

        {/* Header Intro */}
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          <Truck className="h-4 w-4" />
          <span>Junk Removal & Property Cleanout</span>
        </div>

        {/* 1. Volume Tiers */}
        <section className="space-y-3">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            1. Estimated Truckload Volume
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-xl">
            {(Object.entries(JUNK_VOLUME_TIERS) as [JunkVolume, typeof JUNK_VOLUME_TIERS[JunkVolume]][]).map(
              ([key, tier]) => {
                const isSelected = volume === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVolume(key)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-border bg-card hover:bg-muted/50'
                    }`}
                  >
                    <p className="text-xs font-bold text-foreground">{tier.label}</p>
                    <p className="text-sm font-extrabold text-primary mt-1">${tier.price}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{tier.desc}</p>
                  </button>
                );
              }
            )}
          </div>
        </section>

        {/* 2. Surcharges & Access */}
        <section className="space-y-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            2. Access & Material Surcharges
          </h3>

          <div className="space-y-3 max-w-md">
            {/* Heavy Materials */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
              <div>
                <Label className="text-xs font-semibold">Heavy Dense Materials Surcharge</Label>
                <p className="text-[11px] text-muted-foreground">Drywall, tiles, bricks, plaster, concrete (+$110)</p>
              </div>
              <Switch checked={heavyMaterials} onCheckedChange={setHeavyMaterials} />
            </div>

            {/* Flights of Stairs */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
              <div>
                <Label className="text-xs font-semibold">Stairs Carry (No Elevator)</Label>
                <p className="text-[11px] text-muted-foreground">Manual carry up/down stairs ($35/flight)</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setStairsCount(Math.max(0, stairsCount - 1))}
                  disabled={stairsCount <= 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-xs font-semibold">{stairsCount}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setStairsCount(stairsCount + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Appliances with Eco Fees */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
              <div>
                <Label className="text-xs font-semibold">Appliances with Disposal Fees</Label>
                <p className="text-[11px] text-muted-foreground">Refrigerators, freezers, AC units ($45/unit)</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setAppliancesCount(Math.max(0, appliancesCount - 1))}
                  disabled={appliancesCount <= 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-xs font-semibold">{appliancesCount}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setAppliancesCount(appliancesCount + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Disassembly */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
              <div>
                <Label className="text-xs font-semibold">Furniture Disassembly Required</Label>
                <p className="text-[11px] text-muted-foreground">Beds, modular desks, exercise equipment ($40/item)</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setDisassemblyItemCount(Math.max(0, disassemblyItemCount - 1))}
                  disabled={disassemblyItemCount <= 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-xs font-semibold">{disassemblyItemCount}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setDisassemblyItemCount(disassemblyItemCount + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Bottom Action: Proceed to Quote Breakdown */}
        <div className="md:hidden pt-4 border-t">
          <Button
            type="button"
            className="w-full font-bold text-sm shadow-xs"
            size="lg"
            onClick={() => setMobileTab('breakdown')}
          >
            Review Quote Breakdown ({displayTotal}) →
          </Button>
        </div>
      </div>

      {/* ── RIGHT: Summary Card ── */}
      <div
        className={`w-full md:w-[40%] border-t md:border-t-0 md:border-l bg-muted/20 p-4 sm:p-5 flex flex-col justify-between ${
          mobileTab === 'breakdown' ? 'flex-1 overflow-y-auto overscroll-contain touch-pan-y' : 'hidden md:flex'
        }`}
      >
        <div className="space-y-4 min-h-0">
          {/* Mobile back link */}
          <div className="md:hidden mb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileTab('form')}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Service Details
            </Button>
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Junk Haulaway Estimate
            </span>
            <h2 className="text-2xl font-extrabold text-foreground">
              {fmt(result.total)}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Est. ~{result.estimatedLaborMinutes} min on-site labor
            </p>
          </div>

          <div className="space-y-2 border-t pt-3 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Base Volume ({result.volumeLabel})</span>
              <span className="font-semibold">{fmt(result.basePrice)}</span>
            </div>

            {result.addOnBreakdown.map((addon) => (
              <div key={addon.id} className="flex justify-between py-1 text-muted-foreground">
                <span>{addon.label}</span>
                <span className="font-medium text-foreground">{fmt(addon.price)}</span>
              </div>
            ))}

            <div className="border-t pt-2 flex justify-between font-bold text-sm text-foreground">
              <span>Total Price</span>
              <span>{fmt(result.total)}</span>
            </div>
          </div>

          <div className="bg-background/80 p-3 rounded-xl border text-[11px] text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <p>All junk removal pricing includes loading, sweep-up, transport, and eco-transfer station disposal fees.</p>
          </div>
        </div>

        <div className="pt-4 border-t flex flex-col gap-2">
          <Button
            type="button"
            className="w-full font-bold text-sm"
            size="lg"
            disabled={!result || !contact.customerName.trim() || loading}
            onClick={handleGenerateLead}
          >
            {loading ? 'Generating...' : 'Generate Quote & Lead'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full text-xs"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy Quote
          </Button>
        </div>
      </div>
    </div>
  );
}
