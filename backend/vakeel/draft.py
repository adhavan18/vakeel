"""Objection letter drafting.

The legal substance of the letter (grounds, quotes, page citations, figures) is
assembled by code from verified data only. The model writes just the opening and the
requests, and those are rejected if they contain any number, so the letter can never
assert a figure that is not in the government's own record."""

import hashlib
import re
from datetime import datetime, timedelta, timezone

from . import config, llm

IST = timezone(timedelta(hours=5, minutes=30))

SCHEMA = {
    "type": "object",
    "properties": {
        "opening": {
            "type": "string",
            "description": "2-3 sentences in first person: who the citizen is, where they live, and that they formally object. No numbers.",
        },
        "requests": {
            "type": "array",
            "minItems": 2,
            "maxItems": 4,
            "items": {"type": "string", "description": "One specific, reasonable request to the committee. No numbers."},
        },
    },
    "required": ["opening", "requests"],
}

SYSTEM = """You help Indian citizens write formal, respectful objections to environmental \
clearance proposals. Use plain, firm, legally appropriate English. Never include any number, \
date, statute section or case citation; those are added separately from verified records. \
Ground every request in the concerns you are given, e.g. ask for a public hearing to be \
held, for a cumulative impact study, for compliance to be verified before clearance."""

FALLBACK_REQUESTS = [
    "Defer any decision on this proposal until the concerns above are examined on record.",
    "Direct that a public hearing be held so that affected residents can be heard in person.",
    "Require independent verification of the project proponent's compliance with existing clearance conditions.",
]


def signing_phrase(project: dict) -> str:
    ref = project.get("proposalNo") or project.get("proponent") or "this proposal"
    return f"I object to proposal {ref}"


def normalise_phrase(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9/ ]", " ", (text or "").lower()).split())


def letter_hash(letter: str) -> str:
    return hashlib.sha256(letter.encode("utf-8")).hexdigest()


def _addressee(project: dict) -> str:
    committee = "Expert Appraisal Committee (Thermal Power Projects)" if project.get("projectType") in ("coal_power", "other_power") else "Expert Appraisal Committee"
    return (
        "The Member Secretary,\n"
        f"{committee},\n"
        "Ministry of Environment, Forest and Climate Change,\n"
        "Indira Paryavaran Bhawan, Jor Bagh Road,\n"
        "New Delhi 110003"
    )


def _grounds(project: dict) -> list[str]:
    grounds = []
    for concern in project.get("concerns", []):
        page = f", page {concern['page']}" if concern.get("page") else ""
        grounds.append(
            f"{concern['title'].rstrip('.')}. {concern.get('explanation', '').strip()} "
            f"The record states: \"{' '.join(concern['quote'].split())}\" (source document{page})."
        )
    for flag in project.get("impact", {}).get("airFlags", []):
        page = f", page {flag['input'].get('page')}" if flag["input"].get("page") else ""
        grounds.append(
            f"Air that is already polluted. {flag['note']} (Measured value from the source document{page}; "
            f"limits from {project['impact'].get('naaqsSource', 'CPCB')})"
        )
    climate = next((m for m in project.get("impact", {}).get("metrics", []) if m["id"] == "climate_cost"), None)
    if climate:
        grounds.append(
            f"Climate cost to India. Using the proposal's own stated capacity and published factors, the added "
            f"emissions represent an estimated {climate['headline'].replace('Rs ', 'Rs. ')} ({climate['formula']})."
        )
    return grounds


def draft_letter(project: dict, citizen: dict) -> dict:
    name = citizen.get("name", "").strip() or "A concerned citizen"
    place = citizen.get("place", "").strip()
    brief = {
        "citizen": {"name": name, "place": place},
        "project": {k: project.get(k) for k in ("projectName", "proponent", "parentGroup", "proposalType")},
        "location": project.get("location", {}).get("district"),
        "concerns": [{"title": c["title"], "explanation": c.get("explanation", "")} for c in project.get("concerns", [])],
    }
    opening, requests = None, None
    try:
        result, _ = llm.structured_call(
            model_id=config.DRAFT_MODEL_ID,
            system=SYSTEM,
            user=f"Write the opening and the requests for this objection.\n{brief}",
            tool_name="write_objection",
            tool_description="Return the opening paragraph and the requests of the objection letter.",
            schema=SCHEMA,
            max_tokens=1200,
        )
        texts = [result["opening"], *result["requests"]]
        if not any(re.search(r"\d", t) for t in texts):
            opening, requests = result["opening"].strip(), [r.strip() for r in result["requests"]]
    except llm.BudgetExceeded:
        raise
    except Exception:  # noqa: BLE001 - fall back to a template rather than fail the citizen
        pass

    if opening is None:
        where = f" of {place}" if place else ""
        opening = (
            f"I, {name}{where}, submit this formal objection to the proposal described below and request "
            "that it be placed on record before the committee takes any decision."
        )
        requests = FALLBACK_REQUESTS

    date = datetime.now(IST).strftime("%d %B %Y")
    subject = (
        f"Objection to {project.get('proposalType') or 'the proposal'} for "
        f"{project.get('projectName', 'the project')} by {project.get('proponent', 'the proponent')}"
        + (f" (Proposal No. {project['proposalNo']})" if project.get("proposalNo") else "")
    )
    grounds = _grounds(project)
    body = "\n\n".join([
        "To,\n" + _addressee(project),
        f"Date: {date}",
        f"Subject: {subject}",
        "Sir/Madam,",
        opening,
        "GROUNDS OF OBJECTION\n\n" + "\n\n".join(f"{i}. {g}" for i, g in enumerate(grounds, 1)),
        "REQUESTS\n\n" + "\n".join(f"{i}. {r}" for i, r in enumerate(requests, 1)),
        "I request that this objection be taken on record and that I be informed of the committee's decision.",
        f"Yours faithfully,\n{name}" + (f"\n{place}" if place else ""),
    ])
    return {"letter": body, "subject": subject, "letterHash": letter_hash(body), "phrase": signing_phrase(project)}
