import { describe, it, expect } from 'vitest';
import { normalizeStatus, nextLeadStatus } from './leadStatus';

describe('normalizeStatus', () => {
  it.each([
    ['voicemail', 'no_answer'],
    ['no_answers', 'no_answer'],
    ['unreachable', 'no_answer'],
    ['convo', 'contacted'],
    ['info_sent', 'info_sent'],
    ['job_won', 'won'],
    [null, 'new'],
    ['', 'new'],
    [undefined, 'new'],
    ['quoted', 'quoted'],
    ['lost', 'lost'],
  ])('%s -> %s', (input, out) => {
    expect(normalizeStatus(input as any)).toBe(out);
  });
});

describe('nextLeadStatus', () => {
  it('explicit always wins, even over won', () => {
    expect(nextLeadStatus('won', 'CONVO', 'walkthrough_booked')).toBe('walkthrough_booked');
    expect(nextLeadStatus('new', 'STATUS_MOVE', 'lost')).toBe('lost');
  });

  it('won is sticky for every outcome', () => {
    for (const o of ['NO_ANSWER', 'CONVO', 'INFO_SENT', 'WALKTHROUGH', 'NOT_INTERESTED', 'CALLBACK']) {
      expect(nextLeadStatus('won', o)).toBeNull();
      expect(nextLeadStatus('job_won', o)).toBeNull();
    }
  });

  it.each(['NO_ANSWER', 'VOICEMAIL', 'BAD_NUMBER'])('%s only moves rank 0 or 1', (o) => {
    expect(nextLeadStatus('new', o)).toBe('no_answer');
    expect(nextLeadStatus(null, o)).toBe('no_answer');
    expect(nextLeadStatus('no_answer', o)).toBe('no_answer');
    expect(nextLeadStatus('voicemail', o)).toBe('no_answer');
    expect(nextLeadStatus('contacted', o)).toBeNull();
    expect(nextLeadStatus('info_sent', o)).toBeNull();
    expect(nextLeadStatus('walkthrough_booked', o)).toBeNull();
    expect(nextLeadStatus('quoted', o)).toBeNull();
    expect(nextLeadStatus('lost', o)).toBeNull();
  });

  it.each(['CONVO', 'GATEKEEPER'])('%s moves below contacted and out of lost', (o) => {
    expect(nextLeadStatus('new', o)).toBe('convo');
    expect(nextLeadStatus('no_answer', o)).toBe('convo');
    expect(nextLeadStatus('lost', o)).toBe('convo');
    expect(nextLeadStatus('contacted', o)).toBeNull();
    expect(nextLeadStatus('convo', o)).toBeNull();
    expect(nextLeadStatus('info_sent', o)).toBeNull();
    expect(nextLeadStatus('walkthrough_booked', o)).toBeNull();
    expect(nextLeadStatus('quoted', o)).toBeNull();
  });

  it('CALLBACK uses the same condition as CONVO but writes contacted', () => {
    expect(nextLeadStatus('new', 'CALLBACK')).toBe('contacted');
    expect(nextLeadStatus('lost', 'CALLBACK')).toBe('contacted');
    expect(nextLeadStatus('contacted', 'CALLBACK')).toBeNull();
    expect(nextLeadStatus('info_sent', 'CALLBACK')).toBeNull();
    expect(nextLeadStatus('quoted', 'CALLBACK')).toBeNull();
  });

  it('INFO_SENT writes info_sent unless walkthrough_booked', () => {
    expect(nextLeadStatus('new', 'INFO_SENT')).toBe('info_sent');
    expect(nextLeadStatus('contacted', 'INFO_SENT')).toBe('info_sent');
    expect(nextLeadStatus('lost', 'INFO_SENT')).toBe('info_sent');
    expect(nextLeadStatus('walkthrough_booked', 'INFO_SENT')).toBeNull();
  });

  it('SEND_QUOTE writes quoted unless walkthrough_booked', () => {
    expect(nextLeadStatus('new', 'SEND_QUOTE')).toBe('quoted');
    expect(nextLeadStatus('contacted', 'SEND_QUOTE')).toBe('quoted');
    expect(nextLeadStatus('info_sent', 'SEND_QUOTE')).toBe('quoted');
    expect(nextLeadStatus('lost', 'SEND_QUOTE')).toBe('quoted');
    expect(nextLeadStatus('walkthrough_booked', 'SEND_QUOTE')).toBeNull();
  });

  it('WALKTHROUGH, JOB_WON, SALE, NOT_INTERESTED', () => {
    expect(nextLeadStatus('quoted', 'WALKTHROUGH')).toBe('walkthrough_booked');
    expect(nextLeadStatus('new', 'JOB_WON')).toBe('won');
    expect(nextLeadStatus('lost', 'SALE')).toBe('won');
    expect(nextLeadStatus('quoted', 'NOT_INTERESTED')).toBe('lost');
  });

  it('no change outcomes', () => {
    for (const o of ['OUT_OF_SERVICE', 'STATUS_MOVE', 'SMS_INBOUND', 'SMS_OUTBOUND', 'WHATEVER', '']) {
      expect(nextLeadStatus('new', o)).toBeNull();
    }
  });
});
