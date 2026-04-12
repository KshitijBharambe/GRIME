# ============================================================================
# Secret Manager Module - Secure Storage for Secrets
# ============================================================================

# Create secrets
resource "google_secret_manager_secret" "secrets" {
  for_each = var.secrets

  secret_id = each.key
  project   = var.project_id

  replication {
    auto {}
  }

  labels = merge(
    var.labels,
    {
      managed_by = "terraform"
    }
  )
}

# Add secret versions
resource "google_secret_manager_secret_version" "versions" {
  for_each = var.secrets

  secret      = google_secret_manager_secret.secrets[each.key].id
  secret_data = each.value.value
}

# IAM policy to allow Cloud Run service account to access secrets
# Only create if cloud_run_service_account is provided
resource "google_secret_manager_secret_iam_member" "cloud_run_access" {
  for_each = var.cloud_run_service_account != null ? var.secrets : {}

  secret_id = google_secret_manager_secret.secrets[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cloud_run_service_account}"
  project   = var.project_id
}
