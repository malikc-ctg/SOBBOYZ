import { SequenceKey, Lane, TaskKind } from './types';

export interface SequenceStepDef {
  stepKey: string;
  kind: TaskKind;
  templateKey?: string;
  title: string;
  details?: string;
  dayOffset?: number; // for Day N email steps
  hour?: number;
}

export interface SequenceDef {
  key: SequenceKey;
  lane: Lane;
  label: string;
  linearSteps: SequenceStepDef[];
}

export const SEQUENCES: Record<SequenceKey, SequenceDef> = {
  no_answer_drip: {
    key: 'no_answer_drip',
    lane: 'prospect',
    label: 'No-answer drip',
    linearSteps: [
      { stepKey: 'drip_email_1', kind: 'email', templateKey: 'drip_1', title: 'Email 1: Who handles closeout cleaning?', dayOffset: 0 },
      { stepKey: 'drip_email_2', kind: 'email', templateKey: 'drip_2', title: 'Email 2: Next closeout', dayOffset: 4 },
      { stepKey: 'drip_email_3', kind: 'email', templateKey: 'drip_3', title: 'Email 3: Project finishing soon?', dayOffset: 9 },
      { stepKey: 'drip_email_4', kind: 'email', templateKey: 'drip_4', title: 'Email 4: Right person for closeout cleaning?', dayOffset: 14 },
    ],
  },
  pickup_followup: {
    key: 'pickup_followup',
    lane: 'prospect',
    label: 'Pick-up follow-up',
    linearSteps: [
      { stepKey: 'pickup_recap', kind: 'email', templateKey: 'pickup_recap', title: 'Send the call recap (within 2 hours)', dayOffset: 0 },
      { stepKey: 'pickup_day3', kind: 'email', templateKey: 'pickup_day3', title: 'Email: Update on project?', dayOffset: 3 },
      { stepKey: 'pickup_day7', kind: 'email', templateKey: 'pickup_day7', title: 'Email: Pricing by phase', dayOffset: 7 },
      { stepKey: 'pickup_day14', kind: 'email', templateKey: 'pickup_day14', title: 'Email: Should I check back later?', dayOffset: 14 },
      { stepKey: 'pickup_checkin', kind: 'call', title: 'Check-in call', details: 'Ask when their next project finishes.', hour: 10 },
    ],
  },
  info_sent_followup: {
    key: 'info_sent_followup',
    lane: 'prospect',
    label: 'Info sent follow-up',
    linearSteps: [
      { stepKey: 'info_day2', kind: 'email', templateKey: 'info_day2', title: 'Email: The info I sent', dayOffset: 2 },
      { stepKey: 'info_day6', kind: 'email', templateKey: 'info_day6', title: 'Email: Fixed price for your next project', dayOffset: 6 },
      { stepKey: 'info_day12', kind: 'email', templateKey: 'info_day12', title: 'Email: Closing the loop', dayOffset: 12 },
      { stepKey: 'info_checkin', kind: 'call', title: 'Check-in call', details: 'Ask if the info covered what they need and when their next project finishes.', hour: 10 },
    ],
  },
  walkthrough: {
    key: 'walkthrough',
    lane: 'prospect',
    label: 'Walkthrough',
    linearSteps: [
      { stepKey: 'wt_confirm', kind: 'email', templateKey: 'wt_confirm', title: 'Send the walkthrough confirmation' },
      { stepKey: 'wt_prep', kind: 'todo', title: 'Prep for the walkthrough' },
      { stepKey: 'wt_visit', kind: 'todo', title: 'Walkthrough on site' },
    ],
  },
  quote_followup: {
    key: 'quote_followup',
    lane: 'prospect',
    label: 'Quote follow-up',
    linearSteps: [
      { stepKey: 'quote_day2', kind: 'email', templateKey: 'quote_day2', title: 'Email: Questions on the quote?', dayOffset: 2 },
      { stepKey: 'quote_day5', kind: 'email', templateKey: 'quote_day5', title: 'Email: Locking in your date', dayOffset: 5 },
      { stepKey: 'quote_day10', kind: 'email', templateKey: 'quote_day10', title: 'Email: Should I keep the quote open?', dayOffset: 10 },
      { stepKey: 'quote_checkin', kind: 'call', title: 'Call about the quote', hour: 10 },
    ],
  },
  callback: {
    key: 'callback',
    lane: 'callback',
    label: 'Callback',
    linearSteps: [
      { stepKey: 'cb_confirm', kind: 'email', templateKey: 'cb_confirm', title: 'Send the callback confirmation' },
      { stepKey: 'cb_call', kind: 'call', title: 'Callback' },
    ],
  },
  job_won: {
    key: 'job_won',
    lane: 'customer',
    label: 'Customer',
    linearSteps: [
      { stepKey: 'won_thanks', kind: 'email', templateKey: 'won_thanks', title: 'Send the thank-you email' },
      { stepKey: 'won_ops_handoff', kind: 'todo', title: 'Hand off to operations' },
      { stepKey: 'won_completion_check', kind: 'todo', title: 'Was the job completed?' },
    ],
  },
  recheck: {
    key: 'recheck',
    lane: 'prospect',
    label: 'Recheck',
    linearSteps: [
      { stepKey: 'recheck_call', kind: 'call', title: '90-day recheck call', hour: 10 },
    ],
  },
  referral_intro: {
    key: 'referral_intro',
    lane: 'prospect',
    label: 'Referral intro',
    linearSteps: [
      { stepKey: 'ref_intro', kind: 'email', templateKey: 'ref_intro', title: 'Send the referral intro' },
      { stepKey: 'ref_call', kind: 'call', title: 'Call referred contact', hour: 10 },
    ],
  },
  reply_call: {
    key: 'reply_call',
    lane: 'prospect',
    label: 'Reply',
    linearSteps: [
      { stepKey: 'reply_call', kind: 'call', title: 'They replied and want to talk' },
    ],
  },
  reply_info: {
    key: 'reply_info',
    lane: 'prospect',
    label: 'Reply',
    linearSteps: [
      { stepKey: 'reply_info', kind: 'todo', title: 'Send the one-pager, then log Info Sent' },
    ],
  },
};
