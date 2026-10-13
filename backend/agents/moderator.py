import json
from google.genai import types
from agents.config import get_client, GEMINI_MODEL

_SYSTEM = """\
You are a silent moderator for a stakeholder review panel.
Your only job: decide who should speak next.

Pick the persona whose core concerns are LEAST addressed by the presenter so far.
Vary the speakers; avoid picking the same persona twice in a row unless no one else has unresolved concerns.

Return ONLY valid JSON with no markdown fences, no explanation:
{"next_speaker_id": "<id>", "reason": "<one sentence>"}

Valid IDs: finance, legal, ops
"""

_VALID_IDS = {"finance", "legal", "ops"}


def pick_next_speaker(transcript: str, user_message: str) -> str:
    """Return the persona id that should respond next."""
    client = get_client()

    prompt = (
        f"Panel conversation so far:\n{transcript}\n\n"
        f"Presenter just said: {user_message}\n\n"
        "Who should speak next?"
    )

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM,
            response_mime_type="application/json",
            max_output_tokens=80,
        ),
    )

    try:
        data = json.loads(response.text)
        speaker_id = data.get("next_speaker_id", "finance")
        if speaker_id not in _VALID_IDS:
            speaker_id = "finance"
        return speaker_id
    except (json.JSONDecodeError, KeyError):
        return "finance"
