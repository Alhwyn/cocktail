#!/usr/bin/env python3
"""Cursor hook: heuristic scan for common API key / secret patterns in chat.

- beforeSubmitPrompt: blocks send if the user prompt matches.
- afterAgentResponse / afterAgentThought: appends a redacted audit line to a local log.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# High-signal patterns only; expect occasional false positives on random base64-like text.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("aws_access_key_id", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("google_api_key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("github_pat_classic", re.compile(r"\bghp_[0-9a-zA-Z]{36}\b")),
    ("github_fine_grained_pat", re.compile(r"\bgithub_pat_[a-zA-Z0-9_]{20,}\b")),
    ("slack_token", re.compile(r"\bxox[baprs]-[0-9a-zA-Z-]{10,}\b")),
    ("stripe_secret", re.compile(r"\bsk_(live|test)_[0-9a-zA-Z]{20,}\b")),
    (
        "supabase_publishable",
        re.compile(r"\bsb_publishable_[A-Za-z0-9_-]{20,}\b"),
    ),
    ("supabase_secret", re.compile(r"\bsb_secret_[A-Za-z0-9_-]{20,}\b")),
    ("openai_sk", re.compile(r"\bsk-(?:proj-)?[a-zA-Z0-9_-]{20,}\b")),
    ("anthropic_sk", re.compile(r"\bsk-ant-api(?:03)?-[a-zA-Z0-9_-]{10,}\b")),
    ("npm_token", re.compile(r"\bnpm_[A-Za-z0-9]{36}\b")),
    ("private_key_block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("generic_bearer", re.compile(r"\bBearer\s+[A-Za-z0-9._-]{24,}\b")),
    ("generic_api_key_kv", re.compile(r"(?i)\b(api[_-]?key|apikey|secret)\s*[=:]\s*['\"]?[A-Za-z0-9._+-]{20,}\b")),
]


def _first_match(text: str) -> str | None:
    for label, rx in _PATTERNS:
        if rx.search(text):
            return label
    return None


def _audit_log_line(data: dict[str, Any], event: str, kind: str) -> str:
    ts = datetime.now(timezone.utc).isoformat()
    conv = data.get("conversation_id", "")
    gen = data.get("generation_id", "")
    return f"{ts}\tevent={event}\tkind={kind}\tconversation_id={conv}\tgeneration_id={gen}\n"


def _append_audit(data: dict[str, Any], event: str, kind: str) -> None:
    roots = data.get("workspace_roots") or []
    if roots:
        log_path = Path(roots[0]) / ".cursor" / "hooks" / "api-key-audit.log"
    else:
        log_path = Path.home() / ".cursor" / "hooks" / "api-key-audit.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as fh:
        fh.write(_audit_log_line(data, event, kind))


def main() -> None:
    raw = sys.stdin.read()
    try:
        data: dict[str, Any] = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit(0)

    event = str(data.get("hook_event_name") or "")

    if "prompt" in data:
        text = str(data.get("prompt") or "")
        hit = _first_match(text)
        if hit:
            msg = (
                f"This message may contain a secret ({hit}). "
                "Remove or redact it before sending, or rephrase without pasting credentials."
            )
            print(json.dumps({"continue": False, "user_message": msg}))
            return
        print(json.dumps({"continue": True}))
        return

    if "text" in data:
        text = str(data.get("text") or "")
        hit = _first_match(text)
        if hit:
            _append_audit(data, event, hit)
        return

    sys.exit(0)


if __name__ == "__main__":
    main()
