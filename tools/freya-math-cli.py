#!/usr/bin/env python3
# Copyright (c) 2026 qbitOS / ugrad.ai. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
# Source: https://github.com/qbitOS/qbitos-freya
# Provenance: freya-math-engine-extension
# DAC/Prefix/Steno/Iron-Line/Preflight/search-history controls
"""Terminal math/data-econ helper for FreyaUnits."""

from __future__ import annotations

import argparse
import json
import math
import sys


def data_economics(tb_per_day: float, cost_per_tb: float, pct_a: float, pct_b: float) -> dict:
    total = tb_per_day * cost_per_tb
    return {
        "tbPerDay": tb_per_day,
        "costPerTbUsd": cost_per_tb,
        "totalUsd": total,
        "sliceAUsd": total * (pct_a / 100.0),
        "sliceBUsd": total * (pct_b / 100.0),
        "pctA": pct_a,
        "pctB": pct_b,
        "units": {"tb": tb_per_day, "eb": tb_per_day / 1e6, "zb": tb_per_day / 1e9},
        "runtimePath": "DAC -> Iron Line -> Prefixes -> Quantum Gutter -> .qbit -> preflight",
        "controlEnvelope": "DAC/Prefix/Steno/Iron-Line/Preflight/search-history controls",
    }


def eval_expr(expr: str) -> float:
    safe = {
        "abs": abs,
        "round": round,
        "min": min,
        "max": max,
        "pow": pow,
        "sqrt": math.sqrt,
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "asin": math.asin,
        "acos": math.acos,
        "atan": math.atan,
        "log": math.log,
        "log10": math.log10,
        "exp": math.exp,
        "pi": math.pi,
        "e": math.e,
    }
    return eval(expr, {"__builtins__": {}}, safe)  # noqa: S307


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    econ = sub.add_parser("econ", help="Compute TB/day cost and percent slices")
    econ.add_argument("--tb", type=float, required=True)
    econ.add_argument("--cost", type=float, required=True)
    econ.add_argument("--pct-a", type=float, default=20.0)
    econ.add_argument("--pct-b", type=float, default=2.0)

    expr = sub.add_parser("expr", help="Evaluate a math expression")
    expr.add_argument("expression")

    args = ap.parse_args()
    if args.cmd == "econ":
        print(json.dumps(data_economics(args.tb, args.cost, args.pct_a, args.pct_b), indent=2, ensure_ascii=True))
        return 0
    if args.cmd == "expr":
        try:
            print(eval_expr(args.expression))
            return 0
        except Exception as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
