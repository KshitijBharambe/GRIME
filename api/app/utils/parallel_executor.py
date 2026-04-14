"""
Parallel rule execution service for GRIME.
Provides thread-safe parallel processing of independent rules with dependency analysis.
"""

import os
import concurrent.futures
import threading
import logging
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass
from enum import Enum
import time
from contextlib import contextmanager

from sqlalchemy.orm import sessionmaker
from app.models import Rule, RuleKind
from app.utils.memory_optimization import MemoryMonitor

logger = logging.getLogger(__name__)


class ExecutionMode(Enum):
    """Execution mode for rule processing"""
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    ADAPTIVE = "adaptive"  # Automatically choose based on system resources


@dataclass
class RuleExecutionResult:
    """Result of a single rule execution"""
    rule_id: str
    rule_name: str
    issues: List[Dict[str, Any]]
    execution_time: float
    memory_usage: float
    success: bool
    error_message: Optional[str] = None
    rows_flagged: int = 0
    cols_flagged: int = 0


@dataclass
class ExecutionStats:
    """Statistics for rule execution"""
    total_rules: int
    successful_rules: int
    failed_rules: int
    total_execution_time: float
    peak_memory_usage: float
    parallel_efficiency: float


class DependencyAnalyzer:
    """Analyzes rule dependencies to determine parallel execution possibilities"""

    def __init__(self):
        self.dependency_cache = {}

    def analyze_dependencies(self, rules: List[Rule]) -> Dict[str, Set[str]]:
        """
        Analyze dependencies between rules.

        Returns:
            Dict mapping rule_id to set of rule_ids it depends on
        """
        dependencies = {}

        for rule in rules:
            rule_deps = set()

            # Cross-field rules may depend on other rules
            rule_kind = getattr(rule, 'kind', None)
            if rule_kind == RuleKind.cross_field:
                rule_deps.update(self._analyze_cross_field_dependencies(rule))

            # Custom rules may have dependencies defined in params
            elif rule_kind == RuleKind.custom:
                rule_deps.update(self._analyze_custom_dependencies(rule))

            rule_id = getattr(rule, 'id', '')
            dependencies[rule_id] = rule_deps

        return dependencies

    def _analyze_cross_field_dependencies(self, rule: Rule) -> Set[str]:
        """Analyze dependencies for cross-field rules"""
        # Cross-field rules typically depend on rules that validate individual fields
        # This is a simplified analysis - could be enhanced based on specific rule params
        return set()

    def _analyze_custom_dependencies(self, rule: Rule) -> Set[str]:
        """Analyze dependencies for custom rules"""
        # Check if custom rule params specify dependencies
        try:
            import json
            params_str = getattr(rule, 'params', None) or ''
            params = json.loads(params_str) if params_str else {}
            return set(params.get('dependencies', []))
        except (json.JSONDecodeError, AttributeError, TypeError, KeyError) as e:
            logger.debug(f"Failed to parse custom rule dependencies: {e}")
            return set()

    def get_execution_groups(self, rules: List[Rule], dependencies: Dict[str, Set[str]]) -> List[List[Rule]]:
        """
        Group rules into execution batches based on dependencies.

        Returns:
            List of execution groups, where each group can run in parallel
        """
        if not dependencies:
            return [rules]

        # Build dependency graph
        remaining_rules = {getattr(rule, 'id', ''): rule for rule in rules}
        processed_rules = set()
        execution_groups = []

        while remaining_rules:
            current_group = []

            # Find rules with no unprocessed dependencies
            for rule_id, rule in list(remaining_rules.items()):
                deps = dependencies.get(rule_id, set())
                if deps.issubset(processed_rules):
                    current_group.append(rule)
                    del remaining_rules[rule_id]
                    processed_rules.add(rule_id)

            if current_group:
                execution_groups.append(current_group)
            else:
                # Circular dependency or orphaned rules - process them sequentially
                logger.warning(
                    "Circular dependency detected, processing remaining rules sequentially")
                execution_groups.append(list(remaining_rules.values()))
                break

        return execution_groups


class ThreadSafeSessionManager:
    """Manages database sessions for parallel execution"""

    def __init__(self, session_factory: sessionmaker):
        self.session_factory = session_factory
        self.local_sessions = threading.local()

    @contextmanager
    def get_session(self):
        """Get a thread-local database session"""
        if not hasattr(self.local_sessions, 'session'):
            self.local_sessions.session = self.session_factory()

        session = self.local_sessions.session
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            # Don't close thread-local sessions, just flush
            session.flush()

    def cleanup_threads(self):
        """Cleanup sessions for finished threads"""
        if hasattr(self.local_sessions, 'session'):
            try:
                self.local_sessions.session.close()
            except Exception as e:
                logger.debug(f"Failed to close thread-local session: {e}")
            delattr(self.local_sessions, 'session')


class ParallelRuleExecutor:
    """Service for parallel rule execution with dependency management"""

    def __init__(
        self,
        db_session_factory: sessionmaker,
        max_workers: Optional[int] = None,
        execution_mode: ExecutionMode = ExecutionMode.ADAPTIVE
    ):
        """
        Initialize parallel executor.

        Args:
            db_session_factory: SQLAlchemy session factory
            max_workers: Maximum number of worker threads (None = auto)
            execution_mode: How to execute rules (sequential/parallel/adaptive)
        """
        self.session_manager = ThreadSafeSessionManager(db_session_factory)
        self.max_workers = max_workers or min(4, (os.cpu_count() or 1) + 1)
        self.execution_mode = execution_mode
        self.dependency_analyzer = DependencyAnalyzer()

        # Performance tracking
        self.execution_stats = None

    def execute_rules(
        self,
        rules: List[Rule],
        df,  # pandas DataFrame
        validators: Dict[RuleKind, type],
        execution_id: Optional[str] = None
    ) -> List[RuleExecutionResult]:
        """
        Execute rules with optimal parallelization.

        Args:
            rules: List of rules to execute
            df: DataFrame to validate
            validators: Mapping of rule kinds to validator classes
            execution_id: Execution ID for logging

        Returns:
            List of rule execution results
        """
        logger.info(
            f"Executing {len(rules)} rules in {self.execution_mode.value} mode")

        if not rules:
            return []

        # Choose execution strategy
        if self.execution_mode == ExecutionMode.SEQUENTIAL:
            return self._execute_sequential(rules, df, validators, execution_id)
        elif self.execution_mode == ExecutionMode.PARALLEL:
            return self._execute_parallel(rules, df, validators, execution_id)
        else:  # ADAPTIVE
            return self._execute_adaptive(rules, df, validators, execution_id)

    def _execute_sequential(
        self,
        rules: List[Rule],
        df,
        validators: Dict[RuleKind, type],
        execution_id: Optional[str]
    ) -> List[RuleExecutionResult]:
        """Execute rules sequentially"""
        results = []
        start_time = time.time()

        for rule in rules:
            result = self._execute_single_rule(
                rule, df, validators, execution_id)
            results.append(result)

        self._update_execution_stats(results, time.time() - start_time)
        return results

    def _execute_parallel(
        self,
        rules: List[Rule],
        df,
        validators: Dict[RuleKind, type],
        execution_id: Optional[str]
    ) -> List[RuleExecutionResult]:
        """Execute rules in parallel (ignoring dependencies)"""
        results = []
        start_time = time.time()

        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all rules for execution
            future_to_rule = {
                executor.submit(self._execute_single_rule, rule, df, validators, execution_id): rule
                for rule in rules
            }

            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_rule):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    rule = future_to_rule[future]
                    rule_id = getattr(rule, 'id', '')
                    rule_name = getattr(rule, 'name', '')
                    logger.error(f"Rule {rule_id} failed: {str(e)}")
                    results.append(RuleExecutionResult(
                        rule_id=rule_id,
                        rule_name=rule_name,
                        issues=[],
                        execution_time=0,
                        memory_usage=0,
                        success=False,
                        error_message=str(e)
                    ))

        self._update_execution_stats(results, time.time() - start_time)
        return results

    def _execute_adaptive(
        self,
        rules: List[Rule],
        df,
        validators: Dict[RuleKind, type],
        execution_id: Optional[str]
    ) -> List[RuleExecutionResult]:
        """Execute rules with adaptive strategy based on dependencies and resources"""
        # Analyze dependencies
        dependencies = self.dependency_analyzer.analyze_dependencies(rules)
        execution_groups = self.dependency_analyzer.get_execution_groups(
            rules, dependencies)

        logger.info(
            f"Executing {len(rules)} rules in {len(execution_groups)} dependency groups")

        all_results = []
        start_time = time.time()

        for group_idx, group in enumerate(execution_groups):
            logger.info(
                f"Executing dependency group {group_idx + 1}/{len(execution_groups)} with {len(group)} rules")

            if len(group) == 1:
                # Single rule, execute sequentially
                result = self._execute_single_rule(
                    group[0], df, validators, execution_id)
                all_results.append(result)
            else:
                # Multiple rules, execute in parallel
                group_results = self._execute_parallel(
                    group, df, validators, execution_id)
                all_results.extend(group_results)

        self._update_execution_stats(all_results, time.time() - start_time)
        return all_results

    def _execute_single_rule(
        self,
        rule: Rule,
        df,
        validators: Dict[RuleKind, type],
        execution_id: Optional[str]
    ) -> RuleExecutionResult:
        """Execute a single rule with memory monitoring"""
        start_time = time.time()
        initial_memory = MemoryMonitor.get_memory_usage()['rss_mb']

        try:
            with self.session_manager.get_session() as session:
                # Get validator class
                rule_kind = getattr(rule, 'kind', None)
                if rule_kind is None:
                    raise ValueError("Rule has no kind specified")
                validator_class = validators.get(rule_kind)
                if not validator_class:
                    raise ValueError(
                        f"No validator for rule kind: {rule_kind}")

                # Create validator and execute
                validator = validator_class(rule, df, session)
                issues = validator.validate()

                # Calculate metrics
                execution_time = time.time() - start_time
                final_memory = MemoryMonitor.get_memory_usage()['rss_mb']
                memory_usage = final_memory - initial_memory

                # Calculate rows/columns flagged
                rows_flagged = len(set(issue.get('row_index')
                                   for issue in issues)) if issues else 0
                cols_flagged = len(set(issue.get('column_name')
                                   for issue in issues)) if issues else 0

                rule_id = getattr(rule, 'id', '')
                rule_name = getattr(rule, 'name', '')
                logger.info(
                    f"Rule {rule_name} completed: {len(issues)} issues, "
                    f"{execution_time:.2f}s, {memory_usage:.2f}MB"
                )

                return RuleExecutionResult(
                    rule_id=rule_id,
                    rule_name=rule_name,
                    issues=issues,
                    execution_time=execution_time,
                    memory_usage=memory_usage,
                    success=True,
                    rows_flagged=rows_flagged,
                    cols_flagged=cols_flagged
                )

        except Exception as e:
            execution_time = time.time() - start_time
            final_memory = MemoryMonitor.get_memory_usage()['rss_mb']
            memory_usage = final_memory - initial_memory

            rule_id = getattr(rule, 'id', '')
            rule_name = getattr(rule, 'name', '')
            logger.error(f"Rule {rule_name} failed: {str(e)}")

            return RuleExecutionResult(
                rule_id=rule_id,
                rule_name=rule_name,
                issues=[],
                execution_time=execution_time,
                memory_usage=memory_usage,
                success=False,
                error_message=str(e)
            )

    def _update_execution_stats(self, results: List[RuleExecutionResult], total_time: float):
        """Update execution statistics"""
        successful_rules = sum(1 for r in results if r.success)
        failed_rules = len(results) - successful_rules
        peak_memory = max((r.memory_usage for r in results), default=0)

        # Calculate parallel efficiency (compared to sequential execution)
        sequential_time = sum(r.execution_time for r in results)
        parallel_efficiency = sequential_time / total_time if total_time > 0 else 1.0

        self.execution_stats = ExecutionStats(
            total_rules=len(results),
            successful_rules=successful_rules,
            failed_rules=failed_rules,
            total_execution_time=total_time,
            peak_memory_usage=peak_memory,
            parallel_efficiency=parallel_efficiency
        )

        logger.info(
            f"Execution completed: {successful_rules}/{len(results)} successful, "
            f"{total_time:.2f}s total, {parallel_efficiency:.1f}x efficiency"
        )

    def get_execution_stats(self) -> Optional[ExecutionStats]:
        """Get execution statistics"""
        return self.execution_stats

    def cleanup(self):
        """Cleanup resources"""
        self.session_manager.cleanup_threads()


# Import os for CPU count
