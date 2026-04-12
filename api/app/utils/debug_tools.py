"""
Debug tools and utilities for enhanced testing and debugging capabilities.
Provides comprehensive debugging, profiling, and testing utilities for the data hygiene toolkit.
"""

import json
import uuid
import time
import psutil
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session

from app.models import DebugSession
from app.utils.logging_service import get_logger


class DebugSessionManager:
    """Manager for debug sessions and debugging utilities"""

    def __init__(self, db: Session):
        self.db = db
        self.logger = get_logger()
        self.active_sessions: Dict[str, Dict[str, Any]] = {}

    def create_debug_session(
        self,
        execution_id: str,
        session_name: str,
        created_by: str
    ) -> DebugSession:
        """Create a new debug session"""
        session = DebugSession(
            id=str(uuid.uuid4()),
            execution_id=execution_id,
            session_name=session_name,
            debug_data=json.dumps({
                'created_at': datetime.now(timezone.utc).isoformat(),
                'breakpoints': [],
                'variable_snapshots': [],
                'execution_trace': []
            }),
            created_by=created_by
        )

        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        # Initialize session tracking
        self.active_sessions[session.id] = {
            'start_time': time.time(),
            'breakpoints': [],
            'snapshots': [],
            'trace': []
        }

        return session

    def add_breakpoint(
        self,
        session_id: str,
        location: str,
        condition: Optional[str] = None
    ) -> None:
        """Add a breakpoint to a debug session"""
        if session_id in self.active_sessions:
            breakpoint_data = {
                'location': location,
                'condition': condition,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            self.active_sessions[session_id]['breakpoints'].append(
                breakpoint_data)

            # Update database
            session = self.db.query(DebugSession).filter(
                DebugSession.id == session_id
            ).first()
            if session:
                debug_data = json.loads(session.debug_data)
                debug_data['breakpoints'].append(breakpoint_data)
                session.debug_data = json.dumps(debug_data)
                self.db.commit()

    def _serialize_variables(self, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize variables for storage (convert complex objects to strings)"""
        serialized = {}
        for key, value in variables.items():
            try:
                if isinstance(value, (str, int, float, bool, type(None))):
                    serialized[key] = value
                elif isinstance(value, (list, tuple)):
                    serialized[key] = [str(v) for v in value]
                elif isinstance(value, dict):
                    serialized[key] = {k: str(v) for k, v in value.items()}
                else:
                    serialized[key] = str(value)
            except Exception:
                serialized[key] = f"<{type(value).__name__}>"
        return serialized

    def capture_variable_snapshot(
        self,
        session_id: str,
        variables: Dict[str, Any],
        context: Optional[str] = None
    ) -> None:
        """Capture a snapshot of variables at a specific point"""
        if session_id in self.active_sessions:
            snapshot_data = {
                'variables': self._serialize_variables(variables),
                'context': context,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'memory_usage': psutil.Process().memory_info().rss
            }
            self.active_sessions[session_id]['snapshots'].append(snapshot_data)

            # Update database
            session = self.db.query(DebugSession).filter(
                DebugSession.id == session_id
            ).first()
            if session:
                debug_data = json.loads(session.debug_data)
                debug_data['variable_snapshots'].append(snapshot_data)
                session.debug_data = json.dumps(debug_data)
                self.db.commit()

    def add_execution_trace(
        self,
        session_id: str,
        event: str,
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Add an event to the execution trace"""
        if session_id in self.active_sessions:
            trace_event = {
                'event': event,
                'data': data or {},
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'elapsed_time': time.time() - self.active_sessions[session_id]['start_time']
            }
            self.active_sessions[session_id]['trace'].append(trace_event)

    def get_session(self, session_id: str) -> Optional[DebugSession]:
        """Get a debug session by ID"""
        return self.db.query(DebugSession).filter(
            DebugSession.id == session_id
        ).first()

    def get_sessions_for_execution(self, execution_id: str) -> List[DebugSession]:
        """Get all debug sessions for an execution"""
        return self.db.query(DebugSession).filter(
            DebugSession.execution_id == execution_id
        ).order_by(DebugSession.created_at.desc()).all()

    def end_session(self, session_id: str) -> None:
        """End a debug session and save final data"""
        if session_id in self.active_sessions:
            session_data = self.active_sessions[session_id]

            # Update database with final data
            session = self.db.query(DebugSession).filter(
                DebugSession.id == session_id
            ).first()
            if session:
                debug_data = json.loads(session.debug_data)
                debug_data.update({
                    'ended_at': datetime.now(timezone.utc).isoformat(),
                    'total_duration': time.time() - session_data['start_time'],
                    'total_breakpoints': len(session_data['breakpoints']),
                    'total_snapshots': len(session_data['snapshots']),
                    'total_trace_events': len(session_data['trace'])
                })
                session.debug_data = json.dumps(debug_data)
                session.is_active = False
                self.db.commit()

            # Remove from active sessions
            del self.active_sessions[session_id]


class PerformanceProfiler:
    """Performance profiling utilities for rule execution"""

    def __init__(self):
        self.logger = get_logger()
        self.profiles: Dict[str, Dict[str, Any]] = {}

    def start_profile(self, profile_id: str) -> None:
        """Start a new performance profile"""
        self.profiles[profile_id] = {
            'start_time': time.time(),
            'start_memory': psutil.Process().memory_info().rss,
            'events': [],
            'memory_samples': []
        }

    def record_event(
        self,
        profile_id: str,
        event_name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record an event in the profile"""
        if profile_id in self.profiles:
            current_time = time.time()
            current_memory = psutil.Process().memory_info().rss

            event_data = {
                'name': event_name,
                'timestamp': current_time,
                'elapsed_time': current_time - self.profiles[profile_id]['start_time'],
                'memory_usage': current_memory,
                'memory_delta': current_memory - self.profiles[profile_id]['start_memory'],
                'metadata': metadata or {}
            }

            self.profiles[profile_id]['events'].append(event_data)

    def sample_memory(self, profile_id: str) -> None:
        """Sample memory usage during profiling"""
        if profile_id in self.profiles:
            current_memory = psutil.Process().memory_info().rss
            self.profiles[profile_id]['memory_samples'].append({
                'timestamp': time.time(),
                'memory_usage': current_memory,
                'elapsed_time': time.time() - self.profiles[profile_id]['start_time']
            })

    def end_profile(self, profile_id: str) -> Dict[str, Any]:
        """End profiling and return results"""
        if profile_id not in self.profiles:
            return {}

        profile_data = self.profiles[profile_id]
        end_time = time.time()
        end_memory = psutil.Process().memory_info().rss

        results = {
            'profile_id': profile_id,
            'total_duration': end_time - profile_data['start_time'],
            'memory_delta': end_memory - profile_data['start_memory'],
            'peak_memory': max([s['memory_usage'] for s in profile_data['memory_samples']]) if profile_data['memory_samples'] else end_memory,
            'total_events': len(profile_data['events']),
            'events': profile_data['events'],
            'memory_samples': profile_data['memory_samples']
        }

        # Clean up
        del self.profiles[profile_id]

        return results


class TestDataGenerator:
    """Generate synthetic test data for testing purposes"""

    @staticmethod
    def generate_dataset(
        rows: int,
        columns_config: Dict[str, Dict[str, Any]],
        seed: Optional[int] = None
    ) -> pd.DataFrame:
        """Generate synthetic dataset with specified configuration"""
        if seed is not None:
            np.random.seed(seed)

        data = {}

        for column_name, config in columns_config.items():
            column_type = config.get('type', 'string')

            if column_type == 'string':
                data[column_name] = TestDataGenerator._generate_string_column(
                    rows, config
                )
            elif column_type == 'int':
                data[column_name] = TestDataGenerator._generate_int_column(
                    rows, config
                )
            elif column_type == 'float':
                data[column_name] = TestDataGenerator._generate_float_column(
                    rows, config
                )
            elif column_type == 'datetime':
                data[column_name] = TestDataGenerator._generate_datetime_column(
                    rows, config
                )
            elif column_type == 'boolean':
                data[column_name] = TestDataGenerator._generate_boolean_column(
                    rows, config
                )
            elif column_type == 'categorical':
                data[column_name] = TestDataGenerator._generate_categorical_column(
                    rows, config
                )

        return pd.DataFrame(data)

    @staticmethod
    def _generate_string_column(rows: int, config: Dict[str, Any]) -> List[str]:
        """Generate string column with specified characteristics"""
        min_length = config.get('min_length', 5)
        max_length = config.get('max_length', 20)
        null_rate = config.get('null_rate', 0.1)
        prefix = config.get('prefix', '')

        data = []
        for _ in range(rows):
            if np.random.random() < null_rate:
                data.append(None)
            else:
                length = np.random.randint(min_length, max_length + 1)
                # Generate random string
                chars = np.random.choice(
                    list('abcdefghijklmnopqrstuvwxyz'), length)
                data.append(prefix + ''.join(chars))

        return data

    @staticmethod
    def _generate_int_column(rows: int, config: Dict[str, Any]) -> List[int]:
        """Generate integer column with specified characteristics"""
        min_val = config.get('min_value', 0)
        max_val = config.get('max_value', 100)
        null_rate = config.get('null_rate', 0.1)

        data = []
        for _ in range(rows):
            if np.random.random() < null_rate:
                data.append(None)
            else:
                data.append(np.random.randint(min_val, max_val + 1))

        return data

    @staticmethod
    def _generate_float_column(rows: int, config: Dict[str, Any]) -> List[float]:
        """Generate float column with specified characteristics"""
        min_val = config.get('min_value', 0.0)
        max_val = config.get('max_value', 100.0)
        null_rate = config.get('null_rate', 0.1)
        decimal_places = config.get('decimal_places', 2)

        data = []
        for _ in range(rows):
            if np.random.random() < null_rate:
                data.append(None)
            else:
                value = np.random.uniform(min_val, max_val)
                data.append(round(value, decimal_places))

        return data

    @staticmethod
    def _generate_datetime_column(rows: int, config: Dict[str, Any]) -> List[str]:
        """Generate datetime column with specified characteristics"""
        start_date = config.get('start_date', '2020-01-01')
        end_date = config.get('end_date', '2023-12-31')
        null_rate = config.get('null_rate', 0.1)

        start_timestamp = pd.Timestamp(start_date)
        end_timestamp = pd.Timestamp(end_date)

        data = []
        for _ in range(rows):
            if np.random.random() < null_rate:
                data.append(None)
            else:
                random_timestamp = start_timestamp + pd.Timedelta(
                    seconds=np.random.randint(
                        0, int((end_timestamp - start_timestamp).total_seconds()))
                )
                data.append(random_timestamp.strftime('%Y-%m-%d %H:%M:%S'))

        return data

    @staticmethod
    def _generate_boolean_column(rows: int, config: Dict[str, Any]) -> List[bool]:
        """Generate boolean column with specified characteristics"""
        true_rate = config.get('true_rate', 0.5)
        null_rate = config.get('null_rate', 0.0)

        data = []
        for _ in range(rows):
            if np.random.random() < null_rate:
                data.append(None)
            else:
                data.append(np.random.random() < true_rate)

        return data

    @staticmethod
    def _generate_categorical_column(rows: int, config: Dict[str, Any]) -> List[str]:
        """Generate categorical column with specified characteristics"""
        categories = config.get('categories', ['A', 'B', 'C'])
        null_rate = config.get('null_rate', 0.1)

        data = []
        for _ in range(rows):
            if np.random.random() < null_rate:
                data.append(None)
            else:
                data.append(np.random.choice(categories))

        return data

    @staticmethod
    def generate_test_scenarios() -> Dict[str, Dict[str, Any]]:
        """Generate predefined test scenarios"""
        return {
            'missing_data': {
                'description': 'Dataset with missing values',
                'columns_config': {
                    'id': {'type': 'int', 'min_value': 1, 'max_value': 1000},
                    'name': {'type': 'string', 'min_length': 5, 'max_length': 20, 'null_rate': 0.2},
                    'email': {'type': 'string', 'prefix': 'user', 'null_rate': 0.1},
                    'age': {'type': 'int', 'min_value': 18, 'max_value': 80, 'null_rate': 0.15}
                }
            },
            'outliers': {
                'description': 'Dataset with statistical outliers',
                'columns_config': {
                    'id': {'type': 'int', 'min_value': 1, 'max_value': 1000},
                    'salary': {'type': 'float', 'min_value': 30000, 'max_value': 80000},
                    # Some outliers
                    'salary_outlier': {'type': 'float', 'min_value': 30000, 'max_value': 500000}
                }
            },
            'format_issues': {
                'description': 'Dataset with format validation issues',
                'columns_config': {
                    'id': {'type': 'int', 'min_value': 1, 'max_value': 1000},
                    'email': {'type': 'string', 'prefix': 'user'},
                    'invalid_email': {'type': 'string', 'prefix': 'invalid-email'},
                    'phone': {'type': 'string', 'prefix': 'phone'},
                    'invalid_phone': {'type': 'string', 'prefix': 'invalid-phone'}
                }
            },
            'duplicates': {
                'description': 'Dataset with duplicate records',
                'columns_config': {
                    # Limited range for duplicates
                    'id': {'type': 'int', 'min_value': 1, 'max_value': 100},
                    'name': {'type': 'string', 'min_length': 5, 'max_length': 10, 'categories': ['John', 'Jane', 'Bob', 'Alice']},
                    'age': {'type': 'int', 'min_value': 25, 'max_value': 35}
                }
            }
        }


# Global instances
debug_manager = None
profiler = PerformanceProfiler()


def get_debug_manager(db: Session) -> DebugSessionManager:
    """Get or create debug session manager"""
    global debug_manager
    if debug_manager is None:
        debug_manager = DebugSessionManager(db)
    return debug_manager


def get_profiler() -> PerformanceProfiler:
    """Get or create performance profiler"""
    global profiler
    if profiler is None:
        profiler = PerformanceProfiler()
    return profiler
