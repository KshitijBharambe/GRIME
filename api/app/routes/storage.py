"""
Example API routes demonstrating storage abstraction usage.

Shows how to use the storage backend in a storage-agnostic way.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import Response
import logging
from uuid import uuid4

from ..storage import storage
from ..storage.config import storage_settings
from ..storage.base import StorageError
from app.core.config import ErrorMessages

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/storage", tags=["Storage"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a file to storage (MinIO or GCS based on configuration).

    This endpoint works identically regardless of whether MinIO (local)
    or GCS (production) is configured - the abstraction layer handles it!
    """
    try:
        max_bytes = storage_settings.max_file_size_bytes

        # --- Validate size BEFORE reading full file into memory ---
        # Fast path: Content-Length header
        if file.size is not None and file.size > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds maximum allowed size "
                f"({storage_settings.storage_max_file_size_mb}MB)",
            )

        # Streaming read with hard cap (defends against missing/spoofed header)
        chunks: list[bytes] = []
        total = 0
        chunk_size = 256 * 1024  # 256 KB
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"File size exceeds maximum allowed size "
                    f"({storage_settings.storage_max_file_size_mb}MB)",
                )
            chunks.append(chunk)

        data = b"".join(chunks)
        file_size_mb = len(data) / (1024 * 1024)

        # Generate storage key
        file_key = f"uploads/{file.filename}"

        # Upload to storage - works with both MinIO and GCS!
        url = storage.upload_file(
            bucket=storage_settings.storage_bucket,
            key=file_key,
            data=data,
            content_type=file.content_type or "application/octet-stream",
            metadata={
                "original_filename": file.filename,
                "size_bytes": str(len(data)),
            },
        )

        logger.info(f"Uploaded file {file.filename} to {url}")

        return {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "size_bytes": len(data),
            "size_mb": round(file_size_mb, 2),
            "storage_key": file_key,
            "url": url,
            "storage_backend": storage_settings.storage_type,
        }

    except StorageError as e:
        error_id = str(uuid4())
        logger.error(
            f"Storage error during upload [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Internal error. Reference: {error_id}"
        )
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Unexpected error during upload [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Internal error. Reference: {error_id}"
        )


@router.get("/download/{file_key:path}")
async def download_file(file_key: str):
    """
    Download a file from storage (works with both MinIO and GCS).

    Args:
        file_key: The storage key/path of the file
    """
    try:
        # Check if file exists
        if not storage.file_exists(storage_settings.storage_bucket, file_key):
            raise HTTPException(status_code=404, detail=ErrorMessages.FILE_NOT_FOUND)

        # Get file metadata
        metadata = storage.get_file_metadata(storage_settings.storage_bucket, file_key)

        # Download file data
        data = storage.download_file(storage_settings.storage_bucket, file_key)

        # Extract filename from key
        filename = file_key.split("/")[-1]

        logger.info(f"Downloaded file {file_key}")

        return Response(
            content=data,
            media_type=metadata.get("content_type", "application/octet-stream"),
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=ErrorMessages.FILE_NOT_FOUND)
    except StorageError as e:
        error_id = str(uuid4())
        logger.error(
            f"Storage error during download [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Internal error. Reference: {error_id}"
        )
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Unexpected error during download [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Internal error. Reference: {error_id}"
        )


@router.get("/signed-url/{file_key:path}")
async def get_signed_url(
    file_key: str, expiration: int = Query(default=3600, ge=60, le=604800)
):
    """
    Generate a signed URL for temporary file access.

    Args:
        file_key: The storage key/path of the file
        expiration: URL expiration time in seconds (1 minute to 7 days)
    """
    try:
        # Check if file exists
        if not storage.file_exists(storage_settings.storage_bucket, file_key):
            raise HTTPException(status_code=404, detail=ErrorMessages.FILE_NOT_FOUND)

        # Generate signed URL
        signed_url = storage.get_signed_url(
            bucket=storage_settings.storage_bucket, key=file_key, expiration=expiration
        )

        logger.info(f"Generated signed URL for {file_key}")

        return {
            "file_key": file_key,
            "signed_url": signed_url,
            "expiration_seconds": expiration,
            "storage_backend": storage_settings.storage_type,
        }

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=ErrorMessages.FILE_NOT_FOUND)
    except StorageError as e:
        error_id = str(uuid4())
        logger.error(
            f"Storage error generating signed URL [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Internal error. Reference: {error_id}"
        )


@router.get("/list")
async def list_files(
    prefix: str = Query(default="", description="Filter files by prefix"),
    max_results: int = Query(default=100, ge=1, le=1000),
):
    """
    List files in storage.

    Args:
        prefix: Optional prefix to filter files
        max_results: Maximum number of results (1-1000)
    """
    try:
        files = storage.list_files(
            bucket=storage_settings.storage_bucket,
            prefix=prefix,
            max_results=max_results,
        )

        logger.info(f"Listed {len(files)} files with prefix '{prefix}'")

        return {
            "bucket": storage_settings.storage_bucket,
            "prefix": prefix,
            "count": len(files),
            "files": files,
            "storage_backend": storage_settings.storage_type,
        }

    except StorageError as e:
        error_id = str(uuid4())
        logger.error(
            f"Storage error listing files [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Internal error. Reference: {error_id}"
        )


@router.delete("/delete/{file_key:path}")
async def delete_file(file_key: str):
    """
    Delete a file from storage.

    Args:
        file_key: The storage key/path of the file
    """
    try:
        # Delete the file
        deleted = storage.delete_file(storage_settings.storage_bucket, file_key)

        if not deleted:
            raise HTTPException(status_code=404, detail=ErrorMessages.FILE_NOT_FOUND)

        logger.info(f"Deleted file {file_key}")

        return {
            "message": "File deleted successfully",
            "file_key": file_key,
            "storage_backend": storage_settings.storage_type,
        }

    except StorageError as e:
        error_id = str(uuid4())
        logger.error(
            f"Storage error during deletion [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Internal error. Reference: {error_id}"
        )


@router.get("/metadata/{file_key:path}")
async def get_file_metadata(file_key: str):
    """
    Get metadata about a file.

    Args:
        file_key: The storage key/path of the file
    """
    try:
        metadata = storage.get_file_metadata(storage_settings.storage_bucket, file_key)

        logger.info(f"Retrieved metadata for {file_key}")

        return {
            "file_key": file_key,
            "metadata": metadata,
            "storage_backend": storage_settings.storage_type,
        }

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=ErrorMessages.FILE_NOT_FOUND)
    except StorageError as e:
        error_id = str(uuid4())
        logger.error(
            f"Storage error retrieving metadata [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Internal error. Reference: {error_id}"
        )


@router.get("/health")
async def storage_health():
    """
    Check storage backend health and configuration.
    """
    try:
        # Test basic storage operations
        test_key = "_healthcheck_test"
        test_data = b"health check"

        # Try to upload
        storage.upload_file(
            bucket=storage_settings.storage_bucket,
            key=test_key,
            data=test_data,
            content_type="text/plain",
        )

        # Try to download
        downloaded = storage.download_file(storage_settings.storage_bucket, test_key)

        # Try to delete
        storage.delete_file(storage_settings.storage_bucket, test_key)

        # Check if operations succeeded
        success = downloaded == test_data

        return {
            "status": "healthy" if success else "degraded",
            "storage_backend": storage_settings.storage_type,
            "bucket": storage_settings.storage_bucket,
            "operations_tested": ["upload", "download", "delete"],
        }

    except Exception as e:
        logger.error(f"Storage health check failed: {e}", exc_info=True)
        return {
            "status": "unhealthy",
            "storage_backend": storage_settings.storage_type,
        }
