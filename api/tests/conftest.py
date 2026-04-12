"""
Pytest configuration and fixtures
"""
import os
import pytest

# Set DATABASE_URL before any app modules are imported
os.environ.setdefault('DATABASE_URL', 'postgresql://localhost/test_db')
