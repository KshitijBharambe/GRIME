# ============================================================================
# Cloud Run Module - Serverless Backend API
# Auto-scaling from 0 to N instances
# ============================================================================

# Service Account for Cloud Run
resource "google_service_account" "cloud_run" {
  account_id   = "dht-${var.environment}-run-sa"  # Shortened to fit 30 char limit
  display_name = "Cloud Run Service Account for ${var.app_name}"
  project      = var.project_id
}

# IAM Role - Cloud SQL Client
resource "google_project_iam_member" "cloud_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# IAM Role - Secret Manager Accessor
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# IAM Role - Storage Object Admin (for GCS)
resource "google_project_iam_member" "storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Run Service
resource "google_cloud_run_v2_service" "main" {
  name     = "dht-${var.environment}-api"  # Shortened name
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.cloud_run.email

    # Scaling configuration
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    # VPC Access (for Cloud SQL private IP)
    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY" # Only use VPC for private IPs
    }

    # Timeout
    timeout = "${var.timeout}s"

    # Container configuration
    containers {
      image = var.container_image

      # Resource limits
      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle = true # CPU throttling when idle
      }

      # Port
      ports {
        container_port = 8000
        name           = "http1"
      }

      # Environment variables
      dynamic "env" {
        for_each = var.environment_variables
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secrets from Secret Manager
      dynamic "env" {
        for_each = var.secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret_name
              version = env.value.version
            }
          }
        }
      }

      # Startup probe - allow up to 240s for app to start (30 failures × 8s)
      startup_probe {
        http_get {
          path = "/"
          port = 8000
        }
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 8
        failure_threshold     = 30
      }

      # Liveness probe
      liveness_probe {
        http_get {
          path = "/"
          port = 8000
        }
        initial_delay_seconds = 0
        timeout_seconds       = 1
        period_seconds        = 10
        failure_threshold     = 3
      }
    }

    # Max concurrent requests per instance
    max_instance_request_concurrency = var.concurrency
  }

  # Traffic routing - 100% to latest revision
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_iam_member.cloud_sql_client,
    google_project_iam_member.secret_accessor,
    google_project_iam_member.storage_admin,
  ]
}

# IAM Policy - Allow unauthenticated access
resource "google_cloud_run_v2_service_iam_member" "noauth" {
  count    = var.allow_unauthenticated ? 1 : 0
  project  = google_cloud_run_v2_service.main.project
  location = google_cloud_run_v2_service.main.location
  name     = google_cloud_run_v2_service.main.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Domain mapping (optional)
resource "google_cloud_run_domain_mapping" "main" {
  count    = var.custom_domain != "" ? 1 : 0
  location = var.region
  name     = var.custom_domain
  project  = var.project_id

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.main.name
  }
}
