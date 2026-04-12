"""
Secure sandbox for executing custom code with resource limits and safety controls.
"""

import ast
import os
import traceback
import signal
import resource
import time
import threading
from contextlib import contextmanager
from typing import Any, Dict, List

from app.utils.logging_service import get_logger


logger = get_logger()


class SecurityError(Exception):
    """Exception raised for security violations."""

    pass


class ResourceLimitError(Exception):
    """Exception raised when resource limits are exceeded."""

    pass


def validate_sandbox_config(
    max_memory_mb: int = 100,
    max_cpu_time: float = 5.0,
    max_execution_time: float = 10.0,
    security_level: str = "high",
) -> None:
    """
    Validate sandbox configuration against environment requirements.

    In production, enforces strict security thresholds. In other environments,
    logs warnings for weak settings.

    Raises:
        RuntimeError: If production settings are too permissive.
    """
    _logger = get_logger()
    environment = os.environ.get("ENVIRONMENT", "development").lower()
    is_production = environment == "production"

    violations: list[str] = []

    if max_memory_mb > 100:
        violations.append(
            f"max_memory_mb={max_memory_mb} exceeds production limit of 100 MB"
        )
    if max_cpu_time > 5.0:
        violations.append(
            f"max_cpu_time={max_cpu_time} exceeds production limit of 5.0 s"
        )
    if max_execution_time > 10.0:
        violations.append(
            f"max_execution_time={max_execution_time} exceeds production limit of 10.0 s"
        )
    if security_level != "high":
        violations.append(
            f"security_level='{security_level}' must be 'high' in production"
        )

    if violations:
        if is_production:
            raise RuntimeError(
                "Sandbox security settings too permissive for production: "
                + "; ".join(violations)
            )
        else:
            for v in violations:
                _logger.log_warning(f"Sandbox config warning ({environment}): {v}")


class SecureExecutor:
    """
    Secure executor for custom code with resource limits and safety controls.
    """

    # Allowed built-in functions and modules
    ALLOWED_BUILTINS = {
        "abs": abs,
        "len": len,
        "str": str,
        "int": int,
        "float": float,
        "bool": bool,
        "list": list,
        "dict": dict,
        "set": set,
        "tuple": tuple,
        "min": min,
        "max": max,
        "sum": sum,
        "round": round,
        "sorted": sorted,
        "enumerate": enumerate,
        "range": range,
        "zip": zip,
        "any": any,
        "all": all,
        "isinstance": isinstance,
        "type": type,
    }

    # Dangerous modules to block
    BLOCKED_MODULES = {
        "os",
        "sys",
        "subprocess",
        "shutil",
        "glob",
        "pickle",
        "marshal",
        "codecs",
        "socket",
        "urllib",
        "http",
        "ftplib",
        "smtplib",
        "telnetlib",
        "uuid",
        "hashlib",
        "hmac",
        "secrets",
        "ssl",
        "threading",
        "multiprocessing",
        "concurrent",
        "asyncio",
        "importlib",
        "imp",
        "pkgutil",
        "inspect",
        "compile",
        "execfile",
        "reload",
        "__import__",
        "eval",
        "exec",
        "open",
        "file",
        "input",
        "raw_input",
        "help",
        "exit",
        "quit",
    }

    def __init__(
        self,
        max_memory_mb: int = 100,
        max_cpu_time: float = 5.0,
        max_execution_time: float = 10.0,
    ):
        """
        Initialize secure executor.

        Args:
            max_memory_mb: Maximum memory usage in MB
            max_cpu_time: Maximum CPU time in seconds
            max_execution_time: Maximum wall clock time in seconds
        """
        self.max_memory_mb = max_memory_mb
        self.max_cpu_time = max_cpu_time
        self.max_execution_time = max_execution_time
        self.logger = get_logger()

        # Thread-local storage for execution context
        self._local = threading.local()

    @contextmanager
    def _resource_limits(self):
        """Context manager for applying resource limits."""
        # Set memory limit
        memory_limit = self.max_memory_mb * 1024 * 1024  # Convert to bytes
        old_memory_limit = resource.getrlimit(resource.RLIMIT_AS)
        resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))

        # Set CPU time limit
        old_cpu_limit = resource.getrlimit(resource.RLIMIT_CPU)
        cpu_seconds = int(self.max_cpu_time)
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))

        try:
            yield
        finally:
            # Restore original limits
            resource.setrlimit(resource.RLIMIT_AS, old_memory_limit)
            resource.setrlimit(resource.RLIMIT_CPU, old_cpu_limit)

    def _timeout_handler(self, signum, frame):
        """Handler for execution timeout."""
        raise ResourceLimitError(
            f"Execution timeout exceeded ({self.max_execution_time}s)"
        )

    def _validate_code(self, code_str: str) -> ast.AST:
        """
        Validate code for security violations.

        Args:
            code_str: Code string to validate

        Returns:
            Parsed AST

        Raises:
            SecurityError: If code contains security violations
        """
        try:
            tree = ast.parse(code_str)
        except SyntaxError as e:
            raise SecurityError(f"Syntax error in code: {str(e)}")

        # Check for dangerous operations
        for node in ast.walk(tree):
            # Check for imports of blocked modules
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name in self.BLOCKED_MODULES:
                        raise SecurityError(f"Import of blocked module: {alias.name}")

            elif isinstance(node, ast.ImportFrom):
                if node.module and node.module in self.BLOCKED_MODULES:
                    raise SecurityError(f"Import from blocked module: {node.module}")

            # Check for function calls to dangerous functions
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in {"eval", "exec", "compile", "__import__"}:
                        raise SecurityError(
                            f"Call to dangerous function: {node.func.id}"
                        )

                # Check for attribute access that might be dangerous
                elif isinstance(node.func, ast.Attribute):
                    if node.func.attr in {"__import__", "eval", "exec"}:
                        raise SecurityError(
                            f"Call to dangerous method: {node.func.attr}"
                        )

            # Check for attribute access to dangerous modules
            elif isinstance(node, ast.Attribute):
                if isinstance(node.value, ast.Name):
                    if node.value.id in self.BLOCKED_MODULES:
                        raise SecurityError(
                            f"Access to blocked module: {node.value.id}"
                        )

        return tree

    def _create_safe_context(
        self, additional_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Create safe execution context.

        Args:
            additional_context: Additional variables to include in context

        Returns:
            Safe execution context
        """
        context = {
            "__builtins__": self.ALLOWED_BUILTINS,
            "__name__": "__secure_exec__",
            "__doc__": "Secure execution environment",
            "__package__": None,
        }

        # Add additional context if provided
        if additional_context:
            # Only add safe objects
            for key, value in additional_context.items():
                if key not in self.BLOCKED_MODULES and not key.startswith("__"):
                    context[key] = value

        return context

    def execute_code(
        self,
        code_str: str,
        context: Dict[str, Any] = None,
        allowed_result_types: tuple = (
            bool,
            int,
            float,
            str,
            list,
            dict,
            tuple,
            type(None),
        ),
    ) -> Any:
        """
        Execute code securely with resource limits.

        Args:
            code_str: Code to execute
            context: Additional context variables
            allowed_result_types: Tuple of allowed return types

        Returns:
            Execution result

        Raises:
            SecurityError: If code contains security violations
            ResourceLimitError: If resource limits are exceeded
        """
        execution_id = f"exec_{int(time.time())}"

        self.logger.log_info(
            "Starting secure code execution",
            execution_id=execution_id,
            code_length=len(code_str),
        )

        # Validate code
        tree = self._validate_code(code_str)

        # Create safe context
        safe_context = self._create_safe_context(context)

        # Set up timeout handler
        old_handler = signal.signal(signal.SIGALRM, self._timeout_handler)

        try:
            # Set execution timeout
            signal.alarm(int(self.max_execution_time))

            # Execute with resource limits
            with self._resource_limits():
                # Compile and execute
                start_time = time.time()

                try:
                    compiled_code = compile(tree, filename="<secure_code>", mode="eval")
                    result = eval(compiled_code, safe_context)
                except SyntaxError:
                    # If it's not an expression, try as statement
                    compiled_code = compile(tree, filename="<secure_code>", mode="exec")
                    exec(compiled_code, safe_context)
                    result = safe_context.get("_result", None)

                execution_time = time.time() - start_time

                # Validate result type
                if not isinstance(result, allowed_result_types):
                    raise SecurityError(
                        f"Invalid result type: {type(result)}. "
                        f"Allowed types: {allowed_result_types}"
                    )

                self.logger.log_info(
                    "Secure code execution completed",
                    execution_id=execution_id,
                    execution_time=execution_time,
                    result_type=type(result).__name__,
                )

                return result

        except ResourceLimitError:
            self.logger.log_error(
                "Secure code execution exceeded resource limits",
                execution_id=execution_id,
            )
            raise

        except SecurityError:
            self.logger.log_error(
                "Secure code execution security violation", execution_id=execution_id
            )
            raise

        except Exception as e:
            self.logger.log_error(
                "Secure code execution failed",
                execution_id=execution_id,
                exception=e,
                traceback=traceback.format_exc(),
            )
            raise SecurityError(f"Code execution failed: {str(e)}")

        finally:
            # Clean up
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)

    def validate_expression(self, expression: str) -> bool:
        """
        Validate if an expression is safe to execute.

        Args:
            expression: Expression to validate

        Returns:
            True if safe, False otherwise
        """
        try:
            self._validate_code(expression)
            return True
        except SecurityError:
            return False

    def get_execution_stats(self) -> Dict[str, Any]:
        """Get execution statistics."""
        return {
            "max_memory_mb": self.max_memory_mb,
            "max_cpu_time": self.max_cpu_time,
            "max_execution_time": self.max_execution_time,
            "allowed_builtins_count": len(self.ALLOWED_BUILTINS),
            "blocked_modules_count": len(self.BLOCKED_MODULES),
        }


class CustomCodeValidator:
    """
    Validator for custom code rules with security controls.
    """

    def __init__(self, security_level: str = "medium"):
        """
        Initialize custom code validator.

        Args:
            security_level: Security level ('low', 'medium', 'high')
        """
        self.security_level = security_level
        self.logger = get_logger()

        # Configure executor based on security level
        if security_level == "low":
            self.executor = SecureExecutor(
                max_memory_mb=200, max_cpu_time=10.0, max_execution_time=30.0
            )
        elif security_level == "medium":
            self.executor = SecureExecutor(
                max_memory_mb=100, max_cpu_time=5.0, max_execution_time=10.0
            )
        else:  # high
            self.executor = SecureExecutor(
                max_memory_mb=50, max_cpu_time=2.0, max_execution_time=5.0
            )

        # Validate sandbox settings for the current environment
        validate_sandbox_config(
            max_memory_mb=self.executor.max_memory_mb,
            max_cpu_time=self.executor.max_cpu_time,
            max_execution_time=self.executor.max_execution_time,
            security_level=self.security_level,
        )

    def validate_custom_code(
        self, code: str, sample_data: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Validate custom code for security and functionality.

        Args:
            code: Custom code to validate
            sample_data: Sample data for testing

        Returns:
            Validation result
        """
        result = {
            "is_valid": False,
            "security_issues": [],
            "functionality_issues": [],
            "execution_stats": {},
        }

        try:
            # Security validation
            if not self.executor.validate_expression(code):
                result["security_issues"].append("Code contains security violations")
                return result

            # Functionality testing with sample data
            if sample_data:
                test_context = {
                    "row": sample_data[0] if sample_data else {},
                    "pd": self._get_safe_pandas(),
                    "sample_data": sample_data[:5],  # Limit sample size
                }

                try:
                    test_result = self.executor.execute_code(code, test_context)
                    result["is_valid"] = True
                    result["test_result"] = str(test_result)
                except Exception as e:
                    result["functionality_issues"].append(
                        f"Execution test failed: {str(e)}"
                    )
            else:
                result["is_valid"] = True

            result["execution_stats"] = self.executor.get_execution_stats()

        except Exception as e:
            result["security_issues"].append(f"Validation error: {str(e)}")

        return result

    def _get_safe_pandas(self):
        """Get a safe pandas-like interface for basic operations."""

        class SafePandas:
            @staticmethod
            def isna(value):
                """Safe version of pandas.isna"""
                return value is None or value == ""

            @staticmethod
            def to_numeric(value, errors="coerce"):
                """Safe numeric conversion"""
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return None if errors == "coerce" else value

        return SafePandas()

    def execute_custom_validation(
        self,
        code: str,
        row_data: Dict[str, Any],
        additional_context: Dict[str, Any] = None,
    ) -> bool:
        """
        Execute custom validation code securely.

        Args:
            code: Validation code to execute
            row_data: Row data to validate
            additional_context: Additional context variables

        Returns:
            Validation result (True/False)
        """
        context = {
            "row": row_data,
            "pd": self._get_safe_pandas(),
        }

        if additional_context:
            context.update(additional_context)

        try:
            result = self.executor.execute_code(
                code, context, allowed_result_types=(bool,)
            )
            return bool(result)
        except Exception as e:
            self.logger.log_error(
                "Custom validation execution failed",
                exception=e,
                code_snippet=code[:100] + "..." if len(code) > 100 else code,
            )
            return False
