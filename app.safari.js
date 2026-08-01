// .build-tmp/schedule.safari.js
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

// .build-tmp/app.js
var $ = (s, r = document) => r.querySelector(s);
var data;
var active = "overview";
var overviewFilter = "all";
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
      sub: `${x.cycle === "yearly" ? "\u5E74\u5EA6\u7EED\u8D39" : x.cycle === "once" ? "\u4E00\u6B21\u6027\u4ED8\u6B3E" : "\u6BCF\u6708\u7EED\u8D39"} \xB7 ${x.category || "\u672A\u5206\u7C7B"}`,
      amount: money(x.amount),
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
  return `<div class="swipe-item ${done ? "is-done" : ""}" data-type="${x.type}" data-id="${x.item.id}" data-date="${x.date}" data-recurring="${x.recurring}"><button class="swipe-complete" data-toggle aria-label="${done ? "\u6062\u590D\u4E3A\u672A\u5B8C\u6210" : "\u6807\u8BB0\u5B8C\u6210"}">${done ? "\u21B6 \u6062\u590D" : "\u2713 \u5B8C\u6210"}</button><button class="action-card ${x.d <= 0 && !done ? "urgent" : ""}" data-detail="true"><span class="action-icon">${done ? "\u2713" : meta[x.type][1]}</span><span class="action-copy"><b>${esc(x.item.name)}</b><small>${x.amount ? `<strong class="action-amount">${x.amount}</strong> \xB7 ` : ""}${esc(x.title)} \xB7 ${esc(x.sub)}</small></span><span class="action-date">${done ? x.recurring ? "\u672C\u671F\u5DF2\u5B8C\u6210" : "\u5DF2\u5B8C\u6210" : dateText(x.d)}<small>${fmt(x.date)}</small></span></button></div>`;
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
      detailRow("\u91D1\u989D", money(item.amount)),
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
function openDetail(type, id, date, recurring) {
  const item = data[type].find((x2) => x2.id === id);
  if (!item) return;
  const x = {
    type,
    item,
    date,
    recurring,
    done: recurring ? new Set(item.completedDates || []).has(date) : !!item.done
  };
  const status = x.done ? recurring ? "\u672C\u671F\u5DF2\u5B8C\u6210" : "\u5DF2\u5B8C\u6210" : x.d === void 0 ? dateText(days(date)) : dateText(x.d);
  const typeName = meta[type][0];
  $("#detailContent").innerHTML = `<p class="detail-kicker">${esc(typeName)}</p><h2 class="detail-title">${esc(item.name)}</h2><div class="detail-status">${esc(status)} \xB7 ${fmt(date)}</div><div class="detail-fields">${detailRows(x)}</div>${recurring ? '<p class="detail-recurring">\u5B8C\u6210\u53EA\u4F5C\u7528\u4E8E\u5F53\u524D\u8FD9\u4E00\u671F\uFF1B\u5220\u9664\u4F1A\u5220\u9664\u6574\u6761\u5FAA\u73AF\u63D0\u9192\u3002</p>' : ""}<div class="detail-actions"><button type="button" class="detail-delete" data-detail-delete>\u5220\u9664${esc(typeName)}</button><button type="button" class="detail-toggle" data-detail-toggle>${x.done ? "\u6062\u590D\u4E3A\u672A\u5B8C\u6210" : "\u6807\u8BB0\u672C\u671F\u5B8C\u6210"}</button></div>`;
  const dialog = $("#itemDetail");
  $("[data-detail-toggle]", dialog).onclick = async () => {
    await toggleOverviewItem(type, id, date, recurring);
    dialog.close();
  };
  $("[data-detail-delete]", dialog).onclick = async () => {
    const message = recurring ? "\u5220\u9664\u540E\uFF0C\u8FD9\u6761\u5FAA\u73AF\u63D0\u9192\u53CA\u6240\u6709\u672A\u6765\u671F\u6B21\u90FD\u4F1A\u6D88\u5931\uFF0C\u786E\u5B9A\u5220\u9664\u5417\uFF1F" : "\u786E\u5B9A\u5220\u9664\u8FD9\u6761\u8BB0\u5F55\u5417\uFF1F";
    if (!confirm(message)) return;
    const index = data[type].findIndex((x2) => x2.id === id);
    if (index < 0) return;
    const removed = data[type].splice(index, 1)[0];
    try {
      data = await req("/api/ledger", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      dialog.close();
      renderOverview();
    } catch {
      data[type].splice(index, 0, removed);
      alert("\u5220\u9664\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
    }
  };
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
  return `<article class="record subscription ${x.archived ? "muted" : ""}"><div class="record-icon">\u25D2</div><div><h3>${esc(x.name)}</h3><p>${esc(x.category || "\u672A\u5206\u7C7B")} \xB7 ${x.autoRenew ? "\u81EA\u52A8\u7EED\u8D39" : "\u624B\u52A8\u7EED\u8D39"}${x.payment ? ` \xB7 ${esc(x.payment)}` : ""}</p></div><div class="amount"><b>${money(x.amount)}</b><small>${x.cycle === "yearly" ? "\u6BCF\u5E74" : x.cycle === "once" ? "\u4E00\u6B21\u6027" : "\u6BCF\u6708"}</small></div><aside class="${d !== null && d <= 7 ? "notice" : ""}">${x.nextDate ? dateText(d) : "\u672A\u8BBE\u65E5\u671F"}<small>${x.nextDate ? fmt(x.nextDate) : ""}</small></aside></article>`;
}
function warrantyCard(x) {
  const d = x.warrantyUntil ? days(x.warrantyUntil) : null;
  return `<article class="record warranty ${x.archived ? "muted" : ""}"><div class="record-icon">\u2302</div><div><h3>${esc(x.name)}</h3><p>${esc([x.brand, x.model, x.location].filter(Boolean).join(" \xB7 ") || "\u5BB6\u5EAD\u7269\u54C1")}</p></div><aside class="${d !== null && d <= 30 ? "notice" : ""}">${x.warrantyUntil ? d < 0 ? "\u4FDD\u4FEE\u5DF2\u7ED3\u675F" : d <= 30 ? "\u4E34\u8FD1\u8FC7\u4FDD" : "\u4FDD\u969C\u4E2D" : "\u672A\u8BBE\u4FDD\u4FEE"}<small>${x.warrantyUntil ? `\u81F3 ${fmt(x.warrantyUntil)}` : ""}</small></aside></article>`;
}
function reminderCard(x) {
  const due = nextDue(x), d = due ? days(due) : null;
  return `<article class="record reminder ${x.done ? "muted done" : ""}"><div class="record-icon">${x.done ? "\u2713" : "\u25F7"}</div><div><h3>${esc(x.name)}</h3><p>${esc(x.category || "\u672A\u5206\u7C7B")} \xB7 ${esc(repeatLabel(x))}</p></div><aside class="${d !== null && d <= 7 ? "notice" : ""}">${x.done ? "\u5DF2\u5B8C\u6210" : due ? dateText(d) : "\u672A\u8BBE\u65E5\u671F"}<small>${due ? fmt(due) : ""}</small></aside></article>`;
}
function renderModule() {
  if (active === "overview") return renderOverview();
  const list = data[active].filter((x) => !x.archived);
  const root = $("#module"), card = active === "subscriptions" ? subscriptionCard : active === "warranties" ? warrantyCard : reminderCard;
  const due = active === "subscriptions" ? list.filter((x) => x.nextDate && days(x.nextDate) <= 30).length : active === "warranties" ? list.filter((x) => x.warrantyUntil && days(x.warrantyUntil) <= 60).length : list.filter((x) => !x.done && nextDue(x) && days(nextDue(x)) <= 30).length;
  root.innerHTML = `<div class="module-meta"><span>${active === "subscriptions" ? `\u6BCF\u6708\u9884\u8BA1 ${money(list.reduce((s, x) => s + x.amount / (x.cycle === "yearly" ? 12 : 1), 0))}` : active === "warranties" ? `\u5DF2\u8BB0\u5F55 ${list.length} \u4EF6\u5BB6\u5EAD\u7269\u54C1` : `\u5F85\u5B8C\u6210 ${list.filter((x) => !x.done).length} \u9879`}</span><small>${due ? `\u5176\u4E2D ${due} \u9879\u8FD1\u671F\u9700\u8981\u5173\u6CE8` : "\u5F53\u524D\u6CA1\u6709\u4E34\u8FD1\u4E8B\u9879"}</small></div>${list.length ? `<div class="records ${active}">${list.map(card).join("")}</div>` : `<div class="empty"><b>\u2301</b><h2>\u8FD8\u6CA1\u6709${meta[active][0]}</h2><p>\u76F4\u63A5\u5728\u8FD9\u91CC\u65B0\u589E\u7B2C\u4E00\u6761\u8BB0\u5F55\u3002</p></div>`}<button class="add-record" id="quickAddButton">+ \u65B0\u589E${meta[active][0]}</button>`;
  $("#quickAddButton").onclick = () => openQuick(active);
}
function render() {
  setName();
  makeTabs();
  renderModule();
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
    html += `<div class="two">${field("\u91D1\u989D", "amount", 0, "number")}${field("\u5468\u671F", "cycle", "monthly", "select", '<option value="monthly">\u6BCF\u6708</option><option value="yearly">\u6BCF\u5E74</option><option value="once">\u4E00\u6B21\u6027</option>')}</div><div class="two">${field("\u4E0B\u6B21\u6263\u8D39\u65E5", "nextDate", today, "date")}${field("\u652F\u4ED8\u65B9\u5F0F", "payment")}</div>`;
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
    item.autoRenew = true;
    item.currency = "CNY";
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
