"""Second pass: turn verified facts into a headline a resident would stop scrolling
for, rank the concerns by what matters to people living nearby, and translate.

The editor only sees verified data, and any number it writes must already exist in
that data, otherwise its headline is discarded for a deterministic fallback."""

import json
import re

from . import config, llm
from .verify import number_digits

STATE_LANGUAGE = {
    "chhattisgarh": ("hi", "Hindi"),
    "madhya pradesh": ("hi", "Hindi"),
    "uttar pradesh": ("hi", "Hindi"),
    "bihar": ("hi", "Hindi"),
    "jharkhand": ("hi", "Hindi"),
    "rajasthan": ("hi", "Hindi"),
    "haryana": ("hi", "Hindi"),
    "delhi": ("hi", "Hindi"),
    "odisha": ("or", "Odia"),
    "tamil nadu": ("ta", "Tamil"),
    "kerala": ("ml", "Malayalam"),
    "karnataka": ("kn", "Kannada"),
    "andhra pradesh": ("te", "Telugu"),
    "telangana": ("te", "Telugu"),
    "maharashtra": ("mr", "Marathi"),
    "gujarat": ("gu", "Gujarati"),
    "west bengal": ("bn", "Bengali"),
    "punjab": ("pa", "Punjabi"),
    "assam": ("as", "Assamese"),
}

SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {
            "type": "string",
            "description": "Max 22 words. Who wants to build what, where, and the one fact a neighbour would find most alarming. Active voice, concrete numbers, zero jargon.",
        },
        "dek": {"type": "string", "description": "Two short sentences expanding the headline for a resident."},
        "concernOrder": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer", "description": "Index of the concern in the input list."},
                    "severity": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                },
                "required": ["index", "severity"],
            },
        },
        "translations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "lang": {"type": "string"},
                    "headline": {"type": "string"},
                    "dek": {"type": "string"},
                },
                "required": ["lang", "headline", "dek"],
            },
        },
    },
    "required": ["headline", "dek", "concernOrder", "translations"],
}

SYSTEM = """You are the editor at Vakeel, writing for people who live next to proposed \
industrial projects in India. You only use the verified facts you are given. You never add \
a number that is not in the input. Severity is judged from a nearby resident's point of \
view: a skipped or exempted public hearing, or construction before clearance, is critical \
because it removes their legal voice; already-polluted air, forests or rivers within a few \
kilometres, and large water draws are high.

Write like the front page of a serious newspaper: the headline leads with the most \
alarming verified fact, not the company's press-release framing. Tone example (invented \
facts, never reuse them): "A cement plant that skipped its public hearing wants 40,000 \
litres of river water a minute, 1.5 km from a tiger reserve." Use the company's or \
group's name. No words like "seeks", "proposed", "potential", "may". Mention a village, \
school, clinic, forest or river only if it appears in the verified data."""


def _allowed_numbers(project: dict) -> set[str]:
    blobs = [project.get("projectName", ""), project.get("proposalType", ""), project.get("proposalNo", "")]
    for fact in project.get("facts", []):
        blobs.append(fact["quote"])
        blobs.append(number_digits(fact["value"]))
    for place in project.get("nearby", []):
        blobs.append(place["quote"])
    for concern in project.get("concerns", []):
        blobs.append(concern["quote"])
    for metric in project.get("impact", {}).get("metrics", []):
        blobs.append(metric["headline"])
    return {_digits(t) for t in _NUM_RE.findall(" ".join(blobs))}


_NUM_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _digits(token: str) -> str:
    return re.sub(r"[^0-9]", "", token)


_UNIT_AFTER = re.compile(r"\s*(km|kilomet|%|per ?cent|mw|m3|m³|cubic|crore|lakh|tonne|ton|ha\b|hectare|litre|liter|ug|µg|μg|mg)", re.I)


def _numbers_ok(text: str, allowed: set[str]) -> bool:
    for m in _NUM_RE.finditer(text):
        digits = _digits(m.group(0))
        quantity = bool(_UNIT_AFTER.match(text, m.end()))
        if (len(digits) <= 1 and not quantity) or digits in allowed:
            continue
        if not any(len(digits) >= 3 and digits in a for a in allowed):
            return False
    return True


def _fallback_headline(project: dict) -> str:
    who = project.get("parentGroup") or project.get("proponent") or "A company"
    loc = project.get("location", {})
    where = ", ".join(x for x in [loc.get("district"), loc.get("state")] if x)
    metrics = project.get("impact", {}).get("metrics", [])
    if metrics:
        return f"{who} in {where}: {metrics[0]['headline']}."
    return f"{who} wants environmental clearance in {where}."


def edit(project: dict) -> tuple[dict, dict | None]:
    loc = project.get("location", {})
    lang = STATE_LANGUAGE.get((loc.get("state") or "").strip().lower(), ("hi", "Hindi"))
    langs = [("hi", "Hindi")] + ([lang] if lang[0] != "hi" else [])

    brief = {
        "projectName": project.get("projectName"),
        "proponent": project.get("proponent"),
        "parentGroup": project.get("parentGroup"),
        "proposalType": project.get("proposalType"),
        "location": {k: loc.get(k) for k in ("village", "district", "state")},
        "committeeDecision": project.get("committeeDecision", {}).get("summary"),
        "facts": [{"label": f.get("label", f["key"]), "value": f["value"], "quote": f["quote"]} for f in project.get("facts", [])],
        "nearby": [{"name": p.get("name", ""), "kind": p.get("kind", "other"), "distanceKm": p["distanceKm"]} for p in sorted(project.get("nearby", []), key=lambda x: x["distanceKm"])],
        "impact": [m["headline"] for m in project.get("impact", {}).get("metrics", [])],
        "airFlags": [a["note"] for a in project.get("impact", {}).get("airFlags", [])],
        "concerns": [{"index": i, "title": c.get("title", ""), "explanation": c.get("explanation", "")} for i, c in enumerate(project.get("concerns", []))],
    }
    user = (
        "Write the headline and dek, rank every concern, and translate the headline and dek into: "
        + ", ".join(f"{name} (lang code '{code}')" for code, name in langs)
        + ".\n\nVerified data:\n"
        + json.dumps(brief, ensure_ascii=False, indent=1)
    )
    try:
        result, usage = llm.structured_call(
            model_id=config.DRAFT_MODEL_ID,
            system=SYSTEM,
            user=user,
            tool_name="publish",
            tool_description="Publish the edited headline, ranked concerns and translations.",
            schema=SCHEMA,
            max_tokens=3000,
        )
    except llm.BudgetExceeded:
        raise
    except Exception:  # noqa: BLE001 - the editor is cosmetic; analysis must not fail on it
        project["headline"] = _fallback_headline(project)
        project["dek"] = ""
        project["translations"] = []
        return project, None

    allowed = _allowed_numbers(project)
    rejected = project.setdefault("rejected", [])
    headline_ok = _numbers_ok(result["headline"], allowed)
    dek_ok = _numbers_ok(result["dek"], allowed)
    project["headline"] = result["headline"] if headline_ok else _fallback_headline(project)
    project["dek"] = result["dek"] if dek_ok else ""
    for field, ok in (("headline", headline_ok), ("dek", dek_ok)):
        if not ok:
            rejected.append({"kind": field, "claim": result[field], "reason": "contained a number not in the verified data"})

    translations = []
    for t in result.get("translations", []):
        if headline_ok and _numbers_ok(t.get("headline", ""), allowed):
            translations.append({
                "lang": t["lang"],
                "headline": t["headline"],
                "dek": t.get("dek", "") if dek_ok and _numbers_ok(t.get("dek", ""), allowed) else "",
            })
    project["translations"] = translations

    concerns = project.get("concerns", [])
    ordered, seen = [], set()
    for item in result.get("concernOrder", []):
        i = item.get("index")
        if isinstance(i, int) and 0 <= i < len(concerns) and i not in seen:
            seen.add(i)
            concerns[i]["severity"] = item.get("severity") or concerns[i].get("severity", "medium")
            ordered.append(concerns[i])
    ordered += [c for i, c in enumerate(concerns) if i not in seen]
    project["concerns"] = ordered
    return project, usage
