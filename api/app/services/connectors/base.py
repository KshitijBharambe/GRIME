from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import pandas as pd


class ConnectorError(Exception):
    pass


class TableInfo:
    def __init__(self, schema: Optional[str], table: str, columns: List[Dict[str, Any]], row_estimate: Optional[int] = None):
        self.schema_name = schema
        self.table_name = table
        self.columns = columns  # list of {name, type, nullable}
        self.row_estimate = row_estimate


class BaseConnector(ABC):
    def __init__(self, connection_params: dict):
        self.params = connection_params

    @abstractmethod
    def test_connection(self) -> tuple[bool, str]:
        """Returns (success, message)."""

    @abstractmethod
    def list_tables(self) -> List[TableInfo]:
        """Discover all tables/views in the source."""

    @abstractmethod
    def fetch_table(self, schema: Optional[str], table: str, limit: Optional[int] = None) -> pd.DataFrame:
        """Fetch table data as a DataFrame."""

    @abstractmethod
    def get_row_count(self, schema: Optional[str], table: str) -> int:
        """Return approximate row count."""
