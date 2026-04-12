# ============================================================================
# Networking Module - VPC and VPC Connector
# Enables Cloud Run to connect to Cloud SQL via private IP
# ============================================================================

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = var.vpc_name
  auto_create_subnetworks = false
  project                 = var.project_id
}

# Subnet for VPC
resource "google_compute_subnetwork" "subnet" {
  name          = "${var.vpc_name}-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id
  project       = var.project_id

  # Enable Private Google Access (for accessing Google APIs)
  private_ip_google_access = true
}

# VPC Connector (required for Cloud Run to access Cloud SQL via private IP)
resource "google_vpc_access_connector" "connector" {
  name          = "data-hygiene-conn"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = var.vpc_connector_cidr
  project       = var.project_id

  # Minimum machine type for cost optimization
  machine_type = "e2-micro"
  min_instances = 2
  max_instances = 3
}

# Firewall rule to allow internal traffic
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.vpc_name}-allow-internal"
  network = google_compute_network.vpc.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.subnet_cidr, var.vpc_connector_cidr]
}

# Firewall rule to allow Cloud SQL connections
resource "google_compute_firewall" "allow_cloud_sql" {
  name    = "${var.vpc_name}-allow-cloud-sql"
  network = google_compute_network.vpc.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["5432"] # PostgreSQL port
  }

  source_ranges = [var.vpc_connector_cidr]
  target_tags   = ["cloud-sql"]
}
