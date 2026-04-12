#!/bin/bash

# Test endpoints for quality reports and export pages
# This script bypasses authentication to test the core functionality

DATASET_ID="8a2ea300-7678-42b5-ba94-d6cedc26bb5e"
API_URL="http://localhost:8000"

echo "=== Testing Report Endpoints ==="
echo ""

# Test 1: GET /reports/datasets/{dataset_id}/quality-summary
echo "1. Testing GET /reports/datasets/${DATASET_ID}/quality-summary"
docker-compose exec -T api python -c "
import sys
sys.path.insert(0, '/app')
from app.database import get_session
from app.services.data_quality import DataQualityService
import json

db = next(get_session())
try:
    service = DataQualityService(db)
    result = service.create_data_quality_summary('${DATASET_ID}')
    print(json.dumps(result, indent=2, default=str))
except Exception as e:
    print(f'ERROR: {type(e).__name__}: {str(e)}')
    import traceback
    traceback.print_exc()
"
echo ""
echo "---"
echo ""

# Test 2: GET /reports/datasets/{dataset_id}/export-history
echo "2. Testing GET /reports/datasets/${DATASET_ID}/export-history"
docker-compose exec -T api python -c "
import sys
sys.path.insert(0, '/app')
from app.database import get_session
from app.services.export import ExportService
import json

db = next(get_session())
try:
    service = ExportService(db)
    result = service.get_export_history('${DATASET_ID}')
    print(json.dumps(result, indent=2, default=str))
except Exception as e:
    print(f'ERROR: {type(e).__name__}: {str(e)}')
    import traceback
    traceback.print_exc()
"
echo ""
echo "---"
echo ""

# Test 3: GET /reports/analytics/issue-patterns
echo "3. Testing analytics/issue-patterns logic"
docker-compose exec -T api python -c "
import sys
sys.path.insert(0, '/app')
from app.database import get_session
from app.models import Issue
import json

db = next(get_session())
try:
    issues = db.query(Issue).all()
    print(f'Total issues found: {len(issues)}')
    if issues:
        print(f'Sample issue: {issues[0].id} - {issues[0].message}')
except Exception as e:
    print(f'ERROR: {type(e).__name__}: {str(e)}')
    import traceback
    traceback.print_exc()
"
echo ""
echo "---"
echo ""

# Test 4: POST /reports/datasets/{dataset_id}/export (CSV format)
echo "4. Testing export dataset functionality"
docker-compose exec -T api python -c "
import sys
sys.path.insert(0, '/app')
from app.database import get_session
from app.services.export import ExportService
from app.models import ExportFormat, DatasetVersion
import json

db = next(get_session())
try:
    # Get latest version
    latest_version = (
        db.query(DatasetVersion)
        .filter(DatasetVersion.dataset_id == '${DATASET_ID}')
        .order_by(DatasetVersion.version_no.desc())
        .first()
    )

    if latest_version:
        print(f'Found version: {latest_version.id} (v{latest_version.version_no})')
        service = ExportService(db)
        export_id, file_path = service.export_dataset(
            dataset_version_id=latest_version.id,
            export_format=ExportFormat.csv,
            user_id='a1002979-69db-47f4-9c68-91828f2ab81b',
            include_metadata=True,
            include_issues=False
        )
        print(f'Export successful: {export_id}')
        print(f'File path: {file_path}')
    else:
        print('No dataset version found')
except Exception as e:
    print(f'ERROR: {type(e).__name__}: {str(e)}')
    import traceback
    traceback.print_exc()
"
echo ""
echo "---"
echo ""

# Test 5: POST /reports/datasets/{dataset_id}/quality-report
echo "5. Testing quality report generation"
docker-compose exec -T api python -c "
import sys
sys.path.insert(0, '/app')
from app.database import get_session
from app.services.export import ExportService
import json

db = next(get_session())
try:
    service = ExportService(db)
    export_id, file_path = service.export_data_quality_report(
        dataset_id='${DATASET_ID}',
        user_id='a1002979-69db-47f4-9c68-91828f2ab81b',
        include_charts=False
    )
    print(f'Report generated successfully: {export_id}')
    print(f'File path: {file_path}')
except Exception as e:
    print(f'ERROR: {type(e).__name__}: {str(e)}')
    import traceback
    traceback.print_exc()
"

echo ""
echo "=== Testing Complete ==="
