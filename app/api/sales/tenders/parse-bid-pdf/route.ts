import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { callClaudeSonnet, extractJsonFromClaude } from '@/lib/sales/followups/claudeClient';
import { companyKey } from '@/lib/sales/followups/company';
import { toValidServiceType, resolveCanonicalSector } from '@/lib/sales/sectorUtils';

function parseNotesJson(rawNotes: any): Record<string, any> {
  if (!rawNotes) return {};
  if (typeof rawNotes === 'object') return { ...rawNotes };
  if (typeof rawNotes === 'string') {
    const trimmed = rawNotes.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return { notes: rawNotes, rep_notes: rawNotes };
      }
    }
    return { notes: rawNotes, rep_notes: rawNotes };
  }
  return {};
}

interface ParsedBidClaudeOutput {
  project_name: string;
  company_name: string;
  customer_name: string;
  contact_title: string;
  customer_email: string;
  customer_phone: string;
  city: string;
  jobsite_address?: string;
  service_type?: string;
  bid_due_date?: string | null;
  bid_submission_time?: string | null;
  target_start_date?: string | null;
  target_completion_date?: string | null;
  sqft?: number | null;
  quoted_price?: number | null;
  phases?: string[];
  scope_summary?: string;
  specialty_scopes?: string[];
  estimated_labor_hours?: number | null;
  recommended_crew_size?: number | null;
  estimated_shifts?: number | null;
  supplies_needed?: Array<{ item_name: string; quantity: number; unit?: string }>;
  equipment_needed?: string[];
  gc_provided?: string[];
  bid_notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No proposal file (.pdf or .docx) provided in request' }, { status: 400 });
    }

    const mimeType = (file.type || '').toLowerCase();
    const fileNameLower = file.name.toLowerCase();
    const isPdf = mimeType.includes('pdf') || fileNameLower.endsWith('.pdf');
    const isDocx =
      mimeType.includes('word') ||
      mimeType.includes('officedocument') ||
      fileNameLower.endsWith('.docx') ||
      fileNameLower.endsWith('.doc');

    if (!isPdf && !isDocx) {
      return NextResponse.json(
        { error: 'Only PDF (.pdf) and Microsoft Word (.docx) proposal documents are supported.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const base64Data = fileBuffer.toString('base64');
    const nowIso = new Date().toISOString();

    const supabase = await createServiceClient();

    // 1. Upload original Bid Proposal (PDF or DOCX) to Supabase Storage
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `tender_bids/${Date.now()}_${cleanFileName}`;
    const fileContentType = isPdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    let pdfPublicUrl = '';

    try {
      const bucketName = 'documents';
      const { error: uploadErr } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, fileBuffer, {
          contentType: fileContentType,
          upsert: true,
        });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
        pdfPublicUrl = urlData?.publicUrl || '';
      } else {
        // Fallback to job_photos bucket if documents bucket not available
        const { error: fallbackErr } = await supabase.storage
          .from('job_photos')
          .upload(storagePath, fileBuffer, {
            contentType: fileContentType,
            upsert: true,
          });
        if (!fallbackErr) {
          const { data: urlData } = supabase.storage.from('job_photos').getPublicUrl(storagePath);
          pdfPublicUrl = urlData?.publicUrl || '';
        }
      }
    } catch (storageException) {
      console.warn('[ParseBidPDF] Storage upload exception, continuing:', storageException);
    }

    // 2. Call Claude 3.5 Sonnet to parse the finalized Bid Proposal
    const systemPrompt = `You are Sea of Blue's commercial tender procurement parser. Sea of Blue is a premier commercial, industrial, and post-construction cleaning contractor based in Ontario, Canada.
The user has uploaded a finalized commercial cleaning bid proposal document (PDF or Word DOCX) generated for a General Contractor or commercial client.
Carefully read the bid proposal document and extract structured JSON with exact numbers, contacts, pricing, labor hours, and materials.
Keep scope_summary concise (1-2 sentences), and limit list items to the most essential items so the response is fast and completely valid JSON.

Return ONLY a valid JSON object matching this schema with NO extra markdown formatting or conversational filler:
{
  "project_name": "string (project or building name)",
  "company_name": "string (General Contractor or commercial client firm)",
  "customer_name": "string (Estimator or primary project contact name)",
  "contact_title": "string (e.g. Senior Estimator, Project Manager)",
  "customer_email": "string (email address if specified, or empty)",
  "customer_phone": "string (phone number if specified, or empty)",
  "city": "string (GTA municipality, e.g. Toronto, Mississauga, Vaughan, Markham, Brampton)",
  "jobsite_address": "string (full address if specified)",
  "service_type": "post_construction_clean",
  "bid_due_date": "YYYY-MM-DD or null",
  "bid_submission_time": "HH:MM or null",
  "target_start_date": "YYYY-MM-DD or null",
  "target_completion_date": "YYYY-MM-DD or null",
  "sqft": 45000,
  "quoted_price": 8500.00,
  "phases": ["Rough Clean", "Final Clean"],
  "scope_summary": "Concise summary of inclusions",
  "specialty_scopes": ["Interior glass", "Floor finishing"],
  "estimated_labor_hours": 180,
  "recommended_crew_size": 4,
  "estimated_shifts": 6,
  "supplies_needed": [
    { "item_name": "Neutral Floor Cleaner", "quantity": 4, "unit": "jugs" }
  ],
  "equipment_needed": ["Commercial HEPA Vacuums"],
  "gc_provided": ["Dumpsters on site"],
  "bid_notes": "Key terms or warranties"
}

IMPORTANT RULES FOR LABOR HOURS & SUPPLIES:
1. "estimated_labor_hours" MUST ALWAYS be a positive number (> 0). If the document specifies crew size and nights/shifts across phases instead of a single total hours figure, compute total person-hours by summing (crew_size * shifts * hours_per_shift) across all phases (use 7.5 hours per shift if shift duration is not stated).
2. For "supplies_needed", always provide a concrete numeric "quantity" (e.g. 1, 2, 4) and a standard physical "unit" (e.g. "jugs", "bottles", "packs", "boxes", "units").`;

    let claudeRes;
    if (isPdf) {
      claudeRes = await callClaudeSonnet({
        model: 'claude-haiku-4-5',
        systemPrompt,
        userPrompt: `Please parse this Sea of Blue commercial cleaning bid proposal PDF and extract all fields into the requested JSON schema.`,
        maxTokens: 8192,
        documents: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data,
            },
          },
        ],
      });
    } else {
      // DOCX: Extract clean text using mammoth
      let docxText = '';
      try {
        const mammothResult = await mammoth.extractRawText({ buffer: fileBuffer });
        docxText = mammothResult.value;
      } catch (err: any) {
        console.error('[ParseBidPDF] Failed to extract text from DOCX:', err);
        return NextResponse.json(
          { error: `Failed to read Word document (.docx): ${err.message}` },
          { status: 400 }
        );
      }

      claudeRes = await callClaudeSonnet({
        model: 'claude-haiku-4-5',
        systemPrompt,
        userPrompt: `Please parse this Sea of Blue commercial cleaning bid proposal Word document (.docx) and extract all fields into the requested JSON schema.\n\n--- DOCUMENT CONTENT ---\n${docxText}`,
        maxTokens: 8192,
      });
    }

    let parsed: ParsedBidClaudeOutput;
    try {
      parsed = extractJsonFromClaude<ParsedBidClaudeOutput>(claudeRes.text);
    } catch (parseErr: any) {
      console.error('[ParseBidPDF] Claude returned unparseable text:', claudeRes.text);
      return NextResponse.json(
        { error: `Could not parse structured bid proposal: ${parseErr.message}` },
        { status: 422 }
      );
    }

    // 3. Auto-Match with Existing Company Records & Vendor Lists
    const rawCompanyName = parsed.company_name || 'Commercial Client';
    const cKey = companyKey(rawCompanyName);
    let matchedCompanyRecord: any = null;
    let matchedExistingCompany = false;
    let primaryContactId: string | null = null;

    if (cKey) {
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('*')
        .neq('source', 'bid_tender')
        .order('updated_at', { ascending: false });

      const matches = (existingLeads || []).filter(
        (l: any) => companyKey(l.company_name) === cKey
      );

      if (matches.length > 0) {
        matchedExistingCompany = true;
        // Prioritize contact whose name or email matches
        const contactMatch = matches.find(
          (m: any) =>
            (parsed.customer_email && m.customer_email?.toLowerCase() === parsed.customer_email.toLowerCase()) ||
            (parsed.customer_name && m.customer_name?.toLowerCase().includes(parsed.customer_name.toLowerCase()))
        );
        matchedCompanyRecord = contactMatch || matches[0];
        primaryContactId = String(matchedCompanyRecord.id);
      }
    }

    // 4. Auto-Match with Cleaner Labor & Wages (employees table)
    let avgHourlyWage = 25.0; // fallback standard
    let activeCleanerCount = 0;
    try {
      const { data: activeEmployees } = await supabase
        .from('employees')
        .select('id, hourly_wage, notes')
        .eq('status', 'active');

      if (activeEmployees && activeEmployees.length > 0) {
        activeCleanerCount = activeEmployees.length;
        const totalWages = activeEmployees.reduce((acc: number, emp: any) => {
          let w = 25.0;
          if (emp.hourly_wage && !isNaN(Number(emp.hourly_wage))) {
            w = Number(emp.hourly_wage);
          } else if (emp.notes) {
            try {
              const p = JSON.parse(emp.notes);
              if (p.hourly_wage && !isNaN(Number(p.hourly_wage))) w = Number(p.hourly_wage);
            } catch {}
          }
          return acc + w;
        }, 0);
        avgHourlyWage = Math.round((totalWages / activeEmployees.length) * 100) / 100;
      }
    } catch (empErr) {
      console.warn('[ParseBidPDF] Error fetching employees for wage calculation:', empErr);
    }

    const recommendedCrew = Number(parsed.recommended_crew_size) > 0 ? Number(parsed.recommended_crew_size) : 3;
    const rawShifts = Number(parsed.estimated_shifts) > 0 ? Number(parsed.estimated_shifts) : 0;
    const sqftVal = Number(parsed.sqft) > 0 ? Number(parsed.sqft) : 0;
    const bidAmount = Number(parsed.quoted_price) || 0;

    let estHours = Number(parsed.estimated_labor_hours) || 0;
    if (estHours <= 0) {
      if (rawShifts > 0) {
        estHours = Math.round(rawShifts * recommendedCrew * 7.5);
      } else if (bidAmount > 0) {
        estHours = Math.max(4, Math.round(bidAmount / 55));
      } else if (sqftVal > 0) {
        estHours = Math.max(4, Math.round(sqftVal / 350));
      }
    }

    const estShifts = rawShifts > 0 ? rawShifts : Math.max(1, Math.ceil(estHours / (recommendedCrew * 7.5)));
    const estLaborCost = Math.round(estHours * avgHourlyWage * 100) / 100;
    const estGrossProfit = bidAmount > 0 ? Math.round((bidAmount - estLaborCost) * 100) / 100 : 0;
    const estMarginPct = bidAmount > 0 ? Math.round((estGrossProfit / bidAmount) * 1000) / 10 : 0;

    // 5. Auto-Match with Enterprise Supply Inventory (supply_inventory & supply_items)
    const suppliesWithInventory: any[] = [];
    try {
      const { data: stockItems } = await supabase
        .from('supply_items')
        .select('id, name, unit, cost_per_unit, category, subcategory, supply_inventory(quantity_on_hand)')
        .eq('is_active', true);

      const itemsList = (stockItems || []).map((it: any) => {
        const invList = Array.isArray(it.supply_inventory) ? it.supply_inventory : [];
        const onHand = invList.reduce((acc: number, row: any) => acc + (Number(row.quantity_on_hand) || 0), 0);
        return { ...it, onHand };
      });

      const matchSupplyCatalogItem = (rawItemName: string) => {
        const q = (rawItemName || '').toLowerCase();
        if (!q || itemsList.length === 0) return null;

        let bestMatch: any = null;
        let bestScore = 0;

        const stopWords = new Set([
          'the', 'and', 'for', 'with', 'approved', 'contractor', 'maker', 'manufacturer',
          'commercial', 'per', 'specification', 'needed', 'compatible', 'only', 'grade',
        ]);
        const queryTokens = q
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !stopWords.has(w));

        for (const it of itemsList) {
          const nameLower = (it.name || '').toLowerCase();
          const subLower = (it.subcategory || '').toLowerCase();
          let score = 0;

          if (nameLower.includes(q) || q.includes(nameLower)) {
            score += 15;
          }

          for (const tok of queryTokens) {
            if (nameLower.includes(tok)) score += 4;
            else if (subLower.includes(tok)) score += 2;
          }

          // Domain synonym matching for commercial cleaning supplies
          if (/neutral|floor|tile|concrete|resinous|hardwood|approach/.test(q)) {
            if (/neutral ph|floor cleaner/.test(nameLower)) score += 8;
            if (/surface prep|shower tub & tile|heavy duty cleaner/.test(nameLower)) score += 7;
          }
          if (/polish|polishing|stainless/.test(q)) {
            if (/polish|bar keepers|surface prep/.test(nameLower)) score += 8;
          }
          if (/disinfect|washroom|hospital|din|sanitiz|bathroom/.test(q)) {
            if (/disinfectant|shower tub & tile/.test(nameLower)) score += 9;
          }
          if (/glass|mirror|window|streak/.test(q)) {
            if (/glass|steel wool/.test(nameLower)) score += 8;
          }
          if (/cloth|towel|microfiber|microfibre|rag|wipe|mop/.test(q)) {
            if (/microfiber|microfibre|towel|cloth|flip mop/.test(nameLower)) score += 8;
          }
          if (/scraper|blade|brush|grout|scrub/.test(q)) {
            if (/brush|scrubber|grout|steel wool/.test(nameLower)) score += 8;
          }
          if (/garbage|trash|bag|waste/.test(q)) {
            if (/trash bags/.test(nameLower)) score += 10;
          }
          if (/hepa|vacuum/.test(q)) {
            if (/hepa|vacuum/.test(nameLower)) score += 10;
          }
          if (/whmis|cleaning product/.test(q)) {
            if (/surface prep|disinfectant|heavy duty cleaner/.test(nameLower)) score += 7;
          }

          // Prefer stocked warehouse items when relevance is strong
          if (score >= 6 && it.onHand > 0) {
            score += 3;
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = it;
          }
        }

        return bestScore >= 4 ? bestMatch : null;
      };

      for (const reqSupply of parsed.supplies_needed || []) {
        const matched = matchSupplyCatalogItem(reqSupply.item_name);
        const qtyNeeded = Math.max(1, Number(reqSupply.quantity) || 1);
        const onHand = matched ? matched.onHand : 0;
        const unitCost = matched ? Number(matched.cost_per_unit) || 0 : 0;
        const inStock = Boolean(matched && onHand >= qtyNeeded);

        suppliesWithInventory.push({
          item_name: reqSupply.item_name,
          quantity_needed: qtyNeeded,
          unit: reqSupply.unit || matched?.unit || 'units',
          matched_item_id: matched?.id || null,
          matched_item_name: matched?.name || null,
          matched_name: matched?.name || null,
          quantity_on_hand: onHand,
          in_stock: inStock,
          is_in_stock: inStock,
          unit_cost: unitCost,
          estimated_cost: Math.round(unitCost * qtyNeeded * 100) / 100,
        });
      }
    } catch (supplyErr) {
      console.warn('[ParseBidPDF] Error cross-referencing supply inventory:', supplyErr);
    }

    // 6. Build Rich Tender Record Payload
    const tenderMeta = {
      project_name: parsed.project_name || 'Commercial Construction Clean Bid',
      pdf_url: pdfPublicUrl,
      pdf_public_url: pdfPublicUrl,
      pdf_storage_path: storagePath,
      document_url: pdfPublicUrl,
      document_type: isPdf ? 'pdf' : 'docx',
      file_name: file.name,
      file_size_bytes: file.size,
      jobsite_address: parsed.jobsite_address || '',
      bid_due_date: parsed.bid_due_date || null,
      bid_submission_time: parsed.bid_submission_time || null,
      target_start_date: parsed.target_start_date || null,
      target_completion_date: parsed.target_completion_date || null,
      bid_status: 'bid_submitted',
      scope_summary: parsed.scope_summary || '',
      phases: parsed.phases || ['Rough Clean', 'Final Clean'],
      specialty_scopes: parsed.specialty_scopes || [],
      equipment_needed: parsed.equipment_needed || [],
      gc_provided: parsed.gc_provided || [],
      bid_notes: parsed.bid_notes || '',
      parent_lead_id: primaryContactId,
      matched_company_key: cKey,
      matched_existing_company: matchedExistingCompany,
      labor_reconciliation: {
        estimated_hours: estHours,
        recommended_crew_size: recommendedCrew,
        estimated_shifts: estShifts,
        active_cleaner_pool: activeCleanerCount,
        avg_cleaner_wage: avgHourlyWage,
        total_labor_cost: estLaborCost,
        projected_gross_profit: estGrossProfit,
        gross_margin_percentage: estMarginPct,
      },
      supply_reconciliation: suppliesWithInventory,
      imported_by: auth.full_name || auth.email || 'Sales Rep',
      imported_at: nowIso,
    };

    const notesPayload = {
      notes: parsed.scope_summary || `Bid proposal parsed from Claude ${isPdf ? 'PDF' : 'DOCX'}`,
      tender_meta: tenderMeta,
    };

    // 7. Store the Bid in the Database
    const effectiveServiceType = toValidServiceType(parsed.service_type || 'post_construction_clean');

    const { data: createdTender, error: insertErr } = await supabase
      .from('leads')
      .insert({
        source: 'bid_tender',
        company_name: rawCompanyName,
        customer_name: parsed.customer_name || 'Estimator',
        contact_title: parsed.contact_title || 'Estimator / Project Lead',
        customer_phone: parsed.customer_phone || (matchedCompanyRecord?.customer_phone || ''),
        customer_email: parsed.customer_email || (matchedCompanyRecord?.customer_email || ''),
        city: parsed.city || matchedCompanyRecord?.city || 'GTA',
        service_type: effectiveServiceType,
        preferred_date: parsed.bid_due_date ? String(parsed.bid_due_date).split('T')[0] : null,
        home_size_sqft: parsed.sqft ? parseInt(String(parsed.sqft), 10) : null,
        condition: parsed.project_name || 'Commercial Tender Bid',
        quoted_price: bidAmount > 0 ? bidAmount : null,
        notes: JSON.stringify(notesPayload),
        status: 'quoted',
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[ParseBidPDF] Error saving tender lead:', insertErr);
      throw insertErr;
    }

    // 8. If company did not exist on Vendor List, auto-roll company into Vendor Lists & Tenders
    if (!matchedExistingCompany && cKey) {
      const vendorProfile = {
        approval_status: 'submitted',
        procurement_mode: 'both',
        checklist: ['coi', 'wsib', 'profile'],
        completed_items: ['profile'],
        portal_url: '',
        procurement_email: parsed.customer_email || '',
        next_tender_date: parsed.bid_due_date || null,
        notes: `Auto-enrolled via Bid PDF: ${parsed.project_name}`,
        primary_contact_id: String(createdTender.id),
        primary_contact_name: parsed.customer_name || 'Estimator',
        logged_by: auth.full_name || 'Claude Bid Parser',
        logged_at: nowIso,
      };

      const companyIntel = {
        vendor_profile: vendorProfile,
        industry: resolveCanonicalSector(effectiveServiceType),
        sector: resolveCanonicalSector(effectiveServiceType),
      };

      await supabase.from('leads').insert({
        source: 'vendor_list',
        company_name: rawCompanyName,
        customer_name: parsed.customer_name || 'Estimator',
        contact_title: parsed.contact_title || 'Estimator / Project Lead',
        customer_phone: parsed.customer_phone || '',
        customer_email: parsed.customer_email || '',
        city: parsed.city || 'GTA',
        service_type: effectiveServiceType,
        notes: JSON.stringify(companyIntel),
        status: 'vendor_list',
      });
    }

    return NextResponse.json({
      success: true,
      tender: createdTender,
      parsed_data: parsed,
      labor_reconciliation: tenderMeta.labor_reconciliation,
      supply_reconciliation: suppliesWithInventory,
      matched_company: {
        company_name: rawCompanyName,
        company_key: cKey,
        is_existing: matchedExistingCompany,
        matched_id: primaryContactId,
      },
      pdf_url: pdfPublicUrl,
      document_url: pdfPublicUrl,
      document_type: isPdf ? 'pdf' : 'docx',
      file_name: file.name,
    });
  } catch (err: any) {
    console.error('[API /api/sales/tenders/parse-bid-pdf] Exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to parse bid proposal document' }, { status: 500 });
  }
}
