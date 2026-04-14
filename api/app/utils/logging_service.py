"""
Comprehensive logging service for GRIME.
Provides structured logging, execution tracing, and performance monitoring.
"""

import logging
import json
import time
import traceback
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from enum import Enum
from contextlib import contextmanager
import threading

# Configure structured JSON logging


class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging"""

    def format(self, record):
        log_entry = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add extra fields if present
        if hasattr(record, "execution_id"):
            log_entry["execution_id"] = record.execution_id
        if hasattr(record, "rule_id"):
            log_entry["rule_id"] = record.rule_id
        if hasattr(record, "user_id"):
            log_entry["user_id"] = record.user_id
        if hasattr(record, "dataset_id"):
            log_entry["dataset_id"] = record.dataset_id
        if hasattr(record, "duration_ms"):
            log_entry["duration_ms"] = record.duration_ms
        if hasattr(record, "memory_usage_mb"):
            log_entry["memory_usage_mb"] = record.memory_usage_mb
        if hasattr(record, "rows_processed"):
            log_entry["rows_processed"] = record.rows_processed
        if hasattr(record, "issues_found"):
            log_entry["issues_found"] = record.issues_found

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info),
            }

        return json.dumps(log_entry)


class LogLevel(Enum):
    """Log levels for the application"""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ExecutionPhase(Enum):
    """Phases of rule execution"""

    INITIALIZATION = "initialization"
    DATA_LOADING = "data_loading"
    RULE_EXECUTION = "rule_execution"
    ISSUE_PROCESSING = "issue_processing"
    FINALIZATION = "finalization"
    CLEANUP = "cleanup"


@dataclass
class ExecutionMetrics:
    """Metrics collected during execution"""

    execution_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_ms: Optional[float] = None
    total_rules: int = 0
    successful_rules: int = 0
    failed_rules: int = 0
    total_rows: int = 0
    rows_processed: int = 0
    total_issues: int = 0
    peak_memory_mb: float = 0.0
    average_memory_mb: float = 0.0
    phases: List[Dict[str, Any]] = None

    def __post_init__(self):
        if self.phases is None:
            self.phases = []


@dataclass
class RuleMetrics:
    """Metrics for individual rule execution"""

    rule_id: str
    rule_name: str
    rule_kind: str
    execution_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_ms: Optional[float] = None
    rows_processed: int = 0
    issues_found: int = 0
    memory_usage_mb: float = 0.0
    success: bool = True
    error_message: Optional[str] = None


class LoggingService:
    """Centralized logging service with structured logging and metrics collection"""

    def __init__(self):
        self._setup_loggers()
        self._execution_context = threading.local()
        self._active_executions = {}
        self._active_rules = {}

    def _setup_loggers(self):
        """Setup structured loggers"""
        # Main application logger
        self.app_logger = logging.getLogger("data_hygiene")
        self.app_logger.setLevel(logging.INFO)

        # Performance logger
        self.perf_logger = logging.getLogger("data_hygiene.performance")
        self.perf_logger.setLevel(logging.INFO)

        # Error logger
        self.error_logger = logging.getLogger("data_hygiene.errors")
        self.error_logger.setLevel(logging.ERROR)

        # Setup console handler with structured formatter
        if not self.app_logger.handlers:
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(StructuredFormatter())

            self.app_logger.addHandler(console_handler)
            self.perf_logger.addHandler(console_handler)
            self.error_logger.addHandler(console_handler)

    def set_execution_context(
        self,
        execution_id: str,
        user_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
    ):
        """Set execution context for current thread"""
        context = {
            "execution_id": execution_id,
            "user_id": user_id,
            "dataset_id": dataset_id,
        }
        self._execution_context.context = context

    def clear_execution_context(self):
        """Clear execution context for current thread"""
        if hasattr(self._execution_context, "context"):
            delattr(self._execution_context, "context")

    def _get_log_extra(self, **kwargs) -> Dict[str, Any]:
        """Get extra fields for logging"""
        extra = kwargs.copy()
        if hasattr(self._execution_context, "context"):
            extra.update(self._execution_context.context)
        return extra

    def log_debug(self, message: str, **kwargs):
        """Log debug message"""
        self.app_logger.debug(message, extra=self._get_log_extra(**kwargs))

    def log_info(self, message: str, **kwargs):
        """Log info message"""
        self.app_logger.info(message, extra=self._get_log_extra(**kwargs))

    def log_warning(self, message: str, **kwargs):
        """Log warning message"""
        self.app_logger.warning(message, extra=self._get_log_extra(**kwargs))

    def log_error(self, message: str, exception: Optional[Exception] = None, **kwargs):
        """Log error message with exception details"""
        if exception:
            self.error_logger.error(
                message,
                exc_info=(type(exception), exception, exception.__traceback__),
                extra=self._get_log_extra(**kwargs),
            )
        else:
            self.error_logger.error(message, extra=self._get_log_extra(**kwargs))

    def log_critical(
        self, message: str, exception: Optional[Exception] = None, **kwargs
    ):
        """Log critical error message"""
        if exception:
            self.error_logger.critical(
                message,
                exc_info=(type(exception), exception, exception.__traceback__),
                extra=self._get_log_extra(**kwargs),
            )
        else:
            self.error_logger.critical(message, extra=self._get_log_extra(**kwargs))

    def log_performance(
        self,
        message: str,
        duration_ms: Optional[float] = None,
        memory_usage_mb: Optional[float] = None,
        **kwargs,
    ):
        """Log performance metrics"""
        extra = self._get_log_extra(**kwargs)
        if duration_ms is not None:
            extra["duration_ms"] = duration_ms
        if memory_usage_mb is not None:
            extra["memory_usage_mb"] = memory_usage_mb

        self.perf_logger.info(message, extra=extra)

    def start_execution_tracking(
        self,
        execution_id: str,
        total_rules: int,
        user_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
    ) -> ExecutionMetrics:
        """Start tracking execution metrics"""
        metrics = ExecutionMetrics(
            execution_id=execution_id,
            start_time=datetime.now(timezone.utc),
            total_rules=total_rules,
        )

        self._active_executions[execution_id] = metrics
        self.set_execution_context(execution_id, user_id, dataset_id)

        self.log_info(
            "Started execution tracking",
            execution_id=execution_id,
            total_rules=total_rules,
            user_id=user_id,
            dataset_id=dataset_id,
        )

        return metrics

    def end_execution_tracking(
        self,
        execution_id: str,
        successful_rules: int,
        failed_rules: int,
        total_rows: int,
        total_issues: int,
    ) -> ExecutionMetrics:
        """End execution tracking and calculate final metrics"""
        if execution_id not in self._active_executions:
            self.log_warning(f"Execution {execution_id} not found in active executions")
            return None

        metrics = self._active_executions[execution_id]
        metrics.end_time = datetime.now(timezone.utc)
        metrics.duration_ms = (
            metrics.end_time - metrics.start_time
        ).total_seconds() * 1000
        metrics.successful_rules = successful_rules
        metrics.failed_rules = failed_rules
        metrics.total_rows = total_rows
        metrics.total_issues = total_issues

        self.log_info(
            "Completed execution tracking",
            execution_id=execution_id,
            duration_ms=metrics.duration_ms,
            successful_rules=successful_rules,
            failed_rules=failed_rules,
            total_rows=total_rows,
            total_issues=total_issues,
            peak_memory_mb=metrics.peak_memory_mb,
        )

        # Remove from active executions
        del self._active_executions[execution_id]
        self.clear_execution_context()

        return metrics

    def start_rule_tracking(
        self, rule_id: str, rule_name: str, rule_kind: str, execution_id: str
    ) -> RuleMetrics:
        """Start tracking individual rule execution"""
        metrics = RuleMetrics(
            rule_id=rule_id,
            rule_name=rule_name,
            rule_kind=rule_kind,
            execution_id=execution_id,
            start_time=datetime.now(timezone.utc),
        )

        self._active_rules[rule_id] = metrics

        self.log_info(
            "Started rule execution",
            rule_id=rule_id,
            rule_name=rule_name,
            rule_kind=rule_kind,
            execution_id=execution_id,
        )

        return metrics

    def end_rule_tracking(
        self,
        rule_id: str,
        rows_processed: int,
        issues_found: int,
        memory_usage_mb: float,
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> RuleMetrics:
        """End rule execution tracking"""
        if rule_id not in self._active_rules:
            self.log_warning(f"Rule {rule_id} not found in active rules")
            return None

        metrics = self._active_rules[rule_id]
        metrics.end_time = datetime.now(timezone.utc)
        metrics.duration_ms = (
            metrics.end_time - metrics.start_time
        ).total_seconds() * 1000
        metrics.rows_processed = rows_processed
        metrics.issues_found = issues_found
        metrics.memory_usage_mb = memory_usage_mb
        metrics.success = success
        metrics.error_message = error_message

        # Update execution metrics
        if metrics.execution_id in self._active_executions:
            exec_metrics = self._active_executions[metrics.execution_id]
            exec_metrics.rows_processed += rows_processed
            exec_metrics.total_issues += issues_found
            exec_metrics.peak_memory_mb = max(
                exec_metrics.peak_memory_mb, memory_usage_mb
            )

        log_level = "info" if success else "error"
        log_message = "Completed rule execution" if success else "Rule execution failed"

        getattr(self, f"log_{log_level}")(
            log_message,
            rule_id=rule_id,
            rule_name=metrics.rule_name,
            duration_ms=metrics.duration_ms,
            rows_processed=rows_processed,
            issues_found=issues_found,
            memory_usage_mb=memory_usage_mb,
            success=success,
            error_message=error_message,
        )

        # Remove from active rules
        del self._active_rules[rule_id]

        return metrics

    def log_execution_phase(
        self, execution_id: str, phase: ExecutionPhase, message: str, **kwargs
    ):
        """Log execution phase information"""
        phase_data = {
            "phase": phase.value,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **kwargs,
        }

        if execution_id in self._active_executions:
            self._active_executions[execution_id].phases.append(phase_data)

        self.log_info(
            f"Phase [{phase.value}]: {message}",
            execution_id=execution_id,
            phase=phase.value,
            **kwargs,
        )

    def get_execution_metrics(self, execution_id: str) -> Optional[ExecutionMetrics]:
        """Get metrics for a specific execution"""
        return self._active_executions.get(execution_id)

    def get_rule_metrics(self, rule_id: str) -> Optional[RuleMetrics]:
        """Get metrics for a specific rule"""
        return self._active_rules.get(rule_id)

    @contextmanager
    def execution_context(
        self,
        execution_id: str,
        user_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
    ):
        """Context manager for execution logging"""
        self.set_execution_context(execution_id, user_id, dataset_id)
        try:
            yield
        finally:
            self.clear_execution_context()

    @contextmanager
    def performance_timer(self, operation_name: str, **kwargs):
        """Context manager for timing operations"""
        start_time = time.time()
        try:
            yield
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self.log_performance(
                f"Operation completed: {operation_name}",
                duration_ms=duration_ms,
                operation=operation_name,
                **kwargs,
            )

    def log_memory_usage(self, context: str = "", memory_mb: Optional[float] = None):
        """Log current memory usage"""
        if memory_mb is None:
            try:
                import psutil
                import os

                process = psutil.Process(os.getpid())
                memory_mb = process.memory_info().rss / 1024 / 1024
            except ImportError:
                memory_mb = 0.0

        self.log_performance(
            f"Memory usage {context}".strip(),
            memory_usage_mb=memory_mb,
            context=context,
        )

    def create_error_report(
        self, execution_id: str, exception: Exception, context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Create comprehensive error report"""
        error_report = {
            "execution_id": execution_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": {
                "type": type(exception).__name__,
                "message": str(exception),
                "traceback": traceback.format_exc(),
            },
            "context": context or {},
            "system_info": self._get_system_info(),
        }

        # Add execution metrics if available
        if execution_id in self._active_executions:
            metrics = self._active_executions[execution_id]
            error_report["execution_metrics"] = asdict(metrics)

        self.log_critical(
            f"Error report generated for execution {execution_id}",
            exception=exception,
            error_report=error_report,
        )

        return error_report

    def _get_system_info(self) -> Dict[str, Any]:
        """Get system information for error reports"""
        try:
            import psutil
            import os

            return {
                "cpu_count": psutil.cpu_count(),
                "memory_total_gb": psutil.virtual_memory().total / 1024 / 1024 / 1024,
                "memory_available_gb": psutil.virtual_memory().available
                / 1024
                / 1024
                / 1024,
                "disk_usage_gb": psutil.disk_usage("/").used / 1024 / 1024 / 1024,
                "process_id": os.getpid(),
                "thread_id": threading.get_ident(),
            }
        except ImportError:
            return {"process_id": os.getpid(), "thread_id": threading.get_ident()}


# Global logging service instance
logging_service = LoggingService()


# Convenience functions
def get_logger(name: Optional[str] = None):
    """Get either the global LoggingService (no name) or a standard
    Python `logging.Logger` configured with the structured formatter
    (when `name` is provided).

    This keeps backward compatibility: code that calls `get_logger()`
    without arguments receives the `LoggingService` instance, while
    modules that call `get_logger(__name__)` get a normal logger with
    the structured JSON formatter.
    """
    if not name:
        return logging_service

    # Return a standard Python logger for named loggers
    py_logger = logging.getLogger(name)
    # Ensure the logger has the structured formatter attached once
    if not py_logger.handlers:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(StructuredFormatter())
        py_logger.addHandler(console_handler)
        py_logger.setLevel(logging.INFO)
        # Avoid double logging through parent handlers
        py_logger.propagate = False

    return py_logger


def log_execution_start(
    execution_id: str,
    total_rules: int,
    user_id: Optional[str] = None,
    dataset_id: Optional[str] = None,
) -> ExecutionMetrics:
    """Start execution logging"""
    return logging_service.start_execution_tracking(
        execution_id, total_rules, user_id, dataset_id
    )


def log_execution_end(
    execution_id: str,
    successful_rules: int,
    failed_rules: int,
    total_rows: int,
    total_issues: int,
) -> ExecutionMetrics:
    """End execution logging"""
    return logging_service.end_execution_tracking(
        execution_id, successful_rules, failed_rules, total_rows, total_issues
    )


def log_rule_start(
    rule_id: str, rule_name: str, rule_kind: str, execution_id: str
) -> RuleMetrics:
    """Start rule execution logging"""
    return logging_service.start_rule_tracking(
        rule_id, rule_name, rule_kind, execution_id
    )


def log_rule_end(
    rule_id: str,
    rows_processed: int,
    issues_found: int,
    memory_usage_mb: float,
    success: bool = True,
    error_message: Optional[str] = None,
) -> RuleMetrics:
    """End rule execution logging"""
    return logging_service.end_rule_tracking(
        rule_id, rows_processed, issues_found, memory_usage_mb, success, error_message
    )
