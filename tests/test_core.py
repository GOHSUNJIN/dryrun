"""
Tests for agents/core.py (Gemini logic used by Cloud Run / FastAPI).
All Gemini calls are mocked so no API key is required to run the suite.
"""
import json
import os
import pytest
from unittest.mock import MagicMock, patch, call
import agents.core as core


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_mock_client(response_text):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = response_text
    mock_client.models.generate_content.return_value = mock_response
    return mock_client


SAMPLE_PROPOSAL = "Hire two data engineers at $120k each. This saves 30 hours per month."
ALL_IDS = ['finance', 'legal', 'ops', 'factcheck']
SAMPLE_TRANSCRIPT = [
    {'speaker': 'finance', 'text': 'Where is the cost breakdown?'},
    {'speaker': 'presenter', 'text': 'Total cost is $240k per year.'},
    {'speaker': 'legal', 'text': 'Who owns the data?'},
    {'speaker': 'presenter', 'text': 'Our analytics lead owns all data access.'},
]


# ---------------------------------------------------------------------------
# get_client
# ---------------------------------------------------------------------------

class TestGetClient:
    def test_raises_when_key_missing(self):
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop('GEMINI_API_KEY', None)
            with pytest.raises(EnvironmentError, match='GEMINI_API_KEY'):
                core.get_client()

    @patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key-123'})
    @patch('agents.core.genai')
    def test_returns_client_when_key_set(self, mock_genai):
        mock_client = MagicMock()
        mock_genai.Client.return_value = mock_client
        result = core.get_client()
        assert result is mock_client
        mock_genai.Client.assert_called_once_with(api_key='test-key-123')


# ---------------------------------------------------------------------------
# get_initial_conditions
# ---------------------------------------------------------------------------

class TestGetInitialConditions:
    def test_finance_conditions(self):
        conds = core.get_initial_conditions(['finance'])
        assert set(conds.keys()) == {'f1', 'f2', 'f3'}
        assert all(v is False for v in conds.values())

    def test_legal_conditions(self):
        conds = core.get_initial_conditions(['legal'])
        assert set(conds.keys()) == {'l1', 'l2', 'l3'}

    def test_ops_conditions(self):
        conds = core.get_initial_conditions(['ops'])
        assert set(conds.keys()) == {'o1', 'o2', 'o3'}

    def test_factcheck_conditions(self):
        conds = core.get_initial_conditions(['factcheck'])
        assert set(conds.keys()) == {'fc1', 'fc2'}

    def test_all_personas_combined(self):
        conds = core.get_initial_conditions(ALL_IDS)
        assert 'f1' in conds and 'l1' in conds and 'o1' in conds and 'fc1' in conds
        assert all(v is False for v in conds.values())

    def test_unknown_persona_ignored(self):
        conds = core.get_initial_conditions(['finance', 'unknown_role'])
        assert set(conds.keys()) == {'f1', 'f2', 'f3'}

    def test_empty_list_returns_empty_dict(self):
        assert core.get_initial_conditions([]) == {}


# ---------------------------------------------------------------------------
# build_transcript_str
# ---------------------------------------------------------------------------

class TestBuildTranscriptStr:
    def test_presenter_label(self):
        msgs = [{'speaker': 'presenter', 'text': 'Hello panel.'}]
        result = core.build_transcript_str(msgs)
        assert result == 'Presenter: Hello panel.'

    def test_persona_label_uses_name_and_role(self):
        msgs = [{'speaker': 'finance', 'text': 'Show me the numbers.'}]
        result = core.build_transcript_str(msgs)
        assert 'Morgan' in result
        assert 'Head of Finance' in result

    def test_multi_turn_transcript(self):
        result = core.build_transcript_str(SAMPLE_TRANSCRIPT)
        lines = result.strip().split('\n')
        assert len(lines) == 4
        assert lines[0].startswith('Morgan')
        assert lines[1].startswith('Presenter')

    def test_unknown_speaker_falls_back_to_id(self):
        msgs = [{'speaker': 'mystery_role', 'text': 'Hmm.'}]
        result = core.build_transcript_str(msgs)
        assert 'mystery_role' in result or 'Panel' in result

    def test_empty_transcript_returns_empty_string(self):
        assert core.build_transcript_str([]) == ''


# ---------------------------------------------------------------------------
# generate_openings
# ---------------------------------------------------------------------------

class TestGenerateOpenings:
    def _openings_payload(self, persona_ids=None):
        ids = persona_ids or ['finance', 'legal', 'ops']
        return json.dumps({
            'openings': [
                {'persona_id': pid, 'text': f'Opening from {pid}.'}
                for pid in ids
            ]
        })

    @patch('agents.core.get_client')
    def test_returns_list_with_one_entry_per_persona(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._openings_payload())
        result = core.generate_openings(SAMPLE_PROPOSAL, ['finance', 'legal', 'ops'], {})
        assert len(result) == 3

    @patch('agents.core.get_client')
    def test_each_entry_has_required_keys(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._openings_payload())
        result = core.generate_openings(SAMPLE_PROPOSAL, ['finance', 'legal', 'ops'], {})
        for entry in result:
            assert 'id' in entry
            assert 'speaker' in entry
            assert 'text' in entry
            assert 'time' in entry
            assert entry['type'] == 'opening'

    @patch('agents.core.get_client')
    def test_filters_unknown_persona_ids(self, mock_get_client):
        payload = json.dumps({
            'openings': [
                {'persona_id': 'finance', 'text': 'Finance challenge.'},
                {'persona_id': 'ghost', 'text': 'Should be dropped.'},
            ]
        })
        mock_get_client.return_value = make_mock_client(payload)
        result = core.generate_openings(SAMPLE_PROPOSAL, ['finance'], {})
        assert len(result) == 1
        assert result[0]['speaker'] == 'finance'

    @patch('agents.core.get_client')
    def test_system_prompt_includes_toughness(self, mock_get_client):
        mock_client = make_mock_client(self._openings_payload())
        mock_get_client.return_value = mock_client
        core.generate_openings(SAMPLE_PROPOSAL, ['finance', 'legal', 'ops'], {'toughness': 'Tough'})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert 'Tough' in config.system_instruction

    @patch('agents.core.get_client')
    def test_fact_check_notes_injected_for_factcheck_persona(self, mock_get_client):
        payload = json.dumps({'openings': [{'persona_id': 'factcheck', 'text': 'Verify this.'}]})
        mock_client = make_mock_client(payload)
        mock_get_client.return_value = mock_client
        notes = 'Salary market data from BLS 2025.'
        core.generate_openings(SAMPLE_PROPOSAL, ['factcheck'], {}, fact_check_notes=notes)
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert notes in config.system_instruction

    @patch('agents.core.get_client')
    def test_no_fact_check_notes_when_empty(self, mock_get_client):
        mock_client = make_mock_client(self._openings_payload())
        mock_get_client.return_value = mock_client
        core.generate_openings(SAMPLE_PROPOSAL, ['finance', 'legal', 'ops'], {}, fact_check_notes='')
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert 'research briefing' not in config.system_instruction.lower()

    @patch('agents.core.get_client')
    def test_response_mime_type_is_json(self, mock_get_client):
        mock_client = make_mock_client(self._openings_payload())
        mock_get_client.return_value = mock_client
        core.generate_openings(SAMPLE_PROPOSAL, ['finance', 'legal', 'ops'], {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert config.response_mime_type == 'application/json'


# ---------------------------------------------------------------------------
# generate_reply
# ---------------------------------------------------------------------------

class TestGenerateReply:
    def _reply_payload(self, speaker='legal', conditions_met=None):
        return json.dumps({
            'speaker_id': speaker,
            'response': f'{speaker} follow-up challenge.',
            'conditions_met': conditions_met or [],
            'source': None,
        })

    @patch('agents.core.get_client')
    def test_returns_speaker_text_conditions(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._reply_payload('legal'))
        conds = core.get_initial_conditions(['finance', 'legal', 'ops'])
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal', 'ops'], SAMPLE_TRANSCRIPT, conds, {})
        assert 'speaker' in result
        assert 'text' in result
        assert 'conditions_met' in result

    @patch('agents.core.get_client')
    def test_speaker_must_be_in_persona_ids(self, mock_get_client):
        payload = json.dumps({'speaker_id': 'unknown_role', 'response': 'Hi.', 'conditions_met': [], 'source': None})
        mock_get_client.return_value = make_mock_client(payload)
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, {}, {})
        assert result['speaker'] in ['finance', 'legal']

    @patch('agents.core.get_client')
    def test_already_met_conditions_not_returned(self, mock_get_client):
        payload = json.dumps({'speaker_id': 'finance', 'response': 'Ok.', 'conditions_met': ['f1', 'f2'], 'source': None})
        mock_get_client.return_value = make_mock_client(payload)
        conds = {'f1': True, 'f2': False, 'f3': False}
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, conds, {})
        assert 'f1' not in result['conditions_met']
        assert 'f2' in result['conditions_met']

    @patch('agents.core.get_client')
    def test_source_included_when_present(self, mock_get_client):
        payload = json.dumps({'speaker_id': 'factcheck', 'response': 'Cited.', 'conditions_met': [], 'source': 'BLS 2025'})
        mock_get_client.return_value = make_mock_client(payload)
        result = core.generate_reply(SAMPLE_PROPOSAL, ['factcheck'], SAMPLE_TRANSCRIPT, {}, {})
        assert 'source' in result
        assert result['source']['label'] == 'BLS 2025'

    @patch('agents.core.get_client')
    def test_source_absent_when_null(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._reply_payload('finance'))
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {})
        assert 'source' not in result

    @patch('agents.core.get_client')
    def test_response_mime_type_is_json(self, mock_get_client):
        mock_client = make_mock_client(self._reply_payload('ops'))
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'ops'], SAMPLE_TRANSCRIPT, {}, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert config.response_mime_type == 'application/json'

    @patch('agents.core.get_client')
    def test_only_last_14_transcript_messages_sent(self, mock_get_client):
        mock_client = make_mock_client(self._reply_payload('finance'))
        mock_get_client.return_value = mock_client
        long_transcript = [{'speaker': 'presenter', 'text': f'Turn {i}'} for i in range(20)]
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], long_transcript, {}, {})
        contents = mock_client.models.generate_content.call_args.kwargs['contents']
        # Only last 14 turns should appear; "Turn 0" is beyond the window
        assert 'Turn 0' not in contents
        assert 'Turn 19' in contents


# ---------------------------------------------------------------------------
# generate_report
# ---------------------------------------------------------------------------

class TestGenerateReport:
    def _report_payload(self):
        return json.dumps({
            'weak_points': [
                {'label': 'Finance', 'issue': 'No TCO', 'fix': 'Add a cost table.'},
            ],
            'moments': [
                {
                    'id': 1, 'type': 'weak', 'turn': 'Turn 1',
                    'excerpt': 'Pays for itself.',
                    'tag': 'Weak Answer',
                    'asked': 'Morgan asked for cost breakdown.',
                    'your_answer': '"Pays for itself."',
                    'why': 'No numbers given.',
                    'better': 'Add a TCO table.',
                },
            ],
        })

    @patch('agents.core.get_client')
    def test_returns_dict_with_weak_points_and_moments(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._report_payload())
        conds = {'f1': False, 'l1': True}
        result = core.generate_report(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, conds)
        assert 'weak_points' in result
        assert 'moments' in result

    @patch('agents.core.get_client')
    def test_weak_points_is_list(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._report_payload())
        result = core.generate_report(SAMPLE_PROPOSAL, ALL_IDS, SAMPLE_TRANSCRIPT, {})
        assert isinstance(result['weak_points'], list)

    @patch('agents.core.get_client')
    def test_moments_is_list(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._report_payload())
        result = core.generate_report(SAMPLE_PROPOSAL, ALL_IDS, SAMPLE_TRANSCRIPT, {})
        assert isinstance(result['moments'], list)

    @patch('agents.core.get_client')
    def test_returns_empty_structure_on_invalid_json(self, mock_get_client):
        mock_get_client.return_value = make_mock_client('this is not json {')
        result = core.generate_report(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {})
        assert result == {'weak_points': [], 'moments': []}

    @patch('agents.core.get_client')
    def test_condition_status_included_in_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._report_payload())
        mock_get_client.return_value = mock_client
        conds = {'f1': True, 'f2': False}
        core.generate_report(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, conds)
        contents = mock_client.models.generate_content.call_args.kwargs['contents']
        assert 'MET' in contents
        assert 'UNMET' in contents

    @patch('agents.core.get_client')
    def test_system_prompt_frames_as_coaching(self, mock_get_client):
        mock_client = make_mock_client(self._report_payload())
        mock_get_client.return_value = mock_client
        core.generate_report(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        si = config.system_instruction.lower()
        assert 'coach' in si or 'preparation' in si

    @patch('agents.core.get_client')
    def test_system_prompt_forbids_probability_scores(self, mock_get_client):
        mock_client = make_mock_client(self._report_payload())
        mock_get_client.return_value = mock_client
        core.generate_report(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        si = config.system_instruction.lower()
        assert 'prediction' in si or 'probability' in si

    @patch('agents.core.get_client')
    def test_response_mime_type_is_json(self, mock_get_client):
        mock_client = make_mock_client(self._report_payload())
        mock_get_client.return_value = mock_client
        core.generate_report(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert config.response_mime_type == 'application/json'


# ---------------------------------------------------------------------------
# fact_check_proposal
# ---------------------------------------------------------------------------

class TestFactCheckProposal:
    @patch('agents.core.get_client')
    def test_returns_string_on_success(self, mock_get_client):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'Salary claim is accurate per BLS 2025.'
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client
        result = core.fact_check_proposal(SAMPLE_PROPOSAL)
        assert isinstance(result, str)
        assert len(result) > 0

    @patch('agents.core.get_client')
    def test_returns_empty_string_on_exception(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception('Network error')
        mock_get_client.return_value = mock_client
        result = core.fact_check_proposal(SAMPLE_PROPOSAL)
        assert result == ''

    @patch('agents.core.get_client')
    def test_proposal_truncated_to_800_chars(self, mock_get_client):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'findings'
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client
        long_proposal = 'x' * 2000
        core.fact_check_proposal(long_proposal)
        contents = mock_client.models.generate_content.call_args.kwargs['contents']
        assert len(contents) < 1400

    @patch('agents.core.get_client')
    def test_google_search_tool_configured(self, mock_get_client):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'result'
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client
        core.fact_check_proposal(SAMPLE_PROPOSAL)
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert config.tools is not None
        assert len(config.tools) > 0
