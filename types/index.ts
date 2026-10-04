// ============================================================
// Sea of Blue — Core TypeScript Types
// ============================================================

// ---------- Enums / Unions ----------

export type UserRole = 'admin' | 'employee' | 'customer' | 'zone_manager' | 'partner';

// Phase 3 additional enums
export type DisputeCategory = 'missed_items' | 'damage' | 'no_show' | 'billing' | 'other';
export type DisputeStatus = 'open' | 'under_review' | 'resolved_customer' | 'resolved_company' | 'escalated';
export type PartnerType = 'realtor' | 'property_manager' | 'other';
export type PartnerInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
export type ReferralStatus = 'pending' | 'qualified' | 'credit_applied';
export type RestockStatus = 'pending' | 'ordered' | 'received';

export type JobStatus =
  | 'lead_received' | 'quoted' | 'deposit_paid' | 'confirmed'
  | 'offered' | 'accepted' | 'assigned' | 'on_the_way'
  | 'in_progress' | 'completed' | 'reviewed' | 'paid_out'
  | 'cancelled' | 'rescheduled' | 'no_show' | 'disputed' | 'refunded';

export type ServiceType =
  | 'standard_clean' | 'standard_plus_clean' | 'deep_clean' | 'reset_clean'
  | 'move_in_clean' | 'move_out_clean'
  | 'recurring_standard' | 'recurring_deep'
  | 'post_construction_clean' | 'junk_removal' | 'painting'
  | 'commercial_cleaning' | 'strip_and_wax' | 'carpet_clean';

export type TimeWindow = 'morning' | 'afternoon' | 'evening';

export type DayOfWeek =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly';

export type EmployeeTier = 'basic' | 'pro' | 'team';

export type EmployeeStatus = 'invited' | 'active' | 'probation' | 'suspended' | 'inactive';

export type TimesheetStatus = 'open' | 'completed' | 'approved' | 'rejected';

export type LeadStatus = 'new' | 'contacted' | 'quoted' | 'converted' | 'lost';

export type LeadSource = 'lsa' | 'referral' | 'realtor' | 'inbound_call' | 'website' | 'cold_call' | 'google_search' | 'd2d';

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  inbound_call: 'Inbound Call',
  website: 'Website',
  referral: 'Referral',
  realtor: 'Realtor / GC',
  cold_call: 'Cold Call / Outreach',
  d2d: 'D2D Commercial',
  lsa: 'Local Service Ads (LSA)',
  google_search: 'Google Search',
};

export type HomeCondition = 'well_maintained' | 'average' | 'heavy_clean_needed';

export type AddOn =
  // Legacy values (kept for backward compatibility)
  | 'inside_fridge' | 'inside_oven' | 'inside_cabinets' | 'baseboards' | 'interior_windows'
  | 'exterior_windows' | 'pressure_washing' | 'carpet_stain' | 'laundry' | 'closet_org' | 'kitchen_cabinet_detail'
  // New rate card add-ons
  | 'balcony' | 'heavy_pet_hair' | 'garage'
  | 'upholstery_sofa' | 'upholstery_chair' | 'mattress_clean'
  | 'carpet_steam_room' | 'carpet_steam_unit' | 'linen_change'
  | 'blinds_detail' | 'curtain_dusting' | 'full_wall_wash' | 'ceiling_fan'
  | 'grout_deep_clean' | 'wine_fridge' | 'fireplace_surround' | 'bbq_exterior'
  | 'exterior_windows_ground' | 'exterior_windows_elevated'
  | 'dishes' | 'rush_booking' | 'after_hours' | 'key_pickup'
  | 'eco_upgrade' | 'pet_odor' | 'sanitizing_pass';

export type PhotoType = 'before' | 'after' | 'issue' | 'supply_kit';

export type RoomType = 'kitchen' | 'bathroom' | 'bedroom' | 'living_room' | 'other';

export type PaymentType = 'deposit' | 'balance' | 'full' | 'refund' | 'partial_refund';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export type NotificationChannel = 'sms' | 'email' | 'push';

export type NotificationType =
  | 'job_offer' | 'booking_confirmed' | 'reminder'
  | 'review_request' | 'cleaner_on_way' | 'job_complete';

export type ExpenseCategory = 'supplies' | 'gas' | 'insurance' | 'maintenance' | 'other';

// ---------- Human-readable display maps ----------

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  standard_clean: 'Standard Clean',
  standard_plus_clean: 'Standard Plus',
  deep_clean: 'Deep Clean',
  reset_clean: 'Reset Clean',
  move_in_clean: 'Move-In Clean',
  move_out_clean: 'Move-Out Clean',
  recurring_standard: 'Recurring Standard',
  recurring_deep: 'Recurring Deep',
  post_construction_clean: 'Post-Construction Clean',
  junk_removal: 'Junk Removal',
  painting: 'Painting',
  commercial_cleaning: 'Commercial Cleaning',
  strip_and_wax: 'Strip & Wax',
  carpet_clean: 'Carpet Cleaning',
};

export const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  morning: 'Morning (8am–12pm)',
  afternoon: 'Afternoon (12pm–4pm)',
  evening: 'Evening (4pm–8pm)',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  lead_received: 'Lead Received',
  quoted: 'Quoted',
  deposit_paid: 'Deposit Paid',
  confirmed: 'Confirmed',
  offered: 'Offered',
  accepted: 'Accepted',
  assigned: 'Assigned',
  on_the_way: 'On the Way',
  in_progress: 'In Progress',
  completed: 'Completed',
  reviewed: 'Reviewed',
  paid_out: 'Paid Out',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  no_show: 'No Show',
  disputed: 'Disputed',
  refunded: 'Refunded',
};

export const CUSTOMER_STATUS_MESSAGES: Partial<Record<JobStatus, string>> = {
  confirmed: 'Your booking is confirmed. We will confirm your cleaner shortly.',
  offered: 'We are confirming your cleaner. You will receive an update soon.',
  assigned: 'Your cleaner has been assigned.',
  on_the_way: 'Your cleaner is on their way to you now.',
  in_progress: 'Your clean is in progress.',
  completed: 'Your clean is complete. How did it go?',
  rescheduled: 'Your booking has been rescheduled. Please check your email for details.',
  cancelled: 'Your booking has been cancelled. Please contact us for assistance.',
};

// ---------- Data Interfaces ----------

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Zone {
  id: string;
  name: string;
  city: string;
  is_active: boolean;
  areas: string[];
  notes: string | null;
  latitude?: number;
  longitude?: number;
  created_at: string;
}


export interface Customer {
  id: string;
  profile_id: string | null;
  customer_type?: 'residential' | 'commercial';
  company_name?: string | null;
  commercial_facility_type?: string | null;
  full_name: string;
  email: string;
  phone: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string;
  postal_code: string | null;
  zone_id: string | null;
  stripe_customer_id: string | null;
  qbo_customer_id?: string | null;
  notes: string | null;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  // Commercial & Facility Specs
  square_footage?: number | null;
  accounts_payable_name?: string | null;
  accounts_payable_email?: string | null;
  accounts_payable_phone?: string | null;
  billing_terms?: 'due_on_receipt' | 'net_15' | 'net_30' | 'prepaid' | null;
  tax_id?: string | null;
  tax_exempt?: boolean;
  // Access & Security
  access_code?: string | null;
  alarm_instructions?: string | null;
  parking_instructions?: string | null;
  // Residential Specs
  home_bedrooms?: number | null;
  home_bathrooms?: number | null;
  pet_details?: string | null;
  special_instructions?: string | null;
  // Loyalty & Credit
  referral_code?: string | null;
  credit_balance?: number;
  customer_score?: number;
  // joined & computed
  zone?: Zone;
  jobs_count?: number;
  last_clean_date?: string | null;
  has_recurring?: boolean;
  lifetime_spend?: number;
  open_balance?: number;
  mrr_amount?: number;
}

export interface Employee {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  zone_id: string | null;
  tier?: EmployeeTier;
  status: EmployeeStatus;
  payout_rate?: number;
  hourly_wage?: number;
  brings_own_supplies: boolean;
  has_vehicle: boolean;
  max_jobs_per_day: number;
  score: number;
  stripe_account_id: string | null;
  background_check_cleared: boolean;
  insurance_on_file: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  zone?: Zone;
  jobs_this_month?: number;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  file_url: string;
  uploaded_at: string;
  verified: boolean;
  verified_by: string | null;
  notes: string | null;
}

export interface EmployeeAvailability {
  id: string;
  employee_id: string;
  day_of_week: DayOfWeek;
  time_window: TimeWindow;
  is_available: boolean;
}

export interface EmployeeAvailabilityOverride {
  id: string;
  employee_id: string;
  override_date: string;
  time_window: TimeWindow;
  is_available: boolean;
  reason: string | null;
}

export interface Lead {
  id: string;
  source: LeadSource;
  company_name?: string | null;
  customer_name: string | null;
  contact_title?: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  city: string | null;
  service_type: ServiceType | null;
  preferred_date: string | null;
  preferred_window: TimeWindow | null;
  preferred_start_time?: string | null;
  home_bedrooms: number | null;
  home_bathrooms: number | null;
  home_size_sqft: number | null;
  condition: HomeCondition | null;
  has_pets: boolean;
  add_ons: AddOn[];
  notes: string | null;
  quoted_price: number | null;
  status: LeadStatus;
  converted_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  job_number: string;
  lead_id: string | null;
  customer_id: string;
  zone_id: string;
  assigned_employee_id: string | null;
  assigned_employee_ids?: string[] | null;
  service_type: ServiceType;
  status: JobStatus;
  scheduled_date: string;
  scheduled_window: TimeWindow;
  scheduled_start_time?: string | null;
  estimated_duration_minutes: number;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postal_code: string;
  access_instructions: string | null;
  home_bedrooms: number | null;
  home_bathrooms: number | null;
  home_size_sqft: number | null;
  has_pets: boolean;
  add_ons: AddOn[];
  scope_notes: string | null;
  quoted_price: number;
  final_price: number | null;
  employee_payout_amount: number | null;
  deposit_amount: number | null;
  deposit_paid_at: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  employee_started_at: string | null;
  employee_completed_at: string | null;
  admin_notes: string | null;
  cancellation_reason: string | null;
  dispute_reason: string | null;
  recurring_booking_id: string | null;
  is_first_clean: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  // joined
  customer?: Customer;
  employee?: Employee;
  assigned_employees?: Employee[];
  zone?: Zone;
}

export interface JobOffer {
  id: string;
  job_id: string;
  employee_id: string;
  status: OfferStatus;
  offered_at: string;
  responded_at: string | null;
  expires_at: string | null;
  decline_reason: string | null;
  // joined
  job?: Job;
  employee?: Employee;
}

export interface JobPhoto {
  id: string;
  job_id: string;
  employee_id: string;
  photo_type: PhotoType;
  room: RoomType | null;
  file_url: string;
  caption: string | null;
  uploaded_at: string;
}

export interface JobChecklist {
  id: string;
  job_id: string;
  employee_id: string;
  checklist_data: ChecklistData;
  submitted_at: string;
  reviewed_by_admin: string | null;
  reviewed_at: string | null;
}

export interface ChecklistData {
  kitchen: {
    counters: boolean;
    sink: boolean;
    stovetop: boolean;
    exterior_appliances: boolean;
    cabinet_fronts: boolean;
    floor: boolean;
    microwave_exterior: boolean;
    microwave_interior?: boolean;
  };
  bathrooms: {
    toilet: boolean;
    sink: boolean;
    shower_tub: boolean;
    mirror: boolean;
    counter: boolean;
    floor: boolean;
    garbage: boolean;
  }[];
  bedrooms: {
    dust_surfaces: boolean;
    vacuum_mop: boolean;
    light_tidy: boolean;
  }[];
  living_areas: {
    dusting: boolean;
    floors: boolean;
    surfaces: boolean;
    garbage: boolean;
  };
  add_ons: {
    inside_fridge?: boolean;
    inside_oven?: boolean;
    inside_cabinets?: boolean;
    baseboards?: boolean;
    interior_windows?: boolean;
  };
  employee_notes: string;
  scope_changes_noted: string;
  completed_at: string;
}

export interface Payment {
  id: string;
  job_id: string;
  customer_id: string;
  payment_type: PaymentType;
  amount: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  status: PaymentStatus;
  processed_at: string | null;
  created_at: string;
}

export interface EmployeePayout {
  id: string;
  job_id: string;
  employee_id: string;
  amount: number;
  payout_rate: number;
  status: PayoutStatus;
  payout_method: string;
  payout_reference: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  // joined
  job?: Job;
  employee?: Employee;
}

export interface Review {
  id: string;
  job_id: string;
  customer_id: string;
  employee_id: string;
  rating: number;
  was_on_time: boolean | null;
  job_completed_properly: boolean | null;
  anything_missed: string | null;
  would_book_again: boolean | null;
  public_comment: string | null;
  private_feedback: string | null;
  google_review_requested: boolean;
  google_review_requested_at: string | null;
  created_at: string;
}

export interface RecurringBooking {
  id: string;
  customer_id: string | null;
  preferred_employee_id: string | null;
  preferred_team_id?: string | null;
  service_type: ServiceType;
  frequency: RecurringFrequency;
  days_of_week?: string[];
  preferred_day_of_week: DayOfWeek | null;
  preferred_window: TimeWindow | null;
  preferred_start_time?: string | null;
  estimated_duration_minutes?: number | null;
  address_line1: string;
  city: string;
  postal_code: string;
  quoted_price: number;
  monthly_amount?: number | null;
  billing_type?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  scope_of_work?: string | null;
  discount_rate: number;
  add_ons: AddOn[];
  notes: string | null;
  is_active: boolean;
  last_job_date: string | null;
  next_job_date: string | null;
  zone_id?: string | null;
  customer?: Customer;
  employee?: Employee;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  channel: NotificationChannel;
  notification_type: NotificationType;
  job_id: string | null;
  message: string | null;
  sent_at: string | null;
  delivered: boolean;
  error: string | null;
}

export interface EmployeeScoreHistory {
  id: string;
  employee_id: string;
  score_before: number | null;
  score_after: number | null;
  reason: string | null;
  triggered_by: string | null;
  created_at: string;
}

export interface EmployeeExpense {
  id: string;
  employee_id: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeTimesheet {
  id: string;
  employee_id: string;
  work_date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  total_minutes: number | null;
  status: TimesheetStatus;
  location_data: Record<string, any> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Minimum photo requirements ----------

export const MIN_PHOTOS: Record<string, number> = {
  standard_clean: 4,
  standard_plus_clean: 5,
  deep_clean: 6,
  reset_clean: 8,
  move_out_clean: 8,
  move_in_clean: 8,
  recurring_standard: 4,
  recurring_deep: 6,
};

// ---------- Default pricing (CAD) ----------

export const DEFAULT_PRICING: Record<ServiceType, number> = {
  standard_clean: 199,
  standard_plus_clean: 229,
  deep_clean: 299,
  reset_clean: 750,
  move_in_clean: 350,
  move_out_clean: 350,
  recurring_standard: 160,
  recurring_deep: 250,
  post_construction_clean: 350,
  junk_removal: 195,
  painting: 450,
  commercial_cleaning: 250,
  strip_and_wax: 300,
  carpet_clean: 180,
};

// ---------- Map / Location Interfaces ----------

export interface EmployeeLocation {
  id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  is_active: boolean;
  last_updated: string;
  // joined
  employee?: Employee;
}

export interface JobLocationHistory {
  id: string;
  job_id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

export interface ZoneBoundary {
  id: string;
  zone_id: string;
  geojson: any;
  center_lat: number | null;
  center_lng: number | null;
  created_at: string;
  updated_at: string;
  // joined
  zone?: Zone;
}

export interface RankedEmployee {
  employee: Employee;
  dispatch_score: number;
  distance_km: number | null;
  jobs_today: number;
}

// ============================================================
// Phase 3 Interfaces
// ============================================================

// ---------- Zone Staff ----------

export interface ZoneStaff {
  id: string;
  zone_id: string;
  profile_id: string;
  role: string;
  is_active: boolean;
  assigned_at: string;
  // joined
  zone?: Zone;
  profile?: Profile;
}

// ---------- Employee Teams ----------

export interface EmployeeTeam {
  id: string;
  name: string;
  lead_employee_id: string;
  zone_id: string;
  status: string;
  max_jobs_per_day: number;
  payout_split: { lead: number; member: number };
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  zone?: Zone;
  lead_employee?: Employee;
  members?: EmployeeTeamMember[];
}

export interface EmployeeTeamMember {
  id: string;
  team_id: string;
  employee_id: string;
  role: string;
  joined_at: string;
  // joined
  employee?: Employee;
}

// ---------- Supply Management ----------

export interface SupplyItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  units_per_kit_standard: number;
  units_per_kit_deep: number;
  units_per_kit_moveout: number;
  reorder_threshold: number;
  cost_per_unit: number | null;
  supplier_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SupplyInventory {
  id: string;
  item_id: string;
  zone_id: string | null;
  quantity_on_hand: number;
  last_restocked_at: string | null;
  last_updated: string;
  // joined
  item?: SupplyItem;
  zone?: Zone;
}

export interface SupplyAssignment {
  id: string;
  job_id: string;
  employee_id: string;
  item_id: string;
  quantity_assigned: number;
  quantity_returned: number | null;
  assigned_at: string;
  returned_at: string | null;
  // joined
  item?: SupplyItem;
  employee?: Employee;
}

export interface SupplyRestockOrder {
  id: string;
  item_id: string;
  zone_id: string | null;
  quantity_ordered: number;
  cost_total: number | null;
  status: RestockStatus;
  ordered_at: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  // joined
  item?: SupplyItem;
  zone?: Zone;
}

// ---------- Disputes ----------

export interface Dispute {
  id: string;
  job_id: string;
  customer_id: string;
  employee_id: string | null;
  reported_by: string;
  category: DisputeCategory;
  description: string;
  evidence_urls: string[];
  status: DisputeStatus;
  resolution_notes: string | null;
  refund_amount: number | null;
  employee_penalty: number | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  job?: Job;
  customer?: Customer;
  employee?: Employee;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  attachments: string[];
  sent_at: string;
  // joined
  sender?: Profile;
}

// ---------- Partners ----------

export interface Partner {
  id: string;
  profile_id: string;
  company_name: string;
  partner_type: PartnerType;
  zone_id: string | null;
  referral_code: string | null;
  commission_rate: number;
  credit_balance: number;
  billing_email: string | null;
  stripe_customer_id: string | null;
  invoice_billing: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  zone?: Zone;
  profile?: Profile;
}

export interface PartnerBooking {
  id: string;
  partner_id: string;
  job_id: string;
  partner_reference: string | null;
  billing_notes: string | null;
  created_at: string;
  // joined
  job?: Job;
}

export interface PartnerInvoice {
  id: string;
  partner_id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  line_items: PartnerInvoiceLineItem[];
  subtotal: number;
  credits_applied: number;
  total_due: number;
  stripe_invoice_id: string | null;
  status: PartnerInvoiceStatus;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PartnerInvoiceLineItem {
  job_id: string;
  job_number: string;
  date: string;
  address: string;
  service_type: ServiceType;
  price: number;
}

// ---------- Customer Referrals ----------

export interface CustomerReferral {
  id: string;
  referrer_customer_id: string;
  referred_customer_id: string | null;
  referral_code: string;
  status: ReferralStatus;
  referrer_credit: number;
  referred_discount: number;
  created_at: string;
  qualified_at: string | null;
  credit_applied_at: string | null;
  // joined
  referred_customer?: Customer;
}

// ---------- Booking Sessions ----------

export interface BookingSession {
  id: string;
  session_token: string;
  email: string | null;
  phone: string | null;
  form_data: Record<string, unknown> | null;
  last_step_completed: number;
  quote: PriceQuote | null;
  recovery_email_1_sent_at: string | null;
  recovery_email_2_sent_at: string | null;
  recovery_email_3_sent_at: string | null;
  discount_code: string | null;
  recovered: boolean;
  created_at: string;
  updated_at: string;
}

// ---------- Dynamic Pricing ----------

export interface DynamicPricingConfig {
  id: string;
  zone_id: string | null;
  is_global_config: boolean;
  enabled: boolean;
  multiplier_floor: number;
  multiplier_ceiling: number;
  tier1_threshold: number;
  tier1_multiplier: number;
  tier2_threshold: number;
  tier2_multiplier: number;
  same_day_multiplier: number;
  weekend_multiplier: number;
  updated_at: string;
}

export interface PriceQuote {
  service_type: ServiceType;
  base_price: number;
  add_ons_price: number;
  final_price: number;
  deposit_amount: number;
  balance_due: number;
  surge_multiplier: number;
  surge_reason: string | null;
  credit_applied?: number;
  line_items: Array<{ label: string; amount: number }>;
}

// ---------- Finance / P&L ----------

export type AdSpendChannel = 'lsa' | 'meta' | 'google_ads' | 'tiktok' | 'flyers' | 'other';

export const AD_SPEND_CHANNEL_LABELS: Record<AdSpendChannel, string> = {
  lsa: 'Google Local Services Ads (LSA)',
  meta: 'Meta (Facebook & Instagram)',
  google_ads: 'Google Search & Display Ads',
  tiktok: 'TikTok Ads',
  flyers: 'Flyers & Direct Mail',
  other: 'Other Marketing',
};

export interface AdSpendLog {
  id?: string;
  zone_id?: string | null;
  channel: AdSpendChannel;
  week_start_date: string;
  week_end_date: string;
  amount: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  notes?: string | null;
  created_at?: string;
  created_by?: string | null;
  zone?: Zone;
}

export interface ZoneMonthlyPnl {
  zone_id: string;
  month: string;
  jobs_completed: number;
  gross_revenue: number;
  total_employee_payouts: number;
  gross_profit: number;
  total_ad_spend?: number;
  net_profit?: number;
  roas?: number;
  cac?: number;
  avg_ticket: number;
  recurring_jobs: number;
  one_time_jobs: number;
  // joined
  zone?: Zone;
}

export interface WeeklyPnl {
  zone_id: string | null;
  week_start_date: string;
  week_end_date: string;
  jobs_completed: number;
  gross_revenue: number;
  total_employee_payouts: number;
  gross_profit: number;
  total_ad_spend: number;
  net_profit: number;
  gross_margin_pct: number;
  net_margin_pct: number;
  roas: number;
  avg_ticket: number;
  recurring_jobs: number;
  one_time_jobs: number;
  new_customers_count: number;
  cac: number;
  zone?: Zone;
}

export interface ZoneExpansionScore {
  zone_id: string;
  zone_name: string;
  score: number; // 0-100
  jobs_per_month: number;
  employee_count: number;
  recurring_rate: number;
  avg_ticket: number;
  net_margin: number;
  ready: boolean;
}

export interface PricingQuote {
  id: string;
  lead_id: string | null;
  package_name: string;
  selected_tasks: string[];
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  conditions: string[];
  modifiers: {
    sameDay: boolean;
    afterHours: boolean;
  };
  add_ons: string[];
  calculated_price: number;
  breakdown: {
    basePrice: number;
    bedroomAdjustment: number;
    bathroomAdjustment: number;
    sqftAdjustment: number;
    conditionAdjustments: number;
    modifierAdjustments: number;
    tasksTotal: number;
  };
  estimated_hours: number;
  generated_at: string;
  valid_until: string;
}
