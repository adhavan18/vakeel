"""Step Functions task handlers for the ingest and objection workflows."""

import hashlib
import json
import re
import time

import boto3

from vakeel import config, llm, pdf, pipeline, store, verify
from vakeel import draft as drafting

llm.budget_guard = store.budget_ok


def _doc_key(doc_id: str) -> str:
    return f"DOC#{doc_id}"


def _segment_title(text: str) -> str:
    head = re.sub(r"\[\[PAGE \d+\]\]", " ", text[:900])
    head = re.sub(r"^\s*Agenda\s+(?:Item\s+)?No\.?[^:]*:\s*", "", head, flags=re.I)
    head = re.sub(r"^[\d.\s]*Details of the proposal\s*", "", head, flags=re.I)
    head = re.sub(r"\s+(?:located at|Proposal For)\b.*$", "", " ".join(head.split()), flags=re.I | re.S)
    return head[:120].rstrip(" ,.;:") + ("…" if len(head) > 120 else "")


# ---- ingest workflow ----

def segment(event, context):
    doc_id = event["docId"]
    meta = store.get(_doc_key(doc_id), "META")
    data = store.get_bytes(meta["s3Key"])
    digest = hashlib.sha256(data).hexdigest()

    existing = store.get(f"HASH#{digest}", "DOC")
    if existing and existing["docId"] != doc_id:
        original = store.get(_doc_key(existing["docId"]), "META")
        if original and original.get("status") == "ready":
            store.update(_doc_key(doc_id), "META", status="duplicate", duplicateOf=existing["docId"])
            store.log(doc_id, "Vakeel has already read this exact document. Opening the existing analysis instead of paying to read it twice.", "done")
            return {"projects": []}

    store.update(_doc_key(doc_id), "META", status="reading", sha256=digest)
    store.log(doc_id, f"Opened {meta.get('fileName', 'document')}")
    started = time.time()
    pages = pdf.extract_pages(data)
    chars = sum(len(p) for p in pages)
    store.log(doc_id, f"Extracted {len(pages):,} pages and {chars:,} characters of government text in {time.time() - started:.1f}s")

    segments = pdf.segment_projects(pages)
    store.put_json(f"docs/{doc_id}/pages.json", pages)
    for seg in segments:
        store.put_json(f"docs/{doc_id}/segments/{seg['index']}.json", seg)
    titles = [_segment_title(s["text"]) for s in segments]
    store.update(
        _doc_key(doc_id), "META",
        status="analyzing", pages=len(pages), chars=chars, projectCount=len(segments),
        projectTitles=titles, analysisStartedAt=store.now_iso(),
    )
    store.put({"pk": f"HASH#{digest}", "sk": "DOC", "docId": doc_id})
    store.log(doc_id, f"Found {len(segments)} separate project{'s' if len(segments) != 1 else ''} in this filing. Dispatching one Bedrock agent per project.", "milestone")
    return {"projects": [s["index"] for s in segments]}


def analyze(event, context):
    doc_id, n = event["docId"], int(event["index"])
    seg = store.get_json(f"docs/{doc_id}/segments/{n}.json")
    pages = store.get_json(f"docs/{doc_id}/pages.json")
    title = _segment_title(seg["text"])
    store.log(doc_id, f"Agent {n} is reading: {title}", "agent")

    def log(message):
        store.log(doc_id, f"Agent {n}: {message}", "agent")

    try:
        project = pipeline.analyze_segment(seg, verify.SourceIndex(pages), log=log)
    except llm.BudgetExceeded as exc:
        store.log(doc_id, f"Agent {n} stopped: {exc}", "error")
        raise

    decision = project.get("committeeDecision", {})
    top = project["concerns"][0] if project.get("concerns") else None
    store.put({
        "pk": _doc_key(doc_id),
        "sk": f"PROJ#{n:03d}",
        "index": n,
        "headline": project.get("headline", ""),
        "proponent": project.get("parentGroup") or project.get("proponent", ""),
        "projectType": project.get("projectType", "other"),
        "decision": decision.get("outcome", "unclear"),
        "state": project.get("location", {}).get("state", ""),
        "district": project.get("location", {}).get("district", ""),
        "topConcern": top["title"] if top else "",
        "topSeverity": top["severity"] if top else "",
        "climateCostInr": project["impact"]["climateCostInrPerYear"],
        "objections": 0,
        "data": json.dumps(project, ensure_ascii=False),
    })
    verified = len(project["facts"]) + len(project["nearby"]) + len(project["concerns"])
    rejected = len([r for r in project["rejected"] if r["kind"] in ("fact", "nearby", "concern", "decision", "location")])
    store.bump_stats(claimsVerified=verified, claimsRejected=rejected)
    log(f"Done. Headline: {project.get('headline', '')}")
    return {"index": n, "ok": True}


def _geocode(project: dict) -> None:
    loc = project.setdefault("location", {})
    query = ", ".join(x for x in [loc.get("village"), loc.get("district"), loc.get("state"), "India"] if x)
    try:
        places = boto3.client("geo-places", region_name=config.REGION)
        result = places.geocode(QueryText=query, MaxResults=1, Filter={"IncludeCountries": ["IND"]})
        items = result.get("ResultItems", [])
        if items:
            lng, lat = items[0]["Position"]
            loc.update({"latitude": lat, "longitude": lng, "source": "Amazon Location Service (approximate)"})
    except Exception:  # noqa: BLE001 - map pin is optional
        pass


def finalize(event, context):
    doc_id = event["docId"]
    meta = store.get(_doc_key(doc_id), "META")
    if meta.get("status") == "duplicate":
        return {"docId": doc_id}
    items = store.query(_doc_key(doc_id), "PROJ#")
    seen_coords = set()
    for item in items:
        project = json.loads(item["data"])
        loc = project.get("location", {})
        coord = (loc.get("latitude"), loc.get("longitude"))
        if coord[0] and coord in seen_coords:
            loc["latitude"] = loc["longitude"] = None
            coord = (None, None)
        if not coord[0]:
            _geocode(project)
        seen_coords.add((loc.get("latitude"), loc.get("longitude")))
        store.update(item["pk"], item["sk"], data=json.dumps(project, ensure_ascii=False))

    store.update(_doc_key(doc_id), "META", status="ready", completedAt=store.now_iso())
    store.bump_stats(documentsRead=1, pagesRead=meta.get("pages", 0), projectsRead=len(items))
    store.log(doc_id, f"Finished. {len(items)} projects translated for the people who live next to them.", "done")
    return {"docId": doc_id}


def fail(event, context):
    doc_id = event.get("docId")
    if doc_id:
        store.update(_doc_key(doc_id), "META", status="failed")
        cause = (event.get("error") or {}).get("Cause", "")
        store.log(doc_id, f"Could not finish reading this document. {cause[:200]}", "error")
    return event


# ---- objection workflow ----

def _objection(objection_id: str) -> dict:
    return store.get(f"OBJ#{objection_id}", "META")


def draft(event, context):
    obj = _objection(event["objectionId"])
    item = store.get(_doc_key(obj["docId"]), f"PROJ#{int(obj['projectIndex']):03d}")
    project = json.loads(item["data"])
    result = drafting.draft_letter(project, {"name": obj.get("citizenName", ""), "place": obj.get("citizenPlace", "")})
    store.update(f"OBJ#{obj['objectionId']}", "META", status="drafted", **result)
    return {"objectionId": obj["objectionId"]}


def await_signature(event, context):
    store.update(f"OBJ#{event['objectionId']}", "META", status="awaiting_signature", taskToken=event["taskToken"])
    return None


def file_objection(event, context):
    obj = _objection(event["objectionId"])
    signed_at = store.now_iso()
    receipt = hashlib.sha256(f"{obj['letterHash']}|{obj.get('citizenName', '')}|{signed_at}".encode()).hexdigest()
    store.update(f"OBJ#{obj['objectionId']}", "META", status="signed", signedAt=signed_at, receipt=receipt, taskToken="")
    item = store.get(_doc_key(obj["docId"]), f"PROJ#{int(obj['projectIndex']):03d}")
    store.table.update_item(
        Key={"pk": item["pk"], "sk": item["sk"]},
        UpdateExpression="ADD objections :one",
        ExpressionAttributeValues={":one": 1},
    )
    store.bump_stats(objectionsSigned=1, damageContestedInr=item.get("climateCostInr", 0))
    return {"objectionId": obj["objectionId"], "receipt": receipt}


def expire(event, context):
    objection_id = event.get("objectionId")
    if objection_id:
        store.update(f"OBJ#{objection_id}", "META", status="expired", taskToken="")
    return event
