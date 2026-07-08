"""
Tickets data service (Egypt heritage-site ticket prices).

Mirrors monuments_service.py / periods_service.py, pointed at the
egymonuments_tickets export in the "silver" blob container.

IMPORTANT DATA QUIRK: the raw export has two sets of foreigner-price
columns and they are NOT in the same currency —
  * `tickets_egyptian_adult` / `tickets_egyptian_student` are genuine
    EGP figures (verified against the raw `tickets_price_egyptian` text
    across the whole dataset — exact match, 0 mismatches).
  * `tickets_other_adult` / `tickets_other_student` are NOT raw EGP —
    they're the EGP price already divided by a stale baked-in ~0.0204
    USD rate from whenever the export was generated. Using them as EGP
    input to our own live conversion would silently double-convert
    every foreigner price.
So foreigner prices are parsed straight out of the `tickets_price_other_nationality`
text column instead (first "Adult: EGP X" / "Student: EGP X" match), which is
always populated and always in true EGP. Egyptian prices use the numeric
columns directly since those are already confirmed-good EGP.
"""
from __future__ import annotations

import io
import re
import time
from dataclasses import dataclass, field
from threading import Lock

import pandas as pd
import requests
from azure.storage.blob import BlobServiceClient

from app.config import Config

CONTAINER_NAME = "silver"
BLOB_NAME = "_csv_exports/egymonuments_tickets.csv"
CACHE_TTL_SECONDS = 15 * 60

EXCHANGE_RATE_API_URL = "https://open.er-api.com/v6/latest/EGP"
EXCHANGE_RATE_CACHE_TTL_SECONDS = 60 * 60  # rates don't need to be fetched more than hourly
SUPPORTED_CURRENCIES = ["EGP", "USD", "EUR"]
# Used only if the live rate API is unreachable, so the currency toggle
# still works (slightly stale) instead of breaking outright.
FALLBACK_RATES = {"EGP": 1.0, "USD": 0.0204, "EUR": 0.0188}

FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=600"


class TicketsDataError(Exception):
    """Raised when the tickets dataset can't be loaded."""


def strip_html(text):
    if not isinstance(text, str):
        return text
    clean = re.sub(r"<[^>]+>", "", text)
    for ent, rep in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')]:
        clean = clean.replace(ent, rep)
    return clean.strip()


def _clean_whitespace(text: str) -> str:
    """Collapses the runs of tabs/nbsp/newlines the free-entry text ships with."""
    return re.sub(r"[\s\xa0]+", " ", text).strip()


@dataclass
class _TTLCache:
    ttl_seconds: int
    _value: object | None = field(default=None, init=False)
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
_rates_cache = _TTLCache(ttl_seconds=EXCHANGE_RATE_CACHE_TTL_SECONDS)


def _fetch_dataframe() -> pd.DataFrame:
    connection_string = Config.AZURE_DATALAKE_CONNECTION_STRING
    if not connection_string:
        raise TicketsDataError(
            "Connection details not found. Set AZURE_DATALAKE_CONNECTION_STRING "
            "as an environment variable (.env locally, or your host's secret/variable settings)."
        )

    try:
        client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = client.get_blob_client(container=CONTAINER_NAME, blob=BLOB_NAME)
        stream = blob_client.download_blob()
        df = pd.read_csv(io.BytesIO(stream.readall()))
    except Exception as exc:  # noqa: BLE001 - surfaced to the API caller as a 502
        raise TicketsDataError(f"Error loading data: {exc}") from exc

    df.columns = df.columns.str.strip()
    for col in ["place_name", "location_display", "government", "free_entry_policy"]:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: strip_html(x) if pd.notna(x) else x)
    return df


def _first_egp_amount(text, label: str) -> float | None:
    """Pulls the first "<label>: EGP <number>" match out of a price-text blob."""
    if not isinstance(text, str):
        return None
    match = re.search(rf"{label}:\s*EGP\s*([\d.]+)", text, re.IGNORECASE)
    return float(match.group(1)) if match else None


def _build_hours(row) -> str:
    summer_open, summer_close = row.get("summer_opens"), row.get("summer_closes")
    winter_open, winter_close = row.get("winter_opens"), row.get("winter_closes")

    has_summer = pd.notna(summer_open) and pd.notna(summer_close)
    has_winter = pd.notna(winter_open) and pd.notna(winter_close)

    if has_summer and has_winter and (summer_open, summer_close) != (winter_open, winter_close):
        return f"Summer: {summer_open}\u2013{summer_close} \u00b7 Winter: {winter_open}\u2013{winter_close}"
    if has_summer:
        return f"{summer_open}\u2013{summer_close}"
    if has_winter:
        return f"{winter_open}\u2013{winter_close}"

    raw = row.get("opening_hours")
    if pd.notna(raw):
        # Collapse the multi-line raw text down to one readable line.
        return " \u00b7 ".join(line.strip() for line in str(raw).split("\n") if line.strip())
    return "Not Available"


def _build_free_policy(row) -> str:
    raw = row.get("free_entry_policy")
    if pd.notna(raw) and str(raw).strip():
        return _clean_whitespace(str(raw))

    # Fall back to the boolean flag columns when the free-text field is empty.
    clauses = []
    if row.get("free_entry_children_under_6"):
        clauses.append("children under 6")
    if row.get("free_entry_egyptian_special_needs"):
        clauses.append("Egyptians with special needs")
    if row.get("free_entry_egyptian_seniors_60"):
        clauses.append("Egyptians over 60")
    if row.get("free_entry_spouse_as_egyptian"):
        clauses.append("spouses of Egyptians (with proof)")
    text = f"Free entry: {', '.join(clauses)}." if clauses else "No published free-entry exemptions."
    if row.get("free_entry_photography_mobile"):
        text += " Free mobile photography."
    return text


def _build_records(df: pd.DataFrame) -> list[dict]:
    records = []
    for _, row in df.iterrows():
        egyptian_adult = row.get("tickets_egyptian_adult")
        egyptian_student = row.get("tickets_egyptian_student")
        foreigner_adult = _first_egp_amount(row.get("tickets_price_other_nationality"), "Adult")
        foreigner_student = _first_egp_amount(row.get("tickets_price_other_nationality"), "Student")

        booking_link = row.get("booking_link")
        if pd.isna(booking_link) or not str(booking_link).strip():
            booking_link = row.get("detail_link")

        records.append(
            {
                "id": str(row.get("id", "")),
                "name": strip_html(str(row.get("place_name", ""))),
                "location": strip_html(str(row.get("location_display", ""))) if pd.notna(row.get("location_display")) else "",
                "photo": str(row.get("photo_url", "")).strip() if pd.notna(row.get("photo_url")) else FALLBACK_IMAGE,
                "foreignerAdult": foreigner_adult,
                "foreignerStudent": foreigner_student,
                "egyptianAdult": float(egyptian_adult) if pd.notna(egyptian_adult) else None,
                "egyptianStudent": float(egyptian_student) if pd.notna(egyptian_student) else None,
                "hours": _build_hours(row),
                "bookingLink": str(booking_link).strip() if pd.notna(booking_link) and str(booking_link).strip() else None,
                "mapsLink": str(row.get("on_map", "")).strip() if pd.notna(row.get("on_map")) else None,
                "freePolicy": _build_free_policy(row),
            }
        )
    return records


def _load_records() -> list[dict]:
    df = _fetch_dataframe()
    return _build_records(df)


def get_tickets(location: str | None = None, search: str | None = None) -> list[dict]:
    """Return ticket records, optionally filtered server-side (name or location)."""
    records = _cache.get_or_set(_load_records)

    if location and location != "All":
        records = [r for r in records if r["location"] == location]
    if search:
        q = search.lower()
        records = [r for r in records if q in r["name"].lower() or q in r["location"].lower()]
    return records


def get_locations() -> list[str]:
    records = _cache.get_or_set(_load_records)
    unique_locations = sorted({r["location"] for r in records if r["location"]})
    return ["All"] + unique_locations


def _fetch_exchange_rates() -> dict:
    try:
        resp = requests.get(EXCHANGE_RATE_API_URL, timeout=5)
        resp.raise_for_status()
        payload = resp.json()
        live_rates = payload.get("rates", {})
        rates = {"EGP": 1.0}
        for currency in SUPPORTED_CURRENCIES:
            if currency == "EGP":
                continue
            rates[currency] = live_rates.get(currency, FALLBACK_RATES[currency])
        return {"rates": rates, "base": "EGP", "live": True}
    except Exception:  # noqa: BLE001 - fall back rather than break the currency toggle
        return {"rates": dict(FALLBACK_RATES), "base": "EGP", "live": False}


def get_exchange_rates() -> dict:
    """Return {EGP: 1, USD: <rate>, EUR: <rate>} — live where possible, cached hourly."""
    return _rates_cache.get_or_set(_fetch_exchange_rates)
