import re

with open(r'C:\Users\Muneer\Desktop\Projects\etsy\steady\src\PlannerApp.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract PlannerApp function
planner_regex = re.compile(r"(export default function PlannerApp\(\) \{.*\n\})", re.DOTALL)
match = planner_regex.search(content)
planner_code = match.group(1) if match else ""

new_content = """import React, { useState, useMemo, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./lib/db";
import { Screen, Mode, Spend, Goal, Bill, Income, Debt, Envelope, money, shortMoney, exampleGoals, exampleBills, exampleIncome, exampleEnvelopes, screens, readStorage } from "./types";
import { InfoBadge, IconButton, SeedBanner, SpendPanel, GoalMini, Sidebar, Topbar, RightNow, AddModal, CommandBar } from "./components/Shared";
import { Today, Month, Bills, Goals, Income as IncomeScreen, Debt as DebtScreen, Envelopes as EnvelopesScreen, Milestones, Settings, Help } from "./components/Screens";

""" + planner_code.replace("<Income ", "<IncomeScreen ").replace("<Debt ", "<DebtScreen ").replace("<Envelopes ", "<EnvelopesScreen ")

with open(r'C:\Users\Muneer\Desktop\Projects\etsy\steady\src\PlannerApp.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done updating PlannerApp.tsx!")
