import React, { useState, useMemo, useEffect } from "react";
import { ArrowDownToLine, CalendarDays, Check, ChevronRight, CircleHelp, Flag, Gauge, Keyboard, ListChecks, MoreHorizontal, Plus, RotateCcw, Settings2, Target, Wallet, X } from "lucide-react";
import { Screen, Mode, Spend, Goal, Bill, Income, Debt, Envelope, exampleGoals, exampleBills, exampleIncome, exampleEnvelopes, screens } from "../types";
import { useTranslation } from "../lib/i18n";
import { useCurrency } from "../lib/currency";

export function InfoBadge({ text }: { text?: string }) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button className="help-badge" onClick={() => setOpen(!open)} aria-label="More information">
        ?
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, width: 220, padding: '10px 12px', background: '#251b31', color: 'white', borderRadius: 8, fontSize: 13, zIndex: 50, lineHeight: 1.4, fontWeight: 'normal', textAlign: 'left', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            {t(text)}
            <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #251b31' }} />
          </div>
        </>
      )}
    </span>
  );
}


export function IconButton({
  label,
  onClick,
  children,
  className = '',
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      className={className}
      onClick={onClick}
      aria-label={label}
      data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`}
    >
      {children}
    </button>
  );
}


export function SeedBanner({
  onEmpty,
  onKeep,
  onExisting,
}: {
  onEmpty: () => void;
  onKeep: () => void;
  onExisting: () => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  return (
    <div className="seed-banner">
      <Plus size={14} />
      <span className="seed-copy">
        <strong>Try the example first</strong>
        These numbers are made up, so you can safely explore the rent, goals and balance.
      </span>
      <div className="seed-actions">
        <button className="btn btn-primary" onClick={onKeep}>
          Keep exploring the example
        </button>
        <button className="btn btn-ghost" onClick={onEmpty}>{t('Start with an empty file')}</button>
        <button className="btn btn-ghost seed-return" onClick={onExisting}>
          I already have a planner⌄
        </button>
      </div>
      <button className="seed-close" onClick={onKeep} aria-label="Keep looking at the example">
        ×
      </button>
    </div>
  );
}


export function SpendPanel({
  spends,
  onAdd,
}: {
  spends: Spend[];
  onAdd: (s: Omit<Spend, 'id'>) => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  const [amount, setAmount] = useState('');
  
  // Dynamic categories
  const defaultCategories = [
    ['Coffee', 'chip-pink'],
    ['Food', 'chip-peach'],
    ['Groceries', 'chip-green'],
    ['Gas', 'chip-sky'],
  ];
  
  const [categories, setCategories] = useState<string[][]>(() => {
    try {
      const stored = window.localStorage.getItem('budget-categories');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return defaultCategories;
  });
  
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  
  const [category, setCategory] = useState(categories[0][0]);
  const [note, setNote] = useState('');
  
  // Format date to YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const total = Number.parseFloat(amount || '0');
  const add = (n: number) =>
    setAmount((Number.parseFloat(amount || '0') + n).toFixed(2));
  const submit = () => {
    if (total <= 0) return;
    onAdd({ amount: total, category, note, date });
    setAmount('');
    setNote('');
  };
  
  const addCategory = () => {
    if (newCatName.trim()) {
      const tones = ['chip-pink', 'chip-peach', 'chip-green', 'chip-sky', 'chip-stone'];
      const randomTone = tones[categories.length % tones.length];
      const next = [...categories, [newCatName.trim(), randomTone]];
      setCategories(next);
      window.localStorage.setItem('budget-categories', JSON.stringify(next));
      setNewCatName('');
    }
  };
  
  const removeCategory = (idx: number) => {
    const next = categories.filter((_, i) => i !== idx);
    setCategories(next);
    window.localStorage.setItem('budget-categories', JSON.stringify(next));
    if (category === categories[idx][0] && next.length > 0) {
      setCategory(next[0][0]);
    }
  };
  
  return (
    <section className="side-spend" aria-labelledby="log-h">
      <div className="panel-head">
        <h3 className="card-title" id="log-h">
          Log a spend
        </h3>
        <span className="card-meta">{spends.length} logged today</span>
      </div>
      <div className="spend-total num">{money(total)}</div>
      <p className="spend-hint">type the exact amount or use the quick keys</p>
      <div className="field">
        <label htmlFor="log-exact">Exact amount</label>
        <input
          id="log-exact"
          className="input num"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
        />
      </div>
      <div className="key-row">
        {[1, 5, 10, 20].map((n) => (
          <button className="key num" onClick={() => add(n)} key={n}>
            +${n}
          </button>
        ))}
        <button className="key key-reset" onClick={() => setAmount('')} aria-label="Clear the amount">
          <RotateCcw size={13} />
        </button>
      </div>
      
      {isEditingCategories ? (
        <div style={{ marginTop: 12, padding: 8, background: 'var(--sub)', borderRadius: 8 }}>
          <div style={{ marginBottom: 8, display: 'flex', gap: 4 }}>
            <input className="input" style={{ flex: 1 }} value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New category..." />
            <button className="btn btn-primary" style={{ padding: '0 8px' }} onClick={addCategory}>Add</button>
          </div>
          <div className="chips" style={{ flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {categories.map(([label, tone], i) => (
              <span key={i} className={`chip ${tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {label}
                <button className="text-button" style={{ opacity: 0.5, padding: 0 }} onClick={() => removeCategory(i)}>×</button>
              </span>
            ))}
          </div>
          <button className="btn btn-ghost btn-block" onClick={() => setIsEditingCategories(false)}>Done</button>
        </div>
      ) : (
        <>
          <div className="chips" style={{ marginTop: 9 }}>
            {categories.map(([label, tone]) => (
              <button
                className={`chip ${tone} ${category === label ? 'selected' : ''}`}
                onClick={() => setCategory(label)}
                key={label}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="side-link" onClick={() => setIsEditingCategories(true)}>
            Edit these buttons
          </button>
        </>
      )}
      <div className="chips">
        <button className="chip selected" onClick={() => setCategory('Checking')}>
          Checking
        </button>
      </div>
      <div className="field">
        <label htmlFor="log-date">Which day</label>
        <input id="log-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="log-note">
          Note <span>optional</span>
        </label>
        <input
          id="log-note"
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="coffee with Sam, train home…"
        />
      </div>
      <button className="btn btn-primary btn-block" onClick={submit} disabled={total <= 0}>
        Add to today
      </button>
      <button className="btn btn-ghost btn-block" onClick={() => setAmount('')}>
        Close
      </button>
      <p className="spend-hint">quick when you want it, exact when you need it</p>
    </section>
  );
}


export function GoalMini({ goal }: { goal: Goal }) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  const pct = goal.target ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
  return (
    <div className="goal">
      <div className="goal-row">
        <span className="goal-name">{goal.name}</span>
        <span className="goal-val num">
          {shortMoney(goal.saved)} / {shortMoney(goal.target)}
        </span>
      </div>
      <div className="track">
        <div className="track-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="goal-note">
        <span>{shortMoney(Math.max(0, goal.target - goal.saved))} to go</span>
        <span className="num">{shortMoney(goal.monthly)} / month</span>
      </p>
    </div>
  );
}


export function Sidebar({
  active,
  setActive,
  spends,
  goals,
  onAdd,
}: {
  active: Screen;
  setActive: (s: Screen) => void;
  spends: Spend[];
  goals: Goal[];
  onAdd: (s: Omit<Spend, 'id'>) => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  return (
    <aside className="sidebar" aria-label="Tools and goals">
      <div className="brand">
        <span className="brand-mark">B</span>
        <span className="brand-name">
          Budget and
          <br />{t('Planner')}</span>
      </div>
      <nav className="nav" aria-label="Screens">
        {screens.map(({ id, label, icon: NavIcon }) => (
          <button
            key={id}
            className={`nav-item ${active === id ? 'active' : ''}`}
            onClick={() => setActive(id)}
          >
            <NavIcon size={15} />
            {label}
          </button>
        ))}
        <button className={`nav-item ${active === 'help' ? 'active' : ''}`} onClick={() => setActive('help')}>
          <MoreHorizontal size={15} />{t('Help')}</button>
      </nav>
      <SpendPanel spends={spends} onAdd={onAdd} />
      <section className="goals-side">
        <div className="panel-head">
          <h3 className="eyebrow">Saving up for</h3>
          <span className="card-meta">{goals.length} goals</span>
        </div>
        {goals.length ? goals.slice(0, 2).map((goal) => <GoalMini goal={goal} key={goal.id} />) : <p className="empty-note">No goals yet.</p>}
      </section>
      <div className="user">
        <span className="user-avatar" />
        <span>
          <span className="user-name">Your planner</span>
          <span className="user-plan">Budget and Planner</span>
          <span className="card-meta">lifetime licence · no account</span>
        </span>
      </div>
    </aside>
  );
}


export function Topbar({
  screen,
  focus,
  setFocus,
  onCommand,
  onLog,
  onHelp,
  onSettings,
}: {
  screen: Screen;
  focus: boolean;
  setFocus: (v: boolean) => void;
  onCommand: () => void;
  onLog: () => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  const titleMap: Record<Screen, string> = {
    today: 'Good afternoon',
    month: 'September 2026',
    mustpays: 'Bills & rent',
    income: 'Your money',
    goals: 'Your goals',
    debt: 'Paying it down',
    envelopes: 'Envelopes',
    milestones: 'Milestones',
    settings: 'Settings',
    help: 'How this planner works',
  };
  const eyebrowMap: Record<Screen, string> = {
    today: 'MONDAY, 21 SEPTEMBER',
    month: 'The month',
    mustpays: 'Every bill you owe',
    income: 'Everything that came in',
    goals: 'What you are saving for',
    debt: 'Paying it down',
    envelopes: 'What each kind of spending gets',
    milestones: 'Things that already happened',
    settings: 'Make it yours',
    help: 'How this planner works',
  };
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrowMap[screen]}</p>
        <h1 className="screen-title">{titleMap[screen]}</h1>
        <p className="screen-sub">{screen === 'today' ? 'Budget and Planner' : screen === 'month' ? 'in progress · 10 days to payday' : ''}</p>
      </div>
      <div className="topbar-actions">
        <button className="btn btn-ghost command-launch" onClick={onCommand} aria-label="Quick actions — Ctrl K">
          <Keyboard size={14} />
          <span>Quick actions</span>
          <span className="kbd">Ctrl K</span>
        </button>
        <button className="help-toggle" onClick={onSettings} aria-label="Settings">
          <Settings2 size={16} />
        </button>
        <button className="help-toggle" onClick={onHelp} aria-label="Toggle help">
          <CircleHelp size={16} />
          <span className="help-toggle-label">{t('Help')}</span>
        </button>
        <button className={`focus-toggle ${focus ? 'focus-on' : ''}`} onClick={() => setFocus(!focus)}>
          <span className="focus-knob" />
          <span>Focus mode</span>
        </button>
        <button className="btn btn-primary" onClick={onLog}>
          Log a spend
        </button>
      </div>
    </header>
  );
}


export function RightNow({ onDone }: { onDone: () => void }) {
  return (
    <section className="rightnow">
      <span className="rn-step num">1</span>
      <div className="rn-body">
        <p className="eyebrow eyebrow--light">Right now · one thing only</p>
        <p className="rn-task">Log anything you spent today</p>
      </div>
      <CircleHelp size={15} />
      <span className="rn-cost">30 sec</span>
      <button className="btn rn-go" onClick={onDone}>
        Done — next
      </button>
    </section>
  );
}


export function AddModal({ type, onClose, onSubmit }: { type: 'bill' | 'income' | 'debt' | 'envelope'; onClose: () => void; onSubmit: (name: string, amount: number, extra?: number) => void }) {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [extra, setExtra] = useState('');
  const title = { bill: 'Add a bill', income: 'Put down money in', debt: 'Add a debt', envelope: 'Add an envelope' }[type];
  const nameLabel = { bill: 'What is the bill?', income: 'Where did it come from?', debt: 'What is it called?', envelope: 'What kind of spending?' }[type];
  const submit = () => {
    if (name.trim() && Number(amount) > 0) onSubmit(name.trim(), Number(amount), Number(extra) || 0);
  };
  return <div className="modal-scrim" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><IconButton label="Close" onClick={onClose}><X /></IconButton></div><div className="modal-form"><label>{nameLabel}<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'income' ? 'Salary' : 'Rent'} /></label><label>How much?<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" /></label>{type === 'debt' && <label>{t('Minimum payment')}<input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0.00" inputMode="decimal" /></label>}</div><div className="modal-actions"><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={submit}>Add it</button></div></div></div>;
}


export function CommandBar({ onClose, setScreen, onSpend }: { onClose: () => void; setScreen: (s: Screen) => void; onSpend: (amount: number, category: string) => void }) {
  const [q, setQ] = useState('');
  const filtered = screens.filter((s) => s.label.toLowerCase().includes(q.toLowerCase()));
  const parse = () => {
    const match = q.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      onSpend(Number(match[1]), match[2] || 'Other');
      onClose();
    }
  };
  return <div className="modal-scrim" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><h2>Go to a screen</h2><p className="command-help">Start typing a screen name, or type an amount and category — <span className="num">250 groceries</span>.</p></div><IconButton label="Close" onClick={onClose}><X /></IconButton></div><input autoFocus className="command-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const match = q.match(/^\d/); if (match) parse(); else if (filtered[0]) { setScreen(filtered[0].id); onClose(); } } }} placeholder="a screen name — or 250 groceries" /><div className="command-results">{filtered.map((s) => <button className="command-result" key={s.id} onClick={() => { setScreen(s.id); onClose(); }}><span>{s.label}</span><ChevronRight size={14} /></button>)}</div></div></div>;
}


