"""
Historical periods data service.

Update: the data now loads straight from the GitHub repo (Data/silver/
periods_en.csv) instead of Azure Blob Storage — no Azure credentials
needed for this file anymore.

Also serves the "Did You Know?" trivia list (see `get_fun_facts` below)
so the frontend fetches it instead of hardcoding it client-side.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from threading import Lock

import pandas as pd

from app.services.data_source import fetch_csv_from_github, GithubDataError

GITHUB_PATH = "Data/silver/periods_en.csv"
CACHE_TTL_SECONDS = 15 * 60  # matches the effective lifetime st.cache_data had per session


class PeriodsDataError(Exception):
    """Raised when the periods dataset can't be loaded."""


def strip_html(text):
    if not isinstance(text, str):
        return text
    clean = re.sub(r"<[^>]+>", "", text)
    for ent, rep in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')]:
        clean = clean.replace(ent, rep)
    return clean.strip()


@dataclass
class _TTLCache:
    ttl_seconds: int
    _value: list | None = field(default=None, init=False)
    _expires_at: float = field(default=0.0, init=False)
    _lock: Lock = field(default_factory=Lock, init=False)

    def get_or_set(self, factory):
        with self._lock:
            now = time.time()
            if self._value is not None and now < self._expires_at:
                return self._value
            value = factory()
            self._value = value
            self._expires_at = now + self.ttl_seconds
            return value


_cache = _TTLCache(ttl_seconds=CACHE_TTL_SECONDS)


def _fetch_dataframe() -> pd.DataFrame:
    try:
        df = fetch_csv_from_github(GITHUB_PATH)
    except GithubDataError as exc:
        raise PeriodsDataError(str(exc)) from exc

    df.columns = df.columns.str.strip()
    for col in ["description", "collection", "from_to"]:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: strip_html(x) if pd.notna(x) else x)
    return df


def _build_records(df: pd.DataFrame) -> list[dict]:
    records = []
    for _, row in df.iterrows():
        name = strip_html(str(row.get("collection", "")))
        from_to = (
            strip_html(str(row.get("from_to", ""))).replace("\n", " ").replace("/", "\u2013").strip()
            if pd.notna(row.get("from_to"))
            else ""
        )
        full_desc = strip_html(str(row.get("description", ""))) if pd.notna(row.get("description")) else ""
        first_para = next((line.strip() for line in full_desc.split("\n") if line.strip()), full_desc)
        img = (
            str(row.get("photo_url", "")).strip()
            if pd.notna(row.get("photo_url"))
            else "https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=600"
        )
        # start_year drives the chronological sort below (negative = BC,
        # matching the sign convention already used by /api/dashboard/kemet's
        # historical_timeline, which the frontend sorts the same way). Rows
        # with a missing/unparseable start_year sort last rather than
        # crashing the whole listing.
        try:
            start_year = float(row.get("start_year"))
        except (TypeError, ValueError):
            start_year = float("inf")
        records.append(
            {
                "name": name,
                "from_to": from_to,
                "desc": first_para,
                "img": img,
                "start_year": start_year,
            }
        )
    records.sort(key=lambda r: r["start_year"])
    for r in records:
        del r["start_year"]  # internal sort key only - not part of the public PeriodRecord shape
    return records


def _load_records() -> list[dict]:
    df = _fetch_dataframe()
    return _build_records(df)


# "Did You Know?" trivia for the periods page. Hand-curated (not driven by
# a data export like the records above), but serving it from here means
# the frontend fetches it like any other real data instead of bundling a
# hardcoded array — the list can be edited/extended here without a
# frontend redeploy.
FUN_FACTS: list[str] = [
    "The ancient Egyptians invented toothpaste made from powdered ox hooves, ashes, and burnt eggshells.",
    "Cleopatra VII lived closer in time to the Moon landing than to the construction of the Great Pyramid.",
    "The Great Pyramid was the world's tallest man-made structure for 3,800 years.",
    "Ancient Egyptians shaved off their eyebrows when their cats died as a sign of mourning.",
    "Ramesses II had over 100 children and outlived most of them.",
    "The ancient Egyptians used moldy bread as an antibiotic treatment \u2014 effectively discovering penicillin 3,000 years before Fleming.",
    "Egyptian women had more rights than most ancient civilizations \u2014 they could own property, divorce, and conduct business.",
    "The Step Pyramid of Djoser (c. 2650 BC) was designed by Imhotep, the world's first named architect.",
    "Ancient Egyptians played a board game called Senet, one of the world's oldest known board games (c. 3100 BC).",
    "The Sphinx was originally painted in vivid colors \u2014 red, yellow, and blue.",
    "Workers who built the pyramids were paid laborers, not slaves \u2014 they received beer, bread, and medical care.",
    "Egypt's ancient name was 'Kemet' meaning 'the Black Land', referring to the fertile dark soil of the Nile valley.",
]


def get_fun_facts() -> list[str]:
    """Return the "Did You Know?" trivia list for the periods page."""
    return list(FUN_FACTS)


def get_periods(search: str | None = None) -> list[dict]:
    """Return period records, optionally filtered server-side.

    The React page currently filters client-side (same UX as the old
    vanilla-JS Streamlit widget), but the filter is supported here too
    so the frontend can move filtering server-side later without any
    backend changes.
    """
    records = _cache.get_or_set(_load_records)

    if search:
        q = search.lower()
        records = [r for r in records if q in r["name"].lower()]
    return records