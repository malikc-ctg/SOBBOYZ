'use client';

import React, { useState } from 'react';
import { Archive, Download, CheckCircle, Calendar, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportSeasonCSV, wrapUpSeason } from '@/lib/sales/seasonService';

export default function WrapUpSeasonModal({
  isOpen,
  onClose,
  currentSeason,
  sessions = [],
  user,
  onSeasonWrappedUp
}) {
  const [endingSeasonName, setEndingSeasonName] = useState(currentSeason?.name || '2026 Window Cleaning Season');
  const [newSeasonName, setNewSeasonName] = useState('Fall Gutter & Off-Season Canvassing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  if (!isOpen) return null;

  // Compute stats of the season being completed
  let totalDoors = 0;
  let totalConvos = 0;
  let totalSales = 0;

  sessions.forEach(s => {
    totalDoors += (s.total_doors || 0);
    totalConvos += (s.total_convos || 0);
    totalSales += (s.total_sales || 0);
  });

  const closeRate = totalDoors > 0 ? ((totalSales / totalDoors) * 100).toFixed(1) : '0.0';

  const handleExport = () => {
    exportSeasonCSV(sessions, endingSeasonName);
  };

  const handleConfirmWrapUp = async () => {
    setIsSubmitting(true);
    try {
      const nextState = await wrapUpSeason({
        endingSeasonName: endingSeasonName.trim() || '2026 Window Cleaning Season',
        newSeasonName: newSeasonName.trim() || 'Active Campaign',
        repId: user?.id,
        summary: {
          doors: totalDoors,
          convos: totalConvos,
          sales: totalSales,
          closeRate
        }
      });
      if (onSeasonWrappedUp) {
        onSeasonWrappedUp(nextState);
      }
      onClose();
    } catch (err) {
      console.error('Failed to wrap up season:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#181826] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Wrap Up Season
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                  Residential KnockLog
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Window season is over. Archive current window sales and start fresh for the next campaign.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition text-lg font-bold p-1"
          >
            ×
          </button>
        </div>

        {/* Season Summary Card */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Concluding Campaign
            </span>
            <span className="font-bold text-slate-200">{endingSeasonName}</span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-900">
            <div className="bg-slate-900/80 p-2.5 rounded-lg text-center">
              <div className="text-base font-extrabold text-white">{totalDoors}</div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Doors</div>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-lg text-center">
              <div className="text-base font-extrabold text-blue-400">{totalConvos}</div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Convos</div>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-lg text-center">
              <div className="text-base font-extrabold text-emerald-400">{totalSales}</div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Sales</div>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-lg text-center">
              <div className="text-base font-extrabold text-amber-400">{closeRate}%</div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Close</div>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        {!confirmStep ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                1. Season Name Being Archived
              </label>
              <Input
                value={endingSeasonName}
                onChange={(e) => setEndingSeasonName(e.target.value)}
                placeholder="e.g. 2026 Window Cleaning Season"
                className="bg-slate-950 border-slate-800 text-white text-xs h-9"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                All window knocks and closed sessions will be safely preserved in history under this archive tag.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                2. New Campaign / Upcoming Season Name
              </label>
              <Input
                value={newSeasonName}
                onChange={(e) => setNewSeasonName(e.target.value)}
                placeholder="e.g. Fall Gutter & Off-Season Canvassing"
                className="bg-slate-950 border-slate-800 text-white text-xs h-9"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Field reps will start fresh with clean door tracking for this new season.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-9 text-xs border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 gap-1.5 font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                Export Season CSV
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-9 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setConfirmStep(true)}
                  className="h-9 text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold gap-1.5"
                >
                  Continue →
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-amber-300 block mb-0.5">Are you ready to conclude this season?</strong>
                This will archive <strong>{endingSeasonName}</strong> ({totalDoors} doors) and start <strong>{newSeasonName}</strong> fresh. Your historical data will always remain available in the Season Archive filter.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmStep(false)}
                className="h-9 text-xs text-slate-400 hover:text-white"
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmWrapUp}
                disabled={isSubmitting}
                className="h-9 text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {isSubmitting ? 'Wrapping up...' : 'Confirm & Wrap Up Season'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
