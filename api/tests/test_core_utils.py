"""
Simple unit tests for core utility functions
"""
import pytest


def test_sanitize_string():
    """Test string sanitization logic"""
    from app.utils.sanitization import sanitize_input

    # Test basic string
    result = sanitize_input("hello world")
    assert result == "hello world"

    # Test with control characters
    result = sanitize_input("test\x00string")
    assert "\x00" not in result
    assert "test" in result
    assert "string" in result


def test_sanitize_dict():
    """Test dictionary sanitization"""
    from app.utils.sanitization import sanitize_input

    input_data = {"key": "value", "number": 123}
    result = sanitize_input(input_data)
    assert result["key"] == "value"
    assert result["number"] == 123


def test_sanitize_list():
    """Test list sanitization"""
    from app.utils.sanitization import sanitize_input

    input_list = ["item1", "item2", "item3"]
    result = sanitize_input(input_list)
    assert len(result) == 3
    assert result[0] == "item1"


def test_sanitize_identifier():
    """Test identifier sanitization"""
    from app.utils.sanitization import sanitize_identifier

    # Valid identifier
    result = sanitize_identifier("valid_id_123")
    assert result == "valid_id_123"

    # Identifier with invalid chars
    result = sanitize_identifier("id@#$%123")
    assert "@" not in result
    assert "#" not in result


def test_max_length_enforcement():
    """Test maximum length enforcement"""
    from app.utils.sanitization import ensure_max_length

    long_string = "a" * 15000
    result = ensure_max_length(long_string, 100)
    assert len(result) == 100


def test_log_levels():
    """Test that log levels are defined"""
    from app.utils.logging_service import LogLevel

    assert LogLevel.DEBUG.value == "DEBUG"
    assert LogLevel.INFO.value == "INFO"
    assert LogLevel.WARNING.value == "WARNING"
    assert LogLevel.ERROR.value == "ERROR"


def test_execution_phases():
    """Test that execution phases are defined"""
    from app.utils.logging_service import ExecutionPhase

    assert ExecutionPhase.INITIALIZATION.value == "INITIALIZATION"
    assert ExecutionPhase.VALIDATION.value == "VALIDATION"
    assert ExecutionPhase.PROCESSING.value == "PROCESSING"
    assert ExecutionPhase.COMPLETION.value == "COMPLETION"


def test_dataframe_operations():
    """Test pandas dataframe operations used in the app"""
    import pandas as pd

    # Create sample dataframe
    df = pd.DataFrame({
        'name': ['Alice', 'Bob', 'Charlie'],
        'age': [25, 30, 35],
        'city': ['NYC', 'LA', 'Chicago']
    })

    # Test basic operations
    assert len(df) == 3
    assert 'name' in df.columns
    assert df['age'].mean() == 30


def test_dataframe_null_handling():
    """Test null value handling in dataframes"""
    import pandas as pd

    df = pd.DataFrame({
        'col1': [1, None, 3],
        'col2': ['a', 'b', None]
    })

    # Count nulls
    null_count = df.isnull().sum().sum()
    assert null_count == 2

    # Calculate completeness
    total_cells = df.size
    completeness = ((total_cells - null_count) / total_cells) * 100
    assert completeness == pytest.approx(66.67, rel=0.01)


def test_dataframe_csv_export():
    """Test CSV export functionality"""
    import pandas as pd

    df = pd.DataFrame({
        'name': ['Alice', 'Bob'],
        'score': [95, 87]
    })

    csv_string = df.to_csv(index=False)
    assert 'name,score' in csv_string
    assert 'Alice' in csv_string


def test_dataframe_json_export():
    """Test JSON export functionality"""
    import pandas as pd

    df = pd.DataFrame({
        'name': ['Alice'],
        'age': [25]
    })

    json_string = df.to_json(orient='records')
    assert 'Alice' in json_string
    assert '25' in json_string


def test_unique_value_detection():
    """Test unique value counting"""
    import pandas as pd

    df = pd.DataFrame({
        'id': [1, 2, 3, 3, 4, 4, 4]
    })

    unique_count = df['id'].nunique()
    assert unique_count == 4


def test_duplicate_detection():
    """Test duplicate row detection"""
    import pandas as pd

    df = pd.DataFrame({
        'name': ['Alice', 'Bob', 'Alice'],
        'age': [25, 30, 25]
    })

    duplicates = df.duplicated().sum()
    assert duplicates == 1


def test_numeric_type_detection():
    """Test numeric column type detection"""
    import pandas as pd

    df = pd.DataFrame({'numbers': [1, 2, 3, 4, 5]})
    assert pd.api.types.is_numeric_dtype(df['numbers'])


def test_string_type_detection():
    """Test string column type detection"""
    import pandas as pd

    df = pd.DataFrame({'strings': ['a', 'b', 'c']})
    assert pd.api.types.is_object_dtype(df['strings']) or pd.api.types.is_string_dtype(df['strings'])


def test_value_range_calculation():
    """Test min/max value calculation"""
    import pandas as pd

    df = pd.DataFrame({'values': [10, 25, 30, 15, 20]})
    assert df['values'].min() == 10
    assert df['values'].max() == 30
    assert df['values'].mean() == 20
