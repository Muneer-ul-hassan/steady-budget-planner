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
export type Goal = { id: number; name: string; saved: number; target: number; monthly: number; color?: string };
export type Bill = { id: number; name: string; amount: number; due: string; paid: boolean };
export type Income = { id: number; source: string; amount: number; date: string; status?: 'arrived' | 'expected' };
export type Debt = {
  id: number;
  name: string;
  amount: number;
  minimum: number;
  isCreditCard?: boolean;
  rate?: number;
  frequency?: string;
  dueDay?: number;
};
export type Envelope = {
  id: number;
  name: string;
  budget: number;
  spent: number;
  category?: string;
  color?: string;
  colorName?: string;
};

export type MilestoneStatus = 'reached' | 'not_yet' | 'not_counted';

export interface MilestoneItem {
  id: string;
  title: string;
  subtitle: string;
  circleLabel: string;
  status: MilestoneStatus;
  category?: 'spending' | 'bills' | 'savings' | 'debt' | 'envelopes' | 'habit';
  detail?: string;
}

export type LucideIcon = typeof Gauge;

export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
export type MonthCode = (typeof MONTHS)[number];

export const MONTH_FULL_NAMES: Record<string, string> = {
  JAN: 'January',
  FEB: 'February',
  MAR: 'March',
  APR: 'April',
  MAY: 'May',
  JUN: 'June',
  JUL: 'July',
  AUG: 'August',
  SEP: 'September',
  OCT: 'October',
  NOV: 'November',
  DEC: 'December',
};

export const MONTH_INDEX: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

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
    if (stored === null) return fallback;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return stored as unknown as T;
    }
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

export type PaletteId = 'sage' | 'nordic' | 'terracotta' | 'plum';

export interface PaletteOption {
  id: PaletteId;
  name: string;
  tag: string;
  isDefault?: boolean;
  accent: string;
  background: string;
  cards: string;
  text: string;
  description: string;
}

export const PALETTES: PaletteOption[] = [
  {
    id: 'sage',
    name: 'Sage & Linen',
    tag: 'Nature / Earthy Calm · Etsy Favorite',
    isDefault: true,
    accent: '#4A7C59',
    background: '#F4F6F0',
    cards: '#FAFBF8',
    text: '#222E25',
    description: 'Muted Forest Green on Pale Linen Oat paper. Grounded, organic, and peaceful.',
  },
  {
    id: 'nordic',
    name: 'Nordic Slate & Teal',
    tag: 'Clean / Minimalist Studio',
    accent: '#3B7A8C',
    background: '#F0F4F5',
    cards: '#FAFCFC',
    text: '#1F2D33',
    description: 'Deep Seafoam Teal over Cool Mist. Clean, architectural, and distraction-free.',
  },
  {
    id: 'terracotta',
    name: 'Warm Terracotta & Sand',
    tag: 'Warm / Cozy Paper',
    accent: '#B86B52',
    background: '#F8F4EE',
    cards: '#FDFBF7',
    text: '#342A27',
    description: 'Muted Warm Terracotta on Warm Sand. Soft like aged journal paper.',
  },
  {
    id: 'plum',
    name: 'Plum & Cashmere',
    tag: 'Heather Plum / Soft Mist',
    accent: '#5B507A',
    background: '#F5F3F7',
    cards: '#FCFBFD',
    text: '#2B2533',
    description: 'Deep Heather Plum on Cashmere Mist. Gentle, elegant, and calm.',
  },
];

export interface AppSettings {
  userName: string;
  plannerTitle: string;
  currencySymbol: string;
  currencyPosition: 'left' | 'right';
  centsFormat: '.00' | ',00' | 'none';
  categories: string[];
  payFrequency: 'once_a_month' | 'more_than_once';
  payDayDescription: string;
  nextPayDate: string;
  splitBillsHalf: boolean;
  featureVisibility: 'simple' | 'everything';
  bigNumberTitle: 'safe' | 'remaining' | 'left';
  showTodayBalance: 'off' | 'show';
  autoBackupEnabled: boolean;
  recoveryLockEnabled: boolean;
  palette?: PaletteId;
}

export const defaultSettings: AppSettings = {
  userName: 'Alex',
  plannerTitle: 'ADHD Planner',
  currencySymbol: '$',
  currencyPosition: 'left',
  centsFormat: '.00',
  categories: ['Coffee', 'Food', 'Groceries', 'Gas', 'Transit', 'Fun', 'Other'],
  payFrequency: 'once_a_month',
  payDayDescription: '20th of the month',
  nextPayDate: '2026-10-20',
  splitBillsHalf: false,
  featureVisibility: 'everything',
  bigNumberTitle: 'safe',
  showTodayBalance: 'off',
  autoBackupEnabled: true,
  recoveryLockEnabled: false,
  palette: 'sage',
};

export interface PlannerProfile {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isActive: boolean;
}

export interface SyncSession {
  code: string;
  cleanCode: string;
  checkNumber: string;
  expiresAt: number;
  status: 'waiting' | 'detected' | 'connected' | 'expired';
}

