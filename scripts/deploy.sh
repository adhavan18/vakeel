#!/usr/bin/env bash
# Build and deploy Vakeel end to end: backend (Lambda + Step Functions + DynamoDB + S3)
# via CloudFormation with the SAM transform, then the web app to S3 + CloudFront.
set -euo pipefail

STACK=${STACK:-vakeel}
REGION=${REGION:-ap-southeast-2}
export AWS_DEFAULT_REGION="$REGION"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ARTIFACTS="vakeel-artifacts-${ACCOUNT}-${REGION}"

echo "==> packaging backend"
rm -rf build/backend && mkdir -p build/backend
cp -r backend/vakeel backend/handlers build/backend/
find build/backend -name "__pycache__" -type d -prune -exec rm -rf {} +
python -m pip install --quiet --no-deps --target build/backend pypdf
# Zip with POSIX paths ourselves: Lambda runs on Linux, and the CLI packager does not resolve SAM Globals.
python - <<'PY'
import os, zipfile
with zipfile.ZipFile("build/backend.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk("build/backend"):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, "build/backend").replace(os.sep, "/"))
PY

if ! aws s3api head-bucket --bucket "$ARTIFACTS" 2>/dev/null; then
  echo "==> creating artifacts bucket $ARTIFACTS"
  aws s3api create-bucket --bucket "$ARTIFACTS" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
fi

echo "==> cloudformation package"
aws cloudformation package \
  --template-file infra/template.yaml \
  --s3-bucket "$ARTIFACTS" \
  --output-template-file build/packaged.yaml >/dev/null

echo "==> cloudformation deploy (stack: $STACK)"
aws cloudformation deploy \
  --template-file build/packaged.yaml \
  --stack-name "$STACK" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --no-fail-on-empty-changeset

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
API_URL=$(output ApiUrl)
WEB_URL=$(output WebUrl)
WEB_BUCKET=$(output WebBucketName)
DIST_ID=$(output DistributionId)

echo "==> building web app"
(cd web && npx vite build >/dev/null)
rm -rf web/dist/mock
printf '{"apiUrl": "%s"}\n' "$API_URL" > web/dist/config.json

echo "==> uploading web app"
aws s3 sync web/dist "s3://$WEB_BUCKET" --delete --exclude config.json --exclude index.html --cache-control "public,max-age=31536000,immutable" >/dev/null
aws s3 cp web/dist/index.html "s3://$WEB_BUCKET/index.html" --cache-control "no-cache" >/dev/null
aws s3 cp web/dist/config.json "s3://$WEB_BUCKET/config.json" --cache-control "no-cache" >/dev/null
MSYS_NO_PATHCONV=1 python -m awscli cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/index.html" "/config.json" >/dev/null

echo
echo "API: $API_URL"
echo "Web: $WEB_URL"
