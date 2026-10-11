from vakeel import verify


PAGES = [
    "Some cover text",
    "Water requirement for the proposed project is estimated as 104110 m3 /day, out of which",
    "List of Reserved and protected forests:\n1 Barpall R. \nF.\n2.2 SW\n2 Kudri P.F. 6.5 NNE",
]


def test_norm_ignores_layout_noise():
    assert verify.norm("com\npleted [[PAGE 3]] 104,110 m 3/day") == "completed104110m3day"


def test_number_digits():
    assert verify.number_digits(68.1) == "681"
    assert verify.number_digits(104110.0) == "104110"
    assert verify.number_digits(2.2) == "22"


def test_locate_finds_page_and_rejects_short_or_absent_quotes():
    index = verify.SourceIndex(PAGES)
    assert index.locate("estimated as 104110 m3/day") == 2
    assert index.locate("short") is None
    assert index.locate("this sentence is not in the document") is None


def test_find_row_matches_scrambled_table_rows_only():
    index = verify.SourceIndex(PAGES)
    assert index.find_row("Barpall R. F.", 2.2) == (3, "Barpall R. \nF.\n2.2".replace("\n", " ").replace("  ", " "))
    assert index.find_row("Invented Forest", 2.2) is None
    assert index.find_row("Barpall R. F.", 9.9) is None


def test_verify_extraction_keeps_proven_claims_and_rejects_the_rest():
    index = verify.SourceIndex(PAGES)
    extraction = {
        "facts": [
            {"key": "water_m3_per_day", "value": 104110, "label": "Water", "quote": "estimated as 104110 m3 /day", "page": 9},
            {"key": "water_m3_per_day", "value": 999, "label": "Wrong number", "quote": "estimated as 104110 m3 /day", "page": 2},
            {"key": "land_ha", "value": 50, "label": "Invented", "quote": "the project needs 50 hectares of land", "page": 1},
        ],
        "nearby": [{"name": "Barpall R. F.", "kind": "reserved_forest", "distanceKm": 2.2, "quote": "Barpall R. F. 2.2 km SW", "page": 3}],
        "concerns": [{"title": "", "quote": "x"}],
        "committeeDecision": {"outcome": "recommended", "summary": "s", "quote": "not in the document anywhere at all", "page": 1},
        "location": {},
    }
    out = verify.verify_extraction(index, extraction)
    assert [f["label"] for f in out["facts"]] == ["Water"]
    assert out["facts"][0]["page"] == 2  # page corrected to where the quote really is
    assert out["nearby"][0]["matchedBy"] == "table row"
    assert out["concerns"] == []
    assert out["committeeDecision"]["outcome"] == "unclear"
    reasons = {r["reason"] for r in out["rejected"]}
    assert "value 999 does not appear in its quote" in reasons
    assert "quote not found in source document" in reasons
