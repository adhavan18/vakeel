from . import editor, extract, geo, impact, verify

_EMPTY = {"null", "none", "n/a", "na", "nil", "not applicable", "not stated", "unknown"}


def _clean(value):
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_clean(v) for v in value]
    if isinstance(value, str) and value.strip().lower() in _EMPTY:
        return ""
    return value


def analyze_segment(segment: dict, index: verify.SourceIndex, log=print) -> dict:
    """Read one project's section end to end: extract, verify, compute, edit."""
    raw, usage = extract.extract_project(segment["text"])
    raw = _clean(raw)
    claimed = len(raw.get("facts", [])) + len(raw.get("nearby", [])) + len(raw.get("concerns", []))
    project = verify.verify_extraction(index, raw)
    decision = project.get("committeeDecision") or {}
    stage = f"{project.get('proposalType', '')} {decision.get('summary', '')}".lower()
    if decision.get("outcome") == "recommended" and ("tor" in stage.split() or "terms of reference" in stage):
        # Approving the study (ToR) is not approving the plant; never overstate it.
        decision["outcome"] = "tor_granted"
    log(
        f"Verified {claimed - len(project['rejected'])} of {claimed} claims against the source"
        + (f"; rejected {len(project['rejected'])}" if project["rejected"] else "")
    )

    location = project.setdefault("location", {})
    if not (location.get("latitude") and location.get("longitude")):
        coords = geo.find_coordinates(segment["text"])
        if coords:
            location.update(coords)
            location["source"] = "parsed from document"

    project["impact"] = impact.compute(project.get("projectType", "other"), project["facts"])
    project, edit_usage = editor.edit(project)

    project["usage"] = [usage] + ([edit_usage] if edit_usage else [])
    project["segment"] = {"index": segment["index"], "startPage": segment["startPage"]}
    return project
