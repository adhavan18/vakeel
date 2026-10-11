import os

REGION = os.environ.get("VAKEEL_REGION", "ap-southeast-2")
EXTRACT_MODEL_ID = os.environ.get("VAKEEL_EXTRACT_MODEL_ID", "global.amazon.nova-2-lite-v1:0")
DRAFT_MODEL_ID = os.environ.get("VAKEEL_DRAFT_MODEL_ID", "global.amazon.nova-2-lite-v1:0")

TABLE_NAME = os.environ.get("VAKEEL_TABLE", "")
BUCKET_NAME = os.environ.get("VAKEEL_BUCKET", "")
INGEST_STATE_MACHINE_ARN = os.environ.get("VAKEEL_INGEST_SM_ARN", "")
OBJECTION_STATE_MACHINE_ARN = os.environ.get("VAKEEL_OBJECTION_SM_ARN", "")

# Cost guardrails: the account runs on a $100 free-plan credit balance, so every
# path that can spend Bedrock tokens is capped here rather than trusted to callers.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_PAGES = 400
MAX_PROJECTS_PER_DOC = 8
SEGMENT_HEAD_CHARS = 60_000
SEGMENT_TAIL_CHARS = 45_000
MAX_BEDROCK_CALLS_PER_DAY = int(os.environ.get("VAKEEL_MAX_BEDROCK_CALLS_PER_DAY", "150"))
