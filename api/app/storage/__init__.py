"""
Storage abstraction layer for GRIME.

Provides a unified interface for object storage that works seamlessly
with both MinIO (local development) and Google Cloud Storage (production).
"""

from .factory import get_storage, storage

__all__ = ["get_storage", "storage"]
