import re

_SEP = r"[\s\n]*"
_DMS = r"(\d{1,3})" + _SEP + r"[°º]" + _SEP + r"(\d{1,2})" + _SEP + r"['′’]" + _SEP + r"(\d{1,2}(?:\.\d+)?)" + _SEP + r"(?:\"|″|”|'')?" + _SEP
DMS_PAIR = re.compile(_DMS + r"N[\s\S]{0,60}?" + _DMS + r"E")
DEC_PAIR = re.compile(r"(\d{1,2}\.\d{3,})" + _SEP + r"°?" + _SEP + r"N[\s\S]{0,40}?(\d{2}\.\d{3,})" + _SEP + r"°?" + _SEP + r"E")


def _in_india(lat: float, lng: float) -> bool:
    return 6 <= lat <= 37.5 and 68 <= lng <= 97.5


def find_coordinates(text: str) -> dict | None:
    """First plausible site coordinate pair written in the document, parsed by code
    so the map pin never depends on the model's arithmetic."""
    for m in DMS_PAIR.finditer(text):
        d1, m1, s1, d2, m2, s2 = (float(x) for x in m.groups())
        lat = d1 + m1 / 60 + s1 / 3600
        lng = d2 + m2 / 60 + s2 / 3600
        if _in_india(lat, lng):
            return {"latitude": round(lat, 5), "longitude": round(lng, 5), "quote": " ".join(m.group(0).split())}
    for m in DEC_PAIR.finditer(text):
        lat, lng = float(m.group(1)), float(m.group(2))
        if _in_india(lat, lng):
            return {"latitude": lat, "longitude": lng, "quote": " ".join(m.group(0).split())}
    return None
