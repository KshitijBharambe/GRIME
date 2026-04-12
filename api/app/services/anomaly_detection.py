"""
ML-based anomaly detection service for advanced data quality analysis.
Implements various machine learning algorithms for detecting anomalies in datasets.
"""

import pandas as pd
import numpy as np
import json
import uuid
import os
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pathlib import Path

from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
import joblib

from app.models import MLModel, AnomalyScore, Execution, DatasetVersion, Rule
from app.services.data_import import DataImportService
from app.core.config import (
    DEFAULT_ANOMALY_THRESHOLD,
    ANOMALY_SCORE_SCALE,
    DEFAULT_ISOLATION_FOREST_ESTIMATORS,
    DEFAULT_CONTAMINATION,
    DEFAULT_SVM_NU,
    DEFAULT_LOF_NEIGHBORS,
    DEFAULT_RANDOM_STATE,
)


class AnomalyDetectionService:
    """Service for ML-based anomaly detection"""

    def __init__(self, db: Session):
        self.db = db
        self.data_import_service = DataImportService(db)
        self.model_storage_path = Path("api/data/ml_models")
        self.model_storage_path.mkdir(exist_ok=True, parents=True)

    def train_model(
        self,
        model_name: str,
        model_type: str,
        dataset_version_id: str,
        feature_columns: List[str],
        created_by: str,
        model_params: Optional[Dict[str, Any]] = None,
    ) -> MLModel:
        """Train an anomaly detection model"""
        # Load dataset
        dataset_version = (
            self.db.query(DatasetVersion)
            .filter(DatasetVersion.id == dataset_version_id)
            .first()
        )

        if not dataset_version:
            raise ValueError(f"Dataset version {dataset_version_id} not found")

        df = self.data_import_service.load_dataset_file(
            dataset_version.dataset_id, dataset_version.version_no
        )

        # Prepare features
        feature_df = self._prepare_features(df, feature_columns)
        if feature_df.empty:
            raise ValueError("No valid features found for training")

        # Get model parameters
        if model_params is None:
            model_params = self._get_default_params(model_type)

        # Train model
        model, scaler, training_metrics = self._train_model(
            model_type, feature_df, model_params
        )

        # Save model
        model_path = self._save_model(model, scaler, model_name)

        # Create model record
        ml_model = MLModel(
            id=str(uuid.uuid4()),
            name=model_name,
            model_type=model_type,
            version="1.0",
            model_path=str(model_path),
            model_metadata=json.dumps(
                {
                    "feature_columns": feature_columns,
                    "model_params": model_params,
                    "training_date": datetime.now(timezone.utc).isoformat(),
                    "dataset_shape": feature_df.shape,
                    "feature_count": len(feature_columns),
                }
            ),
            training_dataset_id=dataset_version.dataset_id,
            training_metrics=json.dumps(training_metrics),
            created_by=created_by,
        )

        self.db.add(ml_model)
        self.db.commit()
        self.db.refresh(ml_model)

        return ml_model

    def detect_anomalies(
        self, model_id: str, execution_id: str, threshold: Optional[float] = None
    ) -> List[AnomalyScore]:
        """Detect anomalies using a trained model"""
        # Get model
        model_record = self.db.query(MLModel).filter(MLModel.id == model_id).first()

        if not model_record:
            raise ValueError(f"Model {model_id} not found")

        # Get execution and dataset
        execution = (
            self.db.query(Execution).filter(Execution.id == execution_id).first()
        )

        if not execution:
            raise ValueError(f"Execution {execution_id} not found")

        dataset_version = (
            self.db.query(DatasetVersion)
            .filter(DatasetVersion.id == execution.dataset_version_id)
            .first()
        )

        # Load dataset
        df = self.data_import_service.load_dataset_file(
            dataset_version.dataset_id, dataset_version.version_no
        )

        # Load model
        model, scaler, model_metadata = self._load_model(model_record.model_path)
        feature_columns = model_metadata["feature_columns"]

        # Prepare features
        feature_df = self._prepare_features(df, feature_columns)
        if feature_df.empty:
            return []

        # Detect anomalies
        anomaly_scores = self._detect_anomalies(model, scaler, feature_df, threshold)

        # Save anomaly scores
        saved_scores = []
        for idx, score_data in enumerate(anomaly_scores):
            anomaly_score = AnomalyScore(
                id=str(uuid.uuid4()),
                execution_id=execution_id,
                model_id=model_id,
                row_index=score_data["row_index"],
                # Convert to 0-100 scale
                anomaly_score=int(score_data["anomaly_score"] * ANOMALY_SCORE_SCALE),
                features_used=json.dumps(feature_columns),
                feature_values=json.dumps(score_data["features"]),
                threshold_used=int(
                    (threshold or DEFAULT_ANOMALY_THRESHOLD) * ANOMALY_SCORE_SCALE
                ),
            )

            self.db.add(anomaly_score)
            saved_scores.append(anomaly_score)

        self.db.commit()
        return saved_scores

    def _prepare_features(
        self, df: pd.DataFrame, feature_columns: List[str]
    ) -> pd.DataFrame:
        """Prepare features for ML model"""
        # Filter to existing columns
        available_columns = [col for col in feature_columns if col in df.columns]
        if not available_columns:
            return pd.DataFrame()

        feature_df = df[available_columns].copy()

        # Handle missing values
        feature_df = feature_df.fillna(feature_df.median())

        # Handle categorical features
        categorical_columns = feature_df.select_dtypes(include=["object"]).columns
        for col in categorical_columns:
            if feature_df[col].dtype == "object":
                # Simple encoding for categorical data
                feature_df[col] = pd.factorize(feature_df[col])[0]

        return feature_df

    def _get_default_params(self, model_type: str) -> Dict[str, Any]:
        """Get default parameters for model type"""
        if model_type == "isolation_forest":
            return {
                "n_estimators": DEFAULT_ISOLATION_FOREST_ESTIMATORS,
                "max_samples": "auto",
                "contamination": DEFAULT_CONTAMINATION,
                "random_state": DEFAULT_RANDOM_STATE,
            }
        elif model_type == "one_class_svm":
            return {"nu": DEFAULT_SVM_NU, "kernel": "rbf", "gamma": "scale"}
        elif model_type == "local_outlier_factor":
            return {
                "n_neighbors": DEFAULT_LOF_NEIGHBORS,
                "contamination": "auto",
                "novelty": False,
            }
        else:
            return {}

    def _train_model(
        self, model_type: str, feature_df: pd.DataFrame, model_params: Dict[str, Any]
    ) -> Tuple[Any, Any, Dict[str, Any]]:
        """Train the anomaly detection model"""
        # Scale features
        scaler = StandardScaler()
        scaled_features = scaler.fit_transform(feature_df)

        # Initialize model
        if model_type == "isolation_forest":
            model = IsolationForest(**model_params)
            model.fit(scaled_features)
            predictions = model.predict(scaled_features)
            scores = model.decision_function(scaled_features)

        elif model_type == "one_class_svm":
            model = OneClassSVM(**model_params)
            model.fit(scaled_features)
            predictions = model.predict(scaled_features)
            scores = model.decision_function(scaled_features)

        elif model_type == "local_outlier_factor":
            model = LocalOutlierFactor(**model_params)
            predictions = model.fit_predict(scaled_features)
            scores = model.negative_outlier_factor_

        else:
            raise ValueError(f"Unsupported model type: {model_type}")

        # Calculate training metrics
        anomaly_count = np.sum(predictions == -1)
        anomaly_rate = anomaly_count / len(predictions)

        training_metrics = {
            "total_samples": len(feature_df),
            "feature_count": feature_df.shape[1],
            "anomaly_count": int(anomaly_count),
            "anomaly_rate": float(anomaly_rate),
            "training_score_mean": float(np.mean(scores)),
            "training_score_std": float(np.std(scores)),
        }

        return model, scaler, training_metrics

    def _detect_anomalies(
        self,
        model: Any,
        scaler: Any,
        feature_df: pd.DataFrame,
        threshold: Optional[float],
    ) -> List[Dict[str, Any]]:
        """Detect anomalies using the trained model"""
        # Scale features
        scaled_features = scaler.transform(feature_df)

        # Get predictions and scores
        if hasattr(model, "predict"):
            predictions = model.predict(scaled_features)
        else:
            predictions = model.fit_predict(scaled_features)

        if hasattr(model, "decision_function"):
            scores = model.decision_function(scaled_features)
        elif hasattr(model, "negative_outlier_factor_"):
            scores = model.negative_outlier_factor_
        else:
            scores = predictions

        # Apply threshold
        if threshold is None:
            threshold = DEFAULT_ANOMALY_THRESHOLD

        anomaly_scores = []
        for idx, (prediction, score) in enumerate(zip(predictions, scores)):
            # Normalize score to 0-1 range
            if isinstance(score, np.ndarray):
                normalized_score = float(score[0])
            else:
                normalized_score = float(score)

            # Convert to anomaly score (higher = more anomalous)
            if prediction == -1:  # Outlier
                anomaly_score = max(normalized_score, threshold)
            else:  # Normal
                anomaly_score = min(normalized_score, threshold)

            anomaly_scores.append(
                {
                    "row_index": idx,
                    "anomaly_score": anomaly_score,
                    "features": feature_df.iloc[idx].to_dict(),
                }
            )

        return anomaly_scores

    def _save_model(self, model: Any, scaler: Any, model_name: str) -> Path:
        """Save the trained model and scaler"""
        model_path = self.model_storage_path / f"{model_name}_model.pkl"
        scaler_path = self.model_storage_path / f"{model_name}_scaler.pkl"

        # Save model
        joblib.dump(model, model_path)

        # Save scaler
        joblib.dump(scaler, scaler_path)

        return model_path

    def _load_model(self, model_path: str) -> Tuple[Any, Any, Dict[str, Any]]:
        """Load the trained model and scaler"""
        # Load model
        model = joblib.load(model_path)

        # Load scaler
        scaler_path = model_path.replace("_model.pkl", "_scaler.pkl")
        scaler = joblib.load(scaler_path)

        # Load metadata (assuming it's stored with the model)
        metadata_path = model_path.replace("_model.pkl", "_metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
        else:
            metadata = {}

        return model, scaler, metadata

    def get_models(self, active_only: bool = True) -> List[MLModel]:
        """Get available ML models"""
        query = self.db.query(MLModel)

        if active_only:
            query = query.filter(MLModel.is_active == True)

        return query.order_by(MLModel.created_at.desc()).all()

    def get_model(self, model_id: str) -> Optional[MLModel]:
        """Get a specific model by ID"""
        return self.db.query(MLModel).filter(MLModel.id == model_id).first()

    def delete_model(self, model_id: str) -> None:
        """Delete a model"""
        model = self.get_model(model_id)
        if model:
            # Delete model files
            model_path = Path(model.model_path)
            if model_path.exists():
                model_path.unlink()

            scaler_path = model_path.parent / f"{model_path.stem}_scaler.pkl"
            if scaler_path.exists():
                scaler_path.unlink()

            # Delete database record
            self.db.delete(model)
            self.db.commit()

    def get_anomaly_scores(
        self, execution_id: str, model_id: Optional[str] = None
    ) -> List[AnomalyScore]:
        """Get anomaly scores for an execution"""
        query = self.db.query(AnomalyScore).filter(
            AnomalyScore.execution_id == execution_id
        )

        if model_id:
            query = query.filter(AnomalyScore.model_id == model_id)

        return query.order_by(AnomalyScore.anomaly_score.desc()).all()


class MLAnomalyValidator:
    """Validator that uses ML models for anomaly detection"""

    def __init__(self, rule: Rule, df: pd.DataFrame, db: Session):
        self.rule = rule
        self.df = df
        self.db = db
        self.params = json.loads(rule.params) if rule.params else {}
        self.model_id = self.params.get("model_id")
        self.threshold = self.params.get("threshold", DEFAULT_ANOMALY_THRESHOLD)
        self.anomaly_service = AnomalyDetectionService(db)

    def validate(self) -> List[Dict[str, Any]]:
        """Validate using ML anomaly detection"""
        if not self.model_id:
            return [
                {
                    "row_index": 0,
                    "column_name": "ml_anomaly",
                    "current_value": "No model specified",
                    "message": "ML anomaly detection rule requires a model_id parameter",
                    "category": "ml_anomaly",
                    "suggested_value": None,
                }
            ]

        # Create a temporary execution record for scoring
        execution_id = str(uuid.uuid4())

        try:
            # Detect anomalies
            anomaly_scores = self.anomaly_service.detect_anomalies(
                model_id=self.model_id,
                execution_id=execution_id,
                threshold=self.threshold,
            )

            # Convert to issues
            issues = []
            for score in anomaly_scores:
                # Convert threshold to percentage
                if score.anomaly_score > (self.threshold * ANOMALY_SCORE_SCALE):
                    issues.append(
                        {
                            "row_index": score.row_index,
                            "column_name": "ml_anomaly",
                            "current_value": f"Anomaly score: {score.anomaly_score}",
                            "message": f"ML model detected anomaly (score: {score.anomaly_score}, threshold: {int(self.threshold * ANOMALY_SCORE_SCALE)})",
                            "category": "ml_anomaly",
                            "suggested_value": None,
                        }
                    )

            return issues

        except Exception as e:
            return [
                {
                    "row_index": 0,
                    "column_name": "ml_anomaly",
                    "current_value": str(e),
                    "message": f"Error in ML anomaly detection: {str(e)}",
                    "category": "ml_anomaly",
                    "suggested_value": None,
                }
            ]
        finally:
            # Clean up temporary execution record if it exists
            execution = (
                self.db.query(Execution).filter(Execution.id == execution_id).first()
            )
            if execution:
                self.db.delete(execution)
                self.db.commit()
