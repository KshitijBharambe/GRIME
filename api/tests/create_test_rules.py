#!/usr/bin/env python3

import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path="migrations/.env.local", override=True)

from sqlalchemy.orm import Session
from app.database import get_session, Base, engine
from app.models import Rule, RuleKind, Criticality, User, UserRole

def create_test_rules():
    """Create test data quality rules"""

    # Create database tables if they don't exist
    Base.metadata.create_all(bind=engine)

    # Get database session
    db = next(get_session())

    try:
        # Check if we have any users (we need one to create rules)
        user = db.query(User).first()
        if not user:
            # Create a test user
            user = User(
                name="Test Admin",
                email="admin@test.com",
                role=UserRole.admin,
                auth_provider="local",
                auth_subject="test-admin"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created test user: {user.email}")

        # Define test rules
        test_rules = [
            {
                "name": "Email Format Validation",
                "description": "Validates that email addresses follow the standard format (user@domain.com)",
                "kind": RuleKind.regex,
                "criticality": Criticality.high,
                "target_columns": ["email", "email_address", "contact_email"],
                "params": {
                    "pattern": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
                    "error_message": "Invalid email format"
                }
            },
            {
                "name": "Required Customer ID",
                "description": "Ensures customer ID field is not null or empty",
                "kind": RuleKind.missing_data,
                "criticality": Criticality.critical,
                "target_columns": ["customer_id", "id", "user_id"],
                "params": {
                    "allow_null": False,
                    "allow_empty": False,
                    "error_message": "Customer ID is required"
                }
            },
            {
                "name": "Phone Number Format",
                "description": "Standardizes phone numbers to international format",
                "kind": RuleKind.standardization,
                "criticality": Criticality.medium,
                "target_columns": ["phone", "phone_number", "mobile", "contact_phone"],
                "params": {
                    "format_pattern": "+{country_code}-{area_code}-{number}",
                    "default_country": "1",
                    "error_message": "Phone number format should be +1-XXX-XXX-XXXX"
                }
            },
            {
                "name": "Date Range Validation",
                "description": "Validates that dates fall within expected ranges",
                "kind": RuleKind.value_list,
                "criticality": Criticality.medium,
                "target_columns": ["order_date", "created_date", "birth_date"],
                "params": {
                    "min_date": "1900-01-01",
                    "max_date": "2030-12-31",
                    "error_message": "Date must be between 1900 and 2030"
                }
            },
            {
                "name": "Postal Code Format",
                "description": "Validates postal/zip code formats for different countries",
                "kind": RuleKind.regex,
                "criticality": Criticality.low,
                "target_columns": ["postal_code", "zip_code", "zip"],
                "params": {
                    "patterns": {
                        "US": r"^\d{5}(-\d{4})?$",
                        "CA": r"^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$",
                        "UK": r"^[A-Za-z]{1,2}\d[A-Za-z\d]? \d[A-Za-z]{2}$"
                    },
                    "error_message": "Invalid postal code format"
                }
            },
            {
                "name": "Name Character Restriction",
                "description": "Ensures names contain only allowed characters",
                "kind": RuleKind.char_restriction,
                "criticality": Criticality.medium,
                "target_columns": ["first_name", "last_name", "full_name", "company_name"],
                "params": {
                    "allowed_chars": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ '-.",
                    "min_length": 1,
                    "max_length": 50,
                    "error_message": "Names can only contain letters, spaces, hyphens, apostrophes, and periods"
                }
            },
            {
                "name": "Amount Range Check",
                "description": "Validates that monetary amounts are within reasonable ranges",
                "kind": RuleKind.length_range,
                "criticality": Criticality.high,
                "target_columns": ["amount", "price", "total", "cost"],
                "params": {
                    "min_value": 0,
                    "max_value": 1000000,
                    "data_type": "decimal",
                    "error_message": "Amount must be between $0 and $1,000,000"
                }
            },
            {
                "name": "Gender Value List",
                "description": "Ensures gender field contains only valid values",
                "kind": RuleKind.value_list,
                "criticality": Criticality.low,
                "target_columns": ["gender", "sex"],
                "params": {
                    "valid_values": ["M", "F", "Male", "Female", "Other", "Prefer not to say", ""],
                    "case_sensitive": False,
                    "error_message": "Gender must be one of: M, F, Male, Female, Other, Prefer not to say"
                }
            },
            {
                "name": "Cross-Field Date Validation",
                "description": "Ensures end dates are after start dates",
                "kind": RuleKind.cross_field,
                "criticality": Criticality.high,
                "target_columns": ["start_date", "end_date", "order_date", "ship_date"],
                "params": {
                    "field_pairs": [
                        {"start": "start_date", "end": "end_date"},
                        {"start": "order_date", "end": "ship_date"},
                        {"start": "birth_date", "end": "hire_date"}
                    ],
                    "error_message": "End date must be after start date"
                }
            },
            {
                "name": "Custom Business Logic",
                "description": "Custom validation for business-specific requirements",
                "kind": RuleKind.custom,
                "criticality": Criticality.medium,
                "target_columns": ["status", "category", "type"],
                "params": {
                    "validation_function": "validate_business_logic",
                    "rules": {
                        "customer_type_status": "If customer_type is 'Premium', status must be 'Active'",
                        "order_amount_discount": "If order_amount > 1000, discount_rate must be <= 0.1"
                    },
                    "error_message": "Business logic validation failed"
                }
            }
        ]

        # Create rules in database
        created_rules = []
        for rule_data in test_rules:
            # Check if an active (latest) rule with same name already exists
            existing_latest_rule = db.query(Rule).filter(
                Rule.name == rule_data["name"],
                Rule.is_latest == True
            ).first()

            if existing_latest_rule:
                print(f"Rule '{rule_data['name']}' already exists (latest version), skipping...")
                continue

            rule = Rule(
                name=rule_data["name"],
                description=rule_data["description"],
                kind=rule_data["kind"],
                criticality=rule_data["criticality"],
                target_columns=json.dumps(rule_data["target_columns"]),
                params=json.dumps(rule_data["params"]),
                created_by=user.id,
                is_active=True,
                version=1,
                is_latest=True
            )

            db.add(rule)
            db.flush()  # Get the ID before setting rule_family_id

            # Set rule_family_id to self for new rules (version 1)
            rule.rule_family_id = rule.id

            created_rules.append(rule_data["name"])

        db.commit()

        print(f"\nSuccessfully created {len(created_rules)} test rules:")
        for rule_name in created_rules:
            print(f"  ✓ {rule_name}")

        if not created_rules:
            print("No new rules were created (all test rules already exist)")

        # Display summary
        total_rules = db.query(Rule).count()
        active_rules = db.query(Rule).filter(Rule.is_active == True).count()

        print(f"\nDatabase summary:")
        print(f"  Total rules: {total_rules}")
        print(f"  Active rules: {active_rules}")

        # Display rules by criticality
        for criticality in Criticality:
            count = db.query(Rule).filter(Rule.criticality == criticality).count()
            print(f"  {criticality.value.title()} priority: {count}")

    except Exception as e:
        print(f"Error creating test rules: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating test data quality rules...")
    create_test_rules()
    print("Done!")