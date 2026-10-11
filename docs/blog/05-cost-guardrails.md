# Running parallel Bedrock agents on a $100 AWS account without waking up to a bill

*Part 4 of the Vakeel build log · Environmental Hacks 2026 · #BharatBuilds*

Vakeel reads 250-page Indian government filings with a fleet of Amazon Bedrock agents, one per project, orchestrated by AWS Step Functions. It's public: anyone can upload a PDF. It also runs on a brand-new hackathon account with $100 of credits and a $20 monthly spend limit.

That combination is how people end up with surprise bills: a public upload button wired to an LLM, fanned out in parallel, with retries. Here are the guardrails we built so it can't run away. Each one is a few lines of code.

## 1. A daily Bedrock cap that can't race

Every Bedrock call first takes a ticket from one DynamoDB item per day. The increment and the limit check are a single conditional write, so twenty parallel Lambdas can't all read "59" and all go ahead:

```python
def budget_ok() -> bool:
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        table.update_item(
            Key={"pk": "BUDGET", "sk": day},
            UpdateExpression="ADD calls :one SET #ttl = :ttl",
            ConditionExpression="attribute_not_exists(calls) OR calls < :max",
            ExpressionAttributeNames={"#ttl": "ttl"},
            ExpressionAttributeValues={":one": 1, ":max": MAX_CALLS, ":ttl": int(time.time()) + 7 * 86400},
        )
        return True
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise
```

When the cap is hit, the call raises `BudgetExceeded("Daily Bedrock call budget reached; try again tomorrow.")` and the run stops. It fails closed. The cap is a CloudFormation parameter (`MaxBedrockCallsPerDay`), so we lowered it from 150 to 60 during judging week without a code change. The TTL cleans up old counters for free.

## 2. Pay for a document once, ever

Two layers, both deterministic:

- **The Step Functions execution name is the document id.** `start_execution(name=f"doc-{doc_id}")` throws `ExecutionAlreadyExists` on a second attempt, so a double-click, a retry or a replayed request can't start a second paid run. We catch that one error and carry on.
- **SHA-256 of the file bytes.** Before any model sees the PDF, the first state hashes it and looks up `HASH#<digest>`. If someone uploads a filing Vakeel has already read, it links to the existing analysis and logs: *"Vakeel has already read this exact document. Opening the existing analysis instead of paying to read it twice."*

## 3. Bound the input before it reaches the model

All limits live in one config file, not scattered through handlers:

```python
MAX_UPLOAD_BYTES = 25 * 1024 * 1024   # checked on request, then on the real S3 object before analysis
MAX_PAGES = 400
MAX_PROJECTS_PER_DOC = 8
SEGMENT_HEAD_CHARS = 60_000           # per-project context, front half
SEGMENT_TAIL_CHARS = 45_000           # committee deliberations, back half
```

The biggest saving wasn't a limit, though. It was **not sending the whole document**. Committee minutes describe each project twice, once near the front and once in the deliberations near the back. Vakeel's segmenter stitches each project's two halves together, so each agent reads its own project, not 620,940 characters of everyone else's. A 246-page filing costs roughly 200k input tokens in total.

## 4. Parallel, but polite

The Step Functions Map state runs **three agents at a time** (`MaxConcurrency: 3`), not "as many as there are projects". Bedrock throttling is retried with backoff in the state machine itself, so a Lambda never sits in a sleep loop on the meter:

```yaml
Retry:
  - ErrorEquals: [ThrottlingException, ServiceUnavailableException, Lambda.TooManyRequestsException]
    IntervalSeconds: 5
    BackoffRate: 2
    MaxAttempts: 3
```

The public HTTP API is throttled at 10 requests a second with a burst of 20, which is plenty for people and useless for a script.

## 5. Small model, forced structure

Extraction runs on **Amazon Nova 2 Lite** through the `global.` cross-region inference profile, called with Converse and a single forced tool (`toolChoice`). The model can only answer by filling our JSON schema, so there's no chatty preamble to pay for and no retry-until-it-parses loop. All the arithmetic (CO₂, the climate-cost estimate, water in people-per-day) happens in Python afterwards, which also means it costs nothing.

## 6. Serverless all the way down

Lambda (Python 3.12 on arm64), Step Functions, DynamoDB on-demand, S3 and CloudFront. With no traffic, the bill is effectively zero; there's no idle cluster or database instance to forget about.

## What it actually cost

Three real filings (732 pages, 17 projects), dozens of development runs and the live demo: **well under a dollar of actual spend** when AWS's budget alert arrived.

The alert itself was alarming: a *forecast* of several hundred dollars for the month. That's an extrapolation from a few busy development days, not money spent. Check *actual* versus *forecast* before you panic, and keep a spend limit on the account anyway. Ours is the backstop behind every guardrail above.

## The checklist

1. One atomic daily counter in front of every model call, failing closed.
2. Execution name = idempotency key.
3. Hash the input; never pay twice for the same bytes.
4. Bounded inputs in one config file, and send each agent only what it needs.
5. Concurrency limits and backoff in the orchestrator, not in your code.
6. Forced tool output on a small model; do the math in code.
7. Serverless, so idle costs nothing.

Live: https://d4i9n8m04ddaa.cloudfront.net · Code: https://github.com/adhavan18/vakeel
