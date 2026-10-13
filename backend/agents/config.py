import os
from google import genai

# Change this one constant to swap the model across the whole app.
GEMINI_MODEL = "gemini-2.0-flash"

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "GEMINI_API_KEY is not set. "
                "Copy .env.example to .env, add your key, then re-run."
            )
        _client = genai.Client(api_key=api_key)
    return _client
