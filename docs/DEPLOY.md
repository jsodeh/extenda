# Deploying Extenda to Google Cloud Run

Since your local Docker environment is unavailable, we will use **Google Cloud Build** to build the container remotely and **Cloud Run** to host it.

## Prerequisites

1.  **Google Cloud Project**: Ensure you have a project created.
2.  **Billing Enabled**: Cloud Run and Cloud Build require billing.
3.  **gcloud CLI**: Install it if you haven't:
    ```bash
    curl https://sdk.cloud.google.com | bash
    exec -l $SHELL
    ```
    (Or download from [Google Cloud SDK](https://cloud.google.com/sdk/docs/install))

## Step 1: Login and Configure

Run these commands in your terminal:

```bash
# Login to your Google Cloud account
gcloud auth login

# Set your project ID (replace YOUR_PROJECT_ID)
gcloud config set project YOUR_PROJECT_ID

# Enable necessary APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com
```

## Step 2: Set up Database (Required)
Since the app needs a database and you can't run one locally, you should set up a **Cloud SQL (Postgres)** instance.

1.  Go to [Cloud SQL Console](https://console.cloud.google.com/sql).
2.  Create a **PostgreSQL** instance.
3.  Create a database named `extenda`.
4.  Create a user (e.g., `postgres` with a password).
5.  Copy the **Connection Name** (e.g., `project:region:instance`).

## Step 3: Build and Deploy

We will use Cloud Build to build the Docker image remotely (bypassing your local Docker setup).

```bash
# 1. Build the image using Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/extenda-api .

# 2. Deploy to Cloud Run
# Replace values regarding DB_URL and API keys
gcloud run deploy extenda-api \
  --image gcr.io/YOUR_PROJECT_ID/extenda-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="DATABASE_URL=postgres://user:pass@/extenda?host=/cloudsql/YOUR_PROJECT_CONNECTION_NAME" \
  --set-env-vars="GEMINI_API_KEY=your_gemini_key" \
  --add-cloudsql-instances="YOUR_PROJECT_CONNECTION_NAME"
```

> **Note**: For `DATABASE_URL` with Cloud SQL Auth Proxy (which Cloud Run uses automatically with `--add-cloudsql-instances`), the format relies on the socket connection.

## Troubleshooting
- If the build fails finding `packages/shared`, ensure you run the command from the root of the repo (where the `Dockerfile` is).


### Example deploy command (placeholders only)

Do **not** commit real secrets into this repo. Use placeholders here and set real values via your CI/CD secrets manager or `gcloud run services update --update-env-vars`.

```bash
gcloud run deploy extenda-api \
  --image gcr.io/YOUR_PROJECT_ID/extenda-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances="YOUR_PROJECT_ID:us-central1:YOUR_INSTANCE_NAME" \
  --set-env-vars="DATABASE_URL=postgres://user:pass@/extenda?host=/cloudsql/YOUR_PROJECT_ID:us-central1:YOUR_INSTANCE_NAME" \
  --set-env-vars="GEMINI_API_KEY=your_gemini_api_key" \
  --set-env-vars="JWT_SECRET=your_64_char_hex_secret" \
  --set-env-vars="GOOGLE_CLIENT_ID=your_google_client_id" \
  --set-env-vars="GOOGLE_CLIENT_SECRET=your_google_client_secret" \
  --set-env-vars="GOOGLE_AUTH_REDIRECT_URI=https://YOUR_SERVICE_URL/oauth/auth/callback/google"
```