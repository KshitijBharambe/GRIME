import json
import time
import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models import DataSource, DataSourceStatus, DataSourceType, DataCatalogEntry
from app.schemas import DataSourceCreate, DataSourceUpdate
from app.services.connectors import get_connector, ConnectorError

logger = logging.getLogger(__name__)


def create_data_source(db: Session, org_id: str, user_id: str, payload: DataSourceCreate) -> DataSource:
    ds = DataSource(
        organization_id=org_id,
        name=payload.name,
        source_type=payload.source_type,
        status=DataSourceStatus.active,
        connection_params=json.dumps(payload.connection_params),
        created_by=user_id,
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return ds


def get_data_source(db: Session, org_id: str, source_id: str) -> Optional[DataSource]:
    return (
        db.query(DataSource)
        .filter(DataSource.id == source_id, DataSource.organization_id == org_id)
        .first()
    )


def list_data_sources(db: Session, org_id: str) -> List[DataSource]:
    return db.query(DataSource).filter(DataSource.organization_id == org_id).all()


def update_data_source(db: Session, ds: DataSource, payload: DataSourceUpdate) -> DataSource:
    if payload.name is not None:
        ds.name = payload.name
    if payload.connection_params is not None:
        ds.connection_params = json.dumps(payload.connection_params)
    db.commit()
    db.refresh(ds)
    return ds


def delete_data_source(db: Session, ds: DataSource) -> None:
    db.delete(ds)
    db.commit()


def test_connection(ds: DataSource) -> tuple[bool, str, Optional[float]]:
    params = json.loads(ds.connection_params)
    t0 = time.monotonic()
    try:
        connector = get_connector(ds.source_type, params)
        success, message = connector.test_connection()
        latency_ms = (time.monotonic() - t0) * 1000
        return success, message, latency_ms
    except ConnectorError as e:
        latency_ms = (time.monotonic() - t0) * 1000
        return False, str(e), latency_ms


def sync_catalog(db: Session, ds: DataSource) -> List[DataCatalogEntry]:
    """Discover tables from source and upsert catalog entries."""
    from datetime import datetime, timezone

    params = json.loads(ds.connection_params)
    try:
        connector = get_connector(ds.source_type, params)
        tables = connector.list_tables()
    except ConnectorError as e:
        ds.status = DataSourceStatus.error
        ds.last_error = str(e)
        db.commit()
        raise

    entries = []
    for table_info in tables:
        existing = (
            db.query(DataCatalogEntry)
            .filter(
                DataCatalogEntry.data_source_id == ds.id,
                DataCatalogEntry.table_name == table_info.table_name,
                DataCatalogEntry.schema_name == table_info.schema_name,
            )
            .first()
        )
        col_meta = json.dumps(table_info.columns) if table_info.columns else None
        if existing:
            existing.column_count = len(table_info.columns) if table_info.columns else None
            existing.row_estimate = table_info.row_estimate
            existing.column_metadata = col_meta
            entry = existing
        else:
            entry = DataCatalogEntry(
                organization_id=ds.organization_id,
                data_source_id=ds.id,
                schema_name=table_info.schema_name,
                table_name=table_info.table_name,
                column_count=len(table_info.columns) if table_info.columns else None,
                row_estimate=table_info.row_estimate,
                column_metadata=col_meta,
            )
            db.add(entry)
        entries.append(entry)

    ds.last_synced_at = datetime.now(timezone.utc)
    ds.last_error = None
    ds.status = DataSourceStatus.active
    db.commit()
    for e in entries:
        db.refresh(e)
    return entries
