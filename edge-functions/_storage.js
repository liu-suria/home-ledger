import { getStore } from "@edgeone/pages-blob";

const STORE_NAME = "home-ledger-data";
const DATA_KEY = "ledger/data.json";
const LATEST_SNAPSHOT_KEY = "ledger/backup-latest.json";
const SNAPSHOT_MANIFEST_KEY = "ledger/backups.json";
const SNAPSHOT_SLOTS = 7;
const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;

export const DEFAULT_TYPES = [
  { id: "baby", name: "👶 宝宝" },
  { id: "subscription", name: "💳 订阅" },
  { id: "document", name: "📄 证件" },
  { id: "maintenance", name: "🏠 家庭维护" },
  { id: "warranty", name: "🛡️ 保修" },
  { id: "vehicle", name: "🚗 车辆" },
  { id: "finance", name: "💰 财务" },
  { id: "reminder", name: "📌 其他" }
];

export function emptyData() {
  return {
    version: 8,
    updatedAt: null,
    settings: {
      siteName: "Family Hub",
      types: DEFAULT_TYPES.map(type => ({ ...type })),
      theme: "system",
      typeOrder: DEFAULT_TYPES.map(type => type.id)
    },
    series: [],
    events: [],
    templates: []
  };
}

function normalize(value) {
  const base = emptyData();
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.events)) return base;
  const types = Array.isArray(value.settings?.types) && value.settings.types.length
    ? value.settings.types
    : base.settings.types;
  return {
    version: 8,
    updatedAt: value.updatedAt || null,
    settings: {
      ...base.settings,
      ...(value.settings || {}),
      siteName: String(value.settings?.siteName || "Family Hub").slice(0, 30),
      types,
      typeOrder: Array.isArray(value.settings?.typeOrder) ? value.settings.typeOrder : types.map(type => type.id)
    },
    series: Array.isArray(value.series) ? value.series : [],
    events: value.events,
    templates: Array.isArray(value.templates) ? value.templates : []
  };
}

const snapshotKey = slot => `ledger/backups/slot-${slot}.json`;

export async function readData() {
  const raw = await getStore(STORE_NAME).get(DATA_KEY, { type: "json", consistency: "strong" });
  return normalize(raw);
}

export async function saveData(value, { backup = true } = {}) {
  const store = getStore(STORE_NAME);
  const clean = normalize(value);
  if (!backup) {
    await store.setJSON(DATA_KEY, clean);
    return clean;
  }

  const [current, rawManifest] = await Promise.all([
    store.get(DATA_KEY, { type: "json", consistency: "strong" }),
    store.get(SNAPSHOT_MANIFEST_KEY, { type: "json", consistency: "strong" })
  ]);

  if (!current || typeof current !== "object" || !Array.isArray(current.events)) {
    await store.setJSON(DATA_KEY, clean);
    return clean;
  }

  const manifest = rawManifest && Array.isArray(rawManifest.items)
    ? rawManifest
    : { cursor: 0, items: [] };
  const latest = manifest.items[0];
  const shouldRotate = !latest || Date.now() - new Date(latest.at).getTime() >= SNAPSHOT_INTERVAL_MS;

  await Promise.all([
    store.setJSON(LATEST_SNAPSHOT_KEY, current),
    store.setJSON(DATA_KEY, clean)
  ]);

  if (shouldRotate) {
    const slot = Number(manifest.cursor || 0) % SNAPSHOT_SLOTS;
    const at = new Date().toISOString();
    await store.setJSON(snapshotKey(slot), current);
    manifest.items = manifest.items.filter(item => item.slot !== slot);
    manifest.items.push({
      slot,
      at,
      events: current.events.length,
      series: Array.isArray(current.series) ? current.series.length : 0
    });
    manifest.items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    manifest.items = manifest.items.slice(0, SNAPSHOT_SLOTS);
    manifest.cursor = (slot + 1) % SNAPSHOT_SLOTS;
    await store.setJSON(SNAPSHOT_MANIFEST_KEY, manifest);
  }

  return clean;
}
