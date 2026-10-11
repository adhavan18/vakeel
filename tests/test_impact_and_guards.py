from vakeel import draft, editor, impact, pdf


def fact(key, value):
    return {"key": key, "value": value, "label": key, "quote": f"{key} {value}", "page": 1}


def test_coal_plant_impact_is_computed_from_capacity_with_sourced_factors():
    out = impact.compute("coal_power", [fact("capacity_added_mw", 1320), fact("water_m3_per_day", 104110), fact("coal_tonnes_per_day", 9024)])
    by_id = {m["id"]: m for m in out["metrics"]}
    assert round(by_id["co2"]["value"] / 1e6, 1) == 6.8
    assert round(out["climateCostInrPerYear"] / 1e7) == 4887
    assert by_id["water"]["headline"] == "Enough water for 7.7 lakh people, every day"
    assert by_id["coal"]["value"] == 2.4
    for m in out["metrics"]:
        assert all(f in impact.FACTORS for f in m["factors"])


def test_amendments_and_non_coal_projects_get_no_climate_cost():
    assert impact.compute("coal_power", [fact("capacity_total_mw", 2400)])["climateCostInrPerYear"] == 0
    assert impact.compute("mining", [fact("capacity_added_mw", 500)])["climateCostInrPerYear"] == 0


def test_small_water_draws_read_as_people_not_fractions_of_a_lakh():
    out = impact.compute("other", [fact("water_m3_per_day", 930)])
    assert out["metrics"][0]["headline"] == "Enough water for 6,889 people, every day"


def test_air_flag_only_when_baseline_exceeds_the_annual_standard():
    flags = impact.compute("coal_power", [fact("pm10_max_ugm3", 68.1), fact("so2_max_ugm3", 19.6)])["airFlags"]
    assert [f["pollutant"] for f in flags] == ["PM10"]


def test_headline_number_guard():
    allowed = editor._allowed_numbers({"facts": [fact("capacity_added_mw", 1320)], "nearby": [], "concerns": []})
    assert editor._numbers_ok("Adani adds 1,320 MW of coal", allowed)
    assert not editor._numbers_ok("Adani adds 1,320 MW next to 3,000 homes", allowed)
    assert not editor._numbers_ok("schools within 5 km", allowed)
    assert editor._numbers_ok("one of 2 units", allowed)


def test_signature_phrase_and_letter_hash():
    project = {"proposalNo": "IA/CG/THE/532429/2025"}
    phrase = draft.signing_phrase(project)
    assert phrase == "I object to proposal IA/CG/THE/532429/2025"
    assert draft.normalise_phrase("i OBJECT to proposal  IA/CG/THE/532429/2025.") == draft.normalise_phrase(phrase)
    assert draft.letter_hash("a") != draft.letter_hash("a ")


def test_segmenter_stitches_both_halves_and_ignores_other_meetings():
    pages = [
        "Agenda Item No 1: details of Alpha power plant",
        "Agenda Item No 2: details of Beta mine",
        "Agenda Item No. 35.1: minutes of the previous meeting confirmed",
        "Agenda No. 36.1: deliberations on Alpha. Recommended.",
        "Agenda Item no.- 36.2: deliberations on Beta. Deferred.",
        "LIST OF PARTICIPANTS",
    ]
    segments = {s["index"]: s["text"] for s in pdf.segment_projects(pages)}
    assert sorted(segments) == [1, 2]
    assert "Alpha power plant" in segments[1] and "deliberations on Alpha" in segments[1]
    assert "Beta mine" in segments[2] and "deliberations on Beta" in segments[2]
    assert all("previous meeting" not in t and "PARTICIPANTS" not in t for t in segments.values())
