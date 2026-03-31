from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY


def get_supabase_client() -> Client:
    """Create a Supabase client using the service role key (bypasses RLS)."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
