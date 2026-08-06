#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TWSE 取數共用工具
======================================
證交所 OpenAPI 偶爾會對 GitHub Actions 機房 IP 回「HTTP 200 但 body 不是 JSON」
（空字串或錯誤頁），造成 `resp.json()` 丟 `Expecting value: line 1 column 1 (char 0)`，
呼叫端只好整個放棄 → 掃描池退回內建 20 檔、融資融券與產業別整批消失。

這支模組把重試與診斷集中處理：
  - 帶瀏覽器 User-Agent（TWSE 對預設的 python-requests UA 較不友善）
  - 失敗重試 + 線性退避
  - body 不是 JSON 時印出狀態碼/Content-Type/前 200 字，方便事後在 Actions log 判斷原因
失敗一律回 None，由呼叫端決定降級策略（不丟例外、不中斷整條管線）。
"""

from __future__ import annotations

import time
from typing import Any, Optional

import requests

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)

DEFAULT_RETRIES = 3
DEFAULT_TIMEOUT = 30
DEFAULT_BACKOFF = 4.0   # 第 n 次失敗後等 n * BACKOFF 秒


def fetch_json(
    url: str,
    label: str,
    *,
    retries: int = DEFAULT_RETRIES,
    timeout: int = DEFAULT_TIMEOUT,
    backoff: float = DEFAULT_BACKOFF,
    headers: Optional[dict] = None,
) -> Optional[Any]:
    """抓 JSON，失敗自動重試。全部失敗回 None（已印警告，呼叫端不必再印）。"""
    hdrs = {"User-Agent": DEFAULT_UA, "Accept": "application/json"}
    if headers:
        hdrs.update(headers)

    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=hdrs, timeout=timeout)
            resp.raise_for_status()
            try:
                return resp.json()
            except ValueError:
                body = (resp.text or "").strip()
                snippet = body[:200].replace("\n", " ") if body else "(空 body)"
                print(
                    f"[警告] {label} 回傳非 JSON（第 {attempt}/{retries} 次）："
                    f"status={resp.status_code} content-type={resp.headers.get('Content-Type')} "
                    f"len={len(body)} → {snippet}"
                )
        except Exception as exc:  # noqa: BLE001
            print(f"[警告] {label} 請求失敗（第 {attempt}/{retries} 次）：{exc}")

        if attempt < retries:
            wait = attempt * backoff
            print(f"    -> {wait:.0f} 秒後重試")
            time.sleep(wait)

    print(f"[警告] {label} 重試 {retries} 次仍失敗，改用降級資料")
    return None
