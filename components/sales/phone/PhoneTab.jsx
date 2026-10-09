import React, { useState, useEffect, useRef } from 'react';
import {
  fetchSalesContacts,
  updateLeadContact,
  createNewPhoneLead,
  logCallEvent,
  getTodayCallStats,
  normalizeRepName,
} from '@/lib/sales/phoneService';
import { nextLeadStatus } from '@/lib/sales/followups/leadStatus';
import { toast } from 'sonner';

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
  Copy,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import LeadImporterModal from './LeadImporterModal';
import WalkthroughModal from './WalkthroughModal';
import LeadDossierModal from './LeadDossierModal';
import SalesKanbanBoard from './SalesKanbanBoard';
import RepStatsView from './RepStatsView';
import TouchCentreView from './followups/TouchCentreView';
import PickupModal from './followups/PickupModal';
import CallbackModal from './followups/CallbackModal';
import NotInterestedModal from './followups/NotInterestedModal';
import JobWonModal from './followups/JobWonModal';
import ReplyModal from './followups/ReplyModal';
import ReferralModal from './followups/ReferralModal';
import VisitResultModal from './followups/VisitResultModal';
import QuoteDetailsModal from './followups/QuoteDetailsModal';
import JobResultModal from './followups/JobResultModal';
import OutOfOfficeModal from './followups/OutOfOfficeModal';
import FollowupSettingsModal from './followups/FollowupSettingsModal';
import ContactedChoiceModal from './followups/ContactedChoiceModal';
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
  const s = String(seniority || '').toLowerCase().trim();
  const p = String(position || '').toLowerCase().trim();
  const combined = `${s} ${p}`;

  // 1. Executive / Owner / C-Suite (Rank 5)
  if (
    /\b(ceo|coo|cfo|cto|cio|cro|cmo|owner|founder|co-founder|president|principal|partner|chair|chairman)\b/i.test(combined) ||
    combined.includes('chief executive') ||
    combined.includes('chief operating') ||
    combined.includes('chief financial') ||
    combined.includes('chief technology') ||
    combined.includes('chief') ||
    combined.includes('executive') ||
    combined.includes('c-suite') ||
    combined.includes('c_suite')
  ) {
    return 5;
  }

  // 2. Director / VP / General Management (Rank 4)
  if (
    /\b(vp|evp|svp|avp|gm)\b/i.test(combined) ||
    combined.includes('vice president') ||
    combined.includes('director') ||
    combined.includes('general manager') ||
    combined.includes('head of')
  ) {
    return 4;
  }

  // 3. Senior Project Management / Senior Leads (Rank 3.5)
  if (
    combined.includes('senior project manager') ||
    combined.includes('senior pm') ||
    combined.includes('sr. project manager') ||
    combined.includes('sr project manager') ||
    combined.includes('sr pm') ||
    combined.includes('sr. pm') ||
    combined.includes('senior construction') ||
    combined.includes('senior superintendent') ||
    combined.includes('senior estimator') ||
    (p.includes('senior') && !p.includes('coordinator'))
  ) {
    return 3.5;
  }

  // 4. Senior Coordinator / Assistant PM (Rank 2.0)
  if (
    p.includes('senior coordinator') ||
    p.includes('assistant project manager') ||
    p.includes('assistant pm') ||
    /\bapm\b/i.test(p)
  ) {
    return 2;
  }

  // 5. Entry Level / Project Coordinator / Admin / Assistant (Rank 1.0)
  // Check explicit junior titles before generic 'manager' fallback so assistants aren't promoted to managers
  if (
    p.includes('coordinator') ||
    p.includes('assistant') ||
    p.includes('admin') ||
    p.includes('intern') ||
    p.includes('junior') ||
    p.includes('entry') ||
    s === 'entry' ||
    s === 'intern'
  ) {
    return 1;
  }

  // 6. Project Managers / Superintendents / Estimators (Rank 3.0)
  if (
    /\bpm\b/i.test(p) ||
    combined.includes('project manager') ||
    combined.includes('superintendent') ||
    combined.includes('site super') ||
    combined.includes('site supervisor') ||
    combined.includes('estimator') ||
    combined.includes('construction manager') ||
    combined.includes('operations manager') ||
    p.includes('manager') ||
    s === 'manager'
  ) {
    return 3;
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

export default function PhoneTab({ user, repName, repTitle, isActive }) {
  // Resolve rep name, ID, and title dynamically from authenticated session
  const activeRepName = normalizeRepName(
    repName || user?.full_name || user?.email?.split('@')[0] || 'Sales Rep'
  );
  const activeRepId = user?.id || null;
  const activeRepTitle = repTitle || user?.title || 'Account Executive';

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
  const [isSyncingQuo, setIsSyncingQuo] = useState(false);

  // Follow-up & capture modals (spec 0.4, 0.5, Phase 4)
  const [activeCaptureLead, setActiveCaptureLead] = useState(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [showNotInterestedModal, setShowNotInterestedModal] = useState(false);
  const [showJobWonModal, setShowJobWonModal] = useState(false);
  const [showContactedDropMenu, setShowContactedDropMenu] = useState(false);
  const [followupBoardData, setFollowupBoardData] = useState(null);
  const [followupMeta, setFollowupMeta] = useState({ mailingAddressSet: false });
  const [followupAuthError, setFollowupAuthError] = useState(false);

  const dueTouchesCount =
    ((followupMeta?.bucketCounts?.mine?.due_today ?? 0) + (followupMeta?.bucketCounts?.mine?.overdue ?? 0)) ||
    ((followupMeta?.bucketCounts?.all?.due_today ?? 0) + (followupMeta?.bucketCounts?.all?.overdue ?? 0));

  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyModalContact, setReplyModalContact] = useState(null);

  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralModalContact, setReferralModalContact] = useState(null);

  const [showVisitResultModal, setShowVisitResultModal] = useState(false);
  const [visitResultContact, setVisitResultContact] = useState(null);
  const [visitResultTask, setVisitResultTask] = useState(null);

  const [showQuoteDetailsModal, setShowQuoteDetailsModal] = useState(false);
  const [quoteDetailsContact, setQuoteDetailsContact] = useState(null);
  const [quoteDetailsTask, setQuoteDetailsTask] = useState(null);
  const [quoteDetailsEnrollment, setQuoteDetailsEnrollment] = useState(null);

  const [showJobResultModal, setShowJobResultModal] = useState(false);
  const [jobResultContact, setJobResultContact] = useState(null);
  const [jobResultTask, setJobResultTask] = useState(null);

  const [showOutOfOfficeModal, setShowOutOfOfficeModal] = useState(false);
  const [oooContact, setOooContact] = useState(null);

  const [showFollowupSettingsModal, setShowFollowupSettingsModal] = useState(false);


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
    fetchFollowupBoard();

    const handleSync = () => {
      refreshStats();
      fetchFollowupBoard();
    };
    window.addEventListener('sync-local-events', handleSync);
    return () => window.removeEventListener('sync-local-events', handleSync);
  }, [isActive, filter]);

  async function fetchFollowupBoard() {
    try {
      const res = await fetch('/api/sales/followups/board');
      if (res.status === 401) {
        setFollowupAuthError(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setFollowupBoardData(data);
      if (data?.meta) {
        setFollowupMeta({
          ...data.meta,
          repSettings: data.repSettings || data.meta?.repSettings,
        });
      }
      setFollowupAuthError(false);
    } catch (e) {
      console.warn('[PhoneTab] Error fetching followup board:', e);
    }
  }

  async function handleSyncQuoTranscripts() {
    setIsSyncingQuo(true);
    try {
      const res = await fetch('/api/sales/quo/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync Quo transcripts');
      toast.success(data.message || 'Synced Quo transcripts and summaries successfully!');
      await refreshStats();
      await loadContacts();
    } catch (err) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setIsSyncingQuo(false);
    }
  }


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
      const res = await updateLeadContact(contactId, {
        customer_name: updatedFields.name,
        company_name: updatedFields.company,
        contact_title: updatedFields.position,
        customer_phone: updatedFields.phone,
        phone: updatedFields.phone,
        work_direct_phone: updatedFields.work_direct_phone,
        mobile_phone: updatedFields.mobile_phone,
        customer_email: updatedFields.email,
        email: updatedFields.email,
        city: updatedFields.city,
        notes: updatedFields.notes,
        quoted_price: updatedFields.estimated_value
      });

      if (res && res.error) {
        console.error('[PhoneTab] Save contact failed:', res.error);
        return false;
      }

      const existing = contacts.find(c => c.id === contactId) || {};
      const updated = {
        ...existing,
        ...updatedFields,
        phone: updatedFields.phone || updatedFields.work_direct_phone || existing.phone,
        work_direct_phone: updatedFields.work_direct_phone !== undefined ? updatedFields.work_direct_phone : existing.work_direct_phone,
        mobile_phone: updatedFields.mobile_phone !== undefined ? updatedFields.mobile_phone : existing.mobile_phone,
      };

      setContacts(prev => prev.map(c => c.id === contactId ? updated : c));
      if (selectedContact?.id === contactId) {
        setSelectedContact(updated);
      }
      if (dossierModalContact?.id === contactId) {
        setDossierModalContact(updated);
      }
      return true;
    } catch (err) {
      console.error('[PhoneTab] Save contact from modal failed:', err);
      return false;
    }
  }

  async function handleSaveQueueInlineEdit(contactId) {
    try {
      const res = await updateLeadContact(contactId, {
        customer_name: inlineFormData.name,
        company_name: inlineFormData.company,
        contact_title: inlineFormData.position,
        customer_phone: inlineFormData.phone,
        phone: inlineFormData.phone,
        customer_email: inlineFormData.email,
        email: inlineFormData.email,
        city: inlineFormData.city,
        status: inlineFormData.status
      });

      if (res && res.error) {
        console.error('[PhoneTab] Save inline queue edit failed:', res.error);
        return false;
      }

      const existing = contacts.find(c => c.id === contactId) || {};
      const updated = {
        ...existing,
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
      if (dossierModalContact?.id === contactId) {
        setDossierModalContact(updated);
      }
      setInlineEditingLeadId(null);
      return true;
    } catch (err) {
      console.error('[PhoneTab] Inline edit save failed:', err);
      return false;
    }
  }

  // Shared outcome logger (spec 0.5)
  async function logOutcome(contact, outcomeKey, capture = {}) {
    if (!contact) return;
    const explicitStatus = capture?.leadStatus || null;
    const computedStatus = nextLeadStatus(contact.status, outcomeKey, explicitStatus);
    const newStatus = explicitStatus || computedStatus || contact.status;
    const notes = capture?.notes || (outcomeKey === 'STATUS_MOVE' ? `Pipeline status moved to ${explicitStatus}` : `Outcome: ${outcomeKey}`);
    const callbackTime = capture?.callbackTime || null;
    const saleDetails = capture?.saleDetails || null;
    const duration = capture?.durationSeconds || (outcomeKey === 'CONVO' ? 60 : outcomeKey === 'VOICEMAIL' ? 25 : outcomeKey === 'STATUS_MOVE' ? 15 : 0);

    try {
      const res = await logCallEvent({
        contactId: contact.id,
        contactName: contact.name,
        companyName: contact.company,
        phoneNumber: contact.phone,
        city: contact.city,
        callType: 'OUTBOUND',
        outcomeType: outcomeKey,
        durationSeconds: duration,
        notes: notes,
        callbackTime: callbackTime,
        saleDetails: saleDetails,
        repId: activeRepId,
        repName: activeRepName,
        leadStatus: explicitStatus,
        followup: capture?.followup || null,
      });

      // Update local contact state
      setContacts(prev => prev.map(c => {
        if (c.id === contact.id) {
          return {
            ...c,
            status: newStatus,
            times_contacted: (c.times_contacted || 0) + 1,
            last_outcome: outcomeKey,
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
          last_outcome: outcomeKey,
          last_contacted_at: new Date().toISOString()
        }));
      }

      if (dossierModalContact?.id === contact.id) {
        setDossierModalContact(prev => ({
          ...prev,
          status: newStatus,
          times_contacted: (prev.times_contacted || 0) + 1,
          last_outcome: outcomeKey,
          last_contacted_at: new Date().toISOString()
        }));
      }

      refreshStats();

      if (typeof fetchFollowupBoard === 'function') {
        fetchFollowupBoard();
      }

      if (res?.followup?.toast) {
        const t = res.followup.toast;
        if (typeof t === 'string') {
          toast(t);
        } else if (t.title) {
          toast(t.title, { description: t.description });
        }
      }

      return res;
    } catch (err) {
      console.error('[PhoneTab] logOutcome error:', err);
    }
  }

  // Kanban Drag Handlers (spec 0.4)
  async function handleKanbanUpdateStatus(contactId, targetColKey) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    if (targetColKey === 'no_answer') {
      return await logOutcome(contact, 'NO_ANSWER', { leadStatus: 'no_answer', notes: 'Outbound call: No Answer / Rang out' });
    }
    if (targetColKey === 'new') {
      return await logOutcome(contact, 'STATUS_MOVE', { leadStatus: 'new' });
    }
    if (targetColKey === 'quoted') {
      return await logOutcome(contact, 'INFO_SENT', { leadStatus: 'quoted', notes: 'Pricing spec sheet / information sent' });
    }
    if (targetColKey === 'walkthrough_booked') {
      setSelectedContact(contact);
      setShowWalkthroughModal(true);
      return;
    }
    if (targetColKey === 'won') {
      setActiveCaptureLead(contact);
      setShowJobWonModal(true);
      return;
    }
    if (targetColKey === 'lost') {
      setActiveCaptureLead(contact);
      setShowNotInterestedModal(true);
      return;
    }
    if (targetColKey === 'contacted') {
      setActiveCaptureLead(contact);
      setShowContactedDropMenu(true);
      return;
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
        repId: activeRepId,
        repName: activeRepName,
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

    if (outcomeType === 'CONVO') {
      setActiveCaptureLead(contact);
      setShowPickupModal(true);
      return { pending: true };
    }
    if (outcomeType === 'CALLBACK') {
      setActiveCaptureLead(contact);
      setShowCallbackModal(true);
      return { pending: true };
    }
    if (outcomeType === 'NOT_INTERESTED') {
      setActiveCaptureLead(contact);
      setShowNotInterestedModal(true);
      return { pending: true };
    }
    if (outcomeType === 'JOB_WON' || outcomeType === 'SALE') {
      setActiveCaptureLead(contact);
      setShowJobWonModal(true);
      return { pending: true };
    }
    if (outcomeType === 'WALKTHROUGH') {
      setSelectedContact(contact);
      setShowWalkthroughModal(true);
      return { pending: true };
    }

    let notes = `Outcome: ${outcomeType}`;
    let duration = 0;
    if (outcomeType === 'NO_ANSWER') {
      notes = 'Outbound call: No Answer / Rang out';
    } else if (outcomeType === 'VOICEMAIL') {
      notes = 'Outbound call: Left capabilities voicemail';
      duration = 25;
    } else if (outcomeType === 'INFO_SENT' || outcomeType === 'SEND_QUOTE') {
      notes = 'Pricing spec sheet / information sent';
      duration = 45;
    }

    return await logOutcome(contact, outcomeType, { notes, durationSeconds: duration });
  }

  // Follow-up modal submit handlers
  const handlePickupSubmit = async (formData) => {
    if (!activeCaptureLead) return;
    try {
      if (formData.email && formData.email !== activeCaptureLead.email) {
        await updateLeadContact(activeCaptureLead.id, { email: formData.email });
      }
      await logOutcome(activeCaptureLead, 'CONVO', {
        followup: {
          callNote: formData.callNote,
          nextStep: formData.nextStep,
          projectName: formData.projectName,
          sendRecap: formData.sendRecap,
          referral: formData.referral,
        },
        leadStatus: 'contacted',
      });
    } catch (e) {
      toast.error(e?.message || 'Failed to log pick-up outcome');
    }
  };

  const handleCallbackSubmit = async ({ date, time, note, sendConfirmation }) => {
    if (!activeCaptureLead) return;
    try {
      const callbackTime = `${date} ${time}`;
      const callbackAt = `${date}T${time}:00`;
      await logOutcome(activeCaptureLead, 'CALLBACK', {
        callbackTime,
        notes: note || 'Callback scheduled',
        followup: {
          callbackAt,
          sendConfirmation,
          note,
        },
        leadStatus: 'contacted',
      });
    } catch (e) {
      toast.error(e?.message || 'Failed to schedule callback');
    }
  };

  const handleNotInterestedSubmit = async ({ choice, note }) => {
    if (!activeCaptureLead) return;
    try {
      await logOutcome(activeCaptureLead, 'NOT_INTERESTED', {
        notes: note || `Not interested (${choice})`,
        followup: {
          subchoice: choice,
          note,
        },
        leadStatus: 'lost',
      });
    } catch (e) {
      toast.error(e?.message || 'Failed to log not interested');
    }
  };

  const handleJobWonSubmit = async (saleDetails) => {
    if (!activeCaptureLead) return;
    try {
      await logOutcome(activeCaptureLead, 'JOB_WON', {
        saleDetails,
        leadStatus: 'won',
      });
    } catch (e) {
      toast.error(e?.message || 'Failed to log job won');
    }
  };

  const handleReplySelect = async (optionId) => {
    if (!replyModalContact) return;
    try {
      if (optionId === 'want_to_talk') {
        const res = await fetch(`/api/sales/followups/lead/${replyModalContact.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'replied', content: 'wants_to_talk' }),
        });
        if (!res.ok) throw new Error('Failed to record reply');
        toast.success('Reply recorded. Follow-up emails stopped.');
        fetchFollowupBoard();
      } else if (optionId === 'asked_for_info') {
        const res = await fetch(`/api/sales/followups/lead/${replyModalContact.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'replied', content: 'asked_for_info' }),
        });
        if (!res.ok) throw new Error('Failed to record reply');
        toast.success('Reply recorded. Follow-up emails stopped.');
        fetchFollowupBoard();
      } else if (optionId === 'booked_walkthrough') {
        setSelectedContact(replyModalContact);
        setShowWalkthroughModal(true);
      } else if (optionId === 'gave_referral') {
        setReferralModalContact(replyModalContact);
        setShowReferralModal(true);
      } else if (optionId === 'not_right_now') {
        setActiveCaptureLead(replyModalContact);
        setShowNotInterestedModal(true);
      } else if (optionId === 'not_interested') {
        const res = await fetch(`/api/sales/followups/lead/${replyModalContact.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'replied', content: 'not_interested' }),
        });
        if (!res.ok) throw new Error('Failed to record reply');
        toast.success('Reply recorded. Follow-ups stopped.');
        fetchFollowupBoard();
      } else if (optionId === 'stop_emailing') {
        const res = await fetch(`/api/sales/followups/lead/${replyModalContact.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unsubscribe' }),
        });
        if (!res.ok) throw new Error('Failed to unsubscribe lead');
        toast.success('Unsubscribed. Follow-ups stopped.');
        fetchFollowupBoard();
      } else if (optionId === 'out_of_office') {
        setOooContact(replyModalContact);
        setShowOutOfOfficeModal(true);
      } else if (optionId === 'something_else') {
        const res = await fetch(`/api/sales/followups/lead/${replyModalContact.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'replied', content: 'other' }),
        });
        if (!res.ok) throw new Error('Failed to record reply');
        toast.success('Reply recorded. Follow-up emails stopped.');
        fetchFollowupBoard();
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleReferralSubmit = async (referral) => {
    if (!referralModalContact) return;
    try {
      const res = await fetch(`/api/sales/followups/lead/${referralModalContact.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_referral', referral }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add referral');
      }
      toast.success('Referred contact added');
      fetchFollowupBoard();
      loadContacts();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleVisitResultSubmit = async (result) => {
    if (!visitResultTask) return;
    try {
      const res = await fetch(`/api/sales/followups/tasks/${visitResultTask.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'done', result }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit visit result');
      }
      toast.success('Walkthrough result recorded');
      fetchFollowupBoard();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleJobResultSubmit = async ({ result, rescheduledDate }) => {
    if (!jobResultTask) return;
    try {
      const res = await fetch(`/api/sales/followups/tasks/${jobResultTask.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'done', result, rescheduledDate }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit job result');
      }
      toast.success('Job result recorded');
      fetchFollowupBoard();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleOutOfOfficeSubmit = async (backOnDate) => {
    if (!oooContact) return;
    try {
      const res = await fetch(`/api/sales/followups/lead/${oooContact.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause', resume_at: `${backOnDate}T09:00:00` }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to pause follow-ups');
      }
      toast.success('Follow-ups paused');
      fetchFollowupBoard();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleQuoteDetailsSubmit = async ({ quote_amount, scope_phase }) => {
    if (!quoteDetailsContact) return;
    try {
      await fetch(`/api/sales/followups/lead/${quoteDetailsContact.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'quote_details', quote_amount, scope_phase }),
      });
      fetchFollowupBoard();
    } catch {}
  };

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
        repId: activeRepId,
        repName: activeRepName,
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
      repId: activeRepId,
      repName: activeRepName,
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
      repId: activeRepId,
      repName: activeRepName,
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
      repId: activeRepId,
      repName: activeRepName,
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
      <div className={`phone-grid-layout ${subView === 'kanban' || subView === 'reps' || subView === 'touches' ? 'full-width' : ''}`}>
        
        {/* LEFT COLUMN: Calling Queue & Leads List (Hidden in full Kanban, Reps, and Touch Centre view) */}
        {subView !== 'kanban' && subView !== 'reps' && subView !== 'touches' && (
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
                style={{ padding: '4px 8px', fontSize: '11px', flex: 'none', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                onClick={handleSyncQuoTranscripts}
                disabled={isSyncingQuo}
                title="Sync past transcripts, audio recordings, and Sona AI summaries from Quo"
              >
                <RefreshCw size={12} className={isSyncingQuo ? 'animate-spin' : ''} /> {isSyncingQuo ? 'Syncing Quo...' : 'Sync Quo'}
              </button>
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
                        <span className="phone-lead-val">{c.last_rep_name ? normalizeRepName(c.last_rep_name) : (c.call_logs && c.call_logs[0]?.rep_name ? normalizeRepName(c.call_logs[0].rep_name) : (c.times_contacted > 0 ? normalizeRepName(c.rep_name || 'Sales Rep') : 'Untouched'))}</span>
                        <span className="uppercase text-[10px] font-bold text-slate-400">
                          {c.status === 'walkthrough_booked' ? 'Walkthrough' : (c.status === 'no_answer' || c.status === 'voicemail') ? 'No Answer / VM' : c.status || 'New'}
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
            <div className="phone-subtabs" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
                className={`phone-subtab-btn ${subView === 'touches' ? 'active' : ''}`}
                onClick={() => setSubView('touches')}
                title="Touch Centre: Daily High-Velocity Follow-ups & Touches"
              >
                <Sparkles size={13} className={subView === 'touches' ? 'text-amber-300' : 'text-amber-400'} />
                <span>Touch Centre {dueTouchesCount > 0 ? `(${dueTouchesCount})` : ''}</span>
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

            {/* VIEW 2: TOUCH CENTRE - DAILY HIGH-VELOCITY FOLLOW-UPS & SMART TOUCHES */}
            {subView === 'touches' && (
              <TouchCentreView
                contacts={contacts}
                followupsByLeadId={followupBoardData?.leads || {}}
                followupMeta={followupMeta}
                user={user}
                onStartCall={startCall}
                onOpenDossier={(contact) => {
                  setSelectedContact(contact);
                  setDossierModalContact(contact);
                  setShowDossierModal(true);
                }}
                onRefreshFollowups={fetchFollowupBoard}
                onOpenWalkthrough={(contact) => {
                  setSelectedContact(contact);
                  setShowWalkthroughModal(true);
                }}
                onOpenFollowupSettings={() => setShowFollowupSettingsModal(true)}
                onOpenReplyModal={(contact) => {
                  setReplyModalContact(contact);
                  setShowReplyModal(true);
                }}
                onOpenOutOfOfficeModal={(contact) => {
                  setOooContact(contact);
                  setShowOutOfOfficeModal(true);
                }}
                onOpenVisitResultModal={(contact, task) => {
                  setVisitResultContact(contact);
                  setVisitResultTask(task);
                  setShowVisitResultModal(true);
                }}
                onOpenJobResultModal={(contact, task) => {
                  setJobResultContact(contact);
                  setJobResultTask(task);
                  setShowJobResultModal(true);
                }}
                onOpenCallbackModal={(contact) => {
                  setActiveCaptureLead(contact);
                  setShowCallbackModal(true);
                }}
                onOpenQuoteDetailsModal={(contact, task, enr) => {
                  setQuoteDetailsContact(contact);
                  setQuoteDetailsTask(task);
                  setQuoteDetailsEnrollment(enr);
                  setShowQuoteDetailsModal(true);
                }}
              />
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
                  followupsByLeadId={followupBoardData?.leads || {}}
                  followupMeta={followupMeta}
                  followupAuthError={followupAuthError}
                  onRefreshFollowups={fetchFollowupBoard}
                  onOpenFollowupSettings={() => setShowFollowupSettingsModal(true)}
                  onOpenReplyModal={contact => {
                    setReplyModalContact(contact);
                    setShowReplyModal(true);
                  }}
                  onOpenOutOfOfficeModal={contact => {
                    setOooContact(contact);
                    setShowOutOfOfficeModal(true);
                  }}
                  onOpenVisitResultModal={(contact, task) => {
                    setVisitResultContact(contact);
                    setVisitResultTask(task);
                    setShowVisitResultModal(true);
                  }}
                  onOpenJobResultModal={(contact, task) => {
                    setJobResultContact(contact);
                    setJobResultTask(task);
                    setShowJobResultModal(true);
                  }}
                  onOpenCallbackModal={contact => {
                    setActiveCaptureLead(contact);
                    setShowCallbackModal(true);
                  }}
                  onOpenQuoteDetailsModal={(contact, task, enr) => {
                    setQuoteDetailsContact(contact);
                    setQuoteDetailsTask(task);
                    setQuoteDetailsEnrollment(enr);
                    setShowQuoteDetailsModal(true);
                  }}
                  onStartCall={(contact, phone) => startCall(contact, phone)}
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
        user={user}
        activeRepName={activeRepName}
        activeRepTitle={activeRepTitle}
        repSettings={followupMeta?.repSettings}
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
        onOpenReplyModal={contact => {
          setReplyModalContact(contact);
          setShowReplyModal(true);
        }}
        onOpenOutOfOfficeModal={contact => {
          setOooContact(contact);
          setShowOutOfOfficeModal(true);
        }}
        onOpenVisitResultModal={(contact, task) => {
          setVisitResultContact(contact);
          setVisitResultTask(task);
          setShowVisitResultModal(true);
        }}
        onOpenJobResultModal={(contact, task) => {
          setJobResultContact(contact);
          setJobResultTask(task);
          setShowJobResultModal(true);
        }}
        onOpenCallbackModal={contact => {
          setActiveCaptureLead(contact);
          setShowCallbackModal(true);
        }}
        onOpenQuoteDetailsModal={(contact, task, enr) => {
          setQuoteDetailsContact(contact);
          setQuoteDetailsTask(task);
          setQuoteDetailsEnrollment(enr);
          setShowQuoteDetailsModal(true);
        }}
        onTriggerRefresh={fetchFollowupBoard}
      />

      {/* Follow-up & Outcome Capture Modals (Phase 4) */}
      <PickupModal
        isOpen={showPickupModal}
        contact={activeCaptureLead}
        onClose={() => setShowPickupModal(false)}
        onSubmit={handlePickupSubmit}
      />

      <CallbackModal
        isOpen={showCallbackModal}
        contact={activeCaptureLead}
        onClose={() => setShowCallbackModal(false)}
        onSubmit={handleCallbackSubmit}
      />

      <NotInterestedModal
        isOpen={showNotInterestedModal}
        contact={activeCaptureLead}
        onClose={() => setShowNotInterestedModal(false)}
        onSubmit={handleNotInterestedSubmit}
      />

      <JobWonModal
        isOpen={showJobWonModal}
        contact={activeCaptureLead}
        onClose={() => setShowJobWonModal(false)}
        onSubmit={handleJobWonSubmit}
      />

      <ContactedChoiceModal
        isOpen={showContactedDropMenu}
        contact={activeCaptureLead}
        onClose={() => setShowContactedDropMenu(false)}
        onChoosePickup={() => setShowPickupModal(true)}
        onChooseCallback={() => setShowCallbackModal(true)}
      />

      <ReplyModal
        isOpen={showReplyModal}
        contact={replyModalContact}
        onClose={() => setShowReplyModal(false)}
        onSelectOption={handleReplySelect}
      />

      <ReferralModal
        isOpen={showReferralModal}
        contact={referralModalContact}
        onClose={() => setShowReferralModal(false)}
        onSubmit={handleReferralSubmit}
      />

      <VisitResultModal
        isOpen={showVisitResultModal}
        contact={visitResultContact}
        onClose={() => setShowVisitResultModal(false)}
        onSubmit={handleVisitResultSubmit}
        onReschedule={() => {
          if (visitResultContact) {
            setSelectedContact(visitResultContact);
            setShowWalkthroughModal(true);
          }
        }}
      />

      <QuoteDetailsModal
        isOpen={showQuoteDetailsModal}
        contact={quoteDetailsContact}
        task={quoteDetailsTask}
        enrollment={quoteDetailsEnrollment}
        repSettings={followupMeta?.repSettings}
        mailingAddressSet={followupMeta?.mailingAddressSet}
        onClose={() => setShowQuoteDetailsModal(false)}
        onSubmitDetails={handleQuoteDetailsSubmit}
        onOpenFired={() => {
          if (quoteDetailsTask) {
            fetch(`/api/sales/followups/tasks/${quoteDetailsTask.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'open' }),
            }).then(() => fetchFollowupBoard()).catch(() => {});
          }
        }}
      />

      <JobResultModal
        isOpen={showJobResultModal}
        contact={jobResultContact}
        onClose={() => setShowJobResultModal(false)}
        onSubmit={handleJobResultSubmit}
      />

      <OutOfOfficeModal
        isOpen={showOutOfOfficeModal}
        contact={oooContact}
        onClose={() => setShowOutOfOfficeModal(false)}
        onSubmit={handleOutOfOfficeSubmit}
      />

      <FollowupSettingsModal
        isOpen={showFollowupSettingsModal}
        onClose={() => setShowFollowupSettingsModal(false)}
        onSaved={() => {
          fetchFollowupBoard();
          refreshStats();
        }}
      />

    </div>
  );
}
