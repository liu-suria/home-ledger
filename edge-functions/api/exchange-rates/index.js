import { json, requireAuth } from "../../_lib.js";

const isRate = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.response) return auth.response;
  try {
    // ECB daily reference rates cover most currencies used by the app.
    const response = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw Error("汇率服务暂不可用");
    const source = await response.json();
    const eurToCny = Number(source?.rates?.CNY);
    if (!isRate(eurToCny)) throw Error("汇率数据不完整");
    const rates = { CNY: 1, EUR: eurToCny };
    for (const [currency, eurRate] of Object.entries(source.rates || {})) {
      if (isRate(eurRate)) rates[String(currency).toUpperCase()] = eurToCny / Number(eurRate);
    }
    // BOB is not published in the ECB reference feed. Add it from a daily
    // open-access feed using its USD/CNY and USD/BOB reference pairs.
    if (!rates.BOB) {
      const bobResponse = await fetch("https://open.er-api.com/v6/latest/USD", {
        headers: { Accept: "application/json" },
      });
      if (bobResponse.ok) {
        const bobSource = await bobResponse.json();
        const usdToCny = Number(bobSource?.rates?.CNY);
        const usdToBob = Number(bobSource?.rates?.BOB);
        if (isRate(usdToCny) && isRate(usdToBob)) rates.BOB = usdToCny / usdToBob;
      }
    }
    return json({
      rates,
      date: String(source.date || ""),
      updatedAt: new Date().toISOString(),
      source: rates.BOB ? "ECB reference rates; BOB: ExchangeRate-API" : "ECB reference rates",
    }, 200, { "Cache-Control": "private, max-age=3600" });
  } catch (error) {
    return json({ error: error.message || "无法获取当前汇率" }, 503);
  }
}
