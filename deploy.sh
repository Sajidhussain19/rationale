#!/usr/bin/env bash
# One-shot deploy of Rationale to Cloud Run (run in Cloud Shell or anywhere with gcloud).
set -euo pipefail
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-rationale}"
echo "Project: $PROJECT_ID  Region: $REGION"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com aiplatform.googleapis.com firebase.googleapis.com --project "$PROJECT_ID"

# Firestore (Native mode) - ignore error if it already exists
gcloud firestore databases create --location="$REGION" --project "$PROJECT_ID" 2>/dev/null || true

# Grant the Cloud Run runtime service account access to Firestore + Vertex AI Gemini
PN=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="$PN-compute@developer.gserviceaccount.com"
for ROLE in roles/datastore.user roles/aiplatform.user; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role="$ROLE" --condition=None -q >/dev/null
done

ENVS="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1"
if [ -n "${GEMINI_API_KEY:-}" ]; then ENVS="$ENVS,GEMINI_API_KEY=$GEMINI_API_KEY"; fi
if [ -n "${GEMINI_MODEL:-}" ]; then ENVS="$ENVS,GEMINI_MODEL=$GEMINI_MODEL"; fi

gcloud run deploy "$SERVICE" --source . --region "$REGION" --project "$PROJECT_ID" \
  --allow-unauthenticated --min-instances 1 --memory 1Gi --timeout 300 \
  --set-env-vars "$ENVS" -q

gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)'
