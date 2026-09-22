import React, { createContext, useContext, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

type CurrencyContextType = {
  currency: string;
  setCurrency: (c: string) => void;
  money: (value: number) => string;
  shortMoney: (value: number) => string;
};

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const profile = useLiveQuery(() => db.profile.toCollection().first());
  
  const currency = profile?.currency || '$';

  const setCurrency = (newCurrency: string) => {
    if (profile?.id) {
      db.profile.update(profile.id, { currency: newCurrency });
    }
  };

  const money = (value: number) => {
    return `${currency}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const shortMoney = (value: number) => {
    return `${currency}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
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
