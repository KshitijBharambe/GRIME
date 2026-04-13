from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, cast
import re
import logging
from uuid import uuid4

from app.database import get_session
from app.models import User, Dataset, DatasetColumn
from app.auth import get_any_authenticated_user, get_any_org_member_context, OrgContext
from app.schemas import DatasetResponse, DataProfileResponse, DatasetColumnResponse
from app.services.data_import import DataImportService
from app.utils import sanitize_input, validate_identifier
from app.middleware.organization import OrganizationFilter
from app.core.config import (
    ErrorMessages,
    MAX_FILE_SIZE_BYTES,
    GUEST_MAX_FILE_SIZE_BYTES,
    MAX_JSON_ARRAY_ITEMS,
    MAX_JSON_KEY_LENGTH,
    MAX_JSON_STRING_VALUE_LENGTH,
    MAX_JSON_KEYS_PER_OBJECT,
    MAX_FILENAME_LENGTH,
)

router = APIRouter(prefix="/data", tags=["Data Import"])

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".txt"}
ALLOWED_MIME_TYPES = {
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
}

# Characters permitted in sanitized filenames
_SAFE_FILENAME_RE = re.compile(r"^[a-zA-Z0-9_.-]+$")


def _validate_filename(filename: str) -> str:
    """Validate and sanitize an upload filename.

    Checks length, characters, double extensions, and path-traversal patterns.
    Returns the sanitized name or raises HTTPException.
    """
    if not filename or not filename.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a filename",
        )

    if len(filename) > MAX_FILENAME_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Filename exceeds maximum length of {MAX_FILENAME_LENGTH} characters",
        )

    # Reject path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename contains illegal path characters",
        )

    # Reject double extensions (e.g. file.csv.exe)
    if len(filename.split(".")) > 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename must not contain multiple extensions",
        )

    # Sanitize to safe characters
    sanitized = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename)
    return sanitized


def _validate_content_type(filename: str, content_type: str | None) -> None:
    """Validate file extension and MIME type."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{ext}' is not supported. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File MIME type is not supported.",
        )


async def _read_file_with_size_limit(
    file: UploadFile, max_bytes: int = MAX_FILE_SIZE_BYTES
) -> bytes:
    """Read upload file contents while enforcing a hard size cap.

    This streams the file in chunks so that we never buffer more than
    ``max_bytes + chunk`` before rejecting the request — even when the
    client omits or lies about Content-Length.
    """
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
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {max_bytes // (1024 * 1024)}MB limit",
            )
        chunks.append(chunk)

    return b"".join(chunks)


def _validate_json_payload(data: List[Dict[str, Any]]) -> None:
    """Deep-validate a JSON array payload for size / complexity limits.

    Checks:
    - Total number of records
    - Number of keys per record
    - Key name length
    - String value length
    """
    if len(data) > MAX_JSON_ARRAY_ITEMS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"JSON data exceeds {MAX_JSON_ARRAY_ITEMS:,} records limit",
        )

    for idx, record in enumerate(data):
        if not isinstance(record, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Record at index {idx} is not a JSON object",
            )

        if len(record) > MAX_JSON_KEYS_PER_OBJECT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Record at index {idx} has {len(record)} keys, "
                    f"exceeding the limit of {MAX_JSON_KEYS_PER_OBJECT}"
                ),
            )

        for key, value in record.items():
            if len(key) > MAX_JSON_KEY_LENGTH:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Key '{key[:50]}…' in record {idx} exceeds "
                        f"the maximum key length of {MAX_JSON_KEY_LENGTH}"
                    ),
                )
            if isinstance(value, str) and len(value) > MAX_JSON_STRING_VALUE_LENGTH:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Value for key '{key}' in record {idx} exceeds "
                        f"the maximum string length of {MAX_JSON_STRING_VALUE_LENGTH:,}"
                    ),
                )


def _sanitize_identifier(value: str, field_name: str) -> str:
    try:
        return validate_identifier(value, field_name=field_name)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_name}"
        )


def _get_upload_size_limit_bytes(org_context: OrgContext) -> int:
    if org_context.is_guest:
        return min(MAX_FILE_SIZE_BYTES, GUEST_MAX_FILE_SIZE_BYTES)
    return MAX_FILE_SIZE_BYTES


@router.post("/upload/file", response_model=Dict[str, Any])
async def upload_file(
    file: UploadFile = File(...),
    dataset_name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Upload and process a CSV or Excel file within organization context.
    """
    if dataset_name:
        dataset_name = sanitize_input(dataset_name)
    if description:
        description = sanitize_input(description)

    # --- Filename validation (before touching file content) ---
    sanitized_filename = _validate_filename(file.filename or "")

    # --- Content-type / extension validation ---
    _validate_content_type(sanitized_filename, file.content_type)

    upload_limit_bytes = _get_upload_size_limit_bytes(org_context)

    # --- Early size gate using Content-Length header (cheap check) ---
    if file.size is not None and file.size > upload_limit_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {upload_limit_bytes // (1024 * 1024)}MB limit",
        )

    # --- Streaming size-limited read (defends against missing/spoofed Content-Length) ---
    file_bytes = await _read_file_with_size_limit(file, max_bytes=upload_limit_bytes)

    # Reset the file with the validated bytes so downstream can re-read
    from io import BytesIO

    file.file = BytesIO(file_bytes)
    file.filename = sanitized_filename

    # Process the file with organization context
    import_service = DataImportService(db)
    result = await import_service.import_file(
        file, org_context.user, dataset_name, org_context.organization_id
    )

    return {
        "message": "File uploaded and processed successfully",
        "dataset": result["dataset"],
        "profile": result["profile"],
    }


@router.post("/upload/json", response_model=Dict[str, Any])
async def upload_json_data(
    dataset_name: str,
    data: List[Dict[str, Any]],
    description: Optional[str] = None,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Upload JSON data directly within organization context.
    """
    dataset_name = sanitize_input(dataset_name)
    data = sanitize_input(data)
    if description:
        description = sanitize_input(description)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="JSON data cannot be empty"
        )

    # Validate payload structure, sizes, and complexity
    _validate_json_payload(data)

    # Process the JSON data with organization context
    import_service = DataImportService(db)
    result = import_service.import_json_data(
        data, org_context.user, dataset_name, org_context.organization_id
    )

    return {
        "message": "JSON data processed successfully",
        "dataset": result["dataset"],
        "profile": result["profile"],
    }


@router.get("/datasets", response_model=List[DatasetResponse])
async def list_datasets(
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    List all datasets accessible to the current organization.
    """
    query = db.query(Dataset)
    query = OrganizationFilter.filter_by_org(
        query, Dataset, org_context, include_shared=False
    )
    datasets = query.all()
    return [DatasetResponse.model_validate(dataset) for dataset in datasets]


@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Get details of a specific dataset within organization.
    """
    dataset_id = _sanitize_identifier(dataset_id, "dataset_id")

    query = db.query(Dataset).filter(Dataset.id == dataset_id)
    query = OrganizationFilter.filter_by_org(
        query, Dataset, org_context, include_shared=False
    )
    dataset = query.first()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.DATASET_NOT_FOUND,
        )

    return DatasetResponse.model_validate(dataset)


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Delete a dataset within organization (owner/admin only).
    """
    dataset_id = _sanitize_identifier(dataset_id, "dataset_id")

    query = db.query(Dataset).filter(Dataset.id == dataset_id)
    query = OrganizationFilter.filter_by_org(
        query, Dataset, org_context, include_shared=False
    )
    dataset = query.first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.DATASET_NOT_FOUND,
        )

    # Check permissions
    from app.models import (
        UserRole,
        DatasetVersion,
        DatasetColumn,
        Execution,
        Issue,
        ExecutionRule,
    )

    # Cast to Dataset type to help type checker
    dataset = cast(Dataset, dataset)
    uploaded_by_id = str(getattr(dataset, "uploaded_by", ""))
    current_user_id = str(current_user.id)
    user_role = getattr(current_user, "role", None)
    if uploaded_by_id != current_user_id and user_role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this dataset",
        )

    try:
        # Delete related records in correct order to avoid foreign key violations
        from app.models import Fix, Export

        # 1. Get all dataset versions
        dataset_versions = (
            db.query(DatasetVersion)
            .filter(DatasetVersion.dataset_id == dataset_id)
            .all()
        )

        for version in dataset_versions:
            # Get all executions for this version
            executions = (
                db.query(Execution)
                .filter(Execution.dataset_version_id == version.id)
                .all()
            )

            for execution in executions:
                # Get all issues for this execution
                issues = (
                    db.query(Issue).filter(Issue.execution_id == execution.id).all()
                )

                # Delete fixes for each issue
                for issue in issues:
                    db.query(Fix).filter(Fix.issue_id == issue.id).delete()

                # Delete issues
                db.query(Issue).filter(Issue.execution_id == execution.id).delete()

                # Delete execution rules
                db.query(ExecutionRule).filter(
                    ExecutionRule.execution_id == execution.id
                ).delete()

                # Delete exports for this execution
                db.query(Export).filter(Export.execution_id == execution.id).delete()

            # Delete executions
            db.query(Execution).filter(
                Execution.dataset_version_id == version.id
            ).delete()

            # Delete exports for this version
            db.query(Export).filter(Export.dataset_version_id == version.id).delete()

        # 2. Delete dataset versions
        db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset_id
        ).delete()

        # 3. Delete dataset columns
        db.query(DatasetColumn).filter(DatasetColumn.dataset_id == dataset_id).delete()

        # 4. Delete the dataset file from storage
        from app.services.data_import import DATASET_STORAGE_PATH
        import os

        for version in dataset_versions:
            file_path = (
                DATASET_STORAGE_PATH / f"{dataset_id}_v{version.version_no}.parquet"
            )
            if file_path.exists():
                os.remove(file_path)

        # 5. Finally delete the dataset itself
        db.delete(dataset)
        db.commit()

        return {"message": "Dataset deleted successfully"}

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 403)
        raise

    except Exception as e:
        db.rollback()
        error_id = str(uuid4())
        logger.error(f"Failed to delete dataset [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get(
    "/datasets/{dataset_id}/columns", response_model=List[DatasetColumnResponse]
)
async def get_dataset_columns(
    dataset_id: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """
    Get columns for a specific dataset
    """
    dataset_id = _sanitize_identifier(dataset_id, "dataset_id")
    # First verify the dataset exists
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.DATASET_NOT_FOUND,
        )

    # Get dataset columns
    columns = (
        db.query(DatasetColumn)
        .filter(DatasetColumn.dataset_id == dataset_id)
        .order_by(DatasetColumn.ordinal_position)
        .all()
    )
    return [DatasetColumnResponse.model_validate(column) for column in columns]


@router.get("/datasets/{dataset_id}/profile", response_model=DataProfileResponse)
async def get_dataset_profile(
    dataset_id: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """
    Get comprehensive data profile for a dataset
    """
    dataset_id = _sanitize_identifier(dataset_id, "dataset_id")
    # Get dataset
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.DATASET_NOT_FOUND,
        )

    # Get dataset columns
    columns = (
        db.query(DatasetColumn)
        .filter(DatasetColumn.dataset_id == dataset_id)
        .order_by(DatasetColumn.ordinal_position)
        .all()
    )

    # Build data types summary
    data_types_summary = {}
    for column in columns:
        col_type = column.inferred_type or "unknown"
        data_types_summary[col_type] = data_types_summary.get(col_type, 0) + 1

    # For now, create basic missing values summary
    # In a real implementation, this would analyze the actual data
    missing_values_summary = {}

    return DataProfileResponse(
        total_rows=dataset.row_count or 0,
        total_columns=dataset.column_count or 0,
        columns=[DatasetColumnResponse.model_validate(column) for column in columns],
        data_types_summary=data_types_summary,
        missing_values_summary=missing_values_summary,
    )
