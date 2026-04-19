"""AI assistance route scaffold for rule building and issue analysis."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any
from pydantic import BaseModel

from app.database import get_session
from app.auth import get_current_user
from app.models import User, Dataset
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["AI Assistance"])


class RuleSuggestionsRequest(BaseModel):
    dataset_id: str


class IssueAnalysisRequest(BaseModel):
    issue_ids: list[str]
    dataset_id: str | None = None


class ExplainRuleRequest(BaseModel):
    rule_definition: dict[str, Any]


@router.post("/rule-suggestions")
async def suggest_rules(
    body: RuleSuggestionsRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return AI-generated rule suggestions for a dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == body.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    # Stub: real impl would load column profiles from dataset metadata
    column_profiles: list[dict[str, Any]] = []

    service = AIService()
    suggestions = service.suggest_rules_for_dataset(body.dataset_id, column_profiles)
    return {"suggestions": suggestions, "dataset_id": body.dataset_id}


@router.post("/analyze-issues")
async def analyze_issues(
    body: IssueAnalysisRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return AI analysis and recommended fixes for a set of issues."""
    service = AIService()
    result = service.analyze_issues(issues=[], dataset_context=None)
    return result


@router.post("/explain-rule")
async def explain_rule(
    body: ExplainRuleRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Return a plain-English explanation of a rule definition."""
    service = AIService()
    explanation = service.explain_rule(body.rule_definition)
    return {"explanation": explanation}
