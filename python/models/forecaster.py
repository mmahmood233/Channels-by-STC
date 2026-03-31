"""
Demand forecasting model.
Reads historical sales data and predicts future demand per device per store.
"""

import pandas as pd
from sklearn.linear_model import LinearRegression
import numpy as np


def prepare_features(df: pd.DataFrame) -> tuple:
    """Convert monthly sales into features for linear regression."""
    df = df.sort_values("sale_month")
    df["month_index"] = range(len(df))
    X = df[["month_index"]].values
    y = df["total_quantity"].values
    return X, y


def predict_next_month(X: np.ndarray, y: np.ndarray) -> tuple:
    """Train a linear regression model and predict next month's demand."""
    model = LinearRegression()
    model.fit(X, y)

    next_index = np.array([[X[-1][0] + 1]])
    prediction = max(0, int(round(model.predict(next_index)[0])))

    # Simple confidence based on R² score
    r2 = model.score(X, y)
    confidence = round(max(0, min(100, r2 * 100)), 2)

    return prediction, confidence
