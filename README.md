# Vakeel · वकील

**Read the filing before it's approved.**

**Live:** https://d4i9n8m04ddaa.cloudfront.net

Every coal plant, mine and dam in India needs an environmental clearance. The paperwork is public, on the government's PARIVESH portal, and practically unreadable: the June 2025 Expert Appraisal Committee (Thermal) minutes we use as our demo run to **246 pages and 621,869 characters**, covering six coal power projects at once.

Buried on page 18: a 1,320 MW Adani Power expansion at Korba, Chhattisgarh, 2.2 km from a reserved forest, was **exempted from its public hearing**. On page 25, the committee **recommended it**. Nobody objected, because nobody could read it.

Vakeel reads these filings for the people who live next to the projects:

1. **Read.** Upload any EIA report or committee minutes. AWS Step Functions splits it into projects and fans out one Amazon Bedrock agent per project, in parallel.
2. **Verify.** Every number the AI reports must come with a word-for-word quote and a page. Deterministic code checks each quote against the PDF and throws away anything it cannot find. Rejected claims are shown separately, never as facts.
3. **Translate.** A plain-language headline a villager would understand, in English, Hindi and the state's language (Odia, Tamil, Malayalam…). Climate cost, water and coal equivalents are **computed by code** from published factors, never by the model, and every factor shows its source.
4. **Object.** Vakeel drafts a formal objection to the committee from the record itself, with grounds that quote the filing with page numbers. It cannot file anything on its own: a real person must read the letter and type an exact sentence to sign. Step Functions waits for that human (task token), and the signed letter is locked with a SHA-256 receipt.

**Track:** Air. Coal power plants are India's largest industrial source of air pollution, and the clearance file is the last point where residents have a legal voice.

## What it found in one real filing

From the 26th EAC (Thermal) meeting, 20 June 2025 (`parivesh.nic.in/utildoc/131396604_1751547453000.pdf`):

| Project | Committee decision | What Vakeel surfaced |
|---|---|---|
| Korba Power (Adani Power), 1,320 MW, Chhattisgarh | Recommended | Public hearing exempted; 104,110 m³/day from the Hasdeo River (water for 7.7 lakh people); baseline PM2.5 already above the annual standard; est. ₹4,887 crore/yr climate damage |
| GMR Kamalanga, 350 MW, Odisha | Recommended | Public hearing exempted; high-ash coal; river water draw; forests within 10 km |
| Jindal Power, Tamnar, Chhattisgarh | Deferred | 31 non-compliances reported by the Regional Office |
| NTPC Darlipali Stage II, Odisha | Returned | Pending human-rights court case on pollution and health hazards |
| NLC Talabira, 800 MW, Odisha | Study (ToR) approved | Already-polluted baseline; river water draw |
| KSK Mahanadi expansion, Chhattisgarh | Returned | Wildlife area 1.17 km away |

The whole filing was read for roughly 200k Bedrock tokens. The verifier rejected about 40 AI claims that were not word-for-word in the source.

## Architecture

```
Browser ─► CloudFront + S3 (React app)
   │
   ├─► API Gateway (HTTP API, throttled) ─► Lambda (api)
   │        ├─ presigned S3 upload
   │        ├─ starts Step Functions
   │        └─ reads DynamoDB
   │
   ├─ Ingest state machine (Step Functions, STANDARD)
   │     Segment (Lambda: pypdf, split projects) ─► Map, 1 agent per project, MaxConcurrency 3
   │        └─ Analyze (Lambda) ─► Amazon Bedrock Converse, Nova 2 Lite, tool-forced JSON
   │              ─► verify quotes against PDF ─► impact math in code ─► editor pass + translation
   │     ─► Finalize (dedupe coordinates, Amazon Location geocode fallback)
   │
   └─ Objection state machine
         Draft (Bedrock writes opening/requests only; grounds assembled by code)
         ─► AwaitSignature (lambda:invoke.waitForTaskToken, 7-day timeout)
         ─► File (SHA-256 receipt, counters) │ Expire
```

AWS services: **Amazon Bedrock** (Nova 2 Lite), **AWS Step Functions** (Map state, waitForTaskToken), **AWS Lambda**, **Amazon API Gateway**, **Amazon DynamoDB**, **Amazon S3**, **Amazon CloudFront**, **Amazon Location Service** (geocode fallback), **Amazon Polly** (launch video voiceover), **AWS CloudFormation** (SAM transform).

## Guardrails

- **No unverified numbers.** Facts, distances, concerns and the committee decision each need a verbatim quote found on a real page. Table rows, which PDF text scrambles, are verified by matching the name and value within the same row.
- **The model never does the math.** CO₂, ₹ climate cost, water and coal equivalents are computed in `backend/vakeel/impact.py` with sourced factors (CEA, Ricke et al. 2018 for India's social cost of carbon, CPHEEO, CPCB NAAQS).
- **Headlines cannot invent numbers.** Any number in a generated headline, dek or translation that is not in the verified data gets the text replaced.
- **Never overstate a decision.** "Terms of Reference granted" (approval to study) is never shown as "recommended for clearance".
- **A human signs everything.** Exact-phrase signature plus letter-hash check before Step Functions continues.
- **Cost controls for a $100 free-plan account.** Atomic daily Bedrock call cap in DynamoDB, page, size and project limits, API throttling, one Step Functions execution per document (execution name = document id), and content-hash dedupe so the same PDF is never paid for twice.

## Repo layout

```
backend/vakeel/     pipeline: pdf, extract, verify, impact, editor, draft, geo, store, llm
backend/handlers/   api.py (HTTP API), workers.py (Step Functions tasks)
infra/template.yaml CloudFormation + SAM transform
web/                React + Vite + Tailwind app (?mock runs it offline on a real exported analysis)
video/              Remotion launch film + Playwright recorder for real product footage
scripts/            analyze_local.py (run the pipeline locally), deploy.sh
```

## Run it

```bash
# analyse a filing locally against Bedrock (needs AWS credentials with Bedrock access)
pip install -r requirements.txt
python scripts/analyze_local.py path/to/filing.pdf

# preview the web app offline on the exported analysis
cd web && npm install && npm run dev   # open http://localhost:5173/?mock

# deploy everything (CloudFormation + S3 + CloudFront)
bash scripts/deploy.sh
```

## Honest limits

- Vakeel does not submit anything to PARIVESH. The signed letter is sent by the citizen from their own email or by post, so it carries their legal identity.
- Climate-cost figures are estimates from the proposal's stated capacity and published factors, and are labelled as estimates everywhere they appear.
- v1 reads text PDFs, which covers PARIVESH committee minutes and most EIA reports. Scanned, image-only filings will need an Amazon Textract OCR step (next on the list).
- The live stack runs in `ap-southeast-2`. The hackathon AWS account is a project pinned to that region, and Bedrock is reached through the `global.amazon.nova-2-lite-v1:0` inference profile.

## Next

Auto-watch PARIVESH for new filings by district, WhatsApp and voice alerts in local languages (Amazon Polly), and dashboards for environmental lawyers and journalists who already file these objections by hand.
