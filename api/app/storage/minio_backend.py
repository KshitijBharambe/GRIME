"""
MinIO storage backend implementation.

Uses MinIO (S3-compatible) for local development and testing.
"""

import logging
from typing import List, Optional

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError, BotoCoreError

from .base import StorageBackend, StorageError

logger = logging.getLogger(__name__)


class MinioStorage(StorageBackend):
    """MinIO storage backend (S3-compatible)."""

    def __init__(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        region: str = "us-east-1",
        use_ssl: bool = False,
    ):
        """
        Initialize MinIO storage backend.

        Args:
            endpoint_url: MinIO server endpoint (e.g., http://localhost:9000)
            access_key: Access key
            secret_key: Secret key
            region: Region name (default: us-east-1)
            use_ssl: Whether to use SSL/TLS
        """
        self.endpoint_url = endpoint_url
        self.region = region

        # Create S3 client with signature version v4
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            config=Config(signature_version="s3v4"),
            use_ssl=use_ssl,
        )

        logger.info(f"Initialized MinIO storage backend at {endpoint_url}")

    def _ensure_bucket_exists(self, bucket: str) -> None:
        """Create bucket if it doesn't exist."""
        try:
            self.client.head_bucket(Bucket=bucket)
            logger.debug(f"Bucket {bucket} exists")
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "404":
                try:
                    self.client.create_bucket(Bucket=bucket)
                    logger.info(f"Created bucket {bucket}")
                except ClientError as create_error:
                    raise StorageError(
                        f"Failed to create bucket {bucket}: {create_error}"
                    )
            else:
                raise StorageError(f"Failed to check bucket {bucket}: {e}")

    def upload_file(
        self,
        bucket: str,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> str:
        """Upload a file to MinIO."""
        try:
            self._ensure_bucket_exists(bucket)

            extra_args = {"ContentType": content_type}
            if metadata:
                extra_args["Metadata"] = metadata

            self.client.put_object(
                Bucket=bucket, Key=key, Body=data, **extra_args
            )

            # Return the object URL
            url = f"{self.endpoint_url}/{bucket}/{key}"
            logger.info(f"Uploaded file to {url}")
            return url

        except (ClientError, BotoCoreError) as e:
            logger.error(f"Failed to upload file {key} to bucket {bucket}: {e}")
            raise StorageError(f"Upload failed: {e}")

    def download_file(self, bucket: str, key: str) -> bytes:
        """Download a file from MinIO."""
        try:
            response = self.client.get_object(Bucket=bucket, Key=key)
            data = response["Body"].read()
            logger.info(f"Downloaded file {key} from bucket {bucket}")
            return data

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "NoSuchKey":
                raise FileNotFoundError(f"File {key} not found in bucket {bucket}")
            logger.error(f"Failed to download file {key} from bucket {bucket}: {e}")
            raise StorageError(f"Download failed: {e}")

    def delete_file(self, bucket: str, key: str) -> bool:
        """Delete a file from MinIO."""
        try:
            # Check if file exists first
            if not self.file_exists(bucket, key):
                logger.warning(f"File {key} does not exist in bucket {bucket}")
                return False

            self.client.delete_object(Bucket=bucket, Key=key)
            logger.info(f"Deleted file {key} from bucket {bucket}")
            return True

        except (ClientError, BotoCoreError) as e:
            logger.error(f"Failed to delete file {key} from bucket {bucket}: {e}")
            raise StorageError(f"Delete failed: {e}")

    def list_files(
        self, bucket: str, prefix: str = "", max_results: int = 1000
    ) -> List[str]:
        """List files in MinIO bucket."""
        try:
            response = self.client.list_objects_v2(
                Bucket=bucket, Prefix=prefix, MaxKeys=max_results
            )

            files = []
            if "Contents" in response:
                files = [obj["Key"] for obj in response["Contents"]]

            logger.info(
                f"Listed {len(files)} files in bucket {bucket} with prefix '{prefix}'"
            )
            return files

        except (ClientError, BotoCoreError) as e:
            logger.error(
                f"Failed to list files in bucket {bucket} with prefix '{prefix}': {e}"
            )
            raise StorageError(f"List failed: {e}")

    def get_signed_url(
        self, bucket: str, key: str, expiration: int = 3600, method: str = "GET"
    ) -> str:
        """Generate a presigned URL for MinIO object."""
        try:
            # Map HTTP methods to S3 client methods
            method_map = {
                "GET": "get_object",
                "PUT": "put_object",
                "POST": "post_object",
                "DELETE": "delete_object",
            }

            client_method = method_map.get(method.upper())
            if not client_method:
                raise ValueError(f"Unsupported HTTP method: {method}")

            url = self.client.generate_presigned_url(
                ClientMethod=client_method,
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expiration,
            )

            logger.info(f"Generated signed URL for {key} in bucket {bucket}")
            return url

        except (ClientError, BotoCoreError) as e:
            logger.error(f"Failed to generate signed URL for {key}: {e}")
            raise StorageError(f"Signed URL generation failed: {e}")

    def file_exists(self, bucket: str, key: str) -> bool:
        """Check if file exists in MinIO."""
        try:
            self.client.head_object(Bucket=bucket, Key=key)
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "404":
                return False
            logger.error(f"Failed to check if file {key} exists in bucket {bucket}: {e}")
            raise StorageError(f"Existence check failed: {e}")

    def get_file_metadata(self, bucket: str, key: str) -> dict:
        """Get file metadata from MinIO."""
        try:
            response = self.client.head_object(Bucket=bucket, Key=key)

            metadata = {
                "size": response.get("ContentLength", 0),
                "content_type": response.get("ContentType", ""),
                "last_modified": response.get("LastModified"),
                "etag": response.get("ETag", "").strip('"'),
                "metadata": response.get("Metadata", {}),
            }

            logger.info(f"Retrieved metadata for {key} from bucket {bucket}")
            return metadata

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "404":
                raise FileNotFoundError(f"File {key} not found in bucket {bucket}")
            logger.error(f"Failed to get metadata for {key} from bucket {bucket}: {e}")
            raise StorageError(f"Metadata retrieval failed: {e}")

    def copy_file(
        self, source_bucket: str, source_key: str, dest_bucket: str, dest_key: str
    ) -> bool:
        """Copy file within or between MinIO buckets."""
        try:
            # Check if source file exists
            if not self.file_exists(source_bucket, source_key):
                raise FileNotFoundError(
                    f"Source file {source_key} not found in bucket {source_bucket}"
                )

            # Ensure destination bucket exists
            self._ensure_bucket_exists(dest_bucket)

            # Copy the object
            copy_source = {"Bucket": source_bucket, "Key": source_key}
            self.client.copy_object(
                CopySource=copy_source, Bucket=dest_bucket, Key=dest_key
            )

            logger.info(
                f"Copied file from {source_bucket}/{source_key} to {dest_bucket}/{dest_key}"
            )
            return True

        except FileNotFoundError:
            raise
        except (ClientError, BotoCoreError) as e:
            logger.error(f"Failed to copy file: {e}")
            raise StorageError(f"Copy failed: {e}")
