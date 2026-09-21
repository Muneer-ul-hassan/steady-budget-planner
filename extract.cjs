const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(process.cwd(), 'src/PlannerApp.tsx'), 'utf-8');

function extractFunction(name) {
  const regex = new RegExp(`function ${name}\\([\\s\\S]*?\\n}\\n`, 'g');
  const match = regex.exec(content);
  if (match) {
    return match[0];
  }
  return null;
}

const comps = ['Today', 'RightNow', 'Topbar', 'Sidebar', 'SpendPanel', 'GoalMini', 'SeedBanner', 'InfoBadge', 'IconButton'];

let res = `import { useState, useMemo, useEffect, type ReactNode, type FormEvent } from 'react';
import { ArrowDownToLine, CalendarDays, Check, ChevronRight, CircleHelp, Flag, Gauge, Keyboard, ListChecks, MoreHorizontal, Plus, RotateCcw, Settings2, Target, Wallet, X } from 'lucide-react';

${content.match(/type Spend = .*?;/g).join('\n')}
${content.match(/type Goal = .*?;/g).join('\n')}
${content.match(/type Screen = [\s\S]*?;/g).join('\n')}
${content.match(/function money\([\s\S]*?\n}/g).join('\n\n')}
${content.match(/function shortMoney\([\s\S]*?\n}/g).join('\n\n')}

`;

for (const c of comps) {
  const code = extractFunction(c);
  if (code) {
    res += code + '\n\n';
  }
}

fs.writeFileSync(path.join(process.cwd(), 'src/screens/TodayExtracted.tsx'), res);
console.log("Extracted Today to src/screens/TodayExtracted.tsx");
