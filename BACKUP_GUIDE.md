# Database Backup & Restore Guide

This repository utilizes an automated **3-2-1 backup strategy** to secure user data. 
- **Primary Data:** MongoDB Atlas (Free Tier)
- **Backup Location:** Cloudflare R2 (S3-compatible Object Storage)
- **Orchestrator:** GitHub Actions

---

## Automated Backup Architecture

A GitHub Action (`.github/workflows/db-backup.yml`) runs automatically **every day at 00:00 UTC**.

### The Workflow Process:
1.  **Boot:** Spins up an ephemeral Ubuntu runner on GitHub.
2.  **Tools:** Installs `mongodb-database-tools` (specifically `mongodump`).
3.  **Extract:** Connects to the Production MongoDB URI and dumps the data to a compressed archive (`.gz`).
4.  **Upload:** Uses AWS CLI to upload the archive to your Cloudflare R2 bucket.
5.  **Retention:** Files are stored in R2 (configure lifecycle rules in Cloudflare dashboard to auto-delete old backups if needed).

---

## How to Restore Data

If the primary database is corrupted or lost, follow these steps to restore from a backup.

### Prerequisites
- [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) installed on your local machine.
- Access to the Cloudflare R2 dashboard.

### 1. Download Backup
1.  Log in to your **Cloudflare Dashboard**.
2.  Navigate to **R2** -> **Buckets** -> `memolink-backups`.
3.  Find the file you want to restore (e.g., `backup-2024-03-20-00-00-00.gz`).
4.  Download it to your local machine.

### 2. Restore Command
Run the following command in your terminal. Replace the placeholders with your actual connection string and filename.

```bash
# Restore from a backup (mapping 'production' data to 'backup' database)
mongorestore --uri "mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/" \
  --gzip \
  --archive=backup-2024-03-20.gz \
  --nsFrom="production.*" \
  --nsTo="backup.*"
```

> **Note:** `mongorestore` will essentially "merge" data. If you want a clean restore, drop the target database first.

---

## Configuration (Secrets)

To make this work, the following **Repository Secrets** must be set in GitHub:

| Secret Name            | Description                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| `MONGO_URI`            | Production MongoDB connection string (e.g. ending in `/production`)         |
| `R2_ACCOUNT_ID`        | Cloudflare Account ID (found in R2 sidebar)                                 |
| `R2_ACCESS_KEY_ID`     | R2 API Token ID (Permission: Object Read & Write)                          |
| `R2_SECRET_ACCESS_KEY` | R2 API Token Secret                                                         |
| `R2_BUCKET_NAME`       | Exact name of your bucket (e.g., `memolink-backups`)                        |

---

## Testing
You can manually trigger a backup at any time:
1.  Go to the **Actions** tab in this repo.
2.  Select **"Backup MongoDB to Cloudflare R2"**.
3.  Click **Run workflow**.
