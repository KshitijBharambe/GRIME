"""
Rule templates service for managing and applying rule templates.
Provides pre-built validation patterns that can be customized for specific datasets.
"""

import json
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.models import (
    RuleTemplate,
    RuleSuggestion,
    Rule,
    RuleKind,
    Criticality,
    Dataset,
    DatasetColumn,
)
from app.core.config import DEFAULT_MAX_SUGGESTIONS


class RuleTemplateService:
    """Service for managing rule templates and suggestions"""

    def __init__(self, db: Session):
        self.db = db

    def create_template(
        self,
        name: str,
        description: str,
        category: str,
        template_kind: RuleKind,
        template_params: Dict[str, Any],
        created_by: str,
    ) -> RuleTemplate:
        """Create a new rule template"""
        template = RuleTemplate(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            category=category,
            template_kind=template_kind,
            template_params=json.dumps(template_params),
            created_by=created_by,
        )

        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def get_templates(
        self,
        category: Optional[str] = None,
        kind: Optional[RuleKind] = None,
        active_only: bool = True,
    ) -> List[RuleTemplate]:
        """Get rule templates with optional filtering"""
        query = self.db.query(RuleTemplate)

        if category:
            query = query.filter(RuleTemplate.category == category)

        if kind:
            query = query.filter(RuleTemplate.template_kind == kind)

        if active_only:
            query = query.filter(RuleTemplate.is_active == True)

        return query.all()

    def get_template(self, template_id: str) -> Optional[RuleTemplate]:
        """Get a specific template by ID"""
        return (
            self.db.query(RuleTemplate).filter(RuleTemplate.id == template_id).first()
        )

    def update_template_usage(self, template_id: str) -> None:
        """Increment the usage count for a template"""
        template = self.get_template(template_id)
        if template:
            template.usage_count = (template.usage_count or 0) + 1
            template.updated_at = datetime.now(timezone.utc)
            self.db.commit()

    def apply_template(
        self,
        template_id: str,
        dataset_id: str,
        created_by: str,
        customizations: Optional[Dict[str, Any]] = None,
        rule_name: Optional[str] = None,
    ) -> Rule:
        """Apply a template to create a new rule"""
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")

        # Parse template parameters
        template_params = json.loads(template.template_params)

        # Apply customizations
        if customizations:
            template_params.update(customizations)

        # Generate rule name if not provided
        if not rule_name:
            rule_name = f"{template.name} - {dataset_id[:8]}"

        # Create the rule
        rule = Rule(
            id=str(uuid.uuid4()),
            name=rule_name,
            description=f"Generated from template: {template.description}",
            kind=template.template_kind,
            criticality=template_params.get("criticality", Criticality.medium),
            target_columns=json.dumps(template_params.get("target_columns", [])),
            params=json.dumps(template_params),
            created_by=created_by,
        )

        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)

        # Update template usage
        self.update_template_usage(template_id)

        return rule

    def generate_suggestions_for_dataset(
        self, dataset_id: str, max_suggestions: int = DEFAULT_MAX_SUGGESTIONS
    ) -> List[RuleSuggestion]:
        """Generate rule suggestions based on dataset characteristics"""
        dataset = self.db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")

        # Get dataset columns
        columns = (
            self.db.query(DatasetColumn)
            .filter(DatasetColumn.dataset_id == dataset_id)
            .all()
        )

        suggestions = []

        # Generate suggestions based on column types and patterns
        for column in columns:
            column_suggestions = self._generate_column_suggestions(dataset, column)
            suggestions.extend(column_suggestions)

        # Sort by confidence and limit
        suggestions.sort(key=lambda x: x.confidence_score or 0, reverse=True)
        return suggestions[:max_suggestions]

    def _generate_column_suggestions(
        self, dataset: Dataset, column: DatasetColumn
    ) -> List[RuleSuggestion]:
        """Generate suggestions for a specific column"""
        suggestions = []
        column_name = column.name
        column_type = column.inferred_type

        # Suggest missing data validation for nullable columns
        if column.is_nullable:
            template = self._find_template_by_category("missing_data")
            if template:
                suggestions.append(
                    self._create_suggestion(
                        dataset_id=dataset.id,
                        template_id=template.id,
                        rule_name=f"Check missing data in {column_name}",
                        confidence_score=70,
                        suggestion_type="template_based",
                        reasoning=f"Column {column_name} is nullable and may have missing values",
                        customizations={"target_columns": [column_name]},
                    )
                )

        # Suggest length validation for string columns
        if column_type in ["object", "string"]:
            template = self._find_template_by_category("length_range")
            if template:
                suggestions.append(
                    self._create_suggestion(
                        dataset_id=dataset.id,
                        template_id=template.id,
                        rule_name=f"Validate length of {column_name}",
                        confidence_score=60,
                        suggestion_type="template_based",
                        reasoning=f"Column {column_name} is a text field that may need length validation",
                        customizations={"target_columns": [column_name]},
                    )
                )

        # Suggest statistical outlier detection for numeric columns
        if column_type in ["int64", "float64", "number"]:
            template = self._find_template_by_kind(RuleKind.statistical_outlier)
            if template:
                suggestions.append(
                    self._create_suggestion(
                        dataset_id=dataset.id,
                        template_id=template.id,
                        rule_name=f"Detect outliers in {column_name}",
                        confidence_score=80,
                        suggestion_type="template_based",
                        reasoning=f"Column {column_name} is numeric and may contain outliers",
                        customizations={"target_columns": [column_name]},
                    )
                )

        # Suggest format validation based on column name patterns
        format_suggestion = self._suggest_format_validation(dataset, column)
        if format_suggestion:
            suggestions.append(format_suggestion)

        return suggestions

    def _suggest_format_validation(
        self, dataset: Dataset, column: DatasetColumn
    ) -> Optional[RuleSuggestion]:
        """Suggest format validation based on column name patterns"""
        column_name = column.name.lower()

        # Email validation
        if any(
            keyword in column_name for keyword in ["email", "mail", "email_address"]
        ):
            template = self._find_template_by_category("regex")
            if template:
                return self._create_suggestion(
                    dataset_id=dataset.id,
                    template_id=template.id,
                    rule_name=f"Validate email format in {column.name}",
                    confidence_score=90,
                    suggestion_type="template_based",
                    reasoning=f"Column {column.name} appears to contain email addresses",
                    customizations={
                        "target_columns": [column.name],
                        "pattern": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
                    },
                )

        # Phone validation
        if any(keyword in column_name for keyword in ["phone", "tel", "telephone"]):
            template = self._find_template_by_category("regex")
            if template:
                return self._create_suggestion(
                    dataset_id=dataset.id,
                    template_id=template.id,
                    rule_name=f"Validate phone format in {column.name}",
                    confidence_score=85,
                    suggestion_type="template_based",
                    reasoning=f"Column {column.name} appears to contain phone numbers",
                    customizations={
                        "target_columns": [column.name],
                        "pattern": r"^\+?[\d\s\-\(\)]{10,}$",
                    },
                )

        # Date validation
        if any(
            keyword in column_name for keyword in ["date", "time", "created", "updated"]
        ):
            template = self._find_template_by_category("standardization")
            if template:
                return self._create_suggestion(
                    dataset_id=dataset.id,
                    template_id=template.id,
                    rule_name=f"Standardize date format in {column.name}",
                    confidence_score=75,
                    suggestion_type="template_based",
                    reasoning=f"Column {column.name} appears to contain date values",
                    customizations={
                        "target_columns": [column.name],
                        "standardization_type": "date",
                    },
                )

        return None

    def _find_template_by_category(self, category: str) -> Optional[RuleTemplate]:
        """Find a template by category"""
        return (
            self.db.query(RuleTemplate)
            .filter(RuleTemplate.category == category, RuleTemplate.is_active == True)
            .first()
        )

    def _find_template_by_kind(self, kind: RuleKind) -> Optional[RuleTemplate]:
        """Find a template by rule kind"""
        return (
            self.db.query(RuleTemplate)
            .filter(RuleTemplate.template_kind == kind, RuleTemplate.is_active == True)
            .first()
        )

    def _create_suggestion(
        self,
        dataset_id: str,
        template_id: Optional[str],
        rule_name: str,
        confidence_score: int,
        suggestion_type: str,
        reasoning: str,
        customizations: Optional[Dict[str, Any]] = None,
    ) -> RuleSuggestion:
        """Create a rule suggestion"""
        suggestion = RuleSuggestion(
            id=str(uuid.uuid4()),
            dataset_id=dataset_id,
            template_id=template_id,
            suggested_rule_name=rule_name,
            suggested_params=json.dumps(customizations or {}),
            confidence_score=confidence_score,
            suggestion_type=suggestion_type,
            reasoning=reasoning,
        )

        self.db.add(suggestion)
        self.db.commit()
        self.db.refresh(suggestion)
        return suggestion

    def get_suggestions_for_dataset(
        self, dataset_id: str, applied_only: bool = False
    ) -> List[RuleSuggestion]:
        """Get suggestions for a dataset"""
        query = self.db.query(RuleSuggestion).filter(
            RuleSuggestion.dataset_id == dataset_id
        )

        if applied_only:
            query = query.filter(RuleSuggestion.is_applied == True)

        return query.order_by(RuleSuggestion.confidence_score.desc()).all()

    def mark_suggestion_applied(self, suggestion_id: str, applied_by: str) -> None:
        """Mark a suggestion as applied"""
        suggestion = (
            self.db.query(RuleSuggestion)
            .filter(RuleSuggestion.id == suggestion_id)
            .first()
        )

        if suggestion:
            suggestion.is_applied = True
            suggestion.applied_at = datetime.now(timezone.utc)
            suggestion.applied_by = applied_by
            self.db.commit()

    def initialize_default_templates(self, user_id: str) -> None:
        """Initialize default rule templates"""
        default_templates = [
            {
                "name": "Missing Data Check",
                "description": "Check for missing or null values in specified columns",
                "category": "missing_data",
                "kind": RuleKind.missing_data,
                "params": {"target_columns": [], "criticality": "medium"},
            },
            {
                "name": "Email Format Validation",
                "description": "Validate email address format using regex pattern",
                "category": "regex",
                "kind": RuleKind.regex,
                "params": {
                    "target_columns": [],
                    "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                    "criticality": "medium",
                },
            },
            {
                "name": "Phone Number Validation",
                "description": "Validate phone number format",
                "category": "regex",
                "kind": RuleKind.regex,
                "params": {
                    "target_columns": [],
                    "pattern": "^\\+?[\\d\\s\\-\\(\\)]{10,}$",
                    "criticality": "low",
                },
            },
            {
                "name": "Text Length Range",
                "description": "Validate text length within specified range",
                "category": "length_range",
                "kind": RuleKind.length_range,
                "params": {
                    "target_columns": [],
                    "min_length": 1,
                    "max_length": 255,
                    "criticality": "medium",
                },
            },
            {
                "name": "Statistical Outlier Detection (IQR)",
                "description": "Detect outliers using Interquartile Range method",
                "category": "statistical",
                "kind": RuleKind.statistical_outlier,
                "params": {
                    "target_columns": [],
                    "method": "iqr",
                    "iqr_multiplier": 1.5,
                    "criticality": "high",
                },
            },
            {
                "name": "Statistical Outlier Detection (Z-Score)",
                "description": "Detect outliers using Z-score method",
                "category": "statistical",
                "kind": RuleKind.statistical_outlier,
                "params": {
                    "target_columns": [],
                    "method": "zscore",
                    "threshold": 3.0,
                    "criticality": "high",
                },
            },
            {
                "name": "Normality Check",
                "description": "Check if data follows normal distribution",
                "category": "statistical",
                "kind": RuleKind.distribution_check,
                "params": {
                    "target_columns": [],
                    "test_type": "normality",
                    "alpha": 0.05,
                    "criticality": "low",
                },
            },
            {
                "name": "High Correlation Check",
                "description": "Check for high correlations between numeric columns",
                "category": "statistical",
                "kind": RuleKind.correlation_validation,
                "params": {
                    "target_columns": [],
                    "method": "pearson",
                    "threshold": 0.8,
                    "criticality": "medium",
                },
            },
        ]

        for template_data in default_templates:
            existing = (
                self.db.query(RuleTemplate)
                .filter(RuleTemplate.name == template_data["name"])
                .first()
            )

            if not existing:
                self.create_template(
                    name=template_data["name"],
                    description=template_data["description"],
                    category=template_data["category"],
                    template_kind=template_data["kind"],
                    template_params=template_data["params"],
                    created_by=user_id,
                )
