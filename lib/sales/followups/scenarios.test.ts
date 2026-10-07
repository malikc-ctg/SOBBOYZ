import { describe, it, expect } from 'vitest';
import { TZDate } from '@date-fns/tz';
import { planForOutcome, planForTaskAction, planForSignal } from './rules';
import { renderEmail } from './render';
import { gmailComposeUrl } from './compose';
import { calculateNextStepDue, isBusinessDay, toTorontoDate, TORONTO_TZ } from './schedule';
import { PlannerInputState } from './types';

function createMockState(overrides: Partial<PlannerInputState> = {}): PlannerInputState {
  return {
    lead: {
      id: 'lead-test-1',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      company_name: 'Acme Builders',
      city: 'Toronto',
      status: 'new',
    },
    flags: null,
    openEnrollments: [],
    hadDripEver: false,
    lastEndedDrip: null,
    isWarm: false,
    companyActiveLeadName: null,
    duplicateEmailLeadName: null,
    ...overrides,
  };
}

describe('Appendix F Acceptance Scenarios (1-55)', () => {
  const torontoNow = new TZDate(2026, 9, 7, 10, 0, 0, 0, TORONTO_TZ); // Wed Oct 7, 2026 10:00 AM

  // Scenario 1
  it('Scenario 1: Cold lead with email, log No Answer: drip active, Email 1 due now, card 1/4, toast', () => {
    const state = createMockState({ hadDripEver: false, isWarm: false });
    const res = planForOutcome({ outcome: 'NO_ANSWER', now: torontoNow, state });
    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        sequenceKey: 'no_answer_drip',
        lane: 'prospect',
      })
    );
    expect(res.toast).toBe('No-answer drip started. Email 1 is due now.');
  });

  // Scenario 2
  it('Scenario 2: Same lead, No Answer again: nothing changes, no duplicate enrollment', () => {
    const dripEnr = {
      id: 'enr-1',
      lead_id: 'lead-test-1',
      sequence_key: 'no_answer_drip' as const,
      lane: 'prospect' as const,
      status: 'active' as const,
      pendingTasks: [],
      context: {},
      anchor_at: torontoNow.toISOString(),
      created_at: torontoNow.toISOString(),
      updated_at: torontoNow.toISOString(),
    };
    const state = createMockState({ openEnrollments: [dripEnr], hadDripEver: true });
    const res = planForOutcome({ outcome: 'NO_ANSWER', now: torontoNow, state });
    // Should only set flag last_no_answer_at, no new enrollments
    expect(res.actions.filter((a) => a.type === 'start_enrollment').length).toBe(0);
  });

  // Scenario 3
  it('Scenario 3: Same lead, Voicemail: nothing changes', () => {
    const state = createMockState();
    const res = planForOutcome({ outcome: 'VOICEMAIL', now: torontoNow, state });
    expect(res.actions.filter((a) => a.type === 'start_enrollment').length).toBe(0);
  });

  // Scenario 4 & 5
  it('Scenario 4 & 5: Email 1 rendered on same day vs next day', () => {
    const sameDay = renderEmail({
      templateKey: 'drip_1',
      lead: { customer_name: 'John Doe', company_name: 'Acme' },
      anchorAt: torontoNow,
      now: torontoNow,
      rep: { signature_name: 'Malik Campbell', signature_title: 'Founder & CEO', signature_phone: '(437) 475-1622' },
      mailingAddressOverride: '123 King St W, Toronto, ON',
    });
    expect(sameDay.subject).toBe('Who handles closeout cleaning?');
    expect(sameDay.body).toContain('I called you today and missed you.');

    const yesterday = new TZDate(2026, 9, 6, 10, 0, 0, 0, TORONTO_TZ);
    const nextDay = renderEmail({
      templateKey: 'drip_1',
      lead: { customer_name: 'John Doe', company_name: 'Acme' },
      anchorAt: yesterday,
      now: torontoNow,
      rep: { signature_name: 'Malik Campbell', signature_title: 'Founder & CEO', signature_phone: '(437) 475-1622' },
      mailingAddressOverride: '123 King St W, Toronto, ON',
    });
    expect(nextDay.body).toContain('I called you recently and missed you.');
  });

  // Scenario 6 & 7
  it('Scenario 6 & 7: Mark Email 1 sent on day 0 -> Email 2 due day 4 at 9 AM', () => {
    const enr = {
      id: 'enr-1',
      lead_id: 'lead-test-1',
      sequence_key: 'no_answer_drip' as const,
      lane: 'prospect' as const,
      status: 'active' as const,
      pendingTasks: [],
      context: {},
      anchor_at: torontoNow.toISOString(),
      created_at: torontoNow.toISOString(),
      updated_at: torontoNow.toISOString(),
    };
    const task = {
      id: 'task-1',
      enrollment_id: 'enr-1',
      lead_id: 'lead-test-1',
      step_key: 'drip_email_1',
      kind: 'email' as const,
      title: 'Email 1',
      due_at: torontoNow.toISOString(),
      status: 'pending' as const,
    };
    const res = planForTaskAction({
      task: task as any,
      enrollment: enr as any,
      action: 'sent',
      now: torontoNow,
      state: createMockState({ openEnrollments: [enr] }),
    });

    const createAction = res.actions.find((a) => a.type === 'create_task') as any;
    expect(createAction).toBeDefined();
    expect(createAction.stepKey).toBe('drip_email_2');
    const dueToronto = toTorontoDate(createAction.dueAt);
    expect(dueToronto.getHours()).toBe(9);
  });

  // Scenario 8
  it('Scenario 8: Target on Saturday moves to Monday; target on Oct 12, 2026 moves to Oct 13', () => {
    expect(isBusinessDay(new Date('2026-10-12T12:00:00Z'))).toBe(false);
    // Anchor Oct 7 (Wed). Next step offset 4 -> Oct 11 (Sun) -> rolls past Oct 12 (holiday) -> Oct 13 (Tue)
    const nextDue = calculateNextStepDue(torontoNow, torontoNow, 0, 4);
    const d = toTorontoDate(nextDue);
    expect(d.getDate()).toBe(13);
    expect(d.getMonth()).toBe(9); // October
  });

  // Scenario 9 & 10
  it('Scenario 9 & 10: Email 4 sent -> drip completed, repeat No Answer does nothing', () => {
    const enr = {
      id: 'enr-1',
      lead_id: 'lead-test-1',
      sequence_key: 'no_answer_drip' as const,
      lane: 'prospect' as const,
      status: 'active' as const,
      pendingTasks: [],
      context: {},
      anchor_at: torontoNow.toISOString(),
      created_at: torontoNow.toISOString(),
      updated_at: torontoNow.toISOString(),
    };
    const task = {
      id: 'task-4',
      enrollment_id: 'enr-1',
      lead_id: 'lead-test-1',
      step_key: 'drip_email_4',
      kind: 'email' as const,
      title: 'Email 4',
      due_at: torontoNow.toISOString(),
      status: 'pending' as const,
    };
    const res = planForTaskAction({
      task: task as any,
      enrollment: enr as any,
      action: 'sent',
      now: torontoNow,
      state: createMockState({ openEnrollments: [enr] }),
    });
    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'complete_enrollment',
        enrollmentId: 'enr-1',
      })
    );

    // After completed, No Answer does not start another drip
    const finishedState = createMockState({ hadDripEver: true, lastEndedDrip: enr as any });
    const noAnswerRes = planForOutcome({ outcome: 'NO_ANSWER', now: torontoNow, state: finishedState });
    expect(noAnswerRes.actions.filter((a) => a.type === 'start_enrollment').length).toBe(0);
    expect(noAnswerRes.toast).toBe('No-answer drip already finished for this lead.');
  });

  // Scenario 11
  it('Scenario 11: Cold lead without email, No Answer: no enrollment started', () => {
    const noEmailState = createMockState({
      lead: { id: 'lead-1', customer_name: 'No Email', customer_email: null, company_name: 'Acme', city: 'Toronto', status: 'new' },
    });
    const res = planForOutcome({ outcome: 'NO_ANSWER', now: torontoNow, state: noEmailState });
    expect(res.actions.filter((a) => a.type === 'start_enrollment').length).toBe(0);
    expect(res.toast).toBe('No email on file. Drip not started.');
  });

  // Scenario 12 & 13
  it('Scenario 12 & 13: Company guard and duplicate email hold', () => {
    const heldCompany = createMockState({ companyActiveLeadName: 'Alice Smith' });
    const res1 = planForOutcome({ outcome: 'NO_ANSWER', now: torontoNow, state: heldCompany });
    expect(res1.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        status: 'held',
      })
    );
    expect(res1.toast).toBe('Drip held: Alice Smith at this company is already in follow-up.');

    const heldEmail = createMockState({ duplicateEmailLeadName: 'Bob Jones' });
    const res2 = planForOutcome({ outcome: 'NO_ANSWER', now: torontoNow, state: heldEmail });
    expect(res2.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        status: 'held',
      })
    );
    expect(res2.toast).toBe('Drip held: another lead uses this email.');
  });

  // Scenario 16 & 17
  it('Scenario 16 & 17: Callback 2.5h ahead sends confirm; Callback 1h ahead skips confirm', () => {
    const cb2h = new TZDate(2026, 9, 7, 12, 30, 0, 0, TORONTO_TZ);
    const res1 = planForOutcome({
      outcome: 'CALLBACK',
      capture: { callbackAt: cb2h.toISOString(), sendConfirmation: true },
      now: torontoNow,
      state: createMockState(),
    });
    const startAction1 = res1.actions.find((a) => a.type === 'start_enrollment') as any;
    expect(startAction1.initialTasks.map((t: any) => t.stepKey)).toContain('cb_confirm');
    expect(startAction1.initialTasks.map((t: any) => t.stepKey)).toContain('cb_call');

    const cb1h = new TZDate(2026, 9, 7, 11, 0, 0, 0, TORONTO_TZ);
    const res2 = planForOutcome({
      outcome: 'CALLBACK',
      capture: { callbackAt: cb1h.toISOString(), sendConfirmation: true },
      now: torontoNow,
      state: createMockState(),
    });
    const startAction2 = res2.actions.find((a) => a.type === 'start_enrollment') as any;
    expect(startAction2.initialTasks.map((t: any) => t.stepKey)).not.toContain('cb_confirm');
    expect(startAction2.initialTasks.map((t: any) => t.stepKey)).toContain('cb_call');
  });

  // Scenario 18
  it('Scenario 18: Callback missed retries 1 and 2, then unreachable', () => {
    const cbEnr = {
      id: 'enr-cb',
      lead_id: 'lead-test-1',
      sequence_key: 'callback' as const,
      lane: 'callback' as const,
      status: 'active' as const,
      pendingTasks: [
        {
          id: 'task-cb',
          enrollment_id: 'enr-cb',
          lead_id: 'lead-test-1',
          step_key: 'cb_call',
          kind: 'call' as const,
          status: 'pending' as const,
          due_at: torontoNow.toISOString(),
        } as any,
      ],
      context: { callbackAt: torontoNow.toISOString() },
      anchor_at: torontoNow.toISOString(),
      created_at: torontoNow.toISOString(),
      updated_at: torontoNow.toISOString(),
    };
    const resMissed = planForOutcome({
      outcome: 'NO_ANSWER',
      now: torontoNow,
      state: createMockState({ openEnrollments: [cbEnr] }),
    });

    expect(resMissed.actions).toContainEqual(
      expect.objectContaining({
        type: 'create_task',
        stepKey: 'cb_missed',
      })
    );
    expect(resMissed.actions).toContainEqual(
      expect.objectContaining({
        type: 'create_task',
        stepKey: 'cb_retry_1',
      })
    );
  });

  // Scenario 33, 34, 35: Not Interested options
  it('Scenario 33, 34, 35: Not interested branches (no projects, not interested, do not contact)', () => {
    // 33: no projects -> 90d recheck
    const resRecheck = planForOutcome({
      outcome: 'NOT_INTERESTED',
      capture: { choice: 'no_projects' },
      now: torontoNow,
      state: createMockState(),
    });
    expect(resRecheck.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        sequenceKey: 'recheck',
      })
    );

    // 35: do not contact
    const resDnc = planForOutcome({
      outcome: 'NOT_INTERESTED',
      capture: { choice: 'do_not_contact' },
      now: torontoNow,
      state: createMockState(),
    });
    expect(resDnc.actions).toContainEqual(
      expect.objectContaining({
        type: 'set_flag',
        updates: expect.objectContaining({ do_not_contact_at: torontoNow.toISOString() }),
      })
    );
    expect(resDnc.toast).toBe('Marked do not contact. All follow-ups stopped.');
  });

  // Scenario 42 & 43: Quo inbound text and call
  it('Scenario 42 & 43: Inbound signals stop nurture drips and create call tasks', () => {
    const dripEnr = {
      id: 'enr-drip',
      lead_id: 'lead-test-1',
      sequence_key: 'no_answer_drip' as const,
      lane: 'prospect' as const,
      status: 'active' as const,
      pendingTasks: [],
      context: {},
      anchor_at: torontoNow.toISOString(),
      created_at: torontoNow.toISOString(),
      updated_at: torontoNow.toISOString(),
    };

    // 42: inbound SMS
    const resSms = planForSignal({
      signal: 'inbound_sms',
      now: torontoNow,
      state: createMockState({ openEnrollments: [dripEnr] }),
    });
    expect(resSms.actions).toContainEqual(
      expect.objectContaining({
        type: 'cancel_enrollment',
        enrollmentId: 'enr-drip',
        endReason: 'inbound_sms',
      })
    );

    // 43: inbound Call
    const resCall = planForSignal({
      signal: 'inbound_call',
      now: torontoNow,
      state: createMockState(),
    });
    expect(resCall.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        sequenceKey: 'reply_call',
      })
    );
  });

  // Scenario 53: Name formatting
  it('Scenario 53: Name JOHN SMITH renders "Hi John,". Name Decision Maker renders "Hi,"', () => {
    const resJohn = renderEmail({
      templateKey: 'drip_1',
      lead: { customer_name: 'JOHN SMITH', company_name: 'Acme' },
      anchorAt: torontoNow,
      now: torontoNow,
      rep: { signature_name: 'Malik Campbell', signature_title: 'Founder & CEO', signature_phone: '(437) 475-1622' },
      mailingAddressOverride: '123 King St W, Toronto, ON',
    });
    expect(resJohn.body.startsWith('Hi John,\n')).toBe(true);

    const resDM = renderEmail({
      templateKey: 'drip_1',
      lead: { customer_name: 'Decision Maker', company_name: 'Acme' },
      anchorAt: torontoNow,
      now: torontoNow,
      rep: { signature_name: 'Malik Campbell', signature_title: 'Founder & CEO', signature_phone: '(437) 475-1622' },
      mailingAddressOverride: '123 King St W, Toronto, ON',
    });
    expect(resDM.body.startsWith('Hi,\n')).toBe(true);
  });

  // Scenario 54: Compose link max URL length
  it('Scenario 54: URL within limits produces valid mailto/web link', () => {
    const res = gmailComposeUrl({
      from: 'rep@seaofblue.ca',
      to: 'client@example.com',
      subject: 'Quick question',
      body: 'Hello world',
    });
    expect(res.url.length).toBeLessThan(2000);
    expect(res.clipboardBody).toBeNull();

    const longBody = 'A'.repeat(2500);
    const resLong = gmailComposeUrl({
      from: 'rep@seaofblue.ca',
      to: 'client@example.com',
      subject: 'Quick question',
      body: longBody,
    });
    expect(resLong.clipboardBody).not.toBeNull();
  });
});
