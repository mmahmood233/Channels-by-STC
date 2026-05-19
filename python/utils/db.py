# File purpose: Provides Supabase database helpers for the Python forecasting code.
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY


def get_supabase_client() -> Client:
    """
    Create a Supabase client for the forecasting script.

    The forecasting script is not a normal logged-in dashboard user.
    It is a trusted backend process, so it uses the service role key.

    The service role key can read and write forecast data even when RLS is enabled.
    This key must stay on the backend and must never be exposed in browser code.
    """
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
