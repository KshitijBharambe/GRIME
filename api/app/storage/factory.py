"""
Storage backend factory.

Factory pattern to create appropriate storage backend based on configuration.
"""

import logging
import os
from typing import Optional

from .base import StorageBackend, StorageError
from .minio_backend import MinioStorage
from .gcs_backend import GCSStorage

logger = logging.getLogger(__name__)


def get_storage(
    storage_type: Optional[str] = None,
    endpoint_url: Optional[str] = None,
    access_key: Optional[str] = None,
    secret_key: Optional[str] = None,
    region: Optional[str] = None,
    project_id: Optional[str] = None,
    use_ssl: bool = False,
) -> StorageBackend:
    """
    Factory function to return appropriate storage backend based on configuration.

    Args:
        storage_type: Type of storage ('minio', 'gcs'). If None, read from STORAGE_TYPE env var
        endpoint_url: MinIO endpoint URL (for MinIO backend)
        access_key: Access key (for MinIO backend)
        secret_key: Secret key (for MinIO backend)
        region: Region (for MinIO backend)
        project_id: GCP project ID (for GCS backend)
        use_ssl: Whether to use SSL (for MinIO backend)

    Returns:
        Configured storage backend instance

    Raises:
        ValueError: If storage type is unknown or configuration is invalid
        StorageError: If backend initialization fails
    """
    # Determine storage type
    if storage_type is None:
        storage_type = os.getenv("STORAGE_TYPE", "minio").lower()
    else:
        storage_type = storage_type.lower()

    logger.info(f"Initializing storage backend: {storage_type}")

    try:
        if storage_type == "gcs":
            # Google Cloud Storage
            if project_id is None:
                project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv(
                    "GCP_PROJECT_ID"
                )

            return GCSStorage(project_id=project_id)

        elif storage_type == "minio":
            # MinIO (S3-compatible)
            if endpoint_url is None:
                endpoint_url = os.getenv("STORAGE_ENDPOINT", "http://localhost:9000")
            if access_key is None:
                access_key = os.getenv("STORAGE_ACCESS_KEY")
            if secret_key is None:
                secret_key = os.getenv("STORAGE_SECRET_KEY")
            if region is None:
                region = os.getenv("STORAGE_REGION", "us-east-1")

            if not access_key or not secret_key:
                raise ValueError(
                    "MinIO credentials must be provided via STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY"
                )

            # Check for SSL configuration
            if os.getenv("STORAGE_USE_SSL", "").lower() in ("true", "1", "yes"):
                use_ssl = True

            return MinioStorage(
                endpoint_url=endpoint_url,
                access_key=access_key,
                secret_key=secret_key,
                region=region,
                use_ssl=use_ssl,
            )

        else:
            raise ValueError(
                f"Unknown storage type: {storage_type}. Supported types: 'minio', 'gcs'"
            )

    except Exception as e:
        logger.error(f"Failed to initialize storage backend '{storage_type}': {e}")
        raise StorageError(f"Storage initialization failed: {e}")


# Singleton instance - initialized on first import
# This can be used directly: from app.storage import storage
storage: Optional[StorageBackend] = None


def init_storage() -> StorageBackend:
    """
    Initialize and return the singleton storage instance.

    This function can be called multiple times safely - it will only
    initialize once and return the same instance.
    """
    global storage

    if storage is None:
        storage = get_storage()
        logger.info("Storage backend initialized successfully")

    return storage


# Auto-initialize on import (can be disabled if needed)
try:
    storage = get_storage()
except Exception as e:
    logger.warning(f"Storage backend auto-initialization failed: {e}")
    logger.warning("Call init_storage() explicitly when ready to initialize")
    storage = None
