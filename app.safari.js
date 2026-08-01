// schedule.js
var MS_DAY = 864e5;
var lunarMonths = {
  \u6B63\u6708: 1,
  \u4E8C\u6708: 2,
  \u4E09\u6708: 3,
  \u56DB\u6708: 4,
  \u4E94\u6708: 5,
  \u516D\u6708: 6,
  \u4E03\u6708: 7,
  \u516B\u6708: 8,
  \u4E5D\u6708: 9,
  \u5341\u6708: 10,
  \u51AC\u6708: 11,
  \u814A\u6708: 12
};
var dateToISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
var isoToDate = (iso) => {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
var todayISO = () => dateToISO(/* @__PURE__ */ new Date());
var dayDiff = (iso, base = todayISO()) => {
  const a = isoToDate(iso), b = isoToDate(base);
  return a && b ? Math.round((a - b) / MS_DAY) : null;
};
var addDays = (d, count) => {
  const n = new Date(d);
  n.setDate(n.getDate() + count);
  return n;
};
var monthDate = (start, months) => {
  const day = start.getDate(), n = new Date(start.getFullYear(), start.getMonth() + months, 1);
  n.setDate(
    Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate())
  );
  return n;
};
function lunarParts(date) {
  var _a, _b;
  const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
    month: "long",
    day: "numeric"
  }).formatToParts(date);
  const month = ((_a = parts.find((p) => p.type === "month")) == null ? void 0 : _a.value) || "";
  return {
    month: lunarMonths[month.replace("\u95F0", "")] || 0,
    day: Number((_b = parts.find((p) => p.type === "day")) == null ? void 0 : _b.value),
    leap: month.startsWith("\u95F0")
  };
}
var isRecurring = (item) => item.calendar === "lunar" || item.repeat && item.repeat !== "none";
function nextOccurrence(item, base = todayISO()) {
  const start = isoToDate(item.targetDate), today = isoToDate(base);
  if (!today) return null;
  const stop = isoToDate(item.repeatUntil);
  const allowed = (date) => !stop || date <= stop;
  if (item.calendar === "lunar") {
    const targetMonth = Number(item.lunarMonth), targetDay = Number(item.lunarDay);
    if (!targetMonth || !targetDay) return null;
    for (let i = 0; i < 800; i++) {
      const candidate = addDays(today, i), p = lunarParts(candidate);
      if (p.month === targetMonth && p.day === targetDay && p.leap === !!item.lunarLeap)
        return allowed(candidate) ? dateToISO(candidate) : null;
    }
    return null;
  }
  if (!start) return null;
  if (item.repeat === "none") return item.targetDate;
  if (item.repeat === "weekly" || item.repeat === "interval") {
    const step2 = item.repeat === "weekly" ? 7 : Math.max(1, Number(item.intervalDays) || 1);
    const passed = Math.max(0, Math.ceil((today - start) / MS_DAY));
    const candidate = addDays(start, Math.ceil(passed / step2) * step2);
    return allowed(candidate) ? dateToISO(candidate) : null;
  }
  const step = item.repeat === "monthly" ? 1 : item.repeat === "quarterly" ? 3 : 12;
  let n = Math.max(
    0,
    Math.floor(
      ((today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth()) / step
    ) - 1
  );
  for (; n < 200; n++) {
    const candidate = monthDate(start, n * step);
    if (candidate >= today)
      return allowed(candidate) ? dateToISO(candidate) : null;
  }
  return null;
}
function nextDue(item, base = todayISO()) {
  let candidate = nextOccurrence(item, base);
  if (!candidate || !isRecurring(item)) return candidate;
  const completed = new Set(
    Array.isArray(item.completedDates) ? item.completedDates : []
  );
  for (let i = 0; candidate && i < 800; i++) {
    if (!completed.has(candidate)) return candidate;
    candidate = nextOccurrence(
      item,
      dateToISO(addDays(isoToDate(candidate), 1))
    );
  }
  return null;
}
function occurrencesInRange(item, from, until) {
  const end = isoToDate(until), result = [];
  if (!end) return result;
  if (!isRecurring(item)) {
    const date2 = nextOccurrence(item, from);
    return date2 ? [date2] : result;
  }
  let date = nextOccurrence(item, from);
  for (let i = 0; date && i < 800 && isoToDate(date) < end; i++) {
    result.push(date);
    date = nextOccurrence(item, dateToISO(addDays(isoToDate(date), 1)));
  }
  return result;
}
function repeatLabel(item) {
  if (item.calendar === "lunar")
    return `\u519C\u5386\u6BCF\u5E74${item.lunarLeap ? "\u95F0" : ""}${item.lunarMonth}\u6708${item.lunarDay}\u65E5`;
  return {
    none: "\u5355\u6B21",
    weekly: "\u6BCF\u5468",
    monthly: "\u6BCF\u6708",
    quarterly: "\u6BCF\u5B63\u5EA6",
    yearly: "\u6BCF\u5E74",
    interval: `\u6BCF\u9694 ${Math.max(1, Number(item.intervalDays) || 1)} \u5929`
  }[item.repeat || "none"];
}

// app.js
var $ = (s, r = document) => r.querySelector(s);
var data;
var active = "overview";
var overviewFilter = "all";
var displayedDate = todayISO();
var dayRefreshTimer;
var isRefreshingForNewDay = false;
var exchange = { rates: { CNY: 1 }, date: "", updatedAt: "" };
var meta = {
  overview: ["\u603B\u89C8", "\u2318"],
  subscriptions: ["\u8D26\u5355\u4E0E\u8BA2\u9605", "\u25D2"],
  warranties: ["\u7269\u54C1\u4FDD\u4FEE\u4E0E\u7EF4\u4FEE", "\u2302"],
  reminders: ["\u5012\u8BA1\u65F6\u4E0E\u63D0\u9192", "\u25F7"]
};
async function req(url, opt = {}) {
  const r = await fetch(url, { credentials: "same-origin", ...opt });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(j.error || "\u8BF7\u6C42\u5931\u8D25");
  return j;
}
var days = (v) => !v ? null : dayDiff(v);
var fmt = (v) => v ? new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric"
}).format(/* @__PURE__ */ new Date(`${v}T00:00:00`)) : "\u672A\u8BBE\u7F6E";
var money = (v) => new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 2
}).format(v || 0);
var currencyOptions = [
  ["CNY", "\u4EBA\u6C11\u5E01 CNY"],
  ["USD", "\u7F8E\u5143 USD"],
  ["EUR", "\u6B27\u5143 EUR"],
  ["HKD", "\u6E2F\u5E01 HKD"],
  ["JPY", "\u65E5\u5143 JPY"],
  ["GBP", "\u82F1\u9551 GBP"],
  ["KRW", "\u97E9\u5143 KRW"],
  ["SGD", "\u65B0\u52A0\u5761\u5143 SGD"],
  ["AUD", "\u6FB3\u5143 AUD"],
  ["CAD", "\u52A0\u5143 CAD"],
  ["TWD", "\u65B0\u53F0\u5E01 TWD"],
  ["THB", "\u6CF0\u94E2 THB"],
  ["MYR", "\u9A6C\u6765\u897F\u4E9A\u6797\u5409\u7279 MYR"],
  ["IDR", "\u5370\u5C3C\u76FE IDR"],
  ["PHP", "\u83F2\u5F8B\u5BBE\u6BD4\u7D22 PHP"],
  ["VND", "\u8D8A\u5357\u76FE VND"],
  ["INR", "\u5370\u5EA6\u5362\u6BD4 INR"],
  ["AED", "\u963F\u8054\u914B\u8FEA\u62C9\u59C6 AED"],
  ["CHF", "\u745E\u58EB\u6CD5\u90CE CHF"],
  ["SEK", "\u745E\u5178\u514B\u6717 SEK"],
  ["NOK", "\u632A\u5A01\u514B\u6717 NOK"],
  ["DKK", "\u4E39\u9EA6\u514B\u6717 DKK"],
  ["MXN", "\u58A8\u897F\u54E5\u6BD4\u7D22 MXN"],
  ["BRL", "\u5DF4\u897F\u96F7\u4E9A\u5C14 BRL"],
  ["BOB", "\u73BB\u5229\u7EF4\u4E9A\u8BFA BOB"]
].map(([value, label]) => ({ value, label }));
var currencyCode = (value) => String(value || "CNY").trim().toUpperCase();
var originalMoney = (amount, currency = "CNY") => {
  const code = currencyCode(currency);
  try {
    return new Intl.NumberFormat("zh-CN", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(amount || 0);
  } catch {
    return `${code} ${Number(amount || 0).toFixed(2)}`;
  }
};
var rateToCny = (currency) => exchange.rates[currencyCode(currency)];
var convertedAmount = (item) => {
  const rate = rateToCny(item.currency);
  return Number.isFinite(rate) ? Number(item.amount || 0) * rate : null;
};
var subscriptionAmount = (item, withOriginal = false) => {
  const original = originalMoney(item.amount, item.currency), converted = convertedAmount(item);
  if (currencyCode(item.currency) === "CNY") return original;
  if (converted === null) return `${original} \xB7 \u6682\u65E0\u6C47\u7387`;
  return withOriginal ? `${original} \xB7 \u2248 ${money(converted)}` : `\u2248 ${money(converted)}`;
};
var currencySelect = (selected = "CNY") => currencyOptions.map(({ value, label }) => option(value, label, currencyCode(selected))).join("");
async function loadExchangeRates() {
  var _a, _b;
  const key = "homeledger-exchange-rates-v1";
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if ((_a = cached == null ? void 0 : cached.rates) == null ? void 0 : _a.CNY) exchange = cached;
    if ((cached == null ? void 0 : cached.updatedAt) && Date.now() - new Date(cached.updatedAt).getTime() < 60 * 60 * 1e3) return;
  } catch {
  }
  try {
    const fresh = await req("/api/exchange-rates", { cache: "no-store" });
    if (!((_b = fresh == null ? void 0 : fresh.rates) == null ? void 0 : _b.CNY)) return;
    exchange = fresh;
    localStorage.setItem(key, JSON.stringify(fresh));
    if (data) render();
  } catch {
  }
}
var esc = (v) => {
  const e = document.createElement("i");
  e.textContent = v || "";
  return e.innerHTML;
};
function setName() {
  var _a;
  const n = data.settings.siteName || "HomeLedger";
  $("#siteName").textContent = n;
  document.title = `${n} \xB7 \u5BB6\u5EAD\u8D26\u672C`;
  $(".brand i").textContent = ((_a = [...n][0]) == null ? void 0 : _a.toUpperCase()) || "H";
}
function makeTabs() {
  const tabs = $("#tabs");
  tabs.replaceChildren();
  ["overview", ...data.settings.moduleOrder].forEach((k) => {
    const b = document.createElement("button");
    b.className = k === active ? "active" : "";
    b.textContent = meta[k][0];
    b.onclick = () => {
      active = k;
      render();
    };
    tabs.append(b);
  });
}
var dateText = (d) => d < 0 ? `\u5DF2\u903E\u671F ${Math.abs(d)} \u5929` : d === 0 ? "\u4ECA\u5929" : d === 1 ? "\u660E\u5929" : `${d} \u5929\u540E`;
var yearFromToday = () => {
  const d = isoToDate(todayISO());
  d.setFullYear(d.getFullYear() + 1);
  return dateToISO(d);
};
function actionItems() {
  const reminders = data.reminders.filter((x) => !x.archived).flatMap((x) => {
    const recurring = isRecurring(x), dates = recurring ? occurrencesInRange(x, todayISO(), yearFromToday()) : [nextDue(x)].filter(Boolean), completed = new Set(x.completedDates || []);
    return dates.map((date) => ({
      type: "reminders",
      item: x,
      date,
      d: days(date),
      title: "\u5F85\u5904\u7406\u63D0\u9192",
      sub: repeatLabel(x),
      recurring,
      done: recurring ? completed.has(date) : !!x.done
    }));
  });
  return [
    ...data.subscriptions.filter((x) => !x.archived && x.nextDate).map((x) => ({
      type: "subscriptions",
      item: x,
      date: x.nextDate,
      d: days(x.nextDate),
      title: "\u8BA2\u9605\u6263\u8D39",
      sub: [
        x.cycle === "yearly" ? "\u5E74\u5EA6\u7EED\u8D39" : x.cycle === "once" ? "\u4E00\u6B21\u6027\u4ED8\u6B3E" : "\u6BCF\u6708\u7EED\u8D39",
        x.category || "\u672A\u5206\u7C7B",
        x.payment
      ].filter(Boolean).join(" \xB7 "),
      amount: subscriptionAmount(x, true),
      recurring: x.cycle !== "once",
      done: !!x.done
    })),
    ...data.warranties.filter((x) => !x.archived && x.warrantyUntil).map((x) => ({
      type: "warranties",
      item: x,
      date: x.warrantyUntil,
      d: days(x.warrantyUntil),
      title: "\u4FDD\u4FEE\u5373\u5C06\u5230\u671F",
      sub: [x.brand, x.model, x.location].filter(Boolean).join(" \xB7 ") || "\u5BB6\u5EAD\u7269\u54C1",
      recurring: false,
      done: !!x.done
    })),
    ...reminders
  ].sort((a, b) => a.d - b.d);
}
function overviewCard(x) {
  const done = !!x.done;
  return `<div class="swipe-item ${done ? "is-done" : ""}" data-type="${x.type}" data-id="${x.item.id}" data-date="${x.date}" data-recurring="${x.recurring}"><button class="swipe-complete" data-toggle aria-label="${done ? "\u6062\u590D\u4E3A\u672A\u5B8C\u6210" : "\u6807\u8BB0\u5B8C\u6210"}">${done ? "\u21B6 \u6062\u590D" : "\u2713 \u5B8C\u6210"}</button><button class="action-card ${x.d <= 0 && !done ? "urgent" : ""}" data-detail="true"><span class="action-icon">${done ? "\u2713" : meta[x.type][1]}</span><span class="action-copy"><b>${esc(x.item.name)}</b>${x.amount ? `<strong class="action-amount-row">${x.amount}</strong>` : ""}<small>${esc(x.title)} \xB7 ${esc(x.sub)}</small></span><span class="action-date">${done ? x.recurring ? "\u672C\u671F\u5DF2\u5B8C\u6210" : "\u5DF2\u5B8C\u6210" : dateText(x.d)}<small>${fmt(x.date)}</small></span></button></div>`;
}
async function toggleOverviewItem(type, id, date, recurring) {
  const item = data[type].find((x) => x.id === id);
  if (!item) return;
  const snapshot = structuredClone(item);
  if (type === "reminders" && recurring) {
    const completed = new Set(item.completedDates || []);
    completed.has(date) ? completed.delete(date) : completed.add(date);
    item.completedDates = [...completed].sort();
  } else item.done = !item.done;
  try {
    data = await req("/api/ledger", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    renderOverview();
  } catch {
    Object.assign(item, snapshot);
    alert("\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
  }
}
var detailRow = (label, value) => value ? `<div class="detail-field"><span>${esc(label)}</span><b>${esc(value)}</b></div>` : "";
function detailRows(x) {
  const item = x.item;
  if (x.type === "subscriptions")
    return [
      detailRow("\u539F\u59CB\u91D1\u989D", originalMoney(item.amount, item.currency)),
      detailRow("\u4EBA\u6C11\u5E01\u4F30\u7B97", convertedAmount(item) === null ? "\u6682\u672A\u53D6\u5F97\u6C47\u7387" : `\u2248 ${money(convertedAmount(item))}`),
      detailRow("\u5F53\u524D\u6C47\u7387", currencyCode(item.currency) === "CNY" ? "1 CNY = \xA51.0000" : rateToCny(item.currency) ? `1 ${currencyCode(item.currency)} \u2248 \xA5${rateToCny(item.currency).toFixed(4)}${exchange.date ? `\uFF08${exchange.date}\uFF09` : ""}` : "\u6682\u672A\u53D6\u5F97\u6C47\u7387"),
      detailRow("\u6263\u8D39\u65E5\u671F", fmt(x.date)),
      detailRow(
        "\u5468\u671F",
        item.cycle === "yearly" ? "\u6BCF\u5E74" : item.cycle === "once" ? "\u4E00\u6B21\u6027" : "\u6BCF\u6708"
      ),
      detailRow("\u7EED\u8D39\u65B9\u5F0F", item.autoRenew ? "\u81EA\u52A8\u7EED\u8D39" : "\u624B\u52A8\u7EED\u8D39"),
      detailRow("\u652F\u4ED8\u65B9\u5F0F", item.payment),
      detailRow("\u5206\u7C7B", item.category),
      detailRow("\u5907\u6CE8", item.note)
    ].join("");
  if (x.type === "warranties")
    return [
      detailRow("\u4FDD\u4FEE\u622A\u6B62", fmt(x.date)),
      detailRow("\u54C1\u724C", item.brand),
      detailRow("\u578B\u53F7", item.model),
      detailRow("\u8D2D\u4E70\u65E5\u671F", item.purchaseDate && fmt(item.purchaseDate)),
      detailRow(
        "\u8D2D\u4E70\u91D1\u989D",
        item.purchasePrice ? money(item.purchasePrice) : ""
      ),
      detailRow("\u5B58\u653E\u4F4D\u7F6E", item.location),
      detailRow("\u8D44\u6599\u94FE\u63A5", item.link),
      detailRow("\u5907\u6CE8", item.note)
    ].join("");
  return [
    detailRow("\u672C\u671F\u65E5\u671F", fmt(x.date)),
    detailRow("\u91CD\u590D\u89C4\u5219", repeatLabel(item)),
    detailRow("\u5FAA\u73AF\u505C\u6B62", item.repeatUntil ? fmt(item.repeatUntil) : "\u672A\u8BBE\u7F6E"),
    detailRow("\u5206\u7C7B", item.category),
    detailRow("\u5907\u6CE8", item.note)
  ].join("");
}
var option = (value, label, selected) => `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${label}</option>`;
var editField = (label, name, value = "", type = "text", extra = "") => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
var editSelect = (label, name, options) => `<label class="field"><span>${label}</span><select name="${name}">${options}</select></label>`;
var editTextarea = (label, name, value = "") => `<label class="field full"><span>${label}</span><textarea name="${name}">${esc(value)}</textarea></label>`;
function recordEditFields(type, item) {
  let html = `<div class="detail-edit-grid">${editField("\u540D\u79F0", "name", item.name)}${editField("\u5206\u7C7B", "category", item.category)}`;
  if (type === "subscriptions")
    html += `${editField("\u91D1\u989D", "amount", item.amount, "number", 'min="0" step="0.01" inputmode="decimal"')}${editSelect("\u539F\u59CB\u5E01\u79CD", "currency", currencySelect(item.currency))}${editSelect("\u5468\u671F", "cycle", option("monthly", "\u6BCF\u6708", item.cycle) + option("yearly", "\u6BCF\u5E74", item.cycle) + option("once", "\u4E00\u6B21\u6027", item.cycle))}${editField("\u4E0B\u6B21\u6263\u8D39\u65E5", "nextDate", item.nextDate, "date")}${editSelect("\u7EED\u8D39\u65B9\u5F0F", "autoRenew", option("true", "\u81EA\u52A8\u7EED\u8D39", item.autoRenew !== false) + option("false", "\u624B\u52A8\u7EED\u8D39", item.autoRenew === false))}${editField("\u652F\u4ED8\u65B9\u5F0F", "payment", item.payment)}${editTextarea("\u5907\u6CE8", "note", item.note)}`;
  if (type === "warranties")
    html += `${editField("\u54C1\u724C", "brand", item.brand)}${editField("\u578B\u53F7", "model", item.model)}${editField("\u8D2D\u4E70\u65E5\u671F", "purchaseDate", item.purchaseDate, "date")}${editField("\u8D2D\u4E70\u91D1\u989D", "purchasePrice", item.purchasePrice, "number", 'min="0" step="0.01"')}${editField("\u4FDD\u4FEE\u622A\u6B62", "warrantyUntil", item.warrantyUntil, "date")}${editField("\u5B58\u653E\u4F4D\u7F6E", "location", item.location)}${editField("\u8D44\u6599\u94FE\u63A5", "link", item.link, "url")}${editTextarea("\u5907\u6CE8", "note", item.note)}`;
  if (type === "reminders") {
    const lunar = item.calendar === "lunar";
    html += `${editSelect("\u65E5\u5386", "calendar", option("gregorian", "\u516C\u5386", !lunar) + option("lunar", "\u519C\u5386\uFF08\u6BCF\u5E74\uFF09", lunar))}<span class="detail-edit-spacer"></span><div class="detail-gregorian" ${lunar ? "hidden" : ""}>${editField("\u5F00\u59CB\u65E5\u671F", "targetDate", item.targetDate, "date")}${editSelect("\u91CD\u590D\u89C4\u5219", "repeat", option("none", "\u4E0D\u91CD\u590D\uFF08\u5355\u6B21\uFF09", item.repeat === "none") + option("weekly", "\u6BCF\u5468", item.repeat === "weekly") + option("monthly", "\u6BCF\u6708", item.repeat === "monthly") + option("quarterly", "\u6BCF\u5B63\u5EA6", item.repeat === "quarterly") + option("yearly", "\u6BCF\u5E74", item.repeat === "yearly") + option("interval", "\u6BCF\u9694\u6307\u5B9A\u5929\u6570", item.repeat === "interval"))}${editField("\u6BCF\u9694\u5929\u6570", "intervalDays", item.intervalDays || 1, "number", 'min="1" class="detail-interval"')}${editField("\u5FAA\u73AF\u505C\u6B62\u65E5\u671F", "repeatUntil", item.repeatUntil, "date")}</div><div class="detail-lunar" ${lunar ? "" : "hidden"}>${editSelect("\u519C\u5386\u6708\u4EFD", "lunarMonth", Array.from({ length: 12 }, (_, i) => option(i + 1, `${i + 1} \u6708`, Number(item.lunarMonth) === i + 1)).join(""))}${editSelect("\u519C\u5386\u65E5\u671F", "lunarDay", Array.from({ length: 30 }, (_, i) => option(i + 1, `${i + 1} \u65E5`, Number(item.lunarDay) === i + 1)).join(""))}<label class="check full"><input type="checkbox" name="lunarLeap" ${item.lunarLeap ? "checked" : ""}> \u95F0\u6708</label></div>${editTextarea("\u5907\u6CE8", "note", item.note)}`;
  }
  return `${html}</div>`;
}
function saveRecordEdits(type, item, form) {
  const f = new FormData(form);
  ["name", "category", "note"].forEach((key) => item[key] = String(f.get(key) || "").trim());
  if (!item.name) throw Error("\u8BF7\u586B\u5199\u540D\u79F0");
  if (type === "subscriptions") {
    ["cycle", "nextDate", "payment"].forEach((key) => item[key] = String(f.get(key) || ""));
    item.currency = currencyCode(f.get("currency"));
    item.amount = Math.max(0, Number(f.get("amount")) || 0);
    item.autoRenew = f.get("autoRenew") !== "false";
  }
  if (type === "warranties") {
    ["brand", "model", "purchaseDate", "warrantyUntil", "location", "link"].forEach((key) => item[key] = String(f.get(key) || ""));
    item.purchasePrice = Math.max(0, Number(f.get("purchasePrice")) || 0);
  }
  if (type === "reminders") {
    item.calendar = String(f.get("calendar") || "gregorian");
    item.targetDate = String(f.get("targetDate") || "");
    item.repeat = String(f.get("repeat") || "none");
    item.intervalDays = Math.max(1, Number(f.get("intervalDays")) || 1);
    item.repeatUntil = String(f.get("repeatUntil") || "");
    item.lunarMonth = Number(f.get("lunarMonth")) || 1;
    item.lunarDay = Number(f.get("lunarDay")) || 1;
    item.lunarLeap = f.get("lunarLeap") === "on";
  }
}
function openDetail(type, id, date, recurring) {
  const item = data[type].find((x2) => x2.id === id);
  if (!item) return;
  const x = {
    type,
    item,
    date,
    d: days(date),
    recurring,
    done: recurring ? new Set(item.completedDates || []).has(date) : !!item.done
  };
  const status = x.done ? recurring ? "\u672C\u671F\u5DF2\u5B8C\u6210" : "\u5DF2\u5B8C\u6210" : x.d === void 0 ? dateText(days(date)) : dateText(x.d);
  const typeName = meta[type][0];
  const renderDetail = () => {
    $("#detailContent").innerHTML = `<p class="detail-kicker">${esc(typeName)}</p><h2 class="detail-title">${esc(item.name)}</h2><div class="detail-status">${esc(status)} \xB7 ${fmt(date)}</div><div class="detail-fields">${detailRows(x)}</div>${recurring ? '<p class="detail-recurring">\u5B8C\u6210\u53EA\u4F5C\u7528\u4E8E\u5F53\u524D\u8FD9\u4E00\u671F\uFF1B\u5220\u9664\u4F1A\u5220\u9664\u6574\u6761\u5FAA\u73AF\u63D0\u9192\u3002</p>' : ""}<div class="detail-actions"><button type="button" class="detail-delete" data-detail-delete>\u5220\u9664${esc(typeName)}</button><span><button type="button" class="detail-edit" data-detail-edit>\u7F16\u8F91</button><button type="button" class="detail-toggle" data-detail-toggle>${x.done ? "\u6062\u590D\u4E3A\u672A\u5B8C\u6210" : "\u6807\u8BB0\u672C\u671F\u5B8C\u6210"}</button></span></div>`;
    $("[data-detail-edit]", dialog).onclick = () => renderEdit();
    $("[data-detail-toggle]", dialog).onclick = async () => {
      await toggleOverviewItem(type, id, date, recurring);
      dialog.close();
    };
    $("[data-detail-delete]", dialog).onclick = removeRecord;
  };
  const renderEdit = () => {
    $("#detailContent").innerHTML = `<p class="detail-kicker">\u7F16\u8F91${esc(typeName)}</p><h2 class="detail-title">${esc(item.name)}</h2><form id="detailEditForm">${recordEditFields(type, item)}<div class="detail-actions"><button type="button" class="detail-delete" data-detail-cancel>\u53D6\u6D88</button><button class="detail-toggle">\u4FDD\u5B58\u4FEE\u6539</button></div></form>`;
    const form = $("#detailEditForm", dialog);
    const calendar = $('[name="calendar"]', form);
    if (calendar) calendar.onchange = () => {
      $(".detail-gregorian", form).hidden = calendar.value === "lunar";
      $(".detail-lunar", form).hidden = calendar.value !== "lunar";
    };
    $("[data-detail-cancel]", dialog).onclick = renderDetail;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const snapshot = structuredClone(item);
      try {
        saveRecordEdits(type, item, form);
        data = await req("/api/ledger", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        dialog.close();
        render();
      } catch (error) {
        Object.assign(item, snapshot);
        alert(error.message || "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
      }
    };
  };
  const removeRecord = async () => {
    const message = recurring ? "\u5220\u9664\u540E\uFF0C\u8FD9\u6761\u5FAA\u73AF\u63D0\u9192\u53CA\u6240\u6709\u672A\u6765\u671F\u6B21\u90FD\u4F1A\u6D88\u5931\uFF0C\u786E\u5B9A\u5220\u9664\u5417\uFF1F" : "\u786E\u5B9A\u5220\u9664\u8FD9\u6761\u8BB0\u5F55\u5417\uFF1F";
    if (!confirm(message)) return;
    const index = data[type].findIndex((x2) => x2.id === id);
    if (index < 0) return;
    const removed = data[type].splice(index, 1)[0];
    try {
      data = await req("/api/ledger", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      dialog.close();
      render();
    } catch {
      data[type].splice(index, 0, removed);
      alert("\u5220\u9664\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
    }
  };
  const dialog = $("#itemDetail");
  renderDetail();
  dialog.showModal();
}
function bindOverviewInteractions(root) {
  const toggle = (p) => toggleOverviewItem(
    p.dataset.type,
    p.dataset.id,
    p.dataset.date,
    p.dataset.recurring === "true"
  );
  root.querySelectorAll("[data-toggle]").forEach(
    (b) => b.onclick = (e) => {
      e.stopPropagation();
      toggle(b.closest(".swipe-item"));
    }
  );
  root.querySelectorAll(".swipe-item").forEach((w) => {
    const card = $(".action-card", w);
    let startX = 0, dx = 0, dragging = false, moved = false;
    const reset = () => {
      card.style.transform = "";
      card.style.transition = "";
    };
    card.addEventListener("pointerdown", (e) => {
      var _a;
      startX = e.clientX;
      dx = 0;
      moved = false;
      dragging = true;
      (_a = card.setPointerCapture) == null ? void 0 : _a.call(card, e.pointerId);
      card.style.transition = "none";
    });
    card.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = Math.min(0, Math.max(-112, e.clientX - startX));
      if (Math.abs(dx) > 8) moved = true;
      if (dx < 0) card.style.transform = `translateX(${dx}px)`;
    });
    card.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      const shouldToggle = dx < -88;
      reset();
      if (shouldToggle) toggle(w);
    });
    card.addEventListener("pointercancel", () => {
      dragging = false;
      reset();
    });
    card.addEventListener("click", (e) => {
      if (moved) {
        e.preventDefault();
        return;
      }
      openDetail(
        w.dataset.type,
        w.dataset.id,
        w.dataset.date,
        w.dataset.recurring === "true"
      );
    });
  });
}
function renderOverview() {
  const root = $("#module"), allItems = actionItems(), visibleItems = allItems.filter((x) => !(x.d < 0 && x.done)), items = visibleItems.filter(
    (x) => overviewFilter === "all" || overviewFilter === "done" ? overviewFilter === "all" || x.done : !x.done
  ), groups = [
    ["7 \u5929\u5185", (x) => x.d <= 7, false],
    ["30 \u5929\u5185", (x) => x.d > 7 && x.d <= 30, false],
    ["\u4E00\u5E74\u5185", (x) => x.d > 30 && x.d <= 365, false],
    ["\u8D85\u8FC7\u4E00\u5E74", (x) => x.d > 365 && !x.recurring, true]
  ];
  root.innerHTML = `<div class="overview-intro"><span>\u63A5\u4E0B\u6765\u8BE5\u505A\u4EC0\u4E48</span><small>${visibleItems.length ? `\u5171 ${visibleItems.length} \u9879 \xB7 \u5DF2\u5B8C\u6210 ${visibleItems.filter((x) => x.done).length} \u9879` : "\u6682\u65F6\u6CA1\u6709\u9700\u8981\u5904\u7406\u7684\u4E8B\u9879\uFF0C\u5BB6\u5EAD\u6863\u6848\u4E00\u5207\u6B63\u5E38"}</small></div><div class="overview-filters">${[
    ["all", "\u5168\u90E8"],
    ["todo", "\u672A\u5B8C\u6210"],
    ["done", "\u5DF2\u5B8C\u6210"]
  ].map(
    ([key, label]) => `<button class="${overviewFilter === key ? "active" : ""}" data-filter="${key}">${label}</button>`
  ).join("")}</div><div class="timeline">${groups.map(([title, fn, collapsed]) => {
    const list = items.filter(fn);
    if (!list.length) return "";
    const content = `<div class="action-grid">${list.map(overviewCard).join("")}</div>`;
    return collapsed ? `<details class="time-group collapsible"><summary><h2>${title}<small>${list.length}</small></h2><span>\u5C55\u5F00\u67E5\u770B</span></summary>${content}</details>` : `<section class="time-group"><h2>${title}<small>${list.length}</small></h2>${content}</section>`;
  }).join(
    ""
  )}${!items.length ? `<div class="empty"><b>\u2713</b><h2>${overviewFilter === "done" ? "\u8FD8\u6CA1\u6709\u5DF2\u5B8C\u6210\u4E8B\u9879" : "\u6682\u65E0\u672A\u5B8C\u6210\u4E8B\u9879"}</h2><p>${overviewFilter === "all" ? "\u65B0\u589E\u8BA2\u9605\u3001\u4FDD\u4FEE\u6216\u63D0\u9192\u540E\uFF0C\u8FD9\u91CC\u4F1A\u81EA\u52A8\u6309\u65F6\u95F4\u63D0\u793A\u4F60\u3002" : "\u5207\u6362\u7B5B\u9009\u53EF\u67E5\u770B\u5176\u4ED6\u4E8B\u9879\u3002"}</p></div>` : ""}</div>`;
  root.querySelectorAll("[data-filter]").forEach(
    (b) => b.onclick = () => {
      overviewFilter = b.dataset.filter;
      renderOverview();
    }
  );
  bindOverviewInteractions(root);
}
function subscriptionCard(x) {
  const d = x.nextDate ? days(x.nextDate) : null;
  return `<article class="record subscription ${x.archived ? "muted" : ""}" data-record-detail="subscriptions" data-id="${x.id}"><div class="record-icon">\u25D2</div><div class="subscription-copy"><h3>${esc(x.name)}</h3><p>${esc(x.category || "\u672A\u5206\u7C7B")} \xB7 ${x.autoRenew ? "\u81EA\u52A8\u7EED\u8D39" : "\u624B\u52A8\u7EED\u8D39"}${x.payment ? ` \xB7 ${esc(x.payment)}` : ""}</p><div class="amount"><b>${subscriptionAmount(x, true)}</b><small>${x.cycle === "yearly" ? "\u6BCF\u5E74" : x.cycle === "once" ? "\u4E00\u6B21\u6027" : "\u6BCF\u6708"}</small></div></div><aside class="${d !== null && d <= 7 ? "notice" : ""}">${x.nextDate ? dateText(d) : "\u672A\u8BBE\u65E5\u671F"}<small>${x.nextDate ? fmt(x.nextDate) : ""}</small></aside></article>`;
}
function warrantyCard(x) {
  const d = x.warrantyUntil ? days(x.warrantyUntil) : null;
  return `<article class="record warranty ${x.archived ? "muted" : ""}" data-record-detail="warranties" data-id="${x.id}"><div class="record-icon">\u2302</div><div><h3>${esc(x.name)}</h3><p>${esc([x.brand, x.model, x.location].filter(Boolean).join(" \xB7 ") || "\u5BB6\u5EAD\u7269\u54C1")}</p></div><aside class="${d !== null && d <= 30 ? "notice" : ""}">${x.warrantyUntil ? d < 0 ? "\u4FDD\u4FEE\u5DF2\u7ED3\u675F" : d <= 30 ? "\u4E34\u8FD1\u8FC7\u4FDD" : "\u4FDD\u969C\u4E2D" : "\u672A\u8BBE\u4FDD\u4FEE"}<small>${x.warrantyUntil ? `\u81F3 ${fmt(x.warrantyUntil)}` : ""}</small></aside></article>`;
}
function reminderCard(x) {
  const due = nextDue(x), d = due ? days(due) : null;
  return `<article class="record reminder ${x.done ? "muted done" : ""}" data-record-detail="reminders" data-id="${x.id}"><div class="record-icon">${x.done ? "\u2713" : "\u25F7"}</div><div><h3>${esc(x.name)}</h3><p>${esc(x.category || "\u672A\u5206\u7C7B")} \xB7 ${esc(repeatLabel(x))}</p></div><aside class="${d !== null && d <= 7 ? "notice" : ""}">${x.done ? "\u5DF2\u5B8C\u6210" : due ? dateText(d) : "\u672A\u8BBE\u65E5\u671F"}<small>${due ? fmt(due) : ""}</small></aside></article>`;
}
function renderModule() {
  if (active === "overview") return renderOverview();
  const list = data[active].filter((x) => !x.archived);
  const root = $("#module"), card = active === "subscriptions" ? subscriptionCard : active === "warranties" ? warrantyCard : reminderCard;
  const due = active === "subscriptions" ? list.filter((x) => x.nextDate && days(x.nextDate) <= 30).length : active === "warranties" ? list.filter((x) => x.warrantyUntil && days(x.warrantyUntil) <= 60).length : list.filter((x) => !x.done && nextDue(x) && days(nextDue(x)) <= 30).length;
  root.innerHTML = `<div class="module-meta"><span>${active === "subscriptions" ? `\u6BCF\u6708\u9884\u8BA1 \u2248 ${money(list.reduce((s, x) => s + (convertedAmount(x) || 0) / (x.cycle === "yearly" ? 12 : 1), 0))}` : active === "warranties" ? `\u5DF2\u8BB0\u5F55 ${list.length} \u4EF6\u5BB6\u5EAD\u7269\u54C1` : `\u5F85\u5B8C\u6210 ${list.filter((x) => !x.done).length} \u9879`}</span><small>${due ? `\u5176\u4E2D ${due} \u9879\u8FD1\u671F\u9700\u8981\u5173\u6CE8` : "\u5F53\u524D\u6CA1\u6709\u4E34\u8FD1\u4E8B\u9879"}</small></div>${list.length ? `<div class="records ${active}">${list.map(card).join("")}</div>` : `<div class="empty"><b>\u2301</b><h2>\u8FD8\u6CA1\u6709${meta[active][0]}</h2><p>\u76F4\u63A5\u5728\u8FD9\u91CC\u65B0\u589E\u7B2C\u4E00\u6761\u8BB0\u5F55\u3002</p></div>`}<button class="add-record" id="quickAddButton">+ \u65B0\u589E${meta[active][0]}</button>`;
  root.querySelectorAll("[data-record-detail]").forEach((record) => {
    record.tabIndex = 0;
    record.setAttribute("role", "button");
    const open = () => {
      const type = record.dataset.recordDetail;
      const item = data[type].find((x) => x.id === record.dataset.id);
      const date = type === "subscriptions" ? item == null ? void 0 : item.nextDate : type === "warranties" ? item == null ? void 0 : item.warrantyUntil : nextDue(item);
      openDetail(type, record.dataset.id, date || todayISO(), type === "reminders" && isRecurring(item));
    };
    record.onclick = open;
    record.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    };
  });
  $("#quickAddButton").onclick = () => openQuick(active);
}
function render() {
  setName();
  makeTabs();
  renderModule();
}
function refreshForNewDay() {
  if (isRefreshingForNewDay || todayISO() === displayedDate) return;
  isRefreshingForNewDay = true;
  window.location.reload();
}
function scheduleMidnightRefresh() {
  clearTimeout(dayRefreshTimer);
  const now = /* @__PURE__ */ new Date();
  const next = new Date(now);
  next.setHours(24, 0, 1, 0);
  dayRefreshTimer = setTimeout(() => {
    refreshForNewDay();
    scheduleMidnightRefresh();
  }, Math.max(1e3, next.getTime() - now.getTime()));
}
function startDayWatcher() {
  displayedDate = todayISO();
  scheduleMidnightRefresh();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshForNewDay();
  });
  window.addEventListener("pageshow", refreshForNewDay);
  window.addEventListener("focus", refreshForNewDay);
}
async function init() {
  try {
    const s = await req("/api/auth/session", { cache: "no-store" });
    if (!s.authenticated) {
      $("#boot").hidden = true;
      $("#login").hidden = false;
      return;
    }
    data = await req("/api/ledger", { cache: "no-store" });
    $("#boot").hidden = true;
    $("#app").hidden = false;
    startDayWatcher();
    render();
  } catch {
    $("#boot").hidden = true;
    $("#login").hidden = false;
    $("#loginMessage").textContent = "\u670D\u52A1\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002";
  }
}
$("#loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const b = $("button", e.currentTarget);
  b.disabled = true;
  $("#loginMessage").textContent = "";
  try {
    await req("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("#password").value })
    });
    const s = await req("/api/auth/session", { cache: "no-store" });
    if (!s.authenticated)
      throw Error("\u767B\u5F55\u72B6\u6001\u672A\u4FDD\u5B58\uFF0C\u8BF7\u786E\u8BA4\u6D4F\u89C8\u5668\u5141\u8BB8 Cookie\u3002");
    data = await req("/api/ledger", { cache: "no-store" });
    $("#login").hidden = true;
    $("#app").hidden = false;
    startDayWatcher();
    render();
  } catch (e2) {
    $("#loginMessage").textContent = e2.message;
  } finally {
    b.disabled = false;
  }
};
var uid = () => {
  var _a;
  return ((_a = crypto.randomUUID) == null ? void 0 : _a.call(crypto)) || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
};
var field = (label, name, value = "", type = "text", options = "", extra = "") => `<div class="field"><label>${label}</label>${type === "select" ? `<select name="${name}">${options}</select>` : `<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`}</div>`;
var repeatOptions = '<option value="none">\u4E0D\u91CD\u590D\uFF08\u5355\u6B21\uFF09</option><option value="weekly">\u6BCF\u5468</option><option value="monthly">\u6BCF\u6708</option><option value="quarterly">\u6BCF\u5B63\u5EA6</option><option value="yearly">\u6BCF\u5E74</option><option value="interval">\u6BCF\u9694\u6307\u5B9A\u5929\u6570</option>';
var monthOptions = Array.from(
  { length: 12 },
  (_, i) => `<option value="${i + 1}">${i + 1} \u6708</option>`
).join("");
var dayOptions = Array.from(
  { length: 30 },
  (_, i) => `<option value="${i + 1}">${i + 1} \u65E5</option>`
).join("");
function openQuick(kind) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  $("#quickTitle").textContent = `\u65B0\u589E${meta[kind][0]}`;
  let html = `<div class="two">${field("\u540D\u79F0", "name")}${field("\u5206\u7C7B", "category")}</div>`;
  if (kind === "subscriptions")
    html += `<div class="two">${field("\u91D1\u989D", "amount", 0, "number", "", 'min="0" step="0.01" inputmode="decimal"')}${field("\u539F\u59CB\u5E01\u79CD", "currency", "CNY", "select", currencySelect("CNY"))}</div><div class="two">${field("\u5468\u671F", "cycle", "monthly", "select", '<option value="monthly">\u6BCF\u6708</option><option value="yearly">\u6BCF\u5E74</option><option value="once">\u4E00\u6B21\u6027</option>')}${field("\u4E0B\u6B21\u6263\u8D39\u65E5", "nextDate", today, "date")}</div><div class="two">${field("\u7EED\u8D39\u65B9\u5F0F", "autoRenew", "true", "select", '<option value="true">\u81EA\u52A8\u7EED\u8D39</option><option value="false">\u624B\u52A8\u7EED\u8D39</option>')}${field("\u652F\u4ED8\u65B9\u5F0F", "payment")}</div>`;
  if (kind === "warranties")
    html += `<div class="two">${field("\u54C1\u724C", "brand")}${field("\u578B\u53F7", "model")}</div><div class="two">${field("\u8D2D\u4E70\u65E5\u671F", "purchaseDate", today, "date")}${field("\u4FDD\u4FEE\u622A\u6B62", "warrantyUntil", today, "date")}</div>`;
  if (kind === "reminders")
    html += `<div class="two">${field("\u65E5\u5386", "calendar", "gregorian", "select", '<option value="gregorian">\u516C\u5386</option><option value="lunar">\u519C\u5386\uFF08\u6BCF\u5E74\uFF09</option>')}${field("\u63D0\u524D\u63D0\u9192\u5929\u6570", "advanceDays", 0, "number", "", 'min="0"')}</div><div id="qgreg"><div class="two">${field("\u5F00\u59CB\u65E5\u671F", "targetDate", today, "date")}${field("\u91CD\u590D\u89C4\u5219", "repeat", "none", "select", repeatOptions)}</div><div class="two qinterval" hidden>${field("\u6BCF\u9694\u5929\u6570", "intervalDays", 1, "number", "", 'min="1"')}<span class="hint">\u6309\u5F00\u59CB\u65E5\u671F\u5FAA\u73AF\u8BA1\u7B97</span></div></div><div id="qlunar" hidden><div class="two">${field("\u519C\u5386\u6708\u4EFD", "lunarMonth", 1, "select", monthOptions)}${field("\u519C\u5386\u65E5\u671F", "lunarDay", 1, "select", dayOptions)}</div><label class="check"><input type="checkbox" name="lunarLeap"> \u95F0\u6708</label><span class="hint">\u519C\u5386\u63D0\u9192\u6309\u6BCF\u5E74\u5BF9\u5E94\u65E5\u671F\u81EA\u52A8\u8BA1\u7B97\u3002</span></div>`;
  $("#quickFields").innerHTML = html;
  const cal = $("[name=calendar]"), rep = $("[name=repeat]");
  if (cal) {
    const sync = () => {
      $("#qgreg").hidden = cal.value === "lunar";
      $("#qlunar").hidden = cal.value !== "lunar";
    };
    cal.onchange = sync;
    rep.onchange = () => $(".qinterval").hidden = rep.value !== "interval";
    sync();
  }
  $("#quickAdd").dataset.kind = kind;
  $("#quickAdd").showModal();
}
$("#quickAddForm").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.currentTarget), kind = $("#quickAdd").dataset.kind, name = String(f.get("name") || "").trim();
  if (!name) return;
  const item = {
    id: uid(),
    name,
    category: String(f.get("category") || ""),
    note: "",
    archived: false
  };
  for (const [k, v] of f) item[k] = v;
  if (kind === "subscriptions") {
    item.amount = Number(item.amount) || 0;
    item.autoRenew = item.autoRenew !== "false";
    item.currency = currencyCode(item.currency);
  }
  if (kind === "reminders") {
    item.intervalDays = Math.max(1, Number(item.intervalDays) || 1);
    item.lunarLeap = f.get("lunarLeap") === "on";
    item.done = false;
    item.completedDates = [];
  }
  data[kind].push(item);
  data = await req("/api/ledger", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  $("#quickAdd").close();
  render();
};
document.querySelectorAll("[data-quick-close]").forEach((b) => b.onclick = () => $("#quickAdd").close());
init();
loadExchangeRates();
$("[data-detail-close]").onclick = () => $("#itemDetail").close();
var originalOpenQuick = openQuick;
openQuick = function(kind) {
  originalOpenQuick(kind);
  if (kind !== "reminders") return;
  const advance = $("[name=advanceDays]");
  advance == null ? void 0 : advance.closest(".field").remove();
  const repeat = $("[name=repeat]"), calendar = $("[name=calendar]"), anchor = repeat == null ? void 0 : repeat.closest(".two");
  if (!repeat || !calendar || !anchor) return;
  const wrap = document.createElement("div"), fieldWrap = document.createElement("div"), label = document.createElement("label"), input = document.createElement("input"), hint = document.createElement("span");
  wrap.className = "two repeat-until-field";
  fieldWrap.className = "field";
  label.textContent = "\u5FAA\u73AF\u505C\u6B62\u65E5\u671F\uFF08\u53EF\u4E0D\u586B\uFF09";
  input.name = "repeatUntil";
  input.type = "date";
  hint.className = "hint";
  hint.textContent = "\u5230\u6B64\u65E5\u671F\u540E\u4E0D\u518D\u751F\u6210\u63D0\u9192";
  fieldWrap.append(label, input);
  wrap.append(fieldWrap, hint);
  anchor.after(wrap);
  const sync = () => {
    wrap.hidden = calendar.value === "lunar" || repeat.value === "none";
  };
  repeat.addEventListener("change", sync);
  calendar.addEventListener("change", sync);
  sync();
};
