"""
Local SQLite-backed simulator for development and testing.
Ships sample datasets (customers, orders, products) that exercise rule execution
without requiring any external credentials.
"""
import sqlite3
import os
import tempfile
import pandas as pd
from typing import List, Optional

from app.services.connectors.base import BaseConnector, ConnectorError, TableInfo

_SAMPLE_DATA = {
    "customers": {
        "columns": [
            {"name": "id", "type": "INTEGER", "nullable": False},
            {"name": "name", "type": "TEXT", "nullable": False},
            {"name": "email", "type": "TEXT", "nullable": True},
            {"name": "phone", "type": "TEXT", "nullable": True},
            {"name": "country", "type": "TEXT", "nullable": True},
            {"name": "age", "type": "INTEGER", "nullable": True},
            {"name": "signup_date", "type": "TEXT", "nullable": True},
        ],
        "rows": [
            (1, "Alice Johnson", "alice@example.com", "+1-800-555-0101", "US", 34, "2023-01-15"),
            (2, "Bob Smith", "bob@example.com", "555-0102", "US", 28, "2023-02-20"),
            (3, "Carol White", None, "+44-20-1234-5678", "GB", 45, "2023-03-10"),
            (4, "David Brown", "david@example.com", "+1-800-555-0104", "US", None, "2023-04-05"),
            (5, "Eva Green", "eva.green@example.com", "+33-1-23-45-67-89", "FR", 31, "2023-05-12"),
            (6, "Frank Miller", "frank@EXAMPLE.COM", "800-555-0106", "US", 52, "2023-06-01"),
            (7, "Grace Lee", "grace@example.com", None, "KR", 27, "2023-07-22"),
            (8, "Henry Wilson", "henry@example.com", "+1-800-555-0108", "US", 39, "2023-08-14"),
            (9, "Isabella Clark", None, "+39-06-1234-5678", "IT", 23, None),
            (10, "James Davis", "james@example.com", "+1-800-555-0110", "US", 150, "2023-10-01"),
        ],
    },
    "orders": {
        "columns": [
            {"name": "order_id", "type": "INTEGER", "nullable": False},
            {"name": "customer_id", "type": "INTEGER", "nullable": False},
            {"name": "product", "type": "TEXT", "nullable": False},
            {"name": "amount", "type": "REAL", "nullable": True},
            {"name": "status", "type": "TEXT", "nullable": True},
            {"name": "order_date", "type": "TEXT", "nullable": True},
        ],
        "rows": [
            (101, 1, "Widget A", 29.99, "shipped", "2024-01-10"),
            (102, 2, "Widget B", -5.00, "pending", "2024-01-12"),
            (103, 1, "Gadget X", 149.99, "delivered", "2024-01-15"),
            (104, 3, "Widget A", 29.99, "SHIPPED", "2024-01-18"),
            (105, 4, "Gadget Y", None, "cancelled", "2024-01-20"),
            (106, 5, "Widget C", 49.99, "shipped", "2024-01-22"),
            (107, 6, "Gadget X", 149.99, "delivered", "2024-01-25"),
            (108, 7, "Widget A", 29.99, "pending", "2024-02-01"),
            (109, 8, "Gadget Z", 199.99, "shipped", "2024-02-03"),
            (110, 9, "Widget B", 39.99, "Delivered", "2024-02-05"),
            (111, 10, "Gadget Y", 99.99, "shipped", "2024-02-08"),
            (112, 1, "Widget C", 49.99, "delivered", "2024-02-10"),
        ],
    },
    "products": {
        "columns": [
            {"name": "product_id", "type": "INTEGER", "nullable": False},
            {"name": "name", "type": "TEXT", "nullable": False},
            {"name": "category", "type": "TEXT", "nullable": True},
            {"name": "price", "type": "REAL", "nullable": True},
            {"name": "stock", "type": "INTEGER", "nullable": True},
            {"name": "sku", "type": "TEXT", "nullable": True},
        ],
        "rows": [
            (1, "Widget A", "widgets", 29.99, 500, "WGT-A-001"),
            (2, "Widget B", "widgets", 39.99, 350, "WGT-B-002"),
            (3, "Widget C", "widgets", 49.99, 200, None),
            (4, "Gadget X", "gadgets", 149.99, 75, "GDG-X-004"),
            (5, "Gadget Y", "gadgets", 99.99, 120, "GDG-Y-005"),
            (6, "Gadget Z", "gadgets", 199.99, 40, "GDG-Z-006"),
            (7, "Thingamajig", None, 0.0, -5, "TMJ-007"),
        ],
    },
}

_DB_PATH = os.path.join(tempfile.gettempdir(), "grime_local_simulator.db")


def _ensure_db():
    conn = sqlite3.connect(_DB_PATH)
    cur = conn.cursor()
    for table_name, spec in _SAMPLE_DATA.items():
        col_defs = ", ".join(
            f"{c['name']} {c['type']}{'' if c['nullable'] else ' NOT NULL'}"
            for c in spec["columns"]
        )
        cur.execute(f"CREATE TABLE IF NOT EXISTS {table_name} ({col_defs})")
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        if cur.fetchone()[0] == 0:
            placeholders = ", ".join("?" * len(spec["columns"]))
            cur.executemany(f"INSERT INTO {table_name} VALUES ({placeholders})", spec["rows"])
    conn.commit()
    conn.close()


class LocalSimulatorConnector(BaseConnector):
    """SQLite-backed local data source with sample data for testing."""

    def test_connection(self) -> tuple[bool, str]:
        try:
            _ensure_db()
            conn = sqlite3.connect(_DB_PATH)
            conn.execute("SELECT 1")
            conn.close()
            return True, f"Connected to local simulator. DB: {_DB_PATH}"
        except Exception as e:
            return False, str(e)

    def list_tables(self) -> List[TableInfo]:
        _ensure_db()
        tables = []
        for table_name, spec in _SAMPLE_DATA.items():
            tables.append(TableInfo(
                schema=None,
                table=table_name,
                columns=spec["columns"],
                row_estimate=len(spec["rows"]),
            ))
        return tables

    def fetch_table(self, schema: Optional[str], table: str, limit: Optional[int] = None) -> pd.DataFrame:
        if table not in _SAMPLE_DATA:
            raise ConnectorError(f"Table '{table}' not found in local simulator")
        _ensure_db()
        conn = sqlite3.connect(_DB_PATH)
        query = f"SELECT * FROM {table}"
        if limit is not None:
            query += f" LIMIT {int(limit)}"
        df = pd.read_sql_query(query, conn)
        conn.close()
        return df

    def get_row_count(self, schema: Optional[str], table: str) -> int:
        if table not in _SAMPLE_DATA:
            raise ConnectorError(f"Table '{table}' not found in local simulator")
        _ensure_db()
        conn = sqlite3.connect(_DB_PATH)
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        conn.close()
        return count
