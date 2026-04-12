"""
Enhanced rule engine service with parallel execution and comprehensive logging.
Integrates parallel execution, chunking, memory optimization, and structured logging.
"""

import pandas as pd
import json
import uuid
from typing import List, Any, Optional
from sqlalchemy.orm import Session, sessionmaker
from datetime import datetime, timezone

from app.models import (
    Rule,
    Execution,
    ExecutionRule,
    Issue,
    DatasetVersion,
    User,
    ExecutionStatus,
)
from app.services.rule_engine import RuleEngineService
from app.services.dependency_manager import DependencyManager
from app.utils.parallel_executor import ParallelRuleExecutor, ExecutionMode
from app.utils.logging_service import get_logger, ExecutionPhase
from app.utils.memory_optimization import MemoryMonitor, OptimizedDataFrameOperations
from app.services.rule_versioning import (
    create_rule_snapshot,
    create_lightweight_rule_snapshot,
)
from app.core.config import (
    MIN_RULES_FOR_PARALLEL,
    MIN_DATASET_SIZE_FOR_PARALLEL,
    MAX_MEMORY_MB_FOR_PARALLEL,
)


class EnhancedRuleEngineService(RuleEngineService):
    """Enhanced rule engine with parallel execution and comprehensive monitoring"""

    def __init__(
        self,
        db: Session,
        enable_parallel: bool = True,
        max_workers: Optional[int] = None,
    ):
        """
        Initialize enhanced rule engine.

        Args:
            db: Database session
            enable_parallel: Whether to enable parallel execution
            max_workers: Maximum number of worker threads for parallel execution
        """
        super().__init__(db)

        self.logger = get_logger()
        self.enable_parallel = enable_parallel

        # Setup parallel executor
        if enable_parallel:
            # Create session factory for parallel execution
            session_factory = sessionmaker(bind=db.bind)
            self.parallel_executor = ParallelRuleExecutor(
                db_session_factory=session_factory,
                max_workers=max_workers,
                execution_mode=ExecutionMode.ADAPTIVE,
            )
        else:
            self.parallel_executor = None

        # Setup dependency manager
        self.dependency_manager = DependencyManager(db)

        self.logger.log_info(
            "Enhanced rule engine initialized",
            parallel_enabled=enable_parallel,
            max_workers=max_workers,
            dependency_management_enabled=True,
        )

    def execute_rules_on_dataset(
        self,
        dataset_version: DatasetVersion,
        rule_ids: Optional[List[str]],
        current_user: User,
    ) -> Execution:
        """
        Execute rules on a dataset with enhanced performance and logging.

        This method integrates:
        - Parallel rule execution when beneficial
        - Chunked processing for large datasets
        - Comprehensive performance monitoring
        - Structured logging and error reporting
        - Memory optimization
        """
        # Generate execution ID for tracking
        execution_id = str(uuid.uuid4())

        # Get rules to execute
        if rule_ids:
            rules = (
                self.db.query(Rule)
                .filter(Rule.id.in_(rule_ids), Rule.is_active == True)
                .all()
            )
        else:
            rules = self.get_active_rules()

        if not rules:
            raise Exception("No active rules found to execute")

        # Apply dependency ordering if dependencies exist
        try:
            dependency_analysis = self.dependency_manager.validate_dependencies(
                [rule.id for rule in rules]
            )

            if (
                dependency_analysis["is_valid"]
                and dependency_analysis["total_dependencies"] > 0
            ):
                # Get optimal execution order based on dependencies
                ordered_rule_ids = self.dependency_manager.get_execution_order(
                    [rule.id for rule in rules]
                )

                # Reorder rules according to dependency order
                rule_dict = {rule.id: rule for rule in rules}
                rules = [
                    rule_dict[rule_id]
                    for rule_id in ordered_rule_ids
                    if rule_id in rule_dict
                ]

                self.logger.log_info(
                    "Applied dependency ordering",
                    execution_id=execution_id,
                    rules_count=len(rules),
                    dependency_analysis=dependency_analysis,
                )
            else:
                self.logger.log_info(
                    "No dependencies found or invalid dependencies, using original order",
                    execution_id=execution_id,
                    dependency_analysis=dependency_analysis,
                )

        except Exception as dep_error:
            self.logger.log_warning(
                "Dependency management failed, using original rule order",
                execution_id=execution_id,
                exception=dep_error,
            )

        # Start execution tracking
        self.logger.start_execution_tracking(
            execution_id=execution_id,
            total_rules=len(rules),
            user_id=current_user.id,
            dataset_id=dataset_version.dataset_id,
        )

        # Create execution record
        execution = Execution(
            id=execution_id,
            dataset_version_id=dataset_version.id,
            started_by=current_user.id,
            status=ExecutionStatus.running,
            total_rules=len(rules),
        )

        self.db.add(execution)
        self.db.commit()
        self.db.refresh(execution)

        try:
            # Phase 1: Data Loading
            self.logger.log_execution_phase(
                execution_id, ExecutionPhase.DATA_LOADING, "Starting dataset loading"
            )

            with self.logger.performance_timer("data_loading"):
                df = self._load_and_optimize_dataset(dataset_version)

            execution.total_rows = len(df)
            self.logger.log_execution_phase(
                execution_id,
                ExecutionPhase.DATA_LOADING,
                "Dataset loaded successfully",
                rows=len(df),
                columns=len(df.columns),
                memory_mb=MemoryMonitor.get_memory_usage()["rss_mb"],
            )

            # Phase 2: Rule Execution
            self.logger.log_execution_phase(
                execution_id, ExecutionPhase.RULE_EXECUTION, "Starting rule execution"
            )

            all_issues = []
            successful_rules = 0
            failed_rules = 0

            if self.enable_parallel and self._should_use_parallel_execution(rules, df):
                # Use parallel execution
                self.logger.log_info(
                    "Using parallel rule execution",
                    execution_id=execution_id,
                    rules_count=len(rules),
                    dataset_rows=len(df),
                )

                parallel_results = self._execute_rules_parallel(rules, df, execution_id)
                all_issues, successful_rules, failed_rules = (
                    self._process_parallel_results(
                        parallel_results, execution, execution_id
                    )
                )
            else:
                # Use sequential execution
                self.logger.log_info(
                    "Using sequential rule execution",
                    execution_id=execution_id,
                    rules_count=len(rules),
                    dataset_rows=len(df),
                )

                all_issues, successful_rules, failed_rules = (
                    self._execute_rules_sequential(rules, df, execution, execution_id)
                )

            # Phase 3: Issue Processing
            self.logger.log_execution_phase(
                execution_id,
                ExecutionPhase.ISSUE_PROCESSING,
                "Processing execution results",
            )

            # Phase 4: Finalization
            self.logger.log_execution_phase(
                execution_id,
                ExecutionPhase.FINALIZATION,
                "Finalizing execution results",
            )

            # Update execution status and statistics
            if failed_rules == 0:
                execution.status = ExecutionStatus.succeeded
            elif successful_rules > 0:
                execution.status = ExecutionStatus.partially_succeeded
            else:
                execution.status = ExecutionStatus.failed

            execution.finished_at = datetime.now(timezone.utc)

            # Calculate summary statistics
            if all_issues:
                execution.rows_affected = len({issue.row_index for issue in all_issues})
                execution.columns_affected = len(
                    {issue.column_name for issue in all_issues}
                )
            else:
                execution.rows_affected = 0
                execution.columns_affected = 0

            execution.summary = json.dumps(
                {
                    "total_issues": len(all_issues),
                    "successful_rules": successful_rules,
                    "failed_rules": failed_rules,
                    "issues_by_severity": self._count_issues_by_severity(all_issues),
                    "issues_by_category": self._count_issues_by_category(all_issues),
                }
            )

            self.db.commit()

            # End execution tracking
            final_metrics = self.logger.end_execution_tracking(
                execution_id=execution_id,
                successful_rules=successful_rules,
                failed_rules=failed_rules,
                total_rows=len(df),
                total_issues=len(all_issues),
            )

            self.logger.log_execution_phase(
                execution_id,
                ExecutionPhase.FINALIZATION,
                "Execution completed successfully",
                duration_ms=final_metrics.duration_ms,
                total_issues=len(all_issues),
            )

            return execution

        except Exception as e:
            # Create comprehensive error report
            error_report = self.logger.create_error_report(
                execution_id=execution_id,
                exception=e,
                context={
                    "dataset_version_id": dataset_version.id,
                    "rules_count": len(rules),
                    "user_id": current_user.id,
                },
            )

            # Update execution with error status
            execution.status = ExecutionStatus.failed
            execution.finished_at = datetime.now(timezone.utc)
            execution.summary = json.dumps(
                {"error": "Rule execution failed.", "error_report": error_report}
            )

            self.db.commit()

            # End execution tracking with failure
            self.logger.end_execution_tracking(
                execution_id=execution_id,
                successful_rules=0,
                failed_rules=len(rules),
                total_rows=0,
                total_issues=0,
            )

            self.logger.log_critical(
                "Rule execution failed", exception=e, execution_id=execution_id
            )

            raise Exception("Rule execution failed due to an internal error.")

        finally:
            # Cleanup
            if self.parallel_executor:
                self.parallel_executor.cleanup()

            self.logger.log_execution_phase(
                execution_id, ExecutionPhase.CLEANUP, "Cleanup completed"
            )

    def _load_and_optimize_dataset(
        self, dataset_version: DatasetVersion
    ) -> pd.DataFrame:
        """Load and optimize dataset for processing"""
        # Load dataset using parent method
        df = self._load_dataset_as_dataframe(dataset_version)

        # Apply memory optimizations
        self.logger.log_memory_usage("before_optimization")
        df = OptimizedDataFrameOperations.optimize_dtypes(df)
        self.logger.log_memory_usage("after_optimization")

        # Log optimizations applied
        self.logger.log_info(
            "Dataset optimized",
            original_memory_mb=MemoryMonitor.get_memory_usage()["rss_mb"],
            optimized_memory_mb=MemoryMonitor.get_memory_usage()["rss_mb"],
        )

        return df

    def _should_use_parallel_execution(
        self, rules: List[Rule], df: pd.DataFrame
    ) -> bool:
        """Determine if parallel execution should be used"""
        if not self.enable_parallel or not self.parallel_executor:
            return False

        # Use parallel execution if:
        # 1. Multiple rules
        # 2. Large dataset
        # 3. Sufficient system resources

        rules_count = len(rules)
        dataset_size = len(df)
        memory_usage = MemoryMonitor.get_memory_usage()["rss_mb"]

        # Heuristics for parallel execution
        should_parallel = (
            rules_count >= MIN_RULES_FOR_PARALLEL
            and dataset_size >= MIN_DATASET_SIZE_FOR_PARALLEL
            and memory_usage < MAX_MEMORY_MB_FOR_PARALLEL
        )

        self.logger.log_info(
            "Parallel execution decision",
            should_parallel=should_parallel,
            rules_count=rules_count,
            dataset_size=dataset_size,
            memory_usage_mb=memory_usage,
        )

        return should_parallel

    def _execute_rules_parallel(
        self, rules: List[Rule], df: pd.DataFrame, execution_id: str
    ) -> List[Any]:
        """Execute rules in parallel"""
        with self.logger.performance_timer(
            "parallel_rule_execution", execution_id=execution_id
        ):
            results = self.parallel_executor.execute_rules(
                rules=rules,
                df=df,
                validators=self.validators,
                execution_id=execution_id,
            )

            # Log parallel execution statistics
            stats = self.parallel_executor.get_execution_stats()
            if stats:
                self.logger.log_performance(
                    "Parallel execution completed",
                    duration_ms=stats.total_execution_time,
                    parallel_efficiency=stats.parallel_efficiency,
                    peak_memory_mb=stats.peak_memory_usage,
                    successful_rules=stats.successful_rules,
                    failed_rules=stats.failed_rules,
                )

            return results

    def _execute_rules_sequential(
        self,
        rules: List[Rule],
        df: pd.DataFrame,
        execution: Execution,
        execution_id: str,
    ) -> tuple:
        """Execute rules sequentially with enhanced logging"""
        all_issues = []
        successful_rules = 0
        failed_rules = 0

        for rule in rules:
            rule_id = getattr(rule, "id", "")
            rule_name = getattr(rule, "name", "")

            # Start rule tracking
            self.logger.start_rule_tracking(
                rule_id=rule_id,
                rule_name=rule_name,
                rule_kind=str(getattr(rule, "kind", "unknown")),
                execution_id=execution_id,
            )

            try:
                # Create execution rule record
                rule_snapshot = create_rule_snapshot(rule)
                execution_rule = ExecutionRule(
                    execution_id=execution.id,
                    rule_id=rule_id,
                    rule_snapshot=rule_snapshot,
                )
                self.db.add(execution_rule)

                # Validate and execute rule
                rule_kind = getattr(rule, "kind", None)
                if rule_kind is None:
                    raise Exception("Rule has no kind specified")

                validator_class = self.validators.get(rule_kind)
                if not validator_class:
                    raise Exception(
                        f"No validator available for rule kind: {rule_kind}"
                    )

                # Execute validation with timing
                start_time = datetime.now(timezone.utc)
                initial_memory = MemoryMonitor.get_memory_usage()["rss_mb"]

                validator = validator_class(rule, df, self.db)
                issues = validator.validate()

                end_time = datetime.now(timezone.utc)
                final_memory = MemoryMonitor.get_memory_usage()["rss_mb"]

                # Create issue records
                rule_issues = []
                lightweight_snapshot = create_lightweight_rule_snapshot(rule)

                for issue_data in issues:
                    if "row_index" not in issue_data or "column_name" not in issue_data:
                        continue

                    issue = Issue(
                        execution_id=execution.id,
                        rule_id=rule_id,
                        rule_snapshot=lightweight_snapshot,
                        row_index=issue_data["row_index"],
                        column_name=issue_data["column_name"],
                        current_value=issue_data.get("current_value"),
                        suggested_value=issue_data.get("suggested_value"),
                        message=issue_data.get("message", "Data quality issue found"),
                        category=issue_data.get("category", "unknown"),
                        severity=rule.criticality,
                    )
                    self.db.add(issue)
                    rule_issues.append(issue)
                    all_issues.append(issue)

                # Update execution rule stats
                execution_rule.error_count = len(rule_issues)
                execution_rule.rows_flagged = (
                    len({i.row_index for i in rule_issues}) if rule_issues else 0
                )
                execution_rule.cols_flagged = (
                    len({i.column_name for i in rule_issues}) if rule_issues else 0
                )

                # End rule tracking with success
                self.logger.end_rule_tracking(
                    rule_id=rule_id,
                    rows_processed=len(df),
                    issues_found=len(issues),
                    memory_usage_mb=final_memory - initial_memory,
                    success=True,
                )

                successful_rules += 1

            except Exception as e:
                # End rule tracking with failure
                self.logger.end_rule_tracking(
                    rule_id=rule_id,
                    rows_processed=0,
                    issues_found=0,
                    memory_usage_mb=0,
                    success=False,
                    error_message=str(e),  # internal logging only
                )

                # Update execution rule with error — store generic message for client-visible note
                if "execution_rule" in locals():
                    execution_rule.note = "Rule execution failed."

                failed_rules += 1
                self.logger.log_error(
                    "Rule execution failed",
                    exception=e,
                    rule_id=rule_id,
                    rule_name=rule_name,
                )

            # Commit after each rule to avoid large transactions
            self.db.commit()

        return all_issues, successful_rules, failed_rules

    def _process_parallel_results(
        self, parallel_results: List[Any], execution: Execution, execution_id: str
    ) -> tuple:
        """Process results from parallel execution"""
        all_issues = []
        successful_rules = 0
        failed_rules = 0

        for result in parallel_results:
            rule_id = result.rule_id
            rule_name = result.rule_name

            # Create execution rule record
            execution_rule = ExecutionRule(
                execution_id=execution.id,
                rule_id=rule_id,
                rule_snapshot=json.dumps(
                    {
                        "rule_id": rule_id,
                        "rule_name": rule_name,
                        "execution_mode": "parallel",
                    }
                ),
            )
            self.db.add(execution_rule)

            if result.success:
                # Create issue records from parallel results
                rule_issues = []
                lightweight_snapshot = create_lightweight_rule_snapshot_from_result(
                    result
                )

                for issue_data in result.issues:
                    if "row_index" not in issue_data or "column_name" not in issue_data:
                        continue

                    issue = Issue(
                        execution_id=execution.id,
                        rule_id=rule_id,
                        rule_snapshot=lightweight_snapshot,
                        row_index=issue_data["row_index"],
                        column_name=issue_data["column_name"],
                        current_value=issue_data.get("current_value"),
                        suggested_value=issue_data.get("suggested_value"),
                        message=issue_data.get("message", "Data quality issue found"),
                        category=issue_data.get("category", "unknown"),
                        severity="medium",  # Default severity for parallel execution
                    )
                    self.db.add(issue)
                    rule_issues.append(issue)
                    all_issues.append(issue)

                # Update execution rule stats
                execution_rule.error_count = len(rule_issues)
                execution_rule.rows_flagged = result.rows_flagged
                execution_rule.cols_flagged = result.cols_flagged

                successful_rules += 1

            else:
                execution_rule.note = (
                    result.error_message or "Parallel execution failed"
                )
                failed_rules += 1

                self.logger.log_error(
                    "Parallel rule execution failed",
                    rule_id=rule_id,
                    rule_name=rule_name,
                    error_message=result.error_message,
                )

        return all_issues, successful_rules, failed_rules


def create_lightweight_rule_snapshot_from_result(result) -> str:
    """Create lightweight rule snapshot from parallel execution result"""
    return json.dumps(
        {
            "rule_id": result.rule_id,
            "rule_name": result.rule_name,
            "execution_mode": "parallel",
            "execution_time_ms": result.execution_time,
            "memory_usage_mb": result.memory_usage,
        }
    )
