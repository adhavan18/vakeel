import json
import time

import boto3
from botocore.config import Config

from . import config

_client = boto3.client(
    "bedrock-runtime",
    region_name=config.REGION,
    config=Config(retries={"mode": "adaptive", "max_attempts": 4}, read_timeout=300, connect_timeout=5),
)

# Set by the Lambda layer to a DynamoDB-backed daily counter; None for local runs.
budget_guard = None


class BudgetExceeded(Exception):
    pass


def structured_call(
    model_id: str,
    system: str,
    user: str,
    tool_name: str,
    tool_description: str,
    schema: dict,
    max_tokens: int = 6000,
) -> tuple[dict, dict]:
    """Force the model to answer by calling a single tool whose input schema is
    the output shape we want, so callers always get parsed JSON, never prose."""
    if budget_guard is not None and not budget_guard():
        raise BudgetExceeded("Daily Bedrock call budget reached; try again tomorrow.")

    started = time.time()
    response = _client.converse(
        modelId=model_id,
        system=[{"text": system}],
        messages=[{"role": "user", "content": [{"text": user}]}],
        inferenceConfig={"maxTokens": max_tokens, "temperature": 0},
        toolConfig={
            "tools": [
                {
                    "toolSpec": {
                        "name": tool_name,
                        "description": tool_description,
                        "inputSchema": {"json": schema},
                    }
                }
            ],
            "toolChoice": {"tool": {"name": tool_name}},
        },
    )
    usage = {
        "inputTokens": response["usage"]["inputTokens"],
        "outputTokens": response["usage"]["outputTokens"],
        "latencyMs": int((time.time() - started) * 1000),
        "modelId": model_id,
    }
    for block in response["output"]["message"]["content"]:
        if "toolUse" in block:
            payload = block["toolUse"]["input"]
            if isinstance(payload, str):
                payload = json.loads(payload)
            return payload, usage
    raise RuntimeError(f"Model did not return structured output (stopReason={response.get('stopReason')})")
