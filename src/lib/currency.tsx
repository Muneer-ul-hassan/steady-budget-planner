import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureProfile } from './db';

type CurrencyContextType = {
  currency: string;
  setCurrency: (c: string) => void;
  money: (value: number) => string;
  shortMoney: (value: number) => string;
};

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(() => {
    try {
      return localStorage.getItem('steady_currency') || '$';
    } catch {
      return '$';
    }
  });

  const profile = useLiveQuery(() => db.profile.toCollection().first());

  useEffect(() => {
    ensureProfile();
  }, []);

  useEffect(() => {
    if (profile?.currency && profile.currency !== currency) {
      setCurrencyState(profile.currency);
      try {
        localStorage.setItem('steady_currency', profile.currency);
      } catch (e) {
        console.error(e);
      }
    }
  }, [profile?.currency]);

  const setCurrency = async (newCurrency: string) => {
    setCurrencyState(newCurrency);
    try {
      localStorage.setItem('steady_currency', newCurrency);
    } catch (e) {
      console.error(e);
    }

    try {
      const all = await db.profile.toArray();
      if (all.length > 0) {
        await db.profile.update(all[0].id, { currency: newCurrency });
      } else {
        await db.profile.add({
          name: 'User',
          title: 'My calm money plan',
          currency: newCurrency,
          language: 'en',
          bigLabel: 'Safe to spend today',
          theme: 'soft-spectrum',
          alreadySetAside: 0
        });
      }
    } catch (err) {
      console.error('Failed to update currency in db', err);
    }
  };

  const formatPrefix = (curr: string) => {
    return curr.length > 1 ? `${curr} ` : curr;
  };

  const money = (value: number) => {
    const val = typeof value === 'number' && !isNaN(value) ? value : 0;
    return `${formatPrefix(currency)}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const shortMoney = (value: number) => {
    const val = typeof value === 'number' && !isNaN(value) ? value : 0;
    return `${formatPrefix(currency)}${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, money, shortMoney }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

