import React, { useState, useMemo, useEffect } from "react";
import { Plus, X, Target, MoreHorizontal } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./lib/db";
import { Screen, Mode, Spend, Goal, Bill, Income, Debt, Envelope, money, shortMoney, exampleGoals, exampleBills, exampleIncome, exampleEnvelopes, screens, readStorage } from "./types";
import { InfoBadge, IconButton, SeedBanner, SpendPanel, GoalMini, Sidebar, Topbar, RightNow, AddModal, CommandBar } from "./components/Shared";
import { Today, Month, Bills, Goals, Income as IncomeScreen, Debt as DebtScreen, Envelopes as EnvelopesScreen, Milestones, Settings, Help } from "./components/Screens";

export default function PlannerApp() {
  const [active, setActive] = useState<Screen>('today');
  const [focus, setFocus] = useState(false);
  const [command, setCommand] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [helpOn, setHelpOn] = useState(() => readStorage('budget-help-visible', true));
  const [modalType, setModalType] = useState<'bill' | 'income' | 'debt' | 'envelope' | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mode, setMode] = useState<Mode>(() => readStorage('budget-mode', 'example'));
  const [showBanner, setShowBanner] = useState(() => readStorage('budget-banner-visible', true));
  const [completed, setCompleted] = useState(false);
  const [startingBalance, setStartingBalanceState] = useState(() => readStorage('budget-starting-balance', 1319));
  const spends = useLiveQuery(() => db.spends.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];
  const bills = useLiveQuery(() => db.bills.toArray()) || [];
  const income = useLiveQuery(() => db.income.toArray()) || [];
  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const envelopes = useLiveQuery(() => db.envelopes.toArray()) || [];
  const emptyMode = mode === 'empty';

  useEffect(() => { localStorage.setItem('budget-mode', mode); }, [mode]);
  useEffect(() => { localStorage.setItem('budget-banner-visible', JSON.stringify(showBanner)); }, [showBanner]);
  useEffect(() => { localStorage.setItem('budget-starting-balance', JSON.stringify(startingBalance)); }, [startingBalance]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCommand(true); }
      if (e.key === 'Escape') { setCommand(false); setLogOpen(false); setModalType(null); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  const startEmpty = async () => {
    setMode('empty');
    setShowBanner(false);
    setStartingBalanceState(0);
    await Promise.all([
      db.spends.clear(),
      db.goals.clear(),
      db.bills.clear(),
      db.income.clear(),
      db.debts.clear(),
      db.envelopes.clear()
    ]);
    setActive('today');
  };
  
  const restoreExample = async () => {
    setMode('example');
    setShowBanner(false);
    setStartingBalanceState(1319);
    await Promise.all([
      db.spends.clear(),
      db.debts.clear(),
      db.goals.clear().then(() => db.goals.bulkAdd(exampleGoals as any[])),
      db.bills.clear().then(() => db.bills.bulkAdd(exampleBills as any[])),
      db.income.clear().then(() => db.income.bulkAdd(exampleIncome as any[])),
      db.envelopes.clear().then(() => db.envelopes.bulkAdd(exampleEnvelopes as any[]))
    ]);
    setActive('today');
  };
  const setStartingBalance = (value: number) => {
    setStartingBalanceState(value);
    setMode(value === 0 ? 'empty' : 'custom');
  };
  const addSpend = (data: Omit<Spend, 'id'>) => { db.spends.add(data as any); };
  const totalSpent = useMemo(() => spends.reduce((sum, item) => sum + item.amount, 0), [spends]);

  const content = active === 'today'
    ? <Today spends={spends as Spend[]} goals={goals as Goal[]} bills={bills as Bill[]} income={income as Income[]} startingBalance={startingBalance} emptyMode={emptyMode} onAdd={addSpend} onLog={() => setLogOpen(true)} onDeleteSpend={(id) => db.spends.delete(id)} completed={completed} setCompleted={setCompleted} onHelp={() => setHelpOn(true)} />
    : active === 'month'
      ? <Month spends={spends as Spend[]} bills={bills as Bill[]} income={income as Income[]} startingBalance={startingBalance} emptyMode={emptyMode} onHelp={() => setHelpOn(true)} />
      : active === 'mustpays'
        ? <Bills bills={bills as Bill[]} emptyMode={emptyMode} onAddBill={() => setModalType('bill')} onToggle={(id) => db.bills.update(id, { paid: !bills.find(b => b.id === id)?.paid })} onDeleteBill={(id) => db.bills.delete(id)} onHelp={() => setHelpOn(true)} />
        : active === 'income'
          ? <IncomeScreen income={income as Income[]} emptyMode={emptyMode} onAdd={() => setModalType('income')} onRemove={(id) => db.income.delete(id)} />
          : active === 'goals'
            ? <Goals goals={goals as Goal[]} setGoals={async (g) => { await db.goals.clear(); await db.goals.bulkAdd(g as any[]); }} emptyMode={emptyMode} onHelp={() => setHelpOn(true)} />
            : active === 'debt'
              ? <DebtScreen debts={debts as Debt[]} emptyMode={emptyMode} onAdd={() => setModalType('debt')} onRemove={(id) => db.debts.delete(id)} />
              : active === 'envelopes'
                ? <EnvelopesScreen envelopes={envelopes as Envelope[]} emptyMode={emptyMode} onAdd={() => setModalType('envelope')} onRemove={(id) => db.envelopes.delete(id)} />
                : active === 'milestones'
                  ? <Milestones bills={bills as Bill[]} spends={spends as Spend[]} goals={goals as Goal[]} emptyMode={emptyMode} onHelp={() => setHelpOn(true)} startingBalance={startingBalance} />
                  : active === 'settings'
                    ? <Settings startingBalance={startingBalance} mode={mode} setStartingBalance={setStartingBalance} onExample={restoreExample} onEmpty={startEmpty} />
                    : <Help onExample={restoreExample} onEmpty={startEmpty} />;

  const modalSubmit = (name: string, amount: number, extra = 0) => {
    if (modalType === 'bill') db.bills.add({ name, amount, due: 'New date', paid: false } as any);
    if (modalType === 'income') db.income.add({ source: name, amount, date: 'Thu 1 Oct' } as any);
    if (modalType === 'debt') db.debts.add({ name, amount, minimum: extra } as any);
    if (modalType === 'envelope') db.envelopes.add({ name, budget: amount, spent: 0 } as any);
    setMode('custom');
    setModalType(null);
  };

  return (
    <>
      {showBanner && mode === 'example' && <SeedBanner onEmpty={startEmpty} onKeep={() => setShowBanner(false)} onExisting={() => { setShowBanner(false); setActive('settings'); }} />}
      <div className={`app ${focus ? 'focus-mode' : ''}`}>
        <Sidebar active={active} setActive={setActive} spends={spends} goals={goals} onAdd={addSpend} />
        <main className="main">
          <Topbar
            screen={active}
            focus={focus}
            setFocus={setFocus}
            onCommand={() => setCommand(true)}
            onLog={() => setLogOpen(true)}
            onHelp={() => setActive('help')}
            onSettings={() => setActive('settings')}
          />
          {active === 'today' && helpOn && <div className="help-tip"><p><b>Help is on.</b> Tap any <span className="help-badge">?</span> to see what a section does. Turn it off with the purple <span className="help-badge">?</span> at the top when you are done.</p><button className="btn btn-ghost" onClick={() => { setHelpOn(false); localStorage.setItem('budget-help-visible', 'false'); }}>Got it</button></div>}
          {content}
        </main>
        <aside className="month-rail">{['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((month) => <button key={month} className={`month-tab ${month === 'SEP' ? 'active' : ''}`} onClick={() => setActive('month')}>{month}</button>)}</aside>
      </div>
      <button className="fab" onClick={() => setLogOpen(true)}><Plus size={15} />Log a spend</button>
      
      <nav className="mobile-nav">
        {screens.slice(0, 4).map(({ id, label, icon: NavIcon }) => (
          <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}><NavIcon />{label}</button>
        ))}
        <button onClick={() => setMobileMenu(true)}><MoreHorizontal />Menu</button>
      </nav>

      {mobileMenu && (
        <div className="modal-scrim" onClick={() => setMobileMenu(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Menu</h2>
              <IconButton label="Close" onClick={() => setMobileMenu(false)}><X /></IconButton>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '16px 0' }}>
              {screens.map(({ id, label, icon: NavIcon }) => (
                <button
                  key={id}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', color: active === id ? 'var(--purple)' : 'var(--text-h)', fontWeight: active === id ? 'bold' : 'normal' }}
                  onClick={() => { setActive(id); setMobileMenu(false); }}
                >
                  <NavIcon size={24} />
                  <span style={{ fontSize: 11 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {logOpen && <div className="modal-scrim" onClick={() => setLogOpen(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><h2>Log a spend</h2><IconButton label="Close" onClick={() => setLogOpen(false)}><X /></IconButton></div><SpendPanel spends={spends} onAdd={(s) => { addSpend(s); setLogOpen(false); }} /></div></div>}
      {modalType && <AddModal type={modalType} onClose={() => setModalType(null)} onSubmit={modalSubmit} />}
      {command && <CommandBar onClose={() => setCommand(false)} setScreen={setActive} onSpend={(amount, category) => addSpend({ amount, category, note: '', date: '2026-09-21' })} />}
      {totalSpent > 0 && <span className="sr-only" aria-live="polite">{money(totalSpent)} logged</span>}
    </>
  );
}