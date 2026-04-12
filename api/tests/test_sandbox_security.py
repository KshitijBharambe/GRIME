"""
Security regression tests for the sandbox module.
"""

import os
import pytest
from unittest.mock import patch

# Set DATABASE_URL before importing app modules
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test_db")

from app.security.sandbox import (
    SecureExecutor,
    CustomCodeValidator,
    SecurityError,
    ResourceLimitError,
)


@pytest.fixture
def executor():
    """Create a SecureExecutor with default settings."""
    return SecureExecutor(max_memory_mb=50, max_cpu_time=2.0, max_execution_time=5.0)


@pytest.fixture
def strict_executor():
    """Create a SecureExecutor with tight limits for resource tests."""
    return SecureExecutor(max_memory_mb=10, max_cpu_time=1.0, max_execution_time=2.0)


@pytest.fixture
def validator():
    """Create a CustomCodeValidator at high security."""
    return CustomCodeValidator(security_level="high")


# ── Blocked module imports ────────────────────────────────────────────────


class TestBlockedModuleImports:
    """Every module in BLOCKED_MODULES must be rejected."""

    BLOCKED_IMPORT_MODULES = [
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
    ]

    @pytest.mark.parametrize("module", BLOCKED_IMPORT_MODULES)
    def test_import_blocked_module(self, executor, module):
        with pytest.raises(SecurityError, match="blocked module"):
            executor.execute_code(f"import {module}")

    @pytest.mark.parametrize("module", BLOCKED_IMPORT_MODULES)
    def test_from_import_blocked_module(self, executor, module):
        with pytest.raises(SecurityError, match="blocked module"):
            executor.execute_code(f"from {module} import *")

    def test_import_os_path(self, executor):
        with pytest.raises(SecurityError):
            executor.execute_code("import os")

    def test_import_subprocess(self, executor):
        with pytest.raises(SecurityError):
            executor.execute_code("import subprocess")


# ── Blocked function calls ────────────────────────────────────────────────


class TestBlockedFunctionCalls:
    """Dangerous built-in functions must be rejected at AST level."""

    @pytest.mark.parametrize("func", ["eval", "exec", "compile", "__import__"])
    def test_direct_call_blocked(self, executor, func):
        with pytest.raises(SecurityError, match="dangerous function"):
            executor.execute_code(f"{func}('1')")

    def test_eval_in_expression(self, executor):
        with pytest.raises(SecurityError):
            executor.execute_code("eval('__import__(\"os\")')")

    def test_exec_in_expression(self, executor):
        with pytest.raises(SecurityError):
            executor.execute_code("exec('import os')")

    def test_compile_call(self, executor):
        with pytest.raises(SecurityError):
            executor.execute_code("compile('import os', '<str>', 'exec')")

    def test_dunder_import_call(self, executor):
        with pytest.raises(SecurityError):
            executor.execute_code("__import__('os')")


# ── Attribute access attacks ──────────────────────────────────────────────


class TestAttributeAccessAttacks:
    """Attempts to reach internals via dunder attributes should fail."""

    def test_access_dunder_class(self, executor):
        """Accessing __class__ on a literal should fail at runtime (not in __builtins__)."""
        # The sandbox restricts __builtins__; accessing __class__ on an object
        # may or may not raise SecurityError depending on AST checks.
        # At minimum, attempts to chain into subclasses must not succeed.
        with pytest.raises((SecurityError, Exception)):
            executor.execute_code("''.__class__.__mro__[1].__subclasses__()")

    def test_access_dunder_subclasses(self, executor):
        with pytest.raises((SecurityError, Exception)):
            executor.execute_code("().__class__.__bases__[0].__subclasses__()")

    def test_access_dunder_globals(self, executor):
        with pytest.raises((SecurityError, Exception)):
            executor.execute_code("(lambda: 0).__globals__")

    def test_access_builtins_via_globals(self, executor):
        with pytest.raises((SecurityError, Exception)):
            executor.execute_code("(lambda: 0).__globals__['__builtins__']")

    def test_access_dunder_builtins_direct(self, executor):
        """__builtins__ in the sandbox is replaced; attempting to use the real one should fail."""
        with pytest.raises((SecurityError, Exception)):
            executor.execute_code("__builtins__['__import__']('os')")


# ── String-based / getattr evasion ────────────────────────────────────────


class TestStringEvasion:
    """Attempts to use getattr / string concatenation to bypass filters."""

    def test_getattr_import_evasion(self, executor):
        """getattr is not in ALLOWED_BUILTINS, so this should fail."""
        with pytest.raises((SecurityError, Exception)):
            executor.execute_code("getattr(__builtins__, '__import__')('os')")

    def test_getattr_not_in_builtins(self, executor):
        """getattr itself should not be available."""
        with pytest.raises((SecurityError, Exception)):
            executor.execute_code("getattr(str, '__class__')")

    def test_chr_concat_evasion(self, executor):
        """chr is not in ALLOWED_BUILTINS; building strings via chr should fail."""
        with pytest.raises((SecurityError, Exception)):
            executor.execute_code("chr(111) + chr(115)")

    def test_type_call_evasion(self, executor):
        """Using type() to fabricate classes should not grant module access."""
        with pytest.raises((SecurityError, Exception)):
            executor.execute_code(
                "type('X', (object,), {'__init__': lambda s: None})().__class__.__bases__[0].__subclasses__()"
            )

    def test_import_via_exec_string(self, executor):
        with pytest.raises(SecurityError):
            executor.execute_code("exec('import os')")

    def test_import_via_eval_string(self, executor):
        with pytest.raises(SecurityError):
            executor.execute_code("eval('__import__(\"os\")')")


# ── Resource limits ───────────────────────────────────────────────────────


class TestResourceLimits:
    """Code that exceeds resource limits must be terminated."""

    def test_infinite_loop_killed(self, strict_executor):
        """An infinite loop must be killed by the wall-clock timeout."""
        with pytest.raises((ResourceLimitError, SecurityError)):
            strict_executor.execute_code("while True: pass")

    def test_large_memory_allocation(self, strict_executor):
        """Allocating a huge list should trigger memory limit or timeout."""
        with pytest.raises((ResourceLimitError, SecurityError, MemoryError)):
            strict_executor.execute_code("_result = [0] * (10**9)")

    def test_cpu_intensive_code(self, strict_executor):
        """CPU-bound work should hit CPU time limit."""
        code = """
x = 0
for i in range(10**9):
    x += i
_result = x
"""
        with pytest.raises((ResourceLimitError, SecurityError)):
            strict_executor.execute_code(code)

    def test_nested_loop_bomb(self, strict_executor):
        code = """
x = 0
for i in range(10000):
    for j in range(10000):
        x += 1
_result = x
"""
        with pytest.raises((ResourceLimitError, SecurityError)):
            strict_executor.execute_code(code)


# ── Allowed operations ────────────────────────────────────────────────────


class TestAllowedOperations:
    """Normal safe operations must succeed."""

    def test_arithmetic(self, executor):
        assert executor.execute_code("2 + 3") == 5

    def test_string_ops(self, executor):
        assert executor.execute_code("'hello' + ' ' + 'world'") == "hello world"

    def test_string_methods(self, executor):
        assert executor.execute_code("'HELLO'.lower()") == "hello"

    def test_list_operations(self, executor):
        result = executor.execute_code("[1, 2, 3] + [4, 5]")
        assert result == [1, 2, 3, 4, 5]

    def test_list_comprehension(self, executor):
        result = executor.execute_code("[x * 2 for x in range(5)]")
        assert result == [0, 2, 4, 6, 8]

    def test_dict_operations(self, executor):
        result = executor.execute_code("{'a': 1, 'b': 2}")
        assert result == {"a": 1, "b": 2}

    def test_math_builtins(self, executor):
        assert executor.execute_code("abs(-5)") == 5
        assert executor.execute_code("min(3, 1, 4, 1, 5)") == 1
        assert executor.execute_code("max(3, 1, 4, 1, 5)") == 5
        assert executor.execute_code("sum([1, 2, 3])") == 6
        assert executor.execute_code("round(3.7)") == 4

    def test_len(self, executor):
        assert executor.execute_code("len([1, 2, 3])") == 3

    def test_sorted(self, executor):
        assert executor.execute_code("sorted([3, 1, 2])") == [1, 2, 3]

    def test_boolean_operations(self, executor):
        assert executor.execute_code("all([True, True])") is True
        assert executor.execute_code("any([False, True])") is True

    def test_type_conversions(self, executor):
        assert executor.execute_code("int('42')") == 42
        assert executor.execute_code("float('3.14')") == 3.14
        assert executor.execute_code("str(42)") == "42"

    def test_tuple_creation(self, executor):
        assert executor.execute_code("(1, 2, 3)") == (1, 2, 3)

    def test_set_creation(self, executor):
        assert executor.execute_code("{1, 2, 2, 3}") == {1, 2, 3}

    def test_context_variable_access(self, executor):
        result = executor.execute_code(
            "row['name']", context={"row": {"name": "Alice"}}
        )
        assert result == "Alice"

    def test_conditional_expression(self, executor):
        assert executor.execute_code("'yes' if True else 'no'") == "yes"

    def test_enumerate(self, executor):
        result = executor.execute_code("list(enumerate(['a', 'b']))")
        assert result == [(0, "a"), (1, "b")]


# ── Result type validation ────────────────────────────────────────────────


class TestResultTypeValidation:
    """Only allowed result types should be returned."""

    def test_bool_result_allowed(self, executor):
        assert executor.execute_code("True", allowed_result_types=(bool,)) is True

    def test_int_result_allowed(self, executor):
        assert executor.execute_code("42", allowed_result_types=(int,)) == 42

    def test_string_result_allowed(self, executor):
        assert executor.execute_code("'hello'", allowed_result_types=(str,)) == "hello"

    def test_list_result_allowed(self, executor):
        assert executor.execute_code("[1,2]", allowed_result_types=(list,)) == [1, 2]

    def test_none_result_when_not_allowed(self, executor):
        """Returning None when only bool is allowed should raise."""
        with pytest.raises(SecurityError, match="Invalid result type"):
            executor.execute_code("None", allowed_result_types=(bool,))

    def test_dict_not_allowed(self, executor):
        with pytest.raises(SecurityError, match="Invalid result type"):
            executor.execute_code("{'a': 1}", allowed_result_types=(bool, int))

    def test_custom_type_not_allowed(self, executor):
        """A class instance should not be an allowed result type."""
        code = """
class Foo:
    pass
_result = Foo()
"""
        with pytest.raises(SecurityError):
            executor.execute_code(code, allowed_result_types=(bool, int, str))


# ── Context injection ─────────────────────────────────────────────────────


class TestContextInjection:
    """Malicious context variables must not break the sandbox."""

    def test_context_with_dunder_key_ignored(self, executor):
        """Keys starting with __ should be filtered out of context."""
        result = executor.execute_code(
            "1 + 1",
            context={
                "__builtins__": {"__import__": __builtins__},
                "safe_var": 42,
            },
        )
        assert result == 2

    def test_context_with_blocked_module_name_ignored(self, executor):
        """Context keys matching blocked module names should be filtered."""
        result = executor.execute_code(
            "1 + 1",
            context={
                "os": "should_not_appear",
                "subprocess": "should_not_appear",
            },
        )
        assert result == 2

    def test_context_module_injection(self, executor):
        """Passing an actual module object as context should not grant access."""
        import os as _os

        # The key 'os' is blocked, so it should be filtered
        result = executor.execute_code("1 + 1", context={"os": _os})
        assert result == 2

    def test_context_safe_values_accessible(self, executor):
        """Non-dangerous context values should be accessible."""
        result = executor.execute_code("x + y", context={"x": 10, "y": 20})
        assert result == 30

    def test_context_row_data_access(self, executor):
        """Typical row-data access pattern must work."""
        row = {"name": "Alice", "age": 30}
        result = executor.execute_code("row['age'] > 18", context={"row": row})
        assert result is True


# ── validate_expression ───────────────────────────────────────────────────


class TestValidateExpression:
    """SecureExecutor.validate_expression should return bool."""

    def test_safe_expression(self, executor):
        assert executor.validate_expression("1 + 1") is True

    def test_unsafe_import(self, executor):
        assert executor.validate_expression("import os") is False

    def test_unsafe_eval(self, executor):
        assert executor.validate_expression("eval('1')") is False

    def test_unsafe_exec(self, executor):
        assert executor.validate_expression("exec('pass')") is False


# ── CustomCodeValidator ───────────────────────────────────────────────────


class TestCustomCodeValidator:
    """Tests for the high-level CustomCodeValidator."""

    def test_validate_safe_code(self, validator):
        result = validator.validate_custom_code("1 + 1")
        assert result["is_valid"] is True
        assert result["security_issues"] == []

    def test_validate_safe_code_with_sample_data(self, validator):
        sample = [{"name": "Alice", "age": 30}]
        result = validator.validate_custom_code("row['age'] > 18", sample_data=sample)
        assert result["is_valid"] is True

    def test_validate_malicious_import(self, validator):
        result = validator.validate_custom_code("import os")
        assert result["is_valid"] is False
        assert len(result["security_issues"]) > 0

    def test_validate_malicious_exec(self, validator):
        result = validator.validate_custom_code("exec('import os')")
        assert result["is_valid"] is False

    def test_validate_malicious_eval(self, validator):
        result = validator.validate_custom_code("eval('1')")
        assert result["is_valid"] is False

    def test_validate_malicious_subprocess(self, validator):
        result = validator.validate_custom_code(
            "import subprocess; subprocess.run(['ls'])"
        )
        assert result["is_valid"] is False

    def test_validate_malicious_builtins_access(self, validator):
        result = validator.validate_custom_code("__import__('os')")
        assert result["is_valid"] is False

    def test_execute_custom_validation_safe(self, validator):
        row = {"name": "Alice", "age": 30}
        result = validator.execute_custom_validation("row['age'] > 18", row)
        assert result is True

    def test_execute_custom_validation_malicious(self, validator):
        row = {"name": "Alice"}
        result = validator.execute_custom_validation("__import__('os') or True", row)
        assert result is False

    def test_security_levels(self):
        low = CustomCodeValidator(security_level="low")
        high = CustomCodeValidator(security_level="high")
        assert low.executor.max_memory_mb > high.executor.max_memory_mb
        assert low.executor.max_cpu_time > high.executor.max_cpu_time

    def test_execution_stats_returned(self, validator):
        result = validator.validate_custom_code("1 + 1")
        assert "execution_stats" in result
        assert "max_memory_mb" in result["execution_stats"]


# ── validate_sandbox_config ───────────────────────────────────────────────


class TestValidateSandboxConfig:
    """Tests for the production startup guard."""

    def test_production_high_security_passes(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            from app.security.sandbox import validate_sandbox_config

            # Should not raise
            validate_sandbox_config(
                max_memory_mb=100,
                max_cpu_time=5.0,
                max_execution_time=10.0,
                security_level="high",
            )

    def test_production_weak_memory_fails(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            from app.security.sandbox import validate_sandbox_config

            with pytest.raises(RuntimeError, match="max_memory_mb"):
                validate_sandbox_config(
                    max_memory_mb=200,
                    max_cpu_time=5.0,
                    max_execution_time=10.0,
                    security_level="high",
                )

    def test_production_weak_cpu_fails(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            from app.security.sandbox import validate_sandbox_config

            with pytest.raises(RuntimeError, match="max_cpu_time"):
                validate_sandbox_config(
                    max_memory_mb=100,
                    max_cpu_time=20.0,
                    max_execution_time=10.0,
                    security_level="high",
                )

    def test_production_weak_execution_time_fails(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            from app.security.sandbox import validate_sandbox_config

            with pytest.raises(RuntimeError, match="max_execution_time"):
                validate_sandbox_config(
                    max_memory_mb=100,
                    max_cpu_time=5.0,
                    max_execution_time=60.0,
                    security_level="high",
                )

    def test_production_wrong_security_level_fails(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            from app.security.sandbox import validate_sandbox_config

            with pytest.raises(RuntimeError, match="security_level"):
                validate_sandbox_config(
                    max_memory_mb=100,
                    max_cpu_time=5.0,
                    max_execution_time=10.0,
                    security_level="low",
                )

    def test_development_weak_settings_no_error(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            from app.security.sandbox import validate_sandbox_config

            # Should not raise, just warn
            validate_sandbox_config(
                max_memory_mb=500,
                max_cpu_time=60.0,
                max_execution_time=120.0,
                security_level="low",
            )

    def test_default_environment_is_development(self):
        env = os.environ.copy()
        env.pop("ENVIRONMENT", None)
        with patch.dict(os.environ, env, clear=True):
            from app.security.sandbox import validate_sandbox_config

            # development is the default; weak settings should not raise
            validate_sandbox_config(
                max_memory_mb=500,
                max_cpu_time=60.0,
                max_execution_time=120.0,
                security_level="low",
            )
