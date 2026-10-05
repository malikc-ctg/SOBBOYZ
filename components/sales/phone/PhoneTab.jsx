import React, { useState, useEffect, useRef } from 'react';
import {
  fetchSalesContacts,
  updateLeadStatus,
  updateLeadContact,
  createNewPhoneLead,
  logCallEvent,
  getTodayCallStats,
  CALL_OUTCOMES
} from '@/lib/sales/phoneService';
import {
  Building2,
  Plus,
  Phone,
  MessageSquare,
  Search,
  CheckCircle2,
  Map,
  Upload,
  HardHat,
  Mail,
  User,
  Briefcase,
  AlertCircle,
  Edit3,
  Save,
  Check,
  Calendar,
  PhoneCall,
  Users,
  ExternalLink,
  ChevronRight,
  ArrowUpRight,
  Shield,
  Layers,
  Award,
  Globe,
  DollarSign,
  FileText,
  Clock,
  Info,
  KanbanSquare,
  BarChart3,
  Copy
} from 'lucide-react';
import MiroScriptEmbed, { DEFAULT_MIRO_URL } from './MiroScriptEmbed';
import LeadImporterModal from './LeadImporterModal';
import WalkthroughModal from './WalkthroughModal';
import LeadDossierModal from './LeadDossierModal';
import SalesKanbanBoard from './SalesKanbanBoard';
import RepStatsView from './RepStatsView';
import './phoneStyles.css';

/**
 * Normalizes company names to match colleagues across slight variations
 */
function normalizeCompanyName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(the|a)\s+/i, '')
    .replace(/[\s,\.\-]+/g, ' ')
    .replace(/\b(inc|ltd|corporation|corp|limited|group|llc|design build)\b/gi, '')
    .trim();
}

/**
 * Format relative timestamps (e.g. 5m ago, 2h ago, Yesterday)
 */
function formatDateRelative(dateStr) {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

/**
 * Calculates seniority ranking from 1 (entry) to 5 (executive/owner)
 */
function getSeniorityRank(seniority, position = '') {
  const s = String(seniority || '').toLowerCase();
  const p = String(position || '').toLowerCase();

  if (s.includes('owner') || p.includes('owner') || p.includes('president') || p.includes('founder') || p.includes('principal')) {
    return 5;
  }
  if (s.includes('director') || p.includes('director') || p.includes('vp') || p.includes('vice president') || p.includes('general manager')) {
    return 4;
  }
  if (s.includes('senior') || p.includes('senior project manager') || p.includes('senior construction')) {
    return 3.5;
  }
  if (s.includes('manager') || p.includes('project manager') || p.includes('superintendent') || p.includes('site supervisor') || p.includes('estimator')) {
    return 3;
  }
  if (p.includes('senior coordinator')) {
    return 2;
  }
  if (s.includes('entry') || p.includes('coordinator') || p.includes('assistant')) {
    return 1;
  }
  return 2.5;
}

function getSeniorityLabel(rank, title = '') {
  if (rank >= 5) return 'Executive / Owner';
  if (rank >= 4) return 'Project Director';
  if (rank >= 3.5) return 'Senior PM';
  if (rank >= 3) return 'Project Manager / Super';
  if (rank >= 2) return 'Senior Coordinator';
  if (rank <= 1) return 'Project Coordinator';
  return title || 'Team Member';
}

export default function PhoneTab({ user, repName, isActive }) {
  // Navigation
  // 'kanban' (Primary Full Console) | 'queue' (Dialer View) | 'miro' (Mind Map) | 'logs'
  const [subView, setSubView] = useState('kanban');
  const [filter, setFilter] = useState('all'); // all, hot, callbacks, walkthroughs, missing_info
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showImporterModal, setShowImporterModal] = useState(false);
  const [showWalkthroughModal, setShowWalkthroughModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [dossierModalContact, setDossierModalContact] = useState(null);

  // Data states
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [callStats, setCallStats] = useState({
    dials: 0,
    pickups: 0,
    noAnswers: 0,
    infoSent: 0,
    jobsWon: 0,
    totalCalls: 0,
    connects: 0,
    walkthroughs: 0,
    callbacks: 0,
    sales: 0,
    closeRate: '0.0',
    revenue: 0,
    todayCalls: []
  });

  const [copiedPhone, setCopiedPhone] = useState(false);
  const handleCopyQueuePhone = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Active Call State
  const [activeCallContact, setActiveCallContact] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [callbackDateTime, setCallbackDateTime] = useState('');
  const [inCallMiroOpen, setInCallMiroOpen] = useState(false);

  // Sale Modal state
  const [saleAmount, setSaleAmount] = useState('2500');
  const [saleServiceType, setSaleServiceType] = useState('Post-Construction Turnover Clean');

  // Double-Click Queue Inline Editing
  const [inlineEditingLeadId, setInlineEditingLeadId] = useState(null);
  const [inlineFormData, setInlineFormData] = useState({
    name: '',
    company: '',
    position: '',
    phone: '',
    email: '',
    city: '',
    status: 'new'
  });

  // Dossier Quick Edit State
  const [isEditingDossier, setIsEditingDossier] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCity, setEditCity] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // New Lead Form State
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadTitle, setNewLeadTitle] = useState('Project Manager');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCity, setNewLeadCity] = useState('');
  const [newLeadPrice, setNewLeadPrice] = useState('2500');
  const [newLeadNotes, setNewLeadNotes] = useState('');

  // Call timer interval
  const timerRef = useRef(null);

  // Load contacts & stats on mount & tab active
  useEffect(() => {
    if (!isActive) return;
    loadContacts();
    refreshStats();

    const handleSync = () => {
      refreshStats();
    };
    window.addEventListener('sync-local-events', handleSync);
    return () => window.removeEventListener('sync-local-events', handleSync);
  }, [isActive, filter]);

  // Synchronize dossier edit fields when selected contact changes
  useEffect(() => {
    if (selectedContact) {
      setEditName(selectedContact.name || '');
      setEditTitle(selectedContact.position || '');
      setEditCompany(selectedContact.company || '');
      setEditPhone(selectedContact.phone || '');
      setEditEmail(selectedContact.email || '');
      setEditCity(selectedContact.city || '');
      setIsEditingDossier(false);
      setSaveSuccessMsg(false);
    }
  }, [selectedContact]);

  // Handle live call timer
  useEffect(() => {
    if (isCalling) {
      timerRef.current = setInterval(() => {
        setCallDuration(d => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCalling]);

  async function loadContacts() {
    setLoading(true);
    try {
      const data = await fetchSalesContacts(filter);
      setContacts(data);
      if (data.length > 0) {
        if (!selectedContact || !data.some(c => c.id === selectedContact.id)) {
          setSelectedContact(data[0]);
        }
      } else {
        setSelectedContact(null);
      }
    } catch (e) {
      console.error('[PhoneTab] Error loading contacts:', e);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStats() {
    const stats = await getTodayCallStats();
    setCallStats(stats);
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Double-Click Queue Card Trigger: Opens Full Lead Card & Real Info Dossier!
  function handleQueueCardDoubleClick(contact, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    setSelectedContact(contact);
    setDossierModalContact(contact);
    setShowDossierModal(true);
  }

  // Update contact from inside LeadDossierModal
  async function handleSaveContactFromModal(contactId, updatedFields) {
    try {
      await updateLeadContact(contactId, {
        customer_name: updatedFields.name,
        company_name: updatedFields.company,
        contact_title: updatedFields.position,
        customer_phone: updatedFields.phone,
        customer_email: updatedFields.email,
        city: updatedFields.city,
        notes: updatedFields.notes,
        quoted_price: updatedFields.estimated_value
      });

      const updated = {
        ...contacts.find(c => c.id === contactId),
        ...updatedFields
      };

      setContacts(prev => prev.map(c => c.id === contactId ? updated : c));
      if (selectedContact?.id === contactId) {
        setSelectedContact(updated);
      }
      if (dossierModalContact?.id === contactId) {
        setDossierModalContact(updated);
      }
    } catch (err) {
      console.error('[PhoneTab] Save contact from modal failed:', err);
    }
  }

  async function handleSaveQueueInlineEdit(contactId) {
    try {
      await updateLeadContact(contactId, {
        customer_name: inlineFormData.name,
        company_name: inlineFormData.company,
        contact_title: inlineFormData.position,
        customer_phone: inlineFormData.phone,
        customer_email: inlineFormData.email,
        city: inlineFormData.city,
        status: inlineFormData.status
      });

      const updated = {
        ...contacts.find(c => c.id === contactId),
        name: inlineFormData.name,
        company: inlineFormData.company,
        position: inlineFormData.position,
        phone: inlineFormData.phone,
        email: inlineFormData.email,
        city: inlineFormData.city,
        status: inlineFormData.status
      };

      setContacts(prev => prev.map(c => c.id === contactId ? updated : c));
      if (selectedContact?.id === contactId) {
        setSelectedContact(updated);
      }
      setInlineEditingLeadId(null);
    } catch (err) {
      console.error('[PhoneTab] Inline edit save failed:', err);
    }
  }

  // Kanban Handlers (Any change/action made automatically counts as a Dial)
  async function handleKanbanUpdateStatus(contactId, newStatus) {
    try {
      await updateLeadStatus(contactId, newStatus);
      const contact = contacts.find(c => c.id === contactId);

      // Universal Dial Rule: Any change logs an event and increments Dials
      await logCallEvent({
        contactId: contactId,
        contactName: contact?.name || 'Contact',
        companyName: contact?.company || 'Company',
        phoneNumber: contact?.phone || '',
        city: contact?.city || 'GTA',
        callType: 'OUTBOUND',
        outcomeType: newStatus === 'won' ? 'JOB_WON' : newStatus === 'quoted' ? 'INFO_SENT' : newStatus === 'no_answer' ? 'NO_ANSWER' : 'CONVO',
        durationSeconds: 15,
        notes: `Pipeline status moved to ${newStatus}`,
        repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
        repName: repName || 'Malik',
      });

      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: newStatus } : c));
      if (selectedContact?.id === contactId) {
        setSelectedContact(prev => ({ ...prev, status: newStatus }));
      }
      refreshStats();
    } catch (err) {
      console.error('[PhoneTab] Kanban status update failed:', err);
    }
  }

  async function handleKanbanUpdateSector(contactId, newSector) {
    try {
      await updateLeadContact(contactId, { sector: newSector, service_type: newSector });
      const contact = contacts.find(c => c.id === contactId);

      // Universal Dial Rule: Sector reassignments increment Dials
      await logCallEvent({
        contactId: contactId,
        contactName: contact?.name || 'Contact',
        companyName: contact?.company || 'Company',
        phoneNumber: contact?.phone || '',
        city: contact?.city || 'GTA',
        callType: 'OUTBOUND',
        outcomeType: 'CONVO',
        durationSeconds: 10,
        notes: `Vertical reassigned to ${newSector}`,
        repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
        repName: repName || 'Malik',
      });

      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, sector: newSector, service_type: newSector } : c));
      if (selectedContact?.id === contactId) {
        setSelectedContact(prev => ({ ...prev, sector: newSector, service_type: newSector }));
      }
      refreshStats();
    } catch (err) {
      console.error('[PhoneTab] Kanban sector update failed:', err);
    }
  }

  async function handleKanbanOneClickOutcome(contact, outcomeType) {
    if (!contact) return;
    
    let newStatus = contact.status;
    let duration = 0;
    let notes = `Outcome: ${outcomeType}`;

    if (outcomeType === 'NO_ANSWER') {
      duration = 0;
      newStatus = 'no_answer';
      notes = 'Outbound call: No Answer / Rang out';
    } else if (outcomeType === 'VOICEMAIL') {
      duration = 25;
      newStatus = 'no_answer';
      notes = 'Outbound call: Left capabilities voicemail';
    } else if (outcomeType === 'CONVO') {
      duration = 60;
      newStatus = 'contacted';
      notes = 'Connected with prospect / In discussion';
    } else if (outcomeType === 'INFO_SENT' || outcomeType === 'SEND_QUOTE') {
      duration = 45;
      newStatus = 'quoted';
      notes = 'Pricing spec sheet / information sent';
    } else if (outcomeType === 'WALKTHROUGH') {
      newStatus = 'walkthrough_booked';
      notes = 'Jobsite walkthrough requested';
    } else if (outcomeType === 'JOB_WON' || outcomeType === 'SALE') {
      newStatus = 'won';
      notes = 'Contract won / Commercial job closed';
    } else if (outcomeType === 'NOT_INTERESTED') {
      newStatus = 'lost';
      notes = 'Prospect declined / not interested';
    } else if (outcomeType === 'CALLBACK') {
      newStatus = 'contacted';
      notes = 'Callback scheduled';
    }

    try {
      // 1. Update lead status in state & DB
      await updateLeadContact(contact.id, { status: newStatus });

      // 2. Log call event (This guarantees DIALS increments automatically!)
      await logCallEvent({
        contactId: contact.id,
        contactName: contact.name,
        companyName: contact.company,
        phoneNumber: contact.phone,
        city: contact.city,
        callType: 'OUTBOUND',
        outcomeType: outcomeType,
        durationSeconds: duration,
        notes: notes,
        repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
        repName: repName || 'Malik',
      });

      // 3. Update local state
      setContacts(prev => prev.map(c => {
        if (c.id === contact.id) {
          return {
            ...c,
            status: newStatus,
            times_contacted: (c.times_contacted || 0) + 1,
            last_outcome: outcomeType,
            last_contacted_at: new Date().toISOString()
          };
        }
        return c;
      }));

      if (selectedContact?.id === contact.id) {
        setSelectedContact(prev => ({
          ...prev,
          status: newStatus,
          times_contacted: (prev.times_contacted || 0) + 1,
          last_outcome: outcomeType,
          last_contacted_at: new Date().toISOString()
        }));
      }

      if (dossierModalContact?.id === contact.id) {
        setDossierModalContact(prev => ({
          ...prev,
          status: newStatus,
          times_contacted: (prev.times_contacted || 0) + 1,
          last_outcome: outcomeType,
          last_contacted_at: new Date().toISOString()
        }));
      }

      refreshStats();
    } catch (err) {
      console.error('[PhoneTab] One-click outcome error:', err);
    }
  }

  // Delete lead permanently when confirmed Out of Service
  async function handleKanbanDeleteLead(contactId) {
    if (!contactId) return;
    try {
      const contact = contacts.find(c => c.id === contactId);

      // Log dial attempt so dial count reflects the reach-out attempt
      await logCallEvent({
        contactId: contactId,
        contactName: contact?.name || 'Contact',
        companyName: contact?.company || 'Company',
        phoneNumber: contact?.phone || '',
        city: contact?.city || 'GTA',
        callType: 'OUTBOUND',
        outcomeType: 'OUT_OF_SERVICE',
        durationSeconds: 0,
        notes: 'Out of service confirmed after office line check. Lead deleted.',
        repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
        repName: repName || 'Malik',
      });

      // Call API DELETE
      const res = await fetch(`/api/sales/leads?lead_id=${contactId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to delete lead');
      }

      // Remove from state immediately
      setContacts(prev => prev.filter(c => c.id !== contactId));
      if (selectedContact?.id === contactId) setSelectedContact(null);
      if (dossierModalContact?.id === contactId) setDossierModalContact(null);
      refreshStats();
    } catch (err) {
      console.error('[PhoneTab] Delete lead failed:', err);
    }
  }

  // Dossier Quick Edit Save
  async function handleSaveDossier() {
    if (!selectedContact?.id) return;
    try {
      await updateLeadContact(selectedContact.id, {
        customer_name: editName,
        contact_title: editTitle,
        company_name: editCompany,
        customer_phone: editPhone,
        customer_email: editEmail,
        city: editCity
      });

      const updated = {
        ...selectedContact,
        name: editName,
        position: editTitle,
        company: editCompany,
        phone: editPhone,
        email: editEmail,
        city: editCity
      };
      setSelectedContact(updated);
      setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
      setIsEditingDossier(false);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 2000);
    } catch (err) {
      console.error('[PhoneTab] Dossier save failed:', err);
    }
  }

  // Launch a call to contact
  function startCall(contact, targetPhone = null) {
    const phoneToCall = targetPhone || contact.phone;
    const callingContact = { ...contact, phone: phoneToCall };

    setSelectedContact(callingContact);
    setActiveCallContact(callingContact);
    setCallDuration(0);
    setIsCalling(true);
    setCallNotes('');
    setCallbackDateTime('');
    setSaleAmount(callingContact.estimated_value ? String(callingContact.estimated_value) : '2500');
    setSaleServiceType(callingContact.service_type || 'Post-Construction Turnover Clean');

    if (phoneToCall) {
      const cleanPhone = phoneToCall.replace(/[^0-9+]/g, '');
      window.location.href = `tel:${cleanPhone}`;
    }
  }

  // End Call & Log Disposition
  async function handleDisposition(outcomeType) {
    const contactToLog = activeCallContact || selectedContact;
    if (!contactToLog) return;

    if (outcomeType === 'SALE') {
      setShowSaleModal(true);
      return;
    }

    if (outcomeType === 'WALKTHROUGH') {
      setShowWalkthroughModal(true);
      return;
    }

    await logCallEvent({
      contactId: contactToLog.id,
      contactName: contactToLog.name,
      phoneNumber: contactToLog.phone,
      city: contactToLog.city,
      callType: 'OUTBOUND',
      outcomeType: outcomeType,
      durationSeconds: callDuration,
      notes: callNotes,
      callbackTime: outcomeType === 'CALLBACK' ? callbackDateTime : null,
      repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
      repName: repName || 'Malik',
    });

    setIsCalling(false);
    setActiveCallContact(null);
    refreshStats();
    loadContacts();
  }

  // Confirm Walkthrough Booking
  async function confirmWalkthroughBooking(walkDetails) {
    const contactToLog = activeCallContact || selectedContact;
    if (!contactToLog) return;

    const fullNotes = [
      callNotes,
      `Walkthrough scheduled: ${walkDetails.walkthroughDate}`,
      `Site: ${walkDetails.siteAddress}`,
      `On-Site Contact: ${walkDetails.siteContactName} (${walkDetails.siteContactPhone})`,
      `Scope: ${walkDetails.scopePhase}`,
      walkDetails.siteNotes ? `Protocols: ${walkDetails.siteNotes}` : ''
    ].filter(Boolean).join(' | ');

    await logCallEvent({
      contactId: contactToLog.id,
      contactName: walkDetails.siteContactName || contactToLog.name,
      phoneNumber: walkDetails.siteContactPhone || contactToLog.phone,
      city: contactToLog.city,
      callType: 'OUTBOUND',
      outcomeType: 'WALKTHROUGH',
      durationSeconds: callDuration,
      notes: fullNotes,
      callbackTime: walkDetails.walkthroughDate,
      saleDetails: {
        estimated_value: walkDetails.estimatedValue,
        site_address: walkDetails.siteAddress,
        scope: walkDetails.scopePhase
      },
      repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
      repName: repName || 'Malik',
    });

    setIsCalling(false);
    setActiveCallContact(null);
    refreshStats();
    loadContacts();
  }

  // Confirm Sale
  async function confirmSale() {
    const contactToLog = activeCallContact || selectedContact;
    if (!contactToLog) return;

    await logCallEvent({
      contactId: contactToLog.id,
      contactName: contactToLog.name,
      phoneNumber: contactToLog.phone,
      city: contactToLog.city,
      callType: 'OUTBOUND',
      outcomeType: 'SALE',
      durationSeconds: callDuration,
      notes: callNotes,
      saleDetails: {
        job_total: saleAmount,
        service_type: saleServiceType,
        payment_method: 'Subcontract Invoice',
        homeowner_name: contactToLog.name
      },
      repId: user?.id || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
      repName: repName || 'Malik',
    });

    setShowSaleModal(false);
    setIsCalling(false);
    setActiveCallContact(null);
    refreshStats();
    loadContacts();
  }

  // Add new lead form submission
  async function handleAddNewLead(e) {
    e.preventDefault();
    if (!newLeadCompany && !newLeadPhone) return;

    const res = await createNewPhoneLead({
      company_name: newLeadCompany,
      customer_name: newLeadName || 'Decision Maker',
      contact_title: newLeadTitle,
      customer_phone: newLeadPhone,
      customer_email: newLeadEmail,
      city: newLeadCity || 'GTA',
      service_type: 'post_construction_clean',
      quoted_price: newLeadPrice,
      notes: newLeadNotes,
      source: 'phone_sales_os'
    });

    if (res?.success) {
      setShowAddLeadModal(false);
      setNewLeadCompany('');
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadEmail('');
      setNewLeadCity('');
      setNewLeadNotes('');
      loadContacts();
    }
  }

  // Filtered contacts based on search
  const filteredContacts = contacts.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.company || '').toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.position || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    );
  });

  // Organizational Hierarchy Calculation for Selected Contact
  const currentNormCompany = selectedContact ? normalizeCompanyName(selectedContact.company) : '';
  const colleagues = selectedContact && currentNormCompany
    ? contacts.filter(c => c.id !== selectedContact.id && normalizeCompanyName(c.company) === currentNormCompany)
    : [];

  const currentRank = selectedContact ? getSeniorityRank(selectedContact.seniority, selectedContact.position) : 2.5;
  const superiors = colleagues.filter(c => getSeniorityRank(c.seniority, c.position) > currentRank);
  const subordinates = colleagues.filter(c => getSeniorityRank(c.seniority, c.position) < currentRank);
  const peers = colleagues.filter(c => getSeniorityRank(c.seniority, c.position) === currentRank);

  return (
    <div className="phone-workspace-root font-sans">
      <div className={`phone-grid-layout ${subView === 'kanban' || subView === 'reps' ? 'full-width' : ''}`}>
        
        {/* LEFT COLUMN: Calling Queue & Leads List (Hidden in full Kanban & Reps view) */}
        {subView !== 'kanban' && subView !== 'reps' && (
          <div className="phone-panel">
          <div className="phone-panel-header">
            <div className="phone-panel-title">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Commercial Calling Queue</span>
              <span className="phone-badge">
                {loading ? 'Syncing...' : `${contacts.length} Leads`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="phone-subtab-btn"
                style={{ padding: '4px 8px', fontSize: '11px', flex: 'none', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                onClick={() => setShowImporterModal(true)}
                title="Import Leads from CSV, XLSX, or TSV"
              >
                <Upload size={12} /> Import Leads
              </button>
              <button
                className="phone-subtab-btn active"
                style={{ padding: '4px 8px', fontSize: '11px', flex: 'none' }}
                onClick={() => setShowAddLeadModal(true)}
              >
                <Plus size={12} /> Add Lead
              </button>
            </div>
          </div>

          <div style={{ padding: '14px 16px' }}>
            {/* Search Box */}
            <div className="phone-search-box">
              <Search size={14} style={{ color: '#88a2c0', marginLeft: 8, marginRight: 4 }} />
              <input
                type="text"
                className="phone-search-input"
                placeholder="Search contractor, PM, title, phone, city..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Chips Bar */}
            <div className="phone-filter-bar">
              <button
                className={`phone-filter-pill ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Leads ({contacts.length})
              </button>
              <button
                className={`phone-filter-pill ${filter === 'hot' ? 'active' : ''}`}
                onClick={() => setFilter('hot')}
              >
                Ready to Call
              </button>
              <button
                className={`phone-filter-pill ${filter === 'missing_info' ? 'active' : ''}`}
                onClick={() => setFilter('missing_info')}
                title="Contacts missing direct line or title"
              >
                Needs Info
              </button>
              <button
                className={`phone-filter-pill ${filter === 'walkthroughs' ? 'active' : ''}`}
                onClick={() => setFilter('walkthroughs')}
              >
                Walkthroughs
              </button>
              <button
                className={`phone-filter-pill ${filter === 'callbacks' ? 'active' : ''}`}
                onClick={() => setFilter('callbacks')}
              >
                Follow-ups
              </button>
            </div>

            <div className="text-[10px] text-slate-400 mb-2 font-medium flex items-center justify-between">
              <span>Double-click any lead card to quick-edit</span>
              <span>{filteredContacts.length} shown</span>
            </div>

            {/* Scrollable Lead List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#88a2c0', fontSize: '13px' }}>
                <p>Loading commercial accounts...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#88a2c0' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Building2 className="w-6 h-6" />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                  No Leads Found
                </div>
                <p style={{ fontSize: '12px', color: '#88a2c0', maxWidth: 300, margin: '0 auto 16px', lineHeight: 1.5 }}>
                  Import contacts from a CSV or Excel file or add a new general contractor to begin outreach.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    className="phone-call-btn"
                    style={{ padding: '8px 14px', fontSize: '12px' }}
                    onClick={() => setShowImporterModal(true)}
                  >
                    <Upload size={13} /> Import Spreadsheet
                  </button>
                </div>
              </div>
            ) : (
              <div className="phone-lead-list">
                {filteredContacts.map(c => {
                  const isSelected = selectedContact?.id === c.id;
                  const isLiveCalling = isCalling && activeCallContact?.id === c.id;
                  const isInlineEditing = inlineEditingLeadId === c.id;

                  // Find same company count and hierarchy
                  const normC = normalizeCompanyName(c.company);
                  const sameCompanyContacts = normC ? contacts.filter(other => other.id !== c.id && normalizeCompanyName(other.company) === normC) : [];
                  const cRank = getSeniorityRank(c.seniority, c.position);
                  const cSuperiors = sameCompanyContacts.filter(other => getSeniorityRank(other.seniority, other.position) > cRank);

                  if (isInlineEditing) {
                    return (
                      <div
                        key={c.id}
                        className="phone-lead-card selected"
                        style={{ padding: 12, cursor: 'default' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="text-[11px] font-bold text-blue-400 mb-2 flex items-center justify-between">
                          <span>Inline Quick Edit</span>
                          <button
                            type="button"
                            className="text-slate-400 hover:text-white"
                            onClick={() => setInlineEditingLeadId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            className="phone-search-input"
                            style={{ padding: '5px 8px', fontSize: '12px' }}
                            placeholder="Full Name (e.g. Kash Malik)"
                            value={inlineFormData.name}
                            onChange={e => setInlineFormData({ ...inlineFormData, name: e.target.value })}
                          />
                          <input
                            type="text"
                            className="phone-search-input"
                            style={{ padding: '5px 8px', fontSize: '12px' }}
                            placeholder="Job Title / Position (e.g. Senior PM)"
                            value={inlineFormData.position}
                            onChange={e => setInlineFormData({ ...inlineFormData, position: e.target.value })}
                          />
                          <input
                            type="text"
                            className="phone-search-input"
                            style={{ padding: '5px 8px', fontSize: '12px' }}
                            placeholder="Company Name (e.g. Harbridge & Cross)"
                            value={inlineFormData.company}
                            onChange={e => setInlineFormData({ ...inlineFormData, company: e.target.value })}
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              type="tel"
                              className="phone-search-input"
                              style={{ padding: '5px 8px', fontSize: '11px' }}
                              placeholder="Phone"
                              value={inlineFormData.phone}
                              onChange={e => setInlineFormData({ ...inlineFormData, phone: e.target.value })}
                            />
                            <input
                              type="text"
                              className="phone-search-input"
                              style={{ padding: '5px 8px', fontSize: '11px' }}
                              placeholder="City"
                              value={inlineFormData.city}
                              onChange={e => setInlineFormData({ ...inlineFormData, city: e.target.value })}
                            />
                          </div>
                          <div>
                            <input
                              type="email"
                              className="phone-search-input"
                              style={{ padding: '5px 8px', fontSize: '11px' }}
                              placeholder="Direct Email"
                              value={inlineFormData.email}
                              onChange={e => setInlineFormData({ ...inlineFormData, email: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            className="phone-text-btn"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => setInlineEditingLeadId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="phone-call-btn"
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            onClick={() => handleSaveQueueInlineEdit(c.id)}
                          >
                            Save Update
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={c.id}
                      className={`phone-lead-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedContact(c)}
                      onDoubleClick={(e) => handleQueueCardDoubleClick(c, e)}
                    >
                      {/* Top Header: Contact Name Prominent + View Card Trigger */}
                      <div className="phone-lead-top">
                        <div className="phone-lead-name">
                          <span className="truncate max-w-[190px]">{c.name || 'Decision Maker'}</span>
                          {isLiveCalling && (
                            <span style={{ color: '#10b981', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span className="phone-timer-dot" /> LIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContact(c);
                              setDossierModalContact(c);
                              setShowDossierModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition"
                            title="Double-click or click to view full real info card"
                          >
                            <FileText size={12} />
                          </button>
                          <span className="phone-lead-type-badge badge-commercial">
                            {c.city || 'GTA'}
                          </span>
                        </div>
                      </div>

                      {/* Prominent Position */}
                      <div className="phone-lead-position">
                        <span className="truncate">{c.position || 'Project Lead'}</span>
                      </div>

                      {/* Secondary Context: Company Name */}
                      <div className="phone-lead-company">
                        <Building2 size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">{c.company || 'Unknown Company'}</span>
                      </div>

                      {/* Company Colleagues Roster: WHO ARE THEY? */}
                      {sameCompanyContacts.length > 0 && (
                        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 my-1.5 space-y-1">
                          <div className="text-[10px] font-bold text-amber-300 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Users size={11} className="text-amber-400 shrink-0" />
                              <span>{sameCompanyContacts.length} Colleagues at {c.company}:</span>
                            </span>
                            {cSuperiors.length > 0 && (
                              <span className="text-[9px] text-amber-300 bg-amber-950/80 px-1 rounded border border-amber-700/50">
                                Reports to {cSuperiors[0].name}
                              </span>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {sameCompanyContacts.slice(0, 3).map(col => (
                              <div key={col.id} className="text-[10.5px] text-slate-300 flex items-center justify-between gap-1">
                                <span className="font-semibold text-slate-200 truncate">{col.name}</span>
                                <span className="text-slate-400 text-[10px] truncate max-w-[130px]">
                                  ({col.position || 'Team'})
                                </span>
                              </div>
                            ))}
                            {sameCompanyContacts.length > 3 && (
                              <div className="text-[9.5px] text-blue-400 font-semibold">
                                + {sameCompanyContacts.length - 3} more colleagues (double-click card)
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Outreach & Contact History: HOW MANY TIMES CONTACTED & WHEN */}
                      <div className="flex items-center justify-between text-[11px] my-1 pt-1.5 border-t border-slate-800/60">
                        <div className="flex items-center gap-1.5 truncate">
                          <Clock size={11} className="text-blue-400 shrink-0" />
                          <span className={c.times_contacted > 0 ? "text-blue-300 font-bold" : "text-slate-400 font-medium"}>
                            {c.times_contacted > 0 ? `Contacted ${c.times_contacted}x` : '0 Dials (Untouched)'}
                          </span>
                          {c.last_contacted_at && (
                            <span className="text-slate-400 font-mono truncate">• {formatDateRelative(c.last_contacted_at)}</span>
                          )}
                        </div>
                        {c.last_outcome ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800 shrink-0">
                            {c.last_outcome}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">New</span>
                        )}
                      </div>

                      {/* Company Touchpoint Warning if Colleague was Contacted */}
                      {c.company_times_contacted > 0 && c.times_contacted === 0 && (
                        <div className="text-[9.5px] text-amber-300/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 my-1 truncate">
                          Company called {formatDateRelative(c.company_last_contacted_at)} ({c.company_last_outcome || 'Outreach logged'})
                        </div>
                      )}

                      {/* Phone & Direct Status */}
                      <div className="flex items-center justify-between text-xs mt-1">
                        <div className="phone-lead-phone font-mono text-[12px]">
                          {c.phone ? (
                            c.phone
                          ) : (
                            <span className="text-slate-400 font-sans text-[11px]">
                              HQ Switchboard Only
                            </span>
                          )}
                        </div>
                        {c.email && (
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]">
                            {c.email}
                          </span>
                        )}
                      </div>

                      {/* Metadata Row */}
                      <div className="phone-lead-meta">
                        <span className="text-[10px] text-slate-400">{getSeniorityLabel(cRank, c.position)}</span>
                        <span className="phone-lead-val">{c.last_rep_name || (c.call_logs && c.call_logs[0]?.rep_name) || (c.times_contacted > 0 ? (c.rep_name || 'Malik') : 'Untouched')}</span>
                        <span className="uppercase text-[10px] font-bold text-slate-400">
                          {c.status === 'walkthrough_booked' ? 'Walkthrough' : c.status === 'no_answer' ? 'No Answer' : c.status || 'New'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}

        {/* RIGHT COLUMN: Active Calling Cockpit, Kanban Board & Miro Mind Map */}
        <div className="phone-panel">
          
          {/* Top Panel Header: Stats + Navigation */}
          <div style={{ padding: '16px 18px 0' }}>
            {/* Shift Context Header */}
            <div className="flex items-center justify-between gap-2 mb-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Shift Metrics:
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-950/80 border border-blue-800/80 text-blue-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Today (Resets 00:00)
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  All past shifts archived in Rep Tracking
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSubView('reps')}
                className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                title="Open Rep Performance & Shift History"
              >
                <span>Rep Breakdown</span>
                <ArrowUpRight size={12} />
              </button>
            </div>

            {/* Metric Strip (Exact 5 Stats Requested by User) */}
            <div className="phone-metrics-strip">
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#fff' }}>{callStats.dials ?? callStats.totalCalls ?? 0}</span>
                <span className="phone-metric-label">Dials</span>
              </div>
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#10b981' }}>{callStats.pickups ?? callStats.connects ?? 0}</span>
                <span className="phone-metric-label">Pick Ups</span>
              </div>
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#94a3b8' }}>{callStats.noAnswers ?? 0}</span>
                <span className="phone-metric-label">No Answer</span>
              </div>
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#38bdf8' }}>{callStats.infoSent ?? 0}</span>
                <span className="phone-metric-label">Info Sent</span>
              </div>
              <div className="phone-metric-item">
                <span className="phone-metric-num" style={{ color: '#a855f7' }}>{callStats.jobsWon ?? callStats.sales ?? 0}</span>
                <span className="phone-metric-label">Jobs Won</span>
              </div>
            </div>

            {/* Sub-view Nav Pills */}
            <div className="phone-subtabs" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <button
                className={`phone-subtab-btn ${subView === 'kanban' ? 'active' : ''}`}
                onClick={() => setSubView('kanban')}
                title="Primary Visual Kanban Console & Pipeline"
              >
                <KanbanSquare size={13} className="text-blue-400" />
                <span>Kanban Console</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'reps' || subView === 'queue' ? 'active' : ''}`}
                onClick={() => setSubView('reps')}
                title="Rep Performance & Shift History Tracking"
              >
                <BarChart3 size={13} className="text-blue-400" />
                <span>Rep Tracking</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'miro' ? 'active' : ''}`}
                onClick={() => setSubView('miro')}
                title="Interactive Miro Mind Map Script"
              >
                <Map size={13} className="text-blue-400" />
                <span>Miro Mind Map</span>
              </button>
              <button
                className={`phone-subtab-btn ${subView === 'logs' ? 'active' : ''}`}
                onClick={() => setSubView('logs')}
                title="Call History Logs"
              >
                <span>Logs ({callStats.allCalls?.length || callStats.todayCalls?.length || 0})</span>
              </button>
            </div>
          </div>

          <div className="phone-workstation-content">
            
            {/* VIEW 1: REP PERFORMANCE, SHIFT RESET & ARCHIVE TRACKING (Replaces Dialer View) */}
            {(subView === "reps" || subView === "queue") && (
              <div className="p-2 sm:p-4">
                <RepStatsView
                  initialRep="all"
                  onOpenDossier={contact => {
                    setSelectedContact(contact);
                    setDossierModalContact(contact);
                    setShowDossierModal(true);
                  }}
                />
              </div>
            )}

            {/* VIEW 2: DEDICATED MIRO MIND MAP SCRIPT VIEW */}
            {subView === 'miro' && (
              <div className="phone-scripts-card" style={{ padding: 12 }}>
                <MiroScriptEmbed />
              </div>
            )}

            {/* VIEW 3: CALL HISTORY LOGS */}
            {subView === 'logs' && (
              <div className="phone-scripts-card">
                <div className="phone-scripts-header flex items-center justify-between">
                  <span>Today&apos;s Call History</span>
                  <span className="text-xs text-slate-400">{callStats.todayCalls?.length || 0} Dials Logged</span>
                </div>

                {callStats.todayCalls.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#88a2c0', fontSize: '12px' }}>
                    No calls recorded yet today. Dial contacts from queue to build history.
                  </div>
                ) : (
                  <table className="phone-logs-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Target</th>
                        <th>Outcome</th>
                        <th>Duration</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callStats.todayCalls.map((call, idx) => (
                        <tr key={call.event_id || idx}>
                          <td>{new Date(call.timestamp || call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <strong>{call.contact_name || 'Prospect'}</strong>
                              {call.source === 'quo_webhook' && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[9px] border border-emerald-800/40">
                                  Quo VoIP
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#88a2c0' }}>{call.phone_number}</div>
                          </td>
                          <td>
                            <span className="phone-lead-type-badge badge-commercial">
                              {call.outcome_type}
                            </span>
                          </td>
                          <td>{formatDuration(call.duration_seconds || 0)}</td>
                          <td style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {call.ai_summary && (
                              <div className="mt-1 p-2 rounded bg-slate-900 border border-blue-900/40 text-[10px] text-blue-200 space-y-1">
                                <span className="font-bold text-blue-400 block uppercase text-[9px] tracking-wider">Sona AI Summary</span>
                                {Array.isArray(call.ai_summary) ? (
                                  <ul className="list-disc pl-3.5 space-y-0.5">
                                    {call.ai_summary.map((b, i) => (
                                      <li key={i}>{b}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div>{call.ai_summary}</div>
                                )}
                              </div>
                            )}
                            {call.transcript && (
                              <details className="mt-1.5 p-1.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-300">
                                <summary className="cursor-pointer font-bold text-slate-400 hover:text-slate-200">
                                  View Full Call Transcript
                                </summary>
                                <div className="mt-1.5 p-2 max-h-40 overflow-y-auto font-mono text-[10px] whitespace-pre-wrap text-slate-200 bg-slate-900/90 rounded border border-slate-800/80">
                                  {call.transcript}
                                </div>
                              </details>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* VIEW 4: VISUAL KANBAN PIPELINE & SECTOR BOARD */}
            {subView === 'kanban' && (
              <div className="p-2 sm:p-4">
                <SalesKanbanBoard
                  contacts={contacts}
                  onUpdateStatus={handleKanbanUpdateStatus}
                  onUpdateSector={handleKanbanUpdateSector}
                  onOneClickOutcome={handleKanbanOneClickOutcome}
                  onDeleteLead={handleKanbanDeleteLead}
                  onOpenImporter={() => setShowImporterModal(true)}
                  onOpenDossier={contact => {
                    setSelectedContact(contact);
                    setDossierModalContact(contact);
                    setShowDossierModal(true);
                  }}
                  onOpenWalkthrough={contact => {
                    setSelectedContact(contact);
                    setShowWalkthroughModal(true);
                  }}
                  user={user}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Walkthrough Booking Modal */}
      <WalkthroughModal
        isOpen={showWalkthroughModal}
        contact={activeCallContact || selectedContact}
        onClose={() => setShowWalkthroughModal(false)}
        onConfirm={confirmWalkthroughBooking}
      />

      {/* Lead Importer Modal (Supports CSV, XLSX, XLS, TSV) */}
      <LeadImporterModal
        isOpen={showImporterModal}
        onClose={() => setShowImporterModal(false)}
        onImportSuccess={() => {
          loadContacts();
          refreshStats();
        }}
      />

      {/* Sale Won Modal */}
      {showSaleModal && (
        <div className="phone-modal-overlay">
          <div className="phone-modal-content">
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginBottom: 8 }}>
              Cleaning Subcontract / Job Won
            </h3>
            <p style={{ fontSize: '12px', color: '#88a2c0', marginBottom: 16 }}>
              Enter the agreed trade contract value and cleaning scope to credit your commission and book the account.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                Contract / Invoice Value ($)
              </label>
              <input
                type="number"
                className="phone-search-input"
                style={{ padding: '10px 14px' }}
                value={saleAmount}
                onChange={e => setSaleAmount(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                Service Scope / Turnover Phase
              </label>
              <input
                type="text"
                className="phone-search-input"
                style={{ padding: '10px 14px' }}
                value={saleServiceType}
                onChange={e => setSaleServiceType(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="phone-text-btn"
                onClick={() => setShowSaleModal(false)}
              >
                Cancel
              </button>
              <button
                className="phone-call-btn"
                onClick={confirmSale}
              >
                Confirm Contract ($)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Lead Modal */}
      {showAddLeadModal && (
        <div className="phone-modal-overlay">
          <div className="phone-modal-content" style={{ maxWidth: 500 }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              Add Calling Target
            </h3>
            <p style={{ fontSize: '12px', color: '#88a2c0', marginBottom: 16 }}>
              Add a general contractor, project manager, or commercial account for outbound tele-sales.
            </p>

            <form onSubmit={handleAddNewLead}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Decision Maker Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="e.g. Dan Miller"
                    value={newLeadName}
                    onChange={e => setNewLeadName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Position / Role
                  </label>
                  <input
                    type="text"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="Project Manager / Owner"
                    value={newLeadTitle}
                    onChange={e => setNewLeadTitle(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  className="phone-search-input"
                  style={{ padding: '10px 14px' }}
                  placeholder="e.g. EllisDon Construction"
                  value={newLeadCompany}
                  onChange={e => setNewLeadCompany(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="(416) 555-0199"
                    value={newLeadPhone}
                    onChange={e => setNewLeadPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Direct Email
                  </label>
                  <input
                    type="email"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="dmiller@builder.ca"
                    value={newLeadEmail}
                    onChange={e => setNewLeadEmail(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    City / Territory
                  </label>
                  <input
                    type="text"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="Toronto / Mississauga"
                    value={newLeadCity}
                    onChange={e => setNewLeadCity(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                    Target Job Value ($)
                  </label>
                  <input
                    type="number"
                    className="phone-search-input"
                    style={{ padding: '10px 14px' }}
                    placeholder="2500"
                    value={newLeadPrice}
                    onChange={e => setNewLeadPrice(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#88a2c0', display: 'block', marginBottom: 4 }}>
                  Notes & Details
                </label>
                <textarea
                  className="phone-search-input"
                  style={{ padding: '8px 12px', minHeight: 60 }}
                  placeholder="Direct extension, job site location, project details..."
                  value={newLeadNotes}
                  onChange={e => setNewLeadNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="phone-text-btn"
                  onClick={() => setShowAddLeadModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="phone-call-btn"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comprehensive Lead Intel & Colleague Dossier Modal */}
      <LeadDossierModal
        isOpen={showDossierModal}
        contact={dossierModalContact || selectedContact}
        allContacts={contacts}
        onClose={() => setShowDossierModal(false)}
        onSelectContact={(c) => {
          setSelectedContact(c);
          setDossierModalContact(c);
        }}
        onStartCall={(c, phone) => {
          setSelectedContact(c);
          startCall(c, phone);
        }}
        onSaveContact={handleSaveContactFromModal}
        onUpdateOutcome={handleKanbanOneClickOutcome}
        onDeleteLead={handleKanbanDeleteLead}
        onOpenWalkthrough={(c) => {
          setSelectedContact(c);
          setShowDossierModal(false);
          setShowWalkthroughModal(true);
        }}
      />

    </div>
  );
}
