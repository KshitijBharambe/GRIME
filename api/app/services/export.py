import pandas as pd
import json
import io
import zipfile
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models import (
    Dataset,
    DatasetVersion,
    Export,
    ExportFormat,
    Issue,
    Fix,
    Execution,
    User,
)
from app.services.data_import import DataImportService
from app.core.config import ErrorMessages, IQR_Q1, IQR_Q3, IQR_MULTIPLIER
from app.utils.logging_service import get_logger

logger = get_logger(__name__)


def strip_tz(dt):
    """Strip timezone info from a datetime for serialization/Excel compatibility."""
    return dt.replace(tzinfo=None) if dt and hasattr(dt, "replace") else dt


class ExportService:
    """
    Service for exporting datasets and generating reports in multiple formats
    """

    def __init__(self, db: Session):
        self.db = db
        self.data_import_service = DataImportService(db)

        # Export storage directory
        self.export_storage_path = Path("data/exports")
        try:
            self.export_storage_path.mkdir(parents=True, exist_ok=True)
        except PermissionError:
            # If permission denied, try to use the path anyway (it might already exist)
            # This can happen in Docker environments where the directory is created by a different user
            if not self.export_storage_path.exists():
                logger.error(
                    "Export directory '%s' does not exist and cannot be created due to permissions.",
                    self.export_storage_path,
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Export storage is unavailable. Please contact the system administrator.",
                )

    # === CORE EXPORT FUNCTIONALITY ===

    def export_dataset(
        self,
        dataset_version_id: str,
        export_format: ExportFormat,
        user_id: str,
        execution_id: Optional[str] = None,
        include_metadata: bool = True,
        include_issues: bool = False,
    ) -> Tuple[str, str]:
        """
        Export a dataset version in the specified format

        Args:
            dataset_version_id: ID of dataset version to export
            export_format: Format to export (csv, excel, json, etc.)
            user_id: ID of user requesting export
            execution_id: Optional execution ID for context
            include_metadata: Whether to include dataset metadata
            include_issues: Whether to include identified issues

        Returns:
            Tuple of (export_id, file_path)
        """
        # Get dataset version
        dataset_version = (
            self.db.query(DatasetVersion)
            .filter(DatasetVersion.id == dataset_version_id)
            .first()
        )

        if not dataset_version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset version not found",
            )

        # Load the dataset
        df = self.data_import_service.load_dataset_file(
            dataset_version.dataset_id, dataset_version.version_no
        )

        # Generate export filename
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dataset = (
            self.db.query(Dataset)
            .filter(Dataset.id == dataset_version.dataset_id)
            .first()
        )
        base_filename = f"{dataset.name}_v{dataset_version.version_no}_{timestamp}"

        # Export based on format
        if export_format == ExportFormat.csv:
            file_path = self._export_csv(
                df, base_filename, include_metadata, dataset_version, include_issues
            )
        elif export_format == ExportFormat.excel:
            file_path = self._export_excel(
                df, base_filename, include_metadata, dataset_version, include_issues
            )
        elif export_format == ExportFormat.json:
            file_path = self._export_json(
                df, base_filename, include_metadata, dataset_version, include_issues
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Export format {export_format.value} not supported",
            )

        # Create export record
        export_record = Export(
            dataset_version_id=dataset_version_id,
            execution_id=execution_id,
            format=export_format,
            location=str(file_path),
            created_by=user_id,
        )

        self.db.add(export_record)
        self.db.commit()
        self.db.refresh(export_record)

        return export_record.id, str(file_path)

    def _export_csv(
        self,
        df: pd.DataFrame,
        base_filename: str,
        include_metadata: bool,
        dataset_version: DatasetVersion,
        include_issues: bool,
    ) -> str:
        """Export dataset as CSV file(s)"""
        logger.debug(
            f"CSV Export - include_metadata: {include_metadata}, include_issues: {include_issues}"
        )

        if not include_metadata and not include_issues:
            # Simple CSV export with explicit UTF-8 encoding
            file_path = self.export_storage_path / f"{base_filename}.csv"
            df.to_csv(file_path, index=False, encoding="utf-8")
            return str(file_path)

        # Create ZIP with multiple files
        zip_path = self.export_storage_path / f"{base_filename}.zip"

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            # Main data file - use StringIO and encode to bytes
            data_buffer = io.StringIO()
            df.to_csv(data_buffer, index=False)
            zipf.writestr(
                f"{base_filename}_data.csv", data_buffer.getvalue().encode("utf-8")
            )

            # Metadata file
            if include_metadata:
                metadata = self._generate_metadata(dataset_version)
                metadata_json = json.dumps(metadata, indent=2, default=str)
                zipf.writestr(
                    f"{base_filename}_metadata.json", metadata_json.encode("utf-8")
                )

            # Issues file
            if include_issues:
                issues_df = self._get_issues_dataframe(dataset_version)
                if not issues_df.empty:
                    issues_buffer = io.StringIO()
                    issues_df.to_csv(issues_buffer, index=False)
                    zipf.writestr(
                        f"{base_filename}_issues.csv",
                        issues_buffer.getvalue().encode("utf-8"),
                    )

        return str(zip_path)

    def _flatten_dict(
        self, d: Dict[str, Any], parent_key: str = "", sep: str = "."
    ) -> Dict[str, Any]:
        """
        Flatten a nested dictionary for easier display in tables

        Example:
            {'a': 1, 'b': {'c': 2, 'd': 3}} -> {'a': 1, 'b.c': 2, 'b.d': 3}
        """
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(self._flatten_dict(v, new_key, sep=sep).items())
            else:
                items.append((new_key, v))
        return dict(items)

    def _export_excel(
        self,
        df: pd.DataFrame,
        base_filename: str,
        include_metadata: bool,
        dataset_version: DatasetVersion,
        include_issues: bool,
    ) -> str:
        """Export dataset as Excel file with multiple sheets"""
        logger.debug(
            f"Excel Export - include_metadata: {include_metadata}, include_issues: {include_issues}"
        )

        file_path = self.export_storage_path / f"{base_filename}.xlsx"

        with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
            # Main data sheet
            df.to_excel(writer, sheet_name="Data", index=False)

            # Metadata sheet
            if include_metadata:
                logger.debug("Creating Metadata sheet...")
                metadata = self._generate_metadata(dataset_version)
                # Flatten nested dictionaries for better readability in Excel
                flat_metadata = self._flatten_dict(metadata)
                metadata_df = pd.DataFrame(
                    [{"Property": k, "Value": v} for k, v in flat_metadata.items()]
                )
                metadata_df.to_excel(writer, sheet_name="Metadata", index=False)
                logger.debug(f"Metadata sheet created with {len(flat_metadata)} rows")

            # Issues sheet
            if include_issues:
                logger.debug("Creating Issues sheet...")
                issues_df = self._get_issues_dataframe(dataset_version)
                if not issues_df.empty:
                    issues_df.to_excel(writer, sheet_name="Issues", index=False)
                    logger.debug(f"Issues sheet created with {len(issues_df)} issues")
                else:
                    logger.debug("No issues found, skipping Issues sheet")

            # Data quality summary sheet
            if include_metadata:
                logger.debug("Creating Quality Summary sheet...")
                quality_summary = self._generate_quality_summary(df)
                # Flatten nested dictionaries (e.g., column_stats)
                flat_quality = self._flatten_dict(quality_summary)
                quality_df = pd.DataFrame(
                    [{"Metric": k, "Value": v} for k, v in flat_quality.items()]
                )
                quality_df.to_excel(writer, sheet_name="Quality Summary", index=False)
                logger.debug(
                    f"Quality Summary sheet created with {len(flat_quality)} metrics"
                )

        return str(file_path)

    def _export_json(
        self,
        df: pd.DataFrame,
        base_filename: str,
        include_metadata: bool,
        dataset_version: DatasetVersion,
        include_issues: bool,
    ) -> str:
        """Export dataset as JSON file(s)"""

        export_data = {"data": df.to_dict(orient="records")}

        if include_metadata:
            export_data["metadata"] = self._generate_metadata(dataset_version)
            export_data["quality_summary"] = self._generate_quality_summary(df)

        if include_issues:
            issues_df = self._get_issues_dataframe(dataset_version)
            if not issues_df.empty:
                export_data["issues"] = issues_df.to_dict(orient="records")

        file_path = self.export_storage_path / f"{base_filename}.json"

        with open(file_path, "w") as f:
            json.dump(export_data, f, indent=2, default=str)

        return str(file_path)

    # === METADATA AND QUALITY REPORTING ===

    def _generate_metadata(self, dataset_version: DatasetVersion) -> Dict[str, Any]:
        """Generate comprehensive metadata for dataset version"""

        dataset = (
            self.db.query(Dataset)
            .filter(Dataset.id == dataset_version.dataset_id)
            .first()
        )

        # Get all versions for this dataset
        all_versions = (
            self.db.query(DatasetVersion)
            .filter(DatasetVersion.dataset_id == dataset_version.dataset_id)
            .order_by(DatasetVersion.version_no.asc())
            .all()
        )

        # Get executions for this version
        executions = (
            self.db.query(Execution)
            .filter(Execution.dataset_version_id == dataset_version.id)
            .all()
        )

        return {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "source_type": dataset.source_type.value,
            "original_filename": dataset.original_filename,
            "uploaded_by": dataset.uploaded_by,
            "uploaded_at": strip_tz(dataset.uploaded_at),
            "current_status": dataset.status.value,
            "version_info": {
                "version_number": dataset_version.version_no,
                "created_at": strip_tz(dataset_version.created_at),
                "row_count": dataset_version.rows,
                "column_count": dataset_version.columns,
                "notes": dataset_version.change_note,
                "total_versions": len(all_versions),
            },
            "processing_history": {
                "total_executions": len(executions),
                "total_issues_found": sum(len(e.issues) for e in executions),
                "last_execution": (
                    strip_tz(executions[-1].started_at) if executions else None
                ),
            },
            "export_info": {
                "exported_at": strip_tz(datetime.now(timezone.utc)),
                "export_version": "1.0",
            },
        }

    def _generate_quality_summary(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate data quality summary for the dataset"""

        total_cells = len(df) * len(df.columns)
        missing_cells = df.isnull().sum().sum()

        return {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "total_cells": total_cells,
            "missing_cells": missing_cells,
            "missing_percentage": (
                (missing_cells / total_cells * 100) if total_cells > 0 else 0
            ),
            "duplicate_rows": df.duplicated().sum(),
            "duplicate_percentage": (
                (df.duplicated().sum() / len(df) * 100) if len(df) > 0 else 0
            ),
            "data_types": df.dtypes.astype(str).to_dict(),
            "column_stats": {
                col: {
                    "missing_count": df[col].isnull().sum(),
                    "unique_values": df[col].nunique(),
                    "data_type": str(df[col].dtype),
                }
                for col in df.columns
            },
        }

    def _get_issues_dataframe(self, dataset_version: DatasetVersion) -> pd.DataFrame:
        """Get all issues for a dataset version as DataFrame"""

        # Get all executions for this dataset version
        executions = (
            self.db.query(Execution)
            .filter(Execution.dataset_version_id == dataset_version.id)
            .all()
        )

        if not executions:
            return pd.DataFrame()

        execution_ids = [e.id for e in executions]

        # Get all issues from these executions
        issues = (
            self.db.query(Issue).filter(Issue.execution_id.in_(execution_ids)).all()
        )

        if not issues:
            return pd.DataFrame()

        # Convert to DataFrame
        issues_data = []
        for issue in issues:
            # Get fixes for this issue
            fixes = self.db.query(Fix).filter(Fix.issue_id == issue.id).all()

            # Remove timezone info from datetimes for Excel compatibility
            created_at = strip_tz(issue.created_at)
            latest_fix_at = strip_tz(fixes[-1].fixed_at) if fixes else None

            issues_data.append(
                {
                    "issue_id": issue.id,
                    "execution_id": issue.execution_id,
                    "rule_id": issue.rule_id,
                    "row_index": issue.row_index,
                    "column_name": issue.column_name,
                    "current_value": issue.current_value,
                    "suggested_value": issue.suggested_value,
                    "severity": issue.severity.value if issue.severity else None,
                    "message": issue.message,
                    "created_at": created_at,
                    "is_fixed": len(fixes) > 0,
                    "fix_count": len(fixes),
                    "latest_fix": fixes[-1].new_value if fixes else None,
                    "latest_fix_at": latest_fix_at,
                }
            )

        return pd.DataFrame(issues_data)

    # === EXPORT MANAGEMENT ===

    def get_export_history(self, dataset_id: str) -> List[Dict[str, Any]]:
        """Get export history for a dataset"""

        # Get all versions for this dataset
        versions = (
            self.db.query(DatasetVersion)
            .filter(DatasetVersion.dataset_id == dataset_id)
            .all()
        )

        version_ids = [v.id for v in versions]

        # Get all exports for these versions
        exports = (
            self.db.query(Export)
            .filter(Export.dataset_version_id.in_(version_ids))
            .order_by(Export.created_at.desc())
            .all()
        )

        export_history = []
        for export in exports:
            # Get creator info
            creator = self.db.query(User).filter(User.id == export.created_by).first()

            # Get version info
            version = next(
                (v for v in versions if v.id == export.dataset_version_id), None
            )

            export_history.append(
                {
                    "export_id": export.id,
                    "format": export.format.value,
                    "created_at": export.created_at,
                    "created_by": creator.name if creator else "Unknown",
                    "dataset_version": version.version_no if version else None,
                    "location": export.location,
                    "execution_id": export.execution_id,
                    "file_exists": (
                        Path(export.location).exists() if export.location else False
                    ),
                }
            )

        return export_history

    def get_export_file(self, export_id: str) -> Tuple[str, str]:
        """Get export file path and original filename"""

        export = self.db.query(Export).filter(Export.id == export_id).first()
        if not export:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Export not found"
            )

        if not export.location or not Path(export.location).exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Export file not found"
            )

        # Generate download filename
        dataset_version = (
            self.db.query(DatasetVersion)
            .filter(DatasetVersion.id == export.dataset_version_id)
            .first()
        )

        dataset = (
            self.db.query(Dataset)
            .filter(Dataset.id == dataset_version.dataset_id)
            .first()
        )

        download_filename = (
            f"{dataset.name}_v{dataset_version.version_no}.{export.format.value}"
        )

        return export.location, download_filename

    def delete_export(self, export_id: str, user_id: str) -> bool:
        """Delete an export and its associated file"""

        export = self.db.query(Export).filter(Export.id == export_id).first()
        if not export:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Export not found"
            )

        # Check permissions (only creator or admin can delete)
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
            )

        if export.created_by != user_id and user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to delete this export",
            )

        # Delete file if it exists
        if export.location and Path(export.location).exists():
            try:
                Path(export.location).unlink()
            except Exception:
                pass  # Continue even if file deletion fails

        # Delete export record
        self.db.delete(export)
        self.db.commit()

        return True

    # === SPECIALIZED EXPORT FORMATS ===

    def export_data_quality_report(
        self, dataset_id: str, user_id: str, include_charts: bool = False
    ) -> Tuple[str, str]:
        """Generate comprehensive data quality report"""

        dataset = self.db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ErrorMessages.DATASET_NOT_FOUND,
            )

        # Get latest version
        latest_version = (
            self.db.query(DatasetVersion)
            .filter(DatasetVersion.dataset_id == dataset_id)
            .order_by(DatasetVersion.version_no.desc())
            .first()
        )

        # Load dataset
        df = self.data_import_service.load_dataset_file(
            dataset_id, latest_version.version_no
        )

        # Generate comprehensive report
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        report_filename = f"{dataset.name}_quality_report_{timestamp}"

        file_path = self.export_storage_path / f"{report_filename}.xlsx"

        with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
            # Executive Summary
            summary_data = self._generate_executive_summary(dataset, latest_version, df)
            summary_df = pd.DataFrame(
                [{"Metric": k, "Value": v} for k, v in summary_data.items()]
            )
            summary_df.to_excel(writer, sheet_name="Executive Summary", index=False)

            # Column Analysis
            column_analysis = self._generate_detailed_column_analysis(df)
            column_df = pd.DataFrame(column_analysis).T.reset_index()
            column_df.rename(columns={"index": "Column"}, inplace=True)
            column_df.to_excel(writer, sheet_name="Column Analysis", index=False)

            # Issues Summary
            issues_df = self._get_issues_dataframe(latest_version)
            if not issues_df.empty:
                # Issues by severity
                severity_summary = (
                    issues_df.groupby("severity").size().reset_index(name="count")
                )
                severity_summary.to_excel(
                    writer, sheet_name="Issues by Severity", index=False
                )

                # Issues by column
                column_issues = (
                    issues_df.groupby("column_name")
                    .size()
                    .reset_index(name="issue_count")
                )
                column_issues.to_excel(
                    writer, sheet_name="Issues by Column", index=False
                )

                # All issues
                issues_df.to_excel(writer, sheet_name="All Issues", index=False)

            # Processing History
            executions = (
                self.db.query(Execution)
                .filter(Execution.dataset_version_id == latest_version.id)
                .all()
            )

            if executions:
                exec_data = []
                for exec in executions:
                    duration = 0
                    if exec.finished_at and exec.started_at:
                        duration = (exec.finished_at - exec.started_at).total_seconds()

                    # Remove timezone for Excel compatibility
                    created_at = strip_tz(exec.started_at)

                    exec_data.append(
                        {
                            "Execution ID": exec.id,
                            "Created At": created_at,
                            "Status": exec.status.value,
                            "Rules Executed": exec.total_rules or 0,
                            "Issues Found": len(exec.issues),
                            "Duration (seconds)": duration,
                        }
                    )

                exec_df = pd.DataFrame(exec_data)
                exec_df.to_excel(writer, sheet_name="Processing History", index=False)

        # Create export record
        export_record = Export(
            dataset_version_id=latest_version.id,
            format=ExportFormat.excel,
            location=str(file_path),
            created_by=user_id,
        )

        self.db.add(export_record)
        self.db.commit()
        self.db.refresh(export_record)

        return export_record.id, str(file_path)

    def _generate_executive_summary(
        self, dataset: Dataset, version: DatasetVersion, df: pd.DataFrame
    ) -> Dict[str, Any]:
        """Generate executive summary for quality report"""

        total_cells = len(df) * len(df.columns)
        missing_cells = df.isnull().sum().sum()

        # Calculate quality score
        completeness = (
            (1 - missing_cells / total_cells) * 100 if total_cells > 0 else 100
        )
        uniqueness = (1 - df.duplicated().sum() / len(df)) * 100 if len(df) > 0 else 100
        overall_quality = (completeness + uniqueness) / 2

        # Strip timezone info for Excel compatibility
        last_updated = strip_tz(version.created_at)
        report_generated = strip_tz(datetime.now(timezone.utc))

        return {
            "Dataset Name": dataset.name,
            "Current Version": version.version_no,
            "Total Rows": len(df),
            "Total Columns": len(df.columns),
            "Total Data Points": total_cells,
            "Missing Data Points": missing_cells,
            "Missing Data %": (
                round(missing_cells / total_cells * 100, 2) if total_cells > 0 else 0
            ),
            "Duplicate Rows": df.duplicated().sum(),
            "Duplicate %": (
                round(df.duplicated().sum() / len(df) * 100, 2) if len(df) > 0 else 0
            ),
            "Data Completeness Score": round(completeness, 2),
            "Data Uniqueness Score": round(uniqueness, 2),
            "Overall Quality Score": round(overall_quality, 2),
            "Last Updated": last_updated,
            "Report Generated": report_generated,
        }

    def _generate_detailed_column_analysis(
        self, df: pd.DataFrame
    ) -> Dict[str, Dict[str, Any]]:
        """Generate detailed analysis for each column"""

        analysis = {}

        for column in df.columns:
            series = df[column]

            column_analysis = {
                "Data Type": str(series.dtype),
                "Total Values": len(series),
                "Missing Values": series.isnull().sum(),
                "Missing %": round(series.isnull().sum() / len(series) * 100, 2),
                "Unique Values": series.nunique(),
                "Duplicate Values": len(series) - series.nunique(),
                "Most Frequent Value": (
                    series.mode().iloc[0] if not series.mode().empty else None
                ),
                "Value Frequency": (
                    series.value_counts().iloc[0] if not series.empty else 0
                ),
            }

            # Add type-specific analysis
            if series.dtype in ["int64", "float64"]:
                column_analysis.update(
                    {
                        "Min Value": series.min(),
                        "Max Value": series.max(),
                        "Mean": round(series.mean(), 2),
                        "Median": series.median(),
                        "Standard Deviation": round(series.std(), 2),
                        "Outliers (IQR)": self._count_outliers_iqr(series),
                    }
                )
            elif series.dtype == "object":
                column_analysis.update(
                    {
                        "Min Length": series.astype(str).str.len().min(),
                        "Max Length": series.astype(str).str.len().max(),
                        "Avg Length": round(series.astype(str).str.len().mean(), 2),
                        "Empty Strings": (series == "").sum(),
                        "Whitespace Only": series.astype(str).str.strip().eq("").sum(),
                    }
                )

            analysis[column] = column_analysis

        return analysis

    def _count_outliers_iqr(self, series: pd.Series) -> int:
        """Count outliers using IQR method"""
        try:
            Q1 = series.quantile(IQR_Q1)
            Q3 = series.quantile(IQR_Q3)
            IQR = Q3 - Q1
            lower_bound = Q1 - IQR_MULTIPLIER * IQR
            upper_bound = Q3 + IQR_MULTIPLIER * IQR
            outliers = series[(series < lower_bound) | (series > upper_bound)]
            return len(outliers)
        except (ValueError, TypeError):
            return 0
