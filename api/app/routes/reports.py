from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, case
from typing import Optional
from pathlib import Path
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from app.database import get_session
from app.models import (
    User,
    Dataset,
    DatasetVersion,
    Export,
    ExportFormat,
    Issue,
    Fix,
    Execution,
    ExecutionStatus,
    Rule,
    DataQualityMetrics,
)
from app.auth import (
    get_any_authenticated_user,
    get_any_org_member_context,
    OrgContext,
)
from app.services.export import ExportService
from app.services.data_quality import DataQualityService
from app.core.config import ErrorMessages
from app.utils.logging_service import get_logger
from uuid import uuid4

logger = get_logger(__name__)

router = APIRouter(prefix="/reports", tags=["Reports & Export"])


@router.post("/datasets/{dataset_id}/export")
async def export_dataset(
    dataset_id: str,
    export_format: ExportFormat = Query(..., description="Export format"),
    include_metadata: bool = Query(True, description="Include dataset metadata"),
    include_issues: bool = Query(False, description="Include identified issues"),
    execution_id: Optional[str] = Query(None, description="Specific execution context"),
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Export a dataset in the specified format within organization

    Args:
        dataset_id: Dataset to export
        export_format: Format for export (csv, excel, json)
        include_metadata: Whether to include dataset metadata
        include_issues: Whether to include data quality issues
        execution_id: Optional execution ID for context

    Returns:
        Export information with download details
    """
    # Check if dataset exists and belongs to organization
    dataset = (
        db.query(Dataset)
        .filter(
            Dataset.id == dataset_id,
            Dataset.organization_id == org_context.organization_id,
        )
        .first()
    )

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.DATASET_NOT_FOUND,
        )

    # Get latest version
    latest_version = (
        db.query(DatasetVersion)
        .filter(DatasetVersion.dataset_id == dataset_id)
        .order_by(DatasetVersion.version_no.desc())
        .first()
    )

    if not latest_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No dataset version found"
        )

    try:
        export_service = ExportService(db)
        export_id, file_path = export_service.export_dataset(
            dataset_version_id=latest_version.id,
            export_format=export_format,
            user_id=org_context.user_id,
            execution_id=execution_id,
            include_metadata=include_metadata,
            include_issues=include_issues,
        )

        # Determine actual file extension based on file path
        actual_extension = file_path.split(".")[-1]  # Gets 'csv', 'zip', 'xlsx', etc.

        return {
            "export_id": export_id,
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "version_number": latest_version.version_no,
            "export_format": export_format.value,
            "actual_file_extension": actual_extension,  # NEW: tells frontend the real extension
            "file_path": file_path,
            "include_metadata": include_metadata,
            "include_issues": include_issues,
            "download_url": f"/reports/exports/{export_id}/download",
        }

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Export failed [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/datasets/{dataset_id}/export-history")
async def get_export_history(
    dataset_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Get export history for a dataset within organization
    """
    # Check if dataset exists and belongs to organization
    dataset = (
        db.query(Dataset)
        .filter(
            Dataset.id == dataset_id,
            Dataset.organization_id == org_context.organization_id,
        )
        .first()
    )

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.DATASET_NOT_FOUND,
        )

    try:
        export_service = ExportService(db)
        history = export_service.get_export_history(dataset_id)

        return {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "total_exports": len(history),
            "exports": history,
        }

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to get export history [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/exports/{export_id}/download")
async def download_export(
    export_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Download an exported file
    """
    try:
        export_service = ExportService(db)
        file_path, download_filename = export_service.get_export_file(export_id)

        # Verify export belongs to user's org
        export = db.query(Export).filter(Export.id == export_id).first()
        if not export:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Export not found"
            )

        dataset_version = (
            db.query(DatasetVersion)
            .filter(DatasetVersion.id == export.dataset_version_id)
            .first()
        )
        if not dataset_version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Version not found"
            )

        dataset = (
            db.query(Dataset)
            .filter(
                Dataset.id == dataset_version.dataset_id,
                Dataset.organization_id == org_context.organization_id,
            )
            .first()
        )
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        # Check if file exists
        if not Path(file_path).exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Export file not found"
            )

        # Determine media type
        if file_path.endswith(".csv"):
            media_type = "text/csv"
        elif file_path.endswith(".xlsx"):
            media_type = (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        elif file_path.endswith(".json"):
            media_type = "application/json"
        elif file_path.endswith(".zip"):
            media_type = "application/zip"
        else:
            media_type = "application/octet-stream"

        return FileResponse(
            path=file_path, filename=download_filename, media_type=media_type
        )

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Download failed [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.delete("/exports/{export_id}")
async def delete_export(
    export_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Delete an export and its associated file within organization
    """
    try:
        export_service = ExportService(db)
        success = export_service.delete_export(export_id, org_context.user_id)

        return {
            "export_id": export_id,
            "deleted": success,
            "message": "Export deleted successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to delete export [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.post("/datasets/{dataset_id}/quality-report")
async def generate_quality_report(
    dataset_id: str,
    include_charts: bool = Query(
        False, description="Include visual charts (future feature)"
    ),
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Generate comprehensive data quality report for a dataset within organization
    """
    # Check if dataset exists and belongs to organization
    dataset = (
        db.query(Dataset)
        .filter(
            Dataset.id == dataset_id,
            Dataset.organization_id == org_context.organization_id,
        )
        .first()
    )

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.DATASET_NOT_FOUND,
        )

    try:
        export_service = ExportService(db)
        export_id, file_path = export_service.export_data_quality_report(
            dataset_id=dataset_id,
            user_id=org_context.user_id,
            include_charts=include_charts,
        )

        return {
            "export_id": export_id,
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "report_type": "data_quality_report",
            "file_path": file_path,
            "download_url": f"/reports/exports/{export_id}/download",
            "include_charts": include_charts,
        }

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Quality report generation failed [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/datasets/{dataset_id}/quality-summary")
async def get_quality_summary(
    dataset_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Get real-time data quality summary for a dataset within organization
    """
    # Verify dataset belongs to organization
    dataset = (
        db.query(Dataset)
        .filter(
            Dataset.id == dataset_id,
            Dataset.organization_id == org_context.organization_id,
        )
        .first()
    )

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorMessages.DATASET_NOT_FOUND,
        )

    try:
        data_quality_service = DataQualityService(db)
        summary = data_quality_service.create_data_quality_summary(dataset_id)
        return summary

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to generate quality summary [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/dashboard/overview")
async def get_dashboard_overview(
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Get overview statistics for the dashboard within organization
    """
    try:
        # Basic counts - filtered by organization
        total_datasets = (
            db.query(Dataset)
            .filter(Dataset.organization_id == org_context.organization_id)
            .count()
        )

        # For executions and issues, filter through dataset relationship
        org_datasets = (
            db.query(Dataset.id)
            .filter(Dataset.organization_id == org_context.organization_id)
            .subquery()
        )

        org_dataset_versions = (
            db.query(DatasetVersion.id)
            .filter(DatasetVersion.dataset_id.in_(org_datasets))
            .subquery()
        )

        total_executions = (
            db.query(Execution)
            .filter(Execution.dataset_version_id.in_(org_dataset_versions))
            .count()
        )

        org_executions = (
            db.query(Execution.id)
            .filter(Execution.dataset_version_id.in_(org_dataset_versions))
            .subquery()
        )

        total_issues = (
            db.query(Issue).filter(Issue.execution_id.in_(org_executions)).count()
        )

        total_fixes = (
            db.query(Fix)
            .join(Issue)
            .filter(Issue.execution_id.in_(org_executions))
            .count()
        )

        # Recent activity - filtered by organization
        recent_datasets = (
            db.query(Dataset)
            .filter(Dataset.organization_id == org_context.organization_id)
            .order_by(Dataset.uploaded_at.desc())
            .limit(5)
            .all()
        )

        recent_executions = (
            db.query(Execution)
            .filter(Execution.dataset_version_id.in_(org_dataset_versions))
            .order_by(Execution.started_at.desc())
            .limit(5)
            .all()
        )

        # Batch: issue counts for recent executions (avoid N+1 lazy loads)
        recent_exec_ids = [e.id for e in recent_executions]
        recent_issue_counts = {}
        if recent_exec_ids:
            recent_issue_counts = dict(
                db.query(Issue.execution_id, sa_func.count(Issue.id))
                .filter(Issue.execution_id.in_(recent_exec_ids))
                .group_by(Issue.execution_id)
                .all()
            )

        # Quality statistics (optimized - batch queries instead of per-dataset)
        # Using new DQI/CleanRowsPct/Hybrid metrics system
        datasets = (
            db.query(Dataset)
            .filter(Dataset.organization_id == org_context.organization_id)
            .all()
        )
        dataset_ids = [d.id for d in datasets]

        # Batch: latest version per dataset via SQL subquery (1 query, no Python dedup)
        # Subquery: for each dataset_id, select the maximum version_no.
        latest_version_no_sq = (
            db.query(
                DatasetVersion.dataset_id,
                sa_func.max(DatasetVersion.version_no).label("max_version_no"),
            )
            .filter(DatasetVersion.dataset_id.in_(dataset_ids))
            .group_by(DatasetVersion.dataset_id)
            .subquery()
        )
        latest_versions = (
            (
                db.query(DatasetVersion)
                .join(
                    latest_version_no_sq,
                    (DatasetVersion.dataset_id == latest_version_no_sq.c.dataset_id)
                    & (
                        DatasetVersion.version_no
                        == latest_version_no_sq.c.max_version_no
                    ),
                )
                .all()
            )
            if dataset_ids
            else []
        )
        version_by_dataset = {v.dataset_id: v for v in latest_versions}

        # Batch: all executions for latest versions (1 query instead of N)
        version_ids = [v.id for v in version_by_dataset.values()]
        all_dv_executions = (
            (
                db.query(Execution)
                .filter(Execution.dataset_version_id.in_(version_ids))
                .order_by(Execution.started_at.desc())
                .all()
            )
            if version_ids
            else []
        )
        executions_by_version = defaultdict(list)
        for e in all_dv_executions:
            executions_by_version[e.dataset_version_id].append(e)

        # Batch: quality metrics for all executions (1 query instead of N)
        all_dv_exec_ids = [e.id for e in all_dv_executions]
        metrics_by_execution = {}
        if all_dv_exec_ids:
            all_metrics = (
                db.query(DataQualityMetrics)
                .filter(DataQualityMetrics.execution_id.in_(all_dv_exec_ids))
                .all()
            )
            metrics_by_execution = {m.execution_id: m for m in all_metrics}

        # Single pass: collect quality scores + status distribution + quality score distribution
        dqi_scores = []
        clean_rows_pct_scores = []
        hybrid_scores = []
        status_distribution = {}
        quality_dist = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
        data_quality_service = DataQualityService(db)

        for dataset in datasets:
            # Always count status
            dataset_status = dataset.status.value
            status_distribution[dataset_status] = (
                status_distribution.get(dataset_status, 0) + 1
            )

            # Try to get quality metrics from batch-loaded data
            version = version_by_dataset.get(dataset.id)
            if not version:
                continue
            execs = executions_by_version.get(version.id, [])
            if not execs:
                continue

            latest_exec = execs[0]
            metrics = metrics_by_execution.get(latest_exec.id)

            dqi = 0.0
            clean_rows_pct = 0.0
            hybrid = 0.0

            if metrics:
                dqi = float(metrics.dqi)
                clean_rows_pct = float(metrics.clean_rows_pct)
                hybrid = float(metrics.hybrid)
            else:
                try:
                    mr = data_quality_service.compute_quality_metrics(latest_exec.id)
                    dqi = mr.dqi
                    clean_rows_pct = mr.clean_rows_pct
                    hybrid = mr.hybrid
                except Exception as e:
                    logger.warning(
                        f"Failed to compute quality metrics for dataset {dataset.id}: {e}"
                    )
                    continue

            dqi_scores.append(dqi)
            clean_rows_pct_scores.append(clean_rows_pct)
            hybrid_scores.append(hybrid)

            # Classify hybrid score in same pass
            if hybrid >= 90:
                quality_dist["excellent"] += 1
            elif hybrid >= 70:
                quality_dist["good"] += 1
            elif hybrid >= 50:
                quality_dist["fair"] += 1
            else:
                quality_dist["poor"] += 1

        avg_dqi = sum(dqi_scores) / len(dqi_scores) if dqi_scores else 0
        avg_clean_rows_pct = (
            sum(clean_rows_pct_scores) / len(clean_rows_pct_scores)
            if clean_rows_pct_scores
            else 0
        )
        avg_hybrid = sum(hybrid_scores) / len(hybrid_scores) if hybrid_scores else 0

        return {
            "overview": {
                "total_datasets": total_datasets,
                "total_executions": total_executions,
                "total_issues": total_issues,
                "total_fixes": total_fixes,
                "avg_dqi": round(avg_dqi, 2),
                "avg_clean_rows_pct": round(avg_clean_rows_pct, 2),
                "avg_hybrid": round(avg_hybrid, 2),
                "issues_fixed_rate": round(
                    (total_fixes / total_issues * 100) if total_issues > 0 else 0, 2
                ),
            },
            "recent_activity": {
                "recent_datasets": [
                    {
                        "id": dataset.id,
                        "name": dataset.name,
                        "status": dataset.status.value,
                        "uploaded_at": dataset.uploaded_at,
                    }
                    for dataset in recent_datasets
                ],
                "recent_executions": [
                    {
                        "id": execution.id,
                        "dataset_version_id": execution.dataset_version_id,
                        "status": execution.status.value,
                        "issues_found": recent_issue_counts.get(execution.id, 0),
                        "created_at": execution.started_at,
                    }
                    for execution in recent_executions
                ],
            },
            "statistics": {
                "dataset_status_distribution": status_distribution,
                "quality_score_distribution": quality_dist,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to generate dashboard overview [ref={error_id}]: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/analytics/quality-trends")
async def get_quality_trends(
    days: int = Query(30, description="Number of days to analyze"),
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Get data quality trends over time within organization
    """
    try:
        # Get executions from the last N days - filtered by organization
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        org_datasets = (
            db.query(Dataset.id)
            .filter(Dataset.organization_id == org_context.organization_id)
            .subquery()
        )

        org_dataset_versions = (
            db.query(DatasetVersion.id)
            .filter(DatasetVersion.dataset_id.in_(org_datasets))
            .subquery()
        )

        executions = (
            db.query(Execution)
            .filter(
                Execution.started_at >= start_date,
                Execution.dataset_version_id.in_(org_dataset_versions),
            )
            .order_by(Execution.started_at.asc())
            .all()
        )

        # Batch: issue counts per execution (avoid N+1 lazy loads)
        execution_ids = [e.id for e in executions]
        issue_counts_by_exec = {}
        if execution_ids:
            issue_counts_by_exec = dict(
                db.query(Issue.execution_id, sa_func.count(Issue.id))
                .filter(Issue.execution_id.in_(execution_ids))
                .group_by(Issue.execution_id)
                .all()
            )

        # Single pass: group by date + compute summary stats
        trends = {}
        total_issues_found = 0
        total_succeeded = 0

        for execution in executions:
            date_key = execution.started_at.date().isoformat()
            issue_count = issue_counts_by_exec.get(execution.id, 0)

            if date_key not in trends:
                trends[date_key] = {
                    "date": date_key,
                    "total_executions": 0,
                    "total_issues": 0,
                    "successful_executions": 0,
                    "avg_execution_time": 0,
                }

            trends[date_key]["total_executions"] += 1
            trends[date_key]["total_issues"] += issue_count
            total_issues_found += issue_count

            is_succeeded = execution.status.value == "succeeded"
            if is_succeeded:
                trends[date_key]["successful_executions"] += 1
                total_succeeded += 1

            # Calculate duration from started_at and finished_at
            if execution.finished_at and execution.started_at:
                duration = (
                    execution.finished_at - execution.started_at
                ).total_seconds()
                current_avg = trends[date_key]["avg_execution_time"]
                count = trends[date_key]["total_executions"]
                trends[date_key]["avg_execution_time"] = (
                    current_avg * (count - 1) + duration
                ) / count

        # Calculate success rates
        for trend in trends.values():
            total = trend["total_executions"]
            successful = trend["successful_executions"]
            trend["success_rate"] = (successful / total * 100) if total > 0 else 0

        num_executions = len(executions)

        return {
            "analysis_period": {
                "start_date": start_date.date().isoformat(),
                "end_date": datetime.now(timezone.utc).date().isoformat(),
                "days_analyzed": days,
            },
            "trends": list(trends.values()),
            "summary": {
                "total_executions": num_executions,
                "total_issues_found": total_issues_found,
                "avg_issues_per_execution": (
                    total_issues_found / num_executions if num_executions else 0
                ),
                "overall_success_rate": (
                    total_succeeded / num_executions * 100 if num_executions else 0
                ),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to generate quality trends [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/datasets/quality-scores")
async def get_all_datasets_quality_scores(
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Get quality scores for all datasets within organization (optimized - uses DB aggregation only)
    """
    try:
        datasets = (
            db.query(Dataset)
            .filter(Dataset.organization_id == org_context.organization_id)
            .all()
        )
        dataset_ids = [d.id for d in datasets]

        # Batch: latest version per dataset via SQL subquery (1 query, no Python dedup)
        latest_version_no_sq = (
            db.query(
                DatasetVersion.dataset_id,
                sa_func.max(DatasetVersion.version_no).label("max_version_no"),
            )
            .filter(DatasetVersion.dataset_id.in_(dataset_ids))
            .group_by(DatasetVersion.dataset_id)
            .subquery()
        )
        latest_versions = (
            (
                db.query(DatasetVersion)
                .join(
                    latest_version_no_sq,
                    (DatasetVersion.dataset_id == latest_version_no_sq.c.dataset_id)
                    & (
                        DatasetVersion.version_no
                        == latest_version_no_sq.c.max_version_no
                    ),
                )
                .all()
            )
            if dataset_ids
            else []
        )
        version_by_dataset = {v.dataset_id: v for v in latest_versions}

        # Batch: all executions for latest versions (1 query instead of N)
        version_ids = [v.id for v in version_by_dataset.values()]
        all_executions = (
            (
                db.query(Execution)
                .filter(Execution.dataset_version_id.in_(version_ids))
                .order_by(Execution.started_at.desc())
                .all()
            )
            if version_ids
            else []
        )
        executions_by_version = defaultdict(list)
        for e in all_executions:
            executions_by_version[e.dataset_version_id].append(e)

        # Batch: issue counts per execution (1 query instead of N*M)
        all_exec_ids = [e.id for e in all_executions]
        issue_counts_by_exec = {}
        if all_exec_ids:
            issue_counts_by_exec = dict(
                db.query(Issue.execution_id, sa_func.count(Issue.id))
                .filter(Issue.execution_id.in_(all_exec_ids))
                .group_by(Issue.execution_id)
                .all()
            )

        # Batch: fix counts per execution (1 query instead of N)
        fix_counts_by_exec = {}
        if all_exec_ids:
            fix_counts_by_exec = dict(
                db.query(Issue.execution_id, sa_func.count(Fix.id))
                .join(Fix)
                .filter(Issue.execution_id.in_(all_exec_ids))
                .group_by(Issue.execution_id)
                .all()
            )

        # Batch: quality metrics for all executions (1 query instead of N)
        metrics_by_execution = {}
        if all_exec_ids:
            all_metrics = (
                db.query(DataQualityMetrics)
                .filter(DataQualityMetrics.execution_id.in_(all_exec_ids))
                .all()
            )
            metrics_by_execution = {m.execution_id: m for m in all_metrics}

        quality_scores = []
        data_quality_service = DataQualityService(db)

        for dataset in datasets:
            try:
                latest_version = version_by_dataset.get(dataset.id)
                if not latest_version:
                    continue

                execs = executions_by_version.get(latest_version.id, [])

                # Sum issue/fix counts from batch lookups
                total_issues = sum(issue_counts_by_exec.get(e.id, 0) for e in execs)
                total_fixes = sum(fix_counts_by_exec.get(e.id, 0) for e in execs)

                # Get quality metrics from batch lookup
                dqi = 0.0
                clean_rows_pct = 0.0
                hybrid = 0.0

                if execs:
                    latest_execution = execs[0]
                    metrics = metrics_by_execution.get(latest_execution.id)

                    if metrics:
                        dqi = float(metrics.dqi)
                        clean_rows_pct = float(metrics.clean_rows_pct)
                        hybrid = float(metrics.hybrid)
                    else:
                        # Compute on-demand if not cached
                        try:
                            metrics_response = (
                                data_quality_service.compute_quality_metrics(
                                    latest_execution.id
                                )
                            )
                            dqi = metrics_response.dqi
                            clean_rows_pct = metrics_response.clean_rows_pct
                            hybrid = metrics_response.hybrid
                        except Exception as e:
                            # If computation fails, default to 0
                            logger.warning(
                                f"Failed to compute quality metrics for execution {latest_execution.id}: {e}"
                            )

                quality_scores.append(
                    {
                        "id": dataset.id,
                        "name": dataset.name,
                        "dqi": round(dqi, 2),
                        "clean_rows_pct": round(clean_rows_pct, 2),
                        "hybrid": round(hybrid, 2),
                        "total_rows": latest_version.rows,
                        "total_issues": total_issues,
                        "total_fixes": total_fixes,
                        "status": dataset.status.value,
                    }
                )
            except Exception as e:
                # If we can't get quality data for a dataset, log and skip it
                logger.warning(
                    f"Could not get quality data for dataset {dataset.id}: {e}"
                )
                continue

        return {"datasets": quality_scores, "total_datasets": len(quality_scores)}

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to get quality scores [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/analytics/issue-patterns")
async def get_issue_patterns(
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """
    Analyze patterns in data quality issues within organization
    """
    try:
        # Get all issues within organization
        org_datasets = (
            db.query(Dataset.id)
            .filter(Dataset.organization_id == org_context.organization_id)
            .subquery()
        )

        org_dataset_versions = (
            db.query(DatasetVersion.id)
            .filter(DatasetVersion.dataset_id.in_(org_datasets))
            .subquery()
        )

        org_executions = (
            db.query(Execution.id)
            .filter(Execution.dataset_version_id.in_(org_dataset_versions))
            .subquery()
        )

        issues = db.query(Issue).filter(Issue.execution_id.in_(org_executions)).all()

        if not issues:
            return {"message": "No issues found for analysis", "patterns": {}}

        # Batch: load all rules referenced by issues (1 query instead of N)
        rule_ids = {i.rule_id for i in issues if i.rule_id}
        rules_by_id = {}
        if rule_ids:
            rules = db.query(Rule).filter(Rule.id.in_(rule_ids)).all()
            rules_by_id = {r.id: r for r in rules}

        # Batch: load which issues have fixes (1 query instead of per-severity)
        issue_ids = [i.id for i in issues]
        fixed_issue_ids = set()
        if issue_ids:
            fixed_issue_ids = {
                row[0]
                for row in db.query(Fix.issue_id)
                .filter(Fix.issue_id.in_(issue_ids))
                .all()
            }

        # Single pass: collect all aggregations at once
        by_severity = {}
        by_column = {}
        by_rule_type = {}
        message_counts = {}
        severity_total = {}
        severity_fixed = {}

        for issue in issues:
            severity = issue.severity.value if issue.severity else "unknown"
            column = issue.column_name or "unknown"
            msg = issue.message or "No message"

            # Severity count
            by_severity[severity] = by_severity.get(severity, 0) + 1

            # Column count
            by_column[column] = by_column.get(column, 0) + 1

            # Rule type count (using batch-loaded rules)
            if issue.rule_id and issue.rule_id in rules_by_id:
                rule_type = rules_by_id[issue.rule_id].kind.value
                by_rule_type[rule_type] = by_rule_type.get(rule_type, 0) + 1

            # Message count
            message_counts[msg] = message_counts.get(msg, 0) + 1

            # Fix rates by severity (using batch-loaded fix data)
            severity_total[severity] = severity_total.get(severity, 0) + 1
            if issue.id in fixed_issue_ids:
                severity_fixed[severity] = severity_fixed.get(severity, 0) + 1

        # Compute fix rates from accumulated counts
        fix_rates = {}
        for severity, total in severity_total.items():
            fixed = severity_fixed.get(severity, 0)
            fix_rates[severity] = round((fixed / total * 100) if total > 0 else 0, 2)

        patterns = {
            "by_severity": by_severity,
            "by_column": by_column,
            "by_rule_type": by_rule_type,
            "most_common_issues": [
                {"message": msg, "count": count}
                for msg, count in sorted(
                    message_counts.items(), key=lambda x: x[1], reverse=True
                )[:10]
            ],
            "fix_rates": fix_rates,
        }

        return {
            "total_issues_analyzed": len(issues),
            "patterns": patterns,
            "insights": {
                "most_problematic_columns": sorted(
                    patterns["by_column"].items(), key=lambda x: x[1], reverse=True
                )[:5],
                "most_common_rule_violations": sorted(
                    patterns["by_rule_type"].items(), key=lambda x: x[1], reverse=True
                )[:5],
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to analyze issue patterns [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/system/health")
async def get_system_health(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),  # Admin only
):
    """
    Get system health metrics (admin only)
    """
    try:
        # Database health
        total_tables = {
            "users": db.query(User).count(),
            "datasets": db.query(Dataset).count(),
            "dataset_versions": db.query(DatasetVersion).count(),
            "executions": db.query(Execution).count(),
            "issues": db.query(Issue).count(),
            "fixes": db.query(Fix).count(),
            "exports": db.query(Export).count(),
        }

        # Storage health
        from app.services.data_import import DATASET_STORAGE_PATH

        storage_path = Path(DATASET_STORAGE_PATH)

        if storage_path.exists():
            dataset_files = list(storage_path.glob("*.parquet"))
            total_storage_size = sum(f.stat().st_size for f in dataset_files)
        else:
            dataset_files = []
            total_storage_size = 0

        export_storage_path = Path("data/exports")
        if export_storage_path.exists():
            export_files = list(export_storage_path.glob("*"))
            export_storage_size = sum(
                f.stat().st_size for f in export_files if f.is_file()
            )
        else:
            export_files = []
            export_storage_size = 0

        # Recent activity health
        recent_threshold = datetime.now(timezone.utc) - timedelta(hours=24)

        recent_activity = {
            "recent_uploads": db.query(Dataset)
            .filter(Dataset.uploaded_at >= recent_threshold)
            .count(),
            "recent_executions": db.query(Execution)
            .filter(Execution.started_at >= recent_threshold)
            .count(),
            "recent_exports": db.query(Export)
            .filter(Export.created_at >= recent_threshold)
            .count(),
        }

        return {
            "system_status": "healthy",
            "timestamp": datetime.now(timezone.utc),
            "database_health": {
                "total_records": total_tables,
                "connection_status": "connected",
            },
            "storage_health": {
                "dataset_files_count": len(dataset_files),
                "total_dataset_storage_mb": round(
                    total_storage_size / (1024 * 1024), 2
                ),
                "export_files_count": len(export_files),
                "total_export_storage_mb": round(
                    export_storage_size / (1024 * 1024), 2
                ),
                "storage_paths": {
                    "datasets": str(storage_path),
                    "exports": str(export_storage_path),
                },
            },
            "activity_health": recent_activity,
            "performance_metrics": {
                "avg_execution_time": _get_avg_execution_time(db),
                "success_rate": _get_success_rate(db),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to get system health [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


def _get_avg_execution_time(db: Session) -> float:
    recent_threshold = datetime.now(timezone.utc) - timedelta(days=7)
    # Aggregate entirely in SQL: EXTRACT(EPOCH FROM (finished_at - started_at)) gives
    # the duration in seconds for each row; AVG aggregates across all qualifying rows.
    result = (
        db.query(
            sa_func.avg(
                sa_func.extract("epoch", Execution.finished_at - Execution.started_at)
            )
        )
        .filter(
            Execution.started_at >= recent_threshold,
            Execution.finished_at.isnot(None),
        )
        .scalar()
    )
    return round(float(result), 2) if result is not None else 0.0


def _get_success_rate(db: Session) -> float:
    """Get success rate from recent executions — computed entirely in SQL."""
    recent_threshold = datetime.now(timezone.utc) - timedelta(days=7)
    # Single aggregate query: count total rows and count rows where status = 'succeeded'.
    total, succeeded = (
        db.query(
            sa_func.count(Execution.id),
            sa_func.sum(
                case((Execution.status == ExecutionStatus.succeeded, 1), else_=0)
            ),
        )
        .filter(Execution.started_at >= recent_threshold)
        .one()
    )
    if not total:
        return 100.0
    return round((int(succeeded or 0) / total) * 100, 2)
