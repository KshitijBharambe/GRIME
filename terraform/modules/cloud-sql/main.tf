# ============================================================================
# Cloud SQL Module - PostgreSQL 17 Database
# Free tier eligible with db-f1-micro
# ============================================================================

# Generate random password for database
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Cloud SQL Instance
resource "google_sql_database_instance" "main" {
  name             = "dht-${var.environment}-db"  # Shortened name
  database_version = "POSTGRES_17"
  region           = var.region
  project          = var.project_id

  # Enable deletion protection in production
  deletion_protection = var.environment == "prod" ? true : false

  settings {
    tier              = var.db_tier # db-f1-micro for free tier
    disk_size         = var.db_disk_size
    disk_type         = var.db_disk_type
    disk_autoresize   = true
    availability_type = var.db_high_availability ? "REGIONAL" : "ZONAL"

    # Backup configuration
    backup_configuration {
      enabled            = var.db_backup_enabled
      start_time         = var.db_backup_start_time
      point_in_time_recovery_enabled = false # Not available on free tier
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
      }
    }

    # IP configuration - Private IP only (no public IP)
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.vpc_id
      enable_private_path_for_google_cloud_services = true
    }

    # Maintenance window
    maintenance_window {
      day          = 7 # Sunday
      hour         = 3 # 3 AM
      update_track = "stable"
    }

    # Database flags for optimization (tuned for db-f1-micro with 1GB RAM)
    database_flags {
      name  = "max_connections"
      value = "50" # Reduced for f1-micro
    }

    database_flags {
      name  = "shared_buffers"
      value = "16384" # 128MB in 8KB pages
    }

    database_flags {
      name  = "effective_cache_size"
      value = "65536" # 512MB in 8KB pages (within allowed range 13107-91750)
    }

    database_flags {
      name  = "work_mem"
      value = "4096" # 4MB in KB
    }

    # Insights configuration
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }

  depends_on = [
    var.private_vpc_connection
  ]
}

# Create database
resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.main.name
  project  = var.project_id
}

# Create database user
resource "google_sql_user" "user" {
  name     = var.db_user
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
  project  = var.project_id
}

# Store database password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "dht-${var.environment}-db-pwd"  # Shortened name
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}
