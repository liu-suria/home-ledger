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

// .build-tmp/admin/app.js
var $ = (s, r = document) => r.querySelector(s);
var data;
var state;
var labels = {
  subscriptions: "\u8D26\u5355\u4E0E\u8BA2\u9605",
  warranties: "\u7269\u54C1\u4FDD\u4FEE\u4E0E\u7EF4\u4FEE",
  reminders: "\u5012\u8BA1\u65F6\u4E0E\u63D0\u9192"
};
var uid = () => {
  var _a;
  return ((_a = crypto.randomUUID) == null ? void 0 : _a.call(crypto)) || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
};
var esc = (v) => {
  const e = document.createElement("i");
  e.textContent = v || "";
  return e.innerHTML;
};
async function req(url, opt = {}) {
  const r = await fetch(url, { credentials: "same-origin", ...opt }), j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(j.error || "\u8BF7\u6C42\u5931\u8D25");
  return j;
}
async function save() {
  data = await req("/api/ledger", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  render();
}
function move(list, i, n) {
  if (i + n < 0 || i + n >= list.length) return;
  [list[i], list[i + n]] = [list[i + n], list[i]];
  save();
}
function siteTitle() {
  const n = data.settings.siteName || "HomeLedger";
  $("#siteName").textContent = n;
  $("#mark").textContent = [...n][0] || "H";
  document.title = `${n} \xB7 \u7BA1\u7406`;
}
function renderOrder() {
  const root = $("#order");
  root.replaceChildren();
  data.settings.moduleOrder.forEach((kind, i) => {
    const wrap = document.createElement("span"), name = document.createElement("button"), up = document.createElement("button"), down = document.createElement("button");
    name.textContent = labels[kind];
    up.textContent = "\u2191";
    down.textContent = "\u2193";
    up.disabled = i === 0;
    down.disabled = i === data.settings.moduleOrder.length - 1;
    up.onclick = () => move(data.settings.moduleOrder, i, -1);
    down.onclick = () => move(data.settings.moduleOrder, i, 1);
    wrap.append(name, up, down);
    root.append(wrap);
  });
}
function detail(x) {
  if (x.targetDate || x.calendar === "lunar") {
    const due = nextDue(x);
    return ` \xB7 ${repeatLabel(x)}${due ? ` \xB7 \u4E0B\u6B21 ${due}` : ""}`;
  }
  return x.nextDate ? ` \xB7 ${x.nextDate}` : x.warrantyUntil ? ` \xB7 \u4FDD\u4FEE\u81F3 ${x.warrantyUntil}` : "";
}
function render() {
  siteTitle();
  renderOrder();
  const panels = $("#panels");
  panels.replaceChildren();
  data.settings.moduleOrder.forEach((kind) => {
    const panel = document.createElement("section");
    panel.className = "panel";
    const head = document.createElement("div");
    head.className = "panel-head";
    head.innerHTML = `<h2>${labels[kind]}</h2>`;
    const add = document.createElement("button");
    add.textContent = "+ \u65B0\u589E";
    add.onclick = () => open(kind);
    head.append(add);
    panel.append(head);
    if (!data[kind].length)
      panel.insertAdjacentHTML(
        "beforeend",
        '<div class="empty"><p>\u8FD8\u6CA1\u6709\u8BB0\u5F55</p></div>'
      );
    data[kind].forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML = `<div class="copy"><strong>${esc(item.name)}</strong><span>${esc(item.category || "\u672A\u5206\u7C7B")}${detail(item)}</span></div>`;
      const actions = [
        ["\u7F16\u8F91", () => open(kind, i)],
        ["\u2191", () => move(data[kind], i, -1)],
        ["\u2193", () => move(data[kind], i, 1)]
      ];
      if (kind === "reminders")
        actions.push([
          item.done ? "\u6062\u590D" : "\u5B8C\u6210",
          async () => {
            item.done = !item.done;
            await save();
          }
        ]);
      actions.push([
        "\u5220\u9664",
        async () => {
          if (confirm("\u786E\u8BA4\u5220\u9664\u8FD9\u6761\u8BB0\u5F55\uFF1F")) {
            data[kind].splice(i, 1);
            await save();
          }
        }
      ]);
      actions.forEach(([text, fn], bi) => {
        const b = document.createElement("button");
        b.textContent = text;
        if (bi === actions.length - 1) b.className = "delete";
        b.onclick = fn;
        row.append(b);
      });
      panel.append(row);
    });
    panels.append(panel);
  });
}
function field(label, name, value = "", type = "text", options = "", extra = "") {
  const c = type === "textarea" ? `<textarea name="${name}">${esc(value)}</textarea>` : type === "select" ? `<select name="${name}">${options}</select>` : `<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
  return `<div class="field"> <label>${label}</label>${c}</div>`;
}
var repeatOptions = '<option value="none">\u4E0D\u91CD\u590D\uFF08\u5355\u6B21\uFF09</option><option value="weekly">\u6BCF\u5468</option><option value="monthly">\u6BCF\u6708</option><option value="quarterly">\u6BCF\u5B63\u5EA6</option><option value="yearly">\u6BCF\u5E74</option><option value="interval">\u6BCF\u9694\u6307\u5B9A\u5929\u6570</option>';
var monthOptions = Array.from(
  { length: 12 },
  (_, i) => `<option value="${i + 1}">${i + 1} \u6708</option>`
).join("");
var dayOptions = Array.from(
  { length: 30 },
  (_, i) => `<option value="${i + 1}">${i + 1} \u65E5</option>`
).join("");
function reminderFields(item) {
  return `<div class="two">${field("\u65E5\u5386", "calendar", item.calendar || "gregorian", "select", '<option value="gregorian">\u516C\u5386</option><option value="lunar">\u519C\u5386\uFF08\u6BCF\u5E74\uFF09</option>')}${field("\u63D0\u524D\u63D0\u9192\u5929\u6570", "advanceDays", item.advanceDays, "number", "", 'min="0" max="365"')}</div><div id="gregorianFields"><div class="two">${field("\u5F00\u59CB\u65E5\u671F", "targetDate", item.targetDate || todayISO(), "date")}${field("\u91CD\u590D\u89C4\u5219", "repeat", item.repeat || "none", "select", repeatOptions)}</div><div class="two interval-field">${field("\u6BCF\u9694\u5929\u6570", "intervalDays", item.intervalDays || 1, "number", "", 'min="1" max="3650"')}<div class="field"><label>\u8BF4\u660E</label><span class="hint">\u6309\u5F00\u59CB\u65E5\u671F\u5FAA\u73AF\u8BA1\u7B97</span></div></div></div><div id="lunarFields" hidden><div class="two">${field("\u519C\u5386\u6708\u4EFD", "lunarMonth", item.lunarMonth || 1, "select", monthOptions)}${field("\u519C\u5386\u65E5\u671F", "lunarDay", item.lunarDay || 1, "select", dayOptions)}</div><label class="check"><input type="checkbox" name="lunarLeap" ${item.lunarLeap ? "checked" : ""}> \u95F0\u6708\uFF08\u4EC5\u7528\u4E8E\u95F0\u6708\u751F\u65E5\u7B49\u7279\u6B8A\u65E5\u671F\uFF09</label><span class="hint">\u519C\u5386\u63D0\u9192\u6309\u6BCF\u5E74\u5BF9\u5E94\u7684\u519C\u5386\u65E5\u671F\u81EA\u52A8\u8BA1\u7B97\u3002</span></div>`;
}
function switchCalendar() {
  const lunar = $("[name=calendar]").value === "lunar";
  $("#gregorianFields").hidden = lunar;
  $("#lunarFields").hidden = !lunar;
  switchRepeat();
}
function switchRepeat() {
  var _a;
  const show = ((_a = $("[name=repeat]")) == null ? void 0 : _a.value) === "interval";
  const el = $(".interval-field");
  if (el) el.hidden = !show;
}
function open(kind, index) {
  const blank = {
    id: uid(),
    name: "",
    category: "",
    note: "",
    amount: 0,
    cycle: "monthly",
    currency: "CNY",
    autoRenew: true,
    repeat: "none",
    calendar: "gregorian",
    targetDate: todayISO(),
    intervalDays: 1,
    advanceDays: 0,
    repairs: [],
    done: false
  };
  const item = index === void 0 ? blank : data[kind][index];
  state = { kind, index, item };
  $("#eyebrow").textContent = index === void 0 ? "NEW RECORD" : "EDIT RECORD";
  $("#title").textContent = `${index === void 0 ? "\u65B0\u5EFA" : "\u7F16\u8F91"}${labels[kind]}`;
  let html = `<div class="two">${field("\u540D\u79F0", "name", item.name)}${field("\u5206\u7C7B", "category", item.category)}</div>`;
  if (kind === "subscriptions")
    html += `<div class="two">${field("\u91D1\u989D", "amount", item.amount, "number")}${field("\u5468\u671F", "cycle", item.cycle, "select", '<option value="monthly">\u6BCF\u6708</option><option value="yearly">\u6BCF\u5E74</option><option value="once">\u4E00\u6B21\u6027</option>')}</div><div class="two">${field("\u4E0B\u6B21\u6263\u8D39\u65E5", "nextDate", item.nextDate, "date")}${field("\u652F\u4ED8\u65B9\u5F0F", "payment", item.payment)}</div>`;
  if (kind === "warranties")
    html += `<div class="two">${field("\u54C1\u724C", "brand", item.brand)}${field("\u578B\u53F7", "model", item.model)}</div><div class="two">${field("\u8D2D\u4E70\u65E5\u671F", "purchaseDate", item.purchaseDate, "date")}${field("\u4FDD\u4FEE\u622A\u6B62", "warrantyUntil", item.warrantyUntil, "date")}</div><div class="two">${field("\u8D2D\u4E70\u91D1\u989D", "purchasePrice", item.purchasePrice, "number")}${field("\u5B58\u653E\u4F4D\u7F6E", "location", item.location)}</div>${field("\u53D1\u7968/\u8BF4\u660E\u4E66\u94FE\u63A5", "link", item.link, "url")}`;
  if (kind === "reminders") html += reminderFields(item);
  html += field("\u5907\u6CE8", "note", item.note, "textarea");
  $("#fields").innerHTML = html;
  if (kind === "subscriptions") $("[name=cycle]").value = item.cycle;
  if (kind === "reminders") {
    $("[name=calendar]").value = item.calendar || "gregorian";
    $("[name=repeat]").value = item.repeat || "none";
    $("[name=lunarMonth]").value = item.lunarMonth || 1;
    $("[name=lunarDay]").value = item.lunarDay || 1;
    $("[name=calendar]").onchange = switchCalendar;
    $("[name=repeat]").onchange = switchRepeat;
    switchCalendar();
  }
  $("#editor").showModal();
}
$("#editorForm").onsubmit = async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  if (state.kind === "settings") {
    data.settings.siteName = String(form.get("siteName") || "").trim() || "HomeLedger";
    $("#editor").close();
    await save();
    return;
  }
  const item = { ...state.item };
  for (const [k, v] of form) item[k] = v;
  item.amount = Number(item.amount) || 0;
  item.purchasePrice = Number(item.purchasePrice) || 0;
  item.intervalDays = Math.max(1, Number(item.intervalDays) || 1);
  item.lunarLeap = form.get("lunarLeap") === "on";
  if (!item.name.trim()) return;
  item.name = item.name.trim();
  if (state.index === void 0) data[state.kind].push(item);
  else data[state.kind].splice(state.index, 1, item);
  $("#editor").close();
  await save();
};
document.querySelectorAll("[data-close]").forEach((b) => b.onclick = () => $("#editor").close());
$("#settings").onclick = () => {
  state = { kind: "settings" };
  $("#eyebrow").textContent = "SITE SETTINGS";
  $("#title").textContent = "\u7AD9\u70B9\u8BBE\u7F6E";
  $("#fields").innerHTML = field(
    "\u7AD9\u70B9\u540D\u79F0",
    "siteName",
    data.settings.siteName
  );
  $("#editor").showModal();
};
$("#export").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  );
  a.download = `home-ledger-${todayISO()}.json`;
  a.click();
};
$("#import").onclick = () => $("#file").click();
$("#file").onchange = async (e) => {
  try {
    const incoming = JSON.parse(await e.target.files[0].text());
    if (!["subscriptions", "warranties", "reminders"].every(
      (k) => Array.isArray(incoming[k])
    ))
      throw Error();
    if (confirm("\u5BFC\u5165\u5C06\u66FF\u6362\u5F53\u524D\u6240\u6709\u6570\u636E\uFF0C\u7EE7\u7EED\u5417\uFF1F")) {
      data = incoming;
      await save();
    }
  } catch {
    alert("\u4E0D\u662F\u53EF\u7528\u7684 HomeLedger JSON \u6587\u4EF6");
  }
  e.target.value = "";
};
$("#logout").onclick = async () => {
  await req("/api/auth/logout", { method: "POST" });
  location.reload();
};
$("#loginForm").onsubmit = async (e) => {
  e.preventDefault();
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
    $("#boot").hidden = true;
    $("#login").hidden = true;
    $("#adminApp").hidden = false;
    render();
  } catch (error) {
    $("#loginMessage").textContent = error.message;
  }
};
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
    $("#adminApp").hidden = false;
    render();
  } catch {
    $("#boot").hidden = true;
    $("#login").hidden = false;
  }
}
init();
var originalOpen = open;
open = function(kind, index) {
  originalOpen(kind, index);
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
  input.value = state.item.repeatUntil || "";
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
