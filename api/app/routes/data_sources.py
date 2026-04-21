import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_session
from app.auth import get_any_org_member_context, get_owner_or_admin_context, OrgContext
from app.schemas import (
    DataSourceCreate,
    DataSourceUpdate,
    DataSourceResponse,
    DataSourceTestResult,
    DataCatalogEntryResponse,
    CatalogImportRequest,
    DatasetVersionResponse,
    DatasetResponse,
)
from app.services import data_source_service as svc
from app.services import data_catalog_service as catalog_svc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data-sources", tags=["data-sources"])


# ---------------------------------------------------------------------------
# Data Sources CRUD
# ---------------------------------------------------------------------------


@router.get("", response_model=List[DataSourceResponse])
def list_data_sources(
    db: Session = Depends(get_session),
    ctx: OrgContext = Depends(get_any_org_member_context),
):
    return svc.list_data_sources(db, ctx.organization_id)


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
def create_data_source(
    payload: DataSourceCreate,
    db: Session = Depends(get_session),
    ctx: OrgContext = Depends(get_owner_or_admin_context),
):
    return svc.create_data_source(db, ctx.organization_id, ctx.user.id, payload)


@router.get("/{source_id}", response_model=DataSourceResponse)
def get_data_source(
    source_id: str,
    db: Session = Depends(get_session),
    ctx: OrgContext = Depends(get_any_org_member_context),
):
    ds = svc.get_data_source(db, ctx.organization_id, source_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    return ds


@router.patch("/{source_id}", response_model=DataSourceResponse)
def update_data_source(
    source_id: str,
    payload: DataSourceUpdate,
    db: Session = Depends(get_session),
    ctx: OrgContext = Depends(get_owner_or_admin_context),
):
    ds = svc.get_data_source(db, ctx.organization_id, source_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    return svc.update_data_source(db, ds, payload)


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_data_source(
    source_id: str,
    db: Session = Depends(get_session),
    ctx: OrgContext = Depends(get_owner_or_admin_context),
):
    ds = svc.get_data_source(db, ctx.organization_id, source_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    svc.delete_data_source(db, ds)


# ---------------------------------------------------------------------------
# Connection testing and catalog sync
# ---------------------------------------------------------------------------


@router.post("/{source_id}/test", response_model=DataSourceTestResult)
def test_connection(
    source_id: str,
    db: Session = Depends(get_session),
    ctx: OrgContext = Depends(get_any_org_member_context),
):
    ds = svc.get_data_source(db, ctx.organization_id, source_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    success, message, latency = svc.test_connection(ds)
    return DataSourceTestResult(success=success, message=message, latency_ms=latency)


@router.post("/{source_id}/sync", response_model=List[DataCatalogEntryResponse])
def sync_catalog(
    source_id: str,
    db: Session = Depends(get_session),
    ctx: OrgContext = Depends(get_owner_or_admin_context),
):
    ds = svc.get_data_source(db, ctx.organization_id, source_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    from app.services.connectors import ConnectorError
    try:
        entries = svc.sync_catalog(db, ds)
    except ConnectorError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    return [_serialize_catalog_entry(e) for e in entries]


# ---------------------------------------------------------------------------
# Catalog browsing
# ---------------------------------------------------------------------------


@router.get("/{source_id}/catalog", response_model=List[DataCatalogEntryResponse])
def list_catalog(
    source_id: str,
    db: Session = Depends(get_session),
    ctx: OrgContext = Depends(get_any_org_member_context),
):
    ds = svc.get_data_source(db, ctx.organization_id, source_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    entries = catalog_svc.get_catalog_entries(db, ctx.organization_id, source_id)
    return [_serialize_catalog_entry(e) for e in entries]


@router.post("/{source_id}/catalog/import")
def import_catalog_entry(
    source_id: str,
    payload: CatalogImportRequest,
    db: Session = Depends(get_session),
    ctx: OrgContext = Depends(get_owner_or_admin_context),
):
    """Fetch source table data → persist as Dataset + DatasetVersion for rule execution."""
    ds = svc.get_data_source(db, ctx.organization_id, source_id)
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    entry = catalog_svc.get_catalog_entry(db, ctx.organization_id, payload.catalog_entry_id)
    if not entry or entry.data_source_id != source_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog entry not found")
    dataset, version = catalog_svc.import_catalog_entry_as_dataset(
        db, entry, ctx.user, dataset_name=payload.dataset_name, row_limit=payload.row_limit
    )
    return {
        "dataset_id": dataset.id,
        "dataset_version_id": version.id,
        "dataset_name": dataset.name,
        "rows": version.rows,
        "columns": version.columns,
    }


# ---------------------------------------------------------------------------
# Global catalog (all sources)
# ---------------------------------------------------------------------------


@router.get("/catalog/all", response_model=List[DataCatalogEntryResponse])
def list_all_catalog(
    db: Session = Depends(get_session),
    ctx: OrgContext = Depends(get_any_org_member_context),
):
    entries = catalog_svc.get_catalog_entries(db, ctx.organization_id)
    return [_serialize_catalog_entry(e) for e in entries]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_catalog_entry(entry) -> DataCatalogEntryResponse:
    import json
    col_meta = None
    if entry.column_metadata:
        raw = json.loads(entry.column_metadata)
        col_meta = raw if isinstance(raw, list) else None
    tags = json.loads(entry.tags) if entry.tags else None
    return DataCatalogEntryResponse(
        id=entry.id,
        organization_id=entry.organization_id,
        data_source_id=entry.data_source_id,
        schema_name=entry.schema_name,
        table_name=entry.table_name,
        column_count=entry.column_count,
        row_estimate=entry.row_estimate,
        column_metadata=col_meta,
        tags=tags,
        description=entry.description,
        discovered_at=entry.discovered_at,
        updated_at=entry.updated_at,
    )
