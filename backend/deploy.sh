#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Build & deploy the backend to Google Cloud Run from source.
# Prereqs: gcloud CLI authenticated (`gcloud auth login`) and a project set.
# Secrets are read from your shell env — DO NOT hard-code them here.
# ---------------------------------------------------------------------------
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-asia-east1}"
SERVICE="${SERVICE:-life-dashboard-backend}"

# Required secrets (export these before running, or use Secret Manager):
: "${DATABASE_URL:?}" "${DATABASE_USERNAME:?}" "${DATABASE_PASSWORD:?}"
: "${FIREBASE_PROJECT_ID:?}" "${FIREBASE_SERVICE_ACCOUNT_JSON:?}"
: "${CORS_ALLOWED_ORIGINS:?}"

gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source . \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 40 \
  --timeout 60 \
  --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
  --set-env-vars "DATABASE_USERNAME=${DATABASE_USERNAME}" \
  --set-env-vars "DATABASE_PASSWORD=${DATABASE_PASSWORD}" \
  --set-env-vars "FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}" \
  --set-env-vars "^@@^FIREBASE_SERVICE_ACCOUNT_JSON=${FIREBASE_SERVICE_ACCOUNT_JSON}" \
  --set-env-vars "CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS}"

echo "Deployed. Service URL:"
gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" \
  --format 'value(status.url)'
