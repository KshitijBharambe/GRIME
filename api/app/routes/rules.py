from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from uuid import uuid4
import logging

from app.database import get_session
from app.models import User, Rule, RuleKind, Execution, Issue
from app.auth import (
    get_any_authenticated_user,
    get_admin_user,
    get_any_org_member_context,
    get_owner_or_admin_context,
    OrgContext,
)
from app.middleware.organization import OrganizationFilter
from app.schemas import (
    RuleResponse,
    RuleCreate,
    RuleUpdate,
    ExecutionResponse,
    IssueResponse,
    RuleTestRequest,
)
from app.services.rule_engine import RuleEngineService
from app.services.rule_versioning import (
    create_rule_version,
    get_rule_root_id,
    promote_previous_version_to_latest,
)

router = APIRouter(prefix="/rules", tags=["Business Rules"])

logger = logging.getLogger(__name__)


@router.get("", response_model=List[RuleResponse])
async def list_rules(
    active_only: bool = Query(True, description="Filter to active rules only"),
    latest_only: bool = Query(True, description="Show only latest versions of rules"),
    rule_kind: Optional[RuleKind] = Query(None, description="Filter by rule kind"),
    include_shared: bool = Query(
        False, description="Include rules shared with this organization"
    ),
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    List all business rules within organization with optional filtering.
    By default, shows only latest versions of active rules.
    """
    query = db.query(Rule)

    # Filter by organization
    query = OrganizationFilter.filter_by_org(
        query, Rule, org_context, include_shared=include_shared
    )

    # Filter to latest versions only (default behavior)
    if latest_only:
        query = query.filter(Rule.is_latest == True)

    if active_only:
        query = query.filter(Rule.is_active == True)

    if rule_kind:
        query = query.filter(Rule.kind == rule_kind)

    rules = query.order_by(Rule.created_at.desc()).all()
    return [RuleResponse.model_validate(rule) for rule in rules]


@router.get("/{rule_id}", response_model=RuleResponse)
async def get_rule(
    rule_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Get details of a specific rule within organization.
    """
    query = db.query(Rule).filter(Rule.id == rule_id)
    query = OrganizationFilter.filter_by_org(
        query, Rule, org_context, include_shared=True
    )
    rule = query.first()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    return RuleResponse.model_validate(rule)


@router.post("", response_model=RuleResponse)
async def create_rule(
    rule_data: RuleCreate,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),  # Owner/Admin only
):
    """
    Create a new business rule within organization (owner/admin only).
    """
    rule_service = RuleEngineService(db)

    try:
        rule = rule_service.create_rule(
            name=rule_data.name,
            description=rule_data.description,
            kind=rule_data.kind,
            criticality=rule_data.criticality,
            target_columns=rule_data.target_columns,
            params=rule_data.params,
            current_user=org_context.user,
            organization_id=org_context.organization_id,
        )

        return RuleResponse.model_validate(rule)

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Error creating rule [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.put("/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: str,
    rule_data: RuleUpdate,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    """
    Update an existing rule by creating a new version within organization.
    This preserves the complete history of rule changes.
    """
    query = db.query(Rule).filter(Rule.id == rule_id)
    query = OrganizationFilter.filter_by_org(query, Rule, org_context)
    rule = query.first()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    # Always create a new version to preserve history
    new_version = await create_rule_version(rule, rule_data, org_context.user, db)
    return RuleResponse.model_validate(new_version)


@router.patch("/{rule_id}/activate")
async def activate_rule(
    rule_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    """
    Activate a rule by creating a new version with is_active=True.
    This preserves the history of activation/deactivation changes.
    """
    query = db.query(Rule).filter(Rule.id == rule_id)
    query = OrganizationFilter.filter_by_org(query, Rule, org_context)
    rule = query.first()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    # If already active, no need to create new version
    if rule.is_active:
        return {"message": "Rule is already active", "rule_id": rule_id}

    # Create new version with is_active=True
    rule_update = RuleUpdate(is_active=True)
    new_version = await create_rule_version(rule, rule_update, org_context.user, db)

    return {
        "message": "Rule activated successfully",
        "rule_id": new_version.id,
        "version": new_version.version,
    }


@router.patch("/{rule_id}/deactivate")
async def deactivate_rule(
    rule_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_owner_or_admin_context),
):
    """
    Deactivate a rule by creating a new version with is_active=False.
    This preserves the history of activation/deactivation changes.
    """
    query = db.query(Rule).filter(Rule.id == rule_id)
    query = OrganizationFilter.filter_by_org(query, Rule, org_context)
    rule = query.first()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    # If already inactive, no need to create new version
    if not rule.is_active:
        return {"message": "Rule is already inactive", "rule_id": rule_id}

    # Create new version with is_active=False
    rule_update = RuleUpdate(is_active=False)
    new_version = await create_rule_version(rule, rule_update, org_context.user, db)

    return {
        "message": "Rule deactivated successfully",
        "rule_id": new_version.id,
        "version": new_version.version,
    }


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_admin_user),
):
    """
    Delete a rule.
    Since executions store rule snapshots, rules can be safely deleted.
    If deleting the latest version, the previous version is promoted to latest.
    """
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    # Check if this is the latest version
    is_latest = rule.is_latest

    # If deleting the latest version, promote the previous version
    if is_latest:
        promoted = promote_previous_version_to_latest(rule_id, db)
        if promoted:
            message = "Rule deleted successfully. Previous version promoted to latest."
        else:
            message = "Rule deleted successfully. No previous versions exist."
    else:
        message = "Rule version deleted successfully."

    # Hard delete the rule (executions have snapshots, so they're safe)
    db.delete(rule)
    db.commit()

    return {
        "message": message,
        "rule_id": rule_id,
        "deleted": True,
        "was_latest": is_latest,
    }


@router.post("/{rule_id}/test", response_model=Dict[str, Any])
async def test_rule(
    rule_id: str,
    test_data: RuleTestRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """
    Test a rule against sample data
    """
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    try:
        import pandas as pd
        from app.services.rule_engine import RuleEngineService

        # Convert test data to DataFrame
        df = pd.DataFrame(test_data.sample_data)

        # Get appropriate validator
        rule_service = RuleEngineService(db)
        validator_class = rule_service.validators.get(rule.kind)

        if not validator_class:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No validator available for rule kind: {rule.kind}",
            )

        # Run validation
        validator = validator_class(rule, df, db)
        issues = validator.validate()

        return {
            "rule_name": rule.name,
            "total_rows_tested": len(df),
            "issues_found": len(issues),
            "sample_issues": issues[:10],  # Return first 10 issues
            "summary": {
                "rows_with_issues": len({issue["row_index"] for issue in issues}),
                "columns_with_issues": len({issue["column_name"] for issue in issues}),
                "categories": list({issue["category"] for issue in issues}),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Error testing rule [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/kinds/available", response_model=List[Dict[str, str]])
async def get_available_rule_kinds():
    """
    Get list of available rule kinds with descriptions
    """
    return [
        {
            "kind": "missing_data",
            "description": "Detect missing or null values in required fields",
            "example_params": {"columns": ["column1", "column2"], "default_value": ""},
        },
        {
            "kind": "standardization",
            "description": "Standardize data formats (dates, phones, emails)",
            "example_params": {
                "columns": ["date_column"],
                "type": "date",
                "format": "%Y-%m-%d",
            },
        },
        {
            "kind": "value_list",
            "description": "Validate values against allowed list",
            "example_params": {
                "columns": ["status"],
                "allowed_values": ["active", "inactive"],
                "case_sensitive": True,
            },
        },
        {
            "kind": "length_range",
            "description": "Validate field length constraints",
            "example_params": {
                "columns": ["description"],
                "min_length": 5,
                "max_length": 100,
            },
        },
        {
            "kind": "char_restriction",
            "description": "Restrict to specific character types",
            "example_params": {"columns": ["name"], "type": "alphabetic"},
        },
        {
            "kind": "cross_field",
            "description": "Validate relationships between multiple fields",
            "example_params": {
                "rules": [
                    {
                        "type": "dependency",
                        "dependent_field": "state",
                        "required_field": "country",
                    }
                ]
            },
        },
        {
            "kind": "regex",
            "description": "Validate using regular expression patterns",
            "example_params": {
                "columns": ["email"],
                "patterns": [
                    {
                        "pattern": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
                        "name": "email_format",
                        "must_match": True,
                    }
                ],
            },
        },
        {
            "kind": "custom",
            "description": "Custom validation using expressions or lookup tables",
            "example_params": {
                "type": "python_expression",
                "expression": "age >= 18",
                "columns": ["age"],
                "error_message": "Age must be 18 or older",
            },
        },
    ]


@router.get("/{rule_id}/executions", response_model=List[ExecutionResponse])
async def get_rule_executions(
    rule_id: str,
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """
    Get execution history for a specific rule
    """
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    executions = (
        db.query(Execution)
        .join(Execution.execution_rules)
        .filter_by(rule_id=rule_id)
        .order_by(Execution.started_at.desc())
        .limit(limit)
        .all()
    )

    return [ExecutionResponse.model_validate(execution) for execution in executions]


@router.get("/{rule_id}/versions", response_model=List[RuleResponse])
async def get_rule_versions(
    rule_id: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """
    Get all versions of a rule
    """
    # Get the rule (could be any version)
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    # Find the root rule (original)
    root_rule_id = get_rule_root_id(rule)

    # Get all versions
    versions = (
        db.query(Rule)
        .filter((Rule.id == root_rule_id) | (Rule.parent_rule_id == root_rule_id))
        .order_by(Rule.version.desc())
        .all()
    )

    return [RuleResponse.model_validate(v) for v in versions]


@router.get("/{rule_id}/version/{version_number}", response_model=RuleResponse)
async def get_rule_version(
    rule_id: str,
    version_number: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """
    Get a specific version of a rule
    """
    # Find root rule
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    root_rule_id = get_rule_root_id(rule)

    # Find the specific version
    version = (
        db.query(Rule)
        .filter(
            ((Rule.id == root_rule_id) | (Rule.parent_rule_id == root_rule_id)),
            Rule.version == version_number,
        )
        .first()
    )

    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_number} not found",
        )

    return RuleResponse.model_validate(version)


@router.get("/{rule_id}/issues", response_model=List[IssueResponse])
async def get_rule_issues(
    rule_id: str,
    resolved: Optional[bool] = Query(None, description="Filter by resolution status"),
    limit: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """
    Get issues found by a specific rule
    """
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    query = db.query(Issue).filter(Issue.rule_id == rule_id)

    if resolved is not None:
        query = query.filter(Issue.resolved == resolved)

    issues = query.order_by(Issue.created_at.desc()).limit(limit).all()

    return [IssueResponse.model_validate(issue) for issue in issues]
