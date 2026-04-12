"""
Statistical validation validators for advanced data quality checks.
Implements various statistical tests and outlier detection methods.
"""

import pandas as pd
import numpy as np
from scipy import stats
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler
from typing import List, Dict, Any, Optional
import warnings

from .base_validator import BaseValidator
from app.models import Rule

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')


class StatisticalOutlierValidator(BaseValidator):
    """Validator for detecting statistical outliers using various methods"""

    def __init__(self, rule: Rule, df: pd.DataFrame, db):
        super().__init__(rule, df, db)
        # iqr, zscore, isolation_forest
        self.method = self.params.get('method', 'iqr')
        self.threshold = self.params.get('threshold', 3.0)  # for z-score
        self.iqr_multiplier = self.params.get('iqr_multiplier', 1.5)  # for IQR
        self.contamination = self.params.get(
            'contamination', 0.1)  # for ML methods

    def validate(self) -> List[Dict[str, Any]]:
        """Detect outliers in specified columns"""
        issues = []
        target_columns = self.target_columns

        for column in target_columns:
            if column not in self.df.columns:
                continue

            # Only process numeric columns
            if not pd.api.types.is_numeric_dtype(self.df[column]):
                continue

            column_data = self.df[column].dropna()
            if len(column_data) < 3:  # Need minimum data points
                continue

            outlier_indices = self._detect_outliers(column_data)

            for idx in outlier_indices:
                issues.append({
                    'row_index': int(idx),
                    'column_name': column,
                    'current_value': str(self.df.loc[idx, column]),
                    'message': f'Statistical outlier detected in {column} (value: {self.df.loc[idx, column]}, method: {self.method})',
                    'category': 'statistical_outlier',
                    'suggested_value': None
                })

        return issues

    def _detect_outliers(self, data: pd.Series) -> List[int]:
        """Detect outliers using the specified method"""
        if self.method == 'iqr':
            return self._detect_iqr_outliers(data)
        elif self.method == 'zscore':
            return self._detect_zscore_outliers(data)
        elif self.method == 'isolation_forest':
            return self._detect_isolation_forest_outliers(data)
        elif self.method == 'one_class_svm':
            return self._detect_one_class_svm_outliers(data)
        else:
            return []

    def _detect_iqr_outliers(self, data: pd.Series) -> List[int]:
        """Detect outliers using IQR method"""
        Q1 = data.quantile(0.25)
        Q3 = data.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - self.iqr_multiplier * IQR
        upper_bound = Q3 + self.iqr_multiplier * IQR

        outlier_mask = (data < lower_bound) | (data > upper_bound)
        return data[outlier_mask].index.tolist()

    def _detect_zscore_outliers(self, data: pd.Series) -> List[int]:
        """Detect outliers using Z-score method"""
        z_scores = np.abs(stats.zscore(data))
        outlier_mask = z_scores > self.threshold
        return data[outlier_mask].index.tolist()

    def _detect_isolation_forest_outliers(self, data: pd.Series) -> List[int]:
        """Detect outliers using Isolation Forest"""
        try:
            clf = IsolationForest(
                contamination=self.contamination, random_state=42)
            outlier_pred = clf.fit_predict(data.values.reshape(-1, 1))
            outlier_mask = outlier_pred == -1
            return data[outlier_mask].index.tolist()
        except Exception:
            return []

    def _detect_one_class_svm_outliers(self, data: pd.Series) -> List[int]:
        """Detect outliers using One-Class SVM"""
        try:
            # Scale the data
            scaler = StandardScaler()
            scaled_data = scaler.fit_transform(data.values.reshape(-1, 1))

            clf = OneClassSVM(nu=self.contamination)
            outlier_pred = clf.fit_predict(scaled_data)
            outlier_mask = outlier_pred == -1
            return data[outlier_mask].index.tolist()
        except Exception:
            return []


class DistributionCheckValidator(BaseValidator):
    """Validator for checking data distribution properties"""

    def __init__(self, rule: Rule, df: pd.DataFrame, db):
        super().__init__(rule, df, db)
        # normality, uniform, skewness
        self.test_type = self.params.get('test_type', 'normality')
        self.alpha = self.params.get('alpha', 0.05)  # significance level
        self.max_skewness = self.params.get(
            'max_skewness', 2.0)  # maximum allowed skewness

    def validate(self) -> List[Dict[str, Any]]:
        """Check distribution properties of specified columns"""
        issues = []
        target_columns = self.target_columns

        for column in target_columns:
            if column not in self.df.columns:
                continue

            # Only process numeric columns
            if not pd.api.types.is_numeric_dtype(self.df[column]):
                continue

            column_data = self.df[column].dropna()
            if len(column_data) < 8:  # Need minimum data points for distribution tests
                continue

            issue = self._check_distribution(column, column_data)
            if issue:
                issues.append(issue)

        return issues

    def _check_distribution(self, column: str, data: pd.Series) -> Optional[Dict[str, Any]]:
        """Check distribution based on test type"""
        if self.test_type == 'normality':
            return self._check_normality(column, data)
        elif self.test_type == 'uniform':
            return self._check_uniformity(column, data)
        elif self.test_type == 'skewness':
            return self._check_skewness(column, data)
        return None

    def _check_normality(self, column: str, data: pd.Series) -> Optional[Dict[str, Any]]:
        """Check if data follows normal distribution using Shapiro-Wilk test"""
        try:
            # Use Shapiro-Wilk test for normality (suitable for small to medium samples)
            if len(data) <= 5000:
                statistic, p_value = stats.shapiro(data)
                test_name = "Shapiro-Wilk"
            else:
                # Use Kolmogorov-Smirnov test for larger samples
                _, p_value = stats.kstest(data, 'norm')
                test_name = "Kolmogorov-Smirnov"

            if p_value < self.alpha:
                # Not normally distributed
                skewness = stats.skew(data)
                kurtosis = stats.kurtosis(data)

                return {
                    'row_index': 0,  # Column-level issue
                    'column_name': column,
                    'current_value': f"skewness={skewness:.3f}, kurtosis={kurtosis:.3f}",
                    'message': f'Column {column} does not follow normal distribution ({test_name} test, p={p_value:.4f})',
                    'category': 'distribution_check',
                    'suggested_value': None
                }
        except Exception:
            pass
        return None

    def _check_uniformity(self, column: str, data: pd.Series) -> Optional[Dict[str, Any]]:
        """Check if data follows uniform distribution"""
        try:
            # Use Kolmogorov-Smirnov test against uniform distribution
            normalized_data = (data - data.min()) / (data.max() - data.min())
            statistic, p_value = stats.kstest(normalized_data, 'uniform')

            if p_value < self.alpha:
                return {
                    'row_index': 0,  # Column-level issue
                    'column_name': column,
                    'current_value': f"KS statistic={statistic:.3f}",
                    'message': f'Column {column} does not follow uniform distribution (p={p_value:.4f})',
                    'category': 'distribution_check',
                    'suggested_value': None
                }
        except Exception:
            pass
        return None

    def _check_skewness(self, column: str, data: pd.Series) -> Optional[Dict[str, Any]]:
        """Check if data skewness is within acceptable range"""
        try:
            skewness = stats.skew(data)
            if abs(skewness) > self.max_skewness:
                direction = "right" if skewness > 0 else "left"
                return {
                    'row_index': 0,  # Column-level issue
                    'column_name': column,
                    'current_value': f"skewness={skewness:.3f}",
                    'message': f'Column {column} is highly skewed to the {direction} (skewness={skewness:.3f})',
                    'category': 'distribution_check',
                    'suggested_value': None
                }
        except Exception:
            pass
        return None


class CorrelationValidator(BaseValidator):
    """Validator for checking correlation between columns"""

    def __init__(self, rule: Rule, df: pd.DataFrame, db):
        super().__init__(rule, df, db)
        # pearson, spearman, kendall
        self.method = self.params.get('method', 'pearson')
        self.threshold = self.params.get(
            'threshold', 0.8)  # correlation threshold
        self.check_multicollinearity = self.params.get(
            'check_multicollinearity', False)

    def validate(self) -> List[Dict[str, Any]]:
        """Check for high correlations between specified columns"""
        issues = []
        target_columns = self.target_columns

        # Filter to only numeric columns that exist
        numeric_columns = []
        for col in target_columns:
            if col in self.df.columns and pd.api.types.is_numeric_dtype(self.df[col]):
                numeric_columns.append(col)

        if len(numeric_columns) < 2:
            return issues

        # Calculate correlation matrix
        corr_matrix = self.df[numeric_columns].corr(method=self.method)

        # Find high correlations
        for i in range(len(corr_matrix.columns)):
            for j in range(i + 1, len(corr_matrix.columns)):
                col1 = corr_matrix.columns[i]
                col2 = corr_matrix.columns[j]
                corr_value = corr_matrix.iloc[i, j]

                if abs(corr_value) > self.threshold:
                    issues.append({
                        'row_index': 0,  # Column-level issue
                        'column_name': f"{col1}_{col2}",
                        'current_value': f"correlation={corr_value:.3f}",
                        'message': f'High {self.method} correlation ({corr_value:.3f}) between {col1} and {col2}',
                        'category': 'correlation_validation',
                        'suggested_value': None
                    })

        # Check for multicollinearity if requested
        if self.check_multicollinearity and len(numeric_columns) > 2:
            multicollinearity_issues = self._check_multicollinearity(
                numeric_columns, corr_matrix)
            issues.extend(multicollinearity_issues)

        return issues

    def _check_multicollinearity(self, columns: List[str], corr_matrix: pd.DataFrame) -> List[Dict[str, Any]]:
        """Check for multicollinearity using variance inflation factor (VIF)"""
        issues = []
        try:
            # Calculate VIF for each column
            from statsmodels.stats.outliers_influence import variance_inflation_factor
            from statsmodels.tools.tools import add_constant

            X = self.df[columns].dropna()
            if len(X) < len(columns):
                return issues  # Not enough data

            X = add_constant(X)
            vif_data = pd.DataFrame()
            vif_data["feature"] = X.columns
            vif_data["VIF"] = [variance_inflation_factor(X.values, i)
                               for i in range(X.shape[1])]

            # Check VIF values (VIF > 10 indicates high multicollinearity)
            high_vif_features = vif_data[vif_data["VIF"] > 10]

            for _, row in high_vif_features.iterrows():
                feature = row["feature"]
                if feature != "const":  # Skip the constant term
                    issues.append({
                        'row_index': 0,
                        'column_name': feature,
                        'current_value': f"VIF={row['VIF']:.2f}",
                        'message': f'High multicollinearity detected for {feature} (VIF={row["VIF"]:.2f})',
                        'category': 'correlation_validation',
                        'suggested_value': None
                    })
        except Exception:
            # Fallback if statsmodels is not available or other errors
            pass
        return issues
