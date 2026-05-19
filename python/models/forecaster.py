# File purpose: Contains the forecasting model logic used to predict demand.
"""
Demand forecasting model.
Reads historical sales data and predicts future demand per device per store.
"""

import pandas as pd
from sklearn.linear_model import LinearRegression
import numpy as np


def prepare_features(df: pd.DataFrame) -> tuple:
    """
    Convert monthly sales rows into model input.

    The model cannot directly understand dates like "2026-05-01".
    So we convert each month into a simple number:

    month 1 -> 0
    month 2 -> 1
    month 3 -> 2

    X is the month number.
    y is the quantity sold in that month.
    """
    # Make sure rows are in date order before assigning month numbers.
    df = df.sort_values("sale_month")

    # Create a simple increasing number for each month.
    # This is the input feature used by Linear Regression.
    df["month_index"] = range(len(df))

    # X must be a 2D array for scikit-learn.
    X = df[["month_index"]].values

    # y is the value the model tries to predict.
    y = df["total_quantity"].values
    return X, y


def predict_next_month(X: np.ndarray, y: np.ndarray) -> tuple:
    """
    Train the Linear Regression model and predict next month's demand.

    Linear Regression looks at the sales trend over time.
    If sales are increasing, the next prediction usually increases.
    If sales are decreasing, the next prediction usually decreases.
    """
    # Create the model object.
    model = LinearRegression()

    # Train the model using historical month numbers and quantities.
    model.fit(X, y)

    # Predict the next month after the last known month.
    # Example: if the last month index is 5, predict index 6.
    next_index = np.array([[X[-1][0] + 1]])

    # The prediction should not be negative because demand cannot be below zero.
    prediction = max(0, int(round(model.predict(next_index)[0])))

    # R² score is used as a simple confidence value.
    # It shows how well the line fits the historical data.
    r2 = model.score(X, y)

    # Keep confidence between 0 and 100.
    confidence = round(max(0, min(100, r2 * 100)), 2)

    return prediction, confidence
