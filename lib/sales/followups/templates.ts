/**
 * Email templates for SOB Sales Follow-Up Engine (Appendix C).
 * Pure functions returning { subject, body }.
 */

export interface TemplateContext {
  service_area: string;
  is_same_day?: boolean;
  call_note?: string;
  next_step?: string;
  project_name?: string;
  site_address?: string;
  has_usable_site_address?: boolean;
  site_contact_sentence?: string;
  day?: string;
  time?: string;
  when_future?: string;
  when_past?: string;
  quote_amount?: string;
  scope_phase?: string;
  job_date?: string;
  original_month?: string;
  referrer_first_name?: string;
  referrer_full_name?: string;
}

export type TemplateFunction = (ctx: TemplateContext) => { subject: string; body: string };

export const TEMPLATES: Record<string, TemplateFunction> = {
  // C.1 No-answer drip
  drip_1: (ctx) => ({
    subject: 'Who handles closeout cleaning?',
    body: ctx.is_same_day
      ? `I called you today and missed you. Sea of Blue Inc. does post-construction deep cleans for non-residential sites ${ctx.service_area}.\n\nWho handles the final clean on your projects?`
      : `I called you recently and missed you. Sea of Blue Inc. does post-construction deep cleans for non-residential sites ${ctx.service_area}.\n\nWho handles the final clean on your projects?`,
  }),

  drip_2: () => ({
    subject: 'Next closeout',
    body: 'Do you hire out the final clean, or does your own crew do it?',
  }),

  drip_3: () => ({
    subject: 'Project finishing soon?',
    body: 'When does your next project finish, and is a cleaner confirmed for it?',
  }),

  drip_4: () => ({
    subject: 'Right person for closeout cleaning?',
    body: 'This is my last email. If someone else on your team handles closeout cleaning, send me their name and I will contact them directly.',
  }),

  // C.2 Pick-up follow-up
  pickup_recap: (ctx) => {
    const greeting = ctx.is_same_day ? 'Thanks for taking my call today.' : 'Thanks for taking my call.';
    return {
      subject: 'Following up on our call',
      body: `${greeting} You mentioned ${ctx.call_note}.\n\nNext step: ${ctx.next_step}.\n\nSo you have it on file: we are WSIB insured with $5 million liability coverage, and each cleaning phase is booked separately at a fixed price.`,
    };
  },

  pickup_day3: (ctx) => {
    if (ctx.project_name) {
      return {
        subject: `Update on ${ctx.project_name}?`,
        body: `Is ${ctx.project_name} still on schedule, and when will it be ready for the final clean?`,
      };
    }
    return {
      subject: 'Your next project',
      body: 'Which of your projects finishes next, and when?',
    };
  },

  pickup_day7: () => ({
    subject: 'Pricing by phase',
    body: 'We price the rough clean, pre-final clean, and final turnover clean separately. Which phases should I price for your next project?',
  }),

  pickup_day14: () => ({
    subject: 'Should I check back later?',
    body: 'If nothing is coming up soon, what month should I check back with you?',
  }),

  // C.3 Info sent follow-up
  info_day2: () => ({
    subject: 'The info I sent',
    body: 'Did the info I sent cover what you need, or should I also send our WSIB clearance certificate and insurance certificate?',
  }),

  info_day6: () => ({
    subject: 'Fixed price for your next project',
    body: 'Which project should I price? Send me the address and square footage, and I will send back a fixed price.',
  }),

  info_day12: () => ({
    subject: 'Closing the loop',
    body: 'Is a cleaner already lined up for your next closeout, or should I check back closer to the date?',
  }),

  // C.4 Walkthrough
  wt_confirm: (ctx) => {
    const contactSentence = ctx.site_contact_sentence || '';
    if (ctx.has_usable_site_address && ctx.site_address) {
      return {
        subject: `Walkthrough confirmed for ${ctx.day} at ${ctx.time}`,
        body: `Confirming our walkthrough at ${ctx.site_address} on ${ctx.day} at ${ctx.time}.${contactSentence} If anything changes on your end, reply here.`,
      };
    }
    return {
      subject: `Walkthrough confirmed for ${ctx.day} at ${ctx.time}`,
      body: `Confirming our walkthrough on ${ctx.day} at ${ctx.time}.${contactSentence} What is the site address?`,
    };
  },

  wt_no_show: (ctx) => {
    if (ctx.has_usable_site_address && ctx.site_address) {
      return {
        subject: 'Missed you at the walkthrough',
        body: `We came to ${ctx.site_address} ${ctx.when_past} and missed you. What day works to reschedule?`,
      };
    }
    return {
      subject: 'Missed you at the walkthrough',
      body: `We came by for the walkthrough ${ctx.when_past} and missed you. What day works to reschedule?`,
    };
  },

  wt_rescheduled: (ctx) => {
    if (ctx.has_usable_site_address && ctx.site_address) {
      return {
        subject: `New walkthrough time: ${ctx.day} at ${ctx.time}`,
        body: `Confirming the new time for our walkthrough at ${ctx.site_address}: ${ctx.day} at ${ctx.time}. If that changes, reply here.`,
      };
    }
    return {
      subject: `New walkthrough time: ${ctx.day} at ${ctx.time}`,
      body: `Confirming the new time for our walkthrough: ${ctx.day} at ${ctx.time}. What is the site address?`,
    };
  },

  wt_quote: (ctx) => {
    const subject = ctx.has_usable_site_address && ctx.site_address
      ? `Your quote for ${ctx.site_address}`
      : 'Your quote';

    let body = 'Your quote is attached. The price is fixed. What date do you need the clean done?';
    if (ctx.quote_amount && ctx.scope_phase) {
      body = `Your quote is attached: ${ctx.quote_amount} for the ${ctx.scope_phase}. The price is fixed. What date do you need the clean done?`;
    } else if (ctx.quote_amount) {
      body = `Your quote is attached: ${ctx.quote_amount}. The price is fixed. What date do you need the clean done?`;
    }

    return { subject, body };
  },

  // C.5 Quote follow-up
  quote_day2: (ctx) => ({
    subject: 'Questions on the quote?',
    body: ctx.has_usable_site_address && ctx.site_address
      ? `Any questions on the quote for ${ctx.site_address}?`
      : 'Any questions on the quote I sent?',
  }),

  quote_day5: () => ({
    subject: 'Locking in your date',
    body: 'What date do you need the clean done? Once you confirm, I will book the crew for that day.',
  }),

  quote_day10: (ctx) => ({
    subject: 'Should I keep the quote open?',
    body: ctx.has_usable_site_address && ctx.site_address
      ? `Should I keep the quote for ${ctx.site_address} open, or has the project changed?`
      : 'Should I keep your quote open, or has the project changed?',
  }),

  // C.6 Callback
  cb_confirm: (ctx) => ({
    subject: `Talk ${ctx.when_future}`,
    body: `Confirming I will call you ${ctx.when_future}. If that time stops working, reply with a better one.`,
  }),

  cb_missed: (ctx) => ({
    subject: `Missed you ${ctx.when_past}`,
    body: `I called you ${ctx.when_past} as planned and missed you. What time works better?`,
  }),

  // C.7 Customer (Job Won)
  won_thanks: (ctx) => {
    const subject = 'Thanks for choosing Sea of Blue';
    if (ctx.job_date && ctx.has_usable_site_address && ctx.site_address) {
      return {
        subject,
        body: `Thanks for choosing Sea of Blue Inc. Your clean is booked for ${ctx.job_date} at ${ctx.site_address}. Who should our crew contact on site that day?`,
      };
    }
    if (ctx.job_date) {
      return {
        subject,
        body: `Thanks for choosing Sea of Blue Inc. Your clean is booked for ${ctx.job_date}. Who should our crew contact on site that day?`,
      };
    }
    return {
      subject,
      body: 'Thanks for choosing Sea of Blue Inc. What date should we book your clean, and who should our crew contact on site?',
    };
  },

  won_referral: (ctx) => ({
    subject: 'Who else should I talk to?',
    body: ctx.has_usable_site_address && ctx.site_address
      ? `Thanks again for having us at ${ctx.site_address}. Who else on your team, or at another company you work with, should I talk to about their next closeout?`
      : 'Thanks again for having us on your project. Who else on your team, or at another company you work with, should I talk to about their next closeout?',
  }),

  won_next_project: () => ({
    subject: 'Your next closeout',
    body: 'When does your next project finish? Send me the date and I will book the crew.',
  }),

  // C.8 Recheck
  recheck_email: (ctx) => ({
    subject: 'Checking back',
    body: `When we spoke in ${ctx.original_month}, you had no projects coming up. Is anything finishing in the next few months?`,
  }),

  // C.9 Referral intro
  ref_intro: (ctx) => ({
    subject: ctx.referrer_first_name
      ? `${ctx.referrer_first_name} gave me your name`
      : 'Closeout cleaning on your projects',
    body: `${ctx.referrer_full_name} gave me your name. Sea of Blue Inc. does post-construction cleaning for non-residential sites ${ctx.service_area}.\n\nWhen does your next project need a final clean?`,
  }),
};
