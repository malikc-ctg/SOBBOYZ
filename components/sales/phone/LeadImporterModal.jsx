import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Building2, User, Phone, Mail, Layers } from 'lucide-react';
import { batchImportApolloLeads } from '@/lib/sales/phoneService';

/**
 * Normalizes keys to lowercase alphanumeric
 */
function cleanKey(k) {
  return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Extracts field value using multiple candidate substrings with exact match priority
 */
function extractField(row, candidates, options = {}) {
  const keys = Object.keys(row);
  const excludeList = (options.exclude || []).map(cleanKey);

  // Pass 1: exact match
  for (const cand of candidates) {
    const target = cleanKey(cand);
    const matched = keys.find(k => {
      const ck = cleanKey(k);
      if (excludeList.some(ex => ck.includes(ex))) return false;
      return ck === target;
    });
    if (matched && row[matched] !== undefined && row[matched] !== null && String(row[matched]).trim() !== '') {
      return String(row[matched]).trim().replace(/^['"]|['"]$/g, '');
    }
  }

  // Pass 2: substring includes match
  for (const cand of candidates) {
    const target = cleanKey(cand);
    const matched = keys.find(k => {
      const ck = cleanKey(k);
      if (excludeList.some(ex => ck.includes(ex))) return false;
      return ck.includes(target);
    });
    if (matched && row[matched] !== undefined && row[matched] !== null && String(row[matched]).trim() !== '') {
      return String(row[matched]).trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

/**
 * Maps any spreadsheet or CSV row into our structured B2B lead object
 */
function mapRowToLead(row, defaultVertical = 'post_construction') {
  const firstName = extractField(row, ['firstname', 'first']) || '';
  const lastName = extractField(row, ['lastname', 'last']) || '';
  const combinedName = (firstName && lastName) ? `${firstName} ${lastName}`.trim() : '';
  const explicitFullName = extractField(row, ['fullname', 'contactname']) || '';
  const fullName = combinedName || explicitFullName || (firstName || lastName) || extractField(row, ['name']) || 'Decision Maker';

  const title = extractField(row, ['title', 'position', 'jobtitle', 'role', 'occupation']) || '';
  const company = extractField(row, ['companyname', 'company', 'organization', 'accountname', 'account', 'business'], { exclude: ['email'] }) || 'Commercial Prospect';
  
  // Phone fields
  const workDirectPhone = extractField(row, ['workdirectphone', 'directphone', 'directline', 'workphone', 'extension', 'ext']) || '';
  const mobilePhone = extractField(row, ['mobilephone', 'cellphone', 'mobile', 'cell']) || '';
  const corporatePhone = extractField(row, ['corporatephone', 'companyphone', 'mainphone', 'hqphone', 'switchboard']) || '';
  const genericPhone = extractField(row, ['phone', 'phonenumber', 'telephone', 'tel']) || '';
  const primaryPhone = workDirectPhone || mobilePhone || genericPhone || corporatePhone || '';

  const email = extractField(row, ['email', 'workemail', 'contactemail', 'corporateemail', 'emailaddress'], { exclude: ['company', 'account'] }) || '';
  const city = extractField(row, ['city', 'companycity', 'location', 'locality', 'metro']) || 'GTA';
  const address = extractField(row, ['companyaddress', 'address', 'streetaddress', 'fulladdress']) || '';
  const seniority = extractField(row, ['seniority', 'level', 'senioritylevel']) || 'Manager';
  const departments = extractField(row, ['departments', 'department', 'dept']) || '';
  const subDepartments = extractField(row, ['subdepartments', 'subdepartment']) || '';
  const employees = extractField(row, ['employees', 'numemployees', 'numberofemployees', 'companysize']) || '';
  const revenue = extractField(row, ['annualrevenue', 'revenue', 'estrevenue']) || '';
  const industry = extractField(row, ['industry', 'sector']) || 'construction';
  const linkedin = extractField(row, ['personlinkedinurl', 'linkedinurl', 'linkedin']) || '';
  const website = extractField(row, ['website', 'companywebsite', 'domain', 'url']) || '';
  const technologies = extractField(row, ['technologies', 'tech']) || '';

  // Rich metadata package
  const intel = {
    seniority: seniority || 'Manager',
    departments,
    sub_departments: subDepartments,
    work_direct_phone: workDirectPhone,
    mobile_phone: mobilePhone,
    corporate_phone: corporatePhone,
    employees,
    annual_revenue: revenue,
    industry,
    address,
    linkedin,
    website,
    technologies: technologies.substring(0, 300)
  };

  const defaultPrice = defaultVertical === 'post_construction' ? 2500 : 650;
  const defaultService = defaultVertical === 'post_construction'
    ? 'post_construction_clean'
    : 'commercial_cleaning';

  return {
    customer_name: fullName || 'Decision Maker',
    contact_title: title || '',
    company_name: company,
    customer_phone: primaryPhone,
    customer_email: email,
    city: city,
    service_type: defaultService,
    quoted_price: defaultPrice,
    notes: JSON.stringify(intel),
    source: 'contact_import',
    status: 'new'
  };
}

export default function LeadImporterModal({ isOpen, onClose, onImportSuccess }) {
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'paste'
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [vertical, setVertical] = useState('post_construction');
  const [parsedLeads, setParsedLeads] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Process XLSX / XLS / CSV / TSV file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!jsonRows || jsonRows.length === 0) {
        setErrorMsg('The selected spreadsheet does not contain any data rows.');
        setParsedLeads([]);
        return;
      }

      const mapped = jsonRows.map(row => mapRowToLead(row, vertical));
      setParsedLeads(mapped);
    } catch (err) {
      console.error('[LeadImporter] File read error:', err);
      setErrorMsg('Failed to read file. Please ensure it is a valid .csv, .xlsx, or .xls file.');
    }
  };

  // Process text or pasted tabular data
  const handleTextChange = (e) => {
    const text = e.target.value;
    setRawText(text);
    setErrorMsg('');

    if (!text.trim()) {
      setParsedLeads([]);
      return;
    }

    try {
      const workbook = XLSX.read(text, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonRows && jsonRows.length > 0) {
        const mapped = jsonRows.map(row => mapRowToLead(row, vertical));
        setParsedLeads(mapped);
      } else {
        setParsedLeads([]);
      }
    } catch (err) {
      console.error('[LeadImporter] Text parse error:', err);
      setErrorMsg('Could not parse text. Ensure your first row contains header column titles.');
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
        setErrorMsg(result?.error || 'Failed to import leads. Please verify and try again.');
      }
    } catch (err) {
      console.error('[LeadImporter] Import exception:', err);
      setErrorMsg(err.message || 'Network error importing leads.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalParsed = parsedLeads.length;
  const withPhone = parsedLeads.filter(l => Boolean(l.customer_phone)).length;
  const withEmail = parsedLeads.filter(l => Boolean(l.customer_email)).length;
  const withTitle = parsedLeads.filter(l => Boolean(l.contact_title)).length;
  const missingPhone = totalParsed - withPhone;

  return (
    <div className="phone-modal-overlay" style={{ zIndex: 2500 }}>
      <div className="phone-modal-content" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              Import Calling Leads
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Supports .csv, .xlsx, .xls, .tsv, and spreadsheet copy-paste with automatic column mapping
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Vertical Selector */}
        <div className="mt-4">
          <label className="text-[11px] font-bold text-slate-300 block mb-1.5 uppercase tracking-wide">
            Target Service & Vertical
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition ${
                vertical === 'post_construction'
                  ? 'border-blue-500/60 bg-blue-500/10 text-white'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
              }`}
              onClick={() => setVertical('post_construction')}
            >
              <Building2 className="w-4 h-4 text-blue-400 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-white">Post-Construction (General Contractors)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  PMs, Site Supers, Estimators ($2,500 target bid).
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
              onClick={() => setVertical('commercial')}
            >
              <Layers className="w-4 h-4 text-purple-400 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-white">Commercial Facilities & Plazas</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Property Managers & Facilities Directors ($650 target).
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Input Toggle: File Upload vs Copy Paste */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
              File or Paste Input
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${
                  inputMode === 'file' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                onClick={() => setInputMode('file')}
              >
                Upload File (.csv / .xlsx)
              </button>
              <button
                type="button"
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${
                  inputMode === 'paste' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                onClick={() => setInputMode('paste')}
              >
                Copy & Paste Text
              </button>
            </div>
          </div>

          {inputMode === 'file' ? (
            <div className="border-2 border-dashed border-slate-700/70 rounded-xl p-6 text-center bg-slate-900/40 hover:border-blue-500/50 transition">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.tsv,.txt"
                id="lead-file-input"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label htmlFor="lead-file-input" className="cursor-pointer block">
                <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <span className="text-xs font-bold text-white block">
                  {fileName ? fileName : 'Click to select CSV, Excel (.xlsx, .xls), or TSV file'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Automatic field recognition for First Name, Last Name, Title, Company, Phones, Email, Seniority
                </span>
              </label>
            </div>
          ) : (
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
                placeholder="Paste CSV rows or tab-separated table...&#10;First Name, Last Name, Title, Company Name, Phone, Email, Seniority&#10;Jordan, Oats, Project Manager, Dineen Construction, 416-675-7676, joats@dineen.com, Manager"
                value={rawText}
                onChange={handleTextChange}
              />
            </div>
          )}
        </div>

        {/* Data Quality Health Check */}
        {totalParsed > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] font-bold text-white mb-2 flex items-center justify-between">
              <span>Import Summary</span>
              <span className="text-emerald-400 font-extrabold">{totalParsed} Leads Ready to Import</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <Phone size={14} className={withPhone > 0 ? "text-emerald-400" : "text-amber-400"} />
                <div>
                  <div className="text-xs font-bold text-white">{withPhone} / {totalParsed}</div>
                  <div className="text-[9px] text-slate-400">Phone Ready</div>
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
                <AlertCircle size={13} className="shrink-0" />
                <span>
                  {missingPhone} lead{missingPhone > 1 ? 's have' : ' has'} no direct phone and will use HQ switchboard.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Lead Preview Table */}
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
                        <div className="text-[10px] text-slate-400">{l.contact_title || 'No position'}</div>
                      </td>
                      <td className="p-2 font-medium">{l.company_name}</td>
                      <td className="p-2">
                        {l.customer_phone ? (
                          <span className="text-blue-400 font-medium">{l.customer_phone}</span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">No Phone</span>
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
              'Importing...'
            ) : (
              <>
                <CheckCircle2 size={14} /> Import {totalParsed} Leads
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
