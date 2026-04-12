"""
Service for applying fixes to datasets and creating new versions
"""
import pandas as pd
import os
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.models import (
    Dataset, DatasetVersion, Issue, Fix, VersionSource, VersionJournal, Execution
)


class DatasetFixService:
    """Service for applying fixes to datasets and creating new versions"""

    def __init__(self, db: Session):
        self.db = db

    def apply_fixes_and_create_version(
        self,
        dataset_id: str,
        source_version_id: str,
        fix_ids: List[str],
        user_id: str,
        version_notes: Optional[str] = None,
        re_run_rules: bool = False
    ) -> Tuple[DatasetVersion, List[Fix]]:
        """
        Apply selected fixes to a dataset version and create a new version

        Args:
            dataset_id: ID of the dataset
            source_version_id: ID of the version to apply fixes to
            fix_ids: List of fix IDs to apply
            user_id: ID of the user creating the new version
            version_notes: Optional notes for the new version
            re_run_rules: Whether to automatically re-run rules on the new version

        Returns:
            Tuple of (new_dataset_version, applied_fixes)
        """
        # Validate dataset and version
        dataset = self.db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")

        source_version = self.db.query(DatasetVersion).filter(
            DatasetVersion.id == source_version_id
        ).first()
        if not source_version:
            raise ValueError(f"Dataset version {source_version_id} not found")

        if source_version.dataset_id != dataset_id:
            raise ValueError("Version does not belong to specified dataset")

        # Get fixes with their issues
        fixes = self.db.query(Fix).options(
            joinedload(Fix.issue).joinedload(Issue.execution)
        ).filter(
            Fix.id.in_(fix_ids),
            Fix.applied_in_version_id.is_(None)  # Only unapplied fixes
        ).all()

        if not fixes:
            raise ValueError("No valid fixes found to apply")

        # Load the dataset file
        df = self._load_dataset_version(source_version)

        # Apply fixes to the dataframe
        applied_fixes = []
        for fix in fixes:
            try:
                issue = fix.issue
                # Apply the fix to the dataframe
                df.loc[issue.row_index, issue.column_name] = fix.new_value
                applied_fixes.append(fix)
            except Exception as e:
                print(f"Warning: Failed to apply fix {fix.id}: {str(e)}")
                continue

        if not applied_fixes:
            raise ValueError("No fixes could be applied successfully")

        # Calculate next version number
        max_version = self.db.query(func.max(DatasetVersion.version_no)).filter(
            DatasetVersion.dataset_id == dataset_id
        ).scalar() or 0
        next_version_no = max_version + 1

        # Save the modified dataset
        new_file_path = self._save_dataset_version(
            df, dataset, next_version_no
        )

        # Create new dataset version
        new_version = DatasetVersion(
            dataset_id=dataset_id,
            version_no=next_version_no,
            created_by=user_id,
            rows=len(df),
            columns=len(df.columns),
            change_note=version_notes or f"Applied {len(applied_fixes)} data quality fixes",
            parent_version_id=source_version_id,
            source=VersionSource.fixes_applied,
            file_path=new_file_path
        )
        self.db.add(new_version)
        self.db.flush()  # Get the new version ID

        # Update fixes to mark them as applied
        now = datetime.now(timezone.utc)
        for fix in applied_fixes:
            fix.applied_in_version_id = new_version.id
            fix.applied_at = now

        # Create journal entry
        journal_entry = VersionJournal(
            dataset_version_id=new_version.id,
            event="fixes_applied",
            rows_affected=len(applied_fixes),
            columns_affected=len({fix.issue.column_name for fix in applied_fixes}),
            details=f"Applied {len(applied_fixes)} fixes from {len({fix.issue_id for fix in applied_fixes})} issues"
        )
        self.db.add(journal_entry)

        self.db.commit()
        self.db.refresh(new_version)

        return new_version, applied_fixes

    def _load_dataset_version(self, version: DatasetVersion) -> pd.DataFrame:
        """Load a dataset version from file"""
        # Try to find the file path
        file_path = version.file_path

        if not file_path or not os.path.exists(file_path):
            # Fallback: Look for the dataset file in the uploads directory
            dataset = version.dataset
            if dataset.original_filename:
                # Try common locations
                possible_paths = [
                    f"uploads/{dataset.original_filename}",
                    f"data/datasets/{dataset.id}/{dataset.original_filename}",
                    f"data/datasets/{dataset.id}/v{version.version_no}.csv"
                ]

                for path in possible_paths:
                    if os.path.exists(path):
                        file_path = path
                        break

        if not file_path or not os.path.exists(file_path):
            raise FileNotFoundError(f"Dataset file not found for version {version.id}")

        # Load based on file type
        if file_path.endswith('.csv'):
            return pd.read_csv(file_path)
        elif file_path.endswith(('.xlsx', '.xls')):
            return pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path}")

    def _save_dataset_version(
        self, df: pd.DataFrame, dataset: Dataset, version_no: int
    ) -> str:
        """Save a dataset version to file"""
        # Create directory structure
        dataset_dir = f"data/datasets/{dataset.id}"
        os.makedirs(dataset_dir, exist_ok=True)

        # Generate filename
        filename = f"v{version_no}.csv"
        file_path = os.path.join(dataset_dir, filename)

        # Save the dataframe
        df.to_csv(file_path, index=False)

        return file_path

    def get_unapplied_fixes_for_version(
        self, version_id: str
    ) -> List[Dict]:
        """Get all unapplied fixes for issues detected in a specific version"""
        fixes = self.db.query(Fix).join(
            Issue, Fix.issue_id == Issue.id
        ).join(
            Execution, Issue.execution_id == Execution.id
        ).filter(
            Execution.dataset_version_id == version_id,
            Fix.applied_in_version_id.is_(None)
        ).all()

        return [
            {
                "fix_id": fix.id,
                "issue_id": fix.issue_id,
                "row_index": fix.issue.row_index,
                "column_name": fix.issue.column_name,
                "current_value": fix.issue.current_value,
                "new_value": fix.new_value,
                "comment": fix.comment,
                "severity": fix.issue.severity.value,
                "fixed_by": fix.fixer.name if fix.fixer else None,
                "fixed_at": fix.fixed_at.isoformat() if fix.fixed_at else None
            }
            for fix in fixes
        ]

    def get_version_lineage(self, version_id: str) -> List[Dict]:
        """Get the version lineage (parent chain) for a version"""
        lineage = []
        current_version = self.db.query(DatasetVersion).filter(
            DatasetVersion.id == version_id
        ).first()

        while current_version:
            lineage.append({
                "version_id": current_version.id,
                "version_no": current_version.version_no,
                "source": current_version.source.value,
                "created_at": current_version.created_at.isoformat() if current_version.created_at else None,
                "created_by": current_version.creator.name if current_version.creator else None,
                "change_note": current_version.change_note,
                "rows": current_version.rows,
                "columns": current_version.columns
            })

            # Get parent version
            if current_version.parent_version_id:
                current_version = self.db.query(DatasetVersion).filter(
                    DatasetVersion.id == current_version.parent_version_id
                ).first()
            else:
                current_version = None

        return lineage

    def get_fixes_applied_in_version(self, version_id: str) -> List[Dict]:
        """Get all fixes that were applied in a specific version"""
        fixes = self.db.query(Fix).options(
            joinedload(Fix.issue),
            joinedload(Fix.fixer)
        ).filter(
            Fix.applied_in_version_id == version_id
        ).all()

        return [
            {
                "fix_id": fix.id,
                "issue_id": fix.issue_id,
                "row_index": fix.issue.row_index,
                "column_name": fix.issue.column_name,
                "old_value": fix.issue.current_value,
                "new_value": fix.new_value,
                "comment": fix.comment,
                "severity": fix.issue.severity.value,
                "fixed_by": fix.fixer.name if fix.fixer else None,
                "applied_at": fix.applied_at.isoformat() if fix.applied_at else None
            }
            for fix in fixes
        ]
