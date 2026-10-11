# How we fact-check an LLM against a 246-page government PDF

*Part 2 of the Vakeel build log · Environmental Hacks 2026 · #BharatBuilds*

Vakeel reads India's environmental clearance filings (Expert Appraisal Committee minutes, EIA reports) and turns them into plain-language warnings for the people who live next to coal plants and mines. Those warnings end up in **signed legal objections**, so a hallucinated number isn't a quality issue. It's the citizen's credibility on the line.

This post is about the piece of code that makes that safe: a verifier that checks every AI claim against the source PDF before anyone sees it.

## Rule 1: no quote, no claim

We call Amazon Bedrock (Nova 2 Lite) through the Converse API with **one tool** and `toolChoice` forced to it. The tool's input schema *is* the output we want, so the model can only answer by filling it:

```json
{ "key": "water_m3_per_day", "value": 104110,
  "label": "Fresh water drawn per day",
  "quote": "The water requirement for the proposed project is estimated as 104110 m3/day",
  "page": 14 }
```

Every fact, nearby river or forest, concern, and committee decision must carry a `quote` copied character-for-character and the `page` it came from.

## Rule 2: the quote must exist, and the number must be inside it

PDF text is messy: words split across lines (`com\npleted`), odd spaces (`m 3/day`), stray glyphs. So both the quote and every page get the same normalisation (lowercase, keep only `[a-z0-9]`), and we search:

```python
def norm(text):
    return re.sub(r"[^0-9a-z]", "", text.lower())

page = index.locate(item["quote"])          # None if not on any page
if number_digits(item["value"]) not in norm(item["quote"]):
    reject("value does not appear in its quote")
```

The second check catches a subtle failure: the model quotes a real sentence but reports a *different* number, or quietly converts units ("32.93 LMT" becomes 3,293,000 tonnes). We ask for the number exactly as written and do unit conversion in code, where it can be tested.

## Rule 3: tables need their own check

On our first real run the verifier rejected *"Barpall R.F., 2.2 km"* and *"Hasdeo River, 2.4 km"*. Both are true. The problem: they sit in a table, and PDF extraction turns a table row into `1 Barpall R. \nF.\n2.2 SW`, so a "verbatim" quote never matches.

We didn't loosen the rule; we added a second deterministic test for places. The **name** and the **distance** must appear together in one row of the same page (within 60 normalised characters), and the actual row text from the PDF becomes the quote:

```python
row = index.find_row("Barpall R. F.", 2.2)   # -> (13, "Barpall R. F. 2.2")
```

A made-up forest with a made-up distance still fails.

## Rule 4: generated prose can't introduce numbers

A second Bedrock pass writes the headline a villager will read, plus Hindi and Odia translations. Prose is where hallucinations hide, so we pull every number out of the headline and check it against the set of verified values. If one doesn't match, the headline is replaced with a deterministic template. We also block single-digit numbers that are followed by a unit ("schools within 5 km"), because that's exactly how an unsupported claim slipped through in testing.

## Rule 5: show what was thrown away

Rejected claims aren't silently dropped. Each project page has a section called **"What Vakeel refused to tell you"**, listing every claim the AI made that couldn't be proven, and why. On our first filing, that was 26 claims; across three filings, 65 rejected and 219 kept. Judges, journalists and lawyers can see the system's honesty for themselves instead of taking our word for it.

![What Vakeel refused to tell you](https://raw.githubusercontent.com/adhavan18/vakeel/main/assets/screenshots/06-refused.png)

## What this bought us

- Every number on screen has a green **✓ p.14** tick that opens the exact page with the quote highlighted.

![The evidence drawer: the quote highlighted on the real PDF page](https://raw.githubusercontent.com/adhavan18/vakeel/main/assets/screenshots/05-evidence-drawer.png)

- The objection letter's grounds are assembled by code from verified concerns only. Bedrock writes the opening and the requests, and those are rejected if they contain *any* digit.
- Money figures (₹4,887 crore a year of climate damage for one plant) are computed in Python from sourced factors, never by the model.

An LLM is a great reader and a terrible witness. Vakeel lets it read, then makes it prove everything.
