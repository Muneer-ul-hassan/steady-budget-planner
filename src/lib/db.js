import Dexie from 'dexie';

export const db = new Dexie('SteadyPlannerDB');

db.version(1).stores({
  profile: '++id',
  accounts: '++id, type',
  paychecks: '++id',
  bills: '++id, dueSoon',
  spends: '++id, date, category',
  income: '++id, date',
  goals: '++id',
  debts: '++id',
  envelopes: '++id',
  challenges: '++id',
  purchasePause: '++id',
  brainDump: '++id, date',
  dailyPlan: '++id, date',
  milestones: '++id, reachedAt',
  activityLog: '++id, date, type'
});

export async function ensureProfile() {
  const profiles = await db.profile.toArray();
  if (profiles.length === 0) {
    await db.profile.add({
      name: 'User',
      title: 'My calm money plan',
      currency: '$',
      bigLabel: 'Safe to spend today',
      theme: 'soft-spectrum',
      alreadySetAside: 0
    });
  }
}

export async function seedDemoData() {
  const accountsCount = await db.accounts.count();
  if (accountsCount > 0) return; // already seeded

  await db.accounts.bulkAdd([
    { name: 'Checking', type: 'spending', balance: 1200 },
    { name: 'Savings', type: 'savings', balance: 5000 }
  ]);

  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db.paychecks.add({
    name: 'Salary',
    amount: 2500,
    frequency: 'monthly',
    anchor: nextWeek.getDate(), // lands on this day of the month
    earlyWeekend: true
  });

  await db.bills.bulkAdd([
    { name: 'Rent', amount: 1000, frequency: 'monthly', anchor: 1, setAside: false, paidDates: [] },
    { name: 'Internet', amount: 60, frequency: 'monthly', anchor: 15, setAside: false, paidDates: [] },
    { name: 'Car Insurance', amount: 600, frequency: 'every-x-months', interval: 6, anchor: today.getDate(), setAside: true, paidDates: [] }
  ]);
}
