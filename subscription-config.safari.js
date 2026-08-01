// HomeLedger/subscription-config.js
var $ = (s, r = document) => r.querySelector(s);
function addRenewField(dialog) {
  var _a;
  const title = ((_a = $("h2", dialog)) == null ? void 0 : _a.textContent) || "";
  if (!title.includes("\u8BA2\u9605") || $("[name=autoRenew]", dialog)) return;
  const target = $("#quickFields, #fields", dialog);
  if (!target) return;
  const wrap = document.createElement("div");
  wrap.className = "two";
  wrap.innerHTML = '<div class="field"><label>\u7EED\u8D39\u65B9\u5F0F</label><select name="autoRenew"><option value="true">\u81EA\u52A8\u7EED\u8D39</option><option value="false">\u624B\u52A8\u7EED\u8D39</option></select></div><span class="hint">\u652F\u4ED8\u65B9\u5F0F\u53EF\u586B\u5199\u5FAE\u4FE1\u3001\u652F\u4ED8\u5B9D\u3001\u94F6\u884C\u5361\u7B49</span>';
  target.append(wrap);
}
for (const dialog of document.querySelectorAll("dialog")) {
  new MutationObserver(() => addRenewField(dialog)).observe(dialog, {
    attributes: true,
    attributeFilter: ["open"]
  });
}
document.addEventListener(
  "submit",
  async (e) => {
    var _a;
    const dialog = $("#quickAdd");
    if (!(dialog == null ? void 0 : dialog.open) || e.target.id !== "quickAddForm" || dialog.dataset.kind !== "subscriptions")
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const f = new FormData(e.target), name = String(f.get("name") || "").trim();
    if (!name) return;
    try {
      const current = await fetch("/api/ledger", {
        credentials: "same-origin"
      }).then((r2) => r2.json());
      current.subscriptions.push({
        id: ((_a = crypto.randomUUID) == null ? void 0 : _a.call(crypto)) || `${Date.now()}_subscription`,
        name,
        category: String(f.get("category") || ""),
        amount: Number(f.get("amount")) || 0,
        cycle: String(f.get("cycle") || "monthly"),
        nextDate: String(f.get("nextDate") || ""),
        payment: String(f.get("payment") || ""),
        autoRenew: f.get("autoRenew") !== "false",
        currency: "CNY",
        note: "",
        archived: false
      });
      const r = await fetch("/api/ledger", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current)
      });
      if (!r.ok) throw Error();
      dialog.close();
      location.reload();
    } catch {
      alert("\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    }
  },
  true
);
