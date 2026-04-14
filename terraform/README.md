# Terraform - GRIME GCP Infrastructure

Complete infrastructure as code for deploying to Google Cloud Platform.

## 📁 Structure

```
terraform/
├── main.tf                 # Main orchestration
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── providers.tf            # Provider configuration
├── backend.tf              # Remote state
├── modules/
│   ├── networking/         # VPC, subnet, VPC connector
│   ├── cloud-sql/          # PostgreSQL 17
│   ├── cloud-run/          # Backend API
│   ├── cloud-storage/      # GCS bucket
│   └── secret-manager/     # Secrets
└── environments/
    └── prod.tfvars.example # Production config
```

## 🏗️ Infrastructure

- **Cloud Run**: Serverless backend (0-10 instances)
- **Cloud SQL**: PostgreSQL 17 (db-f1-micro, free tier)
- **Cloud Storage**: File storage (5GB free)
- **VPC**: Private networking
- **Secret Manager**: Secure secrets

## 🚀 Quick Start

```bash
# 1. Install tools
brew install terraform google-cloud-sdk

# 2. Login to GCP
gcloud auth login
gcloud auth application-default login

# 3. Initialize Terraform
cd terraform/
terraform init

# 4. Create config
cp environments/prod.tfvars.example environments/prod.tfvars
# Edit prod.tfvars with your values

# 5. Deploy
terraform plan -var-file=environments/prod.tfvars
terraform apply -var-file=environments/prod.tfvars
```

## 💰 Cost

**$0/month** on GCP Always Free Tier:
- Cloud Run: 2M requests/month free
- Cloud SQL: db-f1-micro eligible  
- Cloud Storage: 5GB free

## 📖 Full Documentation

See detailed guides in project root:
- `TERRAFORM_GUIDE.md` - Complete deployment guide
- `PHASE2_COMPLETE.md` - Implementation details

## 🔐 Security

- Private IP for Cloud SQL
- Secrets in Secret Manager
- IAM least privilege
- No public database access

## 🎯 What's Included

✅ Complete GCP infrastructure
✅ Terraform modules (5 modules)
✅ Free tier optimized
✅ Production-ready configuration
✅ Security best practices
✅ Automated secret management
✅ VPC networking
✅ Database backups

Ready to deploy to GCP!
