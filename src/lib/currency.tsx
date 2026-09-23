import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureProfile } from './db';

type CurrencyContextType = {
  currency: string;
  setCurrency: (c: string) => void;
  currencyPosition: 'left' | 'right';
  setCurrencyPosition: (p: 'left' | 'right') => void;
  centsFormat: '.00' | ',00' | 'none';
  setCentsFormat: (f: '.00' | ',00' | 'none') => void;
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

  const [currencyPosition, setCurrencyPositionState] = useState<'left' | 'right'>(() => {
    try {
      return (localStorage.getItem('steady_currency_position') as 'left' | 'right') || 'left';
    } catch {
      return 'left';
    }
  });

  const [centsFormat, setCentsFormatState] = useState<'.00' | ',00' | 'none'>(() => {
    try {
      return (localStorage.getItem('steady_cents_format') as '.00' | ',00' | 'none') || '.00';
    } catch {
      return '.00';
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

  // Listen to remote sync updates
  useEffect(() => {
    const onRemoteData = (e: any) => {
      const p = e.detail;
      if (p?.currency && p.currency !== currency) {
        setCurrencyState(p.currency);
      }
      if (p?.currencyPosition) {
        setCurrencyPositionState(p.currencyPosition);
      }
      if (p?.centsFormat) {
        setCentsFormatState(p.centsFormat);
      }
    };
    window.addEventListener('steady_data_updated', onRemoteData);
    return () => window.removeEventListener('steady_data_updated', onRemoteData);
  }, [currency]);

  const setCurrency = async (newCurrency: string) => {
    setCurrencyState(newCurrency);
    try {
      localStorage.setItem('steady_currency', newCurrency);
      localStorage.setItem('budget-currency', newCurrency);
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('steady_broadcast_local_change'));
    }
  };

  const setCurrencyPosition = (pos: 'left' | 'right') => {
    setCurrencyPositionState(pos);
    try {
      localStorage.setItem('steady_currency_position', pos);
      localStorage.setItem('budget-currency-position', pos);
    } catch (e) {
      console.error(e);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('steady_broadcast_local_change'));
    }
  };

  const setCentsFormat = (fmt: '.00' | ',00' | 'none') => {
    setCentsFormatState(fmt);
    try {
      localStorage.setItem('steady_cents_format', fmt);
      localStorage.setItem('budget-cents-format', fmt);
    } catch (e) {
      console.error(e);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('steady_broadcast_local_change'));
    }
  };

  const formatSign = (curr: string) => {
    return curr.length > 1 ? `${curr} ` : curr;
  };

  const money = (value: number) => {
    const val = typeof value === 'number' && !isNaN(value) ? value : 0;
    const decimals = centsFormat === 'none' ? 0 : 2;
    let formatted = val.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    if (centsFormat === ',00' && decimals > 0) {
      // replace last dot with comma
      const lastDot = formatted.lastIndexOf('.');
      if (lastDot !== -1) {
        formatted = formatted.substring(0, lastDot) + ',' + formatted.substring(lastDot + 1);
      }
    }

    if (currencyPosition === 'right') {
      return `${formatted} ${currency}`;
    }
    return `${formatSign(currency)}${formatted}`;
  };

  const shortMoney = (value: number) => {
    const val = typeof value === 'number' && !isNaN(value) ? value : 0;
    const formatted = val.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (currencyPosition === 'right') {
      return `${formatted} ${currency}`;
    }
    return `${formatSign(currency)}${formatted}`;
  };

  return (
    <CurrencyContext.Provider value={{
      currency,
      setCurrency,
      currencyPosition,
      setCurrencyPosition,
      centsFormat,
      setCentsFormat,
      money,
      shortMoney,
    }}>
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

