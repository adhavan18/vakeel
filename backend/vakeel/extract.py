from . import config, llm

FACT_KEYS = [
    "capacity_added_mw",
    "capacity_total_mw",
    "coal_tonnes_per_day",
    "water_m3_per_day",
    "land_ha",
    "forest_land_ha",
    "project_cost_crore",
    "pm10_max_ugm3",
    "pm25_max_ugm3",
    "so2_max_ugm3",
    "nox_max_ugm3",
    "ash_tonnes_per_day",
    "people_displaced",
    "stack_height_m",
]

_quote = {"type": "string", "description": "Exact verbatim span copied from the document (5-40 words). No paraphrasing."}
_page = {"type": "integer", "description": "Number from the nearest [[PAGE n]] marker before the quote."}

SCHEMA = {
    "type": "object",
    "properties": {
        "projectName": {"type": "string"},
        "proponent": {"type": "string", "description": "Company applying for clearance, as written."},
        "parentGroup": {"type": "string", "description": "Parent business group only if the document names it, else empty."},
        "projectType": {
            "type": "string",
            "enum": ["coal_power", "other_power", "mining", "dam_hydro", "industrial", "infrastructure", "other"],
        },
        "proposalType": {"type": "string", "description": "e.g. Fresh EC, Expansion, Amendment in EC, Terms of Reference."},
        "proposalNo": {"type": "string"},
        "location": {
            "type": "object",
            "properties": {
                "village": {"type": "string"},
                "district": {"type": "string"},
                "state": {"type": "string"},
                "latitude": {"type": "number", "description": "Decimal degrees of the plant site, converted from the document's coordinates."},
                "longitude": {"type": "number"},
                "quote": _quote,
            },
            "required": ["district", "state"],
        },
        "headline": {
            "type": "string",
            "description": "One plain-English sentence (max 35 words) a villager would understand: what is being built, by whom, and the single most concrete harm, with numbers. No jargon, no hedging.",
        },
        "committeeDecision": {
            "type": "object",
            "properties": {
                "outcome": {"type": "string", "enum": ["recommended", "deferred", "returned", "rejected", "tor_granted", "unclear"]},
                "summary": {"type": "string", "description": "One plain sentence on what the committee decided."},
                "quote": _quote,
                "page": _page,
            },
            "required": ["outcome", "summary"],
        },
        "facts": {
            "type": "array",
            "maxItems": 14,
            "items": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "enum": FACT_KEYS},
                    "value": {"type": "number", "description": "The number exactly as written in the quote, in the key's unit. Skip the fact if the document uses a different unit."},
                    "label": {"type": "string", "description": "Short plain-English label."},
                    "quote": _quote,
                    "page": _page,
                },
                "required": ["key", "value", "label", "quote", "page"],
            },
        },
        "nearby": {
            "type": "array",
            "maxItems": 8,
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "kind": {"type": "string", "enum": ["river", "reserved_forest", "protected_forest", "wildlife_area", "settlement", "school", "hospital", "other"]},
                    "distanceKm": {"type": "number"},
                    "quote": _quote,
                    "page": _page,
                },
                "required": ["name", "kind", "distanceKm", "quote", "page"],
            },
        },
        "concerns": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Max 8 words."},
                    "explanation": {"type": "string", "description": "Two plain sentences on why a nearby resident should care."},
                    "severity": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                    "quote": _quote,
                    "page": _page,
                },
                "required": ["title", "explanation", "severity", "quote", "page"],
            },
        },
    },
    "required": ["projectName", "proponent", "projectType", "proposalType", "headline", "committeeDecision", "facts", "nearby", "concerns", "location"],
}

SYSTEM = """You are Vakeel, an analyst who reads Indian environmental clearance documents \
(EIA reports and Expert Appraisal Committee minutes) on behalf of the people who live next \
to the project. You translate bureaucratic text into plain facts a resident can act on.

Rules you never break:
- Every quote is copied character-for-character from the document. Never paraphrase a quote.
- Every number is reported exactly as written in its quote. Do not convert units or round.
- If a fact is not in the document, leave it out. An empty list is better than a guess. \
Never report a fact whose value is zero, nil or "not applicable"; just omit it.
- Concerns must be grounded in the text. Look first for the ones that take away residents' \
voice or are already irreversible: public hearing exempted or skipped, construction done \
before clearance, clearance lapsed or revived. Then: already-polluted baseline air, water \
drawn from a river, forests or settlements within a few km, high-ash coal, past \
non-compliance, show-cause notices, litigation, missing studies.
- Page numbers come from the [[PAGE n]] markers in the text.
- capacity_added_mw is the new generating capacity this proposal would add (a brand-new \
plant's full capacity; zero/omitted for amendments that add no capacity)."""


def extract_project(segment_text: str) -> tuple[dict, dict]:
    user = (
        "Read this section of an environmental clearance document about one project and "
        "report it using the record_project tool.\n\n<document>\n" + segment_text + "\n</document>"
    )
    return llm.structured_call(
        model_id=config.EXTRACT_MODEL_ID,
        system=SYSTEM,
        user=user,
        tool_name="record_project",
        tool_description="Record the verified facts, nearby sensitive places, concerns and committee decision for one project.",
        schema=SCHEMA,
    )
