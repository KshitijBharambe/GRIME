"""
Service for managing rule dependencies and execution order.
"""

import json
from typing import List, Dict, Any, Set, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models import Rule
from app.utils.logging_service import get_logger


logger = get_logger()


class DependencyError(Exception):
    """Custom exception for dependency-related errors."""
    pass


class DependencyGraph:
    """Represents a dependency graph for rules."""

    def __init__(self):
        self.nodes: Set[str] = set()  # Rule IDs
        # rule_id -> set of dependent rule IDs
        self.edges: Dict[str, Set[str]] = {}
        # rule_id -> set of rules that depend on it
        self.reverse_edges: Dict[str, Set[str]] = {}
        # rule_id -> priority (lower = higher priority)
        self.priorities: Dict[str, int] = {}
        self.groups: Dict[str, str] = {}  # rule_id -> group name

    def add_rule(self, rule_id: str, dependencies: Optional[List[str]] = None,
                 priority: int = 0, group: Optional[str] = None) -> None:
        """Add a rule to the graph."""
        self.nodes.add(rule_id)
        self.edges[rule_id] = set(dependencies or [])
        self.priorities[rule_id] = priority
        if group:
            self.groups[rule_id] = group

        # Update reverse edges
        for dep in dependencies or []:
            if dep not in self.reverse_edges:
                self.reverse_edges[dep] = set()
            self.reverse_edges[dep].add(rule_id)

    def detect_circular_dependencies(self) -> List[List[str]]:
        """Detect circular dependencies using DFS."""
        visited = set()
        rec_stack = set()
        cycles = []

        def dfs(node: str, path: List[str]) -> bool:
            if node in rec_stack:
                # Found a cycle
                cycle_start = path.index(node)
                cycles.append(path[cycle_start:] + [node])
                return True

            if node in visited:
                return False

            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in self.edges.get(node, []):
                if neighbor in self.nodes and dfs(neighbor, path.copy()):
                    return True

            rec_stack.remove(node)
            return False

        for node in self.nodes:
            if node not in visited:
                dfs(node, [])

        return cycles

    def topological_sort(self) -> List[str]:
        """Get topological order of rules, considering priorities."""
        # Kahn's algorithm with priority consideration
        in_degree = {node: 0 for node in self.nodes}

        # Calculate in-degrees
        for node in self.nodes:
            for neighbor in self.edges.get(node, []):
                if neighbor in self.nodes:
                    in_degree[neighbor] += 1

        # Start with nodes having no dependencies
        queue = [node for node in self.nodes if in_degree[node] == 0]

        # Sort by priority (lower numbers first) and then by group
        queue.sort(key=lambda x: (
            self.priorities.get(x, 0), self.groups.get(x, "")))

        result = []
        while queue:
            node = queue.pop(0)
            result.append(node)

            # Update in-degrees of neighbors
            for neighbor in self.edges.get(node, []):
                if neighbor in self.nodes:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        queue.append(neighbor)

            # Re-sort queue to maintain priority order
            queue.sort(key=lambda x: (
                self.priorities.get(x, 0), self.groups.get(x, "")))

        # Check if topological sort was successful
        if len(result) != len(self.nodes):
            raise DependencyError(
                "Circular dependency detected during topological sort")

        return result

    def get_dependency_levels(self) -> Dict[str, int]:
        """Get dependency levels for each rule (0 = no dependencies)."""
        levels = {node: 0 for node in self.nodes}
        changed = True

        while changed:
            changed = False
            for node in self.nodes:
                for dep in self.edges.get(node, []):
                    if dep in self.nodes and levels[dep] + 1 > levels[node]:
                        levels[node] = levels[dep] + 1
                        changed = True

        return levels


class DependencyManager:
    """Service for managing rule dependencies."""

    def __init__(self, db: Session):
        self.db = db
        self.logger = get_logger()

    def build_dependency_graph(self, rule_ids: List[str] = None) -> DependencyGraph:
        """
        Build dependency graph for rules.

        Args:
            rule_ids: Specific rule IDs to include, or None for all active rules

        Returns:
            DependencyGraph object
        """
        graph = DependencyGraph()

        # Get rules
        query = self.db.query(Rule).filter(Rule.is_active == True)
        if rule_ids:
            query = query.filter(Rule.id.in_(rule_ids))

        rules = query.all()

        # Build graph
        for rule in rules:
            # Parse dependencies
            dependencies = []
            if rule.dependencies:
                try:
                    dependencies = json.loads(rule.dependencies)
                except json.JSONDecodeError:
                    self.logger.log_warning(
                        f"Invalid JSON in dependencies for rule {rule.id}",
                        rule_id=rule.id
                    )

            # Add rule to graph
            graph.add_rule(
                rule_id=str(rule.id),
                dependencies=dependencies,
                priority=int(rule.priority or 0),
                group=str(
                    rule.dependency_group) if rule.dependency_group else None
            )

        return graph

    def validate_dependencies(self, rule_ids: List[str] = None) -> Dict[str, Any]:
        """
        Validate rule dependencies.

        Args:
            rule_ids: Specific rule IDs to validate, or None for all active rules

        Returns:
            Validation result with any issues found
        """
        graph = self.build_dependency_graph(rule_ids)

        # Check for circular dependencies
        cycles = graph.detect_circular_dependencies()

        # Check for missing dependencies
        missing_deps = set()
        for rule_id, deps in graph.edges.items():
            for dep in deps:
                if dep not in graph.nodes:
                    missing_deps.add(dep)

        # Check for self-dependencies
        self_deps = []
        for rule_id, deps in graph.edges.items():
            if rule_id in deps:
                self_deps.append(rule_id)

        return {
            'is_valid': len(cycles) == 0 and len(missing_deps) == 0 and len(self_deps) == 0,
            'circular_dependencies': cycles,
            'missing_dependencies': list(missing_deps),
            'self_dependencies': self_deps,
            'total_rules': len(graph.nodes),
            'total_dependencies': sum(len(deps) for deps in graph.edges.values())
        }

    def get_execution_order(self, rule_ids: List[str] = None) -> List[str]:
        """
        Get optimal execution order for rules.

        Args:
            rule_ids: Specific rule IDs to order, or None for all active rules

        Returns:
            List of rule IDs in execution order

        Raises:
            DependencyError: If circular dependencies are detected
        """
        graph = self.build_dependency_graph(rule_ids)

        # Validate dependencies first
        validation = self.validate_dependencies(rule_ids)
        if not validation['is_valid']:
            error_msg = "Dependency validation failed"
            if validation['circular_dependencies']:
                error_msg += f": Circular dependencies found: {validation['circular_dependencies']}"
            if validation['missing_dependencies']:
                error_msg += f": Missing dependencies: {validation['missing_dependencies']}"
            if validation['self_dependencies']:
                error_msg += f": Self-dependencies: {validation['self_dependencies']}"
            raise DependencyError(error_msg)

        # Get topological order
        try:
            execution_order = graph.topological_sort()

            self.logger.log_info(
                "Generated execution order",
                total_rules=len(execution_order),
                rule_ids=execution_order[:10] if len(
                    execution_order) > 10 else execution_order
            )

            return execution_order

        except DependencyError as e:
            self.logger.log_error(
                "Failed to generate execution order",
                exception=e,
                validation_result=validation
            )
            raise

    def get_dependency_info(self, rule_id: str) -> Dict[str, Any]:
        """Get detailed dependency information for a specific rule."""
        rule = self.db.query(Rule).filter(Rule.id == rule_id).first()
        if not rule:
            raise DependencyError(f"Rule {rule_id} not found")

        # Parse dependencies
        dependencies = []
        if rule.dependencies:
            try:
                dependencies = json.loads(rule.dependencies)
            except json.JSONDecodeError:
                self.logger.log_warning(
                    f"Invalid JSON in dependencies for rule {rule_id}",
                    rule_id=rule_id
                )

        # Get dependent rules (rules that depend on this rule)
        dependent_rules = self.db.query(Rule).filter(
            and_(
                Rule.is_active == True,
                Rule.dependencies.isnot(None)
            )
        ).all()

        dependents = []
        for dependent_rule in dependent_rules:
            try:
                deps = json.loads(dependent_rule.dependencies)
                if rule_id in deps:
                    dependents.append({
                        'id': dependent_rule.id,
                        'name': dependent_rule.name,
                        'kind': dependent_rule.kind.value
                    })
            except json.JSONDecodeError:
                continue

        # Get dependency details
        dependency_details = []
        for dep_id in dependencies:
            dep_rule = self.db.query(Rule).filter(Rule.id == dep_id).first()
            if dep_rule:
                dependency_details.append({
                    'id': dep_rule.id,
                    'name': dep_rule.name,
                    'kind': dep_rule.kind.value,
                    'is_active': dep_rule.is_active
                })

        return {
            'rule_id': rule_id,
            'rule_name': rule.name,
            'rule_kind': rule.kind.value,
            'priority': rule.priority,
            'dependency_group': rule.dependency_group,
            'dependencies': dependency_details,
            'dependents': dependents,
            'dependency_count': len(dependencies),
            'dependent_count': len(dependents)
        }

    def update_rule_dependencies(self, rule_id: str, dependencies: List[str],
                                 priority: int = None, dependency_group: str = None) -> None:
        """
        Update dependencies for a rule.

        Args:
            rule_id: Rule to update
            dependencies: List of dependent rule IDs
            priority: Priority (lower = higher priority)
            dependency_group: Dependency group name
        """
        rule = self.db.query(Rule).filter(Rule.id == rule_id).first()
        if not rule:
            raise DependencyError(f"Rule {rule_id} not found")

        # Validate dependencies exist
        if dependencies:
            existing_rules = self.db.query(Rule.id).filter(
                and_(
                    Rule.id.in_(dependencies),
                    Rule.is_active == True
                )
            ).all()
            existing_ids = [r.id for r in existing_rules]

            missing = set(dependencies) - set(existing_ids)
            if missing:
                raise DependencyError(
                    f"Dependency rules not found: {list(missing)}")

        # Update rule
        rule.dependencies = json.dumps(dependencies) if dependencies else None
        if priority is not None:
            rule.priority = priority
        if dependency_group is not None:
            rule.dependency_group = dependency_group

        self.db.commit()

        self.logger.log_info(
            "Updated rule dependencies",
            rule_id=rule_id,
            dependencies=dependencies,
            priority=priority,
            dependency_group=dependency_group
        )

    def get_rules_by_group(self, group_name: str = None) -> Dict[str, List[Dict[str, Any]]]:
        """Get rules grouped by dependency group."""
        query = self.db.query(Rule).filter(Rule.is_active == True)

        if group_name:
            query = query.filter(Rule.dependency_group == group_name)

        rules = query.all()

        groups = {}
        for rule in rules:
            group = rule.dependency_group or 'default'
            if group not in groups:
                groups[group] = []

            groups[group].append({
                'id': rule.id,
                'name': rule.name,
                'kind': rule.kind.value,
                'priority': rule.priority,
                'dependencies': json.loads(rule.dependencies) if rule.dependencies else []
            })

        # Sort each group by priority
        for group_rules in groups.values():
            group_rules.sort(key=lambda x: x['priority'])

        return groups

    def analyze_dependencies(self) -> Dict[str, Any]:
        """Analyze dependency structure across all rules."""
        graph = self.build_dependency_graph()

        # Get dependency levels
        levels = graph.get_dependency_levels()

        # Count rules per level
        level_counts = {}
        for level in levels.values():
            level_counts[level] = level_counts.get(level, 0) + 1

        # Find rules with most dependencies/dependents
        max_deps = max((len(deps) for deps in graph.edges.values()), default=0)
        max_dependents = max((len(deps)
                             for deps in graph.reverse_edges.values()), default=0)

        rules_with_most_deps = [
            rule_id for rule_id, deps in graph.edges.items() if len(deps) == max_deps
        ]
        rules_with_most_dependents = [
            rule_id for rule_id, deps in graph.reverse_edges.items() if len(deps) == max_dependents
        ]

        return {
            'total_rules': len(graph.nodes),
            'rules_with_dependencies': len([r for r, deps in graph.edges.items() if deps]),
            'max_dependency_depth': max(levels.values()) if levels else 0,
            'dependency_levels': level_counts,
            'rules_with_most_dependencies': {
                'count': max_deps,
                'rules': rules_with_most_deps[:5]  # Limit to 5 for readability
            },
            'rules_with_most_dependents': {
                'count': max_dependents,
                'rules': rules_with_most_dependents[:5]
            },
            'groups': len(set(graph.groups.values())) - (1 if 'default' in graph.groups.values() else 0)
        }
