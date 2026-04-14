# ============================================================================
# Terraform Providers Configuration
# GRIME - GCP Infrastructure
# ============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

# Primary GCP Provider
provider "google" {
  project = var.project_id
  region  = var.region
}

# Beta Provider (for features in beta)
provider "google-beta" {
  project = var.project_id
  region  = var.region
}
