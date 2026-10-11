import json
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.config import Config
from botocore.exceptions import ClientError

from . import config

_ddb = boto3.resource("dynamodb", region_name=config.REGION)
# Regional endpoint + SigV4: presigned URLs against the global endpoint 307-redirect for
# new non-us-east-1 buckets, and browsers refuse redirects on CORS uploads.
_s3 = boto3.client(
    "s3",
    region_name=config.REGION,
    endpoint_url=f"https://s3.{config.REGION}.amazonaws.com",
    config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
)
table = _ddb.Table(config.TABLE_NAME) if config.TABLE_NAME else None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def new_id() -> str:
    return uuid.uuid4().hex[:12]


# ---- S3 ----

def put_json(key: str, data) -> None:
    _s3.put_object(Bucket=config.BUCKET_NAME, Key=key, Body=json.dumps(data, ensure_ascii=False).encode("utf-8"), ContentType="application/json")


def get_json(key: str):
    return json.loads(_s3.get_object(Bucket=config.BUCKET_NAME, Key=key)["Body"].read())


def get_bytes(key: str) -> bytes:
    return _s3.get_object(Bucket=config.BUCKET_NAME, Key=key)["Body"].read()


def object_size(key: str) -> int | None:
    try:
        return _s3.head_object(Bucket=config.BUCKET_NAME, Key=key)["ContentLength"]
    except ClientError:
        return None


def presign_put(key: str, content_type: str = "application/pdf") -> str:
    return _s3.generate_presigned_url(
        "put_object", Params={"Bucket": config.BUCKET_NAME, "Key": key, "ContentType": content_type}, ExpiresIn=900
    )


def presign_get(key: str) -> str:
    return _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": config.BUCKET_NAME, "Key": key, "ResponseContentType": "application/pdf"},
        ExpiresIn=3600,
    )


# ---- DynamoDB ----

def _plain(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def get(pk: str, sk: str) -> dict | None:
    item = table.get_item(Key={"pk": pk, "sk": sk}).get("Item")
    return _plain(item) if item else None


def put(item: dict) -> None:
    table.put_item(Item=item)


def update(pk: str, sk: str, **fields) -> None:
    names = {f"#{k}": k for k in fields}
    values = {f":{k}": v for k, v in fields.items()}
    table.update_item(
        Key={"pk": pk, "sk": sk},
        UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in fields),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def query(pk: str, prefix: str) -> list[dict]:
    items, kwargs = [], {"KeyConditionExpression": Key("pk").eq(pk) & Key("sk").begins_with(prefix)}
    while True:
        page = table.query(**kwargs)
        items += page["Items"]
        if "LastEvaluatedKey" not in page:
            return [_plain(i) for i in items]
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def list_documents(limit: int = 30) -> list[dict]:
    page = table.query(IndexName="gsi1", KeyConditionExpression=Key("gsi1pk").eq("DOCS"), ScanIndexForward=False, Limit=limit)
    return [_plain(i) for i in page["Items"]]


def log(doc_id: str, message: str, kind: str = "info") -> None:
    table.put_item(Item={
        "pk": f"DOC#{doc_id}",
        "sk": f"LOG#{now_iso()}#{new_id()[:4]}",
        "message": message,
        "kind": kind,
        "ttl": int(time.time()) + 90 * 86400,
    })


def bump_stats(**deltas) -> None:
    names = {f"#{k}": k for k in deltas}
    values = {f":{k}": Decimal(str(v)) for k, v in deltas.items()}
    table.update_item(
        Key={"pk": "STATS", "sk": "GLOBAL"},
        UpdateExpression="ADD " + ", ".join(f"#{k} :{k}" for k in deltas),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def budget_ok() -> bool:
    """Atomic per-day Bedrock call counter; refuses once the daily cap is hit."""
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        table.update_item(
            Key={"pk": "BUDGET", "sk": day},
            UpdateExpression="ADD calls :one SET #ttl = :ttl",
            ConditionExpression="attribute_not_exists(calls) OR calls < :max",
            ExpressionAttributeNames={"#ttl": "ttl"},
            ExpressionAttributeValues={":one": 1, ":max": config.MAX_BEDROCK_CALLS_PER_DAY, ":ttl": int(time.time()) + 7 * 86400},
        )
        return True
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise
