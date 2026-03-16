#!/usr/bin/env python3
# beyondBINARY quantum-prefixed | uvspeed | {n, +1, -n, +0, 0, -1, +n, +2, -0, +3, 1}
"""Freya Codex pull API service for erika.qbitos.ai."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode

CANONICAL_BASE = os.getenv("CODEX_CANONICAL_BASE", "https://erika.qbitos.ai")
DEFAULT_API_KEYS = [k.strip() for k in os.getenv("CODEX_API_KEYS", "erika-dev-key").split(",") if k.strip()]
CHECKOUT_BASE = os.getenv("CODEX_CHECKOUT_BASE", f"{CANONICAL_BASE}/pay/checkout")
ROOT_DIR = Path(__file__).resolve().parent
FREYA_BIN = os.getenv("FREYA_BIN", str(ROOT_DIR / "freya"))
FREYA_TIMEOUT_SEC = int(os.getenv("CODEX_FREYA_TIMEOUT_SEC", "45"))

PLAN_CATALOG = {
    "starter": {"id": "starter", "name": "Starter", "monthlyUsd": 29, "rpm": 60, "features": ["chart-data", "context"]},
    "pro": {
        "id": "pro",
        "name": "Pro",
        "monthlyUsd": 99,
        "rpm": 300,
        "features": ["chart-data", "context", "split-chart", "compatibility"],
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "monthlyUsd": 499,
        "rpm": 2000,
        "features": ["chart-data", "context", "split-chart", "custom-sla"],
    },
}

BODY_BASE = {
    "Sun": 0.0,
    "Moon": 33.0,
    "Mercury": 66.0,
    "Venus": 96.0,
    "Mars": 126.0,
    "Jupiter": 156.0,
    "Saturn": 186.0,
    "Uranus": 216.0,
    "Neptune": 246.0,
    "Pluto": 276.0,
}

ASPECTS = [("conjunction", 0), ("sextile", 60), ("square", 90), ("trine", 120), ("opposition", 180)]

FREYA_TOOL_INDEX = {
    "math.expr": {"command": ["math", "expr"], "required": ["expression"], "positional": ["expression"]},
    "math.econ": {"command": ["math", "econ"], "required": ["tb", "cost"]},
    "market.convert": {"command": ["market", "convert"], "required": ["amount", "from", "to"]},
    "market.quote": {"command": ["market", "quote"], "required": ["symbol"]},
    "code.lookup": {"command": ["code", "lookup"], "required": ["code"]},
    "code.codec": {"command": ["code", "codec"], "required": ["from", "to", "text"]},
    "time.convert": {"command": ["time", "convert"], "required": []},
    "time.synclock": {"command": ["time", "synclock"], "required": ["reference-unix", "device-unix"]},
    "music.transpose": {"command": ["music", "transpose"], "required": ["notes", "semitones"]},
    "quantum.run": {"command": ["quantum", "run"], "required": ["qubits", "program"]},
    "chunk.run": {"command": ["chunk", "run"], "required": ["id"]},
}


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _parse_json(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", "0") or 0)
    raw = handler.rfile.read(length) if length > 0 else b"{}"
    try:
        obj = json.loads(raw.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"invalid json body: {exc}") from exc
    if not isinstance(obj, dict):
        raise ValueError("request body must be a JSON object")
    return obj


def _auth_ok(handler: BaseHTTPRequestHandler) -> bool:
    key = (handler.headers.get("X-API-Key") or "").strip()
    return bool(key and key in DEFAULT_API_KEYS)


def _feature_flags() -> dict:
    return {
        "dac": (ROOT_DIR / "qbit-dac.js").exists(),
        "quantumGutterPrefixes": (ROOT_DIR / "quantum-prefixes.js").exists(),
        "steno": (ROOT_DIR / "qbit-steno.js").exists(),
        "preflight": (ROOT_DIR / "qbit-preflight.js").exists(),
        "ironLine": True,
    }


def _run_freya_tool(tool_id: str, args_obj: dict) -> dict:
    spec = FREYA_TOOL_INDEX.get(tool_id)
    if not spec:
        raise ValueError(f"unknown tool id: {tool_id}")
    if not isinstance(args_obj, dict):
        raise ValueError("tool args must be an object")
    for key in spec["required"]:
        if key not in args_obj:
            raise ValueError(f"missing required arg for {tool_id}: {key}")

    cmd = [sys.executable, FREYA_BIN, *spec["command"]]
    positional_keys = set(spec.get("positional", []))
    for key in spec.get("positional", []):
        cmd.append(str(args_obj[key]))
    for k, v in args_obj.items():
        if k in positional_keys:
            continue
        if v is None:
            continue
        flag = f"--{k}"
        if isinstance(v, bool):
            if v:
                cmd.append(flag)
            continue
        cmd.extend([flag, str(v)])

    proc = subprocess.run(
        cmd,
        cwd=str(ROOT_DIR),
        text=True,
        capture_output=True,
        timeout=FREYA_TIMEOUT_SEC,
        check=False,
    )
    raw = (proc.stdout or "").strip()
    parsed = None
    if raw:
        try:
            parsed = json.loads(raw)
        except Exception:  # noqa: BLE001
            parsed = None
    return {
        "tool": tool_id,
        "command": cmd[2:],
        "exitCode": proc.returncode,
        "stdout": raw,
        "stderr": (proc.stderr or "").strip(),
        "json": parsed,
    }


def _subject_seed(subject: dict) -> int:
    stable = json.dumps(subject, sort_keys=True, ensure_ascii=True)
    digest = hashlib.sha256(stable.encode("utf-8")).hexdigest()[:16]
    return int(digest, 16)


def _build_chart_data(subject: dict, options: dict) -> dict:
    year = int(subject.get("year", 2000))
    month = int(subject.get("month", 1))
    day = int(subject.get("day", 1))
    hour = int(subject.get("hour", 0))
    minute = int(subject.get("minute", 0))
    lat = float(subject.get("latitude", 0.0))
    lon = float(subject.get("longitude", 0.0))
    name = str(subject.get("name", "Subject"))
    language = str(options.get("language", "EN"))
    theme = str(options.get("theme", "dark"))
    zodiac = str(subject.get("zodiac_type", "Tropical"))
    sidereal_mode = str(subject.get("sidereal_mode", "FAGAN_BRADLEY"))
    house_system = str(subject.get("houses_system_identifier", "P"))

    seed = _subject_seed(subject)
    t = (year * 372) + (month * 31) + day + (hour / 24.0) + (minute / 1440.0)
    bodies = []
    for i, (body, base) in enumerate(BODY_BASE.items()):
        jitter = ((seed >> (i % 16)) & 0xFF) / 255.0
        lon_deg = (base + (t * (i + 1) * 0.917) + (lon * 0.12) + (lat * 0.08) + (jitter * 9.0)) % 360.0
        sign_idx = int(lon_deg // 30) % 12
        bodies.append(
            {
                "name": body,
                "longitude": round(lon_deg, 4),
                "signIndex": sign_idx,
                "house": 1 + ((sign_idx + i) % 12),
            }
        )

    houses = []
    asc = ((lon + 180.0) % 360.0 + t * 0.1) % 360.0
    for i in range(12):
        cusp = (asc + (i * 30.0)) % 360.0
        houses.append({"house": i + 1, "cuspLongitude": round(cusp, 4)})

    aspects = []
    for i in range(len(bodies)):
        for j in range(i + 1, len(bodies)):
            a = bodies[i]
            b = bodies[j]
            diff = abs(a["longitude"] - b["longitude"])
            sep = min(diff, 360.0 - diff)
            for aspect_name, exact in ASPECTS:
                if abs(sep - exact) <= 6.0:
                    aspects.append(
                        {
                            "a": a["name"],
                            "b": b["name"],
                            "aspect": aspect_name,
                            "orb": round(abs(sep - exact), 3),
                        }
                    )
                    break

    return {
        "subject": {
            "name": name,
            "year": year,
            "month": month,
            "day": day,
            "hour": hour,
            "minute": minute,
            "latitude": lat,
            "longitude": lon,
            "zodiac_type": zodiac,
            "sidereal_mode": sidereal_mode,
            "houses_system_identifier": house_system,
        },
        "config": {"language": language, "theme": theme},
        "bodies": bodies,
        "houses": houses,
        "aspects": aspects,
        "meta": {
            "engine": "freya-codex-v1",
            "generatedAt": datetime.now(tz=timezone.utc).isoformat(),
            "canonicalBase": CANONICAL_BASE,
        },
    }


def _context_xml(chart_data: dict) -> str:
    s = chart_data["subject"]
    rows = []
    for b in chart_data["bodies"]:
        rows.append(
            f'    <body name="{b["name"]}" longitude="{b["longitude"]}" sign_index="{b["signIndex"]}" house="{b["house"]}" />'
        )
    return "\n".join(
        [
            '<chart_analysis type="FreyaCodex">',
            f'  <subject name="{s["name"]}" year="{s["year"]}" month="{s["month"]}" day="{s["day"]}" />',
            f'  <zodiac type="{s["zodiac_type"]}" sidereal_mode="{s["sidereal_mode"]}" house_system="{s["houses_system_identifier"]}" />',
            "  <bodies>",
            *rows,
            "  </bodies>",
            f'  <aspects count="{len(chart_data["aspects"])}" />',
            "</chart_analysis>",
        ]
    )


def _wheel_svg(chart_data: dict, title: str) -> str:
    points = []
    cx, cy, r = 300, 300, 240
    for b in chart_data["bodies"]:
        ang = math.radians(b["longitude"] - 90.0)
        x = cx + math.cos(ang) * (r - 30)
        y = cy + math.sin(ang) * (r - 30)
        points.append(f'<text x="{x:.2f}" y="{y:.2f}" fill="#cbd5e1" font-size="12">{b["name"][:2]}</text>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">'
        f'<rect width="100%" height="100%" fill="#0b1020" />'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" stroke="#38bdf8" fill="none" stroke-width="2" />'
        f'<text x="24" y="30" fill="#e2e8f0" font-size="18">{title}</text>'
        + "".join(points)
        + "</svg>"
    )


def _grid_svg(chart_data: dict, title: str) -> str:
    lines = [f'<text x="16" y="28" fill="#e2e8f0" font-size="16">{title} · Aspects</text>']
    y = 54
    for a in chart_data["aspects"][:24]:
        lines.append(
            f'<text x="16" y="{y}" fill="#cbd5e1" font-size="12">{a["a"]} - {a["b"]}: {a["aspect"]} (orb {a["orb"]})</text>'
        )
        y += 18
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">'
        '<rect width="100%" height="100%" fill="#0f172a" />'
        + "".join(lines)
        + "</svg>"
    )


class CodexHandler(BaseHTTPRequestHandler):
    server_version = "FreyaCodexAPI/1.0"

    def do_OPTIONS(self) -> None:  # noqa: N802
        _json_response(self, HTTPStatus.OK, {"status": "OK"})

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            _json_response(
                self,
                HTTPStatus.OK,
                {
                    "status": "OK",
                    "service": "freya-codex-api",
                    "base": CANONICAL_BASE,
                    "integration": _feature_flags(),
                },
            )
            return
        if self.path == "/api/v1/pay/plans":
            _json_response(self, HTTPStatus.OK, {"status": "OK", "plans": list(PLAN_CATALOG.values())})
            return
        if self.path == "/api/v1/system/integration":
            _json_response(
                self,
                HTTPStatus.OK,
                {
                    "status": "OK",
                    "service": "freya-codex-api",
                    "base": CANONICAL_BASE,
                    "integration": _feature_flags(),
                    "freyaToolsCount": len(FREYA_TOOL_INDEX),
                },
            )
            return
        if self.path == "/api/v1/freya/tools":
            if not _auth_ok(self):
                _json_response(self, HTTPStatus.UNAUTHORIZED, {"status": "ERROR", "message": "missing or invalid X-API-Key"})
                return
            _json_response(
                self,
                HTTPStatus.OK,
                {"status": "OK", "tools": [{"id": k, **v} for k, v in FREYA_TOOL_INDEX.items()]},
            )
            return
        _json_response(self, HTTPStatus.NOT_FOUND, {"status": "ERROR", "message": "endpoint not found"})

    def do_POST(self) -> None:  # noqa: N802
        try:
            payload = _parse_json(self)
        except Exception as exc:  # noqa: BLE001
            _json_response(self, HTTPStatus.BAD_REQUEST, {"status": "ERROR", "message": str(exc)})
            return

        path = self.path
        if (path.startswith("/api/v1/codex/") or path.startswith("/api/v1/freya/")) and not _auth_ok(self):
            _json_response(self, HTTPStatus.UNAUTHORIZED, {"status": "ERROR", "message": "missing or invalid X-API-Key"})
            return

        if path == "/api/v1/pay/checkout-link":
            plan_id = str(payload.get("planId", "")).strip().lower()
            if plan_id not in PLAN_CATALOG:
                _json_response(self, HTTPStatus.BAD_REQUEST, {"status": "ERROR", "message": "unknown planId"})
                return
            email = str(payload.get("customerEmail", "")).strip()
            params = urlencode({"plan": plan_id, "email": email})
            _json_response(
                self,
                HTTPStatus.OK,
                {"status": "OK", "checkoutUrl": f"{CHECKOUT_BASE}?{params}", "plan": PLAN_CATALOG[plan_id]},
            )
            return

        if path in {"/api/v1/codex/chart-data", "/api/v1/codex/context", "/api/v1/codex/split-chart"}:
            subject = payload.get("subject", {})
            options = payload if isinstance(payload, dict) else {}
            if not isinstance(subject, dict):
                _json_response(self, HTTPStatus.BAD_REQUEST, {"status": "ERROR", "message": "subject must be an object"})
                return
            chart_data = _build_chart_data(subject, options)

            if path == "/api/v1/codex/chart-data":
                _json_response(self, HTTPStatus.OK, {"status": "OK", "chart_data": chart_data})
                return
            if path == "/api/v1/codex/context":
                _json_response(self, HTTPStatus.OK, {"status": "OK", "context": _context_xml(chart_data), "chart_data": chart_data})
                return
            title = str(options.get("custom_title", "Freya Codex")).strip()[:40] or "Freya Codex"
            _json_response(
                self,
                HTTPStatus.OK,
                {
                    "status": "OK",
                    "chart_wheel": _wheel_svg(chart_data, title),
                    "chart_grid": _grid_svg(chart_data, title),
                    "chart_data": chart_data,
                },
            )
            return

        if path == "/api/v1/freya/run":
            tool_id = str(payload.get("tool", "")).strip()
            tool_args = payload.get("args", {})
            try:
                result = _run_freya_tool(tool_id, tool_args)
            except Exception as exc:  # noqa: BLE001
                _json_response(self, HTTPStatus.BAD_REQUEST, {"status": "ERROR", "message": str(exc)})
                return
            status = HTTPStatus.OK if result.get("exitCode", 1) == 0 else HTTPStatus.BAD_REQUEST
            _json_response(self, status, {"status": "OK" if status == HTTPStatus.OK else "ERROR", "result": result})
            return

        _json_response(self, HTTPStatus.NOT_FOUND, {"status": "ERROR", "message": "endpoint not found"})


def main() -> int:
    ap = argparse.ArgumentParser(description="Freya Codex API service")
    ap.add_argument("--host", default=os.getenv("CODEX_API_HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.getenv("CODEX_API_PORT", "8787")))
    args = ap.parse_args()
    httpd = ThreadingHTTPServer((args.host, args.port), CodexHandler)
    print(json.dumps({"status": "OK", "service": "freya-codex-api", "listen": f"{args.host}:{args.port}", "base": CANONICAL_BASE}))
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
