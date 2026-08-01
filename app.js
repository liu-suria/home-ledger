import {
  dateToISO,
  dayDiff,
  isRecurring,
  isoToDate,
  nextDue,
  occurrencesInRange,
  repeatLabel,
  todayISO,
} from "./schedule.js";
const $ = (s, r = document) => r.querySelector(s);
let data,
  active = "overview",
  overviewFilter = "all",
  displayedDate = todayISO(),
  dayRefreshTimer,
  isRefreshingForNewDay = false,
  exchange = { rates: { CNY: 1 }, date: "", updatedAt: "" };
const meta = {
  overview: ["总览", "⌘"],
  subscriptions: ["账单与订阅", "◒"],
  warranties: ["物品保修与维修", "⌂"],
  reminders: ["倒计时与提醒", "◷"],
};
async function req(url, opt = {}) {
  const r = await fetch(url, { credentials: "same-origin", ...opt });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(j.error || "请求失败");
  return j;
}
const days = (v) => (!v ? null : dayDiff(v));
const fmt = (v) =>
  v
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(`${v}T00:00:00`))
    : "未设置";
const money = (v) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(v || 0);
const currencyOptions = [
  ["CNY", "人民币 CNY"], ["USD", "美元 USD"], ["EUR", "欧元 EUR"], ["HKD", "港币 HKD"], ["JPY", "日元 JPY"], ["GBP", "英镑 GBP"], ["KRW", "韩元 KRW"], ["SGD", "新加坡元 SGD"], ["AUD", "澳元 AUD"], ["CAD", "加元 CAD"], ["TWD", "新台币 TWD"], ["THB", "泰铢 THB"], ["MYR", "马来西亚林吉特 MYR"], ["IDR", "印尼盾 IDR"], ["PHP", "菲律宾比索 PHP"], ["VND", "越南盾 VND"], ["INR", "印度卢比 INR"], ["AED", "阿联酋迪拉姆 AED"], ["CHF", "瑞士法郎 CHF"], ["SEK", "瑞典克朗 SEK"], ["NOK", "挪威克朗 NOK"], ["DKK", "丹麦克朗 DKK"], ["MXN", "墨西哥比索 MXN"], ["BRL", "巴西雷亚尔 BRL"], ["BOB", "玻利维亚诺 BOB"],
].map(([value, label]) => ({ value, label }));
const currencyCode = (value) => String(value || "CNY").trim().toUpperCase();
const originalMoney = (amount, currency = "CNY") => {
  const code = currencyCode(currency);
  try { return new Intl.NumberFormat("zh-CN", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(amount || 0); }
  catch { return `${code} ${Number(amount || 0).toFixed(2)}`; }
};
const rateToCny = (currency) => exchange.rates[currencyCode(currency)];
const convertedAmount = (item) => {
  const rate = rateToCny(item.currency);
  return Number.isFinite(rate) ? Number(item.amount || 0) * rate : null;
};
const subscriptionAmount = (item, withOriginal = false) => {
  const original = originalMoney(item.amount, item.currency), converted = convertedAmount(item);
  if (currencyCode(item.currency) === "CNY") return original;
  if (converted === null) return `${original} · 暂无汇率`;
  return withOriginal ? `${original} · ≈ ${money(converted)}` : `≈ ${money(converted)}`;
};
const currencySelect = (selected = "CNY") => currencyOptions.map(({ value, label }) => option(value, label, currencyCode(selected))).join("");
async function loadExchangeRates() {
  const key = "homeledger-exchange-rates-v1";
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached?.rates?.CNY) exchange = cached;
    if (cached?.updatedAt && Date.now() - new Date(cached.updatedAt).getTime() < 60 * 60 * 1000) return;
  } catch {}
  try {
    const fresh = await req("/api/exchange-rates", { cache: "no-store" });
    if (!fresh?.rates?.CNY) return;
    exchange = fresh;
    localStorage.setItem(key, JSON.stringify(fresh));
    if (data) render();
  } catch {
    // 原始金额始终可用；汇率暂不可用时不阻塞页面。
  }
}
const esc = (v) => {
  const e = document.createElement("i");
  e.textContent = v || "";
  return e.innerHTML;
};
function setName() {
  const n = data.settings.siteName || "HomeLedger";
  $("#siteName").textContent = n;
  document.title = `${n} · 家庭账本`;
  $(".brand i").textContent = [...n][0]?.toUpperCase() || "H";
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
const dateText = (d) =>
  d < 0
    ? `已逾期 ${Math.abs(d)} 天`
    : d === 0
      ? "今天"
      : d === 1
        ? "明天"
        : `${d} 天后`;
const yearFromToday = () => {
  const d = isoToDate(todayISO());
  d.setFullYear(d.getFullYear() + 1);
  return dateToISO(d);
};
function actionItems() {
  const reminders = data.reminders
    .filter((x) => !x.archived)
    .flatMap((x) => {
      const recurring = isRecurring(x),
        dates = recurring
          ? occurrencesInRange(x, todayISO(), yearFromToday())
          : [nextDue(x)].filter(Boolean),
        completed = new Set(x.completedDates || []);
      return dates.map((date) => ({
        type: "reminders",
        item: x,
        date,
        d: days(date),
        title: "待处理提醒",
        sub: repeatLabel(x),
        recurring,
        done: recurring ? completed.has(date) : !!x.done,
      }));
    });
  return [
    ...data.subscriptions
      .filter((x) => !x.archived && x.nextDate)
      .map((x) => ({
        type: "subscriptions",
        item: x,
        date: x.nextDate,
        d: days(x.nextDate),
        title: "订阅扣费",
        sub: [
          x.cycle === "yearly" ? "年度续费" : x.cycle === "once" ? "一次性付款" : "每月续费",
          x.category || "未分类",
          x.payment,
        ]
          .filter(Boolean)
          .join(" · "),
        amount: subscriptionAmount(x, true),
        recurring: x.cycle !== "once",
        done: !!x.done,
      })),
    ...data.warranties
      .filter((x) => !x.archived && x.warrantyUntil)
      .map((x) => ({
        type: "warranties",
        item: x,
        date: x.warrantyUntil,
        d: days(x.warrantyUntil),
        title: "保修即将到期",
        sub:
          [x.brand, x.model, x.location].filter(Boolean).join(" · ") ||
          "家庭物品",
        recurring: false,
        done: !!x.done,
      })),
    ...reminders,
  ].sort((a, b) => a.d - b.d);
}
function overviewCard(x) {
  const done = !!x.done;
  return `<div class="swipe-item ${done ? "is-done" : ""}" data-type="${x.type}" data-id="${x.item.id}" data-date="${x.date}" data-recurring="${x.recurring}"><button class="swipe-complete" data-toggle aria-label="${done ? "恢复为未完成" : "标记完成"}">${done ? "↶ 恢复" : "✓ 完成"}</button><button class="action-card ${x.d <= 0 && !done ? "urgent" : ""}" data-detail="true"><span class="action-icon">${done ? "✓" : meta[x.type][1]}</span><span class="action-copy"><b>${esc(x.item.name)}</b>${x.amount ? `<strong class="action-amount-row">${x.amount}</strong>` : ""}<small>${esc(x.title)} · ${esc(x.sub)}</small></span><span class="action-date">${done ? (x.recurring ? "本期已完成" : "已完成") : dateText(x.d)}<small>${fmt(x.date)}</small></span></button></div>`;
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
      body: JSON.stringify(data),
    });
    renderOverview();
  } catch {
    Object.assign(item, snapshot);
    alert("保存失败，请稍后重试。");
  }
}
const detailRow = (label, value) =>
  value
    ? `<div class="detail-field"><span>${esc(label)}</span><b>${esc(value)}</b></div>`
    : "";
function detailRows(x) {
  const item = x.item;
  if (x.type === "subscriptions")
    return [
      detailRow("原始金额", originalMoney(item.amount, item.currency)),
      detailRow("人民币估算", convertedAmount(item) === null ? "暂未取得汇率" : `≈ ${money(convertedAmount(item))}`),
      detailRow("当前汇率", currencyCode(item.currency) === "CNY" ? "1 CNY = ¥1.0000" : rateToCny(item.currency) ? `1 ${currencyCode(item.currency)} ≈ ¥${rateToCny(item.currency).toFixed(4)}${exchange.date ? `（${exchange.date}）` : ""}` : "暂未取得汇率"),
      detailRow("扣费日期", fmt(x.date)),
      detailRow(
        "周期",
        item.cycle === "yearly"
          ? "每年"
          : item.cycle === "once"
            ? "一次性"
            : "每月",
      ),
      detailRow("续费方式", item.autoRenew ? "自动续费" : "手动续费"),
      detailRow("支付方式", item.payment),
      detailRow("分类", item.category),
      detailRow("备注", item.note),
    ].join("");
  if (x.type === "warranties")
    return [
      detailRow("保修截止", fmt(x.date)),
      detailRow("品牌", item.brand),
      detailRow("型号", item.model),
      detailRow("购买日期", item.purchaseDate && fmt(item.purchaseDate)),
      detailRow(
        "购买金额",
        item.purchasePrice ? money(item.purchasePrice) : "",
      ),
      detailRow("存放位置", item.location),
      detailRow("资料链接", item.link),
      detailRow("备注", item.note),
    ].join("");
  return [
    detailRow("本期日期", fmt(x.date)),
    detailRow("重复规则", repeatLabel(item)),
    detailRow("循环停止", item.repeatUntil ? fmt(item.repeatUntil) : "未设置"),
    detailRow("分类", item.category),
    detailRow("备注", item.note),
  ].join("");
}
const option = (value, label, selected) =>
  `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${label}</option>`;
const editField = (label, name, value = "", type = "text", extra = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const editSelect = (label, name, options) =>
  `<label class="field"><span>${label}</span><select name="${name}">${options}</select></label>`;
const editTextarea = (label, name, value = "") =>
  `<label class="field full"><span>${label}</span><textarea name="${name}">${esc(value)}</textarea></label>`;
function recordEditFields(type, item) {
  let html = `<div class="detail-edit-grid">${editField("名称", "name", item.name)}${editField("分类", "category", item.category)}`;
  if (type === "subscriptions")
    html += `${editField("金额", "amount", item.amount, "number", 'min="0" step="0.01" inputmode="decimal"')}${editSelect("原始币种", "currency", currencySelect(item.currency))}${editSelect("周期", "cycle", option("monthly", "每月", item.cycle) + option("yearly", "每年", item.cycle) + option("once", "一次性", item.cycle))}${editField("下次扣费日", "nextDate", item.nextDate, "date")}${editSelect("续费方式", "autoRenew", option("true", "自动续费", item.autoRenew !== false) + option("false", "手动续费", item.autoRenew === false))}${editField("支付方式", "payment", item.payment)}${editTextarea("备注", "note", item.note)}`;
  if (type === "warranties")
    html += `${editField("品牌", "brand", item.brand)}${editField("型号", "model", item.model)}${editField("购买日期", "purchaseDate", item.purchaseDate, "date")}${editField("购买金额", "purchasePrice", item.purchasePrice, "number", 'min="0" step="0.01"')}${editField("保修截止", "warrantyUntil", item.warrantyUntil, "date")}${editField("存放位置", "location", item.location)}${editField("资料链接", "link", item.link, "url")}${editTextarea("备注", "note", item.note)}`;
  if (type === "reminders") {
    const lunar = item.calendar === "lunar";
    html += `${editSelect("日历", "calendar", option("gregorian", "公历", !lunar) + option("lunar", "农历（每年）", lunar))}<span class="detail-edit-spacer"></span><div class="detail-gregorian" ${lunar ? "hidden" : ""}>${editField("开始日期", "targetDate", item.targetDate, "date")}${editSelect("重复规则", "repeat", option("none", "不重复（单次）", item.repeat === "none") + option("weekly", "每周", item.repeat === "weekly") + option("monthly", "每月", item.repeat === "monthly") + option("quarterly", "每季度", item.repeat === "quarterly") + option("yearly", "每年", item.repeat === "yearly") + option("interval", "每隔指定天数", item.repeat === "interval"))}${editField("每隔天数", "intervalDays", item.intervalDays || 1, "number", 'min="1" class="detail-interval"')}${editField("循环停止日期", "repeatUntil", item.repeatUntil, "date")}</div><div class="detail-lunar" ${lunar ? "" : "hidden"}>${editSelect("农历月份", "lunarMonth", Array.from({ length: 12 }, (_, i) => option(i + 1, `${i + 1} 月`, Number(item.lunarMonth) === i + 1)).join(""))}${editSelect("农历日期", "lunarDay", Array.from({ length: 30 }, (_, i) => option(i + 1, `${i + 1} 日`, Number(item.lunarDay) === i + 1)).join(""))}<label class="check full"><input type="checkbox" name="lunarLeap" ${item.lunarLeap ? "checked" : ""}> 闰月</label></div>${editTextarea("备注", "note", item.note)}`;
  }
  return `${html}</div>`;
}
function saveRecordEdits(type, item, form) {
  const f = new FormData(form);
  ["name", "category", "note"].forEach((key) => (item[key] = String(f.get(key) || "").trim()));
  if (!item.name) throw Error("请填写名称");
  if (type === "subscriptions") {
    ["cycle", "nextDate", "payment"].forEach((key) => (item[key] = String(f.get(key) || "")));
    item.currency = currencyCode(f.get("currency"));
    item.amount = Math.max(0, Number(f.get("amount")) || 0);
    item.autoRenew = f.get("autoRenew") !== "false";
  }
  if (type === "warranties") {
    ["brand", "model", "purchaseDate", "warrantyUntil", "location", "link"].forEach((key) => (item[key] = String(f.get(key) || "")));
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
  const item = data[type].find((x) => x.id === id);
  if (!item) return;
  const x = {
    type,
    item,
    date,
    d: days(date),
    recurring,
    done: recurring
      ? new Set(item.completedDates || []).has(date)
      : !!item.done,
  };
  const status = x.done
    ? recurring
      ? "本期已完成"
      : "已完成"
    : x.d === undefined
      ? dateText(days(date))
      : dateText(x.d);
  const typeName = meta[type][0];
  const renderDetail = () => {
    $("#detailContent").innerHTML =
      `<p class="detail-kicker">${esc(typeName)}</p><h2 class="detail-title">${esc(item.name)}</h2><div class="detail-status">${esc(status)} · ${fmt(date)}</div><div class="detail-fields">${detailRows(x)}</div>${recurring ? '<p class="detail-recurring">完成只作用于当前这一期；删除会删除整条循环提醒。</p>' : ""}<div class="detail-actions"><button type="button" class="detail-delete" data-detail-delete>删除${esc(typeName)}</button><span><button type="button" class="detail-edit" data-detail-edit>编辑</button><button type="button" class="detail-toggle" data-detail-toggle>${x.done ? "恢复为未完成" : "标记本期完成"}</button></span></div>`;
    $("[data-detail-edit]", dialog).onclick = () => renderEdit();
    $("[data-detail-toggle]", dialog).onclick = async () => {
      await toggleOverviewItem(type, id, date, recurring);
      dialog.close();
    };
    $("[data-detail-delete]", dialog).onclick = removeRecord;
  };
  const renderEdit = () => {
    $("#detailContent").innerHTML = `<p class="detail-kicker">编辑${esc(typeName)}</p><h2 class="detail-title">${esc(item.name)}</h2><form id="detailEditForm">${recordEditFields(type, item)}<div class="detail-actions"><button type="button" class="detail-delete" data-detail-cancel>取消</button><button class="detail-toggle">保存修改</button></div></form>`;
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
        alert(error.message || "保存失败，请稍后重试。");
      }
    };
  };
  const removeRecord = async () => {
    const message = recurring
      ? "删除后，这条循环提醒及所有未来期次都会消失，确定删除吗？"
      : "确定删除这条记录吗？";
    if (!confirm(message)) return;
    const index = data[type].findIndex((x) => x.id === id);
    if (index < 0) return;
    const removed = data[type].splice(index, 1)[0];
    try {
      data = await req("/api/ledger", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      dialog.close();
      render();
    } catch {
      data[type].splice(index, 0, removed);
      alert("删除失败，请稍后重试。");
    }
  };
  const dialog = $("#itemDetail");
  renderDetail();
  dialog.showModal();
}
function bindOverviewInteractions(root) {
  const toggle = (p) =>
    toggleOverviewItem(
      p.dataset.type,
      p.dataset.id,
      p.dataset.date,
      p.dataset.recurring === "true",
    );
  root.querySelectorAll("[data-toggle]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        toggle(b.closest(".swipe-item"));
      }),
  );
  root.querySelectorAll(".swipe-item").forEach((w) => {
    const card = $(".action-card", w);
    let startX = 0,
      dx = 0,
      dragging = false,
      moved = false;
    const reset = () => {
      card.style.transform = "";
      card.style.transition = "";
    };
    card.addEventListener("pointerdown", (e) => {
      startX = e.clientX;
      dx = 0;
      moved = false;
      dragging = true;
      card.setPointerCapture?.(e.pointerId);
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
        w.dataset.recurring === "true",
      );
    });
  });
}
function renderOverview() {
  const root = $("#module"),
    allItems = actionItems(),
    visibleItems = allItems.filter((x) => !(x.d < 0 && x.done)),
    items = visibleItems.filter((x) =>
      overviewFilter === "all" || overviewFilter === "done"
        ? overviewFilter === "all" || x.done
        : !x.done,
    ),
    groups = [
      ["7 天内", (x) => x.d <= 7, false],
      ["30 天内", (x) => x.d > 7 && x.d <= 30, false],
      ["一年内", (x) => x.d > 30 && x.d <= 365, false],
      ["超过一年", (x) => x.d > 365 && !x.recurring, true],
    ];
  root.innerHTML = `<div class="overview-intro"><span>接下来该做什么</span><small>${visibleItems.length ? `共 ${visibleItems.length} 项 · 已完成 ${visibleItems.filter((x) => x.done).length} 项` : "暂时没有需要处理的事项，家庭档案一切正常"}</small></div><div class="overview-filters">${[
    ["all", "全部"],
    ["todo", "未完成"],
    ["done", "已完成"],
  ]
    .map(
      ([key, label]) =>
        `<button class="${overviewFilter === key ? "active" : ""}" data-filter="${key}">${label}</button>`,
    )
    .join("")}</div><div class="timeline">${groups
    .map(([title, fn, collapsed]) => {
      const list = items.filter(fn);
      if (!list.length) return "";
      const content = `<div class="action-grid">${list.map(overviewCard).join("")}</div>`;
      return collapsed
        ? `<details class="time-group collapsible"><summary><h2>${title}<small>${list.length}</small></h2><span>展开查看</span></summary>${content}</details>`
        : `<section class="time-group"><h2>${title}<small>${list.length}</small></h2>${content}</section>`;
    })
    .join(
      "",
    )}${!items.length ? `<div class="empty"><b>✓</b><h2>${overviewFilter === "done" ? "还没有已完成事项" : "暂无未完成事项"}</h2><p>${overviewFilter === "all" ? "新增订阅、保修或提醒后，这里会自动按时间提示你。" : "切换筛选可查看其他事项。"}</p></div>` : ""}</div>`;
  root.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        overviewFilter = b.dataset.filter;
        renderOverview();
      }),
  );
  bindOverviewInteractions(root);
}
function subscriptionCard(x) {
  const d = x.nextDate ? days(x.nextDate) : null;
  return `<article class="record subscription ${x.archived ? "muted" : ""}" data-record-detail="subscriptions" data-id="${x.id}"><div class="record-icon">◒</div><div class="subscription-copy"><h3>${esc(x.name)}</h3><p>${esc(x.category || "未分类")} · ${x.autoRenew ? "自动续费" : "手动续费"}${x.payment ? ` · ${esc(x.payment)}` : ""}</p><div class="amount"><b>${subscriptionAmount(x, true)}</b><small>${x.cycle === "yearly" ? "每年" : x.cycle === "once" ? "一次性" : "每月"}</small></div></div><aside class="${d !== null && d <= 7 ? "notice" : ""}">${x.nextDate ? dateText(d) : "未设日期"}<small>${x.nextDate ? fmt(x.nextDate) : ""}</small></aside></article>`;
}
function warrantyCard(x) {
  const d = x.warrantyUntil ? days(x.warrantyUntil) : null;
  return `<article class="record warranty ${x.archived ? "muted" : ""}" data-record-detail="warranties" data-id="${x.id}"><div class="record-icon">⌂</div><div><h3>${esc(x.name)}</h3><p>${esc([x.brand, x.model, x.location].filter(Boolean).join(" · ") || "家庭物品")}</p></div><aside class="${d !== null && d <= 30 ? "notice" : ""}">${x.warrantyUntil ? (d < 0 ? "保修已结束" : d <= 30 ? "临近过保" : "保障中") : "未设保修"}<small>${x.warrantyUntil ? `至 ${fmt(x.warrantyUntil)}` : ""}</small></aside></article>`;
}
function reminderCard(x) {
  const due = nextDue(x),
    d = due ? days(due) : null;
  return `<article class="record reminder ${x.done ? "muted done" : ""}" data-record-detail="reminders" data-id="${x.id}"><div class="record-icon">${x.done ? "✓" : "◷"}</div><div><h3>${esc(x.name)}</h3><p>${esc(x.category || "未分类")} · ${esc(repeatLabel(x))}</p></div><aside class="${d !== null && d <= 7 ? "notice" : ""}">${x.done ? "已完成" : due ? dateText(d) : "未设日期"}<small>${due ? fmt(due) : ""}</small></aside></article>`;
}
function renderModule() {
  if (active === "overview") return renderOverview();
  const list = data[active].filter((x) => !x.archived);
  const root = $("#module"),
    card =
      active === "subscriptions"
        ? subscriptionCard
        : active === "warranties"
          ? warrantyCard
          : reminderCard;
  const due =
    active === "subscriptions"
      ? list.filter((x) => x.nextDate && days(x.nextDate) <= 30).length
      : active === "warranties"
        ? list.filter((x) => x.warrantyUntil && days(x.warrantyUntil) <= 60)
            .length
        : list.filter((x) => !x.done && nextDue(x) && days(nextDue(x)) <= 30)
            .length;
  root.innerHTML = `<div class="module-meta"><span>${active === "subscriptions" ? `每月预计 ≈ ${money(list.reduce((s, x) => s + (convertedAmount(x) || 0) / (x.cycle === "yearly" ? 12 : 1), 0))}` : active === "warranties" ? `已记录 ${list.length} 件家庭物品` : `待完成 ${list.filter((x) => !x.done).length} 项`}</span><small>${due ? `其中 ${due} 项近期需要关注` : "当前没有临近事项"}</small></div>${list.length ? `<div class="records ${active}">${list.map(card).join("")}</div>` : `<div class="empty"><b>⌁</b><h2>还没有${meta[active][0]}</h2><p>直接在这里新增第一条记录。</p></div>`}<button class="add-record" id="quickAddButton">+ 新增${meta[active][0]}</button>`;
  root.querySelectorAll("[data-record-detail]").forEach((record) => {
    record.tabIndex = 0;
    record.setAttribute("role", "button");
    const open = () => {
      const type = record.dataset.recordDetail;
      const item = data[type].find((x) => x.id === record.dataset.id);
      const date = type === "subscriptions" ? item?.nextDate : type === "warranties" ? item?.warrantyUntil : nextDue(item);
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
  // The new day can change recurring reminders, overdue status, and data
  // modified from another device, so reload both the view and the ledger.
  window.location.reload();
}
function scheduleMidnightRefresh() {
  clearTimeout(dayRefreshTimer);
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 1, 0);
  dayRefreshTimer = setTimeout(() => {
    refreshForNewDay();
    scheduleMidnightRefresh();
  }, Math.max(1000, next.getTime() - now.getTime()));
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
    $("#loginMessage").textContent = "服务暂不可用，请稍后重试。";
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
      body: JSON.stringify({ password: $("#password").value }),
    });
    const s = await req("/api/auth/session", { cache: "no-store" });
    if (!s.authenticated)
      throw Error("登录状态未保存，请确认浏览器允许 Cookie。");
    data = await req("/api/ledger", { cache: "no-store" });
    $("#login").hidden = true;
    $("#app").hidden = false;
    startDayWatcher();
    render();
  } catch (e) {
    $("#loginMessage").textContent = e.message;
  } finally {
    b.disabled = false;
  }
};
const uid = () =>
  crypto.randomUUID?.() ||
  `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const field = (
  label,
  name,
  value = "",
  type = "text",
  options = "",
  extra = "",
) =>
  `<div class="field"><label>${label}</label>${type === "select" ? `<select name="${name}">${options}</select>` : `<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`}</div>`;
const repeatOptions =
    '<option value="none">不重复（单次）</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="quarterly">每季度</option><option value="yearly">每年</option><option value="interval">每隔指定天数</option>',
  monthOptions = Array.from(
    { length: 12 },
    (_, i) => `<option value="${i + 1}">${i + 1} 月</option>`,
  ).join(""),
  dayOptions = Array.from(
    { length: 30 },
    (_, i) => `<option value="${i + 1}">${i + 1} 日</option>`,
  ).join("");
function openQuick(kind) {
  const today = new Date().toISOString().slice(0, 10);
  $("#quickTitle").textContent = `新增${meta[kind][0]}`;
  let html = `<div class="two">${field("名称", "name")}${field("分类", "category")}</div>`;
  if (kind === "subscriptions")
    html += `<div class="two">${field("金额", "amount", 0, "number", "", 'min="0" step="0.01" inputmode="decimal"')}${field("原始币种", "currency", "CNY", "select", currencySelect("CNY"))}</div><div class="two">${field("周期", "cycle", "monthly", "select", '<option value="monthly">每月</option><option value="yearly">每年</option><option value="once">一次性</option>')}${field("下次扣费日", "nextDate", today, "date")}</div><div class="two">${field("续费方式", "autoRenew", "true", "select", '<option value="true">自动续费</option><option value="false">手动续费</option>')}${field("支付方式", "payment")}</div>`;
  if (kind === "warranties")
    html += `<div class="two">${field("品牌", "brand")}${field("型号", "model")}</div><div class="two">${field("购买日期", "purchaseDate", today, "date")}${field("保修截止", "warrantyUntil", today, "date")}</div>`;
  if (kind === "reminders")
    html += `<div class="two">${field("日历", "calendar", "gregorian", "select", '<option value="gregorian">公历</option><option value="lunar">农历（每年）</option>')}${field("提前提醒天数", "advanceDays", 0, "number", "", 'min="0"')}</div><div id="qgreg"><div class="two">${field("开始日期", "targetDate", today, "date")}${field("重复规则", "repeat", "none", "select", repeatOptions)}</div><div class="two qinterval" hidden>${field("每隔天数", "intervalDays", 1, "number", "", 'min="1"')}<span class="hint">按开始日期循环计算</span></div></div><div id="qlunar" hidden><div class="two">${field("农历月份", "lunarMonth", 1, "select", monthOptions)}${field("农历日期", "lunarDay", 1, "select", dayOptions)}</div><label class="check"><input type="checkbox" name="lunarLeap"> 闰月</label><span class="hint">农历提醒按每年对应日期自动计算。</span></div>`;
  $("#quickFields").innerHTML = html;
  const cal = $("[name=calendar]"),
    rep = $("[name=repeat]");
  if (cal) {
    const sync = () => {
      $("#qgreg").hidden = cal.value === "lunar";
      $("#qlunar").hidden = cal.value !== "lunar";
    };
    cal.onchange = sync;
    rep.onchange = () => ($(".qinterval").hidden = rep.value !== "interval");
    sync();
  }
  $("#quickAdd").dataset.kind = kind;
  $("#quickAdd").showModal();
}
$("#quickAddForm").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.currentTarget),
    kind = $("#quickAdd").dataset.kind,
    name = String(f.get("name") || "").trim();
  if (!name) return;
  const item = {
    id: uid(),
    name,
    category: String(f.get("category") || ""),
    note: "",
    archived: false,
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
    body: JSON.stringify(data),
  });
  $("#quickAdd").close();
  render();
};
document
  .querySelectorAll("[data-quick-close]")
  .forEach((b) => (b.onclick = () => $("#quickAdd").close()));
init();
loadExchangeRates();
$("[data-detail-close]").onclick = () => $("#itemDetail").close();
const originalOpenQuick = openQuick;
openQuick = function (kind) {
  originalOpenQuick(kind);
  if (kind !== "reminders") return;
  const advance = $("[name=advanceDays]");
  advance?.closest(".field").remove();
  const repeat = $("[name=repeat]"),
    calendar = $("[name=calendar]"),
    anchor = repeat?.closest(".two");
  if (!repeat || !calendar || !anchor) return;
  const wrap = document.createElement("div"),
    fieldWrap = document.createElement("div"),
    label = document.createElement("label"),
    input = document.createElement("input"),
    hint = document.createElement("span");
  wrap.className = "two repeat-until-field";
  fieldWrap.className = "field";
  label.textContent = "循环停止日期（可不填）";
  input.name = "repeatUntil";
  input.type = "date";
  hint.className = "hint";
  hint.textContent = "到此日期后不再生成提醒";
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
