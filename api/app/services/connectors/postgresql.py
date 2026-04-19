"""PostgreSQL connector using psycopg2."""
from typing import List, Optional
import pandas as pd

from app.services.connectors.base import BaseConnector, ConnectorError, TableInfo


class PostgreSQLConnector(BaseConnector):
    """Connects to PostgreSQL. Requires psycopg2-binary."""

    def _connect(self):
        try:
            import psycopg2
        except ImportError:
            raise ConnectorError("psycopg2-binary is required for PostgreSQL connections")
        p = self.params
        return psycopg2.connect(
            host=p.get("host", "localhost"),
            port=int(p.get("port", 5432)),
            dbname=p.get("database", ""),
            user=p.get("username", ""),
            password=p.get("password", ""),
            connect_timeout=10,
        )

    def test_connection(self) -> tuple[bool, str]:
        try:
            conn = self._connect()
            conn.close()
            return True, "PostgreSQL connection successful"
        except Exception as e:
            return False, str(e)

    def list_tables(self) -> List[TableInfo]:
        conn = self._connect()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT table_schema, table_name
                FROM information_schema.tables
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_schema, table_name
            """)
            tables = []
            for schema, table in cur.fetchall():
                cols = self._get_columns(cur, schema, table)
                row_est = self._estimate_rows(cur, schema, table)
                tables.append(TableInfo(schema=schema, table=table, columns=cols, row_estimate=row_est))
            return tables
        finally:
            conn.close()

    def _get_columns(self, cur, schema: str, table: str) -> List[dict]:
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (schema, table))
        return [{"name": r[0], "type": r[1], "nullable": r[2] == "YES"} for r in cur.fetchall()]

    def _estimate_rows(self, cur, schema: str, table: str) -> Optional[int]:
        try:
            cur.execute("""
                SELECT reltuples::bigint
                FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = %s AND c.relname = %s
            """, (schema, table))
            row = cur.fetchone()
            return row[0] if row else None
        except Exception:
            return None

    def fetch_table(self, schema: Optional[str], table: str, limit: Optional[int] = None) -> pd.DataFrame:
        conn = self._connect()
        try:
            qualified = f'"{schema}"."{table}"' if schema else f'"{table}"'
            query = f"SELECT * FROM {qualified}"
            if limit is not None:
                query += f" LIMIT {int(limit)}"
            df = pd.read_sql_query(query, conn)
            return df
        finally:
            conn.close()

    def get_row_count(self, schema: Optional[str], table: str) -> int:
        conn = self._connect()
        try:
            cur = conn.cursor()
            qualified = f'"{schema}"."{table}"' if schema else f'"{table}"'
            cur.execute(f"SELECT COUNT(*) FROM {qualified}")
            return cur.fetchone()[0]
        finally:
            conn.close()
