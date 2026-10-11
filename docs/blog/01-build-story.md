# We built an AI that isn't allowed to make anything up, then pointed it at India's coal plant approvals

*Environmental Hacks 2026 · Bharat Builds Tour · Air track*

On 20 June 2025, a government committee in New Delhi met to decide the future of six coal power plants. Its minutes are public on PARIVESH, the national clearance portal: **246 pages, 620,940 characters**.

On page 18 there's this line:

> "Public hearing for the 2x660 MW (Phase - II) is exempted as per S.O. 1247(E)…"

That's a 1,320 MW coal expansion at Korba, Chhattisgarh, 2.2 km from the Barpall reserved forest. It draws 104,110 cubic metres a day from the Hasdeo River, the river at the heart of Hasdeo Arand, where Adivasi communities have fought coal mining for over a decade. On page 25, the committee **recommended it**.

S.O. 1247(E) is a March 2021 amendment to India's EIA Notification. When a project's clearance lapses before it's finished, the committee may waive the public hearing if the project is already **at least half built**. Korba was more than 75% built. The people who will breathe its smoke never got a hearing.

## Why this is an air problem, not a paperwork problem

- Studies link pollution from India's coal power plants to **as many as 115,000 premature deaths a year**.
- In **July 2025**, a revised notification exempted **78% of India's coal plants** from installing flue-gas desulphurisation (sulphur scrubbers).
- Committee scrutiny is thin. One analysis found the river-valley committee **rejected nothing** in six years.

That leaves the environmental clearance as the last point where anyone can say no to more coal smoke, more river water drawn and more forest lost. The law gives the people next door a voice there, through public hearings and written objections. But you can't object to a document you can't read.

So we built **Vakeel** (Hindi for *advocate*): an AI that reads these filings for the people next door, and helps them object before approval.

![Vakeel project page: the Korba expansion decoded, every figure linked to its source page](https://raw.githubusercontent.com/adhavan18/vakeel/main/assets/screenshots/04-project.png)

## The hard part wasn't reading. It was trust.

An LLM summarising legal documents is easy to build and dangerous to ship. If it invents one number ("the plant will displace 2,000 families") in a letter a citizen signs and sends to a government committee, the whole idea collapses. So we designed Vakeel around one rule: **the AI is not allowed to say anything it can't prove from the page.**

1. **Tool-forced structured output.** Amazon Bedrock (Nova 2 Lite) is called through the Converse API with a single tool whose input schema is the shape we want: facts, nearby places, concerns, the committee's decision. Each item must include a **verbatim quote** and a **page number**.
2. **A deterministic verifier.** Code normalises the quote and searches the actual PDF text for it. It also checks that the claimed number appears *inside* the quote. No match, no claim. On this filing alone, the verifier threw out 26 claims; across our three real filings it has kept 219 and rejected 65. They're shown in a section called *What Vakeel refused to tell you*.
3. **Tables fight back.** PDF extraction scrambles tables, so a true fact like "Barpall R.F. · 2.2 km" can fail an exact-quote match. Rather than loosen the rule, we added a second deterministic check: the name and the number must sit together in one row of a real page, and that row's actual text becomes the quote.
4. **The model never does the math.** "₹4,887 crore of climate damage a year" is computed in Python from the plant's stated capacity × plant load factor (CEA) × emission rate × India's social cost of carbon (Ricke et al., *Nature Climate Change*, 2018). Every factor and its source is one click away in the UI.
5. **Headlines can't sneak in numbers either.** A second Bedrock pass writes the plain-language headline and the Hindi/Odia translations. Any number in them that isn't in the verified data gets the text thrown away and replaced.
6. **Never overstate a decision.** The model once called an approved *Terms of Reference* (permission to *study* a plant) "recommended for clearance". A small rule now makes sure that can never be shown.

## Parallel agents with Step Functions

Committee minutes bundle several projects, and describe each one twice: once with its details near the front, again with the committee's deliberations near the back. Vakeel's segmenter stitches each project's two halves back together. Then a **Step Functions Map state** fans out one Bedrock agent per project, three at a time, with retries. Every agent streams progress into DynamoDB, and the UI shows six lanes reading in parallel. The whole 246-page filing goes from queued to finished in 52 seconds, for roughly 200k tokens.

![Six Bedrock agents reading one filing in parallel, with a live log](https://raw.githubusercontent.com/adhavan18/vakeel/main/assets/screenshots/02-agents.png)

## A human must sign. Step Functions waits.

Vakeel drafts a formal objection to the committee. The grounds are built **by code** from verified concerns, each with its quote and page. Bedrock writes only the opening and the requests, and those are rejected if they contain any number at all.

Then the objection state machine reaches a `lambda:invoke.waitForTaskToken` state and stops. Nothing happens until a real person reads the letter and types an exact sentence ("I object to proposal IA/CG/THE/532429/2025"). The API checks the phrase *and* that the SHA-256 of the letter they read matches the letter on record. Only then does it call `SendTaskSuccess`. The signed letter gets a receipt hash, and the citizen sends it from their own email so it carries their legal identity.

## What fought back

- **"Explicit deny in a service control policy."** Our new AWS account is a *project* pinned to a home region (Sydney). Deploying to us-east-1 failed on Lambda, DynamoDB and S3, even with AdministratorAccess. The fix was in Settings → Projects → Additional info: deploy to `ap-southeast-2`. Bedrock's `global.` inference profile made Nova 2 Lite work from Sydney with no code changes.
- **Contaminated sections.** Our first segmenter gave the last project 136 pages, including the other projects' annexures, so NTPC's Odisha plant "acquired" a river from Chhattisgarh. Splitting on both kinds of agenda headings fixed it.
- **Cost on a $100 account.** We built in an atomic daily Bedrock call cap in DynamoDB, one Step Functions execution per document (execution name = document id), SHA-256 dedupe so no PDF is paid for twice, and API throttling.

## Stack

Amazon Bedrock (Nova 2 Lite) · AWS Step Functions · AWS Lambda · Amazon DynamoDB · Amazon S3 · Amazon CloudFront · Amazon API Gateway · Amazon Location Service · Amazon Polly (the launch video's voice) · CloudFormation. Frontend: React, Tailwind, Leaflet.

## What's next

Watching PARIVESH for new filings by district, then WhatsApp and voice alerts in local languages, so a farmer near the next proposed plant hears about it from Vakeel before the objection window closes, not after.

## Sources

- S.O. 1247(E), 18 March 2021, amendment to the EIA Notification 2006 (public-hearing exemption for projects at least 50% implemented): https://dste.py.gov.in/SEIAA/pdf/Notifications/N38.pdf
- Coal power and premature deaths in India: https://www.scientificamerican.com/article/coal-fired-power-in-india-may-cause-more-than-100000-premature-deaths-annually/
- July 2025 FGD exemption for 78% of coal plants (CREA via Down To Earth): https://www.downtoearth.org.in/energy/most-sulphur-dioxide-around-delhi-comes-from-coal-plants-exempted-from-pollution-rules-crea
- EAC rejection analysis (SANDRP): https://sandrp.in/2013/02/05/analysis-of-moefs-eac-on-river-valley-projects-the-expert-approval-committee-has-zero-rejection-in-six-years/
- Hasdeo Arand protests: https://scroll.in/article/1031123/threatened-by-coal-mining-hasdeo-arand-forest-is-receiving-a-groundswell-of-support-on-the-internet
- Source filing (EAC Thermal minutes, 20 June 2025): https://parivesh.nic.in/utildoc/131396604_1751547453000.pdf
- Live app: https://d4i9n8m04ddaa.cloudfront.net · Code: https://github.com/adhavan18/vakeel
