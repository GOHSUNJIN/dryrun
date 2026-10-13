import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

app = FastAPI(title='Dry Run API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


# ── Request models ──────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    proposal_text: str
    persona_ids: List[str] = ['finance', 'legal', 'ops', 'factcheck']
    config: Dict[str, Any] = {}


class MessageRequest(BaseModel):
    proposal_text: str
    persona_ids: List[str]
    transcript: List[Dict[str, Any]]
    conditions: Dict[str, bool]
    config: Dict[str, Any] = {}


class EndRequest(BaseModel):
    proposal_text: str
    persona_ids: List[str]
    transcript: List[Dict[str, Any]]
    conditions: Dict[str, bool]


# ── API routes ───────────────────────────────────────────────────────────────

@app.post('/api/session/start')
async def session_start(body: StartRequest):
    from agents.core import generate_openings, get_initial_conditions
    try:
        messages = generate_openings(body.proposal_text, body.persona_ids, body.config)
        conditions = get_initial_conditions(body.persona_ids)
        return {'messages': messages, 'conditions': conditions}
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/session/message')
async def session_message(body: MessageRequest):
    from agents.core import generate_reply
    try:
        return generate_reply(
            body.proposal_text,
            body.persona_ids,
            body.transcript,
            body.conditions,
            body.config,
        )
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/session/end')
async def session_end(body: EndRequest):
    from agents.core import generate_report
    try:
        return generate_report(
            body.proposal_text,
            body.persona_ids,
            body.transcript,
            body.conditions,
        )
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Serve React build (must be last) ─────────────────────────────────────────

_static_dir = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')
if os.path.exists(_static_dir):
    app.mount('/', StaticFiles(directory=_static_dir, html=True), name='static')
