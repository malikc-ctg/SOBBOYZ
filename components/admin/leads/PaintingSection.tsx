'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Paintbrush, Info, Minus, Plus, FileText, Calculator, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  calcPainting,
  type PaintCoats,
  type PaintSupplyOption,
} from '@/lib/pricing/painting-calculator';
import { LeadContactFields, type LeadContactData } from './LeadContactFields';

interface PaintingSectionProps {
  contact: LeadContactData;
  onContactChange: (field: keyof LeadContactData, value: string) => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function StepperRow({
  label,
  sub,
  value,
  onChange,
  rate,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (v: number) => void;
  rate?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
      <div>
        <Label className="text-xs font-semibold">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{sub} {rate && <span className="font-mono text-primary font-bold">({rate})</span>}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-8 text-center text-xs font-semibold">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function PaintingSection({
  contact,
  onContactChange,
  onSuccess,
  onClose,
}: PaintingSectionProps) {
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'breakdown'>('form');
  const [standardRooms, setStandardRooms] = useState(2);
  const [largeRooms, setLargeRooms] = useState(0);
  const [bathroomsOrHallways, setBathroomsOrHallways] = useState(1);
  const [accentWalls, setAccentWalls] = useState(0);

  const [includeCeilings, setIncludeCeilings] = useState(false);
  const [includeBaseboardsTrim, setIncludeBaseboardsTrim] = useState(false);
  const [doorCount, setDoorCount] = useState(0);

  const [coats, setCoats] = useState<PaintCoats>('two_coats');
  const [paintSupply, setPaintSupply] = useState<PaintSupplyOption>('contractor_supplies');
  const [heavyDrywallPatching, setHeavyDrywallPatching] = useState(false);

  const result = useMemo(() => {
    return calcPainting({
      standardRooms,
      largeRooms,
      bathroomsOrHallways,
      accentWalls,
      includeCeilings,
      includeBaseboardsTrim,
      doorCount,
      coats,
      paintSupply,
      heavyDrywallPatching,
    });
  }, [
    standardRooms,
    largeRooms,
    bathroomsOrHallways,
    accentWalls,
    includeCeilings,
    includeBaseboardsTrim,
    doorCount,
    coats,
    paintSupply,
    heavyDrywallPatching,
  ]);

  const displayTotal = fmt(result.total);

  const handleCopy = () => {
    if (!result) return;
    const lines: string[] = ['INTERIOR & COMMERCIAL PAINTING ESTIMATE', ''];
    lines.push(`Total Rooms: ${result.roomCountTotal}`);
    lines.push(`Coats: ${coats === 'two_coats' ? '2 Coats (Full Coverage)' : '1 Coat (Refresh)'}`);
    lines.push(`Paint Materials: ${paintSupply === 'contractor_supplies' ? 'Provided by Sea of Blue' : 'Customer Supplies'}`);
    lines.push('');
    lines.push('Line Items:');
    result.breakdown.forEach((item) => {
      lines.push(` • ${item.label}: ${fmt(item.price)}`);
    });
    lines.push('—'.repeat(40));
    lines.push(`Estimated Total: ${fmt(result.total)}`);
    lines.push(`Estimated Project Duration: ~${result.estimatedDays} day(s)`);
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Painting quote copied to clipboard');
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
        `Painting Estimate — ${result.roomCountTotal} rooms (${coats === 'two_coats' ? '2 Coats' : '1 Coat'})`,
        `Supplies: ${paintSupply === 'contractor_supplies' ? 'Sea of Blue Supplies' : 'Customer Supplies'}`,
        result.breakdown.length > 0
          ? `Items: ${result.breakdown.map((b) => `${b.label} (${fmt(b.price)})`).join(', ')}`
          : null,
        `Total Quote: ${fmt(result.total)}`,
        `Est. Duration: ~${result.estimatedDays} day(s)`,
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
          service_type: 'painting',
          package_name: 'Painting',
          calculated_price: result.total,
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
          <Paintbrush className="h-4 w-4" />
          <span>Interior & Commercial Painting</span>
        </div>

        {/* 1. Room Counts */}
        <section className="space-y-3 max-w-md">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            1. Room Breakdown
          </h3>

          <StepperRow
            label="Standard Rooms"
            sub="Bedrooms, offices, dining rooms (up to 144 sqft)"
            rate="$275/room"
            value={standardRooms}
            onChange={setStandardRooms}
          />

          <StepperRow
            label="Large / Open Rooms"
            sub="Living rooms, master suites, lobbies"
            rate="$375/room"
            value={largeRooms}
            onChange={setLargeRooms}
          />

          <StepperRow
            label="Bathrooms & Hallways"
            sub="Small powder rooms, corridors, utility areas"
            rate="$165/area"
            value={bathroomsOrHallways}
            onChange={setBathroomsOrHallways}
          />

          <StepperRow
            label="Accent Walls"
            sub="Single focal walls with distinct color"
            rate="$120/wall"
            value={accentWalls}
            onChange={setAccentWalls}
          />
        </section>

        {/* 2. Surfaces & Trim */}
        <section className="space-y-3 max-w-md">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            2. Additional Surfaces & Millwork
          </h3>

          <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
            <div>
              <Label className="text-xs font-semibold">Ceilings Painting</Label>
              <p className="text-[11px] text-muted-foreground">Paint ceilings across selected rooms (+$85–$125/room)</p>
            </div>
            <Switch checked={includeCeilings} onCheckedChange={setIncludeCeilings} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
            <div>
              <Label className="text-xs font-semibold">Baseboards & Trim Detailing</Label>
              <p className="text-[11px] text-muted-foreground">Detailed trim brushwork ($55/room)</p>
            </div>
            <Switch checked={includeBaseboardsTrim} onCheckedChange={setIncludeBaseboardsTrim} />
          </div>

          <StepperRow
            label="Doors & Door Frames"
            sub="Interior doors painted both sides + frame casing"
            rate="$45/door"
            value={doorCount}
            onChange={setDoorCount}
          />

          <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
            <div>
              <Label className="text-xs font-semibold">Heavy Drywall Patching</Label>
              <p className="text-[11px] text-muted-foreground">Large holes, cracks, joint tape repair (+$75)</p>
            </div>
            <Switch checked={heavyDrywallPatching} onCheckedChange={setHeavyDrywallPatching} />
          </div>
        </section>

        {/* 3. Coats & Paint Supply */}
        <section className="space-y-3 max-w-md">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            3. Coats & Paint Supply
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Number of Coats</Label>
              <Select value={coats} onValueChange={(v) => setCoats(v as PaintCoats)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_coat" className="text-xs">1 Coat (Same color refresh)</SelectItem>
                  <SelectItem value="two_coats" className="text-xs">2 Coats (Full coverage)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Paint & Materials</Label>
              <Select value={paintSupply} onValueChange={(v) => setPaintSupply(v as PaintSupplyOption)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor_supplies" className="text-xs">We Supply Premium Paint</SelectItem>
                  <SelectItem value="customer_supplies" className="text-xs">Customer Provides Paint</SelectItem>
                </SelectContent>
              </Select>
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
              Painting Estimate
            </span>
            <h2 className="text-2xl font-extrabold text-foreground">
              {fmt(result.total)}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Est. ~{result.estimatedDays} day{result.estimatedDays > 1 ? 's' : ''} project duration
            </p>
          </div>

          <div className="space-y-2 border-t pt-3 text-xs">
            {result.breakdown.map((item) => (
              <div key={item.id} className="flex justify-between py-1 text-muted-foreground">
                <span>{item.label}</span>
                <span className="font-medium text-foreground">{fmt(item.price)}</span>
              </div>
            ))}

            <div className="border-t pt-2 flex justify-between font-bold text-sm text-foreground">
              <span>Total Price</span>
              <span>{fmt(result.total)}</span>
            </div>
          </div>

          <div className="bg-background/80 p-3 rounded-xl border text-[11px] text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <p>Estimates include surface prep, masking, floor protection tarps, and post-painting cleanup.</p>
          </div>
        </div>

        <div className="pt-4 border-t flex flex-col gap-2">
          <Button
            type="button"
            className="w-full font-bold text-sm"
            size="lg"
            disabled={result.total <= 0 || !contact.customerName.trim() || loading}
            onClick={handleGenerateLead}
          >
            {loading ? 'Generating...' : 'Generate Quote & Lead'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full text-xs"
            disabled={result.total <= 0}
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
