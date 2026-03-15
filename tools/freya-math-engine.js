// Copyright (c) 2026 qbitOS / ugrad.ai. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Source: https://github.com/qbitOS/qbitos-freya
// Provenance: freya-math-engine-extension
// DAC/Prefix/Steno/Iron-Line/Preflight/search-history controls

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.FreyaMathEngine = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function asNum(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function toDataUnits(tb) {
    var t = asNum(tb);
    return {
      tb: t,
      eb: t / 1e6,
      zb: t / 1e9,
    };
  }

  function dataEconomics(tbPerDay, costPerTbUsd, pctA, pctB) {
    var tb = asNum(tbPerDay);
    var cost = asNum(costPerTbUsd);
    var a = asNum(pctA);
    var b = asNum(pctB);
    var total = tb * cost;
    return {
      tbPerDay: tb,
      costPerTbUsd: cost,
      totalUsd: total,
      sliceAUsd: total * (a / 100),
      sliceBUsd: total * (b / 100),
      pctA: a,
      pctB: b,
      units: toDataUnits(tb),
      runtimePath: "DAC -> Iron Line -> Prefixes -> Quantum Gutter -> .qbit -> preflight",
      controlEnvelope: "DAC/Prefix/Steno/Iron-Line/Preflight/search-history controls",
    };
  }

  function evalExpression(expr) {
    var src = String(expr || "").trim();
    if (!src) return { ok: false, error: "empty expression" };
    try {
      if (typeof math !== "undefined" && math && typeof math.evaluate === "function") {
        return { ok: true, result: math.evaluate(src) };
      }
      var f = Function('"use strict"; const {abs,ceil,floor,max,min,pow,round,sqrt,log,log10,exp,sin,cos,tan,asin,acos,atan,PI,E}=Math; return (' + src + ");");
      return { ok: true, result: f() };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  }

  return {
    dataEconomics: dataEconomics,
    evalExpression: evalExpression,
    toDataUnits: toDataUnits,
  };
});
