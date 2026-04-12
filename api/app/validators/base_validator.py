"""
Enhanced base validator class to reduce code duplication and provide consistent validation patterns.
"""

import json
import pandas as pd
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Set
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.models import Rule
from app.utils import ChunkedDataFrameReader, MemoryMonitor
from app.utils.logging_service import get_logger
from .parameter_schemas import ParameterValidator


logger = get_logger()


class ValidationError(Exception):
    """Custom exception for validation errors."""

    def __init__(self, message: str, field: str = None, value: Any = None):
        self.message = message
        self.field = field
        self.value = value
        super().__init__(message)


class ValidationResult:
    """Standardized validation result container."""

    def __init__(self):
        self.issues: List[Dict[str, Any]] = []
        self.warnings: List[str] = []
        self.errors: List[str] = []
        self.metadata: Dict[str, Any] = {}

    def add_issue(self, issue: Dict[str, Any]) -> None:
        """Add a validation issue."""
        self.issues.append(issue)

    def add_warning(self, message: str) -> None:
        """Add a validation warning."""
        self.warnings.append(message)

    def add_error(self, message: str) -> None:
        """Add a validation error."""
        self.errors.append(message)

    def has_issues(self) -> bool:
        """Check if any issues were found."""
        return len(self.issues) > 0

    def has_errors(self) -> bool:
        """Check if any errors occurred."""
        return len(self.errors) > 0

    def get_summary(self) -> Dict[str, Any]:
        """Get validation summary."""
        return {
            'issues_count': len(self.issues),
            'warnings_count': len(self.warnings),
            'errors_count': len(self.errors),
            'rows_affected': len({issue.get('row_index') for issue in self.issues if 'row_index' in issue}),
            'columns_affected': len({issue.get('column_name') for issue in self.issues if 'column_name' in issue}),
            'metadata': self.metadata
        }


class BaseValidator(ABC):
    """
    Enhanced base class for all rule validators with common functionality.

    This class provides:
    - Consistent parameter parsing and validation
    - Column existence checking
    - Chunked processing support
    - Standardized error handling
    - Comprehensive logging
    - Memory optimization
    """

    def __init__(self, rule: Rule, df: pd.DataFrame, db: Session):
        self.rule = rule
        self.df = df
        self.db = db
        self.logger = get_logger()

        # Initialize components
        self.chunked_reader = ChunkedDataFrameReader(chunk_size=5000)
        self.parameter_validator = ParameterValidator()

        # Parse and validate parameters
        self.params = self._parse_and_validate_parameters()

        # Extract target columns
        self.target_columns = self._extract_target_columns()

        # Validate columns exist in dataset
        self.missing_columns = self._validate_column_existence()

        # Initialize validation context
        self.validation_context = {
            'rule_id': getattr(rule, 'id', 'unknown'),
            'rule_name': getattr(rule, 'name', 'unknown'),
            'rule_kind': getattr(rule, 'kind', 'unknown'),
            'dataset_shape': df.shape,
            'target_columns': self.target_columns,
            'missing_columns': self.missing_columns,
            'started_at': datetime.now(timezone.utc)
        }

    def _parse_and_validate_parameters(self) -> Dict[str, Any]:
        """Parse and validate rule parameters."""
        try:
            # Get parameters from rule
            params_str = getattr(self.rule, 'params', None)
            params = json.loads(params_str) if params_str else {}

            # Validate parameters against schema
            rule_kind = getattr(self.rule, 'kind', None)
            if rule_kind:
                validated_params = self.parameter_validator.validate_parameters(
                    rule_kind, params
                )
                return validated_params

            return params

        except json.JSONDecodeError as e:
            self.logger.log_error(
                "Invalid JSON in rule parameters",
                exception=e,
                rule_id=getattr(self.rule, 'id', 'unknown')
            )
            raise ValidationError(f"Invalid JSON in rule parameters: {str(e)}")
        except Exception as e:
            self.logger.log_error(
                "Parameter validation failed",
                exception=e,
                rule_id=getattr(self.rule, 'id', 'unknown')
            )
            raise ValidationError(f"Parameter validation failed: {str(e)}")

    def _extract_target_columns(self) -> List[str]:
        """Extract target columns from rule configuration."""
        # Try to get columns from params first
        columns = self.params.get('columns', [])

        if not columns:
            # Try getting from target_columns field
            target_columns_str = getattr(self.rule, 'target_columns', None)
            if target_columns_str:
                try:
                    columns = json.loads(target_columns_str) if isinstance(
                        target_columns_str, str) else target_columns_str
                except json.JSONDecodeError:
                    self.logger.log_warning(
                        "Invalid JSON in target_columns field",
                        rule_id=getattr(self.rule, 'id', 'unknown')
                    )
                    columns = []

        return columns if isinstance(columns, list) else []

    def _validate_column_existence(self) -> Set[str]:
        """Check if target columns exist in the dataset."""
        if not self.target_columns:
            return set()

        missing_columns = set()
        for column in self.target_columns:
            if column not in self.df.columns:
                missing_columns.add(column)

        if missing_columns:
            self.logger.log_warning(
                "Target columns not found in dataset",
                rule_id=getattr(self.rule, 'id', 'unknown'),
                missing_columns=list(missing_columns),
                available_columns=list(self.df.columns)
            )

        return missing_columns

    def _should_use_chunking(self) -> bool:
        """Determine if chunked processing should be used."""
        return len(self.df) > 10000

    def _create_issue(
        self,
        row_index: int,
        column_name: str,
        current_value: Any = None,
        suggested_value: Any = None,
        message: str = None,
        category: str = None
    ) -> Dict[str, Any]:
        """Create a standardized issue dictionary."""
        return {
            'row_index': int(str(row_index)) if not isinstance(row_index, int) else row_index,
            'column_name': column_name,
            'current_value': current_value,
            'suggested_value': suggested_value,
            'message': message or f'Validation issue found in {column_name}',
            'category': category or 'validation',
            'rule_id': getattr(self.rule, 'id', 'unknown'),
            'rule_name': getattr(self.rule, 'name', 'unknown')
        }

    def _validate_row_base(
        self,
        row: pd.Series,
        row_index: int,
        column_name: str
    ) -> List[Dict[str, Any]]:
        """
        Validate a single row for a specific column.
        Override in subclasses for custom validation logic.
        """
        return []

    def _filter_valid_columns(self, columns: List[str]) -> List[str]:
        """Filter out columns that don't exist in the dataset."""
        return [col for col in columns if col in self.df.columns]

    def _safe_get_value(self, row: pd.Series, column: str) -> Any:
        """Safely get value from row, handling missing columns."""
        if column not in row.index:
            return None
        return row[column]

    def _is_null_value(self, value: Any) -> bool:
        """Check if a value should be considered null/empty."""
        return pd.isna(value) or value == '' or value is None

    def validate(self) -> List[Dict[str, Any]]:
        """
        Main validation entry point with enhanced error handling and logging.

        Returns:
            List of validation issues
        """
        result = ValidationResult()

        try:
            self.logger.log_info(
                "Starting validation",
                **self.validation_context
            )

            # Check if we have valid target columns
            if not self.target_columns:
                result.add_error("No target columns configured for validation")
                return result.issues

            # Filter to only existing columns
            valid_columns = self._filter_valid_columns(self.target_columns)
            if not valid_columns:
                result.add_error(
                    "None of the target columns exist in the dataset")
                return result.issues

            # Log missing columns as warnings
            if self.missing_columns:
                result.add_warning(
                    f"Target columns not found: {', '.join(self.missing_columns)}"
                )

            # Choose processing method
            if self._should_use_chunking():
                self.logger.log_info(
                    "Using chunked validation",
                    dataset_size=len(self.df),
                    chunk_size=self.chunked_reader.chunk_size
                )
                issues = self._validate_chunked(result)
            else:
                self.logger.log_info(
                    "Using full dataset validation",
                    dataset_size=len(self.df)
                )
                issues = self._validate_full(result)

            # Update result
            for issue in issues:
                result.add_issue(issue)

            # Log completion
            self.validation_context['completed_at'] = datetime.now(
                timezone.utc)
            self.validation_context['duration_ms'] = (
                self.validation_context['completed_at'] -
                self.validation_context['started_at']
            ).total_seconds() * 1000

            self.logger.log_info(
                "Validation completed",
                **result.get_summary(),
                **self.validation_context
            )

            return result.issues

        except Exception as e:
            self.logger.log_error(
                "Validation failed with unexpected error",
                exception=e,
                **self.validation_context
            )
            result.add_error(f"Validation failed: {str(e)}")
            return result.issues

    def _validate_full(self, result: ValidationResult) -> List[Dict[str, Any]]:
        """Validate the full dataset at once."""
        all_issues = []

        # Log memory usage
        MemoryMonitor.log_memory_usage("before_full_validation")

        for column in self._filter_valid_columns(self.target_columns):
            try:
                column_issues = self._validate_column_full(column)
                all_issues.extend(column_issues)
            except Exception as e:
                self.logger.log_error(
                    "Column validation failed",
                    exception=e,
                    column=column,
                    rule_id=getattr(self.rule, 'id', 'unknown')
                )
                result.add_error(
                    f"Failed to validate column {column}: {str(e)}")

        MemoryMonitor.log_memory_usage("after_full_validation")
        return all_issues

    def _validate_chunked(self, result: ValidationResult) -> List[Dict[str, Any]]:
        """Validate dataset in chunks for memory efficiency."""
        all_issues = []

        MemoryMonitor.log_memory_usage("before_chunked_validation")

        try:
            all_issues = self.chunked_reader.process_in_chunks(
                df=self.df,
                processor_func=lambda chunk: self._validate_chunk(chunk),
                combine_results=True
            )
        except Exception as e:
            self.logger.log_error(
                "Chunked validation failed",
                exception=e,
                rule_id=getattr(self.rule, 'id', 'unknown')
            )
            result.add_error(f"Chunked validation failed: {str(e)}")

        MemoryMonitor.log_memory_usage("after_chunked_validation")
        return all_issues

    def _validate_chunk(self, chunk: pd.DataFrame) -> List[Dict[str, Any]]:
        """Validate a single chunk of data."""
        # Temporarily replace self.df with chunk
        original_df = self.df
        self.df = chunk

        try:
            result = ValidationResult()
            issues = self._validate_full(result)
            return issues
        finally:
            # Restore original dataframe
            self.df = original_df

    def _validate_column_full(self, column: str) -> List[Dict[str, Any]]:
        """
        Validate a single column across the full dataset.
        Override in subclasses for column-specific validation logic.
        """
        issues = []

        for idx in self.df.index:
            try:
                row = self.df.iloc[idx]
                row_issues = self._validate_row(row, int(idx), column)
                issues.extend(row_issues)
            except Exception as e:
                self.logger.log_warning(
                    "Row validation failed",
                    exception=e,
                    row_index=int(idx),
                    column=column
                )
                # Continue with other rows even if one fails

        return issues

    @abstractmethod
    def _validate_row(self, row: pd.Series, row_index: int, column: str) -> List[Dict[str, Any]]:
        """
        Validate a single row for a specific column.
        Must be implemented by subclasses.
        """
        pass

    def get_validation_metadata(self) -> Dict[str, Any]:
        """Get metadata about the validation process."""
        return {
            'rule_id': getattr(self.rule, 'id', 'unknown'),
            'rule_name': getattr(self.rule, 'name', 'unknown'),
            'rule_kind': getattr(self.rule, 'kind', 'unknown'),
            'target_columns': self.target_columns,
            'missing_columns': list(self.missing_columns),
            'dataset_shape': self.df.shape,
            'uses_chunking': self._should_use_chunking(),
            'chunk_size': self.chunked_reader.chunk_size if self._should_use_chunking() else None
        }
