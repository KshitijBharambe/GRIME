"""
Test script to verify quality metrics computation
"""
import os
os.environ['DATABASE_URL'] = 'postgresql+psycopg://postgres:postgres@localhost:5432/data_hygiene'

from app.database import get_session
from app.services.data_quality import DataQualityService
from app.models import Execution

def test_quality_metrics():
    # Get a database session
    db = next(get_session())

    try:
        # Get the first execution
        execution = db.query(Execution).first()

        if not execution:
            print("No executions found in database")
            return

        print(f"Testing metrics for execution: {execution.id}")
        print(f"Dataset version: {execution.dataset_version_id}")
        print(f"Status: {execution.status}")
        print(f"Started at: {execution.started_at}")
        print()

        # Compute quality metrics
        service = DataQualityService(db)
        metrics = service.compute_quality_metrics(execution.id)

        print("Quality Metrics:")
        print(f"  DQI: {metrics.dqi}")
        print(f"  Clean Rows %: {metrics.clean_rows_pct}")
        print(f"  Hybrid: {metrics.hybrid}")
        print(f"  Status: {metrics.status}")
        print(f"  Message: {metrics.message}")
        print(f"  Computed at: {metrics.computed_at}")
        print()

        # Test caching - call again
        print("Testing cache (calling again)...")
        metrics2 = service.compute_quality_metrics(execution.id)
        print(f"  Same results: DQI={metrics2.dqi}, Clean Rows %={metrics2.clean_rows_pct}, Hybrid={metrics2.hybrid}")
        print()

        # Test a few more executions
        all_executions = db.query(Execution).limit(5).all()
        print(f"Testing {len(all_executions)} executions:")
        for exec in all_executions:
            try:
                m = service.compute_quality_metrics(exec.id)
                print(f"  Exec {exec.id[:8]}: DQI={m.dqi:.1f}, Clean={m.clean_rows_pct:.1f}, Hybrid={m.hybrid:.1f}, Status={m.status}")
            except Exception as e:
                print(f"  Exec {exec.id[:8]}: ERROR - {str(e)}")

    finally:
        db.close()

if __name__ == "__main__":
    test_quality_metrics()
