import io
import re

from pypdf import PdfReader

from . import config

# Matches "Agenda Item No 1:", "Agenda Item No. 42.1", "Agenda Item no.- 42.5", "Agenda No. 36.1:".
AGENDA_RE = re.compile(r"Agenda\s+(?:Item\s+)?No\.?\s*-?\s*(\d+)(?:\.(\d+))?(?!\d)", re.IGNORECASE)
CLOSING_RE = re.compile(r"LIST\s+OF\s+PARTICIPANTS|APPROVAL\s+OF\s+(?:THE\s+)?CHAIRMAN")
PAGE_MARK_RE = re.compile(r"\[\[PAGE (\d+)\]\]")


def extract_pages(data: bytes) -> list[str]:
    reader = PdfReader(io.BytesIO(data))
    if len(reader.pages) > config.MAX_PAGES:
        raise ValueError(f"Document has {len(reader.pages)} pages; limit is {config.MAX_PAGES}.")
    return [(page.extract_text() or "") for page in reader.pages]


def join_pages(pages: list[str]) -> str:
    return "".join(f"\n[[PAGE {i}]]\n{text}" for i, text in enumerate(pages, 1))


def _page_at(text: str, offset: int) -> int:
    page = 1
    for m in PAGE_MARK_RE.finditer(text, 0, offset):
        page = int(m.group(1))
    return page


def _clip(text: str) -> str:
    head, tail = config.SEGMENT_HEAD_CHARS, config.SEGMENT_TAIL_CHARS
    if len(text) <= head + tail:
        return text
    tail_start = len(text) - tail
    # Decisions in committee minutes sit at the end of each item, so keep both ends.
    return (
        text[:head]
        + "\n\n[... middle of this section omitted for length ...]\n\n"
        + f"[[PAGE {_page_at(text, tail_start)}]]\n"
        + text[tail_start:]
    )


def _markers(full: str) -> list[tuple[int, int | None]]:
    """(offset, project number) for every heading that switches which project the
    text belongs to. None closes the current span without starting a project: used for
    closing annexures and for references to other meetings' agenda items."""
    hits = [(m.start(), int(m.group(1)), m.group(2)) for m in AGENDA_RE.finditer(full)]
    dotted = [g1 for _, g1, g2 in hits if g2 is not None]
    meeting = max(set(dotted), key=dotted.count) if dotted else None
    found = []
    for pos, g1, g2 in hits:
        if g2 is None:
            found.append((pos, g1))
        else:
            found.append((pos, int(g2) if g1 == meeting else None))
    found += [(m.start(), None) for m in CLOSING_RE.finditer(full)]
    return sorted(found)


def segment_projects(pages: list[str]) -> list[dict]:
    """Split a filing into one segment per project.

    Expert Appraisal Committee minutes describe each proposal twice: once under
    "Agenda Item No N" with its details, and again later under "Agenda No. <meeting>.N"
    with the committee's deliberations and decision. Both parts are stitched back
    together per project. A standalone EIA report is treated as one project.
    """
    full = join_pages(pages)
    markers = _markers(full)
    if not any(n is not None for _, n in markers):
        return [{"index": 1, "startPage": 1, "text": _clip(full)}]

    spans: dict[int, list[str]] = {}
    first_page: dict[int, int] = {}
    for i, (start, n) in enumerate(markers):
        if n is None:
            continue
        end = markers[i + 1][0] if i + 1 < len(markers) else len(full)
        page = _page_at(full, start)
        first_page.setdefault(n, page)
        spans.setdefault(n, []).append(f"[[PAGE {page}]]\n" + full[start:end])

    segments = []
    for n in sorted(spans)[: config.MAX_PROJECTS_PER_DOC]:
        segments.append({"index": n, "startPage": first_page[n], "text": _clip("\n".join(spans[n]))})
    return segments
