'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, HardHat, Info, Minus, Plus, FileText, Calculator, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  calcPostConstruction,
  POST_CONSTRUCTION_STAGE_LABELS,
  type PostConstructionStage,
} from '@/lib/pricing/post-construction-calculator';
import { LeadContactFields, type LeadContactData } from './LeadContactFields';

interface PostConstructionSectionProps {
  contact: LeadContactData;
  onContactChange: (field: keyof LeadContactData, value: string) => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

export function PostConstructionSection({
  contact,
  onContactChange,
  onSuccess,
  onClose,
}: PostConstructionSectionProps) {
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'breakdown'>('form');
  const [sqftStr, setSqftStr] = useState('1500');
  const [stage, setStage] = useState<PostConstructionStage>('final');
  const [windowScrapingCount, setWindowScrapingCount] = useState(0);
  const [hvacVentsClean, setHvacVentsClean] = useState(false);
  const [insideCabinetsDetail, setInsideCabinetsDetail] = useState(false);
  const [debrisHaulaway, setDebrisHaulaway] = useState(false);

  const sqft = sqftStr === '' ? 0 : Number(sqftStr);
  const hasValidInput = sqft > 0;

  const result = useMemo(() => {
    if (!hasValidInput) return null;
    return calcPostConstruction({
      sqft,
      stage,
      windowScrapingCount,
      hvacVentsClean,
      insideCabinetsDetail,
      debrisHaulaway,
    });
  }, [sqft, stage, windowScrapingCount, hvacVentsClean, insideCabinetsDetail, debrisHaulaway, hasValidInput]);

  const displayTotal = result ? fmt(result.total) : '$0.00';

  const handleCopy = () => {
    if (!result) return;
    const lines: string[] = ['POST-CONSTRUCTION CLEANING ESTIMATE', ''];
    lines.push(`Area: ${sqft.toLocaleString()} sqft`);
    lines.push(`Stage: ${POST_CONSTRUCTION_STAGE_LABELS[stage].label} (${POST_CONSTRUCTION_STAGE_LABELS[stage].desc})`);
    lines.push(`Base Price: ${fmt(result.stagePrice)}`);
    if (result.addOnBreakdown.length > 0) {
      lines.push('');
      lines.push('Add-Ons:');
      result.addOnBreakdown.forEach((a) => {
        lines.push(` • ${a.label}: ${fmt(a.price)}`);
      });
    }
    lines.push('—'.repeat(40));
    lines.push(`Estimated Total: ${fmt(result.total)}`);
    lines.push(`Estimated Labor: ~${result.estimatedHours} crew hours`);
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Post-construction quote copied to clipboard');
  };

  const handleGenerateLead = async () => {
    if (!contact.customerName.trim()) {
      toast.error('Customer name is required to create a lead');
      return;
    }
    if (!result) return;

    setLoading(true);
    try {
      const stageDetails = POST_CONSTRUCTION_STAGE_LABELS[stage];
      const notes = [
        contact.companyName ? `Company: ${contact.companyName}` : null,
        `Main Contact: ${contact.customerName}${contact.contactTitle ? ` (${contact.contactTitle})` : ''}`,
        `Post-Construction Turnover (${stageDetails?.label || stage})`,
        `Area: ${sqft.toLocaleString()} sqft (Base: ${fmt(result.stagePrice)})`,
        result.addOnBreakdown.length > 0
          ? `Add-ons: ${result.addOnBreakdown.map((a) => `${a.label} (${fmt(a.price)})`).join(', ')}`
          : null,
        `Estimated Total: ${fmt(result.total)}`,
        `Estimated Labor: ~${result.estimatedHours} crew hours`,
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
          service_type: 'post_construction_clean',
          package_name: 'Post-Construction Clean',
          calculated_price: result.total,
          sqft: sqft,
          estimated_hours: result.estimatedHours,
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
          <HardHat className="h-4 w-4" />
          <span>Post-Construction & Renovation Turnover</span>
        </div>

        {/* 1. Square Footage */}
        <section className="space-y-3">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            1. Area / Square Footage
          </h3>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              className="h-9 text-sm w-44"
              placeholder="e.g. 1800"
              value={sqftStr}
              onChange={(e) => setSqftStr(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">sqft ($0.45/sqft, $350 min)</span>
          </div>
        </section>

        {/* 2. Cleaning Stage */}
        <section className="space-y-3">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            2. Construction Phase
          </h3>
          <Select value={stage} onValueChange={(v) => setStage(v as PostConstructionStage)}>
            <SelectTrigger className="w-full max-w-md h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(POST_CONSTRUCTION_STAGE_LABELS).map(([key, info]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  <span className="font-semibold">{info.label}</span> — <span className="text-muted-foreground">{info.desc}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* 3. Add-Ons */}
        <section className="space-y-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            3. Specialized Trade Add-Ons
          </h3>

          <div className="space-y-3 max-w-md">
            {/* Window Paint Scraping */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
              <div>
                <Label className="text-xs font-semibold">Window Paint & Sticker Scraping</Label>
                <p className="text-[11px] text-muted-foreground">Razor scraping drywall mud/paint from glass ($12/ea)</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setWindowScrapingCount(Math.max(0, windowScrapingCount - 1))}
                  disabled={windowScrapingCount <= 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-xs font-semibold">{windowScrapingCount}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setWindowScrapingCount(windowScrapingCount + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Inside Millwork/Cabinets */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
              <div>
                <Label className="text-xs font-semibold">Millwork & Cabinet Interior Detail</Label>
                <p className="text-[11px] text-muted-foreground">Vacuum & wipe saw dust inside all new cabinetry (+$65)</p>
              </div>
              <Switch checked={insideCabinetsDetail} onCheckedChange={setInsideCabinetsDetail} />
            </div>

            {/* HVAC Registers */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
              <div>
                <Label className="text-xs font-semibold">HVAC Register & Vent Extraction</Label>
                <p className="text-[11px] text-muted-foreground">Fine drywall dust removal from vents & returns (+$45)</p>
              </div>
              <Switch checked={hvacVentsClean} onCheckedChange={setHvacVentsClean} />
            </div>

            {/* Debris Haulaway */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
              <div>
                <Label className="text-xs font-semibold">Construction Debris Bagging & Disposal</Label>
                <p className="text-[11px] text-muted-foreground">Bagging & haul-away of post-trade jobsite scrap (+$150)</p>
              </div>
              <Switch checked={debrisHaulaway} onCheckedChange={setDebrisHaulaway} />
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
              Summary Estimate
            </span>
            <h2 className="text-2xl font-extrabold text-foreground">
              {result ? fmt(result.total) : '$0.00'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {result ? `Est. ~${result.estimatedHours} crew hours` : 'Enter square footage'}
            </p>
          </div>

          {result && (
            <div className="space-y-2 border-t pt-3 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">
                  {POST_CONSTRUCTION_STAGE_LABELS[result.stage].label} ({sqft.toLocaleString()} sqft)
                </span>
                <span className="font-semibold">{fmt(result.stagePrice)}</span>
              </div>

              {result.addOnBreakdown.map((addon) => (
                <div key={addon.id} className="flex justify-between py-1 text-muted-foreground">
                  <span>{addon.label}</span>
                  <span className="font-medium text-foreground">{fmt(addon.price)}</span>
                </div>
              ))}

              <div className="border-t pt-2 flex justify-between font-bold text-sm text-foreground">
                <span>Total Quote</span>
                <span>{fmt(result.total)}</span>
              </div>
            </div>
          )}

          <div className="bg-background/80 p-3 rounded-xl border text-[11px] text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <p>Post-construction quotes include HEPA-filtration vacuuming, floor wash, and fine particulate dust wipe-down.</p>
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
            disabled={!result}
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
