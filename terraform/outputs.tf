# ============================================================================
# Terraform Outputs
# GRIME - GCP Infrastructure
# ============================================================================

# Cloud Run Outputs
output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = module.cloud_run.service_url
}

output "cloud_run_service_name" {
  description = "Cloud Run service name"
  value       = module.cloud_run.service_name
}

# Cloud SQL Outputs
output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name (for Cloud Run)"
  value       = module.cloud_sql.connection_name
}

output "cloud_sql_instance_name" {
  description = "Cloud SQL instance name"
  value       = module.cloud_sql.instance_name
}

output "cloud_sql_private_ip" {
  description = "Cloud SQL private IP address"
  value       = module.cloud_sql.private_ip
  sensitive   = true
}

output "database_name" {
  description = "Database name"
  value       = module.cloud_sql.database_name
}

# Cloud Storage Outputs
output "storage_bucket_name" {
  description = "Cloud Storage bucket name"
  value       = module.cloud_storage.bucket_name
}

output "storage_bucket_url" {
  description = "Cloud Storage bucket URL"
  value       = module.cloud_storage.bucket_url
}

# Networking Outputs
output "vpc_network_name" {
  description = "VPC network name"
  value       = module.networking.vpc_name
}

output "vpc_connector_id" {
  description = "VPC connector ID (for Cloud Run)"
  value       = module.networking.vpc_connector_id
}

# Secret Manager Outputs
output "secret_names" {
  description = "List of created secret names"
  value       = module.secret_manager.secret_names
  sensitive   = true
}

# Service Account Output
output "cloud_run_service_account" {
  description = "Cloud Run service account email"
  value       = module.cloud_run.service_account_email
}

# Connection String (for reference, not to be exposed)
output "database_connection_string" {
  description = "Database connection string template"
  value       = "postgresql://${var.db_user}:<PASSWORD>@//${var.db_name}?host=/cloudsql/${module.cloud_sql.connection_name}"
  sensitive   = true
}

# Deployment Instructions
output "deployment_instructions" {
  description = "Instructions for deploying the application"
  value = <<-EOT
    ========================================
    Deployment Instructions
    ========================================
    
    1. Build and push Docker image:
       docker build -f docker/backend/Dockerfile --target production -t gcr.io/${var.project_id}/data-hygiene-backend:latest .
       docker push gcr.io/${var.project_id}/data-hygiene-backend:latest
    
    2. Deploy to Cloud Run (done automatically if using GitHub Actions):
       gcloud run deploy ${module.cloud_run.service_name} \
         --image gcr.io/${var.project_id}/data-hygiene-backend:latest \
         --region ${var.region}
    
    3. Access your application:
       API URL: ${module.cloud_run.service_url}
       
    4. Configure custom domain (optional):
       gcloud run domain-mappings create --service ${module.cloud_run.service_name} --domain ${var.domain_name}
    
    5. View logs:
       gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=${module.cloud_run.service_name}"
    
    ========================================
  EOT
}

# Cost Estimate
output "estimated_monthly_cost" {
  description = "Estimated monthly cost (USD)"
  value = <<-EOT
    ========================================
    Estimated Monthly Cost (Free Tier)
    ========================================
    
    Cloud Run:        $0 (2M requests/month free)
    Cloud SQL:        $0 (db-f1-micro eligible)
    Cloud Storage:    $0 (5GB free)
    VPC:              $0 (basic usage free)
    Secret Manager:   $0 (free tier)
    
    TOTAL:            $0/month (within free tier)
    
    ⚠️  Monitor usage to stay within limits!
    ========================================
  EOT
}
