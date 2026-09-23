import React, { useState, useMemo, useEffect } from "react";
import { Plus, X, Target, MoreHorizontal } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./lib/db";
import { Screen, Mode, Spend, Goal, Bill, Income, Debt, Envelope, exampleGoals, exampleBills, exampleIncome, exampleEnvelopes, screens, readStorage, MonthCode, MONTHS, MONTH_FULL_NAMES, PaletteId } from "./types";
import { InfoBadge, IconButton, SeedBanner, SpendPanel, GoalMini, Sidebar, Topbar, RightNow, AddModal, CommandBar } from "./components/Shared";
import { Today, Month, Bills, Goals, Income as IncomeScreen, Debt as DebtScreen, Envelopes as EnvelopesScreen, Milestones, Settings, Help } from "./components/Screens";
import { useTranslation } from "./lib/i18n";
import { useCurrency } from "./lib/currency";
import { liveSync } from "./lib/peerSync";

export default function PlannerApp() {
  const { t } = useTranslation();
  const { currency, money, shortMoney } = useCurrency();
  const [active, setActive] = useState<Screen>('today');
  const [currentMonth, setCurrentMonth] = useState<MonthCode>('SEP');
  const [command, setCommand] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddEnvelope, setShowAddEnvelope] = useState(false);
  const [milestoneFilter, setMilestoneFilter] = useState<'all' | 'reached' | 'not_yet'>('all');
  const [plannerTitle, setPlannerTitleState] = useState(() => {
    const val = readStorage('budget-planner-title', 'ADHD Planner');
    return val === '' ? 'ADHD Planner' : val;
  });
  const [userName, setUserNameState] = useState(() => readStorage('budget-user-name', 'Alex'));
  const [featureVisibility, setFeatureVisibilityState] = useState<'simple' | 'everything'>(() => readStorage('budget-feature-visibility', 'everything'));
  const [helpOn, setHelpOn] = useState(() => readStorage('budget-help-visible', true));
  const [modalType, setModalType] = useState<'bill' | 'income' | 'debt' | 'envelope' | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mode, setMode] = useState<Mode>(() => readStorage('budget-mode', 'example'));
  const [showBanner, setShowBanner] = useState(() => readStorage('budget-banner-visible', true));
  const [completed, setCompleted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'contrast'>(() => {
    return (localStorage.getItem('budget-theme') as 'light' | 'dark' | 'contrast') || 'light';
  });
  const [palette, setPaletteState] = useState<PaletteId>(() => {
    return (localStorage.getItem('budget-palette') as PaletteId) || 'sage';
  });
  const [startingBalance, setStartingBalanceState] = useState(() => readStorage('budget-starting-balance', 1319));
  const rawSpends = useLiveQuery(() => db.spends.toArray());
  const spendsLoading = rawSpends === undefined;
  const spends = rawSpends || [];
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
    document.documentElement.classList.remove('dark', 'contrast');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    if (theme === 'contrast') document.documentElement.classList.add('contrast');
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('budget-theme', theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('budget-palette', palette);
  }, [palette]);
  useEffect(() => {
    document.title = plannerTitle || 'ADHD Planner';
  }, [plannerTitle]);

  // Live Sync across paired devices
  useEffect(() => {
    liveSync.init();
    const handleRemoteUpdate = (evt: any) => {
      const p = evt?.detail;
      const bal = readStorage('budget-starting-balance', 1319);
      setStartingBalanceState(bal);
      const m = readStorage('budget-mode', 'custom');
      setMode(m);
      const bv = readStorage('budget-banner-visible', false);
      setShowBanner(bv);
      const pal = (localStorage.getItem('budget-palette') as PaletteId) || 'sage';
      setPaletteState(pal);
      const th = (localStorage.getItem('budget-theme') as any) || 'light';
      setTheme(th);
      const tit = localStorage.getItem('budget-planner-title') || 'ADHD Planner';
      setPlannerTitleState(tit);
      const un = localStorage.getItem('budget-user-name') || 'Alex';
      setUserNameState(un);
    };
    window.addEventListener('steady_data_updated', handleRemoteUpdate);
    return () => window.removeEventListener('steady_data_updated', handleRemoteUpdate);
  }, []);

  // Broadcast local changes to paired device automatically
  useEffect(() => {
    liveSync.queueBroadcast();
  }, [spends, goals, bills, income, debts, envelopes, startingBalance, plannerTitle, palette, theme]);

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
    localStorage.removeItem('budget-logged-today');
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
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem('budget-logged-today', todayStr);
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
  const addSpend = (data: Omit<Spend, 'id'>) => {
    db.spends.add(data as any);
    setShowBanner(false);
    const todayStr = new Date().toISOString().split('T')[0];
    if (data.date === todayStr) {
      localStorage.setItem('budget-logged-today', todayStr);
    }
  };
  const payDebt = async (id: number, amount: number) => {
    const item = debts.find((d) => d.id === id);
    if (!item) return;
    const newAmount = Math.max(0, item.amount - amount);
    await db.debts.update(id, { amount: newAmount });
    setMode('custom');
  };
  const spendEnvelope = async (id: number, amount: number) => {
    const item = envelopes.find((e) => e.id === id);
    if (!item) return;
    const newSpent = Math.max(0, (item.spent || 0) + amount);
    await db.envelopes.update(id, { spent: newSpent });
    setMode('custom');
  };
  const totalSpent = useMemo(() => spends.reduce((sum, item) => sum + item.amount, 0), [spends]);

  const content = active === 'today'
    ? <Today spends={spends as Spend[]} goals={goals as Goal[]} bills={bills as Bill[]} income={income as Income[]} startingBalance={startingBalance} emptyMode={emptyMode} loading={spendsLoading} onAdd={addSpend} onLog={() => setLogOpen(true)} onDeleteSpend={(id) => db.spends.delete(id)} completed={completed} setCompleted={setCompleted} onHelp={() => setHelpOn(true)} />
    : active === 'month'
      ? <Month key={currentMonth} month={currentMonth} onSelectMonth={setCurrentMonth} onLog={() => setLogOpen(true)} onAdd={addSpend} spends={spends as Spend[]} bills={bills as Bill[]} income={income as Income[]} startingBalance={startingBalance} emptyMode={emptyMode} onHelp={() => setHelpOn(true)} />
      : active === 'mustpays'
        ? <Bills
          bills={bills as Bill[]}
          emptyMode={emptyMode}
          showAddBill={showAddBill}
          onOpenAddBill={() => setShowAddBill(true)}
          onCloseAddBill={() => setShowAddBill(false)}
          onAddBill={() => setShowAddBill(true)}
          onToggle={(id) => db.bills.update(id, { paid: !bills.find(b => b.id === id)?.paid })}
          onDeleteBill={(id) => db.bills.delete(id)}
          onHelp={() => setHelpOn(true)}
          onAddBillDirect={(data) => {
            db.bills.add(data as any);
            setMode('custom');
            setShowAddBill(false);
          }}
        />
        : active === 'income'
          ? <IncomeScreen
            income={income as Income[]}
            emptyMode={emptyMode}
            showAddIncome={showAddIncome}
            onOpenAddIncome={() => setShowAddIncome(true)}
            onCloseAddIncome={() => setShowAddIncome(false)}
            onAdd={(data) => {
              db.income.add(data as any);
              setMode('custom');
              setShowAddIncome(false);
            }}
            onUpdate={(id, data) => {
              db.income.update(id, data as any);
              setMode('custom');
              setShowAddIncome(false);
            }}
            onRemove={(id) => db.income.delete(id)}
          />
          : active === 'goals'
            ? <Goals
              goals={goals as Goal[]}
              emptyMode={emptyMode}
              showAddGoal={showAddGoal}
              onOpenAddGoal={() => setShowAddGoal(true)}
              onCloseAddGoal={() => setShowAddGoal(false)}
              onAddGoal={(data) => {
                db.goals.add(data as any);
                setMode('custom');
                setShowAddGoal(false);
              }}
              onUpdateGoal={(id, data) => {
                db.goals.update(id, data as any);
                setMode('custom');
                setShowAddGoal(false);
              }}
              onContribute={(id, amount) => {
                const item = goals.find((g) => g.id === id);
                if (item) {
                  db.goals.update(id, { saved: item.saved + amount });
                  setMode('custom');
                }
              }}
              onDeleteGoal={(id) => db.goals.delete(id)}
              onHelp={() => setHelpOn(true)}
            />
            : active === 'debt'
              ? <DebtScreen
                debts={debts as Debt[]}
                emptyMode={emptyMode}
                showAddDebt={showAddDebt}
                onOpenAddDebt={() => setShowAddDebt(true)}
                onCloseAddDebt={() => setShowAddDebt(false)}
                onAdd={(data) => {
                  db.debts.add(data as any);
                  setShowAddDebt(false);
                }}
                onUpdate={(id, data) => {
                  db.debts.update(id, data as any);
                  setShowAddDebt(false);
                }}
                onRemove={(id) => db.debts.delete(id)}
                onPay={payDebt}
              />
              : active === 'envelopes'
                ? <EnvelopesScreen
                  envelopes={envelopes as Envelope[]}
                  emptyMode={emptyMode}
                  showAddEnvelope={showAddEnvelope}
                  onOpenAddEnvelope={() => setShowAddEnvelope(true)}
                  onCloseAddEnvelope={() => setShowAddEnvelope(false)}
                  onAdd={(data) => {
                    db.envelopes.add(data as any);
                    setShowAddEnvelope(false);
                  }}
                  onUpdate={(id, data) => {
                    db.envelopes.update(id, data as any);
                    setShowAddEnvelope(false);
                  }}
                  onRemove={(id) => db.envelopes.delete(id)}
                  onSpend={spendEnvelope}
                />
                : active === 'milestones'
                  ? <Milestones
                    bills={bills as Bill[]}
                    spends={spends as Spend[]}
                    goals={goals as Goal[]}
                    income={income as Income[]}
                    debts={debts as Debt[]}
                    envelopes={envelopes as Envelope[]}
                    emptyMode={emptyMode}
                    startingBalance={startingBalance}
                    onHelp={() => setHelpOn(true)}
                    filter={milestoneFilter}
                    onFilterChange={setMilestoneFilter}
                  />
                  : active === 'settings'
                    ? <Settings
                      startingBalance={startingBalance}
                      mode={mode}
                      theme={theme}
                      palette={palette}
                      setStartingBalance={setStartingBalanceState}
                      setTheme={setTheme}
                      setPalette={setPaletteState}
                      onExample={restoreExample}
                      onEmpty={startEmpty}
                      spends={spends as Spend[]}
                      bills={bills as Bill[]}
                      goals={goals as Goal[]}
                      debts={debts as Debt[]}
                      envelopes={envelopes as Envelope[]}
                      income={income as Income[]}
                      onUpdateSettings={(newSettings) => {
                        if (newSettings.plannerTitle) setPlannerTitleState(newSettings.plannerTitle);
                        if (newSettings.userName) setUserNameState(newSettings.userName);
                        if (newSettings.featureVisibility) setFeatureVisibilityState(newSettings.featureVisibility);
                        if (newSettings.palette) setPaletteState(newSettings.palette);
                      }}
                    />
                    : <Help onExample={restoreExample} onEmpty={startEmpty} />;

  const modalSubmit = (name: string, amount: number, extra = 0) => {
    if (modalType === 'bill') db.bills.add({ name, amount, due: 'New date', paid: false } as any);
    if (modalType === 'income') {
      const todayFormatted = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      db.income.add({ source: name, amount, date: todayFormatted, status: 'arrived' } as any);
    }
    if (modalType === 'debt') db.debts.add({ name, amount, minimum: extra } as any);
    if (modalType === 'envelope') db.envelopes.add({ name, budget: amount, spent: 0 } as any);
    setMode('custom');
    setModalType(null);
  };

  return (
    <>
      <div className="app">
        {showBanner && mode === 'example' && <SeedBanner onEmpty={startEmpty} onKeep={() => setShowBanner(false)} onExisting={() => { setShowBanner(false); setActive('settings'); }} />}
        <Sidebar
          active={active}
          setActive={setActive}
          spends={spends}
          goals={goals}
          onAdd={addSpend}
          plannerTitle={plannerTitle}
          userName={userName}
          featureVisibility={featureVisibility}
        />
        <main className="main">
          <Topbar
            screen={active}
            month={currentMonth}
            incomeCount={income.length}
            latestIncomeDate={income.length ? income[income.length - 1]?.date : undefined}
            goalsCount={goals.length}
            debtsCount={debts.length}
            envelopesCount={envelopes.length}
            milestoneFilter={milestoneFilter}
            onMilestoneFilterChange={setMilestoneFilter}
            onCommand={() => setCommand(true)}
            onLog={() => {
              if (active === 'mustpays') {
                setShowAddBill((prev) => !prev);
              } else if (active === 'income') {
                setShowAddIncome((prev) => !prev);
              } else if (active === 'goals') {
                setShowAddGoal((prev) => !prev);
              } else if (active === 'debt') {
                setShowAddDebt((prev) => !prev);
              } else if (active === 'envelopes') {
                setShowAddEnvelope((prev) => !prev);
              } else {
                setLogOpen(true);
              }
            }}
            onHelp={() => setActive('help')}
            onSettings={() => setActive('settings')}
          />
          {active === 'today' && helpOn && <div className="help-tip"><p><b>Help is on.</b> Tap any <span className="help-badge">?</span> to see what a section does. Turn it off with the purple <span className="help-badge">?</span> at the top when you are done.</p><button className="btn btn-ghost" onClick={() => { setHelpOn(false); localStorage.setItem('budget-help-visible', 'false'); }}>Got it</button></div>}
          {content}
        </main>
        <aside className="month-rail" aria-label="Month navigator">
          <div className="month-rail-header">
            <span className="month-rail-year">2026</span>
          </div>
          <div className="month-rail-list">
            {MONTHS.map((m, idx) => {
              const isCurrentRealMonth = new Date().getMonth() === idx;
              const isSelected = m === currentMonth;
              return (
                <button
                  key={m}
                  className={`month-tab ${isSelected ? 'active' : ''} ${isCurrentRealMonth ? 'is-today-month' : ''}`}
                  onClick={() => {
                    setCurrentMonth(m);
                    setActive('month');
                  }}
                  title={`Open ${MONTH_FULL_NAMES[m]} 2026 planner`}
                >
                  <span className="month-tab-text">{m}</span>
                  {isCurrentRealMonth && !isSelected && <span className="month-real-dot" title="Current month" />}
                </button>
              );
            })}
          </div>
        </aside>
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