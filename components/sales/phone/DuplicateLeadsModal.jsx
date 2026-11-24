'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  Building2,
  User,
  Phone,
  Mail,
  Loader2,
  Sparkles,
  RefreshCw,
  Crown,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DuplicateLeadsModal({
  isOpen,
  onClose,
  scope = 'b2b', // 'b2b' | 'inbound' | 'all'
  onMerged,
}) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mergingKey, setMergingKey] = useState(null);
  const [mergingAll, setMergingAll] = useState(false);
  // Allow user to override which lead ID is primary for a given group key
  const [selectedPrimaryByGroup, setSelectedPrimaryByGroup] = useState({});

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/leads/duplicates?scope=${scope}`);
      const data = await res.json();
      if (data?.success) {
        const fetchedGroups = data.groups || [];
        setGroups(fetchedGroups);
        const initialPrimaryMap = {};
        for (const g of fetchedGroups) {
          if (g.primaryLead?.id) {
            initialPrimaryMap[g.key] = g.primaryLead.id;
          }
        }
        setSelectedPrimaryByGroup(initialPrimaryMap);
      } else {
        toast.error(data?.error || 'Failed to scan for duplicate leads');
      }
    } catch (err) {
      console.error('[DuplicateLeadsModal] Error scanning duplicates:', err);
      toast.error('Failed to scan for duplicate leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDuplicates();
    }
  }, [isOpen, scope]);

  if (!isOpen) return null;

  const totalDuplicateRows = groups.reduce(
    (acc, g) => acc + Math.max(0, (g.allLeads?.length || 1) - 1),
    0
  );

  const handleMergeGroup = async (group) => {
    const allLeads = group.allLeads || [];
    if (allLeads.length < 2) return;

    const chosenPrimaryId = selectedPrimaryByGroup[group.key] || group.primaryLead?.id || allLeads[0].id;
    const duplicateIds = allLeads
      .map((l) => l.id)
      .filter((id) => String(id) !== String(chosenPrimaryId));

    setMergingKey(group.key);
    try {
      const res = await fetch('/api/sales/leads/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge_group',
          primary_id: chosenPrimaryId,
          duplicate_ids: duplicateIds,
        }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success(`Merged ${duplicateIds.length + 1} records into 1 enriched lead`);
        setGroups((prev) => prev.filter((g) => g.key !== group.key));
        if (onMerged) onMerged(data);
      } else {
        toast.error(data?.error || 'Failed to merge duplicate group');
      }
    } catch (err) {
      console.error('[DuplicateLeadsModal] Merge group error:', err);
      toast.error('Network error while merging duplicates');
    } finally {
      setMergingKey(null);
    }
  };

  const handleMergeAll = async () => {
    if (groups.length === 0 || mergingAll) return;
    setMergingAll(true);
    try {
      const res = await fetch('/api/sales/leads/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge_all',
          scope,
        }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success(
          `Merged ${data.merged_groups} duplicate group${data.merged_groups === 1 ? '' : 's'} (${data.deleted_count} redundant record${data.deleted_count === 1 ? '' : 's'} cleaned up)`
        );
        setGroups([]);
        if (onMerged) onMerged(data);
      } else {
        toast.error(data?.error || 'Failed to merge all duplicates');
      }
    } catch (err) {
      console.error('[DuplicateLeadsModal] Merge all error:', err);
      toast.error('Network error while merging all duplicates');
    } finally {
      setMergingAll(false);
    }
  };

  const formatReasonBadge = (reason) => {
    if (reason === 'email') {
      return { label: 'Same Email', cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
    }
    if (reason === 'company_and_name') {
      return { label: 'Same Contact & Company', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
    }
    return { label: 'Same Phone Number', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  };

  return (
    <div
      className="phone-modal-overlay"
      style={{ zIndex: 2600 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !mergingAll && !mergingKey) onClose();
      }}
    >
      <div
        className="phone-modal-content"
        style={{
          maxWidth: 740,
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#001429',
          borderColor: '#1e3a5f',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <GitMerge size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Duplicate Leads Manager</span>
                {groups.length > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    {groups.length} Group{groups.length === 1 ? '' : 's'} ({totalDuplicateRows} Extra)
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Combines duplicate contacts while preserving call logs, outreach tasks, notes, and highest pipeline stage.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDuplicates}
              disabled={loading || mergingAll}
              title="Rescan leads"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-cyan-400' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-7 h-7 text-cyan-400 animate-spin mx-auto" />
              <div className="text-xs font-semibold text-slate-300">
                Scanning leads for duplicate emails, phone numbers, and contacts...
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="py-10 px-4 text-center rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="w-11 h-11 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={22} />
              </div>
              <div className="text-sm font-bold text-white">No Duplicate Leads Found</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your pipeline is clean. New CSV uploads and manual lead entries are also automatically checked for duplicates.
              </p>
            </div>
          ) : (
            <>
              {/* Top Bulk Merge Banner */}
              <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-200">
                  Found <span className="font-bold text-white">{groups.length}</span> duplicate contact cluster
                  {groups.length === 1 ? '' : 's'} with{' '}
                  <span className="font-bold text-amber-300">{totalDuplicateRows}</span> redundant row
                  {totalDuplicateRows === 1 ? '' : 's'}. Colleagues sharing an HQ number with different names are safely kept separate.
                </div>
                <button
                  type="button"
                  disabled={mergingAll || Boolean(mergingKey)}
                  onClick={handleMergeAll}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 transition shadow-lg shadow-cyan-950/50 cursor-pointer disabled:opacity-50"
                >
                  {mergingAll ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Merging All...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Auto-Merge All ({groups.length})</span>
                    </>
                  )}
                </button>
              </div>

              {/* Groups List */}
              <div className="space-y-3 max-h-[56vh] overflow-y-auto pr-1">
                {groups.map((group) => {
                  const badge = formatReasonBadge(group.reason);
                  const chosenPrimaryId =
                    selectedPrimaryByGroup[group.key] || group.primaryLead?.id;
                  const isThisMerging = mergingKey === group.key;

                  return (
                    <div
                      key={group.key}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          {group.matchedValue && (
                            <span className="text-xs font-mono text-slate-300 font-semibold">
                              {group.matchedValue}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            • {group.allLeads?.length || 2} records
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={isThisMerging || mergingAll}
                          onClick={() => handleMergeGroup(group)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/40 text-blue-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          {isThisMerging ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>Merging...</span>
                            </>
                          ) : (
                            <>
                              <GitMerge size={12} />
                              <span>Merge into Primary</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {(group.allLeads || []).map((lead) => {
                          const isPrimary = String(lead.id) === String(chosenPrimaryId);
                          return (
                            <div
                              key={lead.id}
                              onClick={() =>
                                setSelectedPrimaryByGroup((prev) => ({
                                  ...prev,
                                  [group.key]: lead.id,
                                }))
                              }
                              className={`p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer transition ${
                                isPrimary
                                  ? 'border-emerald-500/50 bg-emerald-950/20 text-white'
                                  : 'border-slate-800/90 bg-slate-900/50 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-white truncate">
                                    {lead.customer_name || 'Decision Maker'}
                                  </span>
                                  {lead.contact_title && (
                                    <span className="text-[11px] text-slate-400">
                                      ({lead.contact_title})
                                    </span>
                                  )}
                                  <span className="text-[11px] text-blue-300 font-semibold">
                                    @ {lead.company_name || 'Commercial Prospect'}
                                  </span>
                                  {isPrimary ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                                      <Crown size={10} /> Primary (Keep)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                      Will merge & remove
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                  {lead.customer_phone && (
                                    <span className="flex items-center gap-1 font-mono text-slate-300">
                                      <Phone size={11} className="text-slate-400" />
                                      {lead.customer_phone}
                                    </span>
                                  )}
                                  {lead.customer_email && (
                                    <span className="flex items-center gap-1 text-slate-300">
                                      <Mail size={11} className="text-slate-400" />
                                      {lead.customer_email}
                                    </span>
                                  )}
                                  <span>Stage: <strong className="uppercase text-slate-200">{lead.status || 'new'}</strong></span>
                                  {lead.created_at && (
                                    <span>
                                      Added: {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end mt-5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
