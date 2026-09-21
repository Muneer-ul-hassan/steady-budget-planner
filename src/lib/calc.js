/**
 * calc.js
 * Core safe-to-spend logic and recurrence engine for Steady.
 */

export function nextPayday(paychecks) {
  if (!paychecks || paychecks.length === 0) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nearest = null;

  paychecks.forEach((pc) => {
    // For MVP, simplistic logic for a monthly paycheck:
    if (pc.frequency === 'monthly') {
      let d = new Date(today.getFullYear(), today.getMonth(), pc.anchor);
      if (d < today) {
        d = new Date(today.getFullYear(), today.getMonth() + 1, pc.anchor);
      }
      
      if (pc.earlyWeekend) {
        if (d.getDay() === 6) d.setDate(d.getDate() - 1); // Saturday -> Friday
        else if (d.getDay() === 0) d.setDate(d.getDate() - 2); // Sunday -> Friday
      }

      if (!nearest || d < nearest) {
        nearest = d;
      }
    }
    // Implement weekly, biweekly, etc., similarly.
  });
  return nearest;
}

export function occurrences(bill, startDate, endDate) {
  // Returns an array of dates the bill is due between startDate and endDate
  const dates = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Simplified MVP recurrence matching:
  if (bill.frequency === 'monthly') {
    while (current <= end) {
      if (current.getDate() === bill.anchor) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
  } else if (bill.frequency === 'every-x-months') {
    // Basic placeholder for interval
    if (bill.anchor === current.getDate()) {
       dates.push(new Date(current));
    }
  }

  return dates.filter(d => !bill.paidDates.includes(d.toISOString().split('T')[0]));
}

export function billMonthlyEquivalent(bill) {
  if (bill.frequency === 'monthly') return bill.amount;
  if (bill.frequency === 'every-x-months') return bill.amount / bill.interval;
  if (bill.frequency === 'weekly') return (bill.amount * 52) / 12;
  if (bill.frequency === 'biweekly' || bill.frequency === 'twice-monthly') return bill.amount * 2;
  return 0; // one-off
}

export function calcSafeToSpend({ accounts, bills, goals, paychecks, profile }) {
  const spendingBalance = accounts
    .filter(a => a.type === 'spending')
    .reduce((sum, a) => sum + a.balance, 0);

  const goalSetAside = goals
    .filter(g => g.keepOut)
    .reduce((sum, g) => sum + g.saved, 0);

  const alreadySetAside = (profile.alreadySetAside || 0) + goalSetAside;

  const setAsideAccrual = bills
    .filter(b => b.setAside)
    .reduce((sum, b) => sum + billMonthlyEquivalent(b), 0);

  const nextDate = nextPayday(paychecks) || new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const upcomingBillsBeforePayday = bills
    .filter(b => !b.setAside)
    .reduce((sum, b) => {
      const occs = occurrences(b, new Date(), nextDate);
      return sum + (occs.length * b.amount);
    }, 0);

  const safe = spendingBalance - alreadySetAside - setAsideAccrual - upcomingBillsBeforePayday;
  
  const today = new Date();
  const diffTime = Math.abs(nextDate - today);
  const daysUntilPayday = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    safeToSpend: safe,
    daysUntilPayday,
    breakdown: {
      spendingBalance,
      alreadySetAside,
      setAsideAccrual,
      upcomingBillsBeforePayday
    }
  };
}
