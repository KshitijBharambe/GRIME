from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, String
from typing import List, Dict, Any
from app.database import get_session
from app.models import Dataset, Rule, Execution, Issue, DatasetVersion
from app.auth import get_any_org_member_context, OrgContext
from pydantic import BaseModel

router = APIRouter(prefix="/search", tags=["search"])


class SearchResult(BaseModel):
    type: str
    id: str
    title: str
    description: str
    metadata: Dict[str, Any]

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    query: str
    total_results: int
    pages: List[SearchResult]  # Static page/action suggestions
    datasets: List[SearchResult]
    rules: List[SearchResult]
    executions: List[SearchResult]
    issues: List[SearchResult]


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(
        10, ge=1, le=50, description="Maximum results per category"),
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context)
):
    """
    Global search across datasets, rules, executions, and issues within organization.
    Includes static suggestions for common actions/pages.
    """
    # Support partial word matching
    search_term = f"%{q}%"
    query_lower = q.lower()

    # Also search for space-separated words for better matching (e.g., "upload data" should match both)
    search_words = [f"%{word}%" for word in q.split() if word]

    # Static suggestions for common actions/pages (shown as datasets)
    static_suggestions = []

    # Common action keywords
    action_keywords = {
        'upload': {'title': 'Upload Data', 'description': 'Upload new datasets and files', 'url': '/data/upload', 'type': 'action'},
        'create rule': {'title': 'Create Rule', 'description': 'Create a new data quality rule', 'url': '/rules/create', 'type': 'action'},
        'view rules': {'title': 'View Rules', 'description': 'Browse all data quality rules', 'url': '/rules', 'type': 'action'},
        'executions': {'title': 'Executions', 'description': 'View rule execution history', 'url': '/executions', 'type': 'action'},
        'issues': {'title': 'Issues', 'description': 'View data quality issues', 'url': '/issues', 'type': 'action'},
        'dashboard': {'title': 'Dashboard', 'description': 'View system dashboard', 'url': '/dashboard', 'type': 'action'},
        'datasets': {'title': 'Datasets', 'description': 'View all uploaded datasets', 'url': '/data/datasets', 'type': 'action'},
        'reports': {'title': 'Reports', 'description': 'View quality reports', 'url': '/reports', 'type': 'action'},
        'users': {'title': 'Users', 'description': 'Manage users (Admin)', 'url': '/admin/users', 'type': 'action'},
        'settings': {'title': 'System Settings', 'description': 'Configure system settings (Admin)', 'url': '/admin/settings', 'type': 'action'},
    }

    # Check for matching action keywords
    for keyword, info in action_keywords.items():
        if keyword in query_lower or any(word in keyword for word in query_lower.split()):
            static_suggestions.append(SearchResult(
                type="page",  # Page/action type
                id=info['url'],  # Use URL as ID for navigation
                title=info['title'],
                description=info['description'],
                metadata={
                    "is_static": True,
                    "url": info['url']
                }
            ))

    # Search datasets - check name, filename, notes, source type, and status
    dataset_conditions = [
        Dataset.name.ilike(search_term),
        Dataset.original_filename.ilike(search_term),
        Dataset.notes.ilike(search_term),
        Dataset.source_type.cast(String).ilike(search_term),
        Dataset.status.cast(String).ilike(search_term)
    ]

    # Add individual word searches for better matching
    for word in search_words[:3]:  # Limit to first 3 words for performance
        dataset_conditions.extend([
            Dataset.name.ilike(word),
            Dataset.original_filename.ilike(word)
        ])

    datasets_query = db.query(Dataset).filter(
        Dataset.organization_id == org_context.organization_id,
        or_(*dataset_conditions)
    ).limit(limit)

    datasets = []
    for dataset in datasets_query.all():
        datasets.append(SearchResult(
            type="dataset",
            id=dataset.id,
            title=dataset.name,
            description=f"{dataset.source_type.value} • {dataset.row_count or 0} rows • {dataset.column_count or 0} columns",
            metadata={
                "source_type": dataset.source_type.value,
                "status": dataset.status.value,
                "uploaded_at": dataset.uploaded_at.isoformat() if dataset.uploaded_at else None,
                "row_count": dataset.row_count,
                "column_count": dataset.column_count
            }
        ))

    # Search rules - check name, description, target table, kind, criticality
    rule_conditions = [
        Rule.name.ilike(search_term),
        Rule.description.ilike(search_term),
        Rule.target_table.ilike(search_term),
        Rule.target_columns.ilike(search_term),
        Rule.kind.cast(String).ilike(search_term),
        Rule.criticality.cast(String).ilike(search_term)
    ]

    # Add individual word searches
    for word in search_words[:3]:
        rule_conditions.extend([
            Rule.name.ilike(word),
            Rule.description.ilike(word)
        ])

    rules_query = db.query(Rule).filter(
        Rule.organization_id == org_context.organization_id,
        or_(*rule_conditions)
    ).limit(limit)

    rules = []
    for rule in rules_query.all():
        rules.append(SearchResult(
            type="rule",
            id=rule.id,
            title=rule.name,
            description=rule.description or f"{rule.kind.value} rule • {rule.criticality.value} criticality",
            metadata={
                "kind": rule.kind.value,
                "criticality": rule.criticality.value,
                "is_active": rule.is_active,
                "target_table": rule.target_table,
                "created_at": rule.created_at.isoformat() if rule.created_at else None
            }
        ))

    # Search executions - filter by organization through dataset relationship
    org_datasets = db.query(Dataset.id).filter(
        Dataset.organization_id == org_context.organization_id
    ).subquery()

    org_dataset_versions = db.query(DatasetVersion.id).filter(
        DatasetVersion.dataset_id.in_(org_datasets)
    ).subquery()

    executions_query = db.query(Execution).join(
        Execution.dataset_version
    ).filter(
        Execution.dataset_version_id.in_(org_dataset_versions),
        Execution.summary.ilike(search_term)
    ).limit(limit)

    executions = []
    for execution in executions_query.all():
        executions.append(SearchResult(
            type="execution",
            id=execution.id,
            title=f"Execution {execution.id[:8]}",
            description=f"{execution.status.value} • {execution.total_rules or 0} rules • {execution.rows_affected or 0} rows affected",
            metadata={
                "status": execution.status.value,
                "started_at": execution.started_at.isoformat() if execution.started_at else None,
                "finished_at": execution.finished_at.isoformat() if execution.finished_at else None,
                "total_rows": execution.total_rows,
                "total_rules": execution.total_rules,
                "rows_affected": execution.rows_affected
            }
        ))

    # Search issues - filter by organization through execution relationship
    org_executions = db.query(Execution.id).filter(
        Execution.dataset_version_id.in_(org_dataset_versions)
    ).subquery()

    issues_query = db.query(Issue).filter(
        Issue.execution_id.in_(org_executions),
        or_(
            Issue.message.ilike(search_term),
            Issue.column_name.ilike(search_term),
            Issue.current_value.ilike(search_term)
        )
    ).limit(limit)

    issues = []
    for issue in issues_query.all():
        issues.append(SearchResult(
            type="issue",
            id=issue.id,
            title=f"{issue.column_name} • Row {issue.row_index}",
            description=issue.message or f"{issue.severity.value} severity",
            metadata={
                "severity": issue.severity.value,
                "column_name": issue.column_name,
                "row_index": issue.row_index,
                "resolved": issue.resolved,
                "created_at": issue.created_at.isoformat() if issue.created_at else None
            }
        ))

    total_results = len(static_suggestions) + len(datasets) + \
        len(rules) + len(executions) + len(issues)

    return SearchResponse(
        query=q,
        total_results=total_results,
        # Page suggestions in their own category
        pages=static_suggestions[:limit],
        datasets=datasets,
        rules=rules,
        executions=executions,
        issues=issues
    )
