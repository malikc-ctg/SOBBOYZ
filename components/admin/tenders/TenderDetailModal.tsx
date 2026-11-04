'use client';

import React from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FileSpreadsheet,
  FileText,
  MapPin,
  Mail,
  Phone,
  Sparkles,
  Users,
  Wrench,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { SERVICE_TYPE_LABELS } from '@/types';
import type { ServiceType } from '@/types';

interface TenderDetailModalProps {
  tender: any | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (tenderId: string, newStatus: string) => void;
}

const BID_STATUS_META: Record<string, { label: string; badgeClass: string }> = {
  itb_received: {
    label: 'ITB Received / Pricing',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  site_visit: {
    label: 'Site Visit / Walkthrough',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  bid_submitted: {
    label: 'Bid Submitted',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  awarded: {
    label: 'Awarded / Won',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  not_awarded: {
    label: 'Not Awarded',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
};

export function TenderDetailModal({
  tender,
  isOpen,
  onClose,
  onStatusChange,
}: TenderDetailModalProps) {
  if (!tender) return null;

  const meta = tender.tender_meta || {};
  const rawLabor = meta.labor_reconciliation || null;
  const labor = rawLabor
    ? (() => {
        const crew = Number(rawLabor.recommended_crew_size) || 3;
        const shifts = Number(rawLabor.estimated_shifts) || 1;
        const wage = Number(rawLabor.avg_cleaner_wage) || 20;
        const hours =
          Number(rawLabor.estimated_hours) > 0
            ? Number(rawLabor.estimated_hours)
            : Math.round(crew * shifts * 7.5);
        const cost =
          Number(rawLabor.total_labor_cost) > 0
            ? Number(rawLabor.total_labor_cost)
            : Math.round(hours * wage * 100) / 100;
        const price = Number(tender.quoted_price) || 0;
        const profit =
          price > 0 && Number(rawLabor.total_labor_cost) <= 0
            ? Math.round((price - cost) * 100) / 100
            : Number(rawLabor.projected_gross_profit) || Math.max(0, price - cost);
        const margin =
          price > 0 && Number(rawLabor.total_labor_cost) <= 0
            ? Math.round((profit / price) * 1000) / 10
            : rawLabor.gross_margin_percentage ?? (price > 0 ? Math.round((profit / price) * 1000) / 10 : 0);
        return {
          ...rawLabor,
          estimated_hours: hours,
          total_labor_cost: cost,
          projected_gross_profit: profit,
          gross_margin_percentage: margin,
        };
      })()
    : null;
  const supplies = Array.isArray(meta.supply_reconciliation) ? meta.supply_reconciliation : [];
  const phases = Array.isArray(meta.phases) ? meta.phases : [];
  const specialtyScopes = Array.isArray(meta.specialty_scopes) ? meta.specialty_scopes : [];
  const equipmentNeeded = Array.isArray(meta.equipment_needed) ? meta.equipment_needed : [];
  const gcProvided = Array.isArray(meta.gc_provided) ? meta.gc_provided : [];

  const statusMeta = BID_STATUS_META[tender.bid_status] || BID_STATUS_META.itb_received;

  let formattedDueDate = 'No deadline set';
  if (tender.bid_due_date) {
    try {
      formattedDueDate = format(parseISO(tender.bid_due_date), 'MMMM d, yyyy');
    } catch {
      formattedDueDate = tender.bid_due_date;
    }
  }

  const isClaudeImport = Boolean(meta.imported_at || meta.pdf_public_url || labor || supplies.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl font-bold text-foreground">
                  {tender.project_name || 'Commercial Tender'}
                </DialogTitle>
                <Badge variant="outline" className={`text-xs font-semibold ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </Badge>
                {isClaudeImport && (
                  <Badge variant="outline" className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 text-[11px] gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    Claude Sonnet Intelligence
                  </Badge>
                )}
              </div>
              <DialogDescription className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  {tender.company_name}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  {meta.jobsite_address || tender.city || 'GTA'}
                </span>
                <span>•</span>
                <span>
                  {SERVICE_TYPE_LABELS[tender.service_type as ServiceType] || tender.service_type}
                </span>
              </DialogDescription>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs text-muted-foreground uppercase font-semibold block">Bid Amount</span>
              <span className="text-2xl font-black text-foreground">
                {tender.quoted_price ? `$${Number(tender.quoted_price).toLocaleString()}` : '—'}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-card/60 border border-border/60">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-400" />
                Bid Due Date
              </span>
              <p className="text-sm font-bold mt-1 text-foreground">{formattedDueDate}</p>
              {meta.bid_submission_time && (
                <p className="text-[10px] text-muted-foreground mt-0.5">By {meta.bid_submission_time}</p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-card/60 border border-border/60">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3 text-cyan-400" />
                Footage / Scope
              </span>
              <p className="text-sm font-bold mt-1 text-foreground">
                {tender.sqft ? `${Number(tender.sqft).toLocaleString()} sq ft` : 'Commercial'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {phases.length > 0 ? `${phases.length} Clean Phases` : 'Full Turnover'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-card/60 border border-border/60">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                Labor Plan
              </span>
              <p className="text-sm font-bold mt-1 text-foreground">
                {labor?.estimated_hours ? `${labor.estimated_hours} Hours` : 'TBD'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {labor?.recommended_crew_size ? `${labor.recommended_crew_size} Cleaners (${labor.estimated_shifts || 1} shifts)` : 'Fleet assignable'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-card/60 border border-border/60">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-amber-400" />
                Est. Gross Margin
              </span>
              <p className="text-sm font-bold mt-1 text-emerald-400">
                {labor?.gross_margin_percentage != null ? `${labor.gross_margin_percentage}%` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {labor?.projected_gross_profit ? `+$${labor.projected_gross_profit.toLocaleString()} Profit` : 'Calculated on wages'}
              </p>
            </div>
          </div>

          {/* Contact / Estimator Strip */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-foreground">
                  {tender.customer_name || 'Primary Estimator'}{' '}
                  <span className="text-muted-foreground font-normal">
                    ({tender.contact_title || 'Estimator / Project Lead'})
                  </span>
                </p>
                <div className="flex items-center gap-3 text-muted-foreground text-[11px] mt-0.5 flex-wrap">
                  {tender.customer_email && (
                    <a
                      href={`mailto:${tender.customer_email}`}
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                    >
                      <Mail className="w-3 h-3" />
                      {tender.customer_email}
                    </a>
                  )}
                  {tender.customer_phone && (
                    <a
                      href={`tel:${tender.customer_phone}`}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <Phone className="w-3 h-3" />
                      {tender.customer_phone}
                    </a>
                  )}
                  {tender.portal_url && (
                    <a
                      href={tender.portal_url.startsWith('http') ? tender.portal_url : `https://${tender.portal_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Portal / Planroom
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(meta.pdf_public_url || meta.document_url) && (
                <a
                  href={meta.document_url || meta.pdf_public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/25 text-xs font-semibold"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    View Proposal (
                    {meta.document_type === 'docx' || (meta.document_url || meta.pdf_public_url || '').toLowerCase().includes('.doc')
                      ? 'DOCX'
                      : 'PDF'}
                    )
                  </span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              )}
            </div>
          </div>

          {/* Labor Wage Reconciliation (From Database employees.hourly_wage) */}
          {labor && (
            <Card className="bg-indigo-950/20 border-indigo-500/30">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-foreground">
                      Cleaner Fleet Wage Reconciliation
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                    Reconciled with {labor.active_cleaner_pool} Active Cleaners
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Computed against live Sea of Blue cleaner fleet wages in the company database (average{' '}
                  <strong className="text-foreground">${Number(labor.avg_cleaner_wage).toFixed(2)}/hr</strong>).
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="p-2 rounded-lg bg-background/60 border border-border/60">
                    <span className="text-muted-foreground">Total Labor Hours</span>
                    <p className="font-bold text-foreground text-xs mt-0.5">{labor.estimated_hours} hrs</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-border/60">
                    <span className="text-muted-foreground">Est. Cleaner Payroll</span>
                    <p className="font-bold text-foreground text-xs mt-0.5">${labor.total_labor_cost.toLocaleString()}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-border/60">
                    <span className="text-muted-foreground">Est. Gross Margin</span>
                    <p className="font-bold text-emerald-400 text-xs mt-0.5">${labor.projected_gross_profit.toLocaleString()}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-border/60">
                    <span className="text-muted-foreground">Margin %</span>
                    <p className="font-bold text-emerald-400 text-xs mt-0.5">{labor.gross_margin_percentage}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scope Summary & Cleaning Phases */}
          <div className="space-y-2">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
              Scope of Work &amp; Cleaning Commitments
            </h4>
            <div className="p-3 rounded-xl bg-card border border-border/60 text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {tender.scope_summary || meta.scope_summary || 'Standard post-construction rough and final cleaning.'}
            </div>

            {phases.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground">Phases:</span>
                {phases.map((ph: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/25 text-[11px]">
                    {ph}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Supply Inventory Reconciliation Table */}
          {supplies.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                    Supply Inventory Reconciliation (Warehouse Stock)
                  </h4>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {supplies.filter((s: any) => s.in_stock || s.is_in_stock).length} of {supplies.length} in stock
                </span>
              </div>

              <div className="border border-border/60 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-2.5">Required Material</th>
                      <th className="p-2.5">Qty Needed</th>
                      <th className="p-2.5">Stock on Hand</th>
                      <th className="p-2.5 text-right">Inventory Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {supplies.map((item: any, idx: number) => {
                      const inStock = item.in_stock || item.is_in_stock;
                      const matchedName = item.matched_item_name || item.matched_name;
                      return (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="p-2.5 font-medium text-foreground">
                            {item.item_name}
                            {matchedName && matchedName !== item.item_name && (
                              <span className="text-[10px] text-muted-foreground block">
                                Catalog: {matchedName}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-muted-foreground">
                            {item.quantity_needed} {item.unit || 'units'}
                          </td>
                          <td className="p-2.5 text-muted-foreground">
                            {item.quantity_on_hand != null ? `${item.quantity_on_hand} available` : 'Stock unverified'}
                          </td>
                          <td className="p-2.5 text-right">
                            {inStock ? (
                              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Ready in Warehouse
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                Order Needed
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Specialty Equipment & GC Provided */}
          {(equipmentNeeded.length > 0 || gcProvided.length > 0 || specialtyScopes.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {equipmentNeeded.length > 0 && (
                <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                    Specialty Equipment Needed
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {equipmentNeeded.map((eq: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="bg-muted text-xs">
                        {eq}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {gcProvided.length > 0 && (
                <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    GC / Client Provided on Site
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {gcProvided.map((gcItem: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-xs">
                        {gcItem}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Controls & Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold">Tender Stage:</span>
              <select
                value={tender.bid_status}
                onChange={(e) => onStatusChange?.(tender.id, e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-xs font-semibold bg-background ${statusMeta.badgeClass}`}
              >
                <option value="itb_received">ITB Received / Pricing</option>
                <option value="site_visit">Site Visit / Walkthrough</option>
                <option value="bid_submitted">Bid Submitted</option>
                <option value="awarded">Awarded / Won</option>
                <option value="not_awarded">Not Awarded</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/sobadmin/leads/${tender.id}`}>
                <Button variant="outline" size="sm" className="text-xs font-semibold">
                  Open in Standard Lead View
                </Button>
              </Link>
              <Button size="sm" onClick={onClose} className="text-xs font-semibold">
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
