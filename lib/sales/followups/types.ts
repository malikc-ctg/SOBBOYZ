/**
 * Types for SOB Sales Follow-Up Engine
 */

export type SequenceKey =
  | 'no_answer_drip'
  | 'pickup_followup'
  | 'info_sent_followup'
  | 'walkthrough'
  | 'quote_followup'
  | 'callback'
  | 'job_won'
  | 'recheck'
  | 'referral_intro'
  | 'reply_call'
  | 'reply_info';

export type Lane = 'prospect' | 'callback' | 'customer';

export type EnrollmentStatus = 'active' | 'held' | 'paused' | 'completed' | 'cancelled';

export type TaskKind = 'email' | 'call' | 'todo';

export type TaskStatus = 'pending' | 'done' | 'skipped' | 'cancelled';

export interface FollowupEnrollment {
  id: string;
  lead_id: string;
  sequence_key: SequenceKey;
  lane: Lane;
  status: EnrollmentStatus;
  hold_reason?: string | null;
  paused_until?: string | null;
  owner_rep_id?: string | null;
  trigger_event_id?: string | null;
  anchor_at: string;
  company_key?: string | null;
  context: Record<string, any>;
  ended_at?: string | null;
  end_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowupTask {
  id: string;
  enrollment_id: string;
  lead_id: string;
  step_key: string;
  kind: TaskKind;
  template_key?: string | null;
  title: string;
  details?: string | null;
  due_at: string;
  status: TaskStatus;
  result?: string | null;
  assigned_rep_id?: string | null;
  opened_at?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  sent_to?: string | null;
  rendered_subject?: string | null;
  rendered_body?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesLeadFlags {
  lead_id: string;
  email_opt_out_at?: string | null;
  bounced_email?: string | null;
  bounced_at?: string | null;
  do_not_contact_at?: string | null;
  needs_email_since?: string | null;
  last_no_answer_at?: string | null;
  warm_at?: string | null;
  updated_by?: string | null;
  updated_at: string;
}

export interface RepFollowupSettings {
  rep_id: string;
  signature_name: string;
  signature_title?: string | null;
  signature_phone: string;
  gmail_address?: string | null;
  updated_at?: string;
}

export interface LeadState {
  id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  company_name?: string | null;
  contact_title?: string | null;
  city?: string | null;
  status?: string | null;
  source?: string | null;
  notes?: string | null;
  preferred_date?: string | null;
}

export interface PlannerInputState {
  lead: LeadState;
  flags?: SalesLeadFlags | null;
  openEnrollments: (FollowupEnrollment & { pendingTasks: FollowupTask[] })[];
  hadDripEver: boolean;
  lastEndedDrip?: FollowupEnrollment | null;
  isWarm: boolean;
  companyActiveLeadName?: string | null;
  duplicateEmailLeadName?: string | null;
}

export interface PlannerActionStartEnrollment {
  type: 'start_enrollment';
  sequenceKey: SequenceKey;
  lane: Lane;
  status: 'active' | 'held';
  holdReason?: string | null;
  anchorAt: Date;
  context: Record<string, any>;
  initialTasks?: Array<{
    stepKey: string;
    kind: TaskKind;
    templateKey?: string | null;
    title: string;
    details?: string | null;
    dueAt: Date;
  }>;
}

export interface PlannerActionCancelEnrollment {
  type: 'cancel_enrollment';
  enrollmentId: string;
  endReason: string;
  cancelTasksReason?: string;
}

export interface PlannerActionCompleteEnrollment {
  type: 'complete_enrollment';
  enrollmentId: string;
  endReason?: string;
}

export interface PlannerActionPauseEnrollment {
  type: 'pause_enrollment';
  enrollmentId: string;
  until?: Date | null;
}

export interface PlannerActionResumeEnrollment {
  type: 'resume_enrollment';
  enrollmentId: string;
}

export interface PlannerActionCreateTask {
  type: 'create_task';
  enrollmentId: string;
  stepKey: string;
  kind: TaskKind;
  templateKey?: string | null;
  title: string;
  details?: string | null;
  dueAt: Date;
}

export interface PlannerActionUpdateTask {
  type: 'update_task';
  taskId: string;
  status?: TaskStatus;
  result?: string | null;
  cancelReason?: string | null;
  dueAt?: Date;
  details?: string | null;
}

export interface PlannerActionSetFlag {
  type: 'set_flag';
  updates: Partial<SalesLeadFlags>;
}

export interface PlannerActionUpdateContext {
  type: 'update_context';
  enrollmentId: string;
  context: Record<string, any>;
}

export type PlannerAction =
  | PlannerActionStartEnrollment
  | PlannerActionCancelEnrollment
  | PlannerActionCompleteEnrollment
  | PlannerActionPauseEnrollment
  | PlannerActionResumeEnrollment
  | PlannerActionCreateTask
  | PlannerActionUpdateTask
  | PlannerActionSetFlag
  | PlannerActionUpdateContext;

export interface PlannerResult {
  actions: PlannerAction[];
  statusOverride?: string | null;
  toast?: string | { title: string; description?: string } | null;
  blockedReason?: string | null;
  notes?: string | null;
}
