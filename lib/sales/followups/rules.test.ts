import { describe, it, expect } from 'vitest';
import { planForOutcome, planForTaskAction, planForSignal } from './rules';
import { PlannerInputState } from './types';
import { TZDate } from '@date-fns/tz';

function createMockState(overrides: Partial<PlannerInputState> = {}): PlannerInputState {
  return {
    lead: {
      id: 'lead-1',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      company_name: 'Acme Corp',
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

describe('planForOutcome & Rules R1-R6', () => {
  const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');

  it('R1: starts drip on cold lead with email and No Answer (Scenario 1)', () => {
    const state = createMockState();
    const res = planForOutcome({ outcome: 'NO_ANSWER', now, state });

    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        sequenceKey: 'no_answer_drip',
        status: 'active',
      })
    );
    expect(res.toast).toBe('No-answer drip started. Email 1 is due now.');
  });

  it('R1: does not restart drip if lead had drip before (Scenario 2, 10)', () => {
    const state = createMockState({
      hadDripEver: true,
      lastEndedDrip: { id: 'drip-old', sequence_key: 'no_answer_drip', status: 'completed' } as any,
    });
    const res = planForOutcome({ outcome: 'NO_ANSWER', now, state });
    expect(res.actions.filter((a) => a.type === 'start_enrollment')).toHaveLength(0);
    expect(res.toast).toBe('No-answer drip already finished for this lead.');
  });

  it('R1: does not start drip on warm lead', () => {
    const state = createMockState({ isWarm: true });
    const res = planForOutcome({ outcome: 'NO_ANSWER', now, state });
    expect(res.actions.filter((a) => a.type === 'start_enrollment')).toHaveLength(0);
  });

  it('R1: sets needs_email flag when email is missing (Scenario 11)', () => {
    const state = createMockState({
      lead: { id: 'lead-no-email', customer_name: 'John Doe', customer_email: null },
    });
    const res = planForOutcome({ outcome: 'NO_ANSWER', now, state });
    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'set_flag',
        updates: expect.objectContaining({ needs_email_since: expect.any(String) }),
      })
    );
    expect(res.toast).toBe('No email on file. Drip not started.');
  });

  it('R1: creates held enrollment on company guard (Scenario 12)', () => {
    const state = createMockState({ companyActiveLeadName: 'Alice Smith' });
    const res = planForOutcome({ outcome: 'NO_ANSWER', now, state });
    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        sequenceKey: 'no_answer_drip',
        status: 'held',
        holdReason: 'company_active',
      })
    );
    expect(res.toast).toContain('Alice Smith at this company is already in follow-up');
  });

  it('R1: creates held enrollment on duplicate email guard (Scenario 13)', () => {
    const state = createMockState({ duplicateEmailLeadName: 'Bob Brown' });
    const res = planForOutcome({ outcome: 'NO_ANSWER', now, state });
    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        status: 'held',
        holdReason: 'duplicate_email',
      })
    );
    expect(res.toast).toBe('Drip held: another lead uses this email.');
  });

  it('Pick Up during drip supersedes drip and starts pick-up follow-up (Scenario 14)', () => {
    const dripEnr = {
      id: 'enr-drip',
      lead_id: 'lead-1',
      sequence_key: 'no_answer_drip' as const,
      lane: 'prospect' as const,
      status: 'active' as const,
      pendingTasks: [],
      context: {},
      anchor_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const state = createMockState({ openEnrollments: [dripEnr] });

    const res = planForOutcome({
      outcome: 'CONVO',
      capture: { callNote: 'talking about two sites', nextStep: 'send quote' },
      now,
      state,
    });

    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'cancel_enrollment',
        enrollmentId: 'enr-drip',
        endReason: 'superseded:CONVO',
      })
    );
    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        sequenceKey: 'pickup_followup',
        status: 'active',
      })
    );
  });

  it('R6: Info Sent while wt_quote is pending completes walkthrough and starts quote follow-up (Scenario 25)', () => {
    const wtEnr = {
      id: 'enr-wt',
      lead_id: 'lead-1',
      sequence_key: 'walkthrough' as const,
      lane: 'prospect' as const,
      status: 'active' as const,
      context: { quoteAmount: '$4,000', scopePhase: 'Final clean', siteAddress: '100 Main St' },
      pendingTasks: [
        {
          id: 'task-quote',
          enrollment_id: 'enr-wt',
          step_key: 'wt_quote',
          kind: 'email' as const,
          status: 'pending' as const,
        } as any,
      ],
      anchor_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const state = createMockState({ openEnrollments: [wtEnr] });

    const res = planForOutcome({
      outcome: 'INFO_SENT',
      now,
      state,
    });

    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'update_task',
        taskId: 'task-quote',
        status: 'done',
        result: 'sent_outside_app',
      })
    );
    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'complete_enrollment',
        enrollmentId: 'enr-wt',
      })
    );
    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        sequenceKey: 'quote_followup',
      })
    );
    expect(res.statusOverride).toBe('quoted');
  });
});

describe('planForSignal & Rule R7', () => {
  const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');

  it('R7: cancels nurture enrollments when prospect replies and sets reply_call or reply_info (Scenario 36)', () => {
    const dripEnr = {
      id: 'enr-drip',
      lead_id: 'lead-1',
      sequence_key: 'no_answer_drip' as const,
      lane: 'prospect' as const,
      status: 'active' as const,
      pendingTasks: [],
      context: {},
      anchor_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const state = createMockState({ openEnrollments: [dripEnr] });

    const res = planForSignal({
      signal: 'replied',
      payload: { kind: 'wants_info' },
      now,
      state,
    });

    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'cancel_enrollment',
        enrollmentId: 'enr-drip',
        endReason: 'replied',
      })
    );
    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'start_enrollment',
        sequenceKey: 'reply_info',
      })
    );
  });

  it('unsubscribe cancels pending email tasks and nurture drips (Scenario 41)', () => {
    const pickupEnr = {
      id: 'enr-pickup',
      lead_id: 'lead-1',
      sequence_key: 'pickup_followup' as const,
      lane: 'prospect' as const,
      status: 'active' as const,
      pendingTasks: [
        { id: 'task-email', step_key: 'pickup_day3', kind: 'email' as const, status: 'pending' as const } as any,
        { id: 'task-call', step_key: 'pickup_checkin', kind: 'call' as const, status: 'pending' as const } as any,
      ],
      context: {},
      anchor_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const state = createMockState({ openEnrollments: [pickupEnr] });

    const res = planForSignal({
      signal: 'unsubscribe',
      now,
      state,
    });

    expect(res.actions).toContainEqual(
      expect.objectContaining({
        type: 'update_task',
        taskId: 'task-email',
        status: 'cancelled',
        cancelReason: 'opted_out',
      })
    );
    // Call task should not be cancelled
    expect(res.actions.find((a) => a.type === 'update_task' && a.taskId === 'task-call')).toBeUndefined();
  });
});
