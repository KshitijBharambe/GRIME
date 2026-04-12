"""
Parameter validation schemas for rule types using Pydantic for comprehensive validation.
"""

from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field, validator
import re
from app.models import RuleKind
from app.core.config import MAX_RULE_COLUMNS, MAX_ALLOWED_VALUES


class BaseParameterSchema(BaseModel):
    """Base schema for all rule parameters."""

    columns: List[str] = Field(..., description="Target columns for validation")

    @validator("columns")
    def validate_columns(cls, v):
        if not v:
            raise ValueError("At least one column must be specified")
        if len(v) > MAX_RULE_COLUMNS:
            raise ValueError(f"Too many columns specified (max {MAX_RULE_COLUMNS})")
        return v


class MissingDataParameters(BaseParameterSchema):
    """Parameters for missing data validation."""

    default_value: Optional[str] = Field(
        "", description="Default value for missing data"
    )


class StandardizationParameters(BaseParameterSchema):
    """Parameters for data standardization."""

    type: str = Field(..., description="Type of standardization: date, phone, email")
    format: Optional[str] = Field(None, description="Expected format")

    @validator("type")
    def validate_type(cls, v):
        allowed_types = ["date", "phone", "email"]
        if v not in allowed_types:
            raise ValueError(f"Type must be one of: {', '.join(allowed_types)}")
        return v

    @validator("format")
    def validate_format(cls, v, values):
        if "type" in values:
            if values["type"] == "date" and not v:
                v = "%Y-%m-%d"  # Default date format
            elif values["type"] == "phone" and not v:
                v = "+1-XXX-XXX-XXXX"  # Default phone format
        return v


class ValueListParameters(BaseParameterSchema):
    """Parameters for value list validation."""

    allowed_values: List[str] = Field(..., description="List of allowed values")
    case_sensitive: bool = Field(
        True, description="Whether validation is case sensitive"
    )

    @validator("allowed_values")
    def validate_allowed_values(cls, v):
        if not v:
            raise ValueError("At least one allowed value must be specified")
        if len(v) > MAX_ALLOWED_VALUES:
            raise ValueError(f"Too many allowed values (max {MAX_ALLOWED_VALUES})")
        return v


class LengthRangeParameters(BaseParameterSchema):
    """Parameters for length range validation."""

    min_length: int = Field(0, ge=0, description="Minimum length")
    max_length: Union[int, float] = Field(
        float("inf"), gt=0, description="Maximum length"
    )

    @validator("max_length")
    def validate_max_length(cls, v, values):
        if "min_length" in values and v != float("inf") and v <= values["min_length"]:
            raise ValueError("max_length must be greater than min_length")
        return v


class CharRestrictionParameters(BaseParameterSchema):
    """Parameters for character restriction validation."""

    type: str = Field(
        ..., description="Type of restriction: alphabetic, numeric, alphanumeric"
    )

    @validator("type")
    def validate_type(cls, v):
        allowed_types = ["alphabetic", "numeric", "alphanumeric"]
        if v not in allowed_types:
            raise ValueError(f"Type must be one of: {', '.join(allowed_types)}")
        return v


class CrossFieldRuleDefinition(BaseModel):
    """Definition for a single cross-field rule."""

    type: str = Field(
        ...,
        description="Rule type: dependency, mutual_exclusion, conditional, sum_check",
    )
    dependent_field: Optional[str] = Field(
        None, description="Dependent field for dependency rules"
    )
    required_field: Optional[str] = Field(
        None, description="Required field for dependency rules"
    )
    fields: Optional[List[str]] = Field(
        None, description="Fields for mutual exclusion rules"
    )
    condition_field: Optional[str] = Field(
        None, description="Condition field for conditional rules"
    )
    condition_value: Optional[str] = Field(
        None, description="Condition value for conditional rules"
    )
    target_field: Optional[str] = Field(
        None, description="Target field for conditional rules"
    )
    expected_value: Optional[str] = Field(
        None, description="Expected value for conditional rules"
    )
    sum_fields: Optional[List[str]] = Field(
        None, description="Fields to sum for sum check rules"
    )
    total_field: Optional[str] = Field(
        None, description="Total field for sum check rules"
    )
    expected_total: Optional[Union[int, float]] = Field(
        None, description="Expected total for sum check rules"
    )


class CrossFieldParameters(BaseParameterSchema):
    """Parameters for cross-field validation."""

    rules: List[CrossFieldRuleDefinition] = Field(
        ..., description="List of cross-field rules"
    )

    @validator("rules")
    def validate_rules(cls, v):
        if not v:
            raise ValueError("At least one rule must be specified")
        return v


class RegexPatternDefinition(BaseModel):
    """Definition for a single regex pattern."""

    pattern: str = Field(..., description="Regular expression pattern")
    name: str = Field(..., description="Pattern name for identification")
    must_match: bool = Field(
        True, description="Whether pattern must match (True) or must not match (False)"
    )

    @validator("pattern")
    def validate_pattern(cls, v):
        try:
            re.compile(v)
        except re.error as e:
            raise ValueError(f"Invalid regex pattern: {str(e)}")
        return v


class RegexParameters(BaseParameterSchema):
    """Parameters for regex validation."""

    patterns: List[RegexPatternDefinition] = Field(
        ..., description="List of regex patterns"
    )

    @validator("patterns")
    def validate_patterns(cls, v):
        if not v:
            raise ValueError("At least one pattern must be specified")
        return v


class CustomParameters(BaseParameterSchema):
    """Parameters for custom validation."""

    type: str = Field(
        ...,
        description="Custom validation type: python_expression, lookup_table, custom_function",
    )
    expression: Optional[str] = Field(
        None, description="Python expression for python_expression type"
    )
    error_message: Optional[str] = Field(
        "Custom validation failed", description="Error message for failed validation"
    )
    lookup_table: Optional[Dict[str, str]] = Field(
        None, description="Lookup table for lookup_table type"
    )
    lookup_column: Optional[str] = Field(
        None, description="Lookup column for lookup_table type"
    )
    target_column: Optional[str] = Field(
        None, description="Target column for lookup_table type"
    )
    function_name: Optional[str] = Field(
        None, description="Function name for custom_function type"
    )

    @validator("type")
    def validate_type(cls, v):
        allowed_types = ["python_expression", "lookup_table", "custom_function"]
        if v not in allowed_types:
            raise ValueError(f"Type must be one of: {', '.join(allowed_types)}")
        return v


class ParameterValidator:
    """Validates rule parameters against appropriate schemas."""

    def __init__(self):
        self.schemas = {
            RuleKind.missing_data: MissingDataParameters,
            RuleKind.standardization: StandardizationParameters,
            RuleKind.value_list: ValueListParameters,
            RuleKind.length_range: LengthRangeParameters,
            RuleKind.char_restriction: CharRestrictionParameters,
            RuleKind.cross_field: CrossFieldParameters,
            RuleKind.regex: RegexParameters,
            RuleKind.custom: CustomParameters,
        }

    def validate_parameters(
        self, rule_kind: RuleKind, parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate parameters for a specific rule kind.

        Args:
            rule_kind: The type of rule
            parameters: Raw parameters to validate

        Returns:
            Validated and normalized parameters

        Raises:
            ValueError: If parameters are invalid
        """
        schema_class = self.schemas.get(rule_kind)
        if not schema_class:
            # Return parameters as-is if no schema is defined
            return parameters

        try:
            # Validate against schema
            validated = schema_class(**parameters)
            # Return as dict
            return validated.dict()
        except Exception as e:
            raise ValueError(f"Parameter validation failed for {rule_kind}: {str(e)}")

    def get_schema_info(self, rule_kind: RuleKind) -> Dict[str, Any]:
        """Get schema information for a rule kind."""
        schema_class = self.schemas.get(rule_kind)
        if not schema_class:
            return {}

        return {
            "schema_name": schema_class.__name__,
            "fields": schema_class.schema().get("properties", {}),
            "required_fields": schema_class.schema().get("required", []),
        }


def get_parameter_schema(rule_kind: RuleKind) -> Dict[str, Any]:
    """Get parameter schema for a rule kind."""
    validator = ParameterValidator()
    return validator.get_schema_info(rule_kind)
