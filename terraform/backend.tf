# ============================================================================
# Terraform Backend Configuration
# Stores Terraform state in Google Cloud Storage
# ============================================================================

# WARNING: Currently using local state. This is NOT suitable for production.
# Local state files may contain sensitive data (passwords, keys) in plaintext
# and lack locking for team collaboration, risking state corruption.
# For production, uncomment the GCS backend below and configure remote state.

# terraform {
#   backend "gcs" {
#     bucket = "data-hygiene-terraform-state"  # Must be globally unique
#     prefix = "terraform/state"
#
#     # Optional: Enable versioning for state files
#     # This is configured on the bucket itself
#   }
# }

# Note: Before running terraform init, create the state bucket manually:
# 
# gcloud storage buckets create gs://data-hygiene-terraform-state \
#   --project=YOUR_PROJECT_ID \
#   --location=us-central1 \
#   --uniform-bucket-level-access
#
# Enable versioning:
# gcloud storage buckets update gs://data-hygiene-terraform-state \
#   --versioning
