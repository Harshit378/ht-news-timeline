# External API Keys & Services Setup Guide

This document catalogs all third-party integrations across the **News Timeline** platform, their environment variables, and the capabilities they activate.

All adapters and services are implemented with built-in fallbacks or test modes so the platform functions without them.

---

## 1. Stripe Billing & Subscriptions (ADR-007)

* **Features Activated:**
  * Real customer billing and checkout sessions for `PRO` ($9/mo) and `TEAM` ($29/mo) tiers.
  * Customer subscription management portal.
  * Verified Stripe webhooks for subscription lifecycles (created, renewed, upgraded, cancelled).
* **Current Behavior without Key:**
  * Issues test checkout sessions (`cs_test_...`) and allows instant testing of upgrades and cancellations via `/api/billing/webhook`.
* **Configuration:**
  ```env
  # Stripe API Secret Key (from Stripe Dashboard -> Developers -> API keys)
  STRIPE_SECRET_KEY="sk_test_..."

  # Stripe Webhook Signing Secret (from Developers -> Webhooks -> Add endpoint)
  STRIPE_WEBHOOK_SECRET="whsec_..."

  # Optional recurring Price IDs for Pro and Team subscriptions
  STRIPE_PRO_PRICE_ID="price_..."
  STRIPE_TEAM_PRICE_ID="price_..."
  ```
* **Webhook Endpoint:**
  * `POST https://<your-api-domain>/api/billing/webhook`
  * Events to subscribe:
    * `checkout.session.completed`
    * `customer.subscription.updated`
    * `customer.subscription.deleted`
    * `invoice.payment_succeeded`
    * `invoice.payment_failed`

---

## 2. Anthropic Claude (ADR-004)

* **Features Activated:**
  * High-quality structured story briefs and multi-source editorial comparisons on `/story` via Claude Haiku 5.5.
  * Replaces local Ollama (`llama3.2`) with cloud inference.
* **Current Behavior without Key:**
  * Defaults to local Ollama (`LLM_PROVIDER=ollama`) if available, or heuristic fallback if disabled (`LLM_PROVIDER=none`).
* **Configuration:**
  ```env
  LLM_PROVIDER="anthropic"
  ANTHROPIC_API_KEY="sk-ant-..."
  # Optional overrides (defaults to claude-haiku-5-5 at low effort)
  ANTHROPIC_MODEL="claude-haiku-5-5"
  ANTHROPIC_EFFORT="low"
  # Daily token ceiling (default 2,000,000)
  LLM_DAILY_TOKEN_LIMIT="2000000"
  ```

---

## 3. Google Cloud BigQuery — GDELT History (ADR-003 / ADR-008 Step 5)

* **Features Activated:**
  * Deep historical backfill for story timelines dating back years across `gdelt-bq.gdeltv2.gkg_partitioned`.
  * Runs partition-pruned cost-controlled queries within GCP's 1 TB/month free tier.
* **Current Behavior without Credentials:**
  * Stays disabled (`backfill: unavailable`). Timelines answer immediately from the local PostgreSQL archive and recent GDELT DOC.
* **Configuration:**
  ```env
  # Path to Google Service Account JSON key, or configure gcloud ADC:
  GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
  GDELT_BIGQUERY="on"
  ```

---

## 4. Commercial News Search API (ADR-008 Step 3)

* **Features Activated:**
  * Real-time query-based news search via commercial news aggregator (candidate: TheNewsAPI or GNews).
  * Automatically deduplicated by SHA-1 URL hash and cached for 15 minutes.
* **Current Behavior without Key:**
  * Provider remains disabled (`state: disabled`). Search queries are answered from the curated RSS archive and GDELT DOC fallback.
* **Configuration:**
  ```env
  NEWS_API_KEY="your_api_key_here"
  # Default endpoint is TheNewsAPI; override for compatible alternatives:
  # NEWS_API_BASE_URL="https://api.thenewsapi.com/v1/news/all"
  NEWS_API_DAILY_LIMIT="100"
  ```
