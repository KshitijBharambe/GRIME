"""
Rule versioning helper functions and endpoints
"""
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import json

from app.models import Rule, User
from app.schemas import RuleUpdate


async def create_rule_version(
    original_rule: Rule,
    rule_data: RuleUpdate,
    current_user: User,
    db: Session
) -> Rule:
    """
    Create a new version of an existing rule
    
    Args:
        original_rule: The original rule to version
        rule_data: Updated rule data
        current_user: User making the change
        db: Database session
        
    Returns:
        The newly created rule version
    """
    
    # Mark original as not latest
    original_rule.is_latest = False
    
    # Prepare update data
    update_data = rule_data.model_dump(exclude_unset=True)
    
    # Track changes for audit trail
    changes = {}
    for field, new_value in update_data.items():
        old_value = getattr(original_rule, field)
        
        # Handle JSON fields
        if field in ['target_columns', 'params']:
            old_value = json.loads(old_value) if old_value else None
            
        if old_value != new_value:
            changes[field] = {
                'old': str(old_value) if not isinstance(old_value, (dict, list)) else old_value,
                'new': str(new_value) if not isinstance(new_value, (dict, list)) else new_value
            }
    
    # Find the root rule ID (for tracking all versions of a rule)
    root_rule_id = original_rule.parent_rule_id if original_rule.parent_rule_id else original_rule.id

    # Get rule family ID (prefer rule_family_id, fallback to root_rule_id)
    family_id = original_rule.rule_family_id if original_rule.rule_family_id else root_rule_id

    # Create new version
    new_version = Rule(
        name=update_data.get('name', original_rule.name),
        description=update_data.get('description', original_rule.description),
        kind=update_data.get('kind', original_rule.kind),
        criticality=update_data.get('criticality', original_rule.criticality),
        target_table=update_data.get('target_table', original_rule.target_table),
        target_columns=(
            json.dumps(update_data['target_columns'])
            if 'target_columns' in update_data
            else original_rule.target_columns
        ),
        params=(
            json.dumps(update_data['params'])
            if 'params' in update_data
            else original_rule.params
        ),
        created_by=current_user.id,
        is_active=update_data.get('is_active', original_rule.is_active),
        version=original_rule.version + 1,
        parent_rule_id=root_rule_id,  # Always point to root
        rule_family_id=family_id,  # Denormalized family ID for faster queries
        is_latest=True,
        change_log=json.dumps({
            'changed_by': str(current_user.id),
            'changed_by_name': current_user.name,
            'changed_at': datetime.now(timezone.utc).isoformat(),
            'changes': changes,
            'previous_version': original_rule.version,
            'reason': update_data.get('change_reason', 'Rule configuration updated')
        })
    )
    
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    
    return new_version


async def update_rule_directly(
    rule: Rule,
    rule_data: RuleUpdate,
    db: Session
) -> Rule:
    """
    Update rule directly when it hasn't been used in executions
    
    Args:
        rule: Rule to update
        rule_data: Updated rule data
        db: Database session
        
    Returns:
        The updated rule
    """
    
    update_data = rule_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == 'target_columns':
            setattr(rule, field, json.dumps(value))
        elif field == 'params':
            setattr(rule, field, json.dumps(value))
        else:
            setattr(rule, field, value)
    
    db.commit()
    db.refresh(rule)
    
    return rule


def get_rule_root_id(rule: Rule) -> str:
    """Get the root rule ID for any rule version"""
    return rule.parent_rule_id if rule.parent_rule_id else rule.id


def has_rule_been_used(rule_id: str, db: Session) -> bool:
    """Check if a rule has been used in any executions"""
    from app.models import ExecutionRule

    count = db.query(ExecutionRule).filter_by(rule_id=rule_id).count()
    return count > 0


def create_rule_snapshot(rule: Rule) -> str:
    """
    Create a JSON snapshot of a rule for storage in execution records

    Args:
        rule: Rule object to snapshot

    Returns:
        JSON string containing complete rule details
    """
    snapshot = {
        'id': rule.id,
        'name': rule.name,
        'description': rule.description,
        'kind': rule.kind.value if hasattr(rule.kind, 'value') else str(rule.kind),
        'criticality': rule.criticality.value if hasattr(rule.criticality, 'value') else str(rule.criticality),
        'target_columns': rule.target_columns,
        'params': rule.params,
        'version': rule.version,
        'is_active': rule.is_active,
        'rule_family_id': rule.rule_family_id,
        'created_by': rule.created_by,
        'created_at': rule.created_at.isoformat() if rule.created_at else None
    }
    return json.dumps(snapshot)


def create_lightweight_rule_snapshot(rule: Rule) -> str:
    """
    Create a lightweight JSON snapshot of a rule for issues

    Args:
        rule: Rule object to snapshot

    Returns:
        JSON string containing basic rule info
    """
    snapshot = {
        'id': rule.id,
        'name': rule.name,
        'kind': rule.kind.value if hasattr(rule.kind, 'value') else str(rule.kind),
        'version': rule.version,
        'criticality': rule.criticality.value if hasattr(rule.criticality, 'value') else str(rule.criticality)
    }
    return json.dumps(snapshot)


def get_latest_version_by_family(rule_family_id: str, db: Session) -> Rule:
    """
    Get the latest version of a rule family

    Args:
        rule_family_id: The root rule ID for the family
        db: Database session

    Returns:
        The latest version of the rule, or None if not found
    """
    return db.query(Rule).filter(
        Rule.rule_family_id == rule_family_id,
        Rule.is_latest == True
    ).first()


def get_latest_version_by_name(rule_name: str, db: Session) -> Rule:
    """
    Get the latest version of a rule by its name

    Args:
        rule_name: Name of the rule
        db: Database session

    Returns:
        The latest version of the rule, or None if not found
    """
    return db.query(Rule).filter(
        Rule.name == rule_name,
        Rule.is_latest == True
    ).first()


def promote_previous_version_to_latest(rule_id: str, db: Session) -> bool:
    """
    When deleting the latest version, promote the previous version to latest

    Args:
        rule_id: ID of the rule being deleted (must be is_latest=True)
        db: Database session

    Returns:
        True if a previous version was promoted, False otherwise
    """
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule or not rule.is_latest:
        return False

    # Find the previous version (highest version number that's less than current)
    rule_family_id = rule.rule_family_id if rule.rule_family_id else rule.id

    previous_version = db.query(Rule).filter(
        Rule.rule_family_id == rule_family_id,
        Rule.version < rule.version,
        Rule.id != rule_id
    ).order_by(Rule.version.desc()).first()

    # If no previous version via family_id, try parent_rule_id approach (fallback)
    if not previous_version:
        root_rule_id = get_rule_root_id(rule)
        previous_version = db.query(Rule).filter(
            ((Rule.id == root_rule_id) | (Rule.parent_rule_id == root_rule_id)),
            Rule.version < rule.version,
            Rule.id != rule_id
        ).order_by(Rule.version.desc()).first()

    if previous_version:
        previous_version.is_latest = True
        db.commit()
        return True

    return False


def get_rule_family_id(rule: Rule) -> str:
    """
    Get the rule family ID for a rule

    Args:
        rule: Rule object

    Returns:
        The rule family ID (root rule ID)
    """
    if rule.rule_family_id:
        return rule.rule_family_id
    elif rule.parent_rule_id:
        # Fallback: use parent_rule_id logic
        return get_rule_root_id(rule)
    else:
        # This is the root rule itself
        return rule.id
