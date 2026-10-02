import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, X, Building2, User, Phone, Mail } from 'lucide-react';
import { batchImportApolloLeads } from '@/lib/sales/phoneService';

/**
 * Parses raw CSV or tab-delimited text into rows of objects
 */
function parseDelimitedData(text) {
  const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Detect delimiter: comma or tab
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  // Helper to split row handling simple quotes
  const splitRow = (row) => {
    if (delimiter === '\t') return row.split('\t').map(s => s.trim().replace(/^["']|["']$/g, ''));
    
    // Comma regex taking quotes into account
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim().replace(/^["']|["']$/g, ''));
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const headers = splitRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const parsedRows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitRow(lines[i]);
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });
    parsedRows.push(rowObj);
  }

  return parsedRows;
}

/**
 * Maps Apollo-like parsed columns to our normalized lead schema
 */
function mapApolloRowToLead(row, defaultVertical = 'post_construction') {
  // Candidate field matches
  const getField = (candidates) => {
    for (const key of Object.keys(row)) {
      for (const cand of candidates) {
        if (key.includes(cand)) {
          return row[key];
        }
      }
    }
    return '';
  };

  const firstName = getField(['firstname', 'first']) || '';
  const lastName = getField(['lastname', 'last']) || '';
  const fullName = getField(['fullname', 'contactname', 'name']) || `${firstName} ${lastName}`.trim();

  const title = getField(['title', 'position', 'jobtitle', 'role', 'occupation']) || '';
  const company = getField(['company', 'organization', 'accountname', 'account', 'business']) || '';
  const phone = getField(['directphone', 'phone', 'telephonenumber', 'workphone', 'mobilephone', 'cellphone', 'mobile', 'tel']) || '';
  const email = getField(['workemail', 'email', 'contactemail', 'corporateemail']) || '';
  const city = getField(['city', 'location', 'locality', 'metro']) || 'GTA';
  const notes = getField(['industry', 'keywords', 'linkedin', 'notes', 'description']) || '';

  // Calculate default price based on vertical
  const defaultPrice = defaultVertical === 'post_construction' ? 2500 : 650;
  const defaultService = defaultVertical === 'post_construction'
    ? 'Post-Construction Rough & Final Turnover Clean'
    : 'Commercial Dumpster Steam Sanitization';

  return {
    customer_name: fullName || 'Decision Maker / PM',
    contact_title: title || '',
    company_name: company || 'Construction / Commercial Target',
    customer_phone: phone || '',
    customer_email: email || '',
    city: city || 'GTA',
    service_type: defaultService,
    quoted_price: defaultPrice,
    notes: [notes, title ? `Apollo Role: ${title}` : ''].filter(Boolean).join(' | '),
    source: 'apollo',
  };
}

export default function ApolloImporterModal({ isOpen, onClose, onImportSuccess }) {
  const [inputMode, setInputMode] = useState('paste'); // 'paste' | 'file'
  const [rawText, setRawText] = useState('');
  const [vertical, setVertical] = useState('post_construction');
  const [parsedLeads, setParsedLeads] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Process text or CSV paste
  const handleParse = (text) => {
    setErrorMsg('');
    try {
      const rawRows = parseDelimitedData(text);
      if (rawRows.length === 0) {
        setParsedLeads([]);
        return;
      }
      const mapped = rawRows.map(r => mapApolloRowToLead(r, vertical));
      setParsedLeads(mapped);
    } catch (err) {
      console.error('[ApolloImporter] Parse error:', err);
      setErrorMsg('Could not parse the provided data. Please ensure it has header columns.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setRawText(text);
        handleParse(text);
      }
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setRawText(val);
    handleParse(val);
  };

  const handleVerticalChange = (v) => {
    setVertical(v);
    if (rawText) {
      try {
        const rawRows = parseDelimitedData(rawText);
        setParsedLeads(rawRows.map(r => mapApolloRowToLead(r, v)));
      } catch (err) {
        // ignore
      }
    }
  };

  const handleExecuteImport = async () => {
    if (parsedLeads.length === 0) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const result = await batchImportApolloLeads(parsedLeads);
      if (result?.success) {
        if (onImportSuccess) onImportSuccess(result);
        onClose();
      } else {
        setErrorMsg(result?.error || 'Failed to import leads. Please try again.');
      }
    } catch (err) {
      console.error('[ApolloImporter] Import error:', err);
      setErrorMsg(err.message || 'Network error importing leads.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Metrics for parsed batch
  const totalParsed = parsedLeads.length;
  const withPhone = parsedLeads.filter(l => Boolean(l.customer_phone)).length;
  const withEmail = parsedLeads.filter(l => Boolean(l.customer_email)).length;
  const withTitle = parsedLeads.filter(l => Boolean(l.contact_title)).length;
  const missingPhone = totalParsed - withPhone;

  return (
    <div className="phone-modal-overlay" style={{ zIndex: 2500 }}>
      <div className="phone-modal-content" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-blue-900/40">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              Apollo.io Cold Call Lead Importer
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Import General Contractor PMs, Superintendents, or Facility Managers from Apollo CSV exports
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Vertical Selection */}
        <div className="mt-4">
          <label className="text-[11px] font-bold text-slate-300 block mb-1.5 uppercase tracking-wide">
            Target Vertical & Script Mapping
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition ${
                vertical === 'post_construction'
                  ? 'border-amber-500/60 bg-amber-500/10 text-white'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
              }`}
              onClick={() => handleVerticalChange('post_construction')}
            >
              <div className="mt-0.5 text-base">🔨</div>
              <div>
                <div className="text-xs font-bold text-white">Post-Construction (GCs & Builders)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  PMs, Site Supers, Estimators. Walkthrough goal, $2,500+ avg ticket.
                </div>
              </div>
            </button>

            <button
              type="button"
              className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition ${
                vertical === 'commercial'
                  ? 'border-blue-500/60 bg-blue-500/10 text-white'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
              }`}
              onClick={() => handleVerticalChange('commercial')}
            >
              <div className="mt-0.5 text-base">🏢</div>
              <div>
                <div className="text-xs font-bold text-white">Commercial Plazas & Facilities</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Property Managers & Facility Ops. Dumpster steam & floor maintenance.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Input Toggle: Paste vs File */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
              Lead Data Source
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${
                  inputMode === 'paste' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                onClick={() => setInputMode('paste')}
              >
                Copy & Paste
              </button>
              <button
                type="button"
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${
                  inputMode === 'file' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                onClick={() => setInputMode('file')}
              >
                Upload CSV
              </button>
            </div>
          </div>

          {inputMode === 'paste' ? (
            <div>
              <textarea
                className="phone-search-input"
                style={{
                  minHeight: 120,
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  padding: '10px 12px',
                  lineHeight: '1.4'
                }}
                placeholder="Paste CSV rows directly from Apollo export or spreadsheet...&#10;e.g. First Name, Last Name, Title, Company, Phone, Email&#10;Dan, Miller, Project Manager, EllisDon Construction, (416) 555-0199, dmiller@ellisdon.com"
                value={rawText}
                onChange={handleTextChange}
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-700/70 rounded-xl p-6 text-center bg-slate-900/40 hover:border-blue-500/50 transition">
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                id="apollo-csv-input"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label htmlFor="apollo-csv-input" className="cursor-pointer block">
                <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <span className="text-xs font-bold text-white block">Click to select Apollo CSV export</span>
                <span className="text-[11px] text-slate-400 block mt-1">Accepts standard .csv or .tsv exports</span>
              </label>
            </div>
          )}
        </div>

        {/* Data Quality Health Check */}
        {totalParsed > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] font-bold text-white mb-2 flex items-center justify-between">
              <span>Apollo Data Quality Health Check</span>
              <span className="text-emerald-400 font-extrabold">{totalParsed} Leads Detected</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <Phone size={14} className={withPhone > 0 ? "text-emerald-400" : "text-amber-400"} />
                <div>
                  <div className="text-xs font-bold text-white">{withPhone} / {totalParsed}</div>
                  <div className="text-[9px] text-slate-400">Direct Phone Ready</div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <User size={14} className={withTitle > 0 ? "text-blue-400" : "text-amber-400"} />
                <div>
                  <div className="text-xs font-bold text-white">{withTitle} / {totalParsed}</div>
                  <div className="text-[9px] text-slate-400">Position / Title</div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <Mail size={14} className={withEmail > 0 ? "text-indigo-400" : "text-amber-400"} />
                <div>
                  <div className="text-xs font-bold text-white">{withEmail} / {totalParsed}</div>
                  <div className="text-[9px] text-slate-400">Direct Email</div>
                </div>
              </div>
            </div>

            {missingPhone > 0 && (
              <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-amber-300/90 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                <AlertTriangle size={13} className="shrink-0" />
                <span>
                  {missingPhone} lead{missingPhone > 1 ? 's have' : ' has'} no direct phone number. Our system will flag these for HQ receptionist / switchboard lookup.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Lead Preview Table (First 4 rows) */}
        {totalParsed > 0 && (
          <div className="mt-4">
            <label className="text-[11px] font-bold text-slate-400 block mb-1">
              Preview (Showing first {Math.min(4, totalParsed)} of {totalParsed}):
            </label>
            <div className="border border-slate-800 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-2">Name & Title</th>
                    <th className="p-2">Company</th>
                    <th className="p-2">Phone</th>
                    <th className="p-2">City</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {parsedLeads.slice(0, 4).map((l, i) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      <td className="p-2">
                        <div className="font-semibold text-white">{l.customer_name}</div>
                        <div className="text-[10px] text-slate-400">{l.contact_title || 'No position tagged'}</div>
                      </td>
                      <td className="p-2 font-medium">{l.company_name}</td>
                      <td className="p-2">
                        {l.customer_phone ? (
                          <span className="text-blue-400 font-medium">{l.customer_phone}</span>
                        ) : (
                          <span className="text-amber-400/80 text-[10px]">[No Phone]</span>
                        )}
                      </td>
                      <td className="p-2 text-slate-400">{l.city}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800">
          <button
            type="button"
            className="phone-text-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="phone-call-btn"
            style={{ padding: '9px 20px', opacity: totalParsed === 0 || isSubmitting ? 0.6 : 1 }}
            disabled={totalParsed === 0 || isSubmitting}
            onClick={handleExecuteImport}
          >
            {isSubmitting ? (
              'Importing Leads...'
            ) : (
              <>
                <CheckCircle2 size={14} /> Import {totalParsed} Apollo Leads
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
