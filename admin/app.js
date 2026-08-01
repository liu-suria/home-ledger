import { nextDue, repeatLabel, todayISO } from "/schedule.js";
const $ = (s, r = document) => r.querySelector(s);
let data, state;
const labels = {
  subscriptions: "账单与订阅",
  warranties: "物品保修与维修",
  reminders: "倒计时与提醒",
};
const uid = () =>
  crypto.randomUUID?.() ||
  `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const esc = (v) => {
  const e = document.createElement("i");
  e.textContent = v || "";
  return e.innerHTML;
};
async function req(url, opt = {}) {
  const r = await fetch(url, { credentials: "same-origin", ...opt }),
    j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(j.error || "请求失败");
  return j;
}
async function save() {
  data = await req("/api/ledger", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
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
  document.title = `${n} · 管理`;
}
function renderOrder() {
  const root = $("#order");
  root.replaceChildren();
  data.settings.moduleOrder.forEach((kind, i) => {
    const wrap = document.createElement("span"),
      name = document.createElement("button"),
      up = document.createElement("button"),
      down = document.createElement("button");
    name.textContent = labels[kind];
    up.textContent = "↑";
    down.textContent = "↓";
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
    return ` · ${repeatLabel(x)}${due ? ` · 下次 ${due}` : ""}`;
  }
  return x.nextDate
    ? ` · ${x.nextDate}`
    : x.warrantyUntil
      ? ` · 保修至 ${x.warrantyUntil}`
      : "";
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
    add.textContent = "+ 新增";
    add.onclick = () => open(kind);
    head.append(add);
    panel.append(head);
    if (!data[kind].length)
      panel.insertAdjacentHTML(
        "beforeend",
        '<div class="empty"><p>还没有记录</p></div>',
      );
    data[kind].forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML = `<div class="copy"><strong>${esc(item.name)}</strong><span>${esc(item.category || "未分类")}${detail(item)}</span></div>`;
      const actions = [
        ["编辑", () => open(kind, i)],
        ["↑", () => move(data[kind], i, -1)],
        ["↓", () => move(data[kind], i, 1)],
      ];
      if (kind === "reminders")
        actions.push([
          item.done ? "恢复" : "完成",
          async () => {
            item.done = !item.done;
            await save();
          },
        ]);
      actions.push([
        "删除",
        async () => {
          if (confirm("确认删除这条记录？")) {
            data[kind].splice(i, 1);
            await save();
          }
        },
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
function field(
  label,
  name,
  value = "",
  type = "text",
  options = "",
  extra = "",
) {
  const c =
    type === "textarea"
      ? `<textarea name="${name}">${esc(value)}</textarea>`
      : type === "select"
        ? `<select name="${name}">${options}</select>`
        : `<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
  return `<div class="field"> <label>${label}</label>${c}</div>`;
}
const repeatOptions =
  '<option value="none">不重复（单次）</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="quarterly">每季度</option><option value="yearly">每年</option><option value="interval">每隔指定天数</option>';
const monthOptions = Array.from(
    { length: 12 },
    (_, i) => `<option value="${i + 1}">${i + 1} 月</option>`,
  ).join(""),
  dayOptions = Array.from(
    { length: 30 },
    (_, i) => `<option value="${i + 1}">${i + 1} 日</option>`,
  ).join("");
function reminderFields(item) {
  return `<div class="two">${field("日历", "calendar", item.calendar || "gregorian", "select", '<option value="gregorian">公历</option><option value="lunar">农历（每年）</option>')}${field("提前提醒天数", "advanceDays", item.advanceDays, "number", "", 'min="0" max="365"')}</div><div id="gregorianFields"><div class="two">${field("开始日期", "targetDate", item.targetDate || todayISO(), "date")}${field("重复规则", "repeat", item.repeat || "none", "select", repeatOptions)}</div><div class="two interval-field">${field("每隔天数", "intervalDays", item.intervalDays || 1, "number", "", 'min="1" max="3650"')}<div class="field"><label>说明</label><span class="hint">按开始日期循环计算</span></div></div></div><div id="lunarFields" hidden><div class="two">${field("农历月份", "lunarMonth", item.lunarMonth || 1, "select", monthOptions)}${field("农历日期", "lunarDay", item.lunarDay || 1, "select", dayOptions)}</div><label class="check"><input type="checkbox" name="lunarLeap" ${item.lunarLeap ? "checked" : ""}> 闰月（仅用于闰月生日等特殊日期）</label><span class="hint">农历提醒按每年对应的农历日期自动计算。</span></div>`;
}
function switchCalendar() {
  const lunar = $("[name=calendar]").value === "lunar";
  $("#gregorianFields").hidden = lunar;
  $("#lunarFields").hidden = !lunar;
  switchRepeat();
}
function switchRepeat() {
  const show = $("[name=repeat]")?.value === "interval";
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
    done: false,
  };
  const item = index === undefined ? blank : data[kind][index];
  state = { kind, index, item };
  $("#eyebrow").textContent =
    index === undefined ? "NEW RECORD" : "EDIT RECORD";
  $("#title").textContent =
    `${index === undefined ? "新建" : "编辑"}${labels[kind]}`;
  let html = `<div class="two">${field("名称", "name", item.name)}${field("分类", "category", item.category)}</div>`;
  if (kind === "subscriptions")
    html += `<div class="two">${field("金额", "amount", item.amount, "number")}${field("周期", "cycle", item.cycle, "select", '<option value="monthly">每月</option><option value="yearly">每年</option><option value="once">一次性</option>')}</div><div class="two">${field("下次扣费日", "nextDate", item.nextDate, "date")}${field("支付方式", "payment", item.payment)}</div>`;
  if (kind === "warranties")
    html += `<div class="two">${field("品牌", "brand", item.brand)}${field("型号", "model", item.model)}</div><div class="two">${field("购买日期", "purchaseDate", item.purchaseDate, "date")}${field("保修截止", "warrantyUntil", item.warrantyUntil, "date")}</div><div class="two">${field("购买金额", "purchasePrice", item.purchasePrice, "number")}${field("存放位置", "location", item.location)}</div>${field("发票/说明书链接", "link", item.link, "url")}`;
  if (kind === "reminders") html += reminderFields(item);
  html += field("备注", "note", item.note, "textarea");
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
    data.settings.siteName =
      String(form.get("siteName") || "").trim() || "HomeLedger";
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
  if (state.index === undefined) data[state.kind].push(item);
  else data[state.kind].splice(state.index, 1, item);
  $("#editor").close();
  await save();
};
document
  .querySelectorAll("[data-close]")
  .forEach((b) => (b.onclick = () => $("#editor").close()));
$("#settings").onclick = () => {
  state = { kind: "settings" };
  $("#eyebrow").textContent = "SITE SETTINGS";
  $("#title").textContent = "站点设置";
  $("#fields").innerHTML = field(
    "站点名称",
    "siteName",
    data.settings.siteName,
  );
  $("#editor").showModal();
};
$("#export").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  a.download = `home-ledger-${todayISO()}.json`;
  a.click();
};
$("#import").onclick = () => $("#file").click();
$("#file").onchange = async (e) => {
  try {
    const incoming = JSON.parse(await e.target.files[0].text());
    if (
      !["subscriptions", "warranties", "reminders"].every((k) =>
        Array.isArray(incoming[k]),
      )
    )
      throw Error();
    if (confirm("导入将替换当前所有数据，继续吗？")) {
      data = incoming;
      await save();
    }
  } catch {
    alert("不是可用的 HomeLedger JSON 文件");
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
      body: JSON.stringify({ password: $("#password").value }),
    });
    const s = await req("/api/auth/session", { cache: "no-store" });
    if (!s.authenticated)
      throw Error("登录状态未保存，请确认浏览器允许 Cookie。");
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
const originalOpen = open;
open = function (kind, index) {
  originalOpen(kind, index);
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
  input.value = state.item.repeatUntil || "";
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
