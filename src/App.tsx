import PlannerApp from './PlannerApp';
import { CurrencyProvider } from './lib/currency';
import { I18nProvider } from './lib/i18n';

export default function App() {
  return (
    <CurrencyProvider>
      <I18nProvider>
        <PlannerApp />
      </I18nProvider>
    </CurrencyProvider>
  );
}