import re
import os

with open(r'C:\Users\Muneer\Desktop\Projects\etsy\steady\src\PlannerApp.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract types and shared things
types_regex = re.compile(r"(import .*?from 'react';\nimport \{ useLiveQuery \}.*?from 'lucide-react';\n\ntype Screen =.*?type LucideIcon = typeof Gauge;\n\nconst screens: .*?\];\n\nconst exampleGoals.*?\];\n\nfunction readStorage.*?\}\n\nfunction money.*?\}\n\nfunction shortMoney.*?\}\n)", re.DOTALL)

types_match = types_regex.search(content)
types_code = types_match.group(1) if types_match else ""

def extract_function(name):
    regex = re.compile(rf"function {name}\(.*?\)\s*{{.*?\n}}\n", re.DOTALL)
    match = regex.search(content)
    return match.group(0) if match else ""

screens_to_extract = ['Today', 'Month', 'Bills', 'Goals', 'Income', 'Debt', 'Envelopes', 'Milestones', 'Settings', 'Help']
components_to_extract = ['InfoBadge', 'IconButton', 'SeedBanner', 'SpendPanel', 'GoalMini', 'Sidebar', 'Topbar', 'RightNow', 'AddModal', 'CommandBar']

os.makedirs(r'C:\Users\Muneer\Desktop\Projects\etsy\steady\src\screens', exist_ok=True)
os.makedirs(r'C:\Users\Muneer\Desktop\Projects\etsy\steady\src\components', exist_ok=True)
os.makedirs(r'C:\Users\Muneer\Desktop\Projects\etsy\steady\src\types', exist_ok=True)

with open(r'C:\Users\Muneer\Desktop\Projects\etsy\steady\src\types\index.ts', 'w', encoding='utf-8') as f:
    f.write(types_code.replace("type Screen =", "export type Screen =").replace("type Mode =", "export type Mode =").replace("type Spend =", "export type Spend =").replace("type Goal =", "export type Goal =").replace("type Bill =", "export type Bill =").replace("type Income =", "export type Income =").replace("type Debt =", "export type Debt =").replace("type Envelope =", "export type Envelope =").replace("type LucideIcon =", "export type LucideIcon =").replace("const screens", "export const screens").replace("const exampleGoals", "export const exampleGoals").replace("const exampleBills", "export const exampleBills").replace("const exampleIncome", "export const exampleIncome").replace("const exampleEnvelopes", "export const exampleEnvelopes").replace("function readStorage", "export function readStorage").replace("function money", "export function money").replace("function shortMoney", "export function shortMoney"))

# For now, just extract them to a single shared file to avoid massive import hell
shared_code = 'import React, { useState, useMemo, useEffect } from "react";\nimport { ArrowDownToLine, CalendarDays, Check, ChevronRight, CircleHelp, Flag, Gauge, Keyboard, ListChecks, MoreHorizontal, Plus, RotateCcw, Settings2, Target, Wallet, X } from "lucide-react";\nimport { Screen, Mode, Spend, Goal, Bill, Income, Debt, Envelope, money, shortMoney, exampleGoals, exampleBills, exampleIncome, exampleEnvelopes, screens } from "../types";\n\n'
for c in components_to_extract:
    shared_code += extract_function(c).replace(f"function {c}", f"export function {c}") + "\n\n"

with open(r'C:\Users\Muneer\Desktop\Projects\etsy\steady\src\components\Shared.tsx', 'w', encoding='utf-8') as f:
    f.write(shared_code)

screens_code = 'import React, { useState, useMemo, useEffect } from "react";\nimport { ArrowDownToLine, CalendarDays, Check, ChevronRight, CircleHelp, Flag, Gauge, Keyboard, ListChecks, MoreHorizontal, Plus, RotateCcw, Settings2, Target, Wallet, X } from "lucide-react";\nimport { db } from "../lib/db";\nimport { Screen, Mode, Spend, Goal, Bill, Income, Debt, Envelope, money, shortMoney, exampleGoals, exampleBills, exampleIncome, exampleEnvelopes, screens } from "../types";\nimport { InfoBadge, IconButton, SeedBanner, SpendPanel, GoalMini, Sidebar, Topbar, RightNow, AddModal, CommandBar } from "./Shared";\n\n'
for s in screens_to_extract:
    screens_code += extract_function(s).replace(f"function {s}", f"export function {s}") + "\n\n"

with open(r'C:\Users\Muneer\Desktop\Projects\etsy\steady\src\components\Screens.tsx', 'w', encoding='utf-8') as f:
    f.write(screens_code)

print("Done extracting!")
