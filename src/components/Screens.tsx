import React, { useState, useMemo, useEffect } from "react";
import { ArrowDownToLine, CalendarDays, Check, ChevronRight, CircleHelp, Flag, Gauge, Keyboard, ListChecks, MoreHorizontal, Plus, RotateCcw, Settings2, Target, Wallet, X } from "lucide-react";
import { useTranslation } from "../lib/i18n";
import { useCurrency } from "../lib/currency";
import { db } from "../lib/db";
import { Screen, Mode, Spend, Goal, Bill, Income, Debt, Envelope, exampleGoals, exampleBills, exampleIncome, exampleEnvelopes, screens, readStorage } from "../types";
import { InfoBadge, IconButton, SeedBanner, SpendPanel, GoalMini, Sidebar, Topbar, RightNow, AddModal, CommandBar } from "./Shared";

export function Today({
  spends,
  goals,
  bills,
  income,
  startingBalance,
  emptyMode,
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
  onAdd: (s: Omit<Spend, 'id'>) => void;
  onLog: () => void;
  onDeleteSpend: (id: number) => void;
  completed: boolean;
  setCompleted: (b: boolean) => void;
  onHelp: () => void;
}) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const [brain, setBrain] = useState<string[]>(() => readStorage('budget-brain', []));
  const [brainInput, setBrainInput] = useState('');
  const [graphToggle, setGraphToggle] = useState(false);
  
  const spent = spends.reduce((sum, s) => sum + s.amount, 0);
  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalBills = bills.reduce((sum, item) => sum + item.amount, 0);
  
  const dailyStart = startingBalance ? startingBalance / 10 : 0;
  const safe = Math.max(0, dailyStart - spent);
  const submitBrain = (e: FormEvent) => {
    e.preventDefault();
    if (brainInput.trim()) {
      const next = [...brain, brainInput.trim()];
      setBrain(next);
      window.localStorage.setItem('budget-brain', JSON.stringify(next));
      setBrainInput('');
    }
  };
  return (
    <div className="screen-body">
      {!(completed || spends.some(s => s.date === new Date().toISOString().split('T')[0])) && <RightNow onDone={() => setCompleted(true)} />}
      <div className="herorow">
        <section className="hero-panel">
          <p className="eyebrow">{t('Safe to spend today')}<InfoBadge text="This is the money you can safely spend today without touching your bills, goals, or debts. It grows if you spend less, and shrinks if you overspend." />
          </p>
          <p className="hero num">
            <span className="hero-mark">{currency}</span>
            <span>{Math.floor(safe)}</span>
            <span className="hero-frac">.{Math.round((safe % 1) * 100).toString().padStart(2, '0')}</span>
          </p>
          <p className="hero-read">
            of today’s starting {money(dailyStart)} · {money(startingBalance)} has to last until Thu 1 Oct
          </p>
          <p className="hero-facts">
            <span>
              <small>Until</small>
              <strong>Thu 1 Oct</strong>
            </span>
            <span>
              <small>Remaining</small>
              <strong className="num">{money(Math.max(0, startingBalance - spent))}</strong>
            </span>
          </p>
          <button className="hero-how" onClick={onHelp}>
            How is this worked out?
          </button>
          <div className="meter" onClick={() => setGraphToggle(c => !c)} title="Click to toggle">
            <div className="meter-fill" style={{ width: dailyStart ? `${Math.min(100, (spent / dailyStart) * 100)}%` : '0%' }} />
          </div>
          <p className="meter-text">
            {graphToggle ? `${money(Math.max(0, dailyStart - spent))} remaining today` : `${money(spent)} of today’s starting ${money(dailyStart)}`}
          </p>
          <div className="quickchips">
            {[
              [4, 'Coffee', 'chip-pink'],
              [12, 'Lunch', 'chip-peach'],
              [6, 'Bus', 'chip-sky'],
            ].map(([amount, label, tone]) => {
              const todayStr = new Date().toISOString().split('T')[0];
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
              Three small things <InfoBadge text="These are three small habits that keep you on track. Check them off by logging spends, hitting milestones, or staying within your safe limit." />
            </h2>
            <span className="card-meta">{completed ? '2' : '1'} of 3 done</span>
          </div>
          <ul className="questlist">
            <li className={completed ? 'quest is-done' : 'quest'}>
              <button className="quest-btn" onClick={() => setCompleted(!completed)} aria-pressed={completed}>
                <span className="quest-box">{completed && <Check size={12} />}</span>
                <span className="quest-text">Log anything you spent today</span>
                <span className="quest-effort">30 sec</span>
              </button>
            </li>
            <li className="quest is-done">
              <button className="quest-btn" onClick={() => setCompleted(true)} aria-pressed="true">
                <span className="quest-box"><Check size={12} /></span>
                <span className="quest-text">Checking balance is set</span>
                <span className="quest-effort">1 min</span>
              </button>
            </li>
            <li className="quest">
              <button className="quest-btn" onClick={() => setCompleted(true)}>
                <span className="quest-box" />
                <span className="quest-text">Keep today under {money(dailyStart)}</span>
                <span className="quest-effort">—</span>
              </button>
            </li>
          </ul>
          <p className="quest-foot">one down. that counts.</p>
        </section>
      </div>
      <div className="logrow">
        <section className="card register-card">
          <div className="card-head">
            <h2 className="card-title">What you logged</h2>
            <span className="card-meta">{spends.length ? `${spends.length} today` : 'nothing yet'}</span>
          </div>
          <p className="register-sub">every spend you log, newest first</p>
          {spends.length === 0 ? (
            <div className="register-empty">
              <p>{emptyMode ? 'Nothing here yet. Add your first spend when you are ready.' : 'nothing logged yet. anything you add lands here, editable.'}</p>
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
        <div className="card-head"><h2 className="eyebrow">Every day this month <InfoBadge text="A visual history of how much you have spent over the last 15 days." /></h2><span className="card-meta">Last 15 days</span></div>
        <div className="mini-chart">
          {(() => {
            const chartDays = 15;
            if (emptyMode || spends.length === 0) {
              return Array.from({ length: chartDays }, (_, i) => <span key={i} className={i === chartDays - 1 ? 'today-bar' : ''} style={{ height: `${emptyMode ? 4 + (i % 3) * 4 : 12 + (i % 6) * 7}px` }} />);
            }
            const today = new Date();
            const days = Array.from({ length: chartDays }, (_, i) => {
              const d = new Date(today);
              d.setDate(d.getDate() - (chartDays - 1 - i));
              return d.toISOString().split('T')[0];
            });
            const spendMap = spends.reduce((acc, s) => {
              acc[s.date] = (acc[s.date] || 0) + s.amount;
              return acc;
            }, {} as Record<string, number>);
            const maxSpend = Math.max(...days.map(d => spendMap[d] || 0), 1);
            return days.map((d, i) => {
              const amount = spendMap[d] || 0;
              const height = amount === 0 ? 4 : Math.max(8, (amount / maxSpend) * 40);
              return <span key={i} className={i === chartDays - 1 ? 'today-bar' : ''} style={{ height: `${height}px` }} />;
            });
          })()}
        </div>
        <p className="chart-caption">{emptyMode ? 'Your spending shape will appear as you go.' : spends.length ? 'Your spending shape is taking form.' : 'nothing logged this month yet — the shape appears as you go'}</p>
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
  spends,
  bills,
  income,
  startingBalance,
  emptyMode,
  onHelp
}: {
  spends: Spend[];
  bills: Bill[];
  income: Income[];
  startingBalance: number;
  emptyMode: boolean;
  onHelp: () => void;
}) {
  const events = useMemo(() => {
    if (emptyMode) return {};
    const map: Record<number, string[]> = {};
    bills.forEach(b => {
      // due is like '4th', '18th'. parse the number out.
      const match = b.due.match(/\d+/);
      if (match) {
        const day = parseInt(match[0], 10);
        if (!map[day]) map[day] = [];
        map[day].push(b.name);
      }
    });
    income.forEach(inc => {
      // inc.date is a full date string or '17th', parse the day out.
      const match = inc.date.match(/\d+/);
      if (match) {
        // if it's a full yyyy-mm-dd date, match might be '2026', so we should handle better
        // since example format is just "17th", we'll just extract the first number or parse yyyy-mm-dd
        let day;
        if (inc.date.includes('-')) {
          day = parseInt(inc.date.split('-')[2], 10);
        } else {
          day = parseInt(match[0], 10);
        }
        if (!map[day]) map[day] = [];
        map[day].push(inc.source);
      }
    });
    return map;
  }, [bills, income, emptyMode]);

  const spent = spends.reduce((sum, s) => sum + s.amount, 0);
  const remaining = Math.max(0, startingBalance - spent);
  
  // calculate days left in month
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - today.getDate() + 1; // inclusive of today

  return (
    <div className="screen-body">
      <section className="card section-wide">
        <div className="card-head"><h2 className="eyebrow">Every day this month <InfoBadge text="A visual history of your daily spending over the entire month." /></h2><div className="card-meta">still to pay&nbsp;&nbsp; money in&nbsp;&nbsp; already paid</div></div>
        <div className="calendar"><table><thead><tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <th key={d}>{d}</th>)}</tr></thead><tbody>{Array.from({ length: 5 }, (_, row) => <tr key={row}>{Array.from({ length: 7 }, (_, col) => { const n = row * 7 + col - 1; return <td key={col} className={`day-cell ${n === today.getDate() ? 'today' : ''}`}>{n > 0 && n <= lastDay && <><span className="day-num">{n}</span>{events[n] && events[n].map((ev, i) => <div key={i} className="day-event">{ev}</div>)}</>}</td>; })}</tr>)}</tbody></table></div>
      </section>
      <div className="screen-grid">
        <section className="card list-card"><div className="card-head"><h2 className="eyebrow">What you logged in Sep 2026</h2></div><p className="register-empty">{emptyMode ? 'Nothing logged yet. This page will fill as you add spends.' : 'nothing logged this month yet — the shape appears as you go'}</p></section>
        <section className="card list-card"><div className="card-head"><h2 className="eyebrow">{t('Run to payday')}<InfoBadge text="How much you have left to safely spend before your next payday arrives." /></h2></div><div className="metric">{emptyMode ? money(0) : money(remaining)}</div><p className="register-sub">{emptyMode ? 'Add a starting balance in Settings.' : `${daysLeft} days left · about ${money(remaining / daysLeft)}/day`}</p></section>
      </div>
      <section className="card section-wide"><div className="card-head"><h2 className="eyebrow">Notes for September</h2><span className="card-meta">{t('saved on this device')}</span></div><input className="braindump-input" placeholder="Type a month note, press Enter" /></section>
    </div>
  );
}


export function Bills({
  bills,
  emptyMode,
  onAddBill,
  onToggle,
  onDeleteBill,
  onHelp,
}: {
  bills: Bill[];
  emptyMode: boolean;
  onAddBill: () => void;
  onToggle: (id: number) => void;
  onDeleteBill: (id: number) => void;
  onHelp: () => void;
}) {
  return (
    <div className="screen-body">
      <section className="card list-card section-wide">
        <div className="card-head"><h2 className="eyebrow">Every bill you owe <InfoBadge text="A list of all your recurring bills and must-pays. Check them off as you pay them to update your safe-to-spend balance." /></h2><span className="card-meta">Soonest first</span></div>
        {bills.length === 0 ? <div className="empty-state"><strong>{t('No bills yet')}</strong><span>{t('Add the things that need paying before they become a surprise.')}</span></div> : bills.map((bill) => <div className="list-row" key={bill.id}><button className="check-line" onClick={() => onToggle(bill.id)}><span className={`quest-box ${bill.paid ? 'checked' : ''}`}>{bill.paid && <Check size={12} />}</span><span><span className="list-label">{bill.name}</span><span className="list-detail">{bill.due}</span></span></button><span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span className="list-value">{money(bill.amount)}</span><span className={`pill ${bill.paid ? '' : 'chip-peach'}`}>{bill.paid ? 'paid' : 'still to pay'}</span><button className="text-button" style={{ marginLeft: 4, opacity: 0.5 }} onClick={() => onDeleteBill(bill.id)}>×</button></span></div>)}
        <button className="btn btn-primary" onClick={onAddBill}><Plus size={14} />Add a bill</button>
      </section>
      <div className="screen-grid"><section className="card small-card"><h2 className="eyebrow">Still to go out</h2><div className="metric">{money(bills.filter((b) => !b.paid).reduce((sum, b) => sum + b.amount, 0))}</div><p>Before Thu 1 Oct</p></section><section className="card small-card"><h2 className="eyebrow">All set aside</h2><div className="metric">{money(bills.filter((b) => b.paid).reduce((sum, b) => sum + b.amount, 0))}</div><p>Already held out of safe to spend</p></section></div>
    </div>
  );
}


export function Goals({ goals, setGoals, emptyMode, onHelp }: { goals: Goal[]; setGoals: (g: Goal[]) => void; emptyMode: boolean; onHelp: () => void }) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [giveId, setGiveId] = useState<number | null>(null);
  const [give, setGive] = useState('');
  const add = () => {
    if (name.trim() && Number(target) > 0) {
      setGoals([...goals, { id: Date.now(), name: name.trim(), saved: 0, target: Number(target), monthly: 0 }]);
      setName('');
      setTarget('');
      setOpen(false);
    }
  };
  const contribute = () => {
    if (giveId !== null && Number(give) > 0) setGoals(goals.map((g) => g.id === giveId ? { ...g, saved: Math.min(g.target, g.saved + Number(give)) } : g));
    setGive('');
    setGiveId(null);
  };
  return (
    <div className="screen-body">
      <section className="card list-card section-wide">
        <div className="card-head"><h2 className="eyebrow">Every goal <InfoBadge text="Money you are setting aside for the future. You can put money into these at any time." /></h2><span className="card-meta">Put away so far</span></div>
        {goals.length === 0 ? <div className="empty-state"><strong>{t('No goals yet')}</strong><span>{t('Give your money somewhere kind to go.')}</span></div> : goals.map((g) => <div className="goal goal-expanded" key={g.id}><div className="goal-row"><span className="goal-name">{g.name}</span><span className="goal-val num">{shortMoney(g.saved)} / {shortMoney(g.target)}</span></div><div className="track"><div className="track-fill" style={{ width: `${g.target ? Math.min(100, (g.saved / g.target) * 100) : 0}%` }} /></div><p className="goal-note"><span>{shortMoney(Math.max(0, g.target - g.saved))} to go</span><span>{shortMoney(g.monthly)} / month</span></p><div className="goal-actions"><button className="btn btn-primary" onClick={() => setGiveId(g.id)}>{t('Put in')}</button><button className="btn btn-ghost" onClick={() => setGoals(goals.filter((item) => item.id !== g.id))}>{t('Remove')}</button></div></div>)}
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={14} />Add a goal</button>
        {emptyMode && <p className="empty-note">You are working from a blank file. Goals start at zero.</p>}
      </section>
      {(open || giveId !== null) && <div className="modal-scrim" onClick={() => { setOpen(false); setGiveId(null); }}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><h2>{giveId === null ? 'Add a goal' : 'Put money in'}</h2><IconButton label="Close" onClick={() => { setOpen(false); setGiveId(null); }}><X /></IconButton></div>{giveId === null ? <div className="modal-form"><label>What are you saving for?<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Japan, next spring" /></label><label>How much?<input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="3000" inputMode="decimal" /></label></div> : <div className="modal-form"><label>How much would you like to put in?<input autoFocus value={give} onChange={(e) => setGive(e.target.value)} placeholder="50" inputMode="decimal" /></label></div>}<div className="modal-actions"><button className="btn btn-ghost" onClick={() => { setOpen(false); setGiveId(null); }}>Close</button><button className="btn btn-primary" onClick={giveId === null ? add : contribute}>{giveId === null ? 'Add a goal' : 'Put it in'}</button></div></div></div>}
    </div>
  );
}


export function Income({ income, emptyMode, onAdd, onRemove }: { income: Income[]; emptyMode: boolean; onAdd: () => void; onRemove: (id: number) => void }) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const total = income.reduce((sum, item) => sum + item.amount, 0);
  return <div className="screen-body"><section className="card list-card section-wide"><div className="card-head"><h2 className="eyebrow">{t('Everything that came in')}<InfoBadge text="Log all your income here, like your salary or unexpected cash." /></h2><span className="card-meta">{t('This month')}</span></div>{income.length === 0 ? <div className="empty-state"><strong>{t('No money in yet')}</strong><span>{t('Starting at zero is okay. Add income when it arrives.')}</span></div> : income.map((item) => <div className="list-row" key={item.id}><span><span className="list-label">{item.source}</span><span className="list-detail">{item.date}</span></span><span><span className="list-value">{money(item.amount)}</span><button className="text-button" onClick={() => onRemove(item.id)}>{t('Remove')}</button></span></div>)}<button className="btn btn-primary" onClick={onAdd}><Plus size={14} />{t('Put down money in')}</button></section><div className="screen-grid"><section className="card small-card"><h2 className="eyebrow">{t('Came in')}</h2><div className="metric">{money(emptyMode ? 0 : total)}</div><p>{income.length ? `${income.length} source${income.length === 1 ? '' : 's'}` : 'nothing added yet'}</p></section><section className="card small-card"><h2 className="eyebrow">{t('Still to come')}</h2><div className="metric">{money(0)}</div><p>{t('No future income added')}</p></section></div></div>;
}


export function Debt({ debts, emptyMode, onAdd, onRemove }: { debts: Debt[]; emptyMode: boolean; onAdd: () => void; onRemove: (id: number) => void }) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const total = debts.reduce((sum, item) => sum + item.amount, 0);
  return <div className="screen-body"><section className="card list-card section-wide"><div className="card-head"><h2 className="eyebrow">{t('Paying it down')}<InfoBadge text="Track your debts here. Enter the minimum payments to make sure they are accounted for in your budget." /></h2><span className="card-meta">{t('one step at a time')}</span></div>{debts.length === 0 ? <div className="empty-state"><strong>{t('Nothing owed on this file')}</strong><span>{t('If you have debt, add it here and keep the next step visible.')}</span></div> : debts.map((item) => <div className="list-row" key={item.id}><span><span className="list-label">{item.name}</span><span className="list-detail">Minimum payment {money(item.minimum)}</span></span><span><span className="list-value">{money(item.amount)}</span><button className="text-button" onClick={() => onRemove(item.id)}>{t('Remove')}</button></span></div>)}<button className="btn btn-primary" onClick={onAdd}><Plus size={14} />{t('Add a debt')}</button></section><div className="screen-grid"><section className="card small-card"><h2 className="eyebrow">{t('Still owed')}</h2><div className="metric">{money(emptyMode ? 0 : total)}</div><p>{debts.length ? 'across your debts' : 'nothing owed on this file'}</p></section><section className="card small-card"><h2 className="eyebrow">{t('Which one first?')}</h2><div className="metric">{debts.length ? debts[0].name : '—'}</div><p>{t('the next small step')}</p></section></div></div>;
}


export function Envelopes({ envelopes, emptyMode, onAdd, onRemove }: { envelopes: Envelope[]; emptyMode: boolean; onAdd: () => void; onRemove: (id: number) => void }) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  return <div className="screen-body"><section className="card list-card section-wide"><div className="card-head"><h2 className="eyebrow">{t('Every envelope')}<InfoBadge text="Assign budgets to different categories of spending. This does not take money out of your 'safe to spend'—it just tracks where it's going." /></h2><span className="card-meta">{t('your kinds of spending')}</span></div>{envelopes.length === 0 ? <div className="empty-state"><strong>{t('No envelopes yet')}</strong><span>{t('Create a simple home for the spending you want to notice.')}</span></div> : envelopes.map((item) => <div className="list-row" key={item.id}><span><span className="list-label">{item.name}</span><span className="list-detail">{money(Math.max(0, item.budget - item.spent))} left of {money(item.budget)}</span></span><span><span className="list-value">{money(item.budget)}</span><button className="text-button" onClick={() => onRemove(item.id)}>{t('Remove')}</button></span></div>)}<button className="btn btn-primary" onClick={onAdd}><Plus size={14} />{t('Add an envelope')}</button></section><section className="card section-wide"><h2 className="eyebrow">{t('The rule')}</h2><p className="long-copy">{emptyMode ? 'Everything you log can be assigned later. You do not need to decide the perfect categories today.' : 'Tap a kind to move it to the other side. The envelopes are only here to help the money feel less abstract.'}</p></section></div>;
}


export function Milestones({ bills, spends, goals, emptyMode, startingBalance, onHelp }: { bills: Bill[]; spends: Spend[]; goals: Goal[]; emptyMode: boolean; startingBalance: number; onHelp: () => void }) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  // Compute dynamic milestone logic
  const allBillsPaid = bills.length > 0 && bills.every(b => b.paid);
  
  // A day without spending: checking if there's any gap in days or simply if we have past dates with 0 logged?
  // A simple heuristic for now: If we have been active for > 1 day and spends today is 0? 
  // Let's check if the number of unique dates in spends is less than days since the month started.
  const todayDate = new Date();
  const daysInMonthSoFar = todayDate.getDate();
  const uniqueSpendDates = new Set(spends.map(s => s.date)).size;
  const aDayWithoutSpending = uniqueSpendDates < daysInMonthSoFar && daysInMonthSoFar > 1;
  
  const aGoalReached = goals.some(g => g.saved >= g.target && g.target > 0);
  
  const done = emptyMode ? [false, false, false, false] : [
    allBillsPaid,
    aDayWithoutSpending,
    allBillsPaid, // 'A month with every bill ticked off' is effectively the same for our simple model
    aGoalReached
  ];

  const items = ['Every bill covered before payday', 'A day without spending', 'A month with every bill ticked off', 'A goal reached in full'];
  const reachedCount = done.filter(Boolean).length;
  const spent = spends.reduce((sum, s) => sum + s.amount, 0);
  const safe = Math.max(0, startingBalance - spent);

  return <div className="screen-body"><section className="card list-card section-wide"><div className="card-head"><h2 className="eyebrow">{t('Every milestone')}<InfoBadge text="Automatic achievements you unlock by managing your budget, paying bills, and hitting goals." /></h2><span className="card-meta">{reachedCount} of 4 reached</span></div>{items.map((item, i) => <button className="milestone-row" key={item}><span className={`milestone-dot ${done[i] ? 'done' : ''}`}>{done[i] && <Check size={11} />}</span><span><b>{item}</b><small>{done[i] ? 'done' : 'not yet'}</small></span><ChevronRight size={15} /></button>)}<p className="empty-note">{t('read straight out of the file — once true, they stay true.')}</p></section><section className="card section-wide"><div className="card-head"><h2 className="eyebrow">September</h2><span className="card-meta">10 days to payday</span></div><div className="milestone-quote">{money(emptyMode ? 0 : safe)} still yours</div><p className="register-sub">{t('saved on this device')}</p></section></div>;
}


export function Settings({
  startingBalance,
  mode,
  setStartingBalance,
  onExample,
  onEmpty,
}: {
  startingBalance: number;
  mode: Mode;
  setStartingBalance: (value: number) => void;
  onExample: () => void;
  onEmpty: () => void;
}) {
  const [balance, setBalance] = useState(String(startingBalance));
  useEffect(() => setBalance(String(startingBalance)), [startingBalance]);
  const { language, setLanguage, t } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  
  return <div className="screen-body"><section className="card section-wide settings-block"><div className="card-head"><h2 className="eyebrow">{t('Make it yours')}</h2><span className="card-meta">{mode === 'empty' ? t('empty file') : t('saved on this device')}</span></div><div className="settings-row"><div><div className="settings-label">{t('Language')}</div><div className="settings-copy">{t('Choose your language')}</div></div><select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="pt">Português</option><option value="zh">中文</option><option value="hi">हिन्दी</option><option value="ar">العربية</option></select></div><div className="settings-row"><div><div className="settings-label">{t('Currency')}</div><div className="settings-copy">{t('Choose your currency')}</div></div><select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="$">$ (USD)</option><option value="€">€ (EUR)</option><option value="£">£ (GBP)</option><option value="Rs">Rs (PKR/INR)</option></select></div><div className="settings-row"><div><div className="settings-label">{t('Starting balance')}</div><div className="settings-copy">{t('The money you have to work with right now.')}</div></div><input value={balance} onChange={(e) => setBalance(e.target.value)} onBlur={() => setStartingBalance(Math.max(0, Number(balance) || 0))} inputMode="decimal" aria-label={t('Starting balance')} /></div><div className="settings-row"><div><div className="settings-label">{t('What to call the big number')}</div><div className="settings-copy">{t('Safe to spend today')}</div></div><select defaultValue="safe"><option value="safe">{t('Safe to spend today')}</option><option value="left">{t('Left for today')}</option></select></div><div className="settings-row"><div><div className="settings-label">{t('Appearance')}</div><div className="settings-copy">{t('Light')}</div></div><button className="btn btn-ghost" onClick={() => document.documentElement.classList.toggle('dark')}>{t('Toggle contrast')}</button></div></section><section className="card section-wide"><div className="card-head"><h2 className="eyebrow">{t('Your data')}</h2><span className="card-meta">{t('local to this device')}</span></div><p className="long-copy">{t('Use the example while you learn, or start from zero whenever you are ready. Your choice stays here after a refresh.')}</p><div className="action-row"><button className="btn btn-ghost" onClick={onExample}>{t('Restore the example')}</button><button className="btn btn-primary" onClick={onEmpty}>{t('Start over from zero')}</button></div></section></div>;
}


export function Help({ onExample, onEmpty }: { onExample: () => void; onEmpty: () => void }) {
  const { t } = useTranslation();
  return <div className="screen-body"><section className="card section-wide"><div className="card-head"><h2 className="eyebrow">{t('How this planner works')}</h2><span className="card-meta">{t('plain words')}</span></div><div className="help-list"><details open><summary>Pick a screen. Read only that.</summary><p>Today is for the one thing you need now. Planner shows the month. Bills, Money in, Goals, Debt, Envelopes and Milestones keep the rest somewhere calm.</p></details><details><summary>Use it on your phone and computer</summary><p>Your saved numbers stay on this device while it opens. Nothing here needs an account.</p></details><details><summary>Start with an example or start blank</summary><p>The example is made up. Empty file means every balance, bill, goal and category starts at zero.</p></details><details><summary>Keyboard shortcuts</summary><p>Press Ctrl or Command plus K for quick actions. Press Escape to close a dialog.</p></details></div></section><section className="card section-wide"><h2 className="eyebrow">{t('Choose your starting point')}</h2><div className="action-row"><button className="btn btn-ghost" onClick={onExample}>{t('Keep the example')}</button><button className="btn btn-primary" onClick={onEmpty}>{t('Start with an empty file')}</button></div></section></div>;


}

