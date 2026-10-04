const fs = require('fs');

const rawData = `
"Aug 31, 2026",Taxes and fees,"ON HST: Aug 1, 2026 - Aug 31, 2026", --,CA$279.03, --,CA$925.45
"Aug 31, 2026",Promotions,Promotion code: 43MR6GLCUMPHVU, --, --, -CA$224.86,CA$646.42
"Aug 31, 2026",Payments,Threshold charge declined: Visa    • • • • 1993 for CA$750.00. Insufficient funds. V4442113656868817, --, --,CA$0.00,CA$871.28
"Aug 31, 2026",Campaigns,Home Services Ads activity,9 leads,CA$341.00,CA$0.00,CA$871.28
"Aug 30, 2026",Campaigns,Home Services Ads activity,6 leads,CA$280.00,CA$0.00,CA$530.28
"Aug 29, 2026",Campaigns,Home Services Ads activity,3 leads,CA$150.26,CA$0.00,CA$250.28
"Aug 28, 2026",Payments,Threshold charge: Visa    • • • • 1993. V5770130620533778, --, --, -CA$750.00,CA$100.02
"Aug 28, 2026",Campaigns,Home Services Ads activity,3 leads,CA$153.61,CA$0.00,CA$850.02
"Aug 27, 2026",Campaigns,Home Services Ads activity,2 leads,CA$90.46,CA$0.00,CA$696.41
"Aug 24, 2026",Campaigns,Home Services Ads activity,2 leads,CA$88.37,CA$0.00,CA$605.95
"Aug 23, 2026",Campaigns,Home Services Ads activity,1 leads,CA$49.16,CA$0.00,CA$517.58
"Aug 22, 2026",Campaigns,Home Services Ads activity,1 leads,CA$58.34,CA$0.00,CA$468.42
"Aug 21, 2026",Campaigns,Home Services Ads activity,1 leads,CA$44.39,CA$0.00,CA$410.08
"Aug 20, 2026",Campaigns,Home Services Ads activity,1 leads,CA$42.39,CA$0.00,CA$365.69
"Aug 19, 2026",Campaigns,Home Services Ads activity,2 leads,CA$79.74,CA$0.00,CA$323.30
"Aug 18, 2026",Payments,Threshold charge: Visa    • • • • 1993. P1nJ0Mc6, --, --, -CA$750.00,CA$243.56
"Aug 18, 2026",Campaigns,Home Services Ads activity,3 leads,CA$138.61,CA$0.00,CA$993.56
"Aug 16, 2026",Campaigns,Home Services Ads activity,2 leads,CA$80.27,CA$0.00,CA$854.95
"Aug 15, 2026",Campaigns,Home Services Ads activity,1 leads,CA$40.46,CA$0.00,CA$774.68
"Aug 12, 2026",Campaigns,Home Services Ads activity,1 leads,CA$50.08,CA$0.00,CA$734.22
"Aug 11, 2026",Campaigns,Home Services Ads activity,1 leads,CA$49.60,CA$0.00,CA$684.14
"Aug 10, 2026",Campaigns,Home Services Ads activity,1 leads,CA$46.55,CA$0.00,CA$634.54
"Aug 9, 2026",Campaigns,Home Services Ads activity,2 leads,CA$88.13,CA$0.00,CA$587.99
"Aug 8, 2026",Campaigns,Home Services Ads activity,1 leads,CA$48.18,CA$0.00,CA$499.86
"Aug 7, 2026",Campaigns,Home Services Ads activity,3 leads,CA$115.57,CA$0.00,CA$451.68
"Aug 6, 2026",Campaigns,Home Services Ads activity,1 leads,CA$48.76,CA$0.00,CA$336.11
"Aug 5, 2026",Adjustments,"Invalid clicks: Jul 2026\n1 campaign", --, --, -CA$127.04,CA$287.35
"Aug 5, 2026",Campaigns,Home Services Ads activity,2 leads,CA$56.99,CA$0.00,CA$414.39
"Aug 4, 2026",Campaigns,Home Services Ads activity,1 leads,CA$39.82,CA$0.00,CA$357.40
"Aug 3, 2026",Campaigns,Home Services Ads activity,1 leads,CA$34.87,CA$0.00,CA$317.58
"Aug 2, 2026",Campaigns,Home Services Ads activity,4 leads,CA$142.63,CA$0.00,CA$282.71
"Aug 1, 2026",Payments,Monthly charge: Visa    • • • • 1993. P1niys5X, --, --, -CA$265.98,CA$140.08
"Aug 1, 2026",Payments,Monthly charge declined: Visa    • • • • 1993 for CA$265.98. Insufficient funds. V6110511310223133, --, --,CA$0.00,CA$406.06
"Aug 1, 2026",Campaigns,Home Services Ads activity,4 leads,CA$140.08,CA$0.00,CA$406.06
"Jul 31, 2026",Taxes and fees,"ON HST: Jul 1, 2026 - Jul 31, 2026", --,CA$346.97, --,CA$265.98
"Jul 31, 2026",Promotions,Promotion code: 43MR6GLCUMPHVU, --, --, -CA$375.14, -CA$80.99
"Jul 31, 2026",Campaigns,Home Services Ads activity,4 leads,CA$206.02,CA$0.00,CA$294.15
"Jul 30, 2026",Campaigns,Home Services Ads activity,2 leads,CA$80.75,CA$0.00,CA$88.13
"Jul 29, 2026",Campaigns,Home Services Ads activity,2 leads,CA$88.37,CA$0.00,CA$7.38
"Jul 28, 2026",Campaigns,Home Services Ads activity,1 leads,CA$24.67,CA$0.00, -CA$80.99
"Jul 27, 2026",Payments,Threshold charge: Visa    • • • • 1993. V7188113086820761, --, --, -CA$750.00, -CA$105.66
"Jul 27, 2026",Campaigns,Home Services Ads activity,2 leads,CA$49.35,CA$0.00,CA$644.34
"Jul 26, 2026",Campaigns,Home Services Ads activity,7 leads,CA$122.17,CA$0.00,CA$594.99
"Jul 25, 2026",Payments,Threshold charge declined: Visa    • • • • 1993 for CA$750.00. Insufficient funds. V0803424068722911, --, --,CA$0.00,CA$472.82
"Jul 25, 2026",Campaigns,Home Services Ads activity,5 leads,CA$119.36,CA$0.00,CA$472.82
"Jul 24, 2026",Campaigns,Home Services Ads activity,4 leads,CA$70.64,CA$0.00,CA$353.46
"Jul 23, 2026",Campaigns,Home Services Ads activity,4 leads,CA$107.78,CA$0.00,CA$282.82
"Jul 22, 2026",Campaigns,Home Services Ads activity,5 leads,CA$143.28,CA$0.00,CA$175.04
"Jul 21, 2026",Campaigns,Home Services Ads activity,4 leads,CA$66.69,CA$0.00,CA$31.76
"Jul 20, 2026",Campaigns,Home Services Ads activity,5 leads,CA$67.26,CA$0.00, -CA$34.93
"Jul 19, 2026",Campaigns,Home Services Ads activity,7 leads,CA$126.56,CA$0.00, -CA$102.19
"Jul 18, 2026",Payments,Threshold charge: Visa    • • • • 1993. P1mVJnHh, --, --, -CA$750.00, -CA$228.75
"Jul 18, 2026",Payments,Threshold charge declined: Visa    • • • • 1993 for CA$750.00. Insufficient funds. V9365031162146697, --, --,CA$0.00,CA$521.25
"Jul 18, 2026",Campaigns,Home Services Ads activity,5 leads,CA$129.13,CA$0.00,CA$521.25
"Jul 17, 2026",Campaigns,Home Services Ads activity,7 leads,CA$188.65,CA$0.00,CA$392.12
"Jul 16, 2026",Campaigns,Home Services Ads activity,4 leads,CA$98.43,CA$0.00,CA$203.47
"Jul 15, 2026",Campaigns,Home Services Ads activity,2 leads,CA$24.68,CA$0.00,CA$105.04
"Jul 14, 2026",Campaigns,Home Services Ads activity,5 leads,CA$115.39,CA$0.00,CA$80.36
"Jul 13, 2026",Campaigns,Home Services Ads activity,5 leads,CA$67.26,CA$0.00, -CA$35.03
"Jul 12, 2026",Payments,Threshold charge: Visa    • • • • 1993. P1mLtTbV, --, --, -CA$750.00, -CA$102.29
"Jul 12, 2026",Campaigns,Home Services Ads activity,6 leads,CA$127.11,CA$0.00,CA$647.71
"Jul 11, 2026",Campaigns,Home Services Ads activity,5 leads,CA$138.43,CA$0.00,CA$520.60
"Jul 10, 2026",Campaigns,Home Services Ads activity,2 leads,CA$81.18,CA$0.00,CA$382.17
"Jul 9, 2026",Campaigns,Home Services Ads activity,5 leads,CA$158.52,CA$0.00,CA$300.99
"Jul 8, 2026",Campaigns,Home Services Ads activity,5 leads,CA$134.02,CA$0.00,CA$142.47
"Jul 7, 2026",Payments,Threshold charge: Visa    • • • • 1993. V3216557999991123, --, --, -CA$500.00,CA$8.45
"Jul 7, 2026",Campaigns,Home Services Ads activity,7 leads,CA$159.69,CA$0.00,CA$508.45
"Jul 6, 2026",Campaigns,Home Services Ads activity,5 leads,CA$114.26,CA$0.00,CA$348.76
"Jul 5, 2026",Adjustments,"Invalid clicks: Jun 2026\n1 campaign", --, --, -CA$24.68,CA$234.50
"Jul 5, 2026",Campaigns,Home Services Ads activity,3 leads,CA$35.18,CA$0.00,CA$259.18
"Jul 4, 2026",Campaigns,Home Services Ads activity,4 leads,CA$52.50,CA$0.00,CA$224.00
"Jul 3, 2026",Campaigns,Home Services Ads activity,3 leads,CA$42.00,CA$0.00,CA$171.50
"Jul 2, 2026",Campaigns,Home Services Ads activity,3 leads,CA$63.00,CA$0.00,CA$129.50
"Jul 1, 2026",Payments,Monthly charge: Visa    • • • • 1993. V4986213825678355, --, --, -CA$245.06,CA$66.50
"Jul 1, 2026",Campaigns,Home Services Ads activity,3 leads,CA$66.50,CA$0.00,CA$311.56
"Jun 30, 2026",Taxes and fees,"ON HST: Jun 7, 2026 - Jun 30, 2026", --,CA$87.70, --,CA$245.06
"Jun 29, 2026",Campaigns,Home Services Ads activity,4 leads,CA$63.00,CA$0.00,CA$157.36
"Jun 28, 2026",Campaigns,Home Services Ads activity,2 leads,CA$42.00,CA$0.00,CA$94.36
"Jun 27, 2026",Campaigns,Home Services Ads activity,4 leads,CA$63.00,CA$0.00,CA$52.36
"Jun 26, 2026",Payments,Threshold charge: Visa    • • • • 1993. V0987476642821824, --, --, -CA$250.00, -CA$10.64
"Jun 26, 2026",Campaigns,Home Services Ads activity,2 leads,CA$59.97,CA$0.00,CA$239.36
"Jun 25, 2026",Campaigns,Home Services Ads activity,2 leads,CA$47.27,CA$0.00,CA$179.39
"Jun 24, 2026",Campaigns,Home Services Ads activity,3 leads,CA$70.88,CA$0.00,CA$132.12
"Jun 23, 2026",Campaigns,Home Services Ads activity,2 leads,CA$56.33,CA$0.00,CA$61.24
"Jun 22, 2026",Campaigns,Home Services Ads activity,9 leads,CA$272.15,CA$0.00,CA$272.15
`;

// Helper to parse line
const lines = rawData.trim().split('\n').filter(Boolean);

const entries = [];

for (const line of lines) {
  // Pattern matching simple CSV line
  const dateMatch = line.match(/"([^"]+)"/);
  if (!dateMatch) continue;
  const dateStr = dateMatch[1];

  if (line.includes('Home Services Ads activity')) {
    const leadsMatch = line.match(/(\d+)\s+leads/);
    const leads = leadsMatch ? parseInt(leadsMatch[1], 10) : 0;
    const costMatch = line.match(/CA\$([\d\.]+)/);
    const cost = costMatch ? parseFloat(costMatch[1]) : 0;
    entries.push({
      date: new Date(dateStr).toISOString().split('T')[0],
      type: 'campaign',
      leads,
      cost,
      description: 'Google Local Services Ads (LSA)'
    });
  } else if (line.includes('Adjustments')) {
    const creditMatch = line.match(/-CA\$([\d\.]+)/);
    const credit = creditMatch ? parseFloat(creditMatch[1]) : 0;
    entries.push({
      date: new Date(dateStr).toISOString().split('T')[0],
      type: 'adjustment',
      leads: 0,
      cost: -credit,
      description: 'Invalid Clicks Adjustment'
    });
  } else if (line.includes('Promotions')) {
    const creditMatch = line.match(/-CA\$([\d\.]+)/);
    const credit = creditMatch ? parseFloat(creditMatch[1]) : 0;
    entries.push({
      date: new Date(dateStr).toISOString().split('T')[0],
      type: 'promotion',
      leads: 0,
      cost: -credit,
      description: 'Google Ads Promotion Credit'
    });
  }
}

// Group into Mondays (Weekly buckets)
function getMonday(dStr) {
  const d = new Date(dStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getSunday(mondayStr) {
  const m = new Date(mondayStr);
  const sunday = new Date(m.setDate(m.getDate() + 6));
  return sunday.toISOString().split('T')[0];
}

const weeklyMap = {};

for (const entry of entries) {
  const weekStart = getMonday(entry.date);
  const weekEnd = getSunday(weekStart);
  const key = `${weekStart}_${weekEnd}`;

  if (!weeklyMap[key]) {
    weeklyMap[key] = {
      week_start_date: weekStart,
      week_end_date: weekEnd,
      channel: 'lsa',
      amount: 0,
      conversions: 0,
      notes: []
    };
  }

  weeklyMap[key].amount += entry.cost;
  weeklyMap[key].conversions += entry.leads;
  if (entry.description !== 'Google Local Services Ads (LSA)') {
    weeklyMap[key].notes.push(`${entry.date}: ${entry.description} (CA$${entry.cost.toFixed(2)})`);
  }
}

const weeklyLogs = Object.values(weeklyMap).map(w => ({
  ...w,
  amount: Math.round(w.amount * 100) / 100,
  notes: `Google LSA Activity (${w.conversions} leads)` + (w.notes.length ? `. ${w.notes.join('; ')}` : '')
}));

console.log('Weekly Logs:', JSON.stringify(weeklyLogs, null, 2));

const totalCost = entries.reduce((s, e) => s + e.cost, 0);
const totalLeads = entries.reduce((s, e) => s + e.leads, 0);
console.log(`Total Spend: CA$${totalCost.toFixed(2)}, Total Leads: ${totalLeads}`);
