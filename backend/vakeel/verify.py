"""Deterministic check of every AI claim against the source document.

The model must return a verbatim quote and page for each figure. A claim is only
kept if its quote is found in the document text and the claimed number appears
inside that quote. Anything else is dropped and recorded as rejected, so nothing
the model invents can reach a citizen.
"""

import re

PAGE_MARK_RE = re.compile(r"\[\[PAGE \d+\]\]")
MIN_QUOTE_CHARS = 10


def norm(text: str) -> str:
    return re.sub(r"[^0-9a-z]", "", PAGE_MARK_RE.sub("", text or "").lower())


def number_digits(value: float) -> str:
    formatted = f"{value:f}".rstrip("0").rstrip(".")
    return re.sub(r"[^0-9]", "", formatted)


class SourceIndex:
    def __init__(self, pages: list[str]):
        self._raw = pages
        self._pages = [norm(p) for p in pages]
        self._full = "".join(self._pages)

    def find_row(self, name: str, value: float, window: int = 60) -> tuple[int, str] | None:
        """Table rows break apart in PDF text, so a verbatim quote can fail for a real
        fact. Accept it only if the name and the number sit together in one row of a
        page, and return that row's actual text as the quote."""
        key, digits = norm(name), number_digits(value)
        if len(key) < 4 or not digits:
            return None
        for i, raw in enumerate(self._raw, 1):
            chars, index = [], []
            for j, ch in enumerate(raw):
                c = ch.lower()
                if c.isascii() and c.isalnum():
                    chars.append(c)
                    index.append(j)
            text = "".join(chars)
            at = text.find(key)
            while at >= 0:
                tail = text[at + len(key): at + len(key) + window]
                hit = tail.find(digits)
                if hit >= 0:
                    end = at + len(key) + hit + len(digits)
                    snippet = " ".join(raw[index[at]: index[end - 1] + 1].split())
                    return i, snippet
                at = text.find(key, at + 1)
        return None

    def locate(self, quote: str) -> int | None:
        """Page number containing the quote, 0 if it spans a page break, None if absent."""
        q = norm(quote)
        if len(q) < MIN_QUOTE_CHARS:
            return None
        for i, page in enumerate(self._pages, 1):
            if q in page:
                return i
        return 0 if q in self._full else None


def _check(index: SourceIndex, item: dict, value_field: str | None) -> tuple[bool, str]:
    page = index.locate(item.get("quote", ""))
    if page is None:
        return False, "quote not found in source document"
    if value_field is not None:
        value = item.get(value_field)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return False, "missing numeric value"
        if number_digits(value) not in norm(item["quote"]):
            return False, f"value {value} does not appear in its quote"
    if page:
        item["page"] = page
    item["verified"] = True
    return True, ""


def verify_extraction(index: SourceIndex, extraction: dict) -> dict:
    rejected = []

    def keep(items, value_field, kind):
        kept = []
        for item in items or []:
            if not isinstance(item, dict) or not item.get("quote") or (kind == "concern" and not item.get("title")):
                rejected.append({"kind": kind, "claim": str(item)[:80], "reason": "incomplete claim"})
                continue
            item.setdefault("explanation", "") if kind == "concern" else None
            item.setdefault("severity", "medium") if kind == "concern" else None
            ok, reason = _check(index, item, value_field)
            if not ok and kind == "nearby" and isinstance(item.get("distanceKm"), (int, float)):
                row = index.find_row(item.get("name", ""), item["distanceKm"])
                if row:
                    item["page"], item["quote"] = row
                    item["verified"], item["matchedBy"] = True, "table row"
                    ok = True
            if ok:
                kept.append(item)
            else:
                rejected.append({
                    "kind": kind,
                    "claim": item.get("label") or item.get("name") or item.get("title"),
                    "quote": (item.get("quote") or "")[:160],
                    "reason": reason,
                })
        return kept

    extraction["facts"] = keep(extraction.get("facts"), "value", "fact")
    extraction["nearby"] = keep(extraction.get("nearby"), "distanceKm", "nearby")
    extraction["concerns"] = keep(extraction.get("concerns"), None, "concern")

    decision = extraction.get("committeeDecision") or {}
    if decision.get("quote"):
        ok, reason = _check(index, decision, None)
        if not ok:
            rejected.append({"kind": "decision", "claim": decision.get("outcome"), "reason": reason})
            decision = {"outcome": "unclear", "summary": "", "verified": False}
    extraction["committeeDecision"] = decision

    location = extraction.get("location") or {}
    if location.get("quote") and index.locate(location["quote"]) is None:
        location["latitude"] = location["longitude"] = None
        rejected.append({"kind": "location", "claim": "coordinates", "reason": "quote not found in source document"})
    extraction["location"] = location

    extraction["rejected"] = rejected
    return extraction
