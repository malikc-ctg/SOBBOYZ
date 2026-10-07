/**
 * Pure planner rules for SOB Sales Follow-Up Engine (spec 5.5).
 * State in, list of actions out. No I/O.
 */

import {
  SequenceKey,
  FollowupEnrollment,
  FollowupTask,
  PlannerInputState,
  PlannerResult,
  PlannerAction,
} from './types';
import {
  calculateDayNDue,
  calculateNextStepDue,
  nextBusinessDayAt,
  addBusinessDaysAt,
  prevBusinessDayAt,
  formatWhenFuture,
  formatTorontoShortDay,
  formatTorontoDay,
  formatTorontoTime,
} from './schedule';
import { SEQUENCES } from './sequences';

export interface PlanOutcomeInput {
  outcome: string;
  capture?: Record<string, any> | null;
  now?: Date;
  state: PlannerInputState;
}

export function planForOutcome(input: PlanOutcomeInput): PlannerResult {
  const actions: PlannerAction[] = [];
  const now = input.now || new Date();
  const rawOutcome = String(input.outcome || '').toUpperCase();
  const state = input.state;
  const lead = state.lead;
  const capture = input.capture || {};

  // 1. Ignore STATUS_MOVE, SMS_*, BAD_NUMBER, and unknown outcomes
  if (
    rawOutcome === 'STATUS_MOVE' ||
    rawOutcome.startsWith('SMS_') ||
    rawOutcome === 'BAD_NUMBER' ||
    !rawOutcome
  ) {
    return { actions: [] };
  }

  // 2. Normalize legacy outcomes
  let outcome = rawOutcome;
  if (outcome === 'SEND_QUOTE') outcome = 'INFO_SENT';
  if (outcome === 'SALE') outcome = 'JOB_WON';
  let isGatekeeper = false;
  if (outcome === 'GATEKEEPER') {
    outcome = 'CONVO';
    isGatekeeper = true;
  }

  // 3. OUT_OF_SERVICE: cancel every open enrollment and stop
  if (outcome === 'OUT_OF_SERVICE') {
    for (const enr of state.openEnrollments) {
      actions.push({
        type: 'cancel_enrollment',
        enrollmentId: enr.id,
        endReason: 'out_of_service',
        cancelTasksReason: 'out_of_service',
      });
    }
    return { actions, toast: null };
  }

  // 4. Blocked if Do Not Contact
  if (state.flags?.do_not_contact_at) {
    return { actions: [], blockedReason: 'blocked_dnc' };
  }

  // Identify open enrollments by lane
  const prospectEnr = state.openEnrollments.find((e) => e.lane === 'prospect');
  const callbackEnr = state.openEnrollments.find((e) => e.lane === 'callback');

  const isConnected = [
    'CONVO',
    'CALLBACK',
    'INFO_SENT',
    'WALKTHROUGH',
    'JOB_WON',
    'NOT_INTERESTED',
  ].includes(outcome);

  // 5. Rule R3 & R4: Resolve due call tasks on the lead due at or before now + 30 mins
  const cutoffMs = now.getTime() + 30 * 60 * 1000;
  for (const enr of state.openEnrollments) {
    for (const t of enr.pendingTasks) {
      if (t.kind === 'call') {
        const dueMs = new Date(t.due_at).getTime();
        if (dueMs <= cutoffMs) {
          if (isConnected) {
            actions.push({
              type: 'update_task',
              taskId: t.id,
              status: 'done',
              result: 'connected',
            });
            // If it's a callback or checkin or reply_call, complete enrollment
            if (enr.sequence_key === 'callback') {
              actions.push({
                type: 'complete_enrollment',
                enrollmentId: enr.id,
                endReason: 'completed',
              });
            } else if (
              t.step_key === 'pickup_checkin' ||
              t.step_key === 'info_checkin' ||
              t.step_key === 'quote_checkin' ||
              t.step_key === 'reply_call'
            ) {
              actions.push({
                type: 'complete_enrollment',
                enrollmentId: enr.id,
                endReason: 'completed',
              });
            }
          } else if (outcome === 'NO_ANSWER' || outcome === 'VOICEMAIL') {
            actions.push({
              type: 'update_task',
              taskId: t.id,
              status: 'done',
              result: 'no_answer',
            });

            // Follow-on logic:
            if (enr.sequence_key === 'callback') {
              // Rule R4 Missed callback:
              if (t.step_key === 'cb_call') {
                actions.push({
                  type: 'create_task',
                  enrollmentId: enr.id,
                  stepKey: 'cb_missed',
                  kind: 'email',
                  templateKey: 'cb_missed',
                  title: 'Email: Missed you',
                  dueAt: now,
                });
                const cbAt = enr.context.callbackAt ? new Date(enr.context.callbackAt) : now;
                const nextRetryDate = nextBusinessDayAt(now, cbAt.getHours(), cbAt.getMinutes());
                actions.push({
                  type: 'create_task',
                  enrollmentId: enr.id,
                  stepKey: 'cb_retry_1',
                  kind: 'call',
                  title: 'Retry callback (attempt 2)',
                  dueAt: nextRetryDate,
                });
              } else if (t.step_key === 'cb_retry_1') {
                const cbAt = enr.context.callbackAt ? new Date(enr.context.callbackAt) : now;
                const nextRetryDate = addBusinessDaysAt(now, 2, cbAt.getHours(), cbAt.getMinutes());
                actions.push({
                  type: 'create_task',
                  enrollmentId: enr.id,
                  stepKey: 'cb_retry_2',
                  kind: 'call',
                  title: 'Retry callback (attempt 3)',
                  dueAt: nextRetryDate,
                });
              } else if (t.step_key === 'cb_retry_2') {
                actions.push({
                  type: 'complete_enrollment',
                  enrollmentId: enr.id,
                  endReason: 'callback_unreachable',
                });
              }
            } else if (enr.sequence_key === 'recheck' && t.step_key === 'recheck_call') {
              // A.8: NA/VM creates recheck_email
              actions.push({
                type: 'create_task',
                enrollmentId: enr.id,
                stepKey: 'recheck_email',
                kind: 'email',
                templateKey: 'recheck_email',
                title: 'Email: Checking back',
                dueAt: now,
              });
            } else if (enr.sequence_key === 'referral_intro' && t.step_key === 'ref_call') {
              actions.push({
                type: 'complete_enrollment',
                enrollmentId: enr.id,
                endReason: 'completed',
              });
              // Referral ended with NA -> candidate for R1 drip check
            } else if (
              t.step_key === 'pickup_checkin' ||
              t.step_key === 'info_checkin' ||
              t.step_key === 'quote_checkin' ||
              t.step_key === 'reply_call'
            ) {
              actions.push({
                type: 'complete_enrollment',
                enrollmentId: enr.id,
                endReason: 'completed',
              });
            }
          }
        }
      }
    }
  }

  // 6. Matrix & Rule Handling
  let statusOverride: string | null = null;
  let toast: string | { title: string; description?: string } | null = null;

  if (outcome === 'NO_ANSWER') {
    actions.push({
      type: 'set_flag',
      updates: { last_no_answer_at: now.toISOString() },
    });

    // Check Rule R1 Drip Start
    const r1Result = evaluateRuleR1(state, now);
    if (r1Result.action) {
      actions.push(r1Result.action);
    }
    if (r1Result.toast) {
      toast = r1Result.toast;
    }
  } else if (outcome === 'VOICEMAIL') {
    // Voicemail never starts or stops drip
  } else if (outcome === 'CONVO') {
    actions.push({
      type: 'set_flag',
      updates: { warm_at: now.toISOString() },
    });

    const isNoFollowup = isGatekeeper || capture.noFollowup === true;

    if (isNoFollowup) {
      // Cancel drip if open
      if (prospectEnr?.sequence_key === 'no_answer_drip') {
        actions.push({
          type: 'cancel_enrollment',
          enrollmentId: prospectEnr.id,
          endReason: 'superseded:CONVO',
          cancelTasksReason: 'superseded',
        });
      }
      if (prospectEnr?.sequence_key === 'recheck' || prospectEnr?.sequence_key === 'reply_call' || prospectEnr?.sequence_key === 'reply_info') {
        actions.push({
          type: 'complete_enrollment',
          enrollmentId: prospectEnr.id,
          endReason: 'completed',
        });
      }
      if (callbackEnr) {
        actions.push({
          type: 'complete_enrollment',
          enrollmentId: callbackEnr.id,
          endReason: 'completed',
        });
      }
    } else {
      // Pick Up with follow-up
      if (callbackEnr) {
        actions.push({
          type: 'complete_enrollment',
          enrollmentId: callbackEnr.id,
          endReason: 'completed',
        });
      }

      if (
        prospectEnr &&
        ['info_sent_followup', 'walkthrough', 'quote_followup'].includes(prospectEnr.sequence_key)
      ) {
        // Keep open; save note; optional one-off recap
        const existingNotes = Array.isArray(prospectEnr.context.notes) ? [...prospectEnr.context.notes] : [];
        if (capture.callNote) existingNotes.push(capture.callNote);
        actions.push({
          type: 'update_context',
          enrollmentId: prospectEnr.id,
          context: {
            ...prospectEnr.context,
            notes: existingNotes,
            lastCallNote: capture.callNote,
            lastNextStep: capture.nextStep,
          },
        });

        if (capture.sendRecap) {
          const extraKey = `extra_recap_${Date.now()}`;
          actions.push({
            type: 'create_task',
            enrollmentId: prospectEnr.id,
            stepKey: extraKey,
            kind: 'email',
            templateKey: 'pickup_recap',
            title: 'Send the call recap (within 2 hours)',
            dueAt: now,
          });
        }
        const seqLabel =
          prospectEnr.sequence_key === 'info_sent_followup'
            ? 'Info sent'
            : prospectEnr.sequence_key === 'walkthrough'
            ? 'Walkthrough'
            : 'Quote';
        toast = `Note saved to the ${seqLabel} follow-up.`;
      } else {
        // Cancel drip or supersede open prospect
        if (prospectEnr) {
          actions.push({
            type: 'cancel_enrollment',
            enrollmentId: prospectEnr.id,
            endReason: 'superseded:CONVO',
            cancelTasksReason: 'superseded',
          });
        }

        // Start Pick-up follow-up
        actions.push({
          type: 'start_enrollment',
          sequenceKey: 'pickup_followup',
          lane: 'prospect',
          status: 'active',
          anchorAt: now,
          context: {
            callNote: capture.callNote || '',
            nextStep: capture.nextStep || '',
            projectName: capture.projectName || '',
            notes: capture.callNote ? [capture.callNote] : [],
          },
          initialTasks: [
            {
              stepKey: 'pickup_recap',
              kind: 'email',
              templateKey: 'pickup_recap',
              title: 'Send the call recap (within 2 hours)',
              dueAt: now,
            },
          ],
        });
        toast = 'Pick-up follow-up started. Send the recap within 2 hours.';
      }
    }
  } else if (outcome === 'CALLBACK') {
    actions.push({
      type: 'set_flag',
      updates: { warm_at: now.toISOString() },
    });

    if (prospectEnr?.sequence_key === 'no_answer_drip') {
      actions.push({
        type: 'cancel_enrollment',
        enrollmentId: prospectEnr.id,
        endReason: 'superseded:CALLBACK',
        cancelTasksReason: 'superseded',
      });
    }

    if (callbackEnr) {
      actions.push({
        type: 'cancel_enrollment',
        enrollmentId: callbackEnr.id,
        endReason: 'superseded:CALLBACK',
        cancelTasksReason: 'superseded',
      });
    }

    const cbAt = capture.callbackAt ? new Date(capture.callbackAt) : nextBusinessDayAt(now, 10, 0);
    const sendConfirm = capture.sendConfirmation !== false;
    const diffHours = (cbAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    const hasEmail = Boolean(lead.customer_email && lead.customer_email.includes('@'));
    const shouldSkipConfirm = !sendConfirm || !hasEmail || diffHours < 2;

    const initialTasks: any[] = [];
    if (!shouldSkipConfirm) {
      initialTasks.push({
        stepKey: 'cb_confirm',
        kind: 'email',
        templateKey: 'cb_confirm',
        title: 'Send the callback confirmation',
        dueAt: now,
      });
    }
    initialTasks.push({
      stepKey: 'cb_call',
      kind: 'call',
      title: 'Callback',
      details: capture.note || '',
      dueAt: cbAt,
    });

    actions.push({
      type: 'start_enrollment',
      sequenceKey: 'callback',
      lane: 'callback',
      status: 'active',
      anchorAt: now,
      context: {
        callbackAt: cbAt.toISOString(),
        note: capture.note || '',
        sendConfirmation: sendConfirm,
      },
      initialTasks,
    });

    const whenFuture = formatWhenFuture(cbAt, now);
    toast = `Callback set for ${whenFuture}.`;
  } else if (outcome === 'INFO_SENT') {
    actions.push({
      type: 'set_flag',
      updates: { warm_at: now.toISOString() },
    });

    if (callbackEnr) {
      actions.push({
        type: 'complete_enrollment',
        enrollmentId: callbackEnr.id,
        endReason: 'completed',
      });
    }

    // Rule R6 check: walkthrough open with wt_quote pending
    if (prospectEnr?.sequence_key === 'walkthrough') {
      const wtQuoteTask = prospectEnr.pendingTasks.find((t) => t.step_key === 'wt_quote');
      if (wtQuoteTask) {
        actions.push({
          type: 'update_task',
          taskId: wtQuoteTask.id,
          status: 'done',
          result: 'sent_outside_app',
        });
        actions.push({
          type: 'complete_enrollment',
          enrollmentId: prospectEnr.id,
          endReason: 'completed',
        });

        // Start quote_followup
        const quoteDay2Due = calculateDayNDue(now, 2);
        actions.push({
          type: 'start_enrollment',
          sequenceKey: 'quote_followup',
          lane: 'prospect',
          status: 'active',
          anchorAt: now,
          context: {
            quoteAmount: prospectEnr.context.quoteAmount || capture.amount || '',
            scopePhase: prospectEnr.context.scopePhase || capture.scope || '',
            siteAddress: prospectEnr.context.siteAddress || '',
          },
          initialTasks: [
            {
              stepKey: 'quote_day2',
              kind: 'email',
              templateKey: 'quote_day2',
              title: 'Email: Questions on the quote?',
              dueAt: quoteDay2Due,
            },
          ],
        });
        statusOverride = 'quoted';
        toast = 'Quote follow-up started. First email in 2 days.';
        return { actions, statusOverride, toast };
      } else {
        // walkthrough open but not at quote step: keep, save note
        const existingNotes = Array.isArray(prospectEnr.context.notes) ? [...prospectEnr.context.notes] : [];
        existingNotes.push('Info sent');
        actions.push({
          type: 'update_context',
          enrollmentId: prospectEnr.id,
          context: { ...prospectEnr.context, notes: existingNotes },
        });
        toast = 'Note saved to the Walkthrough follow-up.';
        return { actions, toast };
      }
    } else if (prospectEnr?.sequence_key === 'quote_followup') {
      // Keep, save note
      const existingNotes = Array.isArray(prospectEnr.context.notes) ? [...prospectEnr.context.notes] : [];
      existingNotes.push('Info sent');
      actions.push({
        type: 'update_context',
        enrollmentId: prospectEnr.id,
        context: { ...prospectEnr.context, notes: existingNotes },
      });
      toast = 'Note saved to the Quote follow-up.';
      return { actions, toast };
    }

    // Otherwise supersede open prospect nurture
    if (prospectEnr) {
      actions.push({
        type: 'cancel_enrollment',
        enrollmentId: prospectEnr.id,
        endReason: 'superseded:INFO_SENT',
        cancelTasksReason: 'superseded',
      });
    }

    const infoDay2Due = calculateDayNDue(now, 2);
    actions.push({
      type: 'start_enrollment',
      sequenceKey: 'info_sent_followup',
      lane: 'prospect',
      status: 'active',
      anchorAt: now,
      context: {},
      initialTasks: [
        {
          stepKey: 'info_day2',
          kind: 'email',
          templateKey: 'info_day2',
          title: 'Email: The info I sent',
          dueAt: infoDay2Due,
        },
      ],
    });
    toast = 'Info sent follow-up started. First email in 2 days.';
  } else if (outcome === 'WALKTHROUGH') {
    actions.push({
      type: 'set_flag',
      updates: { warm_at: now.toISOString() },
    });

    if (callbackEnr) {
      actions.push({
        type: 'complete_enrollment',
        enrollmentId: callbackEnr.id,
        endReason: 'completed',
      });
    }

    const wtAt = capture.walkthroughAt ? new Date(capture.walkthroughAt) : nextBusinessDayAt(now, 10, 0);

    // If walkthrough is already open, treat as reschedule (scenario 29 / A.4)
    if (prospectEnr?.sequence_key === 'walkthrough') {
      // Cancel pending prep and visit
      for (const t of prospectEnr.pendingTasks) {
        if (['wt_prep', 'wt_visit', 'wt_reschedule'].includes(t.step_key)) {
          actions.push({
            type: 'update_task',
            taskId: t.id,
            status: 'cancelled',
            cancelReason: 'rescheduled',
          });
        }
      }
      actions.push({
        type: 'update_context',
        enrollmentId: prospectEnr.id,
        context: {
          ...prospectEnr.context,
          ...capture,
          walkthroughAt: wtAt.toISOString(),
        },
      });
      actions.push({
        type: 'create_task',
        enrollmentId: prospectEnr.id,
        stepKey: `wt_rescheduled_${Date.now()}`,
        kind: 'email',
        templateKey: 'wt_rescheduled',
        title: 'Send the new walkthrough time',
        dueAt: now,
      });

      const prepDue = prevBusinessDayAt(wtAt, 16, 0);
      actions.push({
        type: 'create_task',
        enrollmentId: prospectEnr.id,
        stepKey: `wt_prep_${Date.now()}`,
        kind: 'todo',
        title: 'Prep for the walkthrough',
        dueAt: prepDue.getTime() < now.getTime() ? now : prepDue,
      });
      actions.push({
        type: 'create_task',
        enrollmentId: prospectEnr.id,
        stepKey: `wt_visit_${Date.now()}`,
        kind: 'todo',
        title: capture.siteAddress ? `Walkthrough at ${capture.siteAddress}` : 'Walkthrough on site',
        dueAt: wtAt,
      });
      toast = `Walkthrough moved to ${formatTorontoDay(wtAt)} at ${formatTorontoTime(wtAt)}.`;
      return { actions, toast };
    }

    if (prospectEnr) {
      actions.push({
        type: 'cancel_enrollment',
        enrollmentId: prospectEnr.id,
        endReason: 'superseded:WALKTHROUGH',
        cancelTasksReason: 'superseded',
      });
    }

    // New Walkthrough sequence
    const prepDue = prevBusinessDayAt(wtAt, 16, 0);
    actions.push({
      type: 'start_enrollment',
      sequenceKey: 'walkthrough',
      lane: 'prospect',
      status: 'active',
      anchorAt: now,
      context: {
        walkthroughAt: wtAt.toISOString(),
        siteAddress: capture.siteAddress || '',
        siteContactName: capture.siteContactName || '',
        siteContactPhone: capture.siteContactPhone || '',
        scopePhase: capture.scopePhase || '',
        estimatedValue: capture.estimatedValue || '',
        siteNotes: capture.siteNotes || '',
        notes: [],
      },
      initialTasks: [
        {
          stepKey: 'wt_confirm',
          kind: 'email',
          templateKey: 'wt_confirm',
          title: 'Send the walkthrough confirmation',
          dueAt: now,
        },
        {
          stepKey: 'wt_prep',
          kind: 'todo',
          title: 'Prep for the walkthrough',
          dueAt: prepDue.getTime() < now.getTime() ? now : prepDue,
        },
        {
          stepKey: 'wt_visit',
          kind: 'todo',
          title: capture.siteAddress ? `Walkthrough at ${capture.siteAddress}` : 'Walkthrough on site',
          dueAt: wtAt,
        },
      ],
    });
    toast = 'Walkthrough follow-up started. Send the confirmation now.';
  } else if (outcome === 'JOB_WON') {
    actions.push({
      type: 'set_flag',
      updates: { warm_at: now.toISOString() },
    });

    if (prospectEnr) {
      actions.push({
        type: 'cancel_enrollment',
        enrollmentId: prospectEnr.id,
        endReason: 'superseded:JOB_WON',
        cancelTasksReason: 'superseded',
      });
    }
    if (callbackEnr) {
      actions.push({
        type: 'cancel_enrollment',
        enrollmentId: callbackEnr.id,
        endReason: 'superseded:JOB_WON',
        cancelTasksReason: 'superseded',
      });
    }

    const jobDate = capture.jobDate ? new Date(capture.jobDate) : null;
    let completionDue: Date;
    if (jobDate) {
      completionDue = nextBusinessDayAt(jobDate, 10, 0);
    } else {
      completionDue = addBusinessDaysAt(now, 10, 10, 0); // ~14 calendar days at 10:00 AM
    }

    actions.push({
      type: 'start_enrollment',
      sequenceKey: 'job_won',
      lane: 'customer',
      status: 'active',
      anchorAt: now,
      context: {
        jobTotal: capture.jobTotal || '',
        scope: capture.scope || '',
        siteAddress: capture.siteAddress || '',
        jobDate: capture.jobDate || '',
      },
      initialTasks: [
        {
          stepKey: 'won_thanks',
          kind: 'email',
          templateKey: 'won_thanks',
          title: 'Send the thank-you email',
          dueAt: now,
        },
        {
          stepKey: 'won_ops_handoff',
          kind: 'todo',
          title: 'Hand off to operations',
          details: `Create the job, assign the crew, confirm site access. Value: ${capture.jobTotal || ''}. Scope: ${capture.scope || ''}. Site: ${capture.siteAddress || ''}. Date: ${capture.jobDate || ''}.`,
          dueAt: now,
        },
        {
          stepKey: 'won_completion_check',
          kind: 'todo',
          title: 'Was the job completed?',
          dueAt: completionDue,
        },
      ],
    });
    toast = 'Customer follow-up started. Send the thank-you email.';
  } else if (outcome === 'NOT_INTERESTED') {
    actions.push({
      type: 'set_flag',
      updates: { warm_at: now.toISOString() },
    });

    const choice = capture.choice || 'not_interested';

    if (choice === 'no_projects') {
      if (prospectEnr) {
        actions.push({
          type: 'cancel_enrollment',
          enrollmentId: prospectEnr.id,
          endReason: 'superseded:NOT_INTERESTED',
          cancelTasksReason: 'superseded',
        });
      }
      if (callbackEnr) {
        actions.push({
          type: 'cancel_enrollment',
          enrollmentId: callbackEnr.id,
          endReason: 'superseded:NOT_INTERESTED',
          cancelTasksReason: 'superseded',
        });
      }

      // Recheck call in 90 days at 10:00 AM on a business day
      const ninetyDaysDue = addBusinessDaysAt(now, 65, 10, 0); // ~90 calendar days
      actions.push({
        type: 'start_enrollment',
        sequenceKey: 'recheck',
        lane: 'prospect',
        status: 'active',
        anchorAt: now,
        context: {
          notInterestedAt: now.toISOString(),
        },
        initialTasks: [
          {
            stepKey: 'recheck_call',
            kind: 'call',
            title: '90-day recheck call',
            details: `They had no projects on ${formatTorontoShortDay(now)}. Ask about upcoming projects.`,
            dueAt: ninetyDaysDue,
          },
        ],
      });
      toast = `Recheck call set for ${formatTorontoShortDay(ninetyDaysDue)}.`;
    } else if (choice === 'not_interested') {
      if (prospectEnr) {
        actions.push({
          type: 'cancel_enrollment',
          enrollmentId: prospectEnr.id,
          endReason: 'manual_stop',
          cancelTasksReason: 'cancelled',
        });
      }
      if (callbackEnr) {
        actions.push({
          type: 'cancel_enrollment',
          enrollmentId: callbackEnr.id,
          endReason: 'manual_stop',
          cancelTasksReason: 'cancelled',
        });
      }
      toast = 'Follow-ups stopped.';
    } else if (choice === 'do_not_contact') {
      actions.push({
        type: 'set_flag',
        updates: { do_not_contact_at: now.toISOString() },
      });
      for (const enr of state.openEnrollments) {
        actions.push({
          type: 'cancel_enrollment',
          enrollmentId: enr.id,
          endReason: 'do_not_contact',
          cancelTasksReason: 'cancelled',
        });
      }
      toast = 'Marked do not contact. All follow-ups stopped.';
    }
  }

  return { actions, statusOverride, toast };
}

/**
 * Evaluates Rule R1 Drip Start.
 */
function evaluateRuleR1(
  state: PlannerInputState,
  now: Date
): { action?: PlannerAction; toast?: string | null } {
  // 1. Cold lead check (R2 is false)
  if (state.isWarm || state.flags?.warm_at) {
    return {};
  }

  // 2. Lead never had a no_answer_drip in any status
  if (state.hadDripEver) {
    if (state.lastEndedDrip) {
      return { toast: 'No-answer drip already finished for this lead.' };
    }
    return {};
  }

  // 3. No open prospect-lane enrollment
  const openProspect = state.openEnrollments.find((e) => e.lane === 'prospect');
  if (openProspect) {
    return {};
  }

  // 4. Not DNC and not unsubscribed
  if (state.flags?.do_not_contact_at) {
    return { toast: 'Marked do not contact. Drip not started.' };
  }
  if (state.flags?.email_opt_out_at) {
    return { toast: 'Unsubscribed. Drip not started.' };
  }

  // 5. Email present, valid, and not bounced
  const email = state.lead.customer_email ? state.lead.customer_email.trim() : '';
  if (!email || !email.includes('@')) {
    return {
      action: {
        type: 'set_flag',
        updates: {
          needs_email_since: now.toISOString(),
          last_no_answer_at: now.toISOString(),
        },
      },
      toast: 'No email on file. Drip not started.',
    };
  }

  if (state.flags?.bounced_email && state.flags.bounced_email.toLowerCase() === email.toLowerCase()) {
    return {
      toast: 'Email bounced. Drip not started.',
    };
  }

  // 6. Guards: company_active or duplicate_email
  if (state.companyActiveLeadName) {
    return {
      action: {
        type: 'start_enrollment',
        sequenceKey: 'no_answer_drip',
        lane: 'prospect',
        status: 'held',
        holdReason: 'company_active',
        anchorAt: now,
        context: { heldOtherLead: state.companyActiveLeadName },
      },
      toast: `Drip held: ${state.companyActiveLeadName} at this company is already in follow-up.`,
    };
  }

  if (state.duplicateEmailLeadName) {
    return {
      action: {
        type: 'start_enrollment',
        sequenceKey: 'no_answer_drip',
        lane: 'prospect',
        status: 'held',
        holdReason: 'duplicate_email',
        anchorAt: now,
        context: { heldOtherLead: state.duplicateEmailLeadName },
      },
      toast: 'Drip held: another lead uses this email.',
    };
  }

  // 7. Otherwise active drip
  return {
    action: {
      type: 'start_enrollment',
      sequenceKey: 'no_answer_drip',
      lane: 'prospect',
      status: 'active',
      anchorAt: now,
      context: {},
      initialTasks: [
        {
          stepKey: 'drip_email_1',
          kind: 'email',
          templateKey: 'drip_1',
          title: 'Email 1: Who handles closeout cleaning?',
          dueAt: now,
        },
      ],
    },
    toast: 'No-answer drip started. Email 1 is due now.',
  };
}

export interface PlanTaskActionInput {
  task: FollowupTask;
  enrollment: FollowupEnrollment & { pendingTasks: FollowupTask[] };
  action: 'sent' | 'skip' | 'done' | 'reschedule' | 'reassign';
  payload?: Record<string, any>;
  now?: Date;
  state: PlannerInputState;
}

export function planForTaskAction(input: PlanTaskActionInput): PlannerResult {
  const actions: PlannerAction[] = [];
  const now = input.now || new Date();
  const { task, enrollment, action, payload = {} } = input;
  const anchor = new Date(enrollment.anchor_at);

  let toast: string | { title: string; description?: string } | null = null;
  let statusOverride: string | null = null;

  if (action === 'sent' || action === 'skip') {
    actions.push({
      type: 'update_task',
      taskId: task.id,
      status: action === 'sent' ? 'done' : 'skipped',
      result: action === 'sent' ? 'sent' : 'skipped',
    });

    // Determine next step
    if (enrollment.sequence_key === 'no_answer_drip') {
      const stepMap: Record<string, { nextStep: string; nextOffset: number; template: string; title: string }> = {
        drip_email_1: { nextStep: 'drip_email_2', nextOffset: 4, template: 'drip_2', title: 'Email 2: Next closeout' },
        drip_email_2: { nextStep: 'drip_email_3', nextOffset: 9, template: 'drip_3', title: 'Email 3: Project finishing soon?' },
        drip_email_3: { nextStep: 'drip_email_4', nextOffset: 14, template: 'drip_4', title: 'Email 4: Right person for closeout cleaning?' },
      };

      const currOffset = task.step_key === 'drip_email_1' ? 0 : task.step_key === 'drip_email_2' ? 4 : 9;
      const next = stepMap[task.step_key];
      if (next) {
        const nextDue = calculateNextStepDue(anchor, now, currOffset, next.nextOffset);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: next.nextStep,
          kind: 'email',
          templateKey: next.template,
          title: next.title,
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: ${next.title}, ${formatTorontoShortDay(nextDue)}.`;
      } else if (task.step_key === 'drip_email_4') {
        actions.push({
          type: 'complete_enrollment',
          enrollmentId: enrollment.id,
          endReason: 'completed',
        });
        toast = 'Follow-up finished.';
      }
    } else if (enrollment.sequence_key === 'pickup_followup') {
      if (task.step_key === 'pickup_recap') {
        const nextDue = calculateNextStepDue(anchor, now, 0, 3);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'pickup_day3',
          kind: 'email',
          templateKey: 'pickup_day3',
          title: 'Email: Update on project?',
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: Email: Update on project?, ${formatTorontoShortDay(nextDue)}.`;
      } else if (task.step_key === 'pickup_day3') {
        const nextDue = calculateNextStepDue(anchor, now, 3, 7);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'pickup_day7',
          kind: 'email',
          templateKey: 'pickup_day7',
          title: 'Email: Pricing by phase',
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: Email: Pricing by phase, ${formatTorontoShortDay(nextDue)}.`;
      } else if (task.step_key === 'pickup_day7') {
        const nextDue = calculateNextStepDue(anchor, now, 7, 14);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'pickup_day14',
          kind: 'email',
          templateKey: 'pickup_day14',
          title: 'Email: Should I check back later?',
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: Email: Should I check back later?, ${formatTorontoShortDay(nextDue)}.`;
      } else if (task.step_key === 'pickup_day14') {
        // 30 days after step 4 completes at 10:00 AM on a business day
        const nextDue = addBusinessDaysAt(now, 22, 10, 0); // ~30 calendar days
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'pickup_checkin',
          kind: 'call',
          title: 'Check-in call',
          details: 'Ask when their next project finishes.',
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: Check-in call, ${formatTorontoShortDay(nextDue)}.`;
      }
    } else if (enrollment.sequence_key === 'info_sent_followup') {
      if (task.step_key === 'info_day2') {
        const nextDue = calculateNextStepDue(anchor, now, 2, 6);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'info_day6',
          kind: 'email',
          templateKey: 'info_day6',
          title: 'Email: Fixed price for your next project',
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: Email: Fixed price, ${formatTorontoShortDay(nextDue)}.`;
      } else if (task.step_key === 'info_day6') {
        const nextDue = calculateNextStepDue(anchor, now, 6, 12);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'info_day12',
          kind: 'email',
          templateKey: 'info_day12',
          title: 'Email: Closing the loop',
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: Email: Closing the loop, ${formatTorontoShortDay(nextDue)}.`;
      } else if (task.step_key === 'info_day12') {
        const nextDue = addBusinessDaysAt(now, 22, 10, 0);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'info_checkin',
          kind: 'call',
          title: 'Check-in call',
          details: 'Ask if the info covered what they need and when their next project finishes.',
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: Check-in call, ${formatTorontoShortDay(nextDue)}.`;
      }
    } else if (enrollment.sequence_key === 'walkthrough') {
      if (task.step_key === 'wt_quote') {
        actions.push({
          type: 'complete_enrollment',
          enrollmentId: enrollment.id,
          endReason: 'completed',
        });
        const quoteDay2Due = calculateDayNDue(now, 2);
        actions.push({
          type: 'start_enrollment',
          sequenceKey: 'quote_followup',
          lane: 'prospect',
          status: 'active',
          anchorAt: now,
          context: {
            quoteAmount: enrollment.context.quoteAmount || payload.amount || '',
            scopePhase: enrollment.context.scopePhase || payload.scope || '',
            siteAddress: enrollment.context.siteAddress || '',
          },
          initialTasks: [
            {
              stepKey: 'quote_day2',
              kind: 'email',
              templateKey: 'quote_day2',
              title: 'Email: Questions on the quote?',
              dueAt: quoteDay2Due,
            },
          ],
        });
        statusOverride = 'quoted';
        toast = 'Quote follow-up started. First email in 2 days.';
      }
    } else if (enrollment.sequence_key === 'quote_followup') {
      if (task.step_key === 'quote_day2') {
        const nextDue = calculateNextStepDue(anchor, now, 2, 5);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'quote_day5',
          kind: 'email',
          templateKey: 'quote_day5',
          title: 'Email: Locking in your date',
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: Email: Locking in your date, ${formatTorontoShortDay(nextDue)}.`;
      } else if (task.step_key === 'quote_day5') {
        const nextDue = calculateNextStepDue(anchor, now, 5, 10);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'quote_day10',
          kind: 'email',
          templateKey: 'quote_day10',
          title: 'Email: Should I keep the quote open?',
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: Email: Should I keep the quote open?, ${formatTorontoShortDay(nextDue)}.`;
      } else if (task.step_key === 'quote_day10') {
        const nextDue = addBusinessDaysAt(now, 5, 10, 0); // 7 calendar days
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'quote_checkin',
          kind: 'call',
          title: 'Call about the quote',
          dueAt: nextDue,
        });
        toast = `${action === 'sent' ? 'Marked sent' : 'Skipped'}. Next: Call about the quote, ${formatTorontoShortDay(nextDue)}.`;
      }
    } else if (enrollment.sequence_key === 'job_won') {
      if (task.step_key === 'won_referral') {
        // next project email 30 days from completion check
      } else if (task.step_key === 'won_next_project') {
        actions.push({
          type: 'complete_enrollment',
          enrollmentId: enrollment.id,
          endReason: 'completed',
        });
        toast = 'Follow-up finished.';
      }
    } else if (enrollment.sequence_key === 'recheck' && task.step_key === 'recheck_email') {
      actions.push({
        type: 'complete_enrollment',
        enrollmentId: enrollment.id,
        endReason: 'completed',
      });
      toast = 'Follow-up finished.';
    }
  } else if (action === 'done') {
    actions.push({
      type: 'update_task',
      taskId: task.id,
      status: 'done',
      result: payload.result || 'done',
    });

    if (task.step_key === 'wt_visit') {
      const res = payload.result;
      if (res === 'completed') {
        // wt_quote due 24h later
        const quoteDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'wt_quote',
          kind: 'email',
          templateKey: 'wt_quote',
          title: 'Send the quote',
          details: 'Attach your quote PDF in Gmail before you send.',
          dueAt: quoteDue,
        });
        toast = 'Walkthrough marked completed. Quote email due in 24 hours.';
      } else if (res === 'no_show') {
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'wt_no_show',
          kind: 'email',
          templateKey: 'wt_no_show',
          title: 'Email: Missed you at the walkthrough',
          dueAt: now,
        });
        const reschedDue = nextBusinessDayAt(now, 10, 0);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'wt_reschedule',
          kind: 'todo',
          title: 'Reschedule the walkthrough',
          dueAt: reschedDue,
        });
      } else if (res === 'cancelled') {
        const callDue = nextBusinessDayAt(now, 10, 0);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'wt_cancelled_call',
          kind: 'call',
          title: 'Walkthrough cancelled: call to find out what changed',
          dueAt: callDue,
        });
      }
    } else if (task.step_key === 'won_completion_check') {
      const res = payload.result;
      if (res === 'completed') {
        const refDue = addBusinessDaysAt(now, 2, 9, 0);
        const nextProjDue = addBusinessDaysAt(now, 22, 9, 0); // 30 calendar days
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'won_referral',
          kind: 'email',
          templateKey: 'won_referral',
          title: 'Email: Who else should I talk to?',
          dueAt: refDue,
        });
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'won_next_project',
          kind: 'email',
          templateKey: 'won_next_project',
          title: 'Email: Your next closeout',
          dueAt: nextProjDue,
        });
      } else if (res === 'completed_with_issues') {
        const issueDue = nextBusinessDayAt(now, 10, 0);
        const nextProjDue = addBusinessDaysAt(now, 22, 9, 0);
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'won_issue_call',
          kind: 'call',
          title: 'Call to resolve the client\'s issues',
          dueAt: issueDue,
        });
        actions.push({
          type: 'create_task',
          enrollmentId: enrollment.id,
          stepKey: 'won_next_project',
          kind: 'email',
          templateKey: 'won_next_project',
          title: 'Email: Your next closeout',
          dueAt: nextProjDue,
        });
      } else if (res === 'cancelled') {
        actions.push({
          type: 'cancel_enrollment',
          enrollmentId: enrollment.id,
          endReason: 'job_cancelled',
        });
      }
    } else if (task.step_key === 'wt_cancelled_call' || task.step_key === 'pickup_checkin' || task.step_key === 'info_checkin' || task.step_key === 'quote_checkin') {
      actions.push({
        type: 'complete_enrollment',
        enrollmentId: enrollment.id,
        endReason: 'completed',
      });
      toast = 'Follow-up finished.';
    }
  }

  return { actions, statusOverride, toast };
}

export interface PlanSignalInput {
  signal:
    | 'replied'
    | 'inbound_call'
    | 'inbound_sms'
    | 'bounced'
    | 'unsubscribe'
    | 'do_not_contact'
    | 'pause'
    | 'resume'
    | 'stop'
    | 'start_held'
    | 'skip_held'
    | 'start_drip';
  payload?: Record<string, any>;
  now?: Date;
  state: PlannerInputState;
}

export function planForSignal(input: PlanSignalInput): PlannerResult {
  const actions: PlannerAction[] = [];
  const now = input.now || new Date();
  const { signal, payload = {}, state } = input;
  let toast: string | { title: string; description?: string } | null = null;

  if (signal === 'replied') {
    const kind = payload.kind;
    // Stop open nurture enrollments
    const nurtureKeys: SequenceKey[] = [
      'no_answer_drip',
      'pickup_followup',
      'info_sent_followup',
      'quote_followup',
      'recheck',
      'referral_intro',
      'reply_call',
      'reply_info',
    ];

    for (const enr of state.openEnrollments) {
      if (nurtureKeys.includes(enr.sequence_key)) {
        actions.push({
          type: 'cancel_enrollment',
          enrollmentId: enr.id,
          endReason: 'replied',
          cancelTasksReason: 'replied',
        });
      } else {
        // Walkthrough, callback, job_won: save note only
        const notes = Array.isArray(enr.context.notes) ? [...enr.context.notes] : [];
        notes.push(`Prospect replied: ${kind}`);
        actions.push({
          type: 'update_context',
          enrollmentId: enr.id,
          context: { ...enr.context, notes },
        });
      }
    }

    if (kind === 'wants_call') {
      actions.push({
        type: 'start_enrollment',
        sequenceKey: 'reply_call',
        lane: 'prospect',
        status: 'active',
        anchorAt: now,
        context: {},
        initialTasks: [
          {
            stepKey: 'reply_call',
            kind: 'call',
            title: 'They replied and want to talk',
            dueAt: now,
          },
        ],
      });
    } else if (kind === 'wants_info') {
      actions.push({
        type: 'start_enrollment',
        sequenceKey: 'reply_info',
        lane: 'prospect',
        status: 'active',
        anchorAt: now,
        context: {},
        initialTasks: [
          {
            stepKey: 'reply_info',
            kind: 'todo',
            title: 'Send the one-pager, then log Info Sent',
            dueAt: now,
          },
        ],
      });
    } else if (kind === 'out_of_office') {
      const returnDate = payload.returnDate ? new Date(payload.returnDate) : nextBusinessDayAt(now, 9, 0);
      for (const enr of state.openEnrollments) {
        if (['no_answer_drip', 'pickup_followup', 'info_sent_followup', 'quote_followup', 'referral_intro'].includes(enr.sequence_key)) {
          actions.push({
            type: 'pause_enrollment',
            enrollmentId: enr.id,
            until: returnDate,
          });
        }
      }
    } else if (kind === 'unsubscribe') {
      return planForSignal({ signal: 'unsubscribe', payload, now, state });
    } else {
      // 'other' or default
      actions.push({
        type: 'start_enrollment',
        sequenceKey: 'reply_call',
        lane: 'prospect',
        status: 'active',
        anchorAt: now,
        context: {},
        initialTasks: [
          {
            stepKey: 'reply_call',
            kind: 'call',
            title: 'They replied: read it and log the outcome',
            dueAt: now,
          },
        ],
      });
    }
    toast = 'Reply recorded. Follow-up emails stopped.';
  } else if (signal === 'inbound_call' || signal === 'inbound_sms') {
    actions.push({
      type: 'set_flag',
      updates: { warm_at: now.toISOString() },
    });

    // Cancel nurture drip/sequences
    for (const enr of state.openEnrollments) {
      if (['no_answer_drip', 'pickup_followup', 'info_sent_followup'].includes(enr.sequence_key)) {
        actions.push({
          type: 'cancel_enrollment',
          enrollmentId: enr.id,
          endReason: signal,
          cancelTasksReason: signal,
        });
      }
    }

    const title = signal === 'inbound_call' ? 'They called you' : 'They texted you';
    const openProspect = state.openEnrollments.find(
      (e) => e.lane === 'prospect' && !['no_answer_drip', 'pickup_followup', 'info_sent_followup'].includes(e.sequence_key)
    );

    if (openProspect) {
      actions.push({
        type: 'create_task',
        enrollmentId: openProspect.id,
        stepKey: `inbound_call_${Date.now()}`,
        kind: 'call',
        title,
        dueAt: now,
      });
    } else {
      actions.push({
        type: 'start_enrollment',
        sequenceKey: 'reply_call',
        lane: 'prospect',
        status: 'active',
        anchorAt: now,
        context: {},
        initialTasks: [
          {
            stepKey: 'reply_call',
            kind: 'call',
            title,
            dueAt: now,
          },
        ],
      });
    }
  } else if (signal === 'bounced') {
    actions.push({
      type: 'set_flag',
      updates: {
        bounced_email: state.lead.customer_email || null,
        bounced_at: now.toISOString(),
      },
    });
  } else if (signal === 'unsubscribe') {
    actions.push({
      type: 'set_flag',
      updates: { email_opt_out_at: now.toISOString() },
    });
    for (const enr of state.openEnrollments) {
      if (enr.sequence_key === 'no_answer_drip' || enr.sequence_key === 'referral_intro') {
        actions.push({
          type: 'cancel_enrollment',
          enrollmentId: enr.id,
          endReason: 'unsubscribed',
          cancelTasksReason: 'opted_out',
        });
      } else {
        for (const t of enr.pendingTasks) {
          if (t.kind === 'email') {
            actions.push({
              type: 'update_task',
              taskId: t.id,
              status: 'cancelled',
              cancelReason: 'opted_out',
            });
          }
        }
      }
    }
    toast = 'Unsubscribed. Follow-up emails stopped.';
  } else if (signal === 'do_not_contact') {
    actions.push({
      type: 'set_flag',
      updates: { do_not_contact_at: now.toISOString() },
    });
    for (const enr of state.openEnrollments) {
      actions.push({
        type: 'cancel_enrollment',
        enrollmentId: enr.id,
        endReason: 'do_not_contact',
        cancelTasksReason: 'cancelled',
      });
    }
    toast = 'Marked do not contact. All follow-ups stopped.';
  } else if (signal === 'pause') {
    const enrId = payload.enrollmentId;
    if (enrId) {
      actions.push({
        type: 'pause_enrollment',
        enrollmentId: enrId,
        until: payload.until ? new Date(payload.until) : null,
      });
    }
  } else if (signal === 'resume') {
    const enrId = payload.enrollmentId;
    if (enrId) {
      actions.push({
        type: 'resume_enrollment',
        enrollmentId: enrId,
      });
    }
  } else if (signal === 'stop') {
    const enrId = payload.enrollmentId;
    if (enrId) {
      actions.push({
        type: 'cancel_enrollment',
        enrollmentId: enrId,
        endReason: 'manual_stop',
        cancelTasksReason: 'cancelled',
      });
    }
  } else if (signal === 'start_held') {
    const enrId = payload.enrollmentId;
    if (enrId) {
      actions.push({
        type: 'resume_enrollment',
        enrollmentId: enrId,
      });
      // Create step 1 due now
      actions.push({
        type: 'create_task',
        enrollmentId: enrId,
        stepKey: 'drip_email_1',
        kind: 'email',
        templateKey: 'drip_1',
        title: 'Email 1: Who handles closeout cleaning?',
        dueAt: now,
      });
    }
  } else if (signal === 'skip_held') {
    const enrId = payload.enrollmentId;
    if (enrId) {
      actions.push({
        type: 'cancel_enrollment',
        enrollmentId: enrId,
        endReason: 'held_skipped',
        cancelTasksReason: 'cancelled',
      });
    }
  } else if (signal === 'start_drip') {
    // Manual drip start after adding email (scenario 11)
    const anchor = state.flags?.last_no_answer_at ? new Date(state.flags.last_no_answer_at) : now;
    actions.push({
      type: 'start_enrollment',
      sequenceKey: 'no_answer_drip',
      lane: 'prospect',
      status: 'active',
      anchorAt: anchor,
      context: {},
      initialTasks: [
        {
          stepKey: 'drip_email_1',
          kind: 'email',
          templateKey: 'drip_1',
          title: 'Email 1: Who handles closeout cleaning?',
          dueAt: now,
        },
      ],
    });
    toast = 'No-answer drip started. Email 1 is due now.';
  }

  return { actions, toast };
}
