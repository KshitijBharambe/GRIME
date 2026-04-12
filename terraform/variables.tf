# ============================================================================
# Terraform Variables
# Data Hygiene Toolkit - GCP Infrastructure
# ============================================================================

# Project Configuration
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1" # Free tier eligible region
}

variable "zone" {
  description = "GCP zone for zonal resources"
  type        = string
  default     = "us-central1-a"
}

# Application Configuration
variable "app_name" {
  description = "Application name (used for resource naming)"
  type        = string
  default     = "data-hygiene-toolkit"
}

variable "environment" {
  description = "Environment name (prod, staging, dev)"
  type        = string
  default     = "prod"
}

# Domain Configuration
variable "domain_name" {
  description = "Custom domain for API (optional)"
  type        = string
  default     = "api.kshitij.space"
}

# Cloud Run Configuration
variable "cloud_run_image" {
  description = "Container image for Cloud Run (e.g., gcr.io/PROJECT/app:tag)"
  type        = string
}

variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0 # Scale to zero for cost savings
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run (1000m = 1 vCPU)"
  type        = string
  default     = "1000m"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run"
  type        = string
  default     = "512Mi"
}

variable "cloud_run_timeout" {
  description = "Request timeout in seconds"
  type        = number
  default     = 300
}

variable "cloud_run_concurrency" {
  description = "Maximum concurrent requests per instance"
  type        = number
  default     = 80
}

# Cloud SQL Configuration
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "data_hygiene"
}

variable "db_user" {
  description = "Database username"
  type        = string
  default     = "dbadmin"
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro" # Free tier eligible
}

variable "db_disk_size" {
  description = "Database disk size in GB"
  type        = number
  default     = 10 # Minimum for PostgreSQL
}

variable "db_disk_type" {
  description = "Database disk type (PD_SSD or PD_HDD)"
  type        = string
  default     = "PD_SSD"
}

variable "db_backup_enabled" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "db_backup_start_time" {
  description = "Backup start time (HH:MM format)"
  type        = string
  default     = "03:00"
}

variable "db_high_availability" {
  description = "Enable high availability (regional failover)"
  type        = bool
  default     = false # Costs extra, disable for free tier
}

# Cloud Storage Configuration
variable "storage_bucket_name" {
  description = "Cloud Storage bucket name (must be globally unique)"
  type        = string
}

variable "storage_location" {
  description = "Storage bucket location"
  type        = string
  default     = "US" # Multi-region for better availability
}

variable "storage_class" {
  description = "Storage class (STANDARD, NEARLINE, COLDLINE, ARCHIVE)"
  type        = string
  default     = "STANDARD"
}

variable "storage_versioning" {
  description = "Enable object versioning"
  type        = bool
  default     = true
}

variable "storage_lifecycle_age" {
  description = "Days before objects are deleted (lifecycle rule)"
  type        = number
  default     = 90
}

# Secret Manager Configuration
variable "secrets" {
  description = "Map of secrets to create in Secret Manager"
  type = map(object({
    value       = string
    description = string
  }))
  # Not marked as sensitive to allow for_each usage
  default   = {}
}

# JWT Configuration
variable "jwt_secret_key" {
  description = "JWT secret key for authentication"
  type        = string
  # Sensitive to protect in logs/outputs
  sensitive   = true
}

variable "jwt_algorithm" {
  description = "JWT algorithm"
  type        = string
  default     = "HS256"
}

variable "jwt_expire_minutes" {
  description = "JWT token expiration in minutes"
  type        = number
  default     = 30
}

# CORS Configuration
variable "cors_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = []
}

# Cloud Run Access Control
variable "allow_unauthenticated" {
  description = "Allow unauthenticated access to Cloud Run. Set to true only for public APIs that handle their own authentication (e.g., JWT). Defaults to false for security."
  type        = bool
  default     = false
}
}

# Networking Configuration
variable "vpc_name" {
  description = "VPC network name"
  type        = string
  default     = "data-hygiene-vpc"
}

variable "subnet_cidr" {
  description = "Subnet CIDR range"
  type        = string
  default     = "10.0.0.0/24"
}

variable "vpc_connector_cidr" {
  description = "VPC connector CIDR range"
  type        = string
  default     = "10.8.0.0/28"
}

# Tags and Labels
variable "labels" {
  description = "Common labels to apply to all resources"
  type        = map(string)
  default = {
    project     = "data-hygiene-toolkit"
    managed_by  = "terraform"
    environment = "production"
  }
}

# Cost Management
variable "budget_amount" {
  description = "Monthly budget amount in USD"
  type        = number
  default     = 0 # Stay on free tier
}

variable "budget_alert_threshold" {
  description = "Budget alert threshold percentage"
  type        = number
  default     = 0.8 # Alert at 80%
}
