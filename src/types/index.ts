import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import {
  ArrowDownToLine,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Flag,
  Gauge,
  Keyboard,
  ListChecks,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Settings2,
  Target,
  Wallet,
  X,
} from 'lucide-react';

export type Screen =
  | 'today'
  | 'month'
  | 'mustpays'
  | 'income'
  | 'goals'
  | 'debt'
  | 'envelopes'
  | 'milestones'
  | 'settings'
  | 'help';
export type Mode = 'example' | 'empty' | 'custom';
export type Spend = { id: number; amount: number; category: string; note: string; date: string };
export type Goal = { id: number; name: string; saved: number; target: number; monthly: number };
export type Bill = { id: number; name: string; amount: number; due: string; paid: boolean };
export type Income = { id: number; source: string; amount: number; date: string };
export type Debt = { id: number; name: string; amount: number; minimum: number };
export type Envelope = { id: number; name: string; budget: number; spent: number };
export type LucideIcon = typeof Gauge;

export const screens: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', icon: Gauge },
  { id: 'month', label: 'Planner', icon: CalendarDays },
  { id: 'mustpays', label: 'Bills', icon: ListChecks },
  { id: 'income', label: 'Money in', icon: ArrowDownToLine },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'debt', label: 'Debt', icon: ChevronRight },
  { id: 'envelopes', label: 'Envelopes', icon: Wallet },
  { id: 'milestones', label: 'Milestones', icon: Flag },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export const exampleGoals: Goal[] = [
  { id: 1, name: 'Japan, next spring', saved: 1205, target: 3000, monthly: 85 },
  { id: 2, name: 'Just-in-case fund', saved: 780, target: 1000, monthly: 50 },
];
export const exampleBills: Bill[] = [
  { id: 1, name: 'Rent', amount: 780, due: 'Thu 1 Oct', paid: false },
  { id: 2, name: 'Phone', amount: 29, due: 'Sun 4 Oct', paid: false },
  { id: 3, name: 'Internet', amount: 65, due: 'Sun 18 Oct', paid: false },
];
export const exampleIncome: Income[] = [{ id: 1, source: 'Alex — pay', amount: 6200, date: 'Thu 10 Sep' }];
export const exampleEnvelopes: Envelope[] = [
  { id: 1, name: 'Living & food', budget: 400, spent: 0 },
  { id: 2, name: 'Fun & friends', budget: 120, spent: 0 },
  { id: 3, name: 'Transit', budget: 80, spent: 0 },
];

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : (JSON.parse(stored) as T);
  } catch {
    return fallback;
  }
}

export function money(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortMoney(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
