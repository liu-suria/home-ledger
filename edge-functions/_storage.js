import { getStore } from "@edgeone/pages-blob";

const STORE = "home-ledger-data";
const KEY = "ledger/data.json";

export const emptyData = () => ({
  version: 5,
  updatedAt: null,
  settings: { siteName: "Family Hub" },
  events: []
});

export async function readData() {
  const value = await getStore(STORE).get(KEY, { type: "json", consistency: "strong" });
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.events)) {
    return emptyData();
  }
  return {
    version: 5,
    updatedAt: value.updatedAt || null,
    settings: { siteName: String(value.settings?.siteName || "Family Hub").slice(0, 30) },
    events: value.events
  };
}

export async function saveData(value) {
  await getStore(STORE).setJSON(KEY, value);
}
