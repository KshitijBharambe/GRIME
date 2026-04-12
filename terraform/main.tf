# ============================================================================
# Main Terraform Configuration
# Data Hygiene Toolkit - GCP Infrastructure
# 
# Orchestrates all modules to create complete infrastructure:
# - VPC Networking
# - Cloud SQL PostgreSQL 17
# - Cloud Run (Backend API)
# - Cloud Storage
# - Secret Manager
# ============================================================================

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",              # Cloud Run
    "sqladmin.googleapis.com",         # Cloud SQL
    "compute.googleapis.com",          # Compute Engine (for VPC)
    "servicenetworking.googleapis.com", # Service Networking
    "vpcaccess.googleapis.com",        # VPC Access
    "storage.googleapis.com",          # Cloud Storage
    "secretmanager.googleapis.com",    # Secret Manager
    "cloudresourcemanager.googleapis.com", # Resource Manager
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

# Private VPC Connection for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "${var.app_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = module.networking.vpc_id
  project       = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = module.networking.vpc_id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]

  depends_on = [google_project_service.apis]
}

# Networking Module
module "networking" {
  source = "./modules/networking"

  project_id          = var.project_id
  region              = var.region
  vpc_name            = var.vpc_name
  subnet_cidr         = var.subnet_cidr
  vpc_connector_cidr  = var.vpc_connector_cidr

  depends_on = [google_project_service.apis]
}

# Cloud SQL Module
module "cloud_sql" {
  source = "./modules/cloud-sql"

  project_id             = var.project_id
  region                 = var.region
  app_name               = var.app_name
  environment            = var.environment
  db_name                = var.db_name
  db_user                = var.db_user
  db_tier                = var.db_tier
  db_disk_size           = var.db_disk_size
  db_disk_type           = var.db_disk_type
  db_backup_enabled      = var.db_backup_enabled
  db_backup_start_time   = var.db_backup_start_time
  db_high_availability   = var.db_high_availability
  vpc_id                 = module.networking.vpc_self_link
  private_vpc_connection = google_service_networking_connection.private_vpc_connection

  depends_on = [
    module.networking,
    google_service_networking_connection.private_vpc_connection
  ]
}

# Build environment variables map for Cloud Run
locals {
  # Database connection string (without password - password comes from Secret Manager)
  database_url = "postgresql://${var.db_user}@/${var.db_name}?host=/cloudsql/${module.cloud_sql.connection_name}"

  # Environment variables for Cloud Run
  env_vars = {
    # Environment
    ENVIRONMENT = var.environment
    DEBUG       = "false"

    # Database
    DATABASE_URL       = local.database_url
    ASYNC_DATABASE_URL = "postgresql+asyncpg://${var.db_user}@/${var.db_name}?host=/cloudsql/${module.cloud_sql.connection_name}"

    # Storage (GCS)
    STORAGE_TYPE   = "gcs"
    STORAGE_BUCKET = var.storage_bucket_name
    GOOGLE_CLOUD_PROJECT = var.project_id

    # API Configuration
    API_HOST = "0.0.0.0"
    API_PORT = "8000"

    # JWT
    JWT_ALGORITHM      = var.jwt_algorithm
    JWT_EXPIRE_MINUTES = tostring(var.jwt_expire_minutes)

    # CORS
    CORS_ORIGINS = join(",", var.cors_origins)

    # Python
    PYTHONPATH             = "/app"
    PYTHONDONTWRITEBYTECODE = "1"
    PYTHONUNBUFFERED       = "1"
    PYTHONOPTIMIZE         = "2"
  }

  # Secrets to inject from Secret Manager
  secrets = {
    DB_PASSWORD = {
      secret_name = module.cloud_sql.database_password_secret
      version     = "latest"
    }
    JWT_SECRET_KEY = {
      secret_name = "dht-${var.environment}-jwt"  # Shortened name
      version     = "latest"
    }
  }
}

# Secret Manager Module - Must be created BEFORE Cloud Run
module "secret_manager" {
  source = "./modules/secret-manager"

  project_id = var.project_id
  secrets = {
    "dht-${var.environment}-jwt" = {  # Shortened name
      value       = var.jwt_secret_key
      description = "JWT secret key for authentication"
    }
  }
  labels                     = var.labels
  cloud_run_service_account  = null  # Will be granted access after Cloud Run is created

  depends_on = [google_project_service.apis]
}

# Cloud Run Module
module "cloud_run" {
  source = "./modules/cloud-run"

  project_id            = var.project_id
  region                = var.region
  app_name              = var.app_name
  environment           = var.environment
  container_image       = var.cloud_run_image
  min_instances         = var.cloud_run_min_instances
  max_instances         = var.cloud_run_max_instances
  cpu                   = var.cloud_run_cpu
  memory                = var.cloud_run_memory
  timeout               = var.cloud_run_timeout
  concurrency           = var.cloud_run_concurrency
  vpc_connector_id      = module.networking.vpc_connector_id
  environment_variables = local.env_vars
  secrets               = local.secrets
  # NOTE: Set to true only for public APIs that handle their own authentication (e.g., JWT).
  # For internal services, keep false to require GCP IAM authentication.
  allow_unauthenticated = var.allow_unauthenticated
  custom_domain         = var.domain_name

  depends_on = [
    module.networking,
    module.cloud_sql,
    module.secret_manager
  ]
}

# Cloud Storage Module
module "cloud_storage" {
  source = "./modules/cloud-storage"

  project_id                = var.project_id
  bucket_name               = var.storage_bucket_name
  location                  = var.storage_location
  storage_class             = var.storage_class
  versioning_enabled        = var.storage_versioning
  lifecycle_age             = var.storage_lifecycle_age
  cors_origins              = concat(var.cors_origins, [module.cloud_run.service_url])
  labels                    = var.labels
  cloud_run_service_account = module.cloud_run.service_account_email

  depends_on = [module.cloud_run]
}

# Grant Cloud Run service account access to secrets (after both are created)
resource "google_secret_manager_secret_iam_member" "jwt_secret_access" {
  secret_id = "dht-${var.environment}-jwt"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.cloud_run.service_account_email}"
  project   = var.project_id

  depends_on = [module.secret_manager, module.cloud_run]
}
