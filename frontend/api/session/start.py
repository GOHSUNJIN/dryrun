from http.server import BaseHTTPRequestHandler
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from _agents.core import generate_openings, get_initial_conditions


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length) or b'{}')
            persona_ids = body.get('persona_ids', ['finance', 'legal', 'ops', 'factcheck'])
            result = {
                'messages': generate_openings(
                    body.get('proposal_text', ''),
                    persona_ids,
                    body.get('config', {}),
                ),
                'conditions': get_initial_conditions(persona_ids),
            }
            self._json(200, result)
        except EnvironmentError as e:
            self._json(503, {'error': str(e)})
        except Exception as e:
            self._json(500, {'error': str(e)})

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json(self, status, data):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self._cors()
        self.end_headers()
        self.wfile.write(payload)
