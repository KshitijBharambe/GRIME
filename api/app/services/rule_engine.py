import pandas as pd
import json
import re
import logging
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from app.models import (
    Rule,
    RuleKind,
    Execution,
    ExecutionRule,
    Issue,
    DatasetVersion,
    User,
    Criticality,
    ExecutionStatus,
)
from app.utils import ChunkedDataFrameReader, MemoryMonitor
from app.core.config import (
    CHUNKED_VALIDATION_THRESHOLD,
    DEFAULT_CHUNK_SIZE,
    FLOAT_COMPARISON_TOLERANCE,
    US_PHONE_DIGITS,
)
from app.services.rule_versioning import (
    create_rule_snapshot,
    create_lightweight_rule_snapshot,
)
from app.validators.statistical_validators import (
    StatisticalOutlierValidator,
    DistributionCheckValidator,
    CorrelationValidator,
)
from app.services.anomaly_detection import MLAnomalyValidator

# Configure logging
logger = logging.getLogger(__name__)


class RuleValidator(ABC):
    """Abstract base class for all rule validators"""

    def __init__(self, rule: Rule, df: pd.DataFrame, db: Session):
        self.rule = rule
        self.df = df
        self.db = db
        self.chunked_reader = ChunkedDataFrameReader(chunk_size=DEFAULT_CHUNK_SIZE)

        # Handle SQLAlchemy model attribute access
        params_str = getattr(rule, "params", None)
        self.params = json.loads(params_str) if params_str else {}

        # Merge target_columns into params if not already present
        # This ensures validators can access columns from either location
        target_columns_str = getattr(rule, "target_columns", None)
        if target_columns_str:
            target_columns = (
                json.loads(target_columns_str)
                if isinstance(target_columns_str, str)
                else target_columns_str
            )
            if target_columns and "columns" not in self.params:
                self.params["columns"] = target_columns

    @abstractmethod
    def validate(self) -> List[Dict[str, Any]]:
        """
        Validate data against the rule and return list of issues
        Returns: List of issue dictionaries with keys:
            - row_index: int
            - column_name: str
            - current_value: str
            - suggested_value: str (optional)
            - message: str
            - category: str
        """
        pass

    def validate_chunked(self) -> List[Dict[str, Any]]:
        """
        Validate data in chunks for memory efficiency.
        Override this in validators that can benefit from chunking.
        """
        # Default implementation processes in chunks
        MemoryMonitor.log_memory_usage(f"before validation: {self.rule.name}")

        all_issues = self.chunked_reader.process_in_chunks(
            df=self.df,
            processor_func=lambda chunk: self._validate_chunk(chunk),
            combine_results=True,
        )

        MemoryMonitor.log_memory_usage(f"after validation: {self.rule.name}")
        return all_issues

    def _validate_chunk(self, chunk: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Validate a single chunk. Override in subclasses for custom chunked validation.
        Default: calls validate() on the chunk.
        """
        # Temporarily replace self.df with chunk
        original_df = self.df
        self.df = chunk
        issues = self.validate()
        self.df = original_df
        return issues

    @staticmethod
    def _to_row_index(idx) -> int:
        """Normalize a pandas index label to a plain int."""
        return idx if isinstance(idx, int) else int(str(idx))

    def _check_columns(self, target_columns: List[str]) -> List[str]:
        """
        Validate target_columns against self.df.
        Logs warnings for missing columns and returns only the columns that exist.
        Returns empty list (caller should return early) if target_columns is empty.
        """
        if not target_columns:
            logger.warning("Rule %s has no target columns configured", self.rule.name)
            return []
        missing = [col for col in target_columns if col not in self.df.columns]
        if missing:
            logger.warning(
                "Rule %s references non-existent columns: %s", self.rule.name, missing
            )
        return [col for col in target_columns if col in self.df.columns]


class MissingDataValidator(RuleValidator):
    """Validator for missing data detection with chunking support"""

    def validate(self) -> List[Dict[str, Any]]:
        """Main validation entry point"""
        # Use chunking for large DataFrames
        if len(self.df) > CHUNKED_VALIDATION_THRESHOLD:
            logger.info(
                f"Using chunked validation for large dataset ({len(self.df)} rows)"
            )
            return self.validate_chunked()
        else:
            return self._validate_full()

    def _validate_full(self) -> List[Dict[str, Any]]:
        """Original validation logic for small DataFrames"""
        issues = []
        columns = self._check_columns(self.params.get("columns", []))
        if not columns:
            return issues

        for column in columns:
            null_mask = self.df[column].isnull()
            null_indices = self.df[null_mask].index.tolist()

            for idx in null_indices:
                issues.append(
                    {
                        "row_index": self._to_row_index(idx),
                        "column_name": column,
                        "current_value": None,
                        "suggested_value": self.params.get("default_value", ""),
                        "message": f"Missing value in required field {column}",
                        "category": "missing_data",
                    }
                )

        return issues


class StandardizationValidator(RuleValidator):
    """Validator for data standardization (dates, phones, emails, etc.)"""

    def validate(self) -> List[Dict[str, Any]]:
        """Main validation entry point"""
        # Use chunking for large DataFrames
        if len(self.df) > CHUNKED_VALIDATION_THRESHOLD:
            logger.info(
                f"Using chunked validation for large dataset ({len(self.df)} rows)"
            )
            return self.validate_chunked()
        else:
            return self._validate_full()

    def _validate_full(self) -> List[Dict[str, Any]]:
        """Original validation logic for small DataFrames"""
        issues = []
        columns = self._check_columns(self.params.get("columns", []))
        if not columns:
            return issues

        standardization_type = self.params.get("type", "date")
        for column in columns:
            if standardization_type == "date":
                issues.extend(self._validate_dates(column))
            elif standardization_type == "phone":
                issues.extend(self._validate_phones(column))
            elif standardization_type == "email":
                issues.extend(self._validate_emails(column))

        return issues

    def _validate_chunk(self, chunk: pd.DataFrame) -> List[Dict[str, Any]]:
        """Validate a single chunk"""
        # Temporarily replace self.df with chunk
        original_df = self.df
        self.df = chunk
        issues = self._validate_full()
        self.df = original_df
        return issues

    def _validate_dates(self, column: str) -> List[Dict[str, Any]]:
        issues = []
        date_format = self.params.get("format", "%Y-%m-%d")

        for idx, value in self.df[column].items():
            if pd.isnull(value):
                continue

            try:
                # Try to parse the date
                parsed_date = pd.to_datetime(value, format=date_format)
                # Check if it matches expected format
                if str(value) != parsed_date.strftime(date_format):
                    issues.append(
                        {
                            "row_index": self._to_row_index(idx),
                            "column_name": column,
                            "current_value": str(value),
                            "suggested_value": parsed_date.strftime(date_format),
                            "message": f"Date format should be {date_format}",
                            "category": "date_standardization",
                        }
                    )
            except (ValueError, TypeError):
                issues.append(
                    {
                        "row_index": self._to_row_index(idx),
                        "column_name": column,
                        "current_value": str(value),
                        "suggested_value": "",
                        "message": f"Invalid date format, expected {date_format}",
                        "category": "date_standardization",
                    }
                )

        return issues

    def _validate_phones(self, column: str) -> List[Dict[str, Any]]:
        issues = []
        expected_format = self.params.get("format", "+1-XXX-XXX-XXXX")

        for idx, value in self.df[column].items():
            if pd.isnull(value):
                continue

            # Basic phone validation - customize based on requirements
            phone_str = str(value).strip()
            if not phone_str.startswith("+") or len(phone_str) < US_PHONE_DIGITS:
                issues.append(
                    {
                        "row_index": self._to_row_index(idx),
                        "column_name": column,
                        "current_value": str(value),
                        "suggested_value": f"+1-{phone_str}",
                        "message": f"Phone format should be {expected_format}",
                        "category": "phone_standardization",
                    }
                )

        return issues

    def _validate_emails(self, column: str) -> List[Dict[str, Any]]:
        issues = []

        for idx, value in self.df[column].items():
            if pd.isnull(value):
                continue

            email_str = str(value).strip().lower()
            if "@" not in email_str or "." not in email_str.split("@")[-1]:
                issues.append(
                    {
                        "row_index": self._to_row_index(idx),
                        "column_name": column,
                        "current_value": str(value),
                        "suggested_value": email_str,
                        "message": "Invalid email format",
                        "category": "email_standardization",
                    }
                )

        return issues


class ValueListValidator(RuleValidator):
    """Validator for allowed values list"""

    def validate(self) -> List[Dict[str, Any]]:
        """Main validation entry point"""
        # Use chunking for large DataFrames
        if len(self.df) > CHUNKED_VALIDATION_THRESHOLD:
            logger.info(
                f"Using chunked validation for large dataset ({len(self.df)} rows)"
            )
            return self.validate_chunked()
        else:
            return self._validate_full()

    def _validate_full(self) -> List[Dict[str, Any]]:
        """Original validation logic for small DataFrames"""
        issues = []
        allowed_values = self.params.get("allowed_values", [])
        case_sensitive = self.params.get("case_sensitive", True)

        columns = self._check_columns(self.params.get("columns", []))
        if not columns:
            return issues

        if not allowed_values:
            logger.warning("Rule %s has no allowed values configured", self.rule.name)
            return issues

        for column in columns:
            for idx, value in self.df[column].items():
                if pd.isnull(value):
                    continue

                check_value = str(value) if case_sensitive else str(value).lower()
                check_allowed = (
                    allowed_values
                    if case_sensitive
                    else [v.lower() for v in allowed_values]
                )

                if check_value not in check_allowed:
                    issues.append(
                        {
                            "row_index": self._to_row_index(idx),
                            "column_name": column,
                            "current_value": str(value),
                            "suggested_value": (
                                allowed_values[0] if allowed_values else ""
                            ),
                            "message": f'Value must be one of: {", ".join(allowed_values)}',
                            "category": "value_list",
                        }
                    )

        return issues

    def _validate_chunk(self, chunk: pd.DataFrame) -> List[Dict[str, Any]]:
        """Validate a single chunk"""
        # Temporarily replace self.df with chunk
        original_df = self.df
        self.df = chunk
        issues = self._validate_full()
        self.df = original_df
        return issues


class LengthRangeValidator(RuleValidator):
    """Validator for field length constraints"""

    def validate(self) -> List[Dict[str, Any]]:
        issues = []
        min_length = self.params.get("min_length", 0)
        max_length = self.params.get("max_length", float("inf"))

        columns = self._check_columns(self.params.get("columns", []))
        if not columns:
            return issues

        for column in columns:

            for idx, value in self.df[column].items():
                if pd.isnull(value):
                    continue

                value_length = len(str(value))

                if value_length < min_length:
                    issues.append(
                        {
                            "row_index": self._to_row_index(idx),
                            "column_name": column,
                            "current_value": str(value),
                            "suggested_value": "",
                            "message": f"Value too short. Minimum length: {min_length}",
                            "category": "length_range",
                        }
                    )
                elif value_length > max_length:
                    issues.append(
                        {
                            "row_index": self._to_row_index(idx),
                            "column_name": column,
                            "current_value": str(value),
                            "suggested_value": str(value)[:max_length],
                            "message": f"Value too long. Maximum length: {max_length}",
                            "category": "length_range",
                        }
                    )

        return issues


class CharRestrictionValidator(RuleValidator):
    """Validator for character restrictions (alphabetic only, etc.)"""

    def validate(self) -> List[Dict[str, Any]]:
        issues = []
        target_columns = self.params.get("columns", [])
        restriction_type = self.params.get("type", "alphabetic")

        for column in target_columns:
            if column not in self.df.columns:
                continue

            for idx, value in self.df[column].items():
                if pd.isnull(value):
                    continue

                value_str = str(value)
                valid = True
                message = ""

                if restriction_type == "alphabetic":
                    valid = value_str.replace(" ", "").isalpha()
                    message = "Value must contain only alphabetic characters"
                elif restriction_type == "numeric":
                    valid = value_str.replace(".", "").replace("-", "").isdigit()
                    message = "Value must contain only numeric characters"
                elif restriction_type == "alphanumeric":
                    valid = value_str.replace(" ", "").isalnum()
                    message = "Value must contain only alphanumeric characters"

                if not valid:
                    issues.append(
                        {
                            "row_index": self._to_row_index(idx),
                            "column_name": column,
                            "current_value": str(value),
                            "suggested_value": "",
                            "message": message,
                            "category": "char_restriction",
                        }
                    )

        return issues


class CrossFieldValidator(RuleValidator):
    """Validator for cross-field relationships and dependencies"""

    def validate(self) -> List[Dict[str, Any]]:
        issues = []
        rules = self.params.get("rules", [])

        if not rules:
            return issues

        for rule_def in rules:
            rule_type = rule_def.get("type", "")

            if rule_type == "dependency":
                # Field A depends on Field B (if B has value, A must have value)
                issues.extend(self._validate_dependency(rule_def))
            elif rule_type == "mutual_exclusion":
                # Fields A and B cannot both have values
                issues.extend(self._validate_mutual_exclusion(rule_def))
            elif rule_type == "conditional":
                # If field A has specific value, field B must have specific value
                issues.extend(self._validate_conditional(rule_def))
            elif rule_type == "sum_check":
                # Sum of multiple fields must equal specific value or field
                issues.extend(self._validate_sum_check(rule_def))

        return issues

    def _validate_dependency(self, rule_def: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Validate field dependency rules"""
        issues = []
        dependent_field = rule_def.get("dependent_field")
        required_field = rule_def.get("required_field")

        if not dependent_field or not required_field:
            return issues

        if (
            dependent_field not in self.df.columns
            or required_field not in self.df.columns
        ):
            return issues

        for idx, row in self.df.iterrows():
            required_value = row[required_field]
            dependent_value = row[dependent_field]

            # If required field has value but dependent field doesn't
            if pd.notna(required_value) and pd.isna(dependent_value):
                issues.append(
                    {
                        "row_index": self._to_row_index(idx),
                        "column_name": dependent_field,
                        "current_value": None,
                        "suggested_value": "",
                        "message": f"{dependent_field} is required when {required_field} has a value",
                        "category": "cross_field_dependency",
                    }
                )

        return issues

    def _validate_mutual_exclusion(
        self, rule_def: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Validate mutual exclusion rules"""
        issues = []
        fields = rule_def.get("fields", [])

        if len(fields) < 2:
            return issues

        available_fields = [f for f in fields if f in self.df.columns]
        if len(available_fields) < 2:
            return issues

        for idx, row in self.df.iterrows():
            filled_fields = [f for f in available_fields if pd.notna(row[f])]

            if len(filled_fields) > 1:
                issues.append(
                    {
                        "row_index": self._to_row_index(idx),
                        "column_name": ", ".join(filled_fields),
                        "current_value": f"Multiple fields filled: {', '.join(filled_fields)}",
                        "suggested_value": "Only one field should have a value",
                        "message": f'Fields {", ".join(available_fields)} are mutually exclusive',
                        "category": "cross_field_mutual_exclusion",
                    }
                )

        return issues

    def _validate_conditional(self, rule_def: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Validate conditional field rules"""
        issues = []
        condition_field = rule_def.get("condition_field")
        condition_value = rule_def.get("condition_value")
        target_field = rule_def.get("target_field")
        expected_value = rule_def.get("expected_value")

        if not all([condition_field, target_field]):
            return issues

        if (
            condition_field not in self.df.columns
            or target_field not in self.df.columns
        ):
            return issues

        for idx, row in self.df.iterrows():
            if str(row[condition_field]) == str(condition_value):
                target_value = row[target_field]

                if expected_value is not None:
                    # Check for specific expected value
                    if str(target_value) != str(expected_value):
                        issues.append(
                            {
                                "row_index": self._to_row_index(idx),
                                "column_name": target_field,
                                "current_value": str(target_value),
                                "suggested_value": str(expected_value),
                                "message": f"When {condition_field} is {condition_value}, {target_field} must be {expected_value}",
                                "category": "cross_field_conditional",
                            }
                        )
                else:
                    # Check for any value (not null)
                    if pd.isna(target_value):
                        issues.append(
                            {
                                "row_index": self._to_row_index(idx),
                                "column_name": target_field,
                                "current_value": None,
                                "suggested_value": "",
                                "message": f"When {condition_field} is {condition_value}, {target_field} must have a value",
                                "category": "cross_field_conditional",
                            }
                        )

        return issues

    def _validate_sum_check(self, rule_def: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Validate sum check rules"""
        issues = []
        sum_fields = rule_def.get("sum_fields", [])
        total_field = rule_def.get("total_field")
        expected_total = rule_def.get("expected_total")

        if not sum_fields:
            return issues

        available_sum_fields = [f for f in sum_fields if f in self.df.columns]
        if not available_sum_fields:
            return issues

        for idx, row in self.df.iterrows():
            # Calculate sum of numeric fields only
            field_sum = 0
            for field in available_sum_fields:
                try:
                    value = pd.to_numeric(row[field], errors="coerce")
                    if pd.notna(value):
                        field_sum += value
                except (ValueError, TypeError):
                    continue

            # Check against total field or expected value
            if total_field and total_field in self.df.columns:
                try:
                    expected = pd.to_numeric(row[total_field], errors="coerce")
                    # Allow small floating point differences
                    if (
                        pd.notna(expected)
                        and abs(field_sum - expected) > FLOAT_COMPARISON_TOLERANCE
                    ):
                        issues.append(
                            {
                                "row_index": self._to_row_index(idx),
                                "column_name": total_field,
                                "current_value": str(row[total_field]),
                                "suggested_value": str(field_sum),
                                "message": f'Sum of {", ".join(available_sum_fields)} ({field_sum}) does not match {total_field}',
                                "category": "cross_field_sum_check",
                            }
                        )
                except (ValueError, TypeError):
                    continue
            elif expected_total is not None:
                try:
                    expected = float(expected_total)
                    if abs(field_sum - expected) > FLOAT_COMPARISON_TOLERANCE:
                        issues.append(
                            {
                                "row_index": self._to_row_index(idx),
                                "column_name": ", ".join(available_sum_fields),
                                "current_value": str(field_sum),
                                "suggested_value": str(expected_total),
                                "message": f'Sum of {", ".join(available_sum_fields)} ({field_sum}) does not equal expected total ({expected_total})',
                                "category": "cross_field_sum_check",
                            }
                        )
                except (ValueError, TypeError):
                    continue

        return issues


class RegexValidator(RuleValidator):
    """Validator for regular expression pattern matching"""

    def validate(self) -> List[Dict[str, Any]]:
        issues = []
        target_columns = self.params.get("columns", [])
        patterns = self.params.get("patterns", [])

        if not patterns:
            return issues

        for column in target_columns:
            if column not in self.df.columns:
                continue

            for pattern_def in patterns:
                pattern = pattern_def.get("pattern")
                pattern_name = pattern_def.get("name", "pattern")
                must_match = pattern_def.get("must_match", True)

                if not pattern:
                    continue

                try:
                    compiled_pattern = re.compile(pattern)
                    issues.extend(
                        self._validate_pattern(
                            column, compiled_pattern, pattern_name, must_match, pattern
                        )
                    )
                except re.error:
                    # Invalid regex pattern
                    continue

        return issues

    def _validate_pattern(
        self,
        column: str,
        compiled_pattern: re.Pattern,
        pattern_name: str,
        must_match: bool,
        original_pattern: str,
    ) -> List[Dict[str, Any]]:
        """Validate a specific regex pattern against a column"""
        issues = []

        for idx, value in self.df[column].items():
            if pd.isna(value):
                continue

            value_str = str(value)
            matches = bool(compiled_pattern.search(value_str))

            if must_match and not matches:
                issues.append(
                    {
                        "row_index": self._to_row_index(idx),
                        "column_name": column,
                        "current_value": value_str,
                        "suggested_value": "",
                        "message": f'Value does not match required pattern "{pattern_name}" ({original_pattern})',
                        "category": "regex_validation",
                    }
                )
            elif not must_match and matches:
                issues.append(
                    {
                        "row_index": self._to_row_index(idx),
                        "column_name": column,
                        "current_value": value_str,
                        "suggested_value": "",
                        "message": f'Value matches forbidden pattern "{pattern_name}" ({original_pattern})',
                        "category": "regex_validation",
                    }
                )

        return issues


class CustomValidator(RuleValidator):
    """Validator for custom user-defined validation logic with enhanced security"""

    def __init__(self, rule: Rule, df: pd.DataFrame, db: Session):
        super().__init__(rule, df, db)
        # Initialize secure code validator
        from app.security.sandbox import CustomCodeValidator

        self.code_validator = CustomCodeValidator(
            security_level=getattr(rule, "security_level", "medium")
        )

    def validate(self) -> List[Dict[str, Any]]:
        issues = []
        validation_type = self.params.get("type", "python_expression")

        if validation_type == "python_expression":
            issues.extend(self._validate_python_expression())
        elif validation_type == "lookup_table":
            issues.extend(self._validate_lookup_table())
        elif validation_type == "custom_function":
            issues.extend(self._validate_custom_function())

        return issues

    def _validate_python_expression(self) -> List[Dict[str, Any]]:
        """Validate using Python expressions with enhanced security"""
        issues = []
        expression = self.params.get("expression", "")
        target_columns = self.params.get("columns", [])
        error_message = self.params.get("error_message", "Custom validation failed")

        if not expression or not target_columns:
            return issues

        # Validate the expression for security first
        if not self.code_validator.executor.validate_expression(expression):
            logger.error(
                f"Security validation failed for expression: {expression[:100]}"
            )
            return issues

        for idx in self.df.index:
            try:
                row = self.df.iloc[idx]

                # Create safe context for execution
                context = {
                    "row": row.to_dict(),
                    "pd": self._get_safe_pandas(),
                }

                # Add column values to context
                for col in self.df.columns:
                    if col not in context:
                        context[col] = row[col] if pd.notna(row[col]) else None

                # Execute expression securely
                result = self.code_validator.execute_custom_validation(
                    expression, context
                )

                # If result is False, it's an issue
                if not result:
                    for column in target_columns:
                        if column in self.df.columns:
                            issues.append(
                                {
                                    "row_index": int(idx),
                                    "column_name": column,
                                    "current_value": (
                                        str(row[column])
                                        if pd.notna(row[column])
                                        else None
                                    ),
                                    "suggested_value": "",
                                    "message": error_message,
                                    "category": "custom_validation",
                                }
                            )
                            break  # Only add issue once per row

            except Exception as e:
                # Log error but continue with other rows
                logger.warning(f"Custom validation failed for row {idx}: {str(e)}")
                continue

        return issues

    def _get_safe_pandas(self):
        """Get a safe pandas-like interface for basic operations."""

        class SafePandas:
            @staticmethod
            def isna(value):
                """Safe version of pandas.isna"""
                return value is None or value == ""

            @staticmethod
            def to_numeric(value, errors="coerce"):
                """Safe numeric conversion"""
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return None if errors == "coerce" else value

        return SafePandas()

    def _validate_lookup_table(self) -> List[Dict[str, Any]]:
        """Validate using lookup table mappings"""
        issues = []
        lookup_table = self.params.get("lookup_table", {})
        lookup_column = self.params.get("lookup_column")
        target_column = self.params.get("target_column")

        if not lookup_table or not lookup_column or not target_column:
            return issues

        if lookup_column not in self.df.columns or target_column not in self.df.columns:
            return issues

        for idx, row in self.df.iterrows():
            lookup_value = (
                str(row[lookup_column]) if pd.notna(row[lookup_column]) else ""
            )
            target_value = (
                str(row[target_column]) if pd.notna(row[target_column]) else ""
            )
            expected_value = lookup_table.get(lookup_value, "")

            if expected_value and target_value != expected_value:
                issues.append(
                    {
                        "row_index": self._to_row_index(idx),
                        "column_name": target_column,
                        "current_value": target_value,
                        "suggested_value": expected_value,
                        "message": f'Based on {lookup_column} value "{lookup_value}", {target_column} should be "{expected_value}"',
                        "category": "custom_lookup",
                    }
                )

        return issues

    def _validate_custom_function(self) -> List[Dict[str, Any]]:
        """Validate using custom function logic"""
        issues = []
        # This would need to be implemented based on specific requirements
        # For now, return empty list as placeholder
        _function_name = self.params.get("function_name", "")

        # In a real implementation, you might:
        # 1. Load a function from a registry
        # 2. Execute a stored procedure
        # 3. Call an external API

        return issues


class RuleEngineService:
    """Main service for rule engine operations"""

    def __init__(self, db: Session):
        self.db = db
        self.validators = {
            RuleKind.missing_data: MissingDataValidator,
            RuleKind.standardization: StandardizationValidator,
            RuleKind.value_list: ValueListValidator,
            RuleKind.length_range: LengthRangeValidator,
            RuleKind.char_restriction: CharRestrictionValidator,
            RuleKind.cross_field: CrossFieldValidator,
            RuleKind.regex: RegexValidator,
            RuleKind.custom: CustomValidator,
            RuleKind.statistical_outlier: StatisticalOutlierValidator,
            RuleKind.distribution_check: DistributionCheckValidator,
            RuleKind.correlation_validation: CorrelationValidator,
            RuleKind.ml_anomaly: MLAnomalyValidator,
        }

    def _validate_rule_kind(
        self, rule: Rule, execution_rule: ExecutionRule
    ) -> tuple[bool, Optional[RuleKind]]:
        """
        Validate that rule has a kind specified.

        Returns:
            tuple: (is_valid, rule_kind) - is_valid is True if rule has a kind, False otherwise
        """
        rule_kind = getattr(rule, "kind", None)
        if rule_kind is None:
            execution_rule.note = "Rule has no kind specified"
            return False, None
        return True, rule_kind

    def _get_validator_for_rule(
        self, rule_kind: RuleKind, execution_rule: ExecutionRule
    ) -> Optional[type]:
        """
        Get validator class for the given rule kind.

        Returns:
            Validator class or None if not found
        """
        validator_class = self.validators.get(rule_kind)
        if not validator_class:
            execution_rule.note = f"No validator available for rule kind: {rule_kind}"
            return None
        return validator_class

    def _parse_rule_params(
        self, rule: Rule
    ) -> tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Parse and validate rule parameters.

        Returns:
            tuple: (success, params_dict, error_message)
        """
        try:
            params_str = getattr(rule, "params", None)
            params = json.loads(params_str) if params_str else {}
            return True, params, None
        except json.JSONDecodeError as e:
            return False, None, f"Invalid rule parameters JSON: {str(e)}"

    def _validate_target_columns(
        self,
        params: Dict[str, Any],
        rule: Rule,
        rule_kind: RuleKind,
        df: pd.DataFrame,
        execution_rule: ExecutionRule,
    ) -> tuple[bool, List[str], List[str]]:
        """
        Validate that rule has target columns configured and they exist in the dataset.

        Returns:
            tuple: (is_valid, target_columns, missing_columns)
        """
        # Check both params['columns'] and target_columns field
        target_columns = params.get("columns", [])
        if not target_columns:
            # Try getting from target_columns field
            target_columns_str = getattr(rule, "target_columns", None)
            if target_columns_str:
                target_columns = (
                    json.loads(target_columns_str)
                    if isinstance(target_columns_str, str)
                    else target_columns_str
                )

        if not target_columns and rule_kind not in [RuleKind.custom]:
            execution_rule.note = "Rule has no target columns configured"
            return False, [], []

        # Check if columns exist in dataset
        missing_columns = [col for col in target_columns if col not in df.columns]
        if missing_columns:
            execution_rule.note = (
                f"Warning: Columns not found in dataset: {', '.join(missing_columns)}"
            )
            # Don't fail completely, just note it and continue

        return True, target_columns, missing_columns

    def _create_issues_from_validation(
        self,
        issues: List[Dict[str, Any]],
        execution: Execution,
        rule: Rule,
        lightweight_snapshot: str,
    ) -> List[Issue]:
        """
        Create Issue records from validation results.

        Returns:
            List of created Issue objects
        """
        rule_issues = []

        for issue_data in issues:
            try:
                # Validate required fields
                if "row_index" not in issue_data or "column_name" not in issue_data:
                    continue

                issue = Issue(
                    execution_id=execution.id,
                    rule_id=rule.id,
                    rule_snapshot=lightweight_snapshot,
                    row_index=issue_data["row_index"],
                    column_name=issue_data["column_name"],
                    current_value=issue_data.get("current_value"),
                    suggested_value=issue_data.get("suggested_value"),
                    message=issue_data.get("message", "Data quality issue found"),
                    category=issue_data.get("category", "unknown"),
                    severity=rule.criticality,
                )
                self.db.add(issue)
                rule_issues.append(issue)
            except Exception as issue_error:
                print(f"Error creating issue record: {str(issue_error)}")
                continue

        return rule_issues

    def _update_execution_stats(
        self, execution: Execution, all_issues: List[Issue]
    ) -> None:
        """
        Calculate and update execution summary statistics.
        """
        # Calculate summary statistics safely
        if all_issues:
            execution.rows_affected = len({issue.row_index for issue in all_issues})
            execution.columns_affected = len(
                {issue.column_name for issue in all_issues}
            )
        else:
            execution.rows_affected = 0
            execution.columns_affected = 0

    def get_active_rules(self) -> List[Rule]:
        """Get all active rules"""
        return self.db.query(Rule).filter(Rule.is_active == True).all()

    def get_rule_by_id(self, rule_id: str) -> Optional[Rule]:
        """Get rule by ID"""
        return self.db.query(Rule).filter(Rule.id == rule_id).first()

    def create_rule(
        self,
        name: str,
        description: str,
        kind: RuleKind,
        criticality: Criticality,
        target_columns: List[str],
        params: Dict[str, Any],
        current_user: User,
        organization_id: str = None,
    ) -> Rule:
        """Create a new business rule with organization context"""

        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="organization_id is required",
            )

        # Check if an active rule with same name already exists within organization
        # This allows historical versions to keep the same name
        existing_latest_rule = (
            self.db.query(Rule)
            .filter(
                Rule.name == name,
                Rule.organization_id == organization_id,
                Rule.is_latest == True,
            )
            .first()
        )

        if existing_latest_rule:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An active rule with name '{name}' already exists in this organization",
            )

        rule = Rule(
            organization_id=organization_id,
            name=name,
            description=description,
            kind=kind,
            criticality=criticality,
            target_columns=json.dumps(target_columns),
            params=json.dumps(params),
            created_by=current_user.id,
            is_active=True,
            version=1,
            is_latest=True,
        )

        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)

        # Set rule_family_id to self for new rules (version 1)
        rule.rule_family_id = rule.id
        self.db.commit()
        self.db.refresh(rule)

        return rule

    def execute_rules_on_dataset(
        self,
        dataset_version: DatasetVersion,
        rule_ids: Optional[List[str]],
        current_user: User,
    ) -> Execution:
        """Execute rules on a dataset version"""

        # Get rules to execute
        if rule_ids:
            rules = (
                self.db.query(Rule)
                .filter(Rule.id.in_(rule_ids), Rule.is_active == True)
                .all()
            )
        else:
            rules = self.get_active_rules()

        if not rules:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active rules found to execute",
            )

        # Create execution record
        execution = Execution(
            dataset_version_id=dataset_version.id,
            started_by=current_user.id,
            status=ExecutionStatus.running,
            total_rules=len(rules),
        )

        self.db.add(execution)
        self.db.commit()
        self.db.refresh(execution)

        try:
            # Load dataset data
            MemoryMonitor.log_memory_usage("before loading dataset")
            df = self._load_dataset_as_dataframe(dataset_version)
            MemoryMonitor.log_memory_usage("after loading dataset")

            execution.total_rows = len(df)
            all_issues = []
            successful_rules = 0
            failed_rules = 0

            logger.info(
                f"Executing {len(rules)} rules on dataset with {len(df)} rows, {len(df.columns)} columns"
            )

            # Execute each rule
            for rule in rules:
                rule_snapshot = create_rule_snapshot(rule)
                execution_rule = ExecutionRule(
                    execution_id=execution.id,
                    rule_id=rule.id,
                    rule_snapshot=rule_snapshot,
                )
                self.db.add(execution_rule)

                try:
                    # Validate rule kind
                    is_valid, rule_kind = self._validate_rule_kind(rule, execution_rule)
                    if not is_valid:
                        failed_rules += 1
                        continue

                    # Get validator for this rule type
                    validator_class = self._get_validator_for_rule(
                        rule_kind, execution_rule
                    )
                    if not validator_class:
                        failed_rules += 1
                        continue

                    # Parse rule parameters
                    success, params, error_msg = self._parse_rule_params(rule)
                    if not success:
                        execution_rule.note = error_msg
                        failed_rules += 1
                        continue

                    # Validate target columns
                    is_valid, _, _ = self._validate_target_columns(
                        params, rule, rule_kind, df, execution_rule
                    )
                    if not is_valid:
                        failed_rules += 1
                        continue

                    # Run validation
                    validator = validator_class(rule, df, self.db)
                    issues = validator.validate()

                    # Validate issues structure
                    if not isinstance(issues, list):
                        execution_rule.note = (
                            f"Validator returned invalid issues format: {type(issues)}"
                        )
                        failed_rules += 1
                        continue

                    # Create issue records
                    lightweight_snapshot = create_lightweight_rule_snapshot(rule)
                    rule_issues = self._create_issues_from_validation(
                        issues, execution, rule, lightweight_snapshot
                    )
                    all_issues.extend(rule_issues)

                    # Update execution rule stats
                    execution_rule.error_count = len(rule_issues)
                    execution_rule.rows_flagged = (
                        len({i.row_index for i in rule_issues}) if rule_issues else 0
                    )
                    execution_rule.cols_flagged = (
                        len({i.column_name for i in rule_issues}) if rule_issues else 0
                    )
                    successful_rules += 1

                except Exception as rule_error:
                    execution_rule.note = f"Error executing rule: {str(rule_error)}"
                    failed_rules += 1
                    print(f"Rule execution error for rule {rule.id}: {str(rule_error)}")

            # Determine final execution status
            if failed_rules == 0:
                execution.status = ExecutionStatus.succeeded
            elif successful_rules > 0:
                execution.status = ExecutionStatus.partially_succeeded
            else:
                execution.status = ExecutionStatus.failed

            execution.finished_at = datetime.now(timezone.utc)

            # Update execution statistics
            self._update_execution_stats(execution, all_issues)

            execution.summary = json.dumps(
                {
                    "total_issues": len(all_issues),
                    "successful_rules": successful_rules,
                    "failed_rules": failed_rules,
                    "issues_by_severity": self._count_issues_by_severity(all_issues),
                    "issues_by_category": self._count_issues_by_category(all_issues),
                }
            )

            self.db.commit()

        except HTTPException as http_err:
            # Re-raise HTTPException without wrapping (maintains original status code)
            execution.status = ExecutionStatus.failed
            execution.finished_at = datetime.now(timezone.utc)
            execution.summary = json.dumps({"error": str(http_err.detail)})
            self.db.commit()
            raise
        except Exception as e:
            # Handle unexpected errors
            execution.status = ExecutionStatus.failed
            execution.finished_at = datetime.now(timezone.utc)
            execution.summary = json.dumps({"error": "Unexpected error during rule execution"})
            self.db.commit()
            logger.error("Unexpected error during rule execution: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Rule execution failed due to an internal error.",
            )

        return execution

    def _load_dataset_as_dataframe(self, dataset_version) -> pd.DataFrame:
        """Load dataset version as pandas DataFrame"""
        try:
            from app.services.data_import import DataImportService

            # Use the data import service to load the dataset file
            data_service = DataImportService(self.db)
            df = data_service.load_dataset_file(
                dataset_version.dataset_id, dataset_version.version_no
            )

            # Validate that we got a valid DataFrame
            if df is None or df.empty:
                raise ValueError(
                    f"Dataset version {dataset_version.id} contains no data"
                )

            return df
        except ImportError as e:
            logger.error("Failed to import data service: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal service error. Please contact the system administrator.",
            )
        except HTTPException:
            # Re-raise HTTPExceptions from load_dataset_file (includes better error messages)
            raise
        except FileNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset file not found. The dataset may need to be re-uploaded.",
            )
        except Exception as e:
            logger.error("Failed to load dataset: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to load dataset. Please try again or contact support.",
            )

    def _count_issues_by_severity(self, issues: List[Issue]) -> Dict[str, int]:
        """Count issues by severity level"""
        counts = {}
        for issue in issues:
            severity = (
                issue.severity.value
                if hasattr(issue.severity, "value")
                else str(issue.severity)
            )
            counts[severity] = counts.get(severity, 0) + 1
        return counts

    def _count_issues_by_category(self, issues: List[Issue]) -> Dict[str, int]:
        """Count issues by category"""
        counts = {}
        for issue in issues:
            category = issue.category or "unknown"
            counts[category] = counts.get(category, 0) + 1
        return counts
