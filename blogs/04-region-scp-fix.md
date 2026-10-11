# "Explicit deny in a service control policy": deploying on the new AWS project accounts (and why AdministratorAccess didn't help)

*A practical fix for Environmental Hacks participants · #BharatBuilds*

If you made a fresh AWS account for the hackathon and everything except a few services fails with

```
User: arn:aws:iam::<account>:user/<you> is not authorized to perform: lambda:ListFunctions
... with an explicit deny in a service control policy:
arn:aws:organizations::<org>:policy/o-xxxx/service_control_policy/p-xxxx
```

this is for you. We lost about an hour to it while building Vakeel. Here's what's going on and the two-minute fix.

## Symptoms

- Bedrock, CloudFront, IAM and STS work.
- Lambda, DynamoDB, Step Functions, CloudFormation, API Gateway, S3 `CreateBucket`, Polly, Lightsail creates and more all return **explicit deny in a service control policy**.
- Attaching `AdministratorAccess` to your IAM user changes nothing.
- Upgrading from the Free plan to Paid changes nothing.

## Why

New accounts created through the new sign-in experience (AWS Builder ID → **settings.aws.com** with *Projects / Team / Billing / Support*) are **projects** inside an AWS-managed organization. The org applies a service control policy, and an SCP sits *above* IAM: an explicit deny there can't be overridden by any IAM policy, including admin.

The SCP pins the project to a **home region**. Global services (IAM, CloudFront, STS) pass. Most of the AWS CLI's default region, `us-east-1`, does not.

## The fix

1. Open **settings.aws.com → Projects → your project → Additional info**.
2. Read the **Region** field. Ours was *Asia Pacific (Sydney) ap-southeast-2*.
3. Deploy there:

```bash
aws configure set region ap-southeast-2
aws lambda list-functions --max-items 1   # works now
```

Everything we needed worked in the home region: Lambda, Step Functions, DynamoDB, CloudFormation, API Gateway, S3, Polly, Location Service and Textract.

## Two gotchas after you switch regions

**Bedrock model IDs.** Not every model ID is available everywhere. From Sydney, these worked for us:

```
global.amazon.nova-2-lite-v1:0     ✅  (global cross-region inference profile)
apac.amazon.nova-pro-v1:0          ✅
apac.amazon.nova-2-lite-v1:0       ❌  invalid identifier
amazon.nova-2-lite-v1:0            ❌  on-demand not supported, use an inference profile
```

**S3 presigned uploads from the browser.** If you presign against the global endpoint, a brand-new bucket outside us-east-1 answers with **307 Temporary Redirect**, and browsers refuse redirects on CORS uploads. Pin the client to the regional endpoint:

```python
s3 = boto3.client(
    "s3",
    region_name="ap-southeast-2",
    endpoint_url="https://s3.ap-southeast-2.amazonaws.com",
    config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
)
```

**Bonus (Windows + AWS CLI v1):** `aws cloudformation package` doesn't resolve SAM `Globals: Function: CodeUri`, so every function gets a zip of your template folder and fails with `No module named 'handlers'`. Put `CodeUri` on each function, and build the zip yourself with forward-slash paths.

## While you're in Settings

The upgrade flow lets you set a **monthly spend limit** (we used $20) that pauses the project if it's reached, plus alerts at 50/75/90%. That's a better guardrail than a budget email when you're learning on real infrastructure. Skip the "pause idle resources" option if your demo needs to be up while judges look at it.

Good luck. If this saved you an hour, go build something that matters with it.

— Team behind **Vakeel**, an AI that reads India's environmental clearance filings for the people who live next to them.
