from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from app.database import get_session
from app.models import (
    User,
    Dataset,
    RuleKind,
    MLModel,
    Execution,
)
from app.auth import (
    get_any_authenticated_user,
    get_admin_user,
    get_any_org_member_context,
    OrgContext,
)
from app.services.rule_templates import RuleTemplateService
from app.services.anomaly_detection import AnomalyDetectionService
from app.utils.debug_tools import get_debug_manager, TestDataGenerator
from app.core.config import ErrorMessages

router = APIRouter(prefix="/advanced", tags=["Advanced Features"])

logger = logging.getLogger(__name__)


# Rule Templates Endpoints


@router.get("/templates")
async def get_rule_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    kind: Optional[RuleKind] = Query(None, description="Filter by rule kind"),
    active_only: bool = Query(True, description="Only active templates"),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Get rule templates with optional filtering"""
    try:
        template_service = RuleTemplateService(db)
        templates = template_service.get_templates(
            category=category, kind=kind, active_only=active_only
        )

        return {
            "templates": [
                {
                    "id": template.id,
                    "name": template.name,
                    "description": template.description,
                    "category": template.category,
                    "kind": template.template_kind.value,
                    "usage_count": template.usage_count or 0,
                    "created_by": template.created_by,
                    "created_at": template.created_at,
                    "updated_at": template.updated_at,
                }
                for template in templates
            ],
            "total": len(templates),
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to get templates [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/templates/{template_id}")
async def get_rule_template(
    template_id: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Get a specific rule template"""
    try:
        template_service = RuleTemplateService(db)
        template = template_service.get_template(template_id)

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
            )

        return {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "category": template.category,
            "kind": template.template_kind.value,
            "template_params": json.loads(template.template_params),
            "usage_count": template.usage_count or 0,
            "created_by": template.created_by,
            "created_at": template.created_at,
            "updated_at": template.updated_at,
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to get template [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.post("/templates")
async def create_rule_template(
    template_data: Dict[str, Any],
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Create a new rule template"""
    try:
        template_service = RuleTemplateService(db)

        # Validate required fields
        required_fields = ["name", "description", "category", "kind", "template_params"]
        for field in required_fields:
            if field not in template_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field: {field}",
                )

        # Convert kind to enum
        try:
            rule_kind = RuleKind(template_data["kind"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid rule kind: {template_data['kind']}",
            )

        template = template_service.create_template(
            name=template_data["name"],
            description=template_data["description"],
            category=template_data["category"],
            template_kind=rule_kind,
            template_params=template_data["template_params"],
            created_by=current_user.id,
        )

        return {
            "id": template.id,
            "name": template.name,
            "message": "Template created successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to create template [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.post("/templates/{template_id}/apply")
async def apply_rule_template(
    template_id: str,
    application_data: Dict[str, Any],
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Apply a template to create a new rule"""
    try:
        template_service = RuleTemplateService(db)

        # Validate required fields
        if "dataset_id" not in application_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: dataset_id",
            )

        rule = template_service.apply_template(
            template_id=template_id,
            dataset_id=application_data["dataset_id"],
            customizations=application_data.get("customizations"),
            rule_name=application_data.get("rule_name"),
            created_by=current_user.id,
        )

        return {
            "rule_id": rule.id,
            "rule_name": rule.name,
            "message": "Template applied successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to apply template [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/datasets/{dataset_id}/suggestions")
async def get_rule_suggestions(
    dataset_id: str,
    max_suggestions: int = Query(10, description="Maximum number of suggestions"),
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """Get rule suggestions for a dataset"""
    try:
        # Check if dataset exists and belongs to org
        dataset = (
            db.query(Dataset)
            .filter(
                Dataset.id == dataset_id,
                Dataset.organization_id == org_context.organization_id,
            )
            .first()
        )
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ErrorMessages.DATASET_NOT_FOUND,
            )

        template_service = RuleTemplateService(db)
        suggestions = template_service.generate_suggestions_for_dataset(
            dataset_id=dataset_id, max_suggestions=max_suggestions
        )

        return {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "suggestions": [
                {
                    "id": suggestion.id,
                    "template_id": suggestion.template_id,
                    "suggested_rule_name": suggestion.suggested_rule_name,
                    "suggested_params": json.loads(suggestion.suggested_params),
                    "confidence_score": suggestion.confidence_score,
                    "suggestion_type": suggestion.suggestion_type,
                    "reasoning": suggestion.reasoning,
                    "is_applied": suggestion.is_applied,
                    "created_at": suggestion.created_at,
                }
                for suggestion in suggestions
            ],
            "total": len(suggestions),
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to get suggestions [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.post("/suggestions/{suggestion_id}/apply")
async def apply_rule_suggestion(
    suggestion_id: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Mark a suggestion as applied"""
    try:
        template_service = RuleTemplateService(db)
        template_service.mark_suggestion_applied(
            suggestion_id=suggestion_id, applied_by=current_user.id
        )

        return {
            "suggestion_id": suggestion_id,
            "message": "Suggestion marked as applied",
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to apply suggestion [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


# ML Models Endpoints


@router.get("/ml-models")
async def get_ml_models(
    active_only: bool = Query(True, description="Only active models"),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Get available ML models"""
    try:
        anomaly_service = AnomalyDetectionService(db)
        models = anomaly_service.get_models(active_only=active_only)

        return {
            "models": [
                {
                    "id": model.id,
                    "name": model.name,
                    "model_type": model.model_type,
                    "version": model.version,
                    "is_active": model.is_active,
                    "training_dataset_id": model.training_dataset_id,
                    "training_metrics": (
                        json.loads(model.training_metrics)
                        if model.training_metrics
                        else {}
                    ),
                    "created_by": model.created_by,
                    "created_at": model.created_at,
                    "updated_at": model.updated_at,
                    "model_metadata": (
                        json.loads(model.model_metadata) if model.model_metadata else {}
                    ),
                }
                for model in models
            ],
            "total": len(models),
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to get ML models [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/ml-models/{model_id}")
async def get_ml_model(
    model_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """Get a specific ML model"""
    try:
        anomaly_service = AnomalyDetectionService(db)
        model = anomaly_service.get_model(model_id)
        # Verify model belongs to user's org
        if model and model.organization_id != org_context.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="ML model not found"
            )

        return {
            "id": model.id,
            "name": model.name,
            "model_type": model.model_type,
            "version": model.version,
            "model_path": model.model_path,
            "model_metadata": (
                json.loads(model.model_metadata) if model.model_metadata else {}
            ),
            "training_dataset_id": model.training_dataset_id,
            "training_metrics": (
                json.loads(model.training_metrics) if model.training_metrics else {}
            ),
            "is_active": model.is_active,
            "created_by": model.created_by,
            "created_at": model.created_at,
            "updated_at": model.updated_at,
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to get ML model [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.post("/ml-models/train")
async def train_ml_model(
    training_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Train a new ML model (background task)"""
    try:
        # Validate required fields
        required_fields = [
            "model_name",
            "model_type",
            "dataset_version_id",
            "feature_columns",
        ]
        for field in required_fields:
            if field not in training_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field: {field}",
                )

        import uuid

        task_id = str(uuid.uuid4())
        background_tasks.add_task(
            train_ml_model_background,
            training_data=training_data,
            user_id=current_user.id,
        )

        return {
            "task_id": task_id,
            "model_name": training_data["model_name"],
            "message": "Model training started in background",
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to start model training [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.patch("/ml-models/{model_id}/status")
async def update_ml_model_status(
    model_id: str,
    status_data: Dict[str, Any],
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Update ML model active status"""
    try:
        if "is_active" not in status_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: is_active",
            )

        model = db.query(MLModel).filter(MLModel.id == model_id).first()
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="ML model not found"
            )

        model.is_active = status_data["is_active"]
        model.updated_at = datetime.now(timezone.utc)
        db.commit()

        return {
            "model_id": model_id,
            "is_active": model.is_active,
            "message": f"ML model {'activated' if model.is_active else 'deactivated'} successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        error_id = str(uuid4())
        logger.error(
            f"Failed to update ML model status [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.delete("/ml-models/{model_id}")
async def delete_ml_model(
    model_id: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_admin_user),  # Admin only
):
    """Delete an ML model"""
    try:
        anomaly_service = AnomalyDetectionService(db)
        anomaly_service.delete_model(model_id)

        return {"model_id": model_id, "message": "ML model deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to delete ML model [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/executions/{execution_id}/anomaly-scores")
async def get_anomaly_scores(
    execution_id: str,
    model_id: Optional[str] = Query(None, description="Filter by model ID"),
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """Get anomaly scores for an execution"""
    try:
        # Verify execution belongs to user's org
        execution = (
            db.query(Execution)
            .filter(
                Execution.id == execution_id,
                Execution.organization_id == org_context.organization_id,
            )
            .first()
        )
        if not execution:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Execution not found",
            )
        anomaly_service = AnomalyDetectionService(db)
        scores = anomaly_service.get_anomaly_scores(
            execution_id=execution_id, model_id=model_id
        )

        return {
            "execution_id": execution_id,
            "model_id": model_id,
            "scores": [
                {
                    "id": score.id,
                    "row_index": score.row_index,
                    "anomaly_score": score.anomaly_score,
                    "features_used": json.loads(score.features_used),
                    "feature_values": json.loads(score.feature_values),
                    "threshold_used": score.threshold_used,
                    "created_at": score.created_at,
                }
                for score in scores
            ],
            "total": len(scores),
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to get anomaly scores [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


# Debug Sessions Endpoints


@router.post("/executions/{execution_id}/debug-sessions")
async def create_debug_session(
    execution_id: str,
    session_data: Dict[str, Any],
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """Create a debug session for an execution"""
    try:
        # Check if execution exists and belongs to org
        execution = (
            db.query(Execution)
            .filter(
                Execution.id == execution_id,
                Execution.organization_id == org_context.organization_id,
            )
            .first()
        )
        if not execution:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Execution not found",
            )
        execution = db.query(Execution).filter(Execution.id == execution_id).first()
        if not execution:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found"
            )

        # Validate required fields
        if "session_name" not in session_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: session_name",
            )

        debug_manager = get_debug_manager(db)
        session = debug_manager.create_debug_session(
            execution_id=execution_id,
            session_name=session_data["session_name"],
            created_by=current_user.id,
        )

        return {
            "session_id": session.id,
            "execution_id": execution_id,
            "session_name": session.session_name,
            "message": "Debug session created successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to create debug session [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/executions/{execution_id}/debug-sessions")
async def get_debug_sessions(
    execution_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """Get all debug sessions for an execution"""
    try:
        # Verify execution belongs to org
        execution = (
            db.query(Execution)
            .filter(
                Execution.id == execution_id,
                Execution.organization_id == org_context.organization_id,
            )
            .first()
        )
        if not execution:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Execution not found",
            )
        debug_manager = get_debug_manager(db)
        sessions = debug_manager.get_sessions_for_execution(execution_id)

        return {
            "execution_id": execution_id,
            "sessions": [
                {
                    "id": session.id,
                    "session_name": session.session_name,
                    "is_active": session.is_active,
                    "debug_data": json.loads(session.debug_data),
                    "created_by": session.created_by,
                    "created_at": session.created_at,
                }
                for session in sessions
            ],
            "total": len(sessions),
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to get debug sessions [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.get("/debug-sessions/{session_id}")
async def get_debug_session(
    session_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """Get a specific debug session"""
    try:
        debug_manager = get_debug_manager(db)
        session = debug_manager.get_session(session_id)

        # Verify session's execution belongs to org
        if session and hasattr(session, "execution_id"):
            execution = (
                db.query(Execution)
                .filter(
                    Execution.id == session.execution_id,
                    Execution.organization_id == org_context.organization_id,
                )
                .first()
            )
            if not execution:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied",
                )

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Debug session not found"
            )

        return {
            "id": session.id,
            "execution_id": session.execution_id,
            "session_name": session.session_name,
            "is_active": session.is_active,
            "debug_data": json.loads(session.debug_data),
            "created_by": session.created_by,
            "created_at": session.created_at,
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to get debug session [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.post("/debug-sessions/{session_id}/breakpoints")
async def add_breakpoint(
    session_id: str,
    breakpoint_data: Dict[str, Any],
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """Add a breakpoint to a debug session"""
    try:
        # Verify session belongs to org (through execution)
        debug_manager = get_debug_manager(db)
        # Note: debug_manager should verify org context internally or we query directly
        debug_manager.add_breakpoint(
            session_id=session_id,
            location=breakpoint_data["location"],
            condition=breakpoint_data.get("condition"),
        )

        return {"session_id": session_id, "message": "Breakpoint added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(f"Failed to add breakpoint [ref={error_id}]: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.post("/debug-sessions/{session_id}/end")
async def end_debug_session(
    session_id: str,
    db: Session = Depends(get_session),
    org_context: OrgContext = Depends(get_any_org_member_context),
):
    """End a debug session"""
    try:
        debug_manager = get_debug_manager(db)
        debug_manager.end_session(session_id)

        return {"session_id": session_id, "message": "Debug session ended successfully"}
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to end debug session [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


# Test Data Generation Endpoints


@router.get("/test-scenarios")
async def get_test_scenarios(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Get predefined test scenarios"""
    try:
        scenarios = TestDataGenerator.generate_test_scenarios()

        return {"scenarios": scenarios, "total": len(scenarios)}
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to get test scenarios [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


@router.post("/test-data/generate")
async def generate_test_data(
    test_data: Dict[str, Any],
    db: Session = Depends(get_session),
    current_user: User = Depends(get_any_authenticated_user),
):
    """Generate synthetic test data"""
    try:
        # Validate required fields
        required_fields = ["rows", "columns_config"]
        for field in required_fields:
            if field not in test_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field: {field}",
                )

        # Generate test data
        df = TestDataGenerator.generate_dataset(
            rows=test_data["rows"],
            columns_config=test_data["columns_config"],
            seed=test_data.get("seed"),
        )

        # Convert to records for response
        records = df.to_dict("records")

        return {
            "rows": len(records),
            "columns": list(df.columns),
            "data": records[:100],  # Limit to first 100 rows
            "message": f"Generated {len(records)} rows of test data",
        }
    except HTTPException:
        raise
    except Exception as e:
        error_id = str(uuid4())
        logger.error(
            f"Failed to generate test data [ref={error_id}]: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error. Reference: {error_id}",
        )


# Background task for ML model training
def train_ml_model_background(training_data: Dict[str, Any], user_id: str):
    """Background task for training ML models"""
    try:
        from app.database import SessionLocal

        db = SessionLocal()

        try:
            anomaly_service = AnomalyDetectionService(db)
            model = anomaly_service.train_model(
                model_name=training_data["model_name"],
                model_type=training_data["model_type"],
                dataset_version_id=training_data["dataset_version_id"],
                feature_columns=training_data["feature_columns"],
                model_params=training_data.get("model_params"),
                created_by=user_id,
            )

            logger.info(f"Successfully trained ML model: {model.id}")

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error training ML model: {e}", exc_info=True)
