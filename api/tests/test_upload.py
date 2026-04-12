import pytest
from fastapi.testclient import TestClient
from app.main import app  # Assuming your FastAPI app is in app.main
from unittest.mock import MagicMock, patch
import io

client = TestClient(app)

@pytest.fixture
def mock_db_session():
    """Pytest fixture to mock the database session."""
    with patch("app.database.get_session") as mock_get_session:
        mock_session = MagicMock()
        mock_get_session.return_value = mock_session
        yield mock_session

@pytest.fixture
def mock_user():
    """Pytest fixture to mock the authenticated user."""
    user = MagicMock()
    user.id = "test_user_id"
    return user

@patch("app.auth.get_any_authenticated_user")
def test_upload_valid_file(mock_get_user, mock_db_session):
    """Test uploading a valid CSV file."""
    mock_get_user.return_value = mock_user()

    file_content = b"col1,col2\nval1,val2"
    file = io.BytesIO(file_content)
    file.name = "test.csv"

    response = client.post(
        "/data/upload/file",
        files={"file": (file.name, file, "text/csv")},
        data={"dataset_name": "Test Dataset"}
    )

    assert response.status_code == 200
    assert response.json()["message"] == "File uploaded and processed successfully"

@patch("app.auth.get_any_authenticated_user")
def test_upload_invalid_extension(mock_get_user, mock_db_session):
    """Test uploading a file with an invalid extension."""
    mock_get_user.return_value = mock_user()

    file_content = b"<script>alert('XSS')</script>"
    file = io.BytesIO(file_content)
    file.name = "malicious.html"

    response = client.post(
        "/data/upload/file",
        files={"file": (file.name, file, "text/html")},
        data={"dataset_name": "Test Dataset"}
    )

    assert response.status_code == 400
    assert "File type not supported" in response.json()["detail"]

@patch("app.auth.get_any_authenticated_user")
def test_upload_double_extension(mock_get_user, mock_db_session):
    """Test uploading a file with a double extension."""
    mock_get_user.return_value = mock_user()

    file_content = b"col1,col2\nval1,val2"
    file = io.BytesIO(file_content)
    file.name = "test.sh.csv"

    response = client.post(
        "/data/upload/file",
        files={"file": (file.name, file, "text/csv")},
        data={"dataset_name": "Test Dataset"}
    )

    assert response.status_code == 400
    assert "filename is insecure" in response.json()["detail"]

@patch("app.auth.get_any_authenticated_user")
def test_upload_mismatched_mime_type(mock_get_user, mock_db_session):
    """Test uploading a file with a mismatched MIME type."""
    mock_get_user.return_value = mock_user()

    file_content = b"<script>alert('XSS')</script>"
    file = io.BytesIO(file_content)
    file.name = "test.csv"

    response = client.post(
        "/data/upload/file",
        files={"file": (file.name, file, "text/html")},
        data={"dataset_name": "Test Dataset"}
    )

    assert response.status_code == 400
    assert "File type not supported" in response.json()["detail"]

@patch("app.auth.get_any_authenticated_user")
def test_upload_malicious_filename(mock_get_user, mock_db_session):
    """Test uploading a file with a malicious filename."""
    mock_get_user.return_value = mock_user()

    file_content = b"col1,col2\nval1,val2"
    file = io.BytesIO(file_content)
    file.name = "../../etc/passwd"

    response = client.post(
        "/data/upload/file",
        files={"file": (file.name, file, "text/plain")},
        data={"dataset_name": "Test Dataset"}
    )

    assert response.status_code == 400
    assert "filename is insecure" in response.json()["detail"]
