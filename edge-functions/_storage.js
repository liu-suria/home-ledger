import { getStore } from "@edgeone/pages-blob";

const STORE = "home-ledger-data";
const KEY = "ledger/data.json";
const DEFAULT_TYPES = [
  { id: "reminder", name: "其他事项" },
  { id: "baby", name: "宝宝事项" },
  { id: "subscription", name: "订阅续费" },
  { id: "maintenance", name: "家庭维护" },
  { id: "document", name: "证件到期" },
  { id: "warranty", name: "保修到期" },
  { id: "vehicle", name: "车辆事项" }
];

export const emptyData = () => ({
  version: 6,
  updatedAt: null,
  settings: { siteName: "Family Hub", types: DEFAULT_TYPES },
  events: []
});

export async function readData() {
  const value = await getStore(STORE).get(KEY, { type: "json", consistency: "strong" });
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.events)) return emptyData();
  return {
    version: 6,
    updatedAt: value.updatedAt || null,
    settings: {
      siteName: String(value.settings?.siteName || "Family Hub").slice(0, 30),
      types: Array.isArray(value.settings?.types) && value.settings.types.length ? value.settings.types : DEFAULT_TYPES
    },
    events: value.events
  };
}

export async function saveData(value) {
  await getStore(STORE).setJSON(KEY, value);
}
