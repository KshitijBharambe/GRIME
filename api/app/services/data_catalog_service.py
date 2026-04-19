"""
Import a catalog entry (a source table) into the dataset/version system,
then run rules against it using existing execution infrastructure.
"""
import json
import hashlib
import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import (
    Dataset,
    DatasetStatus,
    DatasetVersion,
    DatasetColumn,
    DataCatalogEntry,
    DataSource,
    SourceType,
    VersionSource,
    User,
)
from app.services.connectors import get_connector, ConnectorError

logger = logging.getLogger(__name__)


def get_catalog_entries(db: Session, org_id: str, source_id: Optional[str] = None):
    q = db.query(DataCatalogEntry).filter(DataCatalogEntry.organization_id == org_id)
    if source_id:
        q = q.filter(DataCatalogEntry.data_source_id == source_id)
    return q.all()


def get_catalog_entry(db: Session, org_id: str, entry_id: str) -> Optional[DataCatalogEntry]:
    return (
        db.query(DataCatalogEntry)
        .filter(DataCatalogEntry.id == entry_id, DataCatalogEntry.organization_id == org_id)
        .first()
    )


def import_catalog_entry_as_dataset(
    db: Session,
    entry: DataCatalogEntry,
    current_user: User,
    dataset_name: Optional[str] = None,
    row_limit: Optional[int] = None,
) -> tuple[Dataset, DatasetVersion]:
    """
    Fetch data from the source table and persist it as a Dataset + DatasetVersion.
    Returns (dataset, dataset_version) ready for rule execution.
    """
    ds: DataSource = entry.data_source
    params = json.loads(ds.connection_params)

    try:
        connector = get_connector(ds.source_type, params)
        df = connector.fetch_table(entry.schema_name, entry.table_name, limit=row_limit)
    except ConnectorError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    if df.empty:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source table returned no rows")

    csv_bytes = df.to_csv(index=False).encode()
    checksum = hashlib.sha256(csv_bytes).hexdigest()

    name = dataset_name or f"{ds.name}/{entry.table_name}"

    existing = (
        db.query(Dataset)
        .filter(Dataset.checksum == checksum, Dataset.organization_id == entry.organization_id)
        .first()
    )
    if existing:
        version = (
            db.query(DatasetVersion)
            .filter(DatasetVersion.dataset_id == existing.id)
            .order_by(DatasetVersion.created_at.desc())
            .first()
        )
        return existing, version

    dataset = Dataset(
        organization_id=entry.organization_id,
        name=name,
        source_type=SourceType.other,
        original_filename=f"{entry.table_name}.parquet",
        checksum=checksum,
        uploaded_by=current_user.id,
        status=DatasetStatus.uploaded,
        row_count=len(df),
        column_count=len(df.columns),
        notes=f"Imported from data source '{ds.name}', table '{entry.table_name}'",
    )
    db.add(dataset)
    db.flush()

    # Reuse DataImportService file persistence
    from app.services.data_import import DataImportService
    importer = DataImportService(db)
    file_path = importer.save_dataset_file(dataset.id, df, version_no=1)

    version = DatasetVersion(
        dataset_id=dataset.id,
        version_no=1,
        created_by=current_user.id,
        rows=len(df),
        columns=len(df.columns),
        change_note=f"Imported from {ds.source_type.value}: {entry.table_name}",
        source=VersionSource.upload,
        file_path=file_path,
    )
    db.add(version)
    db.flush()

    for i, col in enumerate(df.columns):
        db.add(DatasetColumn(
            dataset_id=dataset.id,
            name=col,
            ordinal_position=i,
            inferred_type=str(df[col].dtype),
            is_nullable=bool(df[col].isnull().any()),
        ))

    db.commit()
    db.refresh(dataset)
    db.refresh(version)
    return dataset, version
