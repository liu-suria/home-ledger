import { getStore } from "@edgeone/pages-blob";
const STORE = "home-ledger-data", KEY = "ledger/data.json";
export const emptyData = () => ({ version: 1, updatedAt: null, settings: { siteName: "HomeLedger", moduleOrder: ["subscriptions", "warranties", "reminders"] }, subscriptions: [], warranties: [], reminders: [] });
export async function readData() { const value = await getStore(STORE).get(KEY, { type: "json", consistency: "strong" }); const initial = emptyData(); return value && typeof value === "object" && !Array.isArray(value) ? { ...initial, ...value, settings: { ...initial.settings, ...(value.settings || {}) }, subscriptions: Array.isArray(value.subscriptions) ? value.subscriptions : [], warranties: Array.isArray(value.warranties) ? value.warranties : [], reminders: Array.isArray(value.reminders) ? value.reminders : [] } : initial; }
export async function saveData(value) { await getStore(STORE).setJSON(KEY, value); }
