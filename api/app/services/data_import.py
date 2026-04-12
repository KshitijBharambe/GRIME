import pandas as pd
import json
import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from io import BytesIO

from app.models import (
    Dataset,
    DatasetVersion,
    DatasetColumn,
    SourceType,
    DatasetStatus,
    User,
)
from app.schemas import DatasetResponse, DatasetColumnResponse, DataProfileResponse
from app.utils import (
    MemoryMonitor,
    ChunkedDataFrameReader,
    OptimizedDataFrameOperations,
    estimate_file_memory,
)

# Configure logging
logger = logging.getLogger(__name__)

from app.core.config import (
    DEFAULT_IMPORT_CHUNK_SIZE,
    MEMORY_THRESHOLD_MB,
    LARGE_FILE_MEMORY_THRESHOLD_MB,
    TYPE_INFERENCE_SAMPLE_SIZE,
)

# Configuration for data storage
DATASET_STORAGE_PATH = Path("data/datasets")


class DataImportService:

    def __init__(self, db: Session):
        self.db = db
        # Initialize chunked reader with optimized settings
        self.chunked_reader = ChunkedDataFrameReader(
            chunk_size=DEFAULT_IMPORT_CHUNK_SIZE,
            memory_threshold_mb=MEMORY_THRESHOLD_MB,
        )
        # Ensure storage directory exists
        DATASET_STORAGE_PATH.mkdir(parents=True, exist_ok=True)

    def calculate_file_checksum(self, content: bytes) -> str:
        """Calculate MD5 checksum of file content"""
        return hashlib.md5(content).hexdigest()

    def save_dataset_file(
        self, dataset_id: str, df: pd.DataFrame, version_no: int = 1
    ) -> str:
        """Save dataset DataFrame to file storage and return the file path"""
        # Create filename: dataset_id_v{version_no}.parquet
        filename = f"{dataset_id}_v{version_no}.parquet"
        file_path = DATASET_STORAGE_PATH / filename

        # Save as parquet for efficient storage and fast loading
        df.to_parquet(file_path, index=False)

        return str(file_path)

    def load_dataset_file(self, dataset_id: str, version_no: int = 1) -> pd.DataFrame:
        """Load dataset DataFrame from file storage"""
        filename = f"{dataset_id}_v{version_no}.parquet"
        file_path = DATASET_STORAGE_PATH / filename

        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset file not found: {filename}",
            )

        return pd.read_parquet(file_path)

    def detect_source_type(self, filename: str) -> SourceType:
        """Detect source type based on file extension"""
        ext = filename.lower().split(".")[-1]
        if ext in ["csv", "txt"]:
            return SourceType.csv
        elif ext in ["xlsx", "xls"]:
            return SourceType.excel
        elif ext == "json":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="JSON files should be processed through the JSON import endpoint",
            )
        else:
            return SourceType.other

    def read_file_to_dataframe(
        self, file_content: bytes, source_type: SourceType, filename: str
    ) -> pd.DataFrame:
        """Convert file content to pandas DataFrame with memory optimization"""

        # Estimate memory requirement
        file_size_bytes = len(file_content)
        file_size_mb = file_size_bytes / 1024 / 1024
        estimated_memory = estimate_file_memory(
            file_size_bytes, "csv" if source_type == SourceType.csv else "excel"
        )

        MemoryMonitor.log_memory_usage("before file read")
        logger.info(
            f"Processing file: {filename} ({file_size_mb:.2f}MB, estimated memory: {estimated_memory:.2f}MB)"
        )

        try:
            if source_type == SourceType.csv:
                # Check if we should use chunking based on file size
                if estimated_memory > LARGE_FILE_MEMORY_THRESHOLD_MB:
                    logger.info(
                        f"Large file detected ({estimated_memory:.2f}MB estimated), using chunked read"
                    )

                    # Try different encodings with chunking
                    for encoding in ["utf-8", "latin-1", "cp1252"]:
                        try:
                            chunks = []
                            for chunk in self.chunked_reader.read_csv_chunked(
                                file_content, encoding=encoding
                            ):
                                chunks.append(chunk)

                            if chunks:
                                df = pd.concat(chunks, ignore_index=True)
                                del chunks  # Free memory
                                break
                        except UnicodeDecodeError:
                            continue
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Could not decode CSV file with any supported encoding",
                        )
                else:
                    # Small file, read normally
                    for encoding in ["utf-8", "latin-1", "cp1252"]:
                        try:
                            df = pd.read_csv(BytesIO(file_content), encoding=encoding)
                            break
                        except UnicodeDecodeError:
                            continue
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Could not decode CSV file with any supported encoding",
                        )

            elif source_type == SourceType.excel:
                df = pd.read_excel(BytesIO(file_content))

            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported file type for {filename}",
                )

            MemoryMonitor.log_memory_usage("after file read")

            # Optimize DataFrame dtypes to save memory
            logger.info("Optimizing DataFrame dtypes")
            df = OptimizedDataFrameOperations.optimize_dtypes(df)

            MemoryMonitor.log_memory_usage("after dtype optimization")

            return df

        except HTTPException:
            # Re-raise HTTPExceptions as-is
            raise
        except Exception as e:
            MemoryMonitor.log_memory_usage("error during read")
            logger.error("Error processing file %s: %s", filename, e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file could not be processed. Please check the file format and try again.",
            )

    def infer_column_types(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Infer data types for each column"""
        column_info = []

        for i, column in enumerate(df.columns):
            series = df[column]

            # Calculate missing values
            null_count = series.isnull().sum()
            is_nullable = null_count > 0

            # Infer data type
            dtype_str = str(series.dtype)

            # More detailed type inference
            if dtype_str.startswith("int"):
                inferred_type = "integer"
            elif dtype_str.startswith("float"):
                inferred_type = "decimal"
            elif dtype_str == "bool":
                inferred_type = "boolean"
            elif dtype_str == "datetime64":
                inferred_type = "datetime"
            else:
                inferred_type = "text"

                # Try to detect more specific types for object columns
                if dtype_str == "object":
                    non_null_series = series.dropna()
                    if len(non_null_series) > 0:
                        # Check if it looks like dates
                        try:
                            pd.to_datetime(
                                non_null_series.head(TYPE_INFERENCE_SAMPLE_SIZE)
                            )
                            inferred_type = "datetime"
                        except Exception:
                            # Check if it looks like numbers
                            try:
                                pd.to_numeric(
                                    non_null_series.head(TYPE_INFERENCE_SAMPLE_SIZE)
                                )
                                inferred_type = "decimal"
                            except Exception:
                                inferred_type = "text"

            column_info.append(
                {
                    "name": column,
                    "ordinal_position": i + 1,
                    "inferred_type": inferred_type,
                    "is_nullable": is_nullable,
                    "null_count": int(null_count),
                    "unique_count": int(series.nunique()),
                    "sample_values": series.dropna().head(5).tolist(),
                }
            )

        return column_info

    def create_dataset_record(
        self,
        filename: str,
        df: pd.DataFrame,
        current_user: User,
        dataset_name: Optional[str] = None,
        organization_id: Optional[str] = None,
    ) -> Dataset:
        """Create dataset record in database with organization context"""

        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="organization_id is required",
            )

        # Generate checksum
        file_content = df.to_csv(index=False).encode()
        checksum = self.calculate_file_checksum(file_content)

        # Check for existing dataset with same checksum within organization
        existing_dataset = (
            self.db.query(Dataset)
            .filter(
                Dataset.checksum == checksum, Dataset.organization_id == organization_id
            )
            .first()
        )
        if existing_dataset:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Dataset with identical content already exists: {existing_dataset.name}",
            )

        source_type = self.detect_source_type(filename)

        # Create dataset record with organization context
        dataset = Dataset(
            organization_id=organization_id,
            name=dataset_name or filename.split(".")[0],
            source_type=source_type,
            original_filename=filename,
            checksum=checksum,
            uploaded_by=current_user.id,
            status=DatasetStatus.uploaded,
            row_count=len(df),
            column_count=len(df.columns),
        )

        self.db.add(dataset)
        self.db.commit()
        self.db.refresh(dataset)

        return dataset

    def create_dataset_columns(
        self, dataset: Dataset, column_info: List[Dict[str, Any]]
    ):
        """Create column records for dataset"""

        dataset_columns = []
        for col_info in column_info:
            column = DatasetColumn(
                dataset_id=dataset.id,
                name=col_info["name"],
                ordinal_position=col_info["ordinal_position"],
                inferred_type=col_info["inferred_type"],
                is_nullable=col_info["is_nullable"],
            )
            dataset_columns.append(column)

        self.db.add_all(dataset_columns)
        self.db.commit()

        return dataset_columns

    def create_initial_version(
        self, dataset: Dataset, current_user: User
    ) -> DatasetVersion:
        """Create initial version of dataset"""

        version = DatasetVersion(
            dataset_id=dataset.id,
            version_no=1,
            created_by=current_user.id,
            rows=dataset.row_count,
            columns=dataset.column_count,
            change_note="Initial dataset upload",
        )

        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)

        return version

    async def import_file(
        self,
        file: UploadFile,
        current_user: User,
        dataset_name: Optional[str] = None,
        organization_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Main method to import a file"""

        # Read file content
        content = await file.read()

        # Detect source type
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must have a filename",
            )
        source_type = self.detect_source_type(file.filename)

        # Convert to DataFrame
        df = self.read_file_to_dataframe(content, source_type, file.filename)

        # Validate DataFrame
        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File appears to be empty or contains no data",
            )

        # Infer column types and get profile
        column_info = self.infer_column_types(df)

        # Create dataset record with organization context
        dataset = self.create_dataset_record(
            file.filename, df, current_user, dataset_name, organization_id
        )

        # Create column records
        columns = self.create_dataset_columns(dataset, column_info)

        # Create initial version
        version = self.create_initial_version(dataset, current_user)

        # Save dataset data to file storage
        try:
            self.save_dataset_file(dataset.id, df, version.version_no)
        except Exception as e:
            # If file save fails, rollback database changes
            self.db.rollback()
            logger.error("Failed to save dataset file: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save the dataset. Please try again or contact support.",
            )

        # Update dataset status
        dataset.status = DatasetStatus.profiled
        self.db.commit()

        return {
            "dataset": DatasetResponse.model_validate(dataset),
            "profile": DataProfileResponse(
                total_rows=len(df),
                total_columns=len(df.columns),
                columns=[DatasetColumnResponse.model_validate(col) for col in columns],
                data_types_summary={
                    col_info["inferred_type"]: sum(
                        1
                        for c in column_info
                        if c["inferred_type"] == col_info["inferred_type"]
                    )
                    for col_info in column_info
                },
                missing_values_summary={
                    col_info["name"]: col_info["null_count"]
                    for col_info in column_info
                    if col_info["null_count"] > 0
                },
            ),
        }

    def import_json_data(
        self,
        json_data: List[Dict[str, Any]],
        current_user: User,
        dataset_name: str,
        organization_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Import JSON data directly with organization context"""

        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="organization_id is required",
            )

        if not json_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="JSON data is empty"
            )

        # Convert JSON to DataFrame
        try:
            df = pd.DataFrame(json_data)
        except Exception as e:
            logger.error("Error converting JSON data to DataFrame: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The provided JSON data could not be parsed. Please verify the data format.",
            )

        # Generate a dummy filename for JSON data
        filename = f"{dataset_name}.json"

        # Infer column types and get profile
        column_info = self.infer_column_types(df)

        # Create dataset record (but with JSON source type)
        file_content = json.dumps(json_data).encode()
        checksum = self.calculate_file_checksum(file_content)

        dataset = Dataset(
            organization_id=organization_id,
            name=dataset_name,
            source_type=SourceType.other,  # or create a JSON source type
            original_filename=filename,
            checksum=checksum,
            uploaded_by=current_user.id,
            status=DatasetStatus.uploaded,
            row_count=len(df),
            column_count=len(df.columns),
        )

        self.db.add(dataset)
        self.db.commit()
        self.db.refresh(dataset)

        # Create column records
        columns = self.create_dataset_columns(dataset, column_info)

        # Create initial version
        version = self.create_initial_version(dataset, current_user)

        # Save dataset data to file storage
        try:
            self.save_dataset_file(dataset.id, df, version.version_no)
        except Exception as e:
            # If file save fails, rollback database changes
            self.db.rollback()
            logger.error("Failed to save dataset file: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save the dataset. Please try again or contact support.",
            )

        # Update dataset status
        dataset.status = DatasetStatus.profiled
        self.db.commit()

        return {
            "dataset": DatasetResponse.model_validate(dataset),
            "profile": DataProfileResponse(
                total_rows=len(df),
                total_columns=len(df.columns),
                columns=[DatasetColumnResponse.model_validate(col) for col in columns],
                data_types_summary={
                    col_info["inferred_type"]: sum(
                        1
                        for c in column_info
                        if c["inferred_type"] == col_info["inferred_type"]
                    )
                    for col_info in column_info
                },
                missing_values_summary={
                    col_info["name"]: col_info["null_count"]
                    for col_info in column_info
                    if col_info["null_count"] > 0
                },
            ),
        }
