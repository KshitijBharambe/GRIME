"""
Storage configuration and settings.

Centralized configuration for storage backend settings.
"""

from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class StorageSettings(BaseSettings):
    """Storage configuration settings."""

    # Storage backend type
    storage_type: str = Field(default="minio", env="STORAGE_TYPE")

    # MinIO settings
    storage_endpoint: str = Field(
        default="http://localhost:9000", env="STORAGE_ENDPOINT"
    )
    storage_access_key: str = Field(default="", env="STORAGE_ACCESS_KEY")
    storage_secret_key: str = Field(default="", env="STORAGE_SECRET_KEY")
    storage_region: str = Field(default="us-east-1", env="STORAGE_REGION")
    storage_use_ssl: bool = Field(default=False, env="STORAGE_USE_SSL")

    # GCS settings
    google_cloud_project: Optional[str] = Field(
        default=None, env="GOOGLE_CLOUD_PROJECT"
    )
    gcp_project_id: Optional[str] = Field(default=None, env="GCP_PROJECT_ID")

    # Common settings
    storage_bucket: str = Field(default="data-hygiene", env="STORAGE_BUCKET")
    storage_max_file_size_mb: int = Field(default=100, env="STORAGE_MAX_FILE_SIZE_MB")

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.storage_max_file_size_mb * 1024 * 1024

    @property
    def project_id(self) -> Optional[str]:
        """Get GCP project ID from either env variable."""
        return self.google_cloud_project or self.gcp_project_id


# Global settings instance
storage_settings = StorageSettings()
