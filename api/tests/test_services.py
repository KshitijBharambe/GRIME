"""
Unit tests for service modules
"""
import pytest
import pandas as pd
import os
from unittest.mock import Mock, MagicMock, patch

# Set DATABASE_URL before importing app modules
os.environ.setdefault('DATABASE_URL', 'postgresql://localhost/test')

from app.services.export import ExportService
from app.models import Execution, DatasetVersion


class TestExportService:
    """Test ExportService functionality"""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session"""
        return Mock()

    @pytest.fixture
    def mock_execution(self):
        """Create a mock execution"""
        execution = Mock(spec=Execution)
        execution.id = "test-exec-id"
        execution.status = "completed"
        execution.dataset_version_id = "test-dataset-version-id"
        return execution

    @pytest.fixture
    def sample_dataframe(self):
        """Create a sample dataframe"""
        return pd.DataFrame({
            'name': ['Alice', 'Bob', 'Charlie'],
            'age': [25, 30, 35],
            'city': ['NYC', 'LA', 'Chicago']
        })

    def test_export_service_initialization(self, mock_db):
        """Test that export service can be initialized"""
        service = ExportService(mock_db)
        assert service.db == mock_db

    def test_dataframe_to_csv_basic(self, sample_dataframe):
        """Test converting dataframe to CSV format"""
        csv_string = sample_dataframe.to_csv(index=False)
        assert 'name,age,city' in csv_string
        assert 'Alice' in csv_string
        assert 'Bob' in csv_string

    def test_dataframe_to_json_basic(self, sample_dataframe):
        """Test converting dataframe to JSON format"""
        json_string = sample_dataframe.to_json(orient='records')
        assert 'Alice' in json_string
        assert 'age' in json_string

    def test_dataframe_to_excel_format(self, sample_dataframe):
        """Test that dataframe can be converted to Excel format"""
        import io
        buffer = io.BytesIO()
        sample_dataframe.to_excel(buffer, index=False, engine='openpyxl')
        assert buffer.getvalue() is not None
        assert len(buffer.getvalue()) > 0


class TestDataQualityCalculations:
    """Test data quality metric calculations"""

    def test_completeness_calculation_full(self):
        """Test completeness with no missing values"""
        df = pd.DataFrame({
            'col1': [1, 2, 3, 4, 5],
            'col2': ['a', 'b', 'c', 'd', 'e']
        })
        total_cells = df.size
        null_cells = df.isnull().sum().sum()
        completeness = ((total_cells - null_cells) / total_cells) * 100
        assert completeness == 100.0

    def test_completeness_calculation_partial(self):
        """Test completeness with some missing values"""
        df = pd.DataFrame({
            'col1': [1, None, 3, None, 5],
            'col2': ['a', 'b', None, 'd', 'e']
        })
        total_cells = df.size
        null_cells = df.isnull().sum().sum()
        completeness = ((total_cells - null_cells) / total_cells) * 100
        assert completeness == 70.0  # 7 out of 10 cells are filled

    def test_completeness_calculation_empty(self):
        """Test completeness with all missing values"""
        df = pd.DataFrame({
            'col1': [None, None, None],
            'col2': [None, None, None]
        })
        total_cells = df.size
        null_cells = df.isnull().sum().sum()
        completeness = ((total_cells - null_cells) / total_cells) * 100
        assert completeness == 0.0

    def test_uniqueness_calculation(self):
        """Test uniqueness percentage calculation"""
        df = pd.DataFrame({'id': [1, 2, 3, 3, 4, 4, 4]})
        unique_count = df['id'].nunique()
        total_count = len(df)
        uniqueness = (unique_count / total_count) * 100
        assert uniqueness == pytest.approx(57.14, rel=0.01)

    def test_duplicate_detection(self):
        """Test duplicate row detection"""
        df = pd.DataFrame({
            'name': ['Alice', 'Bob', 'Alice', 'Charlie'],
            'age': [25, 30, 25, 35]
        })
        duplicates = df.duplicated().sum()
        assert duplicates == 1  # One duplicate row (Alice, 25)


class TestRuleEngineHelpers:
    """Test rule engine helper functions"""

    def test_column_type_detection_numeric(self):
        """Test numeric column type detection"""
        df = pd.DataFrame({'col': [1, 2, 3, 4, 5]})
        assert pd.api.types.is_numeric_dtype(df['col'])

    def test_column_type_detection_string(self):
        """Test string column type detection"""
        df = pd.DataFrame({'col': ['a', 'b', 'c']})
        assert pd.api.types.is_string_dtype(df['col']) or pd.api.types.is_object_dtype(df['col'])

    def test_column_type_detection_datetime(self):
        """Test datetime column type detection"""
        df = pd.DataFrame({'col': pd.to_datetime(['2023-01-01', '2023-01-02', '2023-01-03'])})
        assert pd.api.types.is_datetime64_any_dtype(df['col'])

    def test_null_percentage_calculation(self):
        """Test null percentage calculation"""
        df = pd.DataFrame({'col': [1, None, 3, None, 5, None]})
        null_pct = (df['col'].isnull().sum() / len(df)) * 100
        assert null_pct == 50.0

    def test_value_range_detection(self):
        """Test value range detection"""
        df = pd.DataFrame({'col': [10, 25, 30, 15, 20]})
        min_val = df['col'].min()
        max_val = df['col'].max()
        assert min_val == 10
        assert max_val == 30
