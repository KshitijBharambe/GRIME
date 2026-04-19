from app.services.connectors.base import BaseConnector, ConnectorError
from app.services.connectors.local_simulator import LocalSimulatorConnector
from app.services.connectors.postgresql import PostgreSQLConnector
from app.models import DataSourceType


def get_connector(source_type: DataSourceType, connection_params: dict) -> BaseConnector:
    mapping = {
        DataSourceType.local_simulator: LocalSimulatorConnector,
        DataSourceType.postgresql: PostgreSQLConnector,
    }
    cls = mapping.get(source_type)
    if cls is None:
        raise ConnectorError(f"Connector not implemented for source type: {source_type.value}")
    return cls(connection_params)


__all__ = ["get_connector", "BaseConnector", "ConnectorError"]
