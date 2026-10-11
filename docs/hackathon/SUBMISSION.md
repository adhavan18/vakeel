# Environmental Hacks submission, ready to paste

**Project title:** Vakeel: an AI advocate that reads India's environmental clearance filings before they're approved

**Track:** Air

## One-line pitch

Every coal plant in India needs a clearance, and the paperwork is 246 pages nobody reads. Vakeel's Bedrock agents read it, prove every number against the source page, tell the people next door what is being approved in their own language, and help them object before it is.

## Description

**The environmental problem:** India's coal power is linked to as many as 115,000 premature deaths a year, and in July 2025, 78% of coal plants were exempted from installing sulphur scrubbers. The environmental clearance is the last checkpoint before a new plant, mine or dam is built, and the law gives the people next door a voice there. In practice they never use it, because the filings are hundreds of pages long. A 2021 rule (S.O. 1247(E)) even lets a project that's already half built skip its public hearing.


India's environmental clearance process has a public step: committee minutes and EIA reports are published on PARIVESH, and affected residents can object. In practice nobody does, because the documents are unreadable. The 26th Expert Appraisal Committee (Thermal) minutes from 20 June 2025 run to 246 pages and 620,940 characters, covering six coal power projects. Buried on page 18, a 1,320 MW Adani Power expansion at Korba, 2.2 km from a reserved forest, was exempted from its public hearing. On page 25 the committee recommended it.

Vakeel turns that filing into something a resident can act on in about a minute:

- **Read:** Step Functions splits the filing into projects and runs one Amazon Bedrock (Nova 2 Lite) agent per project in parallel.
- **Verify:** every number must come with a word-for-word quote and page number, and code checks it against the PDF. Claims that can't be matched are thrown away and listed separately ("What Vakeel refused to tell you").
- **Translate:** a plain-language headline in English, Hindi and the state's language. Climate cost (₹4,887 crore a year for Korba), water (enough for 7.7 lakh people a day) and coal (2.4 trains a day) are computed by code from published factors, never by the model.
- **Object:** Vakeel drafts a formal objection whose grounds quote the record with page numbers. It cannot file anything itself. The citizen must read the letter and type an exact sentence to sign. Step Functions waits for that human with a task token, and the signed letter gets a SHA-256 receipt.

Who it's for: people living next to proposed coal plants, mines and dams, and the panchayats, environmental lawyers and journalists who currently read these files by hand.

How it differs from existing tools: permit trackers such as Open Permit list filings and generate letters citing laws. Vakeel reads what is actually inside the filing, proves every fact against its page, computes the impact in code, and explains it in the reader's language, so the objection rests on the government's own words.

## How did you use AWS?

**AWS open source:** the AWS SDK for Python (boto3/botocore) for every service call, including the Bedrock Converse API with tool-forced JSON; AWS SAM (Serverless Application Model) for infrastructure as code (the `AWS::Serverless-2016-10-31` transform in `infra/template.yaml`); and the AWS CLI for packaging and deployment.

**AWS services:** AWS is the product, not just the hosting. Everything runs serverless in ap-southeast-2, deployed with CloudFormation (SAM transform):

- **Amazon Bedrock (Nova 2 Lite, global inference profile):** the core reasoning. The Converse API uses tool-forced JSON schemas to extract facts, nearby rivers and forests, concerns and the committee's decision. A second editor pass writes headlines and Hindi/Odia translations. A third call drafts the letter's opening and requests.
- **AWS Step Functions:** the ingest state machine uses a Map state to fan out one agent per project (MaxConcurrency 3) with retries. The objection state machine uses `lambda:invoke.waitForTaskToken`, so nothing proceeds until a human signs (7-day timeout, then expiry).
- **AWS Lambda (Python 3.12, arm64):** API, segmentation (pypdf), analysis, verification, finalisation, drafting, signing.
- **Amazon DynamoDB:** single table for documents, projects, live agent logs, objections, global counters, and an atomic daily Bedrock budget counter.
- **Amazon S3 + CloudFront:** presigned PDF uploads; the React app served through CloudFront with Origin Access Control.
- **Amazon API Gateway (HTTP API):** throttled at 10 requests/second.
- **Amazon Location Service:** geocoding fallback for projects whose filing gives no coordinates.
- **Amazon Polly (Kajal, generative, en-IN):** narrated the launch videos (and served as the pacing guide for the founder's own voice takes).

Cost guardrails for a $100 credit account: daily Bedrock call cap, page and size limits, API throttling, one execution per document (execution name = document id), and SHA-256 dedupe so the same PDF is never paid for twice. Reading the whole 246-page filing takes about 200k tokens.

## Feedback on the AWS services we used

The new account experience pins each project to a home region. Our first deploy to us-east-1 failed with "explicit deny in a service control policy" on Lambda, DynamoDB and S3, even with AdministratorAccess. It took a while to find that the project's region (shown under Settings → Projects → Additional info) was the cause. An error message naming the allowed region would have saved an hour. Bedrock's global inference profile (`global.amazon.nova-2-lite-v1:0`) made Nova 2 Lite usable from Sydney with no code change. Step Functions' waitForTaskToken was the cleanest human-in-the-loop primitive we found.

## What did you like?

Tool-forced JSON in the Bedrock Converse API made model output safe to verify in code. Step Functions Map plus Lambda gave us parallel agents with retries and an execution history for free. waitForTaskToken turned "a human must sign before anything happens" into one state instead of a polling system.

## Links (fill in)

- Live: https://d4i9n8m04ddaa.cloudfront.net
- Code: https://github.com/adhavan18/vakeel
- Demo video: <YouTube URL of the fast cut, vakeel-launch-hype.mp4>
- Longer walkthrough (optional second link): <YouTube URL of vakeel-launch-final.mp4>
- Blogs (AWS Builder Center series "Vakeel: building an AI advocate on AWS"):
  1. https://builder.aws.com/content/3KXmQEU3NpHdPcboqyu278IJgu2/we-built-an-ai-that-isnt-allowed-to-make-anything-up-then-pointed-it-at-indias-coal-plant-approvals
  2. https://builder.aws.com/content/3KXpWljfUj9Vs5qcw1zUJHOqEUI/how-we-fact-check-an-llm-against-a-246-page-pdf
  3. https://builder.aws.com/content/3KXqBM7zFjJKBY37TgHgkPUSb5Y/a-legal-signature-as-a-step-functions-waitfortasktoken
  4. https://builder.aws.com/content/3KXqVfIYB2dJkiTDARJRMtPn8na/fixing-explicit-deny-in-a-service-control-policy-on-aws
  5. https://builder.aws.com/content/3KXyQ8AUuYqu5a9JYvaQDjdAPbq/parallel-bedrock-agents-on-a-dollar100-aws-budget
  6. https://builder.aws.com/content/3KXylOcV0ArLzLgt97NlEHsxygS/we-made-our-launch-film-in-code-with-amazon-polly

## Team leader's contributions

Designed and built Vakeel end to end:
- **Product and ideation:** found the leverage point (the EIA public-objection window) and the real case in a 246-page EAC filing.
- **Pipeline:** Bedrock extraction with tool-forced JSON, the deterministic verifier (verbatim quotes, number checks, table-row matching), impact math with sourced factors, the editor and translation pass, and objection drafting.
- **AWS architecture:** a Step Functions Map state for parallel agents, waitForTaskToken for the human signature, Lambda, DynamoDB, S3, CloudFront and API Gateway, deployed with SAM/CloudFormation in ap-southeast-2, plus cost guardrails.
- **Web app:** React UI with the live agent console, evidence drawer and signing flow.
- **Launch film:** Remotion, an Amazon Polly voiceover, a generated score, and real footage recorded with Playwright.
- **Writing:** four build-log blogs.

(If teammates worked on parts of this, split the bullets above into their contribution fields.)
