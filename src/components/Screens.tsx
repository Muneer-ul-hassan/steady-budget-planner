import React, { useState, useMemo, useEffect, useRef } from "react";
import { ArrowDownToLine, CalendarDays, Check, ChevronRight, CircleHelp, Copy, ExternalLink, Flag, Gauge, KeyRound, Keyboard, Laptop, ListChecks, Lock, Mail, MoreHorizontal, Plus, RotateCcw, Settings2, ShieldCheck, Smartphone, Target, Wallet, X } from "lucide-react";
import { useTranslation } from "../lib/i18n";
import { useCurrency } from "../lib/currency";
import { db } from "../lib/db";
import { Screen, Mode, Spend, Goal, Bill, Income, Debt, Envelope, MilestoneItem, MilestoneStatus, AppSettings, defaultSettings, exampleGoals, exampleBills, exampleIncome, exampleEnvelopes, screens, readStorage, MonthCode, MONTH_FULL_NAMES, MONTH_INDEX, MONTHS, PlannerProfile, SyncSession, PaletteId, PALETTES } from "../types";
import { InfoBadge, IconButton, SeedBanner, SpendPanel, GoalMini, Sidebar, Topbar, RightNow, AddModal, CommandBar } from "./Shared";
import {
  generateSyncCode,
  generateCheckNumber,
  getOrCreateRecoveryKey,
  createPlannerSnapshot,
  applyPlannerSnapshot,
  getPlannerProfiles,
  switchPlannerProfile,
  addPlannerProfile,
  deletePlannerProfile,
  syncEngine,
} from "../lib/syncEngine";
import { HostSession, GuestSession, generatePeerSyncCode, liveSync } from "../lib/peerSync";

export function Today({
  spends,
  goals,
  bills,
  income,
  startingBalance,
  emptyMode,
  loading = false,
  onAdd,
  onLog,
  onDeleteSpend,
  completed,
  setCompleted,
  onHelp,
}: {
  spends: Spend[];
  goals: Goal[];
  bills: Bill[];
  income: Income[];
  startingBalance: number;
  emptyMode: boolean;
  loading?: boolean;
  onAdd: (s: Omit<Spend, 'id'>) => void;
  onLog: () => void;
  onDeleteSpend: (id: number) => void;
  completed: boolean;
  setCompleted: (b: boolean) => void;
  onHelp: () => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  const [brain, setBrain] = useState<string[]>(() => readStorage('budget-brain', []));
  const [brainInput, setBrainInput] = useState('');
  const [graphToggle, setGraphToggle] = useState(false);
  const [showWorkedOut, setShowWorkedOut] = useState(() => {
    return localStorage.getItem('budget-show-worked-out') === 'true';
  });

  const toggleWorkedOut = () => {
    setShowWorkedOut((prev) => {
      const next = !prev;
      localStorage.setItem('budget-show-worked-out', String(next));
      return next;
    });
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const [cachedLoggedToday, setCachedLoggedToday] = useState(() => {
    return localStorage.getItem('budget-logged-today') === todayStr;
  });

  // Dynamic calendar dates
  const now = new Date();
  const currentDay = now.getDate();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const daysLeft = Math.max(1, daysInMonth - currentDay + 1);

  const startMonthStr = firstDayOfMonth.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const endMonthStr = lastDayOfMonth.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  // Dynamic financial components
  const inChecking = emptyMode ? 0 : startingBalance;
  const arrivedIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = arrivedIncome;
  const totalBills = bills.reduce((sum, item) => sum + item.amount, 0);
  const unpaidBills = bills.filter((b) => !b.paid).reduce((sum, b) => sum + b.amount, 0);
  const coveredByPay = 0;
  const totalSpent = spends.reduce((sum, s) => sum + s.amount, 0);
  const spent = totalSpent;
  const goalsSetAside = goals.reduce((sum, g) => sum + (g.saved || 0), 0);

  // Safe pool for the remainder of the month:
  // (In checking + Arrived income) - (Unpaid bills + Spends + Goals set aside)
  const safeUntilPayday = Math.max(
    0,
    inChecking + arrivedIncome - unpaidBills + coveredByPay - totalSpent - goalsSetAside
  );

  // Daily budget:
  const dailyStart = daysLeft > 0 ? safeUntilPayday / daysLeft : 0;
  const todaySpends = spends.filter((s) => s.date === todayStr);
  const todaySpent = todaySpends.reduce((sum, s) => sum + s.amount, 0);
  const safe = Math.max(0, dailyStart - todaySpent);

  const submitBrain = (e: FormEvent) => {
    e.preventDefault();
    if (brainInput.trim()) {
      const next = [...brain, brainInput.trim()];
      setBrain(next);
      window.localStorage.setItem('budget-brain', JSON.stringify(next));
      setBrainInput('');
    }
  };

  const quest1Done = cachedLoggedToday || todaySpends.length > 0;

  useEffect(() => {
    if (todaySpends.length > 0) {
      localStorage.setItem('budget-logged-today', todayStr);
      setCachedLoggedToday(true);
    } else if (spends.length === 0 && emptyMode) {
      localStorage.removeItem('budget-logged-today');
      setCachedLoggedToday(false);
    }
  }, [todaySpends.length, spends.length, emptyMode, todayStr]);

  const quest2Done = startingBalance > 0;                 // balance is set
  const quest3Done = dailyStart > 0 && todaySpent <= dailyStart; // stayed under today's limit
  const doneCount = [quest1Done, quest2Done, quest3Done].filter(Boolean).length;

  const footerMsg = doneCount === 3 ? 'All three. You are doing it.' : doneCount === 2 ? 'Two down. Keep going.' : doneCount === 1 ? 'One down. That counts.' : 'Start anywhere.';

  return (
    <div className="screen-body">
      {!loading && !quest1Done && <RightNow onDone={() => onLog()} />}
      <div className="herorow">
        <section className="hero-panel">
          <p className="eyebrow">
            {t('Safe to spend today')}
            <InfoBadge text="This is the money you can safely spend today without touching your bills, goals, or debts. It grows if you spend less, and shrinks if you overspend." />
          </p>
          <p className="hero num">
            <span className="hero-mark">{currency}</span>
            <span>{Math.floor(safe)}</span>
            <span className="hero-frac">.{Math.round((safe % 1) * 100).toString().padStart(2, '0')}</span>
          </p>
          <p className="hero-read">
            Of today's starting {money(dailyStart)} · {money(safeUntilPayday)} has to last to the end of the month
          </p>

          <button className="hero-how" onClick={toggleWorkedOut} type="button">
            How is this worked out?
          </button>

          {/* Expandable Breakdown Card */}
          {showWorkedOut && (
            <div className="worked-out-box">
              <div className="worked-out-row">
                <span className="worked-out-label">In checking</span>
                <span className="worked-out-val">{money(inChecking)}</span>
              </div>
              <div className="worked-out-row">
                <span className="worked-out-label">Arrived after that balance</span>
                <span className="worked-out-val text-green">+ {money(arrivedIncome)}</span>
              </div>
              <div className="worked-out-row">
                <span className="worked-out-label">
                  Bills not marked paid from {startMonthStr}, before {endMonthStr}
                </span>
                <span className="worked-out-val text-coral">− {money(unpaidBills)}</span>
              </div>
              <div className="worked-out-row">
                <span className="worked-out-label">Covered by pay landing before then</span>
                <span className="worked-out-val">+ {money(coveredByPay)}</span>
              </div>
              <div className="worked-out-row">
                <span className="worked-out-label">Paid and spent after that balance</span>
                <span className="worked-out-val text-coral">− {money(totalSpent)}</span>
              </div>
              <div className="worked-out-row">
                <span className="worked-out-label">Already set aside</span>
                <span className="worked-out-val text-purple">− {money(goalsSetAside)}</span>
              </div>
              <div className="worked-out-divider" />
              <div className="worked-out-row worked-out-total">
                <span className="worked-out-label"><b>Safe until payday</b></span>
                <span className="worked-out-val"><b>{money(safeUntilPayday)}</b></span>
              </div>
            </div>
          )}

          {/* Enhanced Prominent Daily Meter */}
          {(() => {
            const spendPct = dailyStart > 0 ? Math.min(100, Math.round((todaySpent / dailyStart) * 100)) : 0;
            const isOverBudget = dailyStart > 0 && todaySpent > dailyStart;
            const statusColorClass = isOverBudget ? 'meter-danger' : spendPct >= 80 ? 'meter-warn' : 'meter-ok';

            return (
              <div className="daily-meter-card" onClick={() => setGraphToggle(c => !c)} title="Click to toggle details">
                <div className="daily-meter-header">
                  <div className="meter-header-col">
                    <span className={`meter-status-indicator ${statusColorClass}`} />
                    <span className="meter-header-title">
                      <b>{money(todaySpent)}</b> spent today
                    </span>
                  </div>
                  <div className="meter-badge-wrap">
                    <span className={`meter-badge ${statusColorClass}`}>
                      {dailyStart > 0 ? `${spendPct}% of day's limit` : 'No budget set'}
                    </span>
                  </div>
                  <div className="meter-header-col right">
                    <span className="meter-header-remain">
                      <b>{money(safe)}</b> remaining
                    </span>
                  </div>
                </div>

                <div className="meter">
                  <div
                    className={`meter-fill ${statusColorClass}`}
                    style={{ width: `${dailyStart > 0 ? Math.max(spendPct, todaySpent > 0 ? 6 : 0) : 0}%` }}
                  >
                    {spendPct >= 12 && <span className="meter-inner-tag">{spendPct}%</span>}
                  </div>
                </div>

                <div className="meter-footer-info">
                  <span className="meter-info-left">
                    {graphToggle
                      ? `${money(safe)} safe left out of ${money(dailyStart)}`
                      : `${money(todaySpent)} spent of today's ${money(dailyStart)} starting`}
                  </span>
                  <span className="meter-info-hint">Click bar to toggle view</span>
                </div>
              </div>
            );
          })()}
          <div className="quickchips">
            {[
              [4, 'Coffee', 'chip-pink'],
              [12, 'Lunch', 'chip-peach'],
              [6, 'Bus', 'chip-sky'],
            ].map(([amount, label, tone]) => {
              return (
                <button className={`chip ${tone}`} onClick={() => onAdd({ amount: Number(amount), category: String(label), note: '', date: todayStr })} key={label}>
                  + {label} {currency}{amount}
                </button>
              );
            })}
          </div>
          {emptyMode && <p className="empty-note">This is your empty planner. Add money in Settings to start your own plan.</p>}
        </section>
        <section className="card quests">
          <div className="card-head">
            <h2 className="eyebrow">
              Three small things <InfoBadge text="These are three small habits that keep you on track. Quest 1 ticks when you log a spend. Quest 2 ticks when your balance is set. Quest 3 ticks when you stay under today's limit." />
            </h2>
            <span className="card-meta">{doneCount} of 3 done</span>
          </div>
          <ul className="questlist">
            <li className={quest1Done ? 'quest is-done' : 'quest'}>
              <button className="quest-btn" onClick={() => onLog()} aria-pressed={quest1Done}>
                <span className="quest-box">{quest1Done && <Check size={12} />}</span>
                <span className="quest-text">Log anything you spent today</span>
                <span className="quest-effort">30 sec</span>
              </button>
            </li>
            <li className={quest2Done ? 'quest is-done' : 'quest'}>
              <button className="quest-btn" aria-pressed={quest2Done} onClick={() => {}}>
                <span className="quest-box">{quest2Done && <Check size={12} />}</span>
                <span className="quest-text">Checking balance is set</span>
                <span className="quest-effort">1 min</span>
              </button>
            </li>
            <li className={quest3Done ? 'quest is-done' : 'quest'}>
              <button className="quest-btn" aria-pressed={quest3Done} onClick={() => {}}>
                <span className="quest-box">{quest3Done && <Check size={12} />}</span>
                <span className="quest-text">Keep today under {money(dailyStart)}</span>
                <span className="quest-effort">{quest3Done ? '✓' : '—'}</span>
              </button>
            </li>
          </ul>
          <p className="quest-foot">{footerMsg}</p>
        </section>
      </div>
      <div className="logrow">
        <section className="card register-card">
          <div className="card-head">
            <h2 className="card-title">What you logged</h2>
            <span className="card-meta">{spends.length ? `${spends.length} today` : 'Nothing yet'}</span>
          </div>
          <p className="register-sub">Every spend you log, newest first</p>
          {spends.length === 0 ? (
            <div className="register-empty">
              <p>{emptyMode ? 'Nothing here yet. Add your first spend when you are ready.' : 'Nothing logged yet. Anything you add lands here, editable.'}</p>
              <p className="register-emptyact">
                <button className="btn btn-primary" onClick={onLog}>Log a spend</button>
              </p>
            </div>
          ) : (
            <div>
              {spends.slice().reverse().map((s) => (
                <div className="register-row" key={s.id}>
                  <span>
                    <b>{s.category}</b>
                    <small>{s.note || s.date}</small>
                  </span>
                  <span className="register-amount" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    − {money(s.amount)}
                    <button className="text-button" style={{ marginLeft: 4, opacity: 0.5 }} onClick={() => onDeleteSpend(s.id)}>×</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card braindump">
          <div className="card-head">
            <h2 className="eyebrow">Brain dump <InfoBadge text="A place to write down quick thoughts or future spends before you officially log them." /></h2>
            <span className="card-meta">{brain.length ? `${brain.length} note${brain.length === 1 ? '' : 's'}` : ''}</span>
          </div>
          <form onSubmit={submitBrain}>
            <label className="sr-only" htmlFor="braindump">Add to the brain dump</label>
            <input id="braindump" className="braindump-input" value={brainInput} onChange={(e) => setBrainInput(e.target.value)} placeholder="Type it, press Enter" />
          </form>
          {brain.length === 0 ? (
            <p className="brain-note">Not money. Just yours.</p>
          ) : (
            <ul>
              {brain.map((item, i) => (
                <li className="brain-item" key={`${item}-${i}`}>
                  {item}
                  <button onClick={() => { const next = brain.filter((_, j) => j !== i); setBrain(next); window.localStorage.setItem('budget-brain', JSON.stringify(next)); }} aria-label={`Remove ${item}`}>
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="subgrid">
        <section className="card small-card">
          <h2 className="eyebrow">Coming up <InfoBadge text="The next bills that are due soon. Make sure you have enough set aside to cover these." /></h2>
          {emptyMode ? <p className="empty-note">No bills added yet.</p> : <div className="barlist">{exampleBills.map((bill) => <div className="barline" key={bill.id}><span>{bill.name}</span><i /><b>{shortMoney(bill.amount)}</b></div>)}</div>}
        </section>
        <section className="card small-card">
          <h2 className="eyebrow">{t('Run to payday')}<InfoBadge text="How much you have left to safely spend before your next payday arrives." /></h2>
          <p>{emptyMode ? 'No starting balance yet' : '10 days left'}</p>
          <div className="metric">{money(Math.max(0, startingBalance - spent))}</div>
          <p>Safe until payday</p>
        </section>
      </div>
      <div className="subgrid">
        <section className="card small-card">
          <div className="card-head"><h2 className="eyebrow">The month so far <InfoBadge text="A quick summary of everything that has come in, and everything you have spent this month." /></h2><span className="card-meta">September</span></div>
          <div className="summary-metrics">
            <div><span>{t('Came in')}</span><b>{money(emptyMode ? 0 : totalIncome)}</b></div>
            <div><span>Went out</span><b>{money(spent + (emptyMode ? 0 : totalBills))}</b></div>
            <div><span>Kept</span><b>{money(Math.max(0, (emptyMode ? 0 : totalIncome) - spent - (emptyMode ? 0 : totalBills)))}</b></div>
          </div>
        </section>
        <section className="card small-card">
          <div className="card-head"><h2 className="eyebrow">{t('Milestones')}<InfoBadge text="Automatic achievements you unlock by managing your budget, paying bills, and hitting goals." /></h2><span className="card-meta">{emptyMode ? '0 of 4 reached' : '1 of 4 reached'}</span></div>
          <div className="milestone-mini"><span className="milestone-dot done"><Check size={11} /></span><span>Every bill covered before payday</span></div>
          <div className="milestone-mini"><span className="milestone-dot" /><span>A day without spending</span></div>
        </section>
      </div>
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            Every day this month
            <InfoBadge text="A visual history of how much you have spent over the last 15 days." />
          </h2>
          <span className="card-meta">Last 15 days</span>
        </div>
        <div className="mini-chart">
          {(() => {
            const chartDays = 15;
            const today = new Date();
            const days = Array.from({ length: chartDays }, (_, i) => {
              const d = new Date(today);
              d.setDate(d.getDate() - (chartDays - 1 - i));
              return {
                dateStr: d.toISOString().split('T')[0],
                label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
                isToday: i === chartDays - 1,
              };
            });

            const spendMap = spends.reduce((acc, s) => {
              acc[s.date] = (acc[s.date] || 0) + s.amount;
              return acc;
            }, {} as Record<string, number>);

            const maxSpend = Math.max(...days.map((d) => spendMap[d.dateStr] || 0), 10);
            const totalInPeriod = days.reduce((sum, d) => sum + (spendMap[d.dateStr] || 0), 0);

            return days.map((d, i) => {
              const amount = spendMap[d.dateStr] || 0;
              // Clean flat 4px baseline when 0. Proportional 8px - 44px when spent.
              const height = amount > 0 ? Math.max(8, Math.round((amount / maxSpend) * 44)) : 4;
              return (
                <span
                  key={i}
                  className={`chart-bar ${d.isToday ? 'today-bar' : ''} ${amount > 0 ? 'has-spend' : 'empty-bar'}`}
                  style={{ height: `${height}px` }}
                  title={`${d.label}: ${amount > 0 ? money(amount) : 'no spend'}`}
                />
              );
            });
          })()}
        </div>
        <p className="chart-caption">
          {spends.length === 0
            ? 'nothing logged this month yet — the shape appears as you go'
            : 'Your spending shape is taking form · hover any bar to see day details'}
        </p>
      </section>
      <section className="card section-wide">
        <div className="card-head"><h2 className="eyebrow">Three small things to notice</h2><span className="card-meta">one screen at a time</span></div>
        <div className="notice-grid">
          <div><b>Safe to spend</b><span>{money(safe)} available today</span></div>
          <div><b>{goals.length} goals</b><span>{emptyMode ? 'Start with something small' : 'saving up on purpose'}</span></div>
          <div><b>{spends.length} spends</b><span>{spends.length ? 'logged this month' : 'nothing logged yet'}</span></div>
        </div>
      </section>
    </div>
  );
}



export function Month({
  month = 'SEP',
  onSelectMonth,
  onLog,
  onAdd,
  spends,
  bills,
  income,
  startingBalance,
  emptyMode,
  onHelp
}: {
  month?: MonthCode;
  onSelectMonth?: (m: MonthCode) => void;
  onLog?: () => void;
  onAdd?: (s: Omit<Spend, 'id'>) => void;
  spends: Spend[];
  bills: Bill[];
  income: Income[];
  startingBalance: number;
  emptyMode: boolean;
  onHelp: () => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  const monthIdx = MONTH_INDEX[month] ?? 8;
  const fullMonth = MONTH_FULL_NAMES[month] || 'September';
  const year = 2026;

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const firstDayDayOfWeek = new Date(year, monthIdx, 1).getDay();
  const startOffset = (firstDayDayOfWeek + 6) % 7;
  const totalCells = startOffset + daysInMonth;
  const numRows = Math.ceil(totalCells / 7);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIdx;
  const todayDate = isCurrentMonth ? today.getDate() : -1;
  const todayMonthCode = MONTHS[today.getMonth()] as MonthCode;

  const prevMonthCode = monthIdx > 0 ? MONTHS[monthIdx - 1] as MonthCode : null;
  const nextMonthCode = monthIdx < 11 ? MONTHS[monthIdx + 1] as MonthCode : null;

  // Notes
  const [note, setNote] = useState(() => {
    try { return localStorage.getItem(`budget-note-${month}`) || ''; } catch { return ''; }
  });
  const [keptNotes, setKeptNotes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`budget-kept-notes-${month}`) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    try {
      setNote(localStorage.getItem(`budget-note-${month}`) || '');
      setKeptNotes(JSON.parse(localStorage.getItem(`budget-kept-notes-${month}`) || '[]'));
    } catch { setNote(''); setKeptNotes([]); }
  }, [month]);

  // Day modal state
  const [dayModal, setDayModal] = useState<number | null>(null);
  const [dayTab, setDayTab] = useState<'spend' | 'note'>('spend');
  const [dayAmount, setDayAmount] = useState('');
  const [dayCategory, setDayCategory] = useState('');
  const [dayNoteInput, setDayNoteInput] = useState('');

  // Day notes stored per date string
  const [dayNotes, setDayNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(`budget-day-notes-${month}`) || '{}'); } catch { return {}; }
  });

  const openDayModal = (day: number) => {
    const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setDayModal(day);
    setDayTab('spend');
    setDayAmount('');
    setDayCategory('');
    setDayNoteInput(dayNotes[dateStr] || '');
  };

  const saveDaySpend = () => {
    if (!dayModal || !dayCategory.trim() || !Number(dayAmount)) return;
    const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayModal).padStart(2, '0')}`;
    onAdd?.({ amount: Number(dayAmount), category: dayCategory.trim(), note: '', date: dateStr });
    setDayAmount('');
    setDayCategory('');
  };

  const saveDayNote = () => {
    if (!dayModal) return;
    const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayModal).padStart(2, '0')}`;
    const updated = { ...dayNotes, [dateStr]: dayNoteInput };
    setDayNotes(updated);
    try { localStorage.setItem(`budget-day-notes-${month}`, JSON.stringify(updated)); } catch {}
    setDayModal(null);
  };

  const saveNote = (val: string) => {
    setNote(val);
    try { localStorage.setItem(`budget-note-${month}`, val); } catch {}
  };
  const keepNote = () => {
    if (!note.trim()) return;
    const updated = [...keptNotes, note.trim()];
    setKeptNotes(updated);
    try {
      localStorage.setItem(`budget-kept-notes-${month}`, JSON.stringify(updated));
      localStorage.setItem(`budget-note-${month}`, '');
    } catch {}
    setNote('');
  };
  const removeKept = (i: number) => {
    const updated = keptNotes.filter((_, j) => j !== i);
    setKeptNotes(updated);
    try { localStorage.setItem(`budget-kept-notes-${month}`, JSON.stringify(updated)); } catch {}
  };

  // Category expansion
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Calendar events
  const events = useMemo(() => {
    const map: Record<number, { label: string; type: 'bill' | 'income' | 'paid' }[]> = {};
    if (!emptyMode) {
      bills.forEach(b => {
        const match = b.due.match(/\d+/);
        if (match) {
          const day = parseInt(match[0], 10);
          if (day >= 1 && day <= daysInMonth) {
            if (!map[day]) map[day] = [];
            map[day].push({ label: b.name, type: b.paid ? 'paid' : 'bill' });
          }
        }
      });
      income.forEach(inc => {
        let day: number | null = null;
        if (inc.date.includes('-')) day = parseInt(inc.date.split('-')[2], 10);
        else { const m = inc.date.match(/\d+/); if (m) day = parseInt(m[0], 10); }
        if (day && day >= 1 && day <= daysInMonth) {
          if (!map[day]) map[day] = [];
          map[day].push({ label: inc.source, type: 'income' });
        }
      });
    }
    return map;
  }, [bills, income, emptyMode, daysInMonth]);

  const targetMonthStr = String(monthIdx + 1).padStart(2, '0');
  const monthSpends = useMemo(() => spends.filter(s => {
    if (s.date?.includes('-')) return s.date.split('-')[1] === targetMonthStr;
    return month === 'SEP';
  }), [spends, targetMonthStr, month]);

  const monthIncome = useMemo(() => income.filter(inc => {
    if (inc.date?.includes('-')) return inc.date.split('-')[1] === targetMonthStr;
    return true;
  }), [income, targetMonthStr]);

  const spent = monthSpends.reduce((sum, s) => sum + s.amount, 0);
  const totalIn = monthIncome.reduce((sum, i) => sum + i.amount, 0);
  const remaining = Math.max(0, startingBalance - spent);
  const daysLeft = isCurrentMonth ? Math.max(1, daysInMonth - today.getDate() + 1) : daysInMonth;
  const perDay = daysLeft > 0 ? remaining / daysLeft : 0;

  const todayStr = today.toISOString().split('T')[0];
  const todaySpend = monthSpends.filter(s => s.date === todayStr).reduce((sum, s) => sum + s.amount, 0);

  // Category buckets
  const CAT_BUCKETS = [
    { key: 'bills', label: 'Bills & rent', color: '#b08ad4' },
    { key: 'living', label: 'Living & food', color: '#7bbfa8' },
    { key: 'fun', label: 'Fun & friends', color: '#e8a87c' },
    { key: 'debt', label: 'To debt', color: '#d47b7b' },
    { key: 'savings', label: 'To savings', color: '#7ba8d4' },
    { key: 'leftover', label: 'Left over', color: '#a8d47b' },
  ];
  const LIVING_KW = ['food', 'grocer', 'supermarket', 'restaurant', 'dining', 'gas', 'petrol', 'transit', 'transport', 'bus', 'tube', 'uber', 'taxi', 'commute'];
  const BILL_KW = ['rent', 'bill', 'mortgage', 'insurance', 'utilities', 'electric', 'water', 'internet', 'phone', 'subscription', 'netflix', 'spotify'];
  const DEBT_KW = ['debt', 'loan', 'credit', 'repay'];
  const SAVE_KW = ['saving', 'invest', 'pension', 'goal'];

  const getBucket = (cat: string): string => {
    const lc = cat.toLowerCase();
    if (BILL_KW.some(k => lc.includes(k))) return 'bills';
    if (LIVING_KW.some(k => lc.includes(k))) return 'living';
    if (DEBT_KW.some(k => lc.includes(k))) return 'debt';
    if (SAVE_KW.some(k => lc.includes(k))) return 'savings';
    return 'fun';
  };

  const bucketTotals = useMemo(() => {
    const totals: Record<string, number> = { bills: 0, living: 0, fun: 0, debt: 0, savings: 0, leftover: 0 };
    monthSpends.forEach(s => { const b = getBucket(s.category); totals[b] = (totals[b] || 0) + s.amount; });
    totals.leftover = Math.max(0, remaining - Object.values(totals).reduce((a, b) => a + b, 0) + (totals.leftover || 0));
    return totals;
  }, [monthSpends, remaining]);

  const bucketSpends = useMemo(() => {
    const map: Record<string, Spend[]> = { bills: [], living: [], fun: [], debt: [], savings: [], leftover: [] };
    monthSpends.forEach(s => { const b = getBucket(s.category); map[b].push(s); });
    return map;
  }, [monthSpends]);

  const totalForBar = Object.values(bucketTotals).reduce((a, b) => a + b, 0) || 1;

  // Timeline events
  const timeline = useMemo(() => {
    const evs: { type: 'in' | 'out'; label: string; amount: number; date: string }[] = [];
    monthIncome.forEach(inc => evs.push({ type: 'in', label: inc.source, amount: inc.amount, date: inc.date || '' }));
    monthSpends.forEach(s => evs.push({ type: 'out', label: s.category, amount: s.amount, date: s.date || '' }));
    return evs.sort((a, b) => a.date.localeCompare(b.date));
  }, [monthIncome, monthSpends]);

  const formatTimelineDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className="screen-body">
      {/* Month navigation */}
      <div className="month-nav-bar">
        <button
          className="month-nav-btn"
          disabled={!prevMonthCode}
          onClick={() => prevMonthCode && onSelectMonth?.(prevMonthCode)}
        >‹</button>
        <span className="month-nav-label">{fullMonth} {year}</span>
        <button
          className="month-nav-btn"
          disabled={!nextMonthCode}
          onClick={() => nextMonthCode && onSelectMonth?.(nextMonthCode)}
        >›</button>
        {!isCurrentMonth && (
          <button className="btn btn-ghost month-back-btn" onClick={() => onSelectMonth?.(todayMonthCode)}>
            Back to today
          </button>
        )}
        <span className="month-nav-status">
          {isCurrentMonth ? `in progress · ${daysLeft} days left this month` : `${daysInMonth} days`}
        </span>
      </div>

      {/* Calendar */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            Every day this month <InfoBadge text="A visual overview of your entire month — bills, income, and spending all in one place." />
          </h2>
          <div className="cal-legend">
            <span><span className="legend-dot dot-bill" /> still to pay</span>
            <span><span className="legend-dot dot-income" /> money in</span>
            <span><span className="legend-dot dot-paid" /> already paid</span>
          </div>
        </div>
        <div className="calendar">
          <table>
            <thead>
              <tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <th key={d}>{d}</th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: numRows }, (_, row) => (
                <tr key={row}>
                  {Array.from({ length: 7 }, (_, col) => {
                    const cellIndex = row * 7 + col;
                    const dayNum = cellIndex - startOffset + 1;
                    const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                    const dayEvents = events[dayNum] || [];
                    const dayDateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const daySpends = monthSpends.filter(s => s.date === dayDateStr);
                    const daySpendTotal = daySpends.reduce((sum, s) => sum + s.amount, 0);
                    const hasDayNote = !!dayNotes[dayDateStr];
                    return (
                      <td
                        key={col}
                        className={`day-cell day-cell--clickable ${dayNum === todayDate ? 'today' : ''} ${!isValid ? 'empty-day' : ''}`}
                        onClick={() => isValid && openDayModal(dayNum)}
                        title={isValid ? `Click to add to ${dayNum} ${fullMonth}` : undefined}
                      >
                        {isValid && (
                          <>
                            <span className="day-num">{dayNum}</span>
                            <div className="day-dots">
                              {dayEvents.map((ev, i) => (
                                <span key={i} className={`day-dot day-dot--${ev.type}`} title={ev.label} />
                              ))}
                              {daySpendTotal > 0 && <span className="day-dot day-dot--spend" title={`${money(daySpendTotal)} spent`} />}
                              {hasDayNote && <span className="day-dot day-dot--note" title="Note" />}
                            </div>
                            {dayEvents.slice(0, 1).map((ev, i) => (
                              <div key={i} className={`day-event day-event--${ev.type}`}>{ev.label}</div>
                            ))}
                            {daySpendTotal > 0 && <div className="day-spend-amt">{money(daySpendTotal)}</div>}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cal-footer">
          <span>Each day from here <strong>{money(perDay)}/day</strong></span>
          {isCurrentMonth && (
            <span className="cal-footer-right">
              {today.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · today ·{' '}
              {todaySpend > 0 ? `${money(todaySpend)} out` : 'nothing on the books'}
            </span>
          )}
        </div>
      </section>

      {/* What you logged */}
      <section className="card section-wide list-card">
        <div className="card-head">
          <h2 className="eyebrow">What you logged in {fullMonth} {year}</h2>
          <span className="card-meta">{monthSpends.length ? `${monthSpends.length} logged` : 'nothing yet'}</span>
        </div>
        <p className="register-sub">every spend you log, newest first</p>
        {monthSpends.length === 0 ? (
          <div className="register-empty">
            <p>{emptyMode ? 'Nothing logged yet. This page will fill as you add spends.' : `nothing logged in ${fullMonth} yet — records appear as you spend.`}</p>
            <p className="register-emptyact"><button className="btn btn-primary" onClick={onLog}>Log a spend</button></p>
          </div>
        ) : (
          <div>
            {monthSpends.slice().reverse().map(s => (
              <div className="register-row" key={s.id}>
                <span><b>{s.category}</b><small>{s.note || s.date}</small></span>
                <span className="register-amount">− {money(s.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notes + Kept notes */}
      <div className="notes-grid">
        <section className="card">
          <div className="card-head">
            <h2 className="eyebrow">Notes for {fullMonth} <InfoBadge text="Write anything about this month — a reflection, a plan, a surprise spend. Keep it to save it permanently." /></h2>
            <span className="card-meta">{keptNotes.length ? `${keptNotes.length} kept` : 'no notes kept'}</span>
          </div>
          <textarea
            className="month-note-area"
            value={note}
            onChange={e => saveNote(e.target.value)}
            placeholder={`anything worth remembering about this month — a bill that felt wrong, a plan, a reason you spent...`}
            rows={5}
          />
          <div className="notes-actions">
            <button className="btn btn-primary" onClick={keepNote} disabled={!note.trim()}>Keep this note</button>
            <span className="notes-hint">notes stay with the month — they never change the numbers</span>
          </div>
        </section>
        <section className="card kept-notes-panel">
          <h2 className="eyebrow">Kept notes</h2>
          {keptNotes.length === 0 ? (
            <p className="register-sub">nothing kept for {fullMonth} yet</p>
          ) : (
            <ul>
              {keptNotes.map((n, i) => (
                <li key={i} className="kept-note-item">
                  <span>{n}</span>
                  <button className="text-button" onClick={() => removeKept(i)} aria-label="Remove">×</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* At a glance + What's happening */}
      <div className="glance-layout">
        <section className="card glance-main">
          <div className="card-head">
            <h2 className="eyebrow">{fullMonth} at a glance <InfoBadge text="A summary of what came in, went out, and is left for the month." /></h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="card-meta">{money(remaining)} kept</span>
            </div>
          </div>
          <div className="glance-grid">
            <div className="glance-card glance-in">
              <span className="glance-label">Came in</span>
              <strong className="glance-amount">{money(emptyMode ? 0 : totalIn)}</strong>
              <small>{monthIncome.length ? `${monthIncome.length} source${monthIncome.length > 1 ? 's' : ''}` : 'No payday this month'}</small>
            </div>
            <div className="glance-card glance-out">
              <span className="glance-label">Went out</span>
              <strong className="glance-amount">{money(spent)}</strong>
              <small>{spent === 0 ? 'Everything due has landed' : `${monthSpends.length} transaction${monthSpends.length !== 1 ? 's' : ''}`}</small>
            </div>
            <div className="glance-card glance-kept">
              <span className="glance-label">Kept</span>
              <strong className="glance-amount">{money(Math.max(0, totalIn - spent))}</strong>
              <small>{totalIn > 0 ? `${money(Math.round((totalIn - spent) / totalIn * 100) / 100 * 10)} of every ${money(10)}` : '—'}</small>
            </div>
            <div className="glance-card glance-still">
              <span className="glance-label">Still yours</span>
              <strong className="glance-amount">{money(remaining)}</strong>
              <small>{daysLeft} Days to payday</small>
            </div>
          </div>

          {/* Category breakdown bar */}
          <div className="cat-bar-wrap">
            {CAT_BUCKETS.map(b => {
              const pct = totalForBar > 0 ? (bucketTotals[b.key] / totalForBar) * 100 : 0;
              return pct > 0 ? (
                <div key={b.key} className="cat-bar-seg" style={{ width: `${pct}%`, background: b.color }} title={`${b.label}: ${money(bucketTotals[b.key])}`} />
              ) : null;
            })}
          </div>

          {/* Category chips */}
          <div className="cat-chips">
            {CAT_BUCKETS.map(b => (
              <button
                key={b.key}
                className={`cat-chip ${expandedCat === b.key ? 'active' : ''}`}
                onClick={() => setExpandedCat(expandedCat === b.key ? null : b.key)}
              >
                <span className="cat-dot" style={{ background: b.color }} />
                {b.label}
                <span className="cat-chip-val">{money(bucketTotals[b.key] || 0)}</span>
              </button>
            ))}
          </div>

          {/* Expanded category */}
          {expandedCat && (
            <div className="cat-expanded">
              <p className="eyebrow" style={{ marginBottom: 6 }}>{CAT_BUCKETS.find(b => b.key === expandedCat)?.label}</p>
              {(bucketSpends[expandedCat] || []).length === 0 ? (
                <p className="register-sub">Nothing here yet</p>
              ) : (
                bucketSpends[expandedCat].map(s => (
                  <div className="register-row" key={s.id} style={{ fontSize: 11 }}>
                    <span><b>{s.category}</b><small>{s.note || s.date}</small></span>
                    <span className="register-amount">− {money(s.amount)}</span>
                  </div>
                ))
              )}
              {expandedCat === 'leftover' && <p className="register-sub">Money still available after all spending</p>}
            </div>
          )}

          {spent === 0 && !emptyMode && (
            <p className="register-sub" style={{ marginTop: 12, fontStyle: 'italic' }}>Nothing has gone out yet this month</p>
          )}
        </section>

        {/* What's happening panel */}
        <section className="card glance-timeline">
          <div className="card-head">
            <h2 className="eyebrow">What's happening <InfoBadge text="A timeline of income and spending events this month." /></h2>
            <span className="card-meta">{timeline.length} {timeline.length === 1 ? 'thing' : 'things'}</span>
          </div>
          {timeline.length === 0 ? (
            <p className="register-sub">Nothing here yet</p>
          ) : (
            <div>
              {timeline.map((ev, i) => (
                <div key={i} className={`timeline-row timeline-row--${ev.type}`}>
                  <div>
                    <span className="timeline-date">{formatTimelineDate(ev.date)}</span>
                    <span className="timeline-label">{ev.label}</span>
                  </div>
                  <span className={`timeline-amount ${ev.type === 'in' ? 'amount-in' : 'amount-out'}`}>
                    {ev.type === 'in' ? '+' : '−'}{money(ev.amount)}
                  </span>
                </div>
              ))}
              {timeline.every(e => e.type === 'in') && (
                <p className="register-sub" style={{ marginTop: 8, fontStyle: 'italic' }}>Nothing here was a surprise</p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Bottom status bar */}
      <div className="month-statusbar">
        <span>{fullMonth}</span>
        <span>·</span>
        <span>{daysLeft} days left</span>
        <span>·</span>
        <span>{money(remaining)} still yours</span>
        <span>·</span>
        <span>Saved on this device</span>
      </div>

      {/* Day modal */}
      {dayModal !== null && (() => {
        const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayModal).padStart(2, '0')}`;
        const existingSpends = monthSpends.filter(s => s.date === dateStr);
        const dateLabel = new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        return (
          <div className="modal-scrim" onClick={() => setDayModal(null)}>
            <div className="modal day-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                <h2>{dateLabel}</h2>
                <button className="text-button" style={{ fontSize: 20, lineHeight: 1 }} onClick={() => setDayModal(null)}>×</button>
              </div>

              {/* Tabs */}
              <div className="day-modal-tabs">
                <button className={dayTab === 'spend' ? 'day-tab active' : 'day-tab'} onClick={() => setDayTab('spend')}>Log a spend</button>
                <button className={dayTab === 'note' ? 'day-tab active' : 'day-tab'} onClick={() => setDayTab('note')}>Add a note</button>
              </div>

              {dayTab === 'spend' && (
                <div className="modal-form">
                  <label>
                    Amount ({currency})
                    <input
                      autoFocus
                      type="number"
                      value={dayAmount}
                      onChange={e => setDayAmount(e.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      onKeyDown={e => e.key === 'Enter' && saveDaySpend()}
                    />
                  </label>
                  <label>
                    Category
                    <input
                      value={dayCategory}
                      onChange={e => setDayCategory(e.target.value)}
                      placeholder="e.g. Coffee, Lunch, Bus"
                      onKeyDown={e => e.key === 'Enter' && saveDaySpend()}
                    />
                  </label>
                  {existingSpends.length > 0 && (
                    <div className="day-existing">
                      <p className="eyebrow" style={{ marginBottom: 6 }}>Already logged this day</p>
                      {existingSpends.map(s => (
                        <div className="register-row" key={s.id} style={{ fontSize: 11 }}>
                          <span><b>{s.category}</b></span>
                          <span className="register-amount">− {money(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={() => setDayModal(null)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveDaySpend} disabled={!dayCategory.trim() || !Number(dayAmount)}>Save spend</button>
                  </div>
                </div>
              )}

              {dayTab === 'note' && (
                <div className="modal-form">
                  <label>
                    Note for {new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    <textarea
                      autoFocus
                      className="month-note-area"
                      value={dayNoteInput}
                      onChange={e => setDayNoteInput(e.target.value)}
                      placeholder="Anything worth remembering about this day..."
                      rows={3}
                      style={{ margin: '6px 0 0' }}
                    />
                  </label>
                  {dayNotes[dateStr] && (
                    <p className="register-sub" style={{ marginTop: 4 }}>Editing existing note</p>
                  )}
                  <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={() => setDayModal(null)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveDayNote}>Save note</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}


export function Bills({
  bills,
  emptyMode,
  showAddBill = false,
  onOpenAddBill,
  onCloseAddBill,
  onAddBill,
  onToggle,
  onDeleteBill,
  onHelp,
  onAddBillDirect,
}: {
  bills: Bill[];
  emptyMode: boolean;
  showAddBill?: boolean;
  onOpenAddBill?: () => void;
  onCloseAddBill?: () => void;
  onAddBill: () => void;
  onToggle: (id: number) => void;
  onDeleteBill: (id: number) => void;
  onHelp: () => void;
  onAddBillDirect?: (data: Omit<Bill, 'id'>) => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();

  // Form states with empty defaults so only placeholders show
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('Once a month');
  const [day, setDay] = useState('');

  // Auto-scroll to form when it opens
  useEffect(() => {
    if (showAddBill) {
      const timer = setTimeout(() => {
        const el = document.querySelector('.add-bill-card');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showAddBill]);

  // Month date calculation: before Wed 30 Sep
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const beforeText = `before ${monthEnd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;

  const unpaid = bills.filter((b) => !b.paid);
  const paid = bills.filter((b) => b.paid);
  const stillToGoOut = unpaid.reduce((sum, b) => sum + b.amount, 0);
  const totalPaid = paid.reduce((sum, b) => sum + b.amount, 0);
  const totalAmount = stillToGoOut + totalPaid;
  const paidPct = totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;

  const handleAddThisBill = () => {
    const billName = name.trim();
    if (!billName) return;
    const billAmount = Number(amount) || 0;
    const billDay = Math.min(31, Math.max(1, Number(day) || 1));
    const dueStr = `${billDay} of month · ${frequency}`;
    
    if (onAddBillDirect) {
      onAddBillDirect({
        name: billName,
        amount: billAmount,
        due: dueStr,
        paid: false
      });
    } else {
      onAddBill();
    }

    // Reset fields to empty placeholders
    setName('');
    setAmount('');
    setFrequency('Once a month');
    setDay('');
    onCloseAddBill?.();
  };

  const handleCancel = () => {
    setName('');
    setAmount('');
    setFrequency('Once a month');
    setDay('');
    onCloseAddBill?.();
  };

  return (
    <div className="screen-body bills-screen">
      {/* Card 1: STILL TO GO OUT */}
      <section className="card section-wide bills-still-card">
        <div className="card-head">
          <h2 className="eyebrow">
            STILL TO GO OUT
            <InfoBadge text="Money committed to upcoming bills that has not yet been paid this cycle." />
          </h2>
          <span className="card-meta">{beforeText}</span>
        </div>
        <div className="bills-big-metric">{money(stillToGoOut)}</div>
        <p className="bills-metric-sub">
          {bills.length === 0
            ? 'Add the first one — it lands on the calendar too'
            : `${unpaid.length} bills left to pay before month end`}
        </p>

        {/* Progress track */}
        <div className="bills-bar-track">
          <div className="bills-bar-fill" style={{ width: `${paidPct}%` }} />
        </div>

        {/* Legend */}
        <div className="bills-bar-legend">
          <span className="bills-legend-item">
            <span className="bills-dot bills-dot--paid" /> Paid {money(totalPaid)}
          </span>
          <span className="bills-legend-item">
            <span className="bills-dot bills-dot--topay" /> To pay {money(stillToGoOut)}
          </span>
        </div>
      </section>

      {/* Card 2: Soonest first */}
      <section className="card list-card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            Soonest first
            <InfoBadge text="Your bills ordered by due date." />
          </h2>
          <span className="card-meta">{bills.length === 0 ? 'None yet' : `${bills.length} bills`}</span>
        </div>

        {bills.length === 0 ? (
          <p className="bills-empty-instruction">
            Rent, the phone, insurance — anything that turns up on its own, once a month or every two weeks. Use{' '}
            <button
              type="button"
              className="bills-inline-link"
              onClick={() => (onOpenAddBill ? onOpenAddBill() : onAddBill())}
            >
              Add a bill
            </button>{' '}
            when you are ready.
          </p>
        ) : (
          <div className="bills-list">
            {bills.map((bill) => (
              <div className="list-row bill-list-row" key={bill.id}>
                <button className="check-line" onClick={() => onToggle(bill.id)}>
                  <span className={`quest-box ${bill.paid ? 'checked' : ''}`}>
                    {bill.paid && <Check size={12} />}
                  </span>
                  <span>
                    <span className="list-label">{bill.name}</span>
                    <span className="list-detail">{bill.due}</span>
                  </span>
                </button>
                <div className="bill-row-actions">
                  <span className="list-value">{money(bill.amount)}</span>
                  <span className={`pill ${bill.paid ? 'chip-mint' : 'chip-peach'}`}>
                    {bill.paid ? 'Paid' : 'To pay'}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => onDeleteBill(bill.id)}
                    title="Delete bill"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Card 3: Add a bill */}
      {showAddBill && (
        <section className="card section-wide add-bill-card">
          <div className="card-head">
            <h2 className="eyebrow">
              Add a bill
              <InfoBadge text="Enter details for your recurring bill." />
            </h2>
            <span className="card-meta">Repeats every month</span>
          </div>

          <div className="add-bill-fields-row">
            {/* Field 1: What is it */}
            <div className="add-bill-col">
              <label className="add-bill-label">What is it</label>
              <input
                type="text"
                className="add-bill-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rent"
              />
            </div>

            {/* Field 2: How much */}
            <div className="add-bill-col">
              <label className="add-bill-label">
                How much
                <InfoBadge text="Enter the approximate amount. You can change this anytime." />
              </label>
              <input
                type="text"
                className="add-bill-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <span className="add-bill-field-sub">Roughly is fine</span>
            </div>

            {/* Field 3: How often */}
            <div className="add-bill-col">
              <label className="add-bill-label">
                How often
                <InfoBadge text="Choose how frequently this bill repeats." />
              </label>
              <div className="add-bill-select-wrap">
                <select
                  className="add-bill-select"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="Once a month">Once a month</option>
                  <option value="Every two weeks">Every two weeks</option>
                  <option value="Once a week">Once a week</option>
                  <option value="Twice a month">Twice a month</option>
                  <option value="Once a year">Once a year</option>
                </select>
              </div>
              <span className="add-bill-field-sub">Most bills are once a month</span>
            </div>

            {/* Field 4: Day of the month */}
            <div className="add-bill-col">
              <label className="add-bill-label">
                Day of the month
                <InfoBadge text="The day of the month when this bill is due (1-31)." />
              </label>
              <input
                type="number"
                min="1"
                max="31"
                className="add-bill-input"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                placeholder="1"
              />
              <span className="add-bill-field-sub">1 to 31</span>
            </div>

            {/* Credit card note */}
            <div className="add-bill-side-instruction">
              Does this bill go on a credit card? Add the card on Debt and tick <em>This is a credit card I still use</em>. It then appears here under Paid from.
            </div>
          </div>

          {/* Yellow callout */}
          <div className="bill-yellow-banner">
            A bill charged to a card, like Netflix or Spotify, belongs here — pick the card under Paid from. If you log each card purchase as you go, don’t also add the card’s own monthly payment as a bill — record the month-end payment on Debt instead, with Record a payment.
          </div>

          {/* Action Buttons */}
          <div className="add-bill-button-row">
            <button className="btn btn-primary" onClick={handleAddThisBill}>
              Add this bill
            </button>
            <button className="btn btn-ghost" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Bottom Status bar */}
      <div className="bills-bottom-bar">
        <span>{bills.length} bills &nbsp;|&nbsp; {money(stillToGoOut)} to go</span>
        <span>Saved on this device</span>
      </div>
    </div>
  );
}


const GOAL_PALETTE = [
  '#275a43', // Forest green
  '#9d78ad', // Purple / Lilac
  '#e08092', // Coral / Pink
  '#80b6d6', // Soft blue / Sky
  '#d6a74b', // Warm ochre / Gold
  '#48a39a', // Teal / Seafoam
];

export function Goals({
  goals,
  emptyMode,
  showAddGoal = false,
  onOpenAddGoal,
  onCloseAddGoal,
  onAddGoal,
  onUpdateGoal,
  onContribute,
  onDeleteGoal,
  onHelp,
}: {
  goals: Goal[];
  emptyMode: boolean;
  showAddGoal?: boolean;
  onOpenAddGoal?: () => void;
  onCloseAddGoal?: () => void;
  onAddGoal?: (data: Omit<Goal, 'id'>) => void;
  onUpdateGoal?: (id: number, data: Partial<Goal>) => void;
  onContribute?: (id: number, amount: number) => void;
  onDeleteGoal: (id: number) => void;
  onHelp: () => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();

  // Form states with blank defaults (so placeholders show)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [alreadySaved, setAlreadySaved] = useState('');
  const [monthly, setMonthly] = useState('');
  const [color, setColor] = useState(GOAL_PALETTE[0]);

  // Inline contribute state
  const [contributingId, setContributingId] = useState<number | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');

  // Auto-scroll when form opens
  useEffect(() => {
    if (showAddGoal) {
      const timer = setTimeout(() => {
        const el = document.querySelector('.add-goal-card');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showAddGoal]);

  // Metrics
  const totalSaved = goals.reduce((sum, g) => sum + (g.saved || 0), 0);
  const totalTarget = goals.reduce((sum, g) => sum + (g.target || 0), 0);
  const stillToFind = Math.max(0, totalTarget - totalSaved);

  // Nearest completion calculation
  let nearestMonthsText = '—';
  let nearestGoalSub = 'nothing planned yet';
  let minMonths = Infinity;
  let nearestGoalName = '';

  goals.forEach((g) => {
    const rem = Math.max(0, (g.target || 0) - (g.saved || 0));
    if (rem > 0 && g.monthly && g.monthly > 0) {
      const m = Math.ceil(rem / g.monthly);
      if (m < minMonths) {
        minMonths = m;
        nearestGoalName = g.name;
      }
    }
  });

  if (minMonths !== Infinity) {
    const finishDate = new Date();
    finishDate.setMonth(finishDate.getMonth() + minMonths);
    nearestMonthsText = finishDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    nearestGoalSub = `${nearestGoalName} (${minMonths} mo${minMonths === 1 ? '' : 's'})`;
  } else if (goals.length > 0) {
    nearestGoalSub = 'Set monthly pace to see date';
  }

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const numTarget = Number(target) || 0;
    if (numTarget <= 0) return;
    const numSaved = Number(alreadySaved) || 0;
    const numMonthly = Number(monthly) || 0;

    if (editingId && onUpdateGoal) {
      onUpdateGoal(editingId, {
        name: trimmedName,
        target: numTarget,
        saved: numSaved,
        monthly: numMonthly,
        color: color,
      });
    } else if (onAddGoal) {
      onAddGoal({
        name: trimmedName,
        target: numTarget,
        saved: numSaved,
        monthly: numMonthly,
        color: color,
      });
    }

    // Reset & close
    setEditingId(null);
    setName('');
    setTarget('');
    setAlreadySaved('');
    setMonthly('');
    setColor(GOAL_PALETTE[0]);
    onCloseAddGoal?.();
  };

  const handleCancel = () => {
    setEditingId(null);
    setName('');
    setTarget('');
    setAlreadySaved('');
    setMonthly('');
    setColor(GOAL_PALETTE[0]);
    onCloseAddGoal?.();
  };

  const handleEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setName(goal.name);
    setTarget(String(goal.target));
    setAlreadySaved(String(goal.saved));
    setMonthly(goal.monthly ? String(goal.monthly) : '');
    setColor(goal.color || GOAL_PALETTE[0]);
    onOpenAddGoal?.();
  };

  const handleContributeSubmit = (id: number) => {
    const amt = Number(contributeAmount);
    if (amt > 0 && onContribute) {
      onContribute(id, amt);
      setContributingId(null);
      setContributeAmount('');
    }
  };

  return (
    <div className="screen-body goals-screen">
      {/* Card 1: PUT AWAY SO FAR */}
      <section className="card section-wide goals-putaway-card">
        <div className="goals-putaway-top">
          <div className="goals-putaway-head-left">
            <h2 className="eyebrow goals-eyebrow">
              PUT AWAY SO FAR
              <InfoBadge text="Total money already saved across all your active goals." />
            </h2>
            <p className="goals-putaway-sub">
              {totalSaved === 0
                ? 'Nothing put away yet'
                : `${money(totalSaved)} saved across ${goals.length} goal${goals.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="goals-putaway-head-right">
            <div className="goals-big-metric">{money(totalSaved)}</div>
            <span className="goals-status-pill">
              {goals.length === 0 ? 'No goals yet' : `${goals.length} active`}
            </span>
          </div>
        </div>

        {/* Split sub-cards: Still to find & Nearest date */}
        <div className="goals-split-cards">
          <div className="goals-subcard">
            <div className="goals-subcard-title">Still to find</div>
            <div className="goals-subcard-metric">
              {goals.length === 0 ? '—' : money(stillToFind)}
            </div>
            <div className="goals-subcard-sub">
              {goals.length === 0 ? 'Nothing to find yet' : `${money(stillToFind)} to reach all targets`}
            </div>
          </div>

          <div className="goals-subcard">
            <div className="goals-subcard-title">Nearest date</div>
            <div className="goals-subcard-metric">{nearestMonthsText}</div>
            <div className="goals-subcard-sub">{nearestGoalSub}</div>
          </div>
        </div>
      </section>

      {/* Card 2: Every goal */}
      <section className="card list-card section-wide goals-list-card">
        <div className="card-head">
          <h2 className="eyebrow">
            Every goal
            <InfoBadge text="All your savings goals, their targets, and your monthly pace." />
          </h2>
          <span className="card-meta">{goals.length === 0 ? '—' : `${goals.length} goals`}</span>
        </div>

        {goals.length === 0 ? (
          <div className="goals-empty-state">
            <div className="goals-empty-icon-wrap">
              <Target size={22} className="goals-empty-icon" />
            </div>
            <p className="goals-empty-text">
              Nothing here yet. A name, an amount, and what you can spare each month are enough to begin.{' '}
              <button
                type="button"
                className="bills-inline-link"
                onClick={onOpenAddGoal}
              >
                Add a goal
              </button>
            </p>
          </div>
        ) : (
          <div className="goals-list">
            {goals.map((goal) => {
              const goalColor = goal.color || GOAL_PALETTE[0];
              const pct = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
              const rem = Math.max(0, goal.target - goal.saved);
              return (
                <div className="goals-row-container" key={goal.id}>
                  <div className="goals-row-main">
                    <div className="goals-row-left">
                      <span className="goal-dot-circle" style={{ borderColor: goalColor }}>
                        <span className="goal-dot-inner" style={{ backgroundColor: goalColor }} />
                      </span>
                      <div className="goals-row-info">
                        <span className="goals-row-name">{goal.name}</span>
                        <span className="goals-row-meta">
                          {goal.monthly > 0 ? `${money(goal.monthly)} each month` : 'No monthly pace set'}
                          &nbsp;·&nbsp;
                          {rem === 0 ? 'Goal reached! 🎉' : `${money(rem)} still to find`}
                        </span>
                      </div>
                    </div>

                    <div className="goals-row-right">
                      <div className="goals-row-numbers">
                        <span className="goals-row-saved">{money(goal.saved)}</span>
                        <span className="goals-row-target">of {money(goal.target)}</span>
                      </div>
                      <span
                        className="goals-pct-badge"
                        style={{ color: goalColor, borderColor: goalColor }}
                      >
                        {pct}%
                      </span>
                      <button
                        type="button"
                        className="goals-action-btn goals-action-btn--primary"
                        onClick={() => setContributingId(contributingId === goal.id ? null : goal.id)}
                        title="Put money into this goal"
                      >
                        + Put in
                      </button>
                      <button
                        type="button"
                        className="goals-action-btn"
                        onClick={() => handleEdit(goal)}
                        title="Edit goal"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="goals-action-btn goals-action-btn--remove"
                        onClick={() => onDeleteGoal(goal.id)}
                        title="Delete goal"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Goal progress track with chosen color */}
                  <div className="goals-track">
                    <div
                      className="goals-fill"
                      style={{ width: `${pct}%`, backgroundColor: goalColor }}
                    />
                  </div>

                  {/* Inline contribute drawer */}
                  {contributingId === goal.id && (
                    <div className="goals-inline-contribute">
                      <span className="goals-contribute-label">Put money into {goal.name}:</span>
                      <input
                        type="text"
                        className="add-goal-input goals-contribute-input"
                        placeholder="50.00"
                        value={contributeAmount}
                        onChange={(e) => setContributeAmount(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleContributeSubmit(goal.id)}
                      >
                        Put it in
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setContributingId(null); setContributeAmount(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Card 3: Add a goal */}
      {showAddGoal && (
        <section className="card section-wide add-goal-card">
          <div className="card-head">
            <h2 className="eyebrow">
              {editingId ? 'Edit goal' : 'Add a goal'}
              <InfoBadge text="Enter details for your savings goal." />
            </h2>
            <span className="card-meta">name, amount, pace</span>
          </div>

          <div className="add-goal-grid">
            {/* Field 1: What it is for */}
            <div className="add-goal-col">
              <label className="add-goal-label">
                What it is for
                <InfoBadge text="Give your goal a clear, motivating name." />
              </label>
              <input
                type="text"
                className="add-goal-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Japan, next spring"
                autoFocus
              />
            </div>

            {/* Field 2: How much you need */}
            <div className="add-goal-col">
              <label className="add-goal-label">
                How much you need
                <InfoBadge text="Total target amount you need to save." />
              </label>
              <input
                type="text"
                className="add-goal-input"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>

            {/* Field 3: Already put away */}
            <div className="add-goal-col">
              <label className="add-goal-label">
                Already put away
                <InfoBadge text="Amount already saved toward this goal so far." />
              </label>
              <input
                type="text"
                className="add-goal-input"
                value={alreadySaved}
                onChange={(e) => setAlreadySaved(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>

            {/* Field 4: Each month */}
            <div className="add-goal-col">
              <label className="add-goal-label">
                Each month
                <InfoBadge text="How much you plan to save every month." />
              </label>
              <input
                type="text"
                className="add-goal-input"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <span className="add-goal-field-sub">roughly is fine</span>
            </div>
          </div>

          {/* Row 3: Colour */}
          <div className="add-goal-color-section">
            <label className="add-goal-label">
              Colour
              <InfoBadge text="Choose a palette color for this goal." />
            </label>
            <div className="goal-color-palette">
              {GOAL_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`goal-color-circle ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  title={`Select ${c}`}
                />
              ))}
            </div>
            <span className="add-goal-field-sub">Its ring, dot and bar wear it</span>
          </div>

          {/* Action Buttons */}
          <div className="add-goal-button-row">
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {editingId ? 'Save goal' : 'Add this goal'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Bottom Status bar */}
      <div className="bills-bottom-bar">
        <span>
          {goals.length === 0 ? 'No goals yet  —' : `${goals.length} goals  |  ${money(totalSaved)} put away so far`}
        </span>
        <span>Saved on this device</span>
      </div>
    </div>
  );
}


export function Income({
  income,
  emptyMode,
  showAddIncome = false,
  onOpenAddIncome,
  onCloseAddIncome,
  onAdd,
  onUpdate,
  onRemove,
}: {
  income: Income[];
  emptyMode: boolean;
  showAddIncome?: boolean;
  onOpenAddIncome?: () => void;
  onCloseAddIncome?: () => void;
  onAdd?: (data: Omit<Income, 'id'>) => void;
  onUpdate?: (id: number, data: Partial<Income>) => void;
  onRemove: (id: number) => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();

  // Reference dates
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const currentMonthName = now.toLocaleDateString('en-GB', { month: 'long' });
  const monthYearLabel = `${currentMonthName} ${now.getFullYear()}`;

  // Form states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  
  const toISODate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [dateInput, setDateInput] = useState(() => toISODate(now));
  const [status, setStatus] = useState<'arrived' | 'expected'>('arrived');

  const parseIncomeDate = (dateStr?: string): Date => {
    if (!dateStr) return new Date();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const currentYear = now.getFullYear();
    // String like "Thu 1 Oct", "Mon 1 Oct", "1 Oct", "Mon 21 Sep"
    const match = dateStr.match(/(?:[A-Za-z]{3}\s+)?(\d{1,2})\s+([A-Za-z]{3})/i);
    if (match) {
      const day = Number(match[1]);
      const monthStr = match[2].toUpperCase();
      const monthIdx = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].indexOf(monthStr);
      if (monthIdx !== -1) {
        return new Date(currentYear, monthIdx, day);
      }
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      if (parsed.getFullYear() < 2020) parsed.setFullYear(currentYear);
      return parsed;
    }
    return new Date();
  };

  const formatDisplayDate = (d: Date): string => {
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Determine item status: an income is strictly either 'arrived' or 'still' (still to come)
  const getItemStatus = (item: Income): 'arrived' | 'still' => {
    const d = parseIncomeDate(item.date);
    // If the date is in the future, it cannot have arrived yet; it is still to come
    if (d.getTime() > todayStart.getTime()) {
      return 'still';
    }
    // If explicitly marked as expected
    if (item.status === 'expected') {
      return 'still';
    }
    // Date is today or past, so it has arrived
    return 'arrived';
  };

  // Auto-scroll when form opens
  useEffect(() => {
    if (showAddIncome) {
      const timer = setTimeout(() => {
        const el = document.querySelector('.add-income-card');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showAddIncome]);

  // Aggregate metrics: strictly either arrived or still to come
  const arrivedItems = income.filter((item) => getItemStatus(item) === 'arrived');
  const stillItems = income.filter((item) => getItemStatus(item) === 'still');
  const stillThisMonthItems = stillItems.filter((item) => parseIncomeDate(item.date).getTime() <= monthEnd.getTime());
  const laterItems = stillItems.filter((item) => parseIncomeDate(item.date).getTime() > monthEnd.getTime());

  const arrivedTotal = arrivedItems.reduce((sum, item) => sum + item.amount, 0);
  const stillTotal = stillThisMonthItems.reduce((sum, item) => sum + item.amount, 0);
  const laterTotal = laterItems.reduce((sum, item) => sum + item.amount, 0);
  const totalCycleIncome = arrivedTotal + stillTotal;
  const barPercent = totalCycleIncome > 0
    ? Math.min(100, Math.round((arrivedTotal / totalCycleIncome) * 100))
    : (arrivedTotal > 0 ? 100 : 0);

  // Quick actions from subcards
  const handleQuickAddStillToCome = () => {
    // 5 days from now or month end
    const target = new Date(Math.min(todayStart.getTime() + 5 * 86400000, monthEnd.getTime()));
    setDateInput(toISODate(target));
    setStatus('expected');
    setEditingId(null);
    setSource('');
    setAmount('');
    onOpenAddIncome?.();
  };

  const handleQuickAddLater = () => {
    // 1st of next month
    const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    setDateInput(toISODate(nextMonthFirst));
    setStatus('expected');
    setEditingId(null);
    setSource('');
    setAmount('');
    onOpenAddIncome?.();
  };

  const handleSave = () => {
    const trimmedSource = source.trim();
    if (!trimmedSource) return;
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return;

    const parsed = parseIncomeDate(dateInput);
    const isFuture = parsed.getTime() > todayStart.getTime();

    // Mutual exclusivity: arrived items cannot be in the future
    let finalStatus: 'arrived' | 'expected' = isFuture ? 'expected' : status;
    let finalDate = formatDisplayDate(parsed);

    if (status === 'arrived' && isFuture) {
      // Arrived money lands today
      finalDate = formatDisplayDate(now);
      finalStatus = 'arrived';
    } else if (status === 'expected' && !isFuture) {
      finalStatus = 'expected';
    }

    if (editingId && onUpdate) {
      onUpdate(editingId, {
        source: trimmedSource,
        amount: numAmount,
        date: finalDate,
        status: finalStatus,
      });
    } else if (onAdd) {
      onAdd({
        source: trimmedSource,
        amount: numAmount,
        date: finalDate,
        status: finalStatus,
      });
    }

    // Reset
    setEditingId(null);
    setSource('');
    setAmount('');
    setDateInput(toISODate(now));
    setStatus('arrived');
    onCloseAddIncome?.();
  };

  const handleCancel = () => {
    setEditingId(null);
    setSource('');
    setAmount('');
    setDateInput(toISODate(now));
    setStatus('arrived');
    onCloseAddIncome?.();
  };

  const handleEdit = (item: Income) => {
    setEditingId(item.id);
    setSource(item.source);
    setAmount(String(item.amount));
    const parsed = parseIncomeDate(item.date);
    setDateInput(toISODate(parsed));
    const st = getItemStatus(item);
    setStatus(st === 'arrived' ? 'arrived' : 'expected');
    onOpenAddIncome?.();
  };

  const handleMarkArrived = (id: number) => {
    if (onUpdate) {
      onUpdate(id, {
        date: formatDisplayDate(now),
        status: 'arrived',
      });
    }
  };

  const handleMarkStillToCome = (id: number) => {
    if (onUpdate) {
      // Set to 7 days ahead
      const futureDate = new Date(todayStart.getTime() + 7 * 86400000);
      onUpdate(id, {
        date: formatDisplayDate(futureDate),
        status: 'expected',
      });
    }
  };

  // Sort newest first
  const sortedIncome = [...income].sort((a, b) => b.id - a.id);

  return (
    <div className="screen-body income-screen">
      {/* Card 1: ARRIVED THIS MONTH */}
      <section className="card section-wide income-arrived-card">
        <div className="card-head">
          <h2 className="eyebrow income-eyebrow">
            <span className="income-dot income-dot--arrived" />
            ARRIVED THIS MONTH
            <InfoBadge text="Money that has already been received in your account this month." />
          </h2>
          <span className="card-meta">{monthYearLabel}</span>
        </div>

        <div className="income-big-metric">{money(arrivedTotal)}</div>
        <p className="income-metric-sub">
          {stillTotal === 0 && arrivedTotal > 0
            ? `All of ${currentMonthName} has landed`
            : arrivedTotal === 0
            ? `No extra money has landed yet in ${currentMonthName}`
            : `${money(stillTotal)} expected before ${currentMonthName} ends`}
        </p>

        {/* Solid green bar */}
        <div className="income-bar-track">
          <div className="income-bar-fill" style={{ width: `${barPercent}%` }} />
        </div>

        {/* Split subcards: Still to come & Later */}
        <div className="income-split-cards">
          {/* Box 1: Still to come */}
          <div
            className="income-subcard income-subcard--still"
            onClick={handleQuickAddStillToCome}
            role="button"
            tabIndex={0}
            title="Click to record future income expected before month end"
          >
            <div className="income-subcard-head">
              <span className="income-subcard-dot income-subcard-dot--still" />
              <span className="income-subcard-title">Still to come</span>
            </div>
            <div className="income-subcard-amount">{money(stillTotal)}</div>
            <div className="income-subcard-sub">
              {stillTotal > 0
                ? `${stillThisMonthItems.length} payment${stillThisMonthItems.length === 1 ? '' : 's'} expected before the month ends`
                : 'No extra money before the month ends'}
            </div>
          </div>

          {/* Box 2: Later */}
          <div
            className="income-subcard income-subcard--later"
            onClick={handleQuickAddLater}
            role="button"
            tabIndex={0}
            title="Click to record income expected in future months"
          >
            <div className="income-subcard-head">
              <span className="income-subcard-dot income-subcard-dot--later" />
              <span className="income-subcard-title">Later</span>
            </div>
            <div className="income-subcard-amount">{money(laterTotal)}</div>
            <div className="income-subcard-sub">
              {laterTotal > 0
                ? `${laterItems.length} payment${laterItems.length === 1 ? '' : 's'} expected after the month ends`
                : 'No extra money after the month ends'}
            </div>
          </div>
        </div>
      </section>

      {/* Card 2: Newest first */}
      <section className="card list-card section-wide income-list-card">
        <div className="card-head">
          <h2 className="eyebrow">
            Newest first
            <InfoBadge text="Your extra money entries, ordered newest first with arrival status." />
          </h2>
          <span className="card-meta">
            {income.length === 0 ? 'None yet' : `${income.length} recorded`}
          </span>
        </div>

        {income.length === 0 ? (
          <p className="income-empty-instruction">
            No extra money recorded yet. Use{' '}
            <button
              type="button"
              className="bills-inline-link"
              onClick={onOpenAddIncome}
            >
              Record money in
            </button>{' '}
            when you receive unexpected cash, a bonus, or expect future income.
          </p>
        ) : (
          <div className="income-list">
            {sortedIncome.map((item) => {
              const itemStatus = getItemStatus(item);
              return (
                <div className="list-row income-list-row" key={item.id}>
                  <div className="income-row-left">
                    <span className="list-label">{item.source}</span>
                    <div className="income-row-badges">
                      <span className={`income-chip income-chip--${itemStatus}`}>
                        <span className="income-chip-dot" />
                        {itemStatus === 'arrived' ? 'arrived' : 'still to come'}
                      </span>
                      <span className="income-row-date">{item.date}</span>
                      {itemStatus === 'still' ? (
                        <button
                          type="button"
                          className="income-mark-arrived-btn"
                          onClick={() => handleMarkArrived(item.id)}
                          title="Mark this payment as received today"
                        >
                          ✓ Mark arrived
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="income-mark-revert-btn"
                          onClick={() => handleMarkStillToCome(item.id)}
                          title="Change back to Still to come"
                        >
                          ↩ Still to come
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="income-row-right">
                    <span className="list-value">{money(item.amount)}</span>
                    <button
                      type="button"
                      className="income-action-btn"
                      onClick={() => handleEdit(item)}
                      title="Edit this entry"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="income-action-btn income-action-btn--remove"
                      onClick={() => onRemove(item.id)}
                      title="Remove this entry"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Card 3: Put down money in (Add / Edit Form) */}
      {showAddIncome && (
        <section className="card section-wide add-income-card">
          <div className="card-head">
            <h2 className="eyebrow">
              {editingId ? 'Edit money in' : 'Put down money in'}
              <InfoBadge text="Enter details for one-off income or future expected money." />
            </h2>
            <span className="card-meta">one amount, one day</span>
          </div>

          <p className="add-income-desc">
            Regular pay is set up in Settings and lands here when Today asks about it. This is for everything else.
          </p>

          {/* Quick preset suggestions */}
          <div className="income-preset-pills">
            <span className="income-preset-label">Quick pick:</span>
            {['Tax refund', 'Bonus', 'Freelance', 'Gift', 'Side gig', 'Reimbursement'].map((preset) => (
              <button
                key={preset}
                type="button"
                className="income-preset-chip"
                onClick={() => setSource(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="add-income-fields-row">
            {/* Field 1: What it was */}
            <div className="add-income-col">
              <label className="add-income-label">What it was</label>
              <input
                type="text"
                className="add-income-input"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Tax refund"
                autoFocus
              />
              <span className="add-income-field-sub">Whatever you call it</span>
            </div>

            {/* Field 2: How much */}
            <div className="add-income-col">
              <label className="add-income-label">
                How much
                <InfoBadge text="Enter the exact or expected amount." />
              </label>
              <input
                type="text"
                className="add-income-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <span className="add-income-field-sub">Roughly is fine</span>
            </div>

            {/* Field 3: The day it lands */}
            <div className="add-income-col add-income-col--date">
              <label className="add-income-label">
                The day it lands
                <InfoBadge text="Select today if already received, or a future date if expected later." />
              </label>
              <input
                type="date"
                className="add-income-input add-income-date-input"
                value={dateInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setDateInput(val);
                  const d = parseIncomeDate(val);
                  if (d.getTime() > todayStart.getTime()) {
                    setStatus('expected');
                  } else {
                    setStatus('arrived');
                  }
                }}
              />
              <span className="add-income-field-sub">
                {parseIncomeDate(dateInput).getTime() > monthEnd.getTime()
                  ? '📅 will show under "Later"'
                  : parseIncomeDate(dateInput).getTime() > todayStart.getTime()
                  ? '⏳ will show under "Still to come"'
                  : 'Today, or a day you expect'}
              </span>
            </div>

            {/* Field 4: Status (Arrived vs Still to come) */}
            <div className="add-income-col add-income-col--status">
              <label className="add-income-label">
                Status
                <InfoBadge text="Pick whether this has already landed or is still to come in the future." />
              </label>
              <div className="income-status-toggle">
                <button
                  type="button"
                  className={`income-status-btn ${status === 'arrived' ? 'active active--arrived' : ''}`}
                  onClick={() => {
                    setStatus('arrived');
                    const d = parseIncomeDate(dateInput);
                    if (d.getTime() > todayStart.getTime()) {
                      setDateInput(toISODate(now));
                    }
                  }}
                >
                  ● Arrived
                </button>
                <button
                  type="button"
                  className={`income-status-btn ${status === 'expected' ? 'active active--expected' : ''}`}
                  onClick={() => {
                    setStatus('expected');
                    const d = parseIncomeDate(dateInput);
                    if (d.getTime() <= todayStart.getTime()) {
                      const futureD = new Date(todayStart.getTime() + 7 * 86400000);
                      setDateInput(toISODate(futureD));
                    }
                  }}
                >
                  ⏳ Still to come
                </button>
              </div>
              <span className="add-income-field-sub">
                {status === 'arrived' ? 'Counts in Arrived this month' : 'Counts in Still to come / Later'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="add-income-button-row">
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {editingId ? 'Save changes' : 'Put this down'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Bottom Status bar */}
      <div className="bills-bottom-bar">
        <span>{income.length} recorded &nbsp;|&nbsp; {money(arrivedTotal)} in safe to spend</span>
        <span>Saved on this device</span>
      </div>
    </div>
  );
}


export function Debt({
  debts,
  emptyMode,
  showAddDebt = false,
  onOpenAddDebt,
  onCloseAddDebt,
  onAdd,
  onUpdate,
  onRemove,
  onPay,
}: {
  debts: Debt[];
  emptyMode: boolean;
  showAddDebt?: boolean;
  onOpenAddDebt?: () => void;
  onCloseAddDebt?: () => void;
  onAdd?: (data: Omit<Debt, 'id'>) => void;
  onUpdate?: (id: number, data: Partial<Debt>) => void;
  onRemove: (id: number) => void;
  onPay?: (id: number, amount: number) => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();

  // Form states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [isCreditCard, setIsCreditCard] = useState(false);
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [minimum, setMinimum] = useState('');
  const [frequency, setFrequency] = useState('Once a month');
  const [dueDay, setDueDay] = useState('');

  // Inline payment state
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');

  // Auto-scroll when form opens
  useEffect(() => {
    if (showAddDebt) {
      const timer = setTimeout(() => {
        const el = document.querySelector('.add-debt-card');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showAddDebt]);

  const total = debts.reduce((sum, item) => sum + item.amount, 0);
  const totalMinimums = debts.reduce((sum, item) => sum + (item.minimum || 0), 0);

  const handlePaySubmit = (id: number) => {
    const val = Number(payAmount);
    if (val > 0 && onPay) {
      onPay(id, val);
      setPayingId(null);
      setPayAmount('');
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const numAmount = Number(amount) || 0;
    const numMin = Number(minimum) || 0;
    const numRate = rate.trim() ? Number(rate) : undefined;
    const numDay = dueDay.trim() ? Math.min(31, Math.max(1, Number(dueDay))) : undefined;

    if (editingId && onUpdate) {
      onUpdate(editingId, {
        name: trimmedName,
        amount: numAmount,
        minimum: numMin,
        isCreditCard,
        rate: numRate,
        frequency,
        dueDay: numDay,
      });
    } else if (onAdd) {
      onAdd({
        name: trimmedName,
        amount: numAmount,
        minimum: numMin,
        isCreditCard,
        rate: numRate,
        frequency,
        dueDay: numDay,
      });
    }

    // Reset and close
    setEditingId(null);
    setName('');
    setIsCreditCard(false);
    setAmount('');
    setRate('');
    setMinimum('');
    setFrequency('Once a month');
    setDueDay('');
    onCloseAddDebt?.();
  };

  const handleCancel = () => {
    setEditingId(null);
    setName('');
    setIsCreditCard(false);
    setAmount('');
    setRate('');
    setMinimum('');
    setFrequency('Once a month');
    setDueDay('');
    onCloseAddDebt?.();
  };

  const handleEdit = (item: Debt) => {
    setEditingId(item.id);
    setName(item.name);
    setIsCreditCard(Boolean(item.isCreditCard));
    setAmount(String(item.amount));
    setRate(item.rate !== undefined ? String(item.rate) : '');
    setMinimum(String(item.minimum || ''));
    setFrequency(item.frequency || 'Once a month');
    setDueDay(item.dueDay !== undefined ? String(item.dueDay) : '');
    onOpenAddDebt?.();
  };

  return (
    <div className="screen-body debt-screen">
      {/* Card 1: STILL OWED */}
      <section className="card section-wide debt-owed-card">
        <div className="card-head">
          <h2 className="eyebrow">
            STILL OWED
            <InfoBadge text="Total balance owed across all your debts, loans, and credit cards." />
          </h2>
          <span className="card-meta">
            {debts.length === 0 ? 'nothing on the file' : `${debts.length} on the file`}
          </span>
        </div>

        <div className="debt-big-metric">{money(emptyMode ? 0 : total)}</div>

        <div className={`debt-status-pill ${total <= 0 ? 'debt-status-pill--clear' : 'debt-status-pill--paying'}`}>
          <span className="debt-pill-dot" />
          {total <= 0 ? 'nothing owed' : 'paying down'}
        </div>

        <p className="debt-desc-sub">
          {total <= 0
            ? 'Nothing owed here — add one only if you want a payoff plan.'
            : `${money(totalMinimums)} required each month across ${debts.length} debt${debts.length === 1 ? '' : 's'}`}
        </p>
      </section>

      {/* Card 2: Debts List (if any debts recorded) */}
      {debts.length > 0 && (
        <section className="card list-card section-wide debt-list-card">
          <div className="card-head">
            <h2 className="eyebrow">
              Every debt you owe
              <InfoBadge text="Your loans and cards. Use Pay down to record a payment and reduce the balance." />
            </h2>
            <span className="card-meta">{debts.length} recorded</span>
          </div>

          <div className="debt-list">
            {debts.map((item) => {
              const isPaidOff = item.amount <= 0;
              return (
                <div className="debt-row-container" key={item.id}>
                  <div className="debt-list-row">
                    <div className="debt-row-left">
                      <span className="list-label">
                        {item.name}
                        {isPaidOff && <span className="paid-off-badge">Paid off! 🎉</span>}
                      </span>
                      <div className="debt-row-badges">
                        {item.isCreditCard && (
                          <span className="debt-chip debt-chip--card">credit card</span>
                        )}
                        {item.rate !== undefined && item.rate > 0 && (
                          <span className="debt-chip debt-chip--rate">{item.rate}% APR</span>
                        )}
                        {item.frequency && (
                          <span className="debt-chip debt-chip--freq">{item.frequency}</span>
                        )}
                        {item.dueDay && (
                          <span className="debt-row-day">Day {item.dueDay}</span>
                        )}
                        {item.minimum > 0 && (
                          <span>Send {money(item.minimum)}</span>
                        )}
                      </div>
                    </div>

                    <div className="debt-row-right">
                      <span className="list-value">{money(item.amount)}</span>
                      {!isPaidOff && onPay && (
                        <button
                          type="button"
                          className="debt-action-btn"
                          onClick={() => {
                            if (payingId === item.id) {
                              setPayingId(null);
                            } else {
                              setPayingId(item.id);
                              setPayAmount(String(item.minimum || 50));
                            }
                          }}
                        >
                          {payingId === item.id ? 'Cancel' : 'Pay down'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="debt-action-btn"
                        onClick={() => handleEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="debt-action-btn debt-action-btn--remove"
                        onClick={() => onRemove(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {payingId === item.id && (
                    <div className="debt-inline-payment-box">
                      <span className="payment-box-title">Make a payment towards <b>{item.name}</b>:</span>
                      <div className="payment-box-inputs">
                        <div className="payment-input-wrap">
                          <span className="payment-currency">{currency}</span>
                          <input
                            type="number"
                            min="1"
                            max={item.amount}
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="Amount"
                            className="debt-payment-input"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handlePaySubmit(item.id);
                            }}
                          />
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={!payAmount || Number(payAmount) <= 0}
                          onClick={() => handlePaySubmit(item.id)}
                        >
                          Apply payment
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setPayingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Card 3: Add a debt (Toggleable Form) */}
      {showAddDebt && (
        <section className="card section-wide add-debt-card">
          <div className="card-head">
            <h2 className="eyebrow">
              {editingId ? 'Edit debt' : 'Add a debt'}
              <InfoBadge text="Enter details for a credit card, loan, or debt you want to pay down." />
            </h2>
            <span className="card-meta">a loan, or a credit card you still use</span>
          </div>

          {/* Row 1: What is it + This is a credit card I still use */}
          <div className="add-debt-row">
            <div className="add-debt-col">
              <label className="add-debt-label">What is it</label>
              <input
                type="text"
                className="add-debt-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Blue card"
                autoFocus
              />
              <span className="add-debt-field-sub">as you call it</span>
            </div>

            <div className="debt-checkbox-col">
              <label className="debt-checkbox-label">
                <input
                  type="checkbox"
                  className="debt-checkbox"
                  checked={isCreditCard}
                  onChange={(e) => setIsCreditCard(e.target.checked)}
                />
                <span>This is a credit card I still use</span>
                <InfoBadge text="Purchases and bills you put on it are added to what you owe automatically." />
              </label>
              <span className="add-debt-field-sub">purchases and bills you put on it are added to what you owe</span>
            </div>
          </div>

          {/* Row 2: Left on it + Rate a year */}
          <div className="add-debt-row">
            <div className="add-debt-col">
              <label className="add-debt-label">
                <span className="debt-dot debt-dot--green" />
                Left on it
                <InfoBadge text="Today's current outstanding balance." />
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="add-debt-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <span className="add-debt-field-sub">today's balance</span>
            </div>

            <div className="add-debt-col">
              <label className="add-debt-label">
                <span className="debt-dot debt-dot--orange" />
                Rate a year
                <InfoBadge text="The APR percentage. Empty means no interest." />
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="add-debt-input"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="19.99"
              />
              <span className="add-debt-field-sub">the APR — empty means no interest</span>
            </div>
          </div>

          {/* Row 3: You send each time + How often */}
          <div className="add-debt-row">
            <div className="add-debt-col">
              <label className="add-debt-label">
                <span className="debt-dot debt-dot--purple" />
                You send each time
                <InfoBadge text="What actually leaves your account each payment." />
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="add-debt-input"
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
                placeholder="0.00"
              />
              <span className="add-debt-field-sub">what actually leaves</span>
            </div>

            <div className="add-debt-col">
              <label className="add-debt-label">
                How often
                <InfoBadge text="How often this payment leaves." />
              </label>
              <select
                className="add-debt-select"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="Once a month">Once a month</option>
                <option value="Every two weeks">Every two weeks</option>
                <option value="Every week">Every week</option>
                <option value="Twice a month">Twice a month</option>
              </select>
              <span className="add-debt-field-sub">how often that payment leaves</span>
            </div>
          </div>

          {/* Row 4: Day the minimum comes out */}
          <div className="add-debt-row">
            <div className="add-debt-col">
              <label className="add-debt-label">
                Day the minimum comes out
                <InfoBadge text="Optional — puts it on your calendar." />
              </label>
              <input
                type="number"
                min="1"
                max="31"
                className="add-debt-input"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="20"
              />
              <span className="add-debt-field-sub">optional — puts it on your calendar</span>
            </div>
            <div className="add-debt-col" />
          </div>

          {/* Action buttons */}
          <div className="add-debt-button-row">
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {editingId ? 'Save changes' : 'Add this debt'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleCancel}>
              Cancel
            </button>
          </div>

          {/* Lavender callout banner */}
          <div className="debt-banner-box">
            Give it the day it comes out and it appears on your calendar with your bills, ready to tick off — the money is held out of safe to spend once, and marking it paid brings the balance here down by itself
          </div>
        </section>
      )}

      {/* Bottom Status bar */}
      <div className="bills-bottom-bar">
        <span>{debts.length} on file &nbsp;|&nbsp; {money(total)} still owed</span>
        <span>Saved on this device</span>
      </div>
    </div>
  );
}


const ENVELOPE_COLORS = [
  { name: 'Pale pink', color: '#f472b6', bg: '#fce7f3' },
  { name: 'Soft peach', color: '#fb923c', bg: '#ffedd5' },
  { name: 'Sage green', color: '#34d399', bg: '#dcfce7' },
  { name: 'Sky blue', color: '#38bdf8', bg: '#e0f2fe' },
  { name: 'Soft lavender', color: '#a855f7', bg: '#f3e8ff' },
  { name: 'Muted gold', color: '#eab308', bg: '#fef9c3' },
];

const ENVELOPE_QUICK_PRESETS = [
  { label: 'Coffee', colorName: 'Pale pink', color: '#f472b6', dotClass: 'chip-pink' },
  { label: 'Food', colorName: 'Soft peach', color: '#fb923c', dotClass: 'chip-peach' },
  { label: 'Groceries', colorName: 'Sage green', color: '#34d399', dotClass: 'chip-green' },
  { label: 'Gas', colorName: 'Sky blue', color: '#38bdf8', dotClass: 'chip-sky' },
];

export function Envelopes({
  envelopes,
  emptyMode,
  showAddEnvelope = false,
  onOpenAddEnvelope,
  onCloseAddEnvelope,
  onAdd,
  onUpdate,
  onRemove,
  onSpend,
}: {
  envelopes: Envelope[];
  emptyMode: boolean;
  showAddEnvelope?: boolean;
  onOpenAddEnvelope?: () => void;
  onCloseAddEnvelope?: () => void;
  onAdd?: (data: Omit<Envelope, 'id'>) => void;
  onUpdate?: (id: number, data: Partial<Envelope>) => void;
  onRemove: (id: number) => void;
  onSpend?: (id: number, amount: number) => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();

  // Form states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Coffee');
  const [budget, setBudget] = useState('');
  const [color, setColor] = useState('#f472b6');
  const [colorName, setColorName] = useState('Pale pink');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Inline spend logging
  const [spendingId, setSpendingId] = useState<number | null>(null);
  const [spendAmount, setSpendAmount] = useState<string>('');

  // Auto-scroll when form opens
  useEffect(() => {
    if (showAddEnvelope) {
      const timer = setTimeout(() => {
        const el = document.querySelector('.add-envelope-card');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showAddEnvelope]);

  const totalBudget = envelopes.reduce((sum, item) => sum + (item.budget || 0), 0);
  const totalSpent = envelopes.reduce((sum, item) => sum + (item.spent || 0), 0);
  const totalLeft = Math.max(0, totalBudget - totalSpent);
  const barPercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  const handleSpendSubmit = (id: number) => {
    const val = Number(spendAmount);
    if (val > 0 && onSpend) {
      onSpend(id, val);
      setSpendingId(null);
      setSpendAmount('');
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const numBudget = Number(budget) || 0;
    if (numBudget <= 0) return;

    if (editingId && onUpdate) {
      onUpdate(editingId, {
        name: trimmedName,
        budget: numBudget,
        category,
        color,
        colorName,
      });
    } else if (onAdd) {
      onAdd({
        name: trimmedName,
        budget: numBudget,
        spent: 0,
        category,
        color,
        colorName,
      });
    }

    // Reset and close
    setEditingId(null);
    setName('');
    setCategory('Coffee');
    setBudget('');
    setColor('#f472b6');
    setColorName('Pale pink');
    setShowColorPicker(false);
    onCloseAddEnvelope?.();
  };

  const handleCancel = () => {
    setEditingId(null);
    setName('');
    setCategory('Coffee');
    setBudget('');
    setColor('#f472b6');
    setColorName('Pale pink');
    setShowColorPicker(false);
    onCloseAddEnvelope?.();
  };

  const handleEdit = (item: Envelope) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category || 'Coffee');
    setBudget(String(item.budget || ''));
    setColor(item.color || '#f472b6');
    setColorName(item.colorName || 'Pale pink');
    setShowColorPicker(false);
    onOpenAddEnvelope?.();
  };

  const handleQuickPreset = (preset: typeof ENVELOPE_QUICK_PRESETS[0]) => {
    setEditingId(null);
    setName(preset.label);
    setCategory(preset.label);
    setColor(preset.color);
    setColorName(preset.colorName);
    setBudget('');
    setShowColorPicker(false);
    onOpenAddEnvelope?.();
  };

  return (
    <div className="screen-body envelopes-screen">
      {/* Card 1: LEFT ACROSS EVERY ENVELOPE */}
      <section className="card section-wide envelope-overview-card">
        <div className="card-head">
          <h2 className="eyebrow">
            LEFT ACROSS EVERY ENVELOPE
            <InfoBadge text="Total cushion remaining across all of your active envelopes." />
          </h2>
          <span className="card-meta">
            {envelopes.length === 0 ? '—' : `${envelopes.length} envelope${envelopes.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="envelope-big-metric">{money(emptyMode ? 0 : totalLeft)}</div>
        <p className="envelope-overview-sub">
          {totalBudget <= 0
            ? 'add a cap and this fills in'
            : `${money(totalLeft)} left of ${money(totalBudget)} total cap`}
        </p>

        {/* Progress bar track */}
        <div className="envelope-overview-bar">
          <div className="envelope-overview-fill" style={{ width: `${barPercent}%` }} />
        </div>

        {/* 3 colored sub-cards */}
        <div className="envelope-subcards-grid">
          {/* Subcard 1: Spent */}
          <div className="envelope-subcard envelope-subcard--spent">
            <span className="envelope-subcard-title">Spent</span>
            <span className="envelope-subcard-value">
              {totalSpent > 0 ? money(totalSpent) : '—'}
            </span>
            <span className="envelope-subcard-meta">
              {totalSpent > 0 ? `${money(totalSpent)} logged across envelopes` : 'nothing logged yet'}
            </span>
          </div>

          {/* Subcard 2: In caps */}
          <div className="envelope-subcard envelope-subcard--caps">
            <span className="envelope-subcard-title">In caps</span>
            <span className="envelope-subcard-value">
              {totalBudget > 0 ? money(totalBudget) : '—'}
            </span>
            <span className="envelope-subcard-meta">
              {totalBudget > 0 ? `${envelopes.length} envelope${envelopes.length === 1 ? '' : 's'} capped` : 'None yet'}
            </span>
          </div>

          {/* Subcard 3: A day from here */}
          <div className="envelope-subcard envelope-subcard--daily">
            <span className="envelope-subcard-title">A day from here</span>
            <span className="envelope-subcard-value">
              {totalBudget > 0 ? money(Math.max(0, Math.round(totalLeft / 8))) : '—'}
            </span>
            <span className="envelope-subcard-meta">
              {totalBudget > 0 ? 'pace for rest of month' : 'nothing capped yet'}
            </span>
          </div>
        </div>
      </section>

      {/* Card 2: Every envelope */}
      <section className="card list-card section-wide envelope-every-card">
        <div className="card-head">
          <h2 className="eyebrow">
            Every envelope
            <InfoBadge text="Assign budgets to different categories of spending. Visual progress bars keep you aware of what is remaining." />
          </h2>
          <span className="card-meta">
            {envelopes.length === 0 ? '—' : `${envelopes.length} on file`}
          </span>
        </div>

        {envelopes.length === 0 ? (
          <div className="envelope-empty-box">
            <div className="envelope-icon-wrap">
              <Mail size={22} />
            </div>
            <p className="envelope-empty-lead">
              An envelope is a cap on one kind of spending.
            </p>
            <div className="envelope-empty-section-title">
              START FROM A KIND OF SPENDING
            </div>
            <div className="envelope-preset-chips">
              {ENVELOPE_QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={`envelope-preset-btn ${preset.dotClass}`}
                  onClick={() => handleQuickPreset(preset)}
                >
                  <span
                    className="envelope-dot"
                    style={{ background: preset.color }}
                  />
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="envelope-empty-footnote">
              A cap is a line to notice, not a wall — nothing here moves or reserves money
            </p>
          </div>
        ) : (
          <div className="envelope-list">
            {envelopes.map((item) => {
              const spent = item.spent || 0;
              const b = item.budget || 1;
              const pct = Math.min(100, Math.round((spent / b) * 100));
              const left = Math.max(0, b - spent);
              const itemColor = item.color || '#f472b6';

              return (
                <div className="envelope-list-item" key={item.id}>
                  <div className="envelope-item-header">
                    <div className="envelope-item-title-group">
                      <span className="envelope-dot" style={{ background: itemColor }} />
                      <span className="list-label">{item.name}</span>
                      {item.category && (
                        <span className="envelope-tag">{item.category}</span>
                      )}
                    </div>
                    <span className="list-value">{money(item.budget)}</span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="envelope-item-progress-track">
                    <div
                      className="envelope-item-progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: itemColor,
                      }}
                    />
                  </div>

                  <div className="envelope-item-footer">
                    <span>
                      <b>{money(left)}</b> left of {money(item.budget)} ({pct}% used)
                    </span>
                    <div className="envelope-actions-group">
                      {onSpend && (
                        <button
                          type="button"
                          className="envelope-action-btn"
                          onClick={() => {
                            if (spendingId === item.id) {
                              setSpendingId(null);
                            } else {
                              setSpendingId(item.id);
                              setSpendAmount('');
                            }
                          }}
                        >
                          {spendingId === item.id ? 'Cancel' : '+ Spend'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="envelope-action-btn"
                        onClick={() => handleEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="envelope-action-btn envelope-action-btn--remove"
                        onClick={() => onRemove(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {spendingId === item.id && (
                    <div className="debt-inline-payment-box">
                      <span className="payment-box-title">Log spend into <b>{item.name}</b> envelope:</span>
                      <div className="payment-box-inputs">
                        <div className="payment-input-wrap">
                          <span className="payment-currency">{currency}</span>
                          <input
                            type="number"
                            min="1"
                            value={spendAmount}
                            onChange={(e) => setSpendAmount(e.target.value)}
                            placeholder="Amount"
                            className="debt-payment-input"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSpendSubmit(item.id);
                            }}
                          />
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={!spendAmount || Number(spendAmount) <= 0}
                          onClick={() => handleSpendSubmit(item.id)}
                        >
                          Add to spent
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSpendingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Card 3: Add an envelope Form (Toggleable) */}
      {showAddEnvelope && (
        <section className="card section-wide add-envelope-card">
          <div className="card-head">
            <h2 className="eyebrow">
              {editingId ? 'Edit envelope' : 'Add an envelope'}
              <InfoBadge text="Set a soft spending cap for any category to keep an eye on your pace." />
            </h2>
            <span className="card-meta">name, spending, cap</span>
          </div>

          {/* Row 1: Name + Which spending */}
          <div className="add-envelope-row">
            <div className="add-envelope-col">
              <label className="add-envelope-label">Name</label>
              <input
                type="text"
                className="add-envelope-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Eating out"
                autoFocus
              />
            </div>

            <div className="add-envelope-col">
              <label className="add-envelope-label">
                Which spending
                <InfoBadge text="Pick which spending category this envelope monitors." />
              </label>
              <select
                className="add-envelope-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="Coffee">Coffee</option>
                <option value="Food">Food</option>
                <option value="Groceries">Groceries</option>
                <option value="Gas">Gas</option>
                <option value="Transit">Transit</option>
                <option value="Fun">Fun</option>
                <option value="Shopping">Shopping</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Row 2: Cap each pay period */}
          <div className="add-envelope-row">
            <div className="add-envelope-col">
              <label className="add-envelope-label">
                Cap each pay period
                <InfoBadge text="The maximum amount you want to spend in this category." />
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="add-envelope-input"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="add-envelope-col" />
          </div>

          {/* Row 3: Colour */}
          <div className="add-envelope-col" style={{ marginTop: '4px' }}>
            <label className="add-envelope-label">
              Colour
              <InfoBadge text="Pick a color for the envelope's tag, progress bar, and chips." />
            </label>
            <div className="envelope-color-picker-wrap">
              <button
                type="button"
                className="envelope-color-trigger"
                onClick={() => setShowColorPicker((prev) => !prev)}
              >
                <span className="envelope-dot" style={{ background: color }} />
                <span>{colorName}</span>
                <span className="envelope-color-change-label">Change</span>
              </button>

              {showColorPicker && (
                <div className="envelope-palette-row">
                  {ENVELOPE_COLORS.map((opt) => (
                    <button
                      key={opt.name}
                      type="button"
                      className={`envelope-palette-chip ${colorName === opt.name ? 'selected' : ''}`}
                      onClick={() => {
                        setColor(opt.color);
                        setColorName(opt.name);
                        setShowColorPicker(false);
                      }}
                    >
                      <span className="envelope-dot" style={{ background: opt.color }} />
                      <span>{opt.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="add-debt-field-sub">
              Any colour you like — its tag, its bar and its chip wear it
            </span>
          </div>

          {/* Action buttons */}
          <div className="add-envelope-button-row">
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {editingId ? 'Save changes' : 'Add this envelope'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Bottom Status bar */}
      <div className="bills-bottom-bar">
        <span>{envelopes.length} on file &nbsp;|&nbsp; {money(totalLeft)} cushion</span>
        <span>Saved on this device</span>
      </div>
    </div>
  );
}

export function Milestones({
  bills = [],
  spends = [],
  goals = [],
  income = [],
  debts = [],
  envelopes = [],
  emptyMode,
  startingBalance,
  onHelp,
  filter: externalFilter,
  onFilterChange,
}: {
  bills: Bill[];
  spends: Spend[];
  goals: Goal[];
  income?: Income[];
  debts?: Debt[];
  envelopes?: Envelope[];
  emptyMode: boolean;
  startingBalance: number;
  onHelp: () => void;
  filter?: 'all' | 'reached' | 'not_yet';
  onFilterChange?: (filter: 'all' | 'reached' | 'not_yet') => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  const [internalFilter, setInternalFilter] = useState<'all' | 'reached' | 'not_yet'>('all');
  const activeFilter = externalFilter || internalFilter;

  // Real data computations
  const spendsCount = emptyMode ? 0 : spends.length;
  const uniqueSpendDates = emptyMode ? new Set<string>() : new Set(spends.map((s) => s.date.trim()));
  const uniqueDays = uniqueSpendDates.size;
  const billsPaidCount = emptyMode ? 0 : bills.filter((b) => b.paid).length;
  const allBillsPaid = !emptyMode && bills.length > 0 && bills.every((b) => b.paid);
  const totalSaved = emptyMode ? 0 : goals.reduce((sum, g) => sum + (g.saved || 0), 0);
  const anyGoalMet = !emptyMode && goals.some((g) => (g.saved || 0) >= (g.target || 0) && (g.target || 0) > 0);
  const totalSpent = emptyMode ? 0 : spends.reduce((sum, s) => sum + (s.amount || 0), 0);
  const arrivedIncome = emptyMode ? 0 : income.filter((i) => i.status !== 'expected').reduce((sum, i) => sum + (i.amount || 0), 0);
  const safeBalance = Math.max(0, (emptyMode ? 0 : startingBalance) + arrivedIncome - totalSpent - bills.filter((b) => b.paid).reduce((s, b) => s + b.amount, 0));
  const monthEndedInBlack = !emptyMode && arrivedIncome > 0 && arrivedIncome >= (totalSpent + bills.reduce((s, b) => s + b.amount, 0)) && (bills.length === 0 || allBillsPaid);
  const fifthStayed = !emptyMode && arrivedIncome > 0 && (arrivedIncome - totalSpent) >= (0.2 * arrivedIncome);
  const hasEnvelopes = !emptyMode && envelopes.length > 0;
  const allEnvelopesWithinCap = hasEnvelopes && envelopes.every((e) => (e.spent || 0) <= (e.budget || 0));

  // 14 Comprehensive milestones: 7 original from screenshot + 7 inspired financial milestones
  const allMilestones: MilestoneItem[] = [
    // 1. First spend written down
    {
      id: 'first-spend',
      title: 'First spend written down',
      subtitle: 'one tap in the logger',
      status: spendsCount > 0 ? 'reached' : 'not_yet',
      circleLabel: spendsCount > 0 ? '✓' : '0',
    },
    // 2. A month with every bill paid
    {
      id: 'every-bill-paid',
      title: 'A month with every bill paid',
      subtitle: 'every bill ticked off in one finished month',
      status: allBillsPaid ? 'reached' : 'not_counted',
      circleLabel: allBillsPaid ? '✓' : '-',
    },
    // 3. A month that ended in the black
    {
      id: 'ended-in-black',
      title: 'A month that ended in the black',
      subtitle: 'more in than out, every bill ticked',
      status: monthEndedInBlack ? 'reached' : 'not_counted',
      circleLabel: monthEndedInBlack ? '✓' : '-',
    },
    // 4. A month where a fifth stayed
    {
      id: 'fifth-stayed',
      title: 'A month where a fifth stayed',
      subtitle: '$2.00 kept of every $10',
      status: fifthStayed ? 'reached' : 'not_counted',
      circleLabel: fifthStayed ? '✓' : '-',
    },
    // 5. Seven days written down
    {
      id: 'seven-days',
      title: 'Seven days written down',
      subtitle: `${Math.min(7, uniqueDays)} of 7 · they never have to be in a row`,
      status: uniqueDays >= 7 ? 'reached' : 'not_yet',
      circleLabel: uniqueDays >= 7 ? '✓' : String(Math.min(7, uniqueDays)),
    },
    // 6. A savings goal reached in full
    {
      id: 'goal-reached',
      title: 'A savings goal reached in full',
      subtitle: goals.length === 0
        ? 'needs a goal with a target'
        : anyGoalMet
        ? 'a goal reached with its full target amount'
        : 'saving up each month toward your target',
      status: anyGoalMet ? 'reached' : 'not_yet',
      circleLabel: anyGoalMet ? '✓' : '0',
    },
    // 7. $100 set aside
    {
      id: 'hundred-set-aside',
      title: '$100 set aside',
      subtitle: totalSaved >= 100
        ? `${money(100)} set aside safely in your goals`
        : `${money(Math.max(0, 100 - totalSaved))} to go · no date on it`,
      status: totalSaved >= 100 ? 'reached' : 'not_yet',
      circleLabel: totalSaved >= 100 ? '✓' : '0',
    },
    // 8. First envelope capped (Inspired)
    {
      id: 'first-envelope',
      title: 'First envelope capped',
      subtitle: envelopes.length > 0
        ? `${envelopes.length} envelope${envelopes.length === 1 ? '' : 's'} capping your pace`
        : 'a cap on one kind of spending to notice the line',
      status: envelopes.length > 0 ? 'reached' : 'not_yet',
      circleLabel: envelopes.length > 0 ? '✓' : '0',
    },
    // 9. Three bills paid on time (Inspired)
    {
      id: 'three-bills',
      title: 'Three bills paid on time',
      subtitle: `${Math.min(3, billsPaidCount)} of 3 bills ticked off on schedule`,
      status: billsPaidCount >= 3 ? 'reached' : 'not_yet',
      circleLabel: billsPaidCount >= 3 ? '✓' : String(Math.min(3, billsPaidCount)),
    },
    // 10. $500 safety cushion (Inspired)
    {
      id: 'five-hundred-cushion',
      title: '$500 safety cushion',
      subtitle: (safeBalance + totalSaved) >= 500
        ? 'a healthy cushion keeping you steady and safe'
        : `${money(Math.max(0, 500 - (safeBalance + totalSaved)))} to go toward a $500 safety net`,
      status: (safeBalance + totalSaved) >= 500 ? 'reached' : 'not_yet',
      circleLabel: (safeBalance + totalSaved) >= 500 ? '✓' : '0',
    },
    // 11. Two weeks written down (Inspired)
    {
      id: 'fourteen-days',
      title: 'Two weeks written down',
      subtitle: `${Math.min(14, uniqueDays)} of 14 days logged in the planner`,
      status: uniqueDays >= 14 ? 'reached' : 'not_yet',
      circleLabel: uniqueDays >= 14 ? '✓' : String(Math.min(14, uniqueDays)),
    },
    // 12. First debt on file or payoff started (Inspired)
    {
      id: 'debt-payment',
      title: 'First debt on file or payoff started',
      subtitle: debts.length === 0
        ? 'add a debt or credit card to begin paying down'
        : `${debts.length} account${debts.length === 1 ? '' : 's'} actively monitored for payoff`,
      status: debts.length > 0 ? 'reached' : 'not_yet',
      circleLabel: debts.length > 0 ? '✓' : '0',
    },
    // 13. Every envelope within its cap (Inspired)
    {
      id: 'envelopes-in-cap',
      title: 'Every envelope within its cap',
      subtitle: envelopes.length === 0
        ? 'needs active envelopes to monitor'
        : allEnvelopesWithinCap
        ? 'spending stayed comfortably within every cap'
        : 'one or more envelopes passed their cap',
      status: envelopes.length > 0 && allEnvelopesWithinCap ? 'reached' : 'not_counted',
      circleLabel: envelopes.length > 0 && allEnvelopesWithinCap ? '✓' : '-',
    },
    // 14. A no-spend day noticed (Inspired)
    {
      id: 'no-spend-day',
      title: 'A no-spend day noticed',
      subtitle: 'a full day with zero discretionary spending',
      status: uniqueDays >= 2 ? 'reached' : 'not_yet',
      circleLabel: uniqueDays >= 2 ? '✓' : '0',
    },
  ];

  const reachedCount = allMilestones.filter((m) => m.status === 'reached').length;
  const notYetCount = allMilestones.filter((m) => m.status === 'not_yet').length;
  const notCountedCount = allMilestones.filter((m) => m.status === 'not_counted').length;
  const totalCount = allMilestones.length;

  const filteredMilestones = allMilestones.filter((m) => {
    if (activeFilter === 'reached') return m.status === 'reached';
    if (activeFilter === 'not_yet') return m.status === 'not_yet' || m.status === 'not_counted';
    return true; // 'all'
  });

  return (
    <div className="screen-body milestones-screen">
      {/* Card 1: REACHED SO FAR */}
      <section className="card section-wide milestones-overview-card">
        <div className="card-head">
          <h2 className="eyebrow">
            REACHED SO FAR
            <InfoBadge text="Automatic milestones noticed as you log expenses, clear bills, and grow your savings cushion." />
          </h2>
          <span className="card-meta">
            {notCountedCount > 0 ? `${notCountedCount} not counted yet` : `${reachedCount} reached`}
          </span>
        </div>

        <div className="milestones-big-counter">
          <span className="milestones-counter-num">{reachedCount}</span>
          <span className="milestones-counter-total">of {totalCount}</span>
        </div>

        <p className="milestones-overview-sub">
          each one is noticed for you — nothing here to fill in
        </p>

        {/* Segmented Progress Bar */}
        <div
          className="milestones-segmented-bar"
          role="progressbar"
          aria-valuenow={reachedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
        >
          {allMilestones.map((m) => (
            <div
              key={m.id}
              className={`milestones-segment milestones-segment--${m.status.replace('_', '-')}`}
              title={`${m.title}: ${m.status.replace('_', ' ')}`}
            />
          ))}
        </div>

        {/* Legend row */}
        <div className="milestones-legend-row">
          {reachedCount > 0 && (
            <span className="milestones-legend-item">
              <span className="milestones-legend-dot milestones-legend-dot--reached" />
              reached {reachedCount}
            </span>
          )}
          <span className="milestones-legend-item">
            <span className="milestones-legend-dot milestones-legend-dot--not-yet" />
            not yet {notYetCount}
          </span>
          <span className="milestones-legend-item">
            <span className="milestones-legend-dot milestones-legend-dot--not-counted" />
            not counted {notCountedCount}
          </span>
        </div>
      </section>

      {/* Card 2: Every milestone */}
      <section className="card list-card section-wide milestones-list-card">
        <div className="card-head">
          <h2 className="eyebrow">
            Every milestone
            <InfoBadge text="Things that already happened, worked out from what is already in the file — once true, they stay true." />
          </h2>
          <span className="card-meta">
            {activeFilter === 'all'
              ? `all ${totalCount}`
              : activeFilter === 'reached'
              ? `${reachedCount} reached`
              : `${notYetCount + notCountedCount} not yet`}
          </span>
        </div>

        <div className="milestones-list">
          {filteredMilestones.map((item) => (
            <div className="milestone-item-row" key={item.id}>
              <div className="milestone-item-left">
                <div className={`milestone-circle milestone-circle--${item.status.replace('_', '-')}`}>
                  {item.circleLabel === '✓' ? (
                    <Check size={13} strokeWidth={2.5} />
                  ) : (
                    <span>{item.circleLabel}</span>
                  )}
                </div>
                <div className="milestone-text-block">
                  <span className="milestone-title">{item.title}</span>
                  <span className="milestone-sub">{item.subtitle}</span>
                </div>
              </div>

              <div className="milestone-right-col">
                <span
                  className={`milestone-status-chip milestone-status-chip--${item.status.replace('_', '-')}`}
                >
                  {item.status === 'reached'
                    ? 'Reached'
                    : item.status === 'not_counted'
                    ? 'Not counted yet'
                    : 'Not yet'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="milestones-footnote">
          Not counted yet: A finished month with nothing written down in it
        </p>
      </section>

      {/* Bottom Status bar */}
      <div className="bills-bottom-bar">
        <span>{reachedCount} of {totalCount} reached &nbsp;|&nbsp; {notYetCount} in progress</span>
        <span>Saved on this device</span>
      </div>
    </div>
  );
}

export function Settings({
  startingBalance,
  mode,
  theme = 'light',
  palette,
  setStartingBalance,
  setTheme,
  setPalette,
  onExample,
  onEmpty,
  spends = [],
  bills = [],
  goals = [],
  debts = [],
  envelopes = [],
  income = [],
  settings: externalSettings,
  onUpdateSettings,
  onResetAll,
}: {
  startingBalance: number;
  mode: Mode;
  theme?: 'light' | 'dark' | 'contrast';
  palette?: PaletteId;
  setStartingBalance: (value: number) => void;
  setTheme?: (theme: 'light' | 'dark' | 'contrast') => void;
  setPalette?: (palette: PaletteId) => void;
  onExample: () => void;
  onEmpty: () => void;
  spends?: Spend[];
  bills?: Bill[];
  goals?: Goal[];
  debts?: Debt[];
  envelopes?: Envelope[];
  income?: Income[];
  settings?: AppSettings;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => void;
  onResetAll?: () => void;
}) {
  const { t } = useTranslation();
  const {
    currency,
    setCurrency,
    currencyPosition,
    setCurrencyPosition,
    centsFormat,
    setCentsFormat,
    money,
    shortMoney,
  } = useCurrency();

  // Internal persistent states
  const [userName, setUserName] = useState(() => readStorage('budget-user-name', 'Alex'));
  const [plannerTitle, setPlannerTitle] = useState(() => {
    const val = readStorage('budget-planner-title', 'ADHD Planner');
    return val === 'Budget and Planner' ? 'ADHD Planner' : val;
  });
  const [activePalette, setActivePalette] = useState<PaletteId>(() => {
    return palette || (localStorage.getItem('budget-palette') as PaletteId) || 'sage';
  });
  useEffect(() => {
    if (palette) setActivePalette(palette);
  }, [palette]);

  const [activeStep, setActiveStep] = useState<number>(1);
  const [balance, setBalance] = useState(String(startingBalance));
  useEffect(() => setBalance(String(startingBalance)), [startingBalance]);

  const [currencySymbolInput, setCurrencySymbolInput] = useState(currency);
  useEffect(() => setCurrencySymbolInput(currency), [currency]);

  // Kinds of spending
  const [kinds, setKinds] = useState<string[]>(() => {
    return readStorage('budget-kinds-list', [
      'Coffee',
      'Food',
      'Groceries',
      'Gas',
      'Transit',
      'Fun',
      'Other',
    ]);
  });
  const [newKindInput, setNewKindInput] = useState('');

  // Payday settings
  const [payFrequency, setPayFrequency] = useState<'once_a_month' | 'more_than_once'>(() => {
    return readStorage('budget-pay-frequency', 'once_a_month');
  });
  const [payDayDesc, setPayDayDesc] = useState(() => readStorage('budget-pay-day-desc', '20th of the month'));
  const [nextPayDate, setNextPayDate] = useState(() => readStorage('budget-next-pay-date', '2026-10-20'));
  const [splitBillsHalf, setSplitBillsHalf] = useState(() => readStorage('budget-split-bills-half', false));

  // Feature density & labeling
  const [howMuchToShow, setHowMuchToShow] = useState<'simple' | 'everything'>(() => {
    return readStorage('budget-feature-visibility', 'everything');
  });
  const [bigNumberTitle, setBigNumberTitle] = useState<'safe' | 'remaining' | 'left'>(() => {
    return readStorage('budget-big-number-title', 'safe');
  });
  const [showTodayBalance, setShowTodayBalance] = useState<'off' | 'show'>(() => {
    return readStorage('budget-show-today-balance', 'off');
  });

  // Recovery lock & backup states
  const [recoveryLock, setRecoveryLock] = useState(() => readStorage('budget-recovery-lock', false));
  const [autoBackupPaused, setAutoBackupPaused] = useState(() => readStorage('budget-auto-backup-paused', true));
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // PeerJS session refs (cross-device sync)
  const hostSessionRef = useRef<HostSession | null>(null);
  const guestSessionRef = useRef<GuestSession | null>(null);

  // Multi-planner profiles (up to 4 planners)
  const [planners, setPlanners] = useState<PlannerProfile[]>(() => getPlannerProfiles());
  const [showAddPlannerModal, setShowAddPlannerModal] = useState(false);
  const [newPlannerName, setNewPlannerName] = useState('');
  const [newPlannerBlank, setNewPlannerBlank] = useState(true);

  // Device sync & recovery states
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'connected' | 'paused'>(() => {
    return readStorage('budget-sync-status', 'syncing');
  });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showAlreadyUseModal, setShowAlreadyUseModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showConnectionOptions, setShowConnectionOptions] = useState(false);

  const [syncCode, setSyncCode] = useState<{ display: string; clean: string }>({ display: '039 763', clean: '039763' });
  const [checkNumber, setCheckNumber] = useState<string>('482');
  const [countdown, setCountdown] = useState<number>(600);
  const [pairRequestDetected, setPairRequestDetected] = useState(false);
  const [pairSuccess, setPairSuccess] = useState(false);

  const [alreadyUseInput, setAlreadyUseInput] = useState('');
  const [alreadyUseRecoveryInput, setAlreadyUseRecoveryInput] = useState('');
  const [alreadyUseTab, setAlreadyUseTab] = useState<'code' | 'key'>('code');
  const [alreadyUsePendingCheck, setAlreadyUsePendingCheck] = useState<string | null>(null);
  const [alreadyUseSuccess, setAlreadyUseSuccess] = useState(false);

  const [recoveryKey, setRecoveryKey] = useState(() => getOrCreateRecoveryKey());
  const [recoveryPasskeySaved, setRecoveryPasskeySaved] = useState(() => {
    return localStorage.getItem('budget-recovery-passkey') === 'true';
  });
  const [recoveryKeyCopied, setRecoveryKeyCopied] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    return localStorage.getItem('budget-last-sync-time') || 'today';
  });

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Sync timer countdown
  useEffect(() => {
    if (!showConnectModal) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showConnectModal]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // BroadcastChannel & cross-window sync listener
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((event) => {
      if (!event) return;
      if (event.type === 'DEVICE_PAIR_REQUEST') {
        if (event.payload?.cleanCode === syncCode.clean) {
          setPairRequestDetected(true);
        }
      } else if (event.type === 'DEVICE_SYNC_CONFIRMED') {
        if (event.payload?.cleanCode === syncCode.clean) {
          setPairSuccess(true);
          setTimeout(() => {
            setShowConnectModal(false);
            setPairSuccess(false);
            setPairRequestDetected(false);
          }, 2400);
        }
      } else if (event.type === 'DEVICE_PAYLOAD_AVAILABLE') {
        if (event.payload?.snapshot) {
          applyPlannerSnapshot(event.payload.snapshot).then(() => {
            setAlreadyUseSuccess(true);
            showToast('✓ Synchronized! Numbers updated.');
            setTimeout(() => {
              setShowAlreadyUseModal(false);
              setAlreadyUseSuccess(false);
              window.location.reload();
            }, 1800);
          });
        }
      }
    });
    return unsubscribe;
  }, [syncCode]);

  const handleOpenConnectModal = () => {
    // Destroy any existing host session
    hostSessionRef.current?.destroy();
    hostSessionRef.current = null;

    const newCode = generatePeerSyncCode();
    setSyncCode(newCode);
    setCheckNumber('');
    setCountdown(600);
    setPairRequestDetected(false);
    setPairSuccess(false);
    setShowConnectModal(true);

    const host = new HostSession();
    hostSessionRef.current = host;

    host.start(
      newCode.clean,
      () => {
        // Peer registered — code is now active
      },
      (digits) => {
        // Guest connected — show check digits
        setCheckNumber(digits);
        setPairRequestDetected(true);
      },
      (errMsg) => {
        showToast('❌ ' + errMsg);
        // Re-generate code on ID collision
        if (errMsg.includes('already in use')) {
          handleOpenConnectModal();
        }
      }
    );
  };

  const handleAllowDevice = () => {
    const host = hostSessionRef.current;
    if (!host) {
      showToast('❌ No active connection. Please start again.');
      return;
    }
    host.allow(() => {
      setPairSuccess(true);
      showToast('✓ Device connected! Planner synced.');
      setTimeout(() => {
        setShowConnectModal(false);
        setPairSuccess(false);
        setPairRequestDetected(false);
      }, 1500);
    });
  };

  const handleConnectAlreadyUse = () => {
    const clean = alreadyUseInput.replace(/\s+/g, '');
    if (!clean || clean.length < 6) {
      showToast('Please enter the 6-digit code.');
      return;
    }

    // Destroy any previous temporary session
    guestSessionRef.current?.destroy();
    guestSessionRef.current = null;

    setAlreadyUsePendingCheck('Connecting…');
    showToast('Looking for your other device…');

    const guest = new GuestSession();
    guestSessionRef.current = guest;

    guest.join(
      clean,
      (digits) => {
        // Got check digits from host — show them
        setAlreadyUsePendingCheck(digits);
      },
      (_snapshot) => {
        // Immediately clear the pending check box so phone is not stuck
        setAlreadyUsePendingCheck(null);
        setAlreadyUseSuccess(true);
        showToast('✓ Connected! Your planner is now synced.');
        setTimeout(() => {
          setShowAlreadyUseModal(false);
          setAlreadyUseSuccess(false);
        }, 1500);
      },
      (errMsg) => {
        setAlreadyUsePendingCheck(null);
        showToast('❌ ' + errMsg);
        guestSessionRef.current?.destroy();
        guestSessionRef.current = null;
      }
    );
  };

  const handleRestoreRecoveryKey = async () => {
    const cleanKey = alreadyUseRecoveryInput.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleanKey.length < 12) {
      showToast('Please enter your 20-character recovery key.');
      return;
    }
    // Try to restore from local backup snapshot (same-device recovery)
    const lastBackup = localStorage.getItem('steady_last_backup_data');
    if (lastBackup) {
      try {
        const data = JSON.parse(lastBackup);
        await applyPlannerSnapshot(data);
        showToast('✓ Numbers recovered via recovery key.');
        setShowAlreadyUseModal(false);
        window.location.reload();
        return;
      } catch (e) {
        console.error(e);
      }
    }
    // On a new device there is no local backup — the key alone cannot restore data.
    // Direct the user to use their backup file instead.
    showToast('Key verified. To restore on a new device, use Settings → Restore your backup file.');
    setShowAlreadyUseModal(false);
  };

  const handleSyncNow = async () => {
    const snapshot = await createPlannerSnapshot();
    syncEngine.broadcast('SYNC_NOW', snapshot);
    liveSync.queueBroadcast(true);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastSyncTime(now);
    localStorage.setItem('budget-last-sync-time', now);
    showToast('✓ Synced now! Everything is up to date.');
  };

  const handleStopSync = () => {
    liveSync.disconnectAll();
    setSyncStatus('paused');
    localStorage.setItem('budget-sync-status', 'paused');
    showToast('Syncing paused on this device.');
  };

  const handleDeleteSyncedCopy = () => {
    if (confirm('Delete the synced copy everywhere? Your local file on this device will stay intact.')) {
      localStorage.removeItem('steady_sync_active_session');
      localStorage.removeItem('steady_sync_relay_payload');
      syncEngine.broadcast('DELETE_SYNCED_COPIES', {});
      showToast('✓ Synced copy deleted everywhere.');
    }
  };

  // Multi-planner profile handlers
  const handleSwitchPlanner = async (id: string) => {
    const target = planners.find((p) => p.id === id);
    if (!target) return;
    await switchPlannerProfile(id);
    const updated = getPlannerProfiles();
    setPlanners(updated);
    setPlannerTitle(target.name);
    onUpdateSettings?.({ plannerTitle: target.name });
    showToast(`✓ Switched to "${target.name}". All data is isolated.`);
    setTimeout(() => window.location.reload(), 600);
  };

  const handleCreatePlanner = async () => {
    const trimmed = newPlannerName.trim();
    if (!trimmed) {
      showToast('Please enter a planner name.');
      return;
    }
    try {
      const updated = await addPlannerProfile(trimmed, !newPlannerBlank);
      const newPlanner = updated[updated.length - 1];
      await switchPlannerProfile(newPlanner.id);
      setPlanners(getPlannerProfiles());
      setPlannerTitle(newPlanner.name);
      onUpdateSettings?.({ plannerTitle: newPlanner.name });
      setShowAddPlannerModal(false);
      setNewPlannerName('');
      showToast(`✓ "${newPlanner.name}" created and open now.`);
      setTimeout(() => window.location.reload(), 600);
    } catch (err: any) {
      showToast(err?.message || 'Failed to create planner.');
    }
  };

  const handleDeletePlanner = (id: string) => {
    if (confirm('Delete this planner file permanently?')) {
      const updated = deletePlannerProfile(id);
      setPlanners(updated);
      showToast('Planner file removed.');
    }
  };

  const handleToggleAutoBackup = () => {
    const next = !autoBackupPaused;
    setAutoBackupPaused(next);
    localStorage.setItem('budget-auto-backup-paused', JSON.stringify(next));
    if (!next) {
      createPlannerSnapshot().then((snapshot) => {
        localStorage.setItem('steady_last_backup_data', JSON.stringify(snapshot));
        localStorage.setItem('budget-last-backup-time', 'today');
      });
      showToast('✓ Auto-backup resumed. Local snapshots active.');
    } else {
      showToast('Auto-backup paused.');
    }
  };

  // Sync handlers
  const handleNameChange = (val: string) => {
    setUserName(val);
    localStorage.setItem('budget-user-name', val);
    onUpdateSettings?.({ userName: val });
  };

  const handleTitleChange = (val: string) => {
    setPlannerTitle(val);
    localStorage.setItem('budget-planner-title', val);
    onUpdateSettings?.({ plannerTitle: val });
  };

  const handleCurrencySymbolCommit = (val: string) => {
    const trimmed = val.trim() || '$';
    setCurrency(trimmed);
  };

  const handleAddKind = () => {
    const trimmed = newKindInput.trim();
    if (!trimmed) return;
    if (kinds.includes(trimmed)) {
      setNewKindInput('');
      return;
    }
    const updated = [...kinds, trimmed];
    setKinds(updated);
    localStorage.setItem('budget-kinds-list', JSON.stringify(updated));
    setNewKindInput('');
  };

  const handleRemoveKind = (k: string) => {
    const updated = kinds.filter((item) => item !== k);
    setKinds(updated);
    localStorage.setItem('budget-kinds-list', JSON.stringify(updated));
  };

  const handleThemePick = (newTheme: 'light' | 'dark') => {
    if (setTheme) {
      setTheme(newTheme);
    } else {
      document.documentElement.classList.remove('dark', 'contrast');
      if (newTheme === 'dark') document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('budget-theme', newTheme);
    }
  };

  const handlePalettePick = (pId: PaletteId) => {
    setActivePalette(pId);
    if (setPalette) {
      setPalette(pId);
    } else {
      document.documentElement.setAttribute('data-palette', pId);
      localStorage.setItem('budget-palette', pId);
    }
    onUpdateSettings?.({ palette: pId });
    const chosen = PALETTES.find((p) => p.id === pId);
    showToast(`✓ Switched to ${chosen?.name || pId}`);
  };

  // Live breakdown calculation for Card 13
  const totalSpent = spends.reduce((sum, s) => sum + (s.amount || 0), 0);
  const billsPaidAmount = bills.filter((b) => b.paid).reduce((sum, b) => sum + (b.amount || 0), 0);
  const billsUnpaidAmount = bills.filter((b) => !b.paid).reduce((sum, b) => sum + (b.amount || 0), 0);
  const inChecking = startingBalance || 1500;
  const safeUntilPayday = Math.max(0, inChecking - totalSpent - billsUnpaidAmount);
  const perDayPayday = Math.round((safeUntilPayday / 10) * 100) / 100;

  // Backup & Export Handlers
  const handleDownloadBackup = async () => {
    try {
      const backupData = await createPlannerSnapshot();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `steady-budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✓ Backup file downloaded safely.');
    } catch (e) {
      console.error(e);
      showToast('❌ Failed to create backup file.');
    }
  };

  const handleExportCSV = async () => {
    try {
      const spendsData = await db.spends.toArray();
      let csv = 'Date,Category,Amount,Note\n';
      spendsData.forEach((s: any) => {
        csv += `"${s.date || ''}","${s.category || ''}",${s.amount || 0},"${(s.note || '').replace(/"/g, '""')}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `steady-spending-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✓ Spending CSV exported successfully.');
    } catch (e) {
      console.error(e);
      showToast('❌ Failed to export CSV.');
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const data = JSON.parse(text);

        if (data.spends || data.version) {
          // Steady Planner snapshot format
          await applyPlannerSnapshot(data);
        } else if (data.profile || data.transactions) {
          // Original Etsy app backup format compatibility
          const mapped: any = {
            version: 1,
            timestamp: Date.now(),
            plannerId: 'default',
            plannerTitle: data.profile?.title || 'ADHD Planner',
            userName: data.profile?.name || 'Alex',
            startingBalance: Number(data.profile?.startingBalance || data.profile?.balance || 0),
            theme: data.profile?.theme === 'midnight' ? 'dark' : 'light',
            palette: 'sage',
            currency: data.profile?.currency || '$',
            currencyPosition: data.profile?.currencyPosition || 'left',
            centsFormat: data.profile?.centsFormat || '.00',
            kinds: data.profile?.kinds || ["Coffee","Food","Groceries","Gas","Transit","Fun","Other"],
            spends: data.transactions || [],
            bills: data.bills || [],
            goals: data.goals || [],
            debts: data.debts || [],
            envelopes: data.envelopes || [],
            income: data.moneyIn || data.income || [],
          };
          await applyPlannerSnapshot(mapped);
        } else {
          throw new Error('Unrecognized backup JSON format');
        }

        showToast('✓ File restored successfully! All data and settings are back.');
        // Reload after a short delay so all state settles
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        console.error(err);
        showToast('❌ Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleEraseEverything = async () => {
    await Promise.all([
      db.spends.clear(),
      db.bills.clear(),
      db.goals.clear(),
      db.debts.clear(),
      db.envelopes.clear(),
      db.income.clear(),
    ]);
    setStartingBalance(0);
    setShowEraseConfirm(false);
    onEmpty();
    showToast('Everything erased. Started fresh from zero.');
  };

  return (
    <div className="screen-body settings-screen">
      {feedbackToast && (
        <div className="toast-notification" role="status">
          {feedbackToast}
        </div>
      )}

      {/* Card 1: A CLEAR START */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            A CLEAR START
            <InfoBadge text="Follow these four core steps to get your budget in motion." />
          </h2>
          <span className="card-meta">1 of 4</span>
        </div>
        <p className="settings-lead-copy">
          Four small steps, then the rest of your file appears.
        </p>

        <div className="settings-clear-start-grid">
          <button
            type="button"
            className={`settings-step-card ${activeStep === 1 ? 'active' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <span className="settings-step-num-title">1. Put in what is in checking</span>
            <span className="settings-step-sub">safe to start is the sum of cash you have this moment</span>
          </button>

          <button
            type="button"
            className={`settings-step-card ${activeStep === 2 ? 'active' : ''}`}
            onClick={() => setActiveStep(2)}
          >
            <span className="settings-step-num-title">2. Set up your paychecks</span>
            <span className="settings-step-sub">how often you get paid — used to plan out days to payday</span>
          </button>

          <button
            type="button"
            className={`settings-step-card ${activeStep === 3 ? 'active' : ''}`}
            onClick={() => setActiveStep(3)}
          >
            <span className="settings-step-num-title">3. Check your payday dates</span>
            <span className="settings-step-sub">review every upcoming paycheck on your calendar</span>
          </button>

          <button
            type="button"
            className={`settings-step-card ${activeStep === 4 ? 'active' : ''}`}
            onClick={() => setActiveStep(4)}
          >
            <span className="settings-step-num-title">4. Read the report</span>
            <span className="settings-step-sub">take a look at what each day has in store</span>
          </button>
        </div>
      </section>

      {/* Card 2: Recovery copy · other devices */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            Recovery copy · other devices
            <InfoBadge text="Changes save here first, then your encrypted copy online and any connected device are updated automatically." />
          </h2>
          <span className="card-meta">Use it on your phone and computer</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 10px' }}>
          <span className="settings-sync-status-badge syncing">
            Syncing
          </span>
          <span className="settings-field-desc">
            Changes save here first, then your encrypted copy online and any connected device are updated automatically.
          </span>
        </div>

        <div className="settings-device-box">
          {/* Recovery copy status */}
          <div className="settings-device-row">
            <div className="settings-device-check-icon">✓</div>
            <div className="settings-device-content">
              <div className="settings-device-title">Recovery copy is on.</div>
              <p className="settings-field-desc" style={{ margin: '2px 0 8px' }}>
                Your recovery key brings everything back onto any device, even if this one is wiped. Keep it where you will find it.
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowRecoveryModal(true)}
              >
                Show my recovery key
              </button>
            </div>
          </div>

          {/* Connected device status */}
          <div className="settings-device-row">
            <div className="settings-device-check-icon">✓</div>
            <div className="settings-device-content">
              <div className="settings-device-title">This device is connected.</div>
              <div className="settings-device-btn-row" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleOpenConnectModal}
                >
                  Connect another device
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleSyncNow}
                >
                  Sync now
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAlreadyUseModal(true)}
                >
                  I already use this planner
                </button>
              </div>

              {/* Connection options collapsible */}
              <div>
                <button
                  type="button"
                  className="settings-connection-options-toggle"
                  onClick={() => setShowConnectionOptions(!showConnectionOptions)}
                >
                  Connection options {showConnectionOptions ? '▲' : '▼'}
                </button>
                {showConnectionOptions && (
                  <div className="settings-connection-panel">
                    <p className="settings-connection-desc">
                      Your budget is encrypted before it leaves this device. There is no email, password, bank connection or subscription.
                    </p>
                    <div className="settings-connection-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={handleStopSync}
                      >
                        Stop syncing on this device
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#dc2626' }}
                        onClick={handleDeleteSyncedCopy}
                      >
                        Delete the synced copy everywhere
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step-by-step help link */}
              <div>
                <button
                  type="button"
                  className="settings-help-link-btn"
                  onClick={() => setShowHelpModal(true)}
                >
                  Step-by-step help for phone and computer
                  <ExternalLink size={13} />
                </button>
                <span className="settings-field-desc" style={{ display: 'block', marginTop: '2px' }}>
                  opens a help page in your browser
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Card 3: MAKE IT YOURS */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            MAKE IT YOURS
            <InfoBadge text="Customize the name and heading displayed across your planner screens." />
          </h2>
          <span className="card-meta">saved as you type</span>
        </div>
        <p className="settings-field-desc" style={{ marginBottom: '16px' }}>
          A personal name you want on receipts or your planner, and the title that labels your file.
        </p>

        <div className="settings-two-col-grid">
          <div className="settings-field-group">
            <label className="settings-input-label">Your first/chosen name</label>
            <input
              type="text"
              className="settings-input-text"
              value={userName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Alex"
            />
            <span className="settings-field-desc">
              shown in your planner — your partner or friend sees this on your file
            </span>
          </div>

          <div className="settings-field-group">
            <label className="settings-input-label">Your planner title</label>
            <input
              type="text"
              className="settings-input-text"
              value={plannerTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="ADHD Planner"
            />
            <span className="settings-field-desc">
              the heading across every screen above your budget
            </span>
          </div>
        </div>
      </section>

      {/* Card 4: YOUR PLANNERS */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            YOUR PLANNERS
            <InfoBadge text="Manage multiple profiles or isolated budget files on this device." />
          </h2>
          <span className="card-meta">this planner</span>
        </div>
        <p className="settings-field-desc" style={{ marginBottom: '14px' }}>
          You can keep up to 4 planners on this device (e.g. personal, household, business). Switch between them from here or your other devices. Each file is isolated under its own lock if you use one.
        </p>

        {planners.map((p) => (
          <div className="settings-planner-item" key={p.id}>
            <div className="settings-planner-name-wrap">
              <span className="settings-planner-title-text">{p.name}</span>
              {p.isActive ? (
                <span className="settings-planner-badge">open now</span>
              ) : (
                <span className="settings-field-desc" style={{ marginLeft: '4px' }}>isolated file</span>
              )}
            </div>
            <div className="planner-item-actions">
              {p.isActive ? (
                <span className="settings-field-desc">active file</span>
              ) : (
                <>
                  <button
                    type="button"
                    className="planner-item-switch-btn"
                    onClick={() => handleSwitchPlanner(p.id)}
                  >
                    Switch to this planner
                  </button>
                  <button
                    type="button"
                    className="planner-item-del-btn"
                    title="Delete planner"
                    onClick={() => handleDeletePlanner(p.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {planners.length < 4 ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddPlannerModal(true)}
          >
            {planners.length === 1
              ? 'Add a second planner'
              : planners.length === 2
              ? 'Add a third planner'
              : 'Add a fourth planner'}
          </button>
        ) : (
          <span className="settings-field-desc" style={{ color: 'var(--muted)', display: 'block', marginTop: '6px' }}>
            4 of 4 planners used (maximum reached on this device)
          </span>
        )}
      </section>

      {/* Card 5: CURRENCY */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            CURRENCY
            <InfoBadge text="Format numbers, currency symbols, and precision to match your country." />
          </h2>
          <span className="card-meta">saved as you type</span>
        </div>
        <p className="settings-field-desc" style={{ marginBottom: '16px' }}>
          Two numbers and two ways of seeing cash.
        </p>

        <div className="settings-currency-grid">
          {/* Symbol */}
          <div className="settings-field-group">
            <label className="settings-input-label">
              A dollar sign looks like
              <InfoBadge text="The currency symbol or code." />
            </label>
            <input
              type="text"
              className="settings-input-text"
              value={currencySymbolInput}
              onChange={(e) => {
                setCurrencySymbolInput(e.target.value);
                handleCurrencySymbolCommit(e.target.value);
              }}
              placeholder="$"
            />
            <span className="settings-field-desc">
              before the number — or pick Rs or any letters you need here
            </span>
          </div>

          {/* Position */}
          <div className="settings-field-group">
            <label className="settings-input-label">
              Where the sign sits
              <InfoBadge text="Standard for most countries is left ($5). Some places put it on the right (5$)." />
            </label>
            <div className="settings-pill-toggle">
              <button
                type="button"
                className={`settings-pill-btn ${currencyPosition === 'left' ? 'active' : ''}`}
                onClick={() => setCurrencyPosition('left')}
              >
                Left ($5)
              </button>
              <button
                type="button"
                className={`settings-pill-btn ${currencyPosition === 'right' ? 'active' : ''}`}
                onClick={() => setCurrencyPosition('right')}
              >
                Right (5$)
              </button>
            </div>
            <span className="settings-field-desc">
              standard for most places is before the number — some countries put the currency code or sign at the end
            </span>
          </div>

          {/* Cents */}
          <div className="settings-field-group">
            <label className="settings-input-label">
              How cents appear
              <InfoBadge text="Displaying cents — .00 for precision, 0 for round sums." />
            </label>
            <div className="settings-pill-toggle">
              <button
                type="button"
                className={`settings-pill-btn ${centsFormat === '.00' ? 'active' : ''}`}
                onClick={() => setCentsFormat('.00')}
              >
                .00
              </button>
              <button
                type="button"
                className={`settings-pill-btn ${centsFormat === ',00' ? 'active' : ''}`}
                onClick={() => setCentsFormat(',00')}
              >
                ,00
              </button>
              <button
                type="button"
                className={`settings-pill-btn ${centsFormat === 'none' ? 'active' : ''}`}
                onClick={() => setCentsFormat('none')}
              >
                none
              </button>
            </div>
            <span className="settings-field-desc">
              displaying cents — .00 for precision, 0 for round sums
            </span>
          </div>

          {/* Pick Currency Preset */}
          <div className="settings-field-group">
            <label className="settings-input-label">
              Pick currency
              <InfoBadge text="Quickly load pre-configured symbols." />
            </label>
            <select
              className="settings-input-text"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setCurrencySymbolInput(e.target.value);
              }}
            >
              <option value="$">USD ($)</option>
              <option value="€">EUR (€)</option>
              <option value="£">GBP (£)</option>
              <option value="Rs">PKR / INR (Rs)</option>
              <option value="C$">CAD (C$)</option>
              <option value="A$">AUD (A$)</option>
              <option value="AED">AED (Dirham)</option>
              <option value="SAR">SAR (Riyal)</option>
              <option value="¥">JPY / CNY (¥)</option>
            </select>
            <span className="settings-field-desc">
              changes the symbol and formatting across your planner file
            </span>
          </div>
        </div>
      </section>

      {/* Card 6: STARTER DEMO DATA */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            STARTER DEMO DATA
            <InfoBadge text="Load example records to explore or wipe clean to start fresh." />
          </h2>
          <span className="card-meta">nothing is lost if you switch back</span>
        </div>
        <p className="settings-field-desc" style={{ marginBottom: '14px' }}>
          Working through the demo shows you where every number comes from, and clears out in one click.
        </p>

        <div className="action-row">
          <button type="button" className="btn btn-ghost" onClick={onEmpty}>
            Clear demo data
          </button>
          <button type="button" className="btn btn-primary" onClick={onExample}>
            Reload demo data
          </button>
        </div>
      </section>

      {/* Card 7: KINDS OF SPENDING */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            KINDS OF SPENDING
            <InfoBadge text="Categories used to label and group your expenses." />
          </h2>
          <span className="card-meta">{kinds.length} kinds</span>
        </div>
        <p className="settings-field-desc" style={{ marginBottom: '14px' }}>
          Every spend fits into a kind. Open the log spend dialog, type a new kind, and it appears here automatically — rename, reorder, and remove kinds as you wish.
        </p>

        <div className="settings-kinds-list">
          {kinds.map((k) => (
            <div className="settings-kind-row" key={k}>
              <input
                type="text"
                className="settings-kind-input"
                defaultValue={k}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (!val || val === k) return;
                  const updated = kinds.map((item) => (item === k ? val : item));
                  setKinds(updated);
                  localStorage.setItem('budget-kinds-list', JSON.stringify(updated));
                }}
              />
              <button
                type="button"
                className="settings-kind-remove-btn"
                onClick={() => handleRemoveKind(k)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="settings-kind-add-row">
          <input
            type="text"
            className="settings-input-text"
            placeholder="Add a kind: (e.g. Health, Pets)"
            value={newKindInput}
            onChange={(e) => setNewKindInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddKind();
            }}
          />
          <button type="button" className="btn btn-primary" onClick={handleAddKind}>
            Add
          </button>
        </div>
        <span className="settings-field-desc" style={{ display: 'block', marginTop: '6px' }}>
          appears on the logger dropdown when spending
        </span>
      </section>

      {/* Card 8: PAYDAY */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            PAYDAY
            <InfoBadge text="Schedule income arrivals to plan safe-to-spend pace accurately." />
          </h2>
          <span className="card-meta">10 days to your next pay</span>
        </div>
        <p className="settings-field-desc" style={{ marginBottom: '14px' }}>
          Everything revolves around when money arrives, and keeping a steady pace.
        </p>

        <div className="settings-payday-schedule-row">
          <label className="settings-input-label">How many paydays usually occur?</label>
          <div className="settings-pill-toggle">
            <button
              type="button"
              className={`settings-pill-btn ${payFrequency === 'once_a_month' ? 'active' : ''}`}
              onClick={() => {
                setPayFrequency('once_a_month');
                localStorage.setItem('budget-pay-frequency', 'once_a_month');
              }}
            >
              Once a month
            </button>
            <button
              type="button"
              className={`settings-pill-btn ${payFrequency === 'more_than_once' ? 'active' : ''}`}
              onClick={() => {
                setPayFrequency('more_than_once');
                localStorage.setItem('budget-pay-frequency', 'more_than_once');
              }}
            >
              More than once
            </button>
          </div>
          <span className="settings-field-desc">
            different recurring schedules can balance cash flow — once a month leaves you free until the next paycheck, or twice a month breaks down your months into halves.
          </span>
        </div>

        <div className="settings-two-col-grid" style={{ marginTop: '12px' }}>
          <div className="settings-field-group">
            <label className="settings-input-label">
              When does your pay land
              <InfoBadge text="The recurring day money arrives." />
            </label>
            <input
              type="text"
              className="settings-input-text"
              value={payDayDesc}
              onChange={(e) => {
                setPayDayDesc(e.target.value);
                localStorage.setItem('budget-pay-day-desc', e.target.value);
              }}
              placeholder="20th of the month"
            />
            <span className="settings-field-desc">usual day of the month or weekday</span>
          </div>

          <div className="settings-field-group">
            <label className="settings-input-label">
              Next pay arrives on
              <InfoBadge text="Target date for next paycheck." />
            </label>
            <input
              type="date"
              className="settings-input-text"
              value={nextPayDate}
              onChange={(e) => {
                setNextPayDate(e.target.value);
                localStorage.setItem('budget-next-pay-date', e.target.value);
              }}
            />
            <span className="settings-field-desc">counts down days until your safe to spend refills</span>
          </div>
        </div>

        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={splitBillsHalf}
            onChange={(e) => {
              setSplitBillsHalf(e.target.checked);
              localStorage.setItem('budget-split-bills-half', JSON.stringify(e.target.checked));
            }}
          />
          <span>Split bills into pay period halves</span>
        </label>
        <span className="settings-field-desc" style={{ display: 'block', marginLeft: '22px' }}>
          spreads out and divides monthly bills across pay periods for cleaner cash flow
        </span>
      </section>

      {/* Card 9: HOW MUCH TO SHOW */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            HOW MUCH TO SHOW
            <InfoBadge text="Adjust sidebar density to show minimal essentials or the full system." />
          </h2>
          <span className="card-meta">
            {howMuchToShow === 'everything' ? 'everything enabled' : 'simplified view'}
          </span>
        </div>
        <p className="settings-field-desc" style={{ marginBottom: '14px' }}>
          Simplify this planner to what matters most. Currently showing every feature, including Debt, Envelopes and Milestones.
        </p>

        <div className="settings-pill-toggle">
          <button
            type="button"
            className={`settings-pill-btn ${howMuchToShow === 'simple' ? 'active' : ''}`}
            onClick={() => {
              setHowMuchToShow('simple');
              localStorage.setItem('budget-feature-visibility', 'simple');
              onUpdateSettings?.({ featureVisibility: 'simple' });
            }}
          >
            Simple
          </button>
          <button
            type="button"
            className={`settings-pill-btn ${howMuchToShow === 'everything' ? 'active' : ''}`}
            onClick={() => {
              setHowMuchToShow('everything');
              localStorage.setItem('budget-feature-visibility', 'everything');
              onUpdateSettings?.({ featureVisibility: 'everything' });
            }}
          >
            Everything included
          </button>
        </div>
      </section>

      {/* Card 10: CALM MATTE PALETTES & APPEARANCE */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            CALM MATTE PALETTES
            <InfoBadge text="Choose between 4 copyright-free soft calm palettes designed to reduce visual stress and ADHD overwhelm." />
          </h2>
          <span className="card-meta">4 curated calm themes</span>
        </div>
        <p className="settings-field-desc" style={{ marginBottom: '16px' }}>
          Select your visual aesthetic. Each palette uses organic, soft-contrast matte tones on quiet backgrounds. Changes apply instantly across the whole planner.
        </p>

        <div className="settings-palette-grid">
          {PALETTES.map((pal) => {
            const isSelected = activePalette === pal.id;
            return (
              <div
                key={pal.id}
                role="button"
                tabIndex={0}
                className={`settings-palette-card ${isSelected ? 'active' : ''}`}
                onClick={() => handlePalettePick(pal.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePalettePick(pal.id);
                  }
                }}
              >
                <div className="settings-palette-header">
                  <div className="settings-palette-title-row">
                    <span className="settings-palette-name">{pal.name}</span>
                    {pal.isDefault && (
                      <span className="settings-palette-default-badge">DEFAULT</span>
                    )}
                  </div>
                  {isSelected ? (
                    <span className="settings-palette-active-pill">
                      <Check size={12} strokeWidth={3} />
                      Active
                    </span>
                  ) : (
                    <span className="settings-field-desc" style={{ fontSize: '11px' }}>
                      Click to use
                    </span>
                  )}
                </div>

                <div className="settings-palette-tag">{pal.tag}</div>

                <div className="settings-palette-swatches">
                  <div className="settings-palette-swatch-item">
                    <span
                      className="settings-palette-swatch-circle"
                      style={{ background: pal.accent }}
                      title={`Accent: ${pal.accent}`}
                    />
                    <span className="settings-palette-swatch-label">Accent</span>
                    <span className="settings-palette-swatch-hex">{pal.accent}</span>
                  </div>

                  <div className="settings-palette-swatch-item">
                    <span
                      className="settings-palette-swatch-circle"
                      style={{ background: pal.background }}
                      title={`Background: ${pal.background}`}
                    />
                    <span className="settings-palette-swatch-label">Canvas</span>
                    <span className="settings-palette-swatch-hex">{pal.background}</span>
                  </div>

                  <div className="settings-palette-swatch-item">
                    <span
                      className="settings-palette-swatch-circle"
                      style={{ background: pal.cards }}
                      title={`Cards: ${pal.cards}`}
                    />
                    <span className="settings-palette-swatch-label">Cards</span>
                    <span className="settings-palette-swatch-hex">{pal.cards}</span>
                  </div>

                  <div className="settings-palette-swatch-item">
                    <span
                      className="settings-palette-swatch-circle"
                      style={{ background: pal.text }}
                      title={`Text: ${pal.text}`}
                    />
                    <span className="settings-palette-swatch-label">Ink</span>
                    <span className="settings-palette-swatch-hex">{pal.text}</span>
                  </div>
                </div>

                <p className="settings-palette-desc">{pal.description}</p>
              </div>
            );
          })}
        </div>

        {/* Display Mode: Soft Matte (Light) vs Midnight Matte (Dark) */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
              Lighting mode
            </span>
            <span className="card-meta">
              {theme === 'dark' ? 'Midnight mode active' : 'Soft daylight active'}
            </span>
          </div>

          <div className="settings-theme-cards-grid">
            {/* Soft Daylight Mode */}
            <button
              type="button"
              className={`settings-theme-option-card ${theme === 'light' ? 'active' : ''}`}
              onClick={() => handleThemePick('light')}
            >
              <div className="settings-theme-swatch-box settings-theme-swatch-box--light">
                <span className="settings-theme-dot" style={{ background: 'var(--accent)' }} />
                <span className="settings-theme-dot" style={{ background: 'var(--bg)' }} />
                <span className="settings-theme-dot" style={{ background: 'var(--paper)' }} />
                <span className="settings-theme-dot" style={{ background: 'var(--lav)' }} />
                <span className="settings-theme-dot" style={{ background: 'var(--line)' }} />
                <span className="settings-theme-dot" style={{ background: 'var(--ink)' }} />
              </div>
              <div>
                <span className="settings-theme-name">Soft Daylight</span>
                <span className="settings-theme-sub">matte paper, easy on tired eyes</span>
              </div>
            </button>

            {/* Midnight OLED Mode */}
            <button
              type="button"
              className={`settings-theme-option-card ${theme === 'dark' || theme === 'contrast' ? 'active' : ''}`}
              onClick={() => handleThemePick('dark')}
            >
              <div className="settings-theme-swatch-box settings-theme-swatch-box--dark">
                <span className="settings-theme-dot" style={{ background: 'var(--accent)' }} />
                <span className="settings-theme-dot" style={{ background: '#1c241f' }} />
                <span className="settings-theme-dot" style={{ background: '#151b17' }} />
                <span className="settings-theme-dot" style={{ background: '#28362d' }} />
                <span className="settings-theme-dot" style={{ background: '#2b3830' }} />
                <span className="settings-theme-dot" style={{ background: '#e7ebe8' }} />
              </div>
              <div>
                <span className="settings-theme-name">Midnight Mode</span>
                <span className="settings-theme-sub">calm deep ink, OLED friendly</span>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Card 11: WHAT TO CALL THE BIG NUMBER */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            WHAT TO CALL THE BIG NUMBER
            <InfoBadge text="Choose the label displayed above your balance on Today." />
          </h2>
          <span className="card-meta">working gently</span>
        </div>
        <p className="settings-field-desc" style={{ marginBottom: '14px' }}>
          The name above the main balance on Today. Pick whichever one you prefer: safe to spend is what's left after all bills, remaining is your cushion, and left is your total.
        </p>

        <div className="settings-pill-toggle">
          <button
            type="button"
            className={`settings-pill-btn ${bigNumberTitle === 'safe' ? 'active' : ''}`}
            onClick={() => {
              setBigNumberTitle('safe');
              localStorage.setItem('budget-big-number-title', 'safe');
            }}
          >
            Safe to spend
          </button>
          <button
            type="button"
            className={`settings-pill-btn ${bigNumberTitle === 'remaining' ? 'active' : ''}`}
            onClick={() => {
              setBigNumberTitle('remaining');
              localStorage.setItem('budget-big-number-title', 'remaining');
            }}
          >
            Remaining to spend
          </button>
          <button
            type="button"
            className={`settings-pill-btn ${bigNumberTitle === 'left' ? 'active' : ''}`}
            onClick={() => {
              setBigNumberTitle('left');
              localStorage.setItem('budget-big-number-title', 'left');
            }}
          >
            Left to spend
          </button>
        </div>
      </section>

      {/* Card 12: YOUR BALANCE ON TODAY */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            YOUR BALANCE ON TODAY
            <InfoBadge text="Toggle the secondary balance line underneath Today's main balance." />
          </h2>
          <span className="card-meta">displayed gently</span>
        </div>
        <p className="settings-field-desc" style={{ marginBottom: '14px' }}>
          Under your safe to spend balance on Today, a secondary number can show your running total or bills paid. Pick whether you'd like to see it or keep it hidden.
        </p>

        <div className="settings-pill-toggle">
          <button
            type="button"
            className={`settings-pill-btn ${showTodayBalance === 'off' ? 'active' : ''}`}
            onClick={() => {
              setShowTodayBalance('off');
              localStorage.setItem('budget-show-today-balance', 'off');
            }}
          >
            Off
          </button>
          <button
            type="button"
            className={`settings-pill-btn ${showTodayBalance === 'show' ? 'active' : ''}`}
            onClick={() => {
              setShowTodayBalance('show');
              localStorage.setItem('budget-show-today-balance', 'show');
            }}
          >
            Show it
          </button>
        </div>
      </section>

      {/* Card 13: THIS PAY PERIOD */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            THIS PAY PERIOD
            <InfoBadge text="Calculated live from your checking balance, bills, and recent spending." />
          </h2>
          <span className="card-meta">live</span>
        </div>

        <div className="settings-breakdown-table">
          <div className="settings-breakdown-row strong">
            <span className="settings-breakdown-label">Safe until payday</span>
            <span className="settings-breakdown-val">{money(safeUntilPayday)}</span>
          </div>

          <div className="settings-breakdown-row">
            <span className="settings-breakdown-label">Per day until payday</span>
            <span className="settings-breakdown-val" style={{ color: 'var(--muted)', fontWeight: 400 }}>
              about {money(perDayPayday)}/day
            </span>
          </div>

          <div className="settings-breakdown-row">
            <span className="settings-breakdown-label">In checking</span>
            <span className="settings-breakdown-val">{money(inChecking)}</span>
          </div>

          <div className="settings-breakdown-row">
            <span className="settings-breakdown-label">Adjusted: bills paid from checking not cleared</span>
            <span className="settings-breakdown-val negative">- {money(billsPaidAmount)}</span>
          </div>

          <div className="settings-breakdown-row">
            <span className="settings-breakdown-label">Committed: bills funding due before then</span>
            <span className="settings-breakdown-val negative">- {money(billsUnpaidAmount)}</span>
          </div>

          <div className="settings-breakdown-row">
            <span className="settings-breakdown-label">Not safe: and already spent</span>
            <span className="settings-breakdown-val negative">- {money(totalSpent)}</span>
          </div>
        </div>

        <p className="settings-field-desc" style={{ fontStyle: 'italic', marginTop: '12px' }}>
          works for you all the time
        </p>
      </section>

      {/* Card 14: PAST LOANS */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            PAST LOANS
            <InfoBadge text="Track legacy debt and payoff balances with complete calm." />
          </h2>
          <span className="card-meta">tracked with zero interest</span>
        </div>
        <p className="settings-field-desc">
          {debts.length === 0
            ? 'No past loans yet. An account on a payment plan, and the total owed down here. Add one from the Debt screen anytime.'
            : `${debts.length} debt account${debts.length === 1 ? '' : 's'} on record, tracked until zero.`}
        </p>

        <div className="settings-quote-callout">
          "A debt with an end date is a smaller thing than a number with no end. This planner never tells you off for having debt."
        </div>
      </section>

      {/* Card 15: YOUR DATA */}
      <section className="card section-wide">
        <div className="card-head">
          <h2 className="eyebrow">
            YOUR DATA
            <InfoBadge text="Export backups, load files, or wipe data." />
          </h2>
          <span className="card-meta">local to this device</span>
        </div>
        <p className="settings-field-desc">
          Your entire budget is stored in this web browser. No cloud, no company storing your data. To protect it, download a copy or restore it on any computer.
        </p>

        {autoBackupPaused ? (
          <div className="settings-backup-warning-banner">
            <span className="settings-backup-warning-text">
              <b>Auto-backup is paused.</b> Your browser won't save clicks between lamps or trips to your file.
            </span>
            <button
              type="button"
              className="settings-backup-warning-btn"
              onClick={handleToggleAutoBackup}
            >
              RESUME AUTO-BACKUP
            </button>
          </div>
        ) : (
          <div className="settings-backup-warning-banner" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <span className="settings-backup-warning-text" style={{ color: '#166534' }}>
              <b>Auto-backup is running.</b> Calm local snapshots are saved automatically to your device.
            </span>
            <button
              type="button"
              className="settings-backup-warning-btn"
              style={{ background: '#16a34a' }}
              onClick={handleToggleAutoBackup}
            >
              PAUSE AUTO-BACKUP
            </button>
          </div>
        )}

        <p className="settings-field-desc" style={{ marginTop: '10px' }}>
          Last backup: today. A backup file is a calm backup on this computer, not kept on an online server.
        </p>

        <div className="settings-backup-actions-row">
          <button type="button" className="btn btn-ghost" onClick={handleDownloadBackup}>
            Download backup
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleExportCSV}>
            Export spending CSV
          </button>
          <label className="btn btn-ghost" style={{ cursor: 'pointer', margin: 0 }}>
            Restore your backup file
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleRestoreFile}
            />
          </label>
        </div>

        <div className="settings-danger-box">
          <p className="settings-field-desc" style={{ marginBottom: '10px' }}>
            Permanently reset this planner file. All bills, spends, goals, debts, and envelopes will be permanently wiped.
          </p>
          {!showEraseConfirm ? (
            <button
              type="button"
              className="settings-danger-btn"
              onClick={() => setShowEraseConfirm(true)}
            >
              Erase everything
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
                onClick={handleEraseEverything}
              >
                Confirm: Erase Everything Now
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowEraseConfirm(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Modal 1: Connect another device */}
      {showConnectModal && (
        <div className="modal-scrim" onClick={() => setShowConnectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <h2>Connect another device</h2>
              <IconButton label="Close" onClick={() => setShowConnectModal(false)}>
                <X />
              </IconButton>
            </div>

            <div style={{ marginTop: '14px' }}>
              <p style={{ fontSize: '13.5px', color: 'var(--ink)', margin: '0 0 6px', fontWeight: 600 }}>
                Enter this code on your other device.
              </p>
              <div className="sync-code-display-wrap">
                <div className="sync-code-number">{syncCode.display}</div>
                <div className="sync-code-sub">
                  Expires in {formatCountdown(countdown)}
                </div>
              </div>

              <p className="settings-field-desc" style={{ lineHeight: '1.5', margin: '14px 0' }}>
                Open this planner on the other device, choose <b>I already use this planner</b>, and enter the code. It expires in 10 minutes.
              </p>

              {pairRequestDetected && (
                <div className="sync-check-number-callout">
                  <div className="sync-check-number-text">
                    Another device is requesting connection! Confirm check number:
                  </div>
                  <div className="sync-check-number-badge">{checkNumber}</div>
                  <p className="settings-field-desc" style={{ margin: '6px 0 12px' }}>
                    Both screens must show this exact 3-digit check number.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%' }}
                    onClick={handleAllowDevice}
                  >
                    Allow this device
                  </button>
                </div>
              )}

              {pairSuccess ? (
                <div style={{ textAlign: 'center', color: '#16a34a', fontWeight: 600, padding: '12px 0' }}>
                  ✓ Device connected! Planner synced successfully.
                </div>
              ) : !pairRequestDetected && (
                <div className="sync-pulse-indicator">
                  <span className="sync-pulse-dot" />
                  <span>Waiting for the other device…</span>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  navigator.clipboard.writeText(syncCode.display);
                  showToast('✓ Code copied to clipboard');
                }}
              >
                Copy code
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowConnectModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: I already use this planner */}
      {showAlreadyUseModal && (
        <div className="modal-scrim" onClick={() => setShowAlreadyUseModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <h2>I already use this planner</h2>
              <IconButton label="Close" onClick={() => setShowAlreadyUseModal(false)}>
                <X />
              </IconButton>
            </div>

            <div style={{ marginTop: '14px' }}>
              <div className="settings-pill-toggle" style={{ marginBottom: '14px' }}>
                <button
                  type="button"
                  className={`settings-pill-btn ${alreadyUseTab === 'code' ? 'active' : ''}`}
                  onClick={() => setAlreadyUseTab('code')}
                >
                  6-digit connection code
                </button>
                <button
                  type="button"
                  className={`settings-pill-btn ${alreadyUseTab === 'key' ? 'active' : ''}`}
                  onClick={() => setAlreadyUseTab('key')}
                >
                  20-character recovery key
                </button>
              </div>

              {alreadyUseTab === 'code' ? (
                <div>
                  <p className="settings-field-desc" style={{ marginBottom: '10px' }}>
                    On your primary device, go to Settings and tap <b>Use on another device</b> (or Connect another device) to generate a 6-digit code.
                  </p>
                  <label className="settings-input-label">Connection code</label>
                  <input
                    type="text"
                    autoFocus
                    className="settings-input-text"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '24px',
                      letterSpacing: '4px',
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '12px',
                    }}
                    placeholder="039 763"
                    value={alreadyUseInput}
                    onChange={(e) => setAlreadyUseInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConnectAlreadyUse();
                    }}
                  />

                  {alreadyUsePendingCheck && (
                    <div className="sync-check-number-callout" style={{ marginTop: '12px' }}>
                      <div className="sync-check-number-text">Confirm check number matches your other device:</div>
                      <div className="sync-check-number-badge">{alreadyUsePendingCheck}</div>
                      <span className="settings-field-desc">Waiting for confirmation…</span>
                    </div>
                  )}

                  {alreadyUseSuccess && (
                    <div style={{ textAlign: 'center', color: '#16a34a', fontWeight: 600, marginTop: '12px' }}>
                      ✓ Connected! Synchronized with your device.
                    </div>
                  )}

                  <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowAlreadyUseModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConnectAlreadyUse}
                    >
                      Connect and sync
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="settings-field-desc" style={{ marginBottom: '10px' }}>
                    Enter your 20-character recovery key to bring your planner back. Dashes and capitals do not matter.
                  </p>
                  <label className="settings-input-label">Recovery key</label>
                  <input
                    type="text"
                    className="settings-input-text"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '15px',
                      letterSpacing: '2px',
                      textAlign: 'center',
                      fontWeight: 600,
                      padding: '10px',
                    }}
                    placeholder="X8K2-9PLA-47BN-M92Q"
                    value={alreadyUseRecoveryInput}
                    onChange={(e) => setAlreadyUseRecoveryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRestoreRecoveryKey();
                    }}
                  />

                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                    <p className="settings-field-desc" style={{ marginBottom: '8px' }}>
                      Or have a backup file saved from your computer or phone?
                    </p>
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <ArrowDownToLine size={14} />
                      Restore your backup file (.json)
                      <input
                        type="file"
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={handleRestoreFile}
                      />
                    </label>
                  </div>

                  <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowAlreadyUseModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleRestoreRecoveryKey}
                    >
                      Restore numbers
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Show my recovery key */}
      {showRecoveryModal && (
        <div className="modal-scrim" onClick={() => setShowRecoveryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-head">
              <h2>Recovery copy & key</h2>
              <IconButton label="Close" onClick={() => setShowRecoveryModal(false)}>
                <X />
              </IconButton>
            </div>

            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 600, fontSize: '13.5px' }}>
                <span>✓</span>
                <span>Recovery copy is on.</span>
              </div>
              <p className="settings-field-desc" style={{ margin: '6px 0 12px' }}>
                Your recovery key brings everything back onto any device, even if this one is wiped. Keep it where you will find it.
              </p>

              <div className="recovery-key-grid">
                {recoveryKey.split('-').map((chunk, idx) => (
                  <div className="recovery-key-chunk" key={idx}>
                    {chunk}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(recoveryKey);
                    setRecoveryKeyCopied(true);
                    showToast('✓ Recovery key copied to clipboard.');
                    setTimeout(() => setRecoveryKeyCopied(false), 3000);
                  }}
                >
                  {recoveryKeyCopied ? '✓ Key copied' : 'Copy the key'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const blob = new Blob([`ADHD Planner Recovery Key:\n${recoveryKey}\n\nKeep this where you can find it. Used to restore numbers on any phone or computer.`], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'steady-recovery-key.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('✓ Saved recovery key file.');
                  }}
                >
                  Save to Notes / File
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', marginTop: '12px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px', color: 'var(--ink)' }}>
                  Use Face ID, Touch ID or your fingerprint
                </h4>
                <p className="settings-field-desc" style={{ marginBottom: '8px' }}>
                  Lock your recovery copy with a device passkey in iCloud Keychain or Google Password Manager.
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setRecoveryPasskeySaved(true);
                    localStorage.setItem('budget-recovery-passkey', 'true');
                    showToast('✓ Passkey verified with device biometrics.');
                  }}
                >
                  {recoveryPasskeySaved ? '✓ Passkey active on this device' : 'Set up Passkey with Face ID / Touch ID'}
                </button>
              </div>

              <p className="settings-field-desc" style={{ fontStyle: 'italic', marginTop: '14px', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
                Only your passkey or your key opens the copy. Nobody at the shop can read your numbers, and nobody can bring them back without one of them.
              </p>
            </div>

            <div className="modal-actions" style={{ marginTop: '14px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowRecoveryModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Step-by-step help for phone and computer */}
      {showHelpModal && (
        <div className="modal-scrim" onClick={() => setShowHelpModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-head">
              <h2>ADHD Planner</h2>
              <IconButton label="Close" onClick={() => setShowHelpModal(false)}>
                <X />
              </IconButton>
            </div>

            <div className="step-help-content" style={{ marginTop: '14px' }}>
              <h3 style={{ marginTop: 0 }}>Your phone and your computer</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
                Two short answers. You do not need to be technical for either one.
              </p>

              <div className="step-help-callout">
                <h4>Put it on your phone's Home Screen — this is what keeps your numbers</h4>
                <p>
                  It is a website, so it arrives in your browser rather than from an app store. Giving it an icon is not just for looks: Safari deletes a website's saved numbers after about a week of not opening it. A planner opened from the Home Screen (or the Dock on a Mac) is left alone. Do this step even if you only ever use it on one device.
                </p>
                <ul>
                  <li><b>iPhone or iPad:</b> open adhdbudget.thelittlemachines.app in Safari, tap the Share button (the square with the arrow coming out of it), then Add to Home Screen.</li>
                  <li><b>Android:</b> open the same address in Chrome, tap the menu (three dots), then Add to Home Screen.</li>
                  <li><b>Mac, in Safari:</b> open the address, then in the menu bar choose File, then Add to Dock.</li>
                  <li><b>Computer, in Chrome or Edge:</b> open the address, then in the menu choose Cast, Save and Share, then Install page as app. On a computer, Chrome and Edge can also keep a backup file up to date for you: in Settings, tap Turn on auto-backup and choose where the file lives, once.</li>
                </ul>
                <p>After that it opens from an icon like any other app, and it works even without internet.</p>
                <p style={{ fontStyle: 'italic', fontSize: '12px', color: 'var(--muted)' }}>
                  The new icon starts with an empty planner if you had already typed numbers into the Safari tab. Bring them across: in the Safari tab, go to Settings and tap Download a backup; then open the icon and tap Restore your backup file on the banner at the top. Or, if you kept a recovery copy, tap Get my numbers back in the new copy and use Face ID (or type your key).
                </p>
              </div>

              <div className="step-help-callout">
                <h4>Keep a recovery copy — one tap, and your numbers can always come back</h4>
                <p>
                  A browser can clear what it saved. A recovery copy means that is never the end of your numbers. It is encrypted on your device before it goes anywhere, and there is no account and no email.
                </p>
                <p><b>The easy way — Face ID, Touch ID or your fingerprint:</b></p>
                <ul>
                  <li>In Settings, tap Keep a recovery copy, then Use Face ID or Touch ID (or your fingerprint). Your device asks to save a passkey for the planner — say yes. That is the whole setup. Nothing to write down.</li>
                  <li>If your numbers ever vanish — or you open the planner on a new device, or from a new Home Screen icon — tap Get my numbers back on the first screen and use Face ID again. Everything returns, and the device stays connected from then on.</li>
                  <li>The passkey lives in your Apple or Google account (iCloud Keychain or Google Password Manager), so it survives a wiped browser and a new phone.</li>
                </ul>
                <p><b>The other way — a 20-character key:</b></p>
                <ul>
                  <li>Tap Keep a recovery copy. The planner shows you a recovery key: 20 letters and digits in four groups. Tap Copy the key or Save to Notes, or take a screenshot. You can see it again any time under Show my recovery key.</li>
                  <li>To bring everything back, tap Get my numbers back and type the key. Dashes and capitals do not matter.</li>
                  <li>Only your passkey or your key opens the copy. Nobody at the shop can read your numbers, and nobody can bring them back without one of them.</li>
                </ul>
              </div>

              <div className="step-help-callout">
                <h4>Use it on your phone and your computer</h4>
                <p>
                  Your planner saves on each device on its own. Connecting them is optional and you only do it once.
                </p>
                <p>
                  Start on the device that has the most up-to-date numbers — the steps below assume that is your phone. Whichever device you type the code into takes on the other one's planner, so beginning with the fuller device keeps everything.
                </p>
                <ol style={{ paddingLeft: '20px', margin: '0 0 10px' }}>
                  <li><b>On your phone:</b> tap More at the bottom, then Settings. Find the card Use it on your phone and computer and tap Use on another device. A 6-digit code appears. It lasts 10 minutes.</li>
                  <li><b>On your computer:</b> open the planner, go to Settings, find the same card and tap I already use this planner. Type the code in.</li>
                  <li>Both screens show the same small 3-digit check number. On your phone, tap Allow this device.</li>
                </ol>
                <p>
                  That is it. From then on, a change on one device appears on the other within about half a minute, as long as both have the planner open and online. It does not update while the planner is closed — open it and it catches up.
                </p>
              </div>

              <div className="step-help-callout">
                <h4>Keep a copy, just in case</h4>
                <p>
                  In Settings (on a phone, More then Settings) tap Download a backup. It saves a small file of your numbers that you can bring back later with Restore your backup file. It is the copy that survives if a browser clears its storage.
                </p>
                <p>Worth doing after you first set everything up, and after any big change.</p>
              </div>

              <div style={{ textAlign: 'center', margin: '24px 0 12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowHelpModal(false)}
                >
                  Open the planner
                </button>
                <p style={{ fontStyle: 'italic', fontSize: '12px', color: 'var(--muted)', marginTop: '12px' }}>
                  Still stuck? Message the shop. A human answers.
                  <br />
                  <b>The Little Machines</b>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Add a second planner */}
      {showAddPlannerModal && (
        <div className="modal-scrim" onClick={() => setShowAddPlannerModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-head">
              <h2>Add a planner file</h2>
              <IconButton label="Close" onClick={() => setShowAddPlannerModal(false)}>
                <X />
              </IconButton>
            </div>

            <div style={{ marginTop: '12px' }}>
              <p className="settings-field-desc" style={{ marginBottom: '12px' }}>
                You can keep up to 4 planners on this device (e.g. personal, household, business). Switch between them from here or your other devices. Each file is isolated under its own lock if you use one.
              </p>

              <div className="settings-field-group">
                <label className="settings-input-label">Planner name</label>
                <input
                  type="text"
                  autoFocus
                  className="settings-input-text"
                  placeholder="e.g. Household, Business, Vacation"
                  value={newPlannerName}
                  onChange={(e) => setNewPlannerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreatePlanner();
                  }}
                />
              </div>

              <div style={{ marginTop: '14px' }}>
                <label className="settings-input-label">Starting template</label>
                <div style={{ display: 'grid', gap: '8px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="planner_template"
                      checked={newPlannerBlank}
                      onChange={() => setNewPlannerBlank(true)}
                    />
                    <span>Start with a calm blank budget (0 balance)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="planner_template"
                      checked={!newPlannerBlank}
                      onChange={() => setNewPlannerBlank(false)}
                    />
                    <span>Copy current setup, categories and bills</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowAddPlannerModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreatePlanner}
                >
                  Create planner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Footer */}
      <footer className="settings-page-footer">
        <span>{plannerTitle || 'ADHD Planner'} · Saved on this device · version 2026-09-23</span>
        <span>Preferences · Privacy · Lifetime licence</span>
      </footer>
    </div>
  );
}


export function Help({ onExample, onEmpty }: { onExample: () => void; onEmpty: () => void }) {
  const { t } = useTranslation();
  return <div className="screen-body"><section className="card section-wide"><div className="card-head"><h2 className="eyebrow">{t('How this planner works')}</h2><span className="card-meta">{t('Plain words')}</span></div><div className="help-list"><details open><summary>Pick a screen. Read only that.</summary><p>Today is for the one thing you need now. Planner shows the month. Bills, Money in, Goals, Debt, Envelopes and Milestones keep the rest somewhere calm.</p></details><details><summary>Use it on your phone and computer</summary><p>Your saved numbers stay on this device while it opens. Nothing here needs an account.</p></details><details><summary>Start with an example or start blank</summary><p>The example is made up. Empty file means every balance, bill, goal and category starts at zero.</p></details><details><summary>Keyboard shortcuts</summary><p>Press Ctrl or Command plus K for quick actions. Press Escape to close a dialog.</p></details></div></section><section className="card section-wide"><h2 className="eyebrow">{t('Choose your starting point')}</h2><div className="action-row"><button className="btn btn-ghost" onClick={onExample}>{t('Keep the example')}</button><button className="btn btn-primary" onClick={onEmpty}>{t('Start with an empty file')}</button></div></section></div>;


}

