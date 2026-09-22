// Multi-device and cross-tab synchronization engine for Steady Planner
import { db } from './db';
import { AppSettings, PlannerProfile } from '../types';

export interface SyncPayload {
  version: number;
  timestamp: number;
  plannerId: string;
  plannerTitle: string;
  userName: string;
  startingBalance: number;
  theme?: string;
  currency?: string;
  currencyPosition?: 'left' | 'right';
  centsFormat?: '.00' | ',00' | 'none';
  kinds?: string[];
  spends: any[];
  bills: any[];
  goals: any[];
  debts: any[];
  envelopes: any[];
  income: any[];
}

export interface SyncSession {
  code: string; // e.g. "039 763"
  cleanCode: string; // "039763"
  checkNumber: string; // e.g. "482"
  expiresAt: number; // timestamp
  status: 'waiting' | 'detected' | 'connected' | 'expired';
  detectedFrom?: string;
  payload?: SyncPayload;
}

const CHANNEL_NAME = 'steady_device_sync_channel';
const SESSION_STORAGE_KEY = 'steady_sync_active_session';
const RECOVERY_KEY_STORAGE = 'budget-recovery-key';
const PLANNERS_STORAGE_KEY = 'budget-planners-list';
const ACTIVE_PLANNER_KEY = 'budget-active-planner-id';

// Generate 6-digit spaced code (e.g. "039 763")
export function generateSyncCode(): { display: string; clean: string } {
  const num = Math.floor(100000 + Math.random() * 900000);
  const str = String(num);
  return {
    display: `${str.slice(0, 3)} ${str.slice(3, 6)}`,
    clean: str,
  };
}

// Generate 3-digit check number (e.g. "482")
export function generateCheckNumber(): string {
  return String(Math.floor(100 + Math.random() * 900));
}

// Generate 20-character recovery key in 4 groups of 5: e.g. "X8K2-9PLA-47BN-M92Q"
export function generateRecoveryKey(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let group = 0; group < 4; group++) {
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (group < 3) result += '-';
  }
  return result;
}

export function getOrCreateRecoveryKey(): string {
  let key = localStorage.getItem(RECOVERY_KEY_STORAGE);
  if (!key) {
    key = generateRecoveryKey();
    localStorage.setItem(RECOVERY_KEY_STORAGE, key);
  }
  return key;
}

// Collect entire planner database and settings snapshot
export async function createPlannerSnapshot(): Promise<SyncPayload> {
  const [spends, bills, goals, debts, envelopes, income] = await Promise.all([
    db.spends.toArray(),
    db.bills.toArray(),
    db.goals.toArray(),
    db.debts.toArray(),
    db.envelopes.toArray(),
    db.income.toArray(),
  ]);

  const startingBalance = Number(localStorage.getItem('budget-starting-balance') || '1319');
  const plannerTitle = localStorage.getItem('budget-planner-title') || 'ADHD Planner';
  const userName = localStorage.getItem('budget-user-name') || 'Alex';
  const theme = localStorage.getItem('budget-theme') || 'light';
  const palette = localStorage.getItem('budget-palette') || 'sage';
  const currency = localStorage.getItem('budget-currency') || '$';
  const currencyPosition = (localStorage.getItem('budget-currency-position') as 'left' | 'right') || 'left';
  const centsFormat = (localStorage.getItem('budget-cents-format') as '.00' | ',00' | 'none') || '.00';
  const kinds = JSON.parse(localStorage.getItem('budget-kinds-list') || '["Coffee","Food","Groceries","Gas","Transit","Fun","Other"]');
  const activePlannerId = localStorage.getItem(ACTIVE_PLANNER_KEY) || 'default';

  return {
    version: 1,
    timestamp: Date.now(),
    plannerId: activePlannerId,
    plannerTitle,
    userName,
    startingBalance,
    theme,
    palette,
    currency,
    currencyPosition,
    centsFormat,
    kinds,
    spends,
    bills,
    goals,
    debts,
    envelopes,
    income,
  };
}

// Restore planner snapshot into Dexie and localStorage
export async function applyPlannerSnapshot(payload: SyncPayload): Promise<void> {
  if (!payload) return;

  await Promise.all([
    db.spends.clear(),
    db.bills.clear(),
    db.goals.clear(),
    db.debts.clear(),
    db.envelopes.clear(),
    db.income.clear(),
  ]);

  if (payload.spends && payload.spends.length > 0) await db.spends.bulkAdd(payload.spends);
  if (payload.bills && payload.bills.length > 0) await db.bills.bulkAdd(payload.bills);
  if (payload.goals && payload.goals.length > 0) await db.goals.bulkAdd(payload.goals);
  if (payload.debts && payload.debts.length > 0) await db.debts.bulkAdd(payload.debts);
  if (payload.envelopes && payload.envelopes.length > 0) await db.envelopes.bulkAdd(payload.envelopes);
  if (payload.income && payload.income.length > 0) await db.income.bulkAdd(payload.income);

  if (payload.startingBalance !== undefined) {
    localStorage.setItem('budget-starting-balance', JSON.stringify(payload.startingBalance));
  }
  if (payload.plannerTitle) {
    localStorage.setItem('budget-planner-title', payload.plannerTitle);
  }
  if (payload.userName) {
    localStorage.setItem('budget-user-name', payload.userName);
  }
  if (payload.theme) {
    localStorage.setItem('budget-theme', payload.theme);
    document.documentElement.classList.remove('dark', 'contrast');
    if (payload.theme === 'dark') document.documentElement.classList.add('dark');
    if (payload.theme === 'contrast') document.documentElement.classList.add('contrast');
    document.documentElement.setAttribute('data-theme', payload.theme);
  }
  if (payload.palette) {
    localStorage.setItem('budget-palette', payload.palette);
    document.documentElement.setAttribute('data-palette', payload.palette);
  }
  if (payload.currency) {
    localStorage.setItem('budget-currency', payload.currency);
  }
  if (payload.currencyPosition) {
    localStorage.setItem('budget-currency-position', payload.currencyPosition);
  }
  if (payload.centsFormat) {
    localStorage.setItem('budget-cents-format', payload.centsFormat);
  }
  if (payload.kinds) {
    localStorage.setItem('budget-kinds-list', JSON.stringify(payload.kinds));
  }
  localStorage.setItem('budget-last-sync-time', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
}

// Multi-Planner Profile Management (up to 4 planners)
export function getPlannerProfiles(): PlannerProfile[] {
  try {
    const raw = localStorage.getItem(PLANNERS_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {
    console.error(e);
  }
  const currentTitle = localStorage.getItem('budget-planner-title') || 'ADHD Planner';
  const defaultProfile: PlannerProfile = {
    id: 'default',
    name: currentTitle,
    description: 'active file',
    createdAt: new Date().toISOString(),
    isActive: true,
  };
  localStorage.setItem(PLANNERS_STORAGE_KEY, JSON.stringify([defaultProfile]));
  localStorage.setItem(ACTIVE_PLANNER_KEY, 'default');
  return [defaultProfile];
}

export async function switchPlannerProfile(targetId: string): Promise<void> {
  const profiles = getPlannerProfiles();
  const currentActive = profiles.find((p) => p.isActive) || profiles[0];
  if (currentActive.id === targetId) return;

  // 1. Save current state to current planner snapshot
  const currentSnapshot = await createPlannerSnapshot();
  localStorage.setItem(`steady_planner_snapshot_${currentActive.id}`, JSON.stringify(currentSnapshot));

  // 2. Load target planner snapshot
  const targetRaw = localStorage.getItem(`steady_planner_snapshot_${targetId}`);
  if (targetRaw) {
    try {
      const targetSnapshot = JSON.parse(targetRaw) as SyncPayload;
      await applyPlannerSnapshot(targetSnapshot);
    } catch (e) {
      console.error(e);
    }
  } else {
    // Fresh blank slate for new planner
    await Promise.all([
      db.spends.clear(),
      db.bills.clear(),
      db.goals.clear(),
      db.debts.clear(),
      db.envelopes.clear(),
      db.income.clear(),
    ]);
    const targetProfile = profiles.find((p) => p.id === targetId);
    if (targetProfile) {
      localStorage.setItem('budget-planner-title', targetProfile.name);
    }
    localStorage.setItem('budget-starting-balance', '0');
  }

  // 3. Mark target profile active
  const updatedProfiles = profiles.map((p) => ({
    ...p,
    isActive: p.id === targetId,
  }));
  localStorage.setItem(PLANNERS_STORAGE_KEY, JSON.stringify(updatedProfiles));
  localStorage.setItem(ACTIVE_PLANNER_KEY, targetId);
}

export async function addPlannerProfile(name: string, copyCurrent = false): Promise<PlannerProfile[]> {
  const profiles = getPlannerProfiles();
  if (profiles.length >= 4) {
    throw new Error('Maximum of 4 planners reached.');
  }

  const newId = `planner-${Date.now()}`;
  if (copyCurrent) {
    const currentSnapshot = await createPlannerSnapshot();
    currentSnapshot.plannerId = newId;
    currentSnapshot.plannerTitle = name;
    localStorage.setItem(`steady_planner_snapshot_${newId}`, JSON.stringify(currentSnapshot));
  }

  const newProfile: PlannerProfile = {
    id: newId,
    name: name.trim() || `Planner ${profiles.length + 1}`,
    description: 'isolated file',
    createdAt: new Date().toISOString(),
    isActive: false,
  };

  const updated = [...profiles, newProfile];
  localStorage.setItem(PLANNERS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deletePlannerProfile(id: string): PlannerProfile[] {
  const profiles = getPlannerProfiles();
  if (profiles.length <= 1) return profiles;
  const filtered = profiles.filter((p) => p.id !== id);
  localStorage.removeItem(`steady_planner_snapshot_${id}`);
  localStorage.setItem(PLANNERS_STORAGE_KEY, JSON.stringify(filtered));
  return filtered;
}

// Broadcast Channel Manager
class SyncEngine {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(event: any) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (evt) => {
          this.notify(evt.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported or restricted, falling back to storage events');
      }

      window.addEventListener('storage', (e) => {
        if (e.key === 'steady_sync_relay_event' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this.notify(data);
          } catch (err) {
            console.error(err);
          }
        }
      });
    }
  }

  public subscribe(cb: (event: any) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(data: any) {
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error(err);
      }
    });
  }

  public broadcast(type: string, payload: any) {
    const event = { type, payload, timestamp: Date.now(), sender: 'steady_tab' };
    if (this.channel) {
      this.channel.postMessage(event);
    }
    try {
      localStorage.setItem('steady_sync_relay_event', JSON.stringify(event));
    } catch (e) {
      // Storage might be full or disabled
    }
  }
}

export const syncEngine = new SyncEngine();
