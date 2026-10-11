"""HTTP API (API Gateway HTTP API, payload v2) for the Vakeel web app."""

import base64
import json
import re

import boto3
from botocore.exceptions import ClientError

from vakeel import config, draft, store

sfn = boto3.client("stepfunctions", region_name=config.REGION)

ROUTES = []


def route(method, pattern):
    def wrap(fn):
        ROUTES.append((method, re.compile(f"^{pattern}$"), fn))
        return fn
    return wrap


class HttpError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json", "cache-control": "no-store"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def _body(event) -> dict:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HttpError(400, "Body must be JSON")


def _doc_meta(doc_id):
    meta = store.get(f"DOC#{doc_id}", "META")
    if not meta:
        raise HttpError(404, "Document not found")
    return meta


def _public_meta(meta):
    return {k: v for k, v in meta.items() if k not in ("pk", "sk", "gsi1pk", "gsi1sk", "s3Key", "sha256")}


@route("GET", "/stats")
def stats(event, _):
    item = store.get("STATS", "GLOBAL") or {}
    return {k: item.get(k, 0) for k in ("documentsRead", "pagesRead", "projectsRead", "claimsVerified", "claimsRejected", "objectionsSigned", "damageContestedInr")}


@route("GET", "/documents")
def list_documents(event, _):
    docs = [_public_meta(d) for d in store.list_documents()]
    return {"documents": [d for d in docs if d.get("status") not in ("awaiting_upload", "duplicate")]}


@route("POST", "/documents")
def create_document(event, _):
    body = _body(event)
    name = str(body.get("fileName", "document.pdf"))[:200]
    size = int(body.get("size", 0))
    if not name.lower().endswith(".pdf"):
        raise HttpError(400, "Only PDF files are supported")
    if size <= 0 or size > config.MAX_UPLOAD_BYTES:
        raise HttpError(400, f"PDF must be under {config.MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    doc_id = store.new_id()
    key = f"uploads/{doc_id}.pdf"
    now = store.now_iso()
    store.put({
        "pk": f"DOC#{doc_id}", "sk": "META", "gsi1pk": "DOCS", "gsi1sk": now,
        "docId": doc_id, "fileName": name, "size": size, "s3Key": key,
        "status": "awaiting_upload", "createdAt": now,
        "sourceUrl": str(body.get("sourceUrl", ""))[:500],
    })
    return {"docId": doc_id, "uploadUrl": store.presign_put(key)}


@route("POST", r"/documents/(?P<doc_id>\w+)/analyze")
def analyze_document(event, params):
    meta = _doc_meta(params["doc_id"])
    if meta["status"] != "awaiting_upload":
        return {"docId": meta["docId"], "status": meta["status"]}
    size = store.object_size(meta["s3Key"])
    if not size or size > config.MAX_UPLOAD_BYTES:
        raise HttpError(400, "Upload missing or too large")
    store.update(f"DOC#{meta['docId']}", "META", status="queued")
    try:
        # Execution name = docId, so a document can only ever be analysed (and billed) once.
        sfn.start_execution(stateMachineArn=config.INGEST_STATE_MACHINE_ARN, name=f"doc-{meta['docId']}", input=json.dumps({"docId": meta["docId"]}))
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ExecutionAlreadyExists":
            raise
    store.log(meta["docId"], "Queued for reading", "milestone")
    return {"docId": meta["docId"], "status": "queued"}


@route("GET", r"/documents/(?P<doc_id>\w+)")
def get_document(event, params):
    meta = _doc_meta(params["doc_id"])
    projects = []
    for item in store.query(f"DOC#{meta['docId']}", "PROJ#"):
        data = json.loads(item["data"])
        loc = data.get("location", {})
        projects.append({
            "index": item["index"], "headline": item["headline"], "proponent": item["proponent"],
            "projectType": item["projectType"], "decision": item["decision"], "state": item["state"],
            "district": item["district"], "topConcern": item["topConcern"], "topSeverity": item["topSeverity"],
            "climateCostInr": item["climateCostInr"], "objections": item.get("objections", 0),
            "latitude": loc.get("latitude"), "longitude": loc.get("longitude"),
            "metrics": data.get("impact", {}).get("metrics", [])[:4],
        })
    logs = [{"at": l["sk"].split("#")[1], "message": l["message"], "kind": l.get("kind", "info")} for l in store.query(f"DOC#{meta['docId']}", "LOG#")]
    return {"document": _public_meta(meta), "projects": projects, "logs": logs}


@route("GET", r"/documents/(?P<doc_id>\w+)/projects/(?P<n>\d+)")
def get_project(event, params):
    meta = _doc_meta(params["doc_id"])
    item = store.get(f"DOC#{meta['docId']}", f"PROJ#{int(params['n']):03d}")
    if not item:
        raise HttpError(404, "Project not found")
    project = json.loads(item["data"])
    project.pop("usage", None)
    return {"document": _public_meta(meta), "project": project, "objections": item.get("objections", 0), "index": item["index"]}


@route("GET", r"/documents/(?P<doc_id>\w+)/pages/(?P<page>\d+)")
def get_page(event, params):
    meta = _doc_meta(params["doc_id"])
    pages = store.get_json(f"docs/{meta['docId']}/pages.json")
    n = int(params["page"])
    if not 1 <= n <= len(pages):
        raise HttpError(404, "Page out of range")
    return {"page": n, "text": pages[n - 1], "pdfUrl": store.presign_get(meta["s3Key"]) + f"#page={n}"}


@route("POST", r"/documents/(?P<doc_id>\w+)/projects/(?P<n>\d+)/objections")
def start_objection(event, params):
    meta = _doc_meta(params["doc_id"])
    item = store.get(f"DOC#{meta['docId']}", f"PROJ#{int(params['n']):03d}")
    if not item:
        raise HttpError(404, "Project not found")
    body = _body(event)
    name = str(body.get("name", "")).strip()[:80]
    place = str(body.get("place", "")).strip()[:120]
    if len(name) < 2:
        raise HttpError(400, "Please enter your name; an objection must be signed by a real person.")
    objection_id = store.new_id()
    store.put({
        "pk": f"OBJ#{objection_id}", "sk": "META", "objectionId": objection_id,
        "docId": meta["docId"], "projectIndex": int(params["n"]),
        "citizenName": name, "citizenPlace": place, "status": "drafting", "createdAt": store.now_iso(),
    })
    sfn.start_execution(stateMachineArn=config.OBJECTION_STATE_MACHINE_ARN, name=f"obj-{objection_id}", input=json.dumps({"objectionId": objection_id}))
    return {"objectionId": objection_id, "status": "drafting"}


@route("GET", r"/objections/(?P<objection_id>\w+)")
def get_objection(event, params):
    obj = store.get(f"OBJ#{params['objection_id']}", "META")
    if not obj:
        raise HttpError(404, "Objection not found")
    return {k: v for k, v in obj.items() if k not in ("pk", "sk", "taskToken")}


@route("POST", r"/objections/(?P<objection_id>\w+)/sign")
def sign_objection(event, params):
    obj = store.get(f"OBJ#{params['objection_id']}", "META")
    if not obj:
        raise HttpError(404, "Objection not found")
    if obj["status"] != "awaiting_signature" or not obj.get("taskToken"):
        raise HttpError(409, f"Objection is {obj['status']}, not awaiting a signature")
    body = _body(event)
    # Two independent checks before anything is filed: the citizen typed the exact
    # phrase, and the letter they read is byte-for-byte the letter on record.
    if draft.normalise_phrase(body.get("phrase", "")) != draft.normalise_phrase(obj["phrase"]):
        raise HttpError(400, f"Type exactly: {obj['phrase']}")
    if body.get("letterHash") != obj["letterHash"]:
        raise HttpError(409, "The letter changed since you read it. Reload and read it again before signing.")
    sfn.send_task_success(taskToken=obj["taskToken"], output=json.dumps({"signed": True}))
    store.update(f"OBJ#{obj['objectionId']}", "META", status="signing")
    return {"objectionId": obj["objectionId"], "status": "signing"}


def handler(event, context):
    method = event["requestContext"]["http"]["method"]
    path = event.get("rawPath", "/")
    if method == "OPTIONS":
        return _resp(204, {})
    for m, pattern, fn in ROUTES:
        match = pattern.match(path)
        if m == method and match:
            try:
                return _resp(200, fn(event, match.groupdict()))
            except HttpError as exc:
                return _resp(exc.status, {"error": exc.message})
    return _resp(404, {"error": f"No route for {method} {path}"})
