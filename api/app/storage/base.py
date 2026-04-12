"""
Abstract base class for storage backends.

Defines the interface that all storage implementations must follow.
"""

from abc import ABC, abstractmethod
from typing import List, Optional


class StorageBackend(ABC):
    """Abstract base class for object storage backends."""

    @abstractmethod
    def upload_file(
        self,
        bucket: str,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> str:
        """
        Upload a file to storage.

        Args:
            bucket: Bucket/container name
            key: Object key/path
            data: File data as bytes
            content_type: MIME type of the file
            metadata: Optional metadata dictionary

        Returns:
            URL or identifier of uploaded object

        Raises:
            StorageError: If upload fails
        """
        pass

    @abstractmethod
    def download_file(self, bucket: str, key: str) -> bytes:
        """
        Download a file from storage.

        Args:
            bucket: Bucket/container name
            key: Object key/path

        Returns:
            File data as bytes

        Raises:
            FileNotFoundError: If object doesn't exist
            StorageError: If download fails
        """
        pass

    @abstractmethod
    def delete_file(self, bucket: str, key: str) -> bool:
        """
        Delete a file from storage.

        Args:
            bucket: Bucket/container name
            key: Object key/path

        Returns:
            True if deleted successfully, False if file didn't exist

        Raises:
            StorageError: If deletion fails
        """
        pass

    @abstractmethod
    def list_files(
        self, bucket: str, prefix: str = "", max_results: int = 1000
    ) -> List[str]:
        """
        List files in bucket with optional prefix filter.

        Args:
            bucket: Bucket/container name
            prefix: Optional prefix to filter results
            max_results: Maximum number of results to return

        Returns:
            List of object keys

        Raises:
            StorageError: If listing fails
        """
        pass

    @abstractmethod
    def get_signed_url(
        self, bucket: str, key: str, expiration: int = 3600, method: str = "GET"
    ) -> str:
        """
        Generate a signed URL for temporary access.

        Args:
            bucket: Bucket name
            key: Object key
            expiration: Expiration time in seconds (default: 1 hour)
            method: HTTP method (GET, PUT, POST, DELETE)

        Returns:
            Signed URL string

        Raises:
            StorageError: If URL generation fails
        """
        pass

    @abstractmethod
    def file_exists(self, bucket: str, key: str) -> bool:
        """
        Check if a file exists in storage.

        Args:
            bucket: Bucket/container name
            key: Object key/path

        Returns:
            True if file exists, False otherwise

        Raises:
            StorageError: If check fails
        """
        pass

    @abstractmethod
    def get_file_metadata(self, bucket: str, key: str) -> dict:
        """
        Get metadata about a file.

        Args:
            bucket: Bucket/container name
            key: Object key/path

        Returns:
            Dictionary with metadata (size, content_type, last_modified, etc.)

        Raises:
            FileNotFoundError: If object doesn't exist
            StorageError: If operation fails
        """
        pass

    @abstractmethod
    def copy_file(
        self, source_bucket: str, source_key: str, dest_bucket: str, dest_key: str
    ) -> bool:
        """
        Copy a file within or between buckets.

        Args:
            source_bucket: Source bucket name
            source_key: Source object key
            dest_bucket: Destination bucket name
            dest_key: Destination object key

        Returns:
            True if copied successfully

        Raises:
            FileNotFoundError: If source object doesn't exist
            StorageError: If copy fails
        """
        pass


class StorageError(Exception):
    """Base exception for storage operations."""

    pass
