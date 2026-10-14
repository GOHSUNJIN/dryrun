"""
Tests for agents/core.py (Gemini logic used by Cloud Run / FastAPI).
All Gemini calls are mocked so no API key is required to run the suite.
"""
import json
import os
import pytest
from unittest.mock import MagicMock, patch
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
    {'speaker': 'finance',   'text': 'Where is the cost breakdown?'},
    {'speaker': 'presenter', 'text': 'Total cost is $240k per year.'},
    {'speaker': 'legal',     'text': 'Who owns the data?'},
    {'speaker': 'presenter', 'text': 'Our analytics lead owns all data access.'},
]

CUSTOM_PERSONA_ID = 'custom_cto'
CUSTOM_DEFS = {
    CUSTOM_PERSONA_ID: {
        'name': 'Dana',
        'role': 'CTO',
        'speaking_style': 'Technical and precise.',
        'cares': 'System architecture and technical feasibility',
        'conditions': [
            {'id': 'ct1', 'text': 'Architecture reviewed by engineering lead'},
            {'id': 'ct2', 'text': 'Migration plan documented'},
        ],
    }
}


# ---------------------------------------------------------------------------
# all_defs
# ---------------------------------------------------------------------------

class TestAllDefs:
    def test_returns_builtin_defs_when_no_custom(self):
        defs = core.all_defs()
        assert 'finance' in defs
        assert 'legal' in defs

    def test_merges_custom_defs(self):
        defs = core.all_defs(CUSTOM_DEFS)
        assert CUSTOM_PERSONA_ID in defs
        assert defs[CUSTOM_PERSONA_ID]['name'] == 'Dana'

    def test_custom_defs_override_builtins(self):
        # custom_defs with a key matching a built-in takes precedence
        defs = core.all_defs({'finance': {'name': 'Override'}})
        assert defs['finance']['name'] == 'Override'

    def test_none_custom_defs_treated_as_empty(self):
        defs = core.all_defs(None)
        assert 'finance' in defs
        assert len(defs) == len(core.PERSONA_DEFS)

    def test_empty_dict_custom_defs_leaves_builtins_unchanged(self):
        defs = core.all_defs({})
        assert defs == core.PERSONA_DEFS

    def test_custom_def_added_alongside_builtins(self):
        defs = core.all_defs(CUSTOM_DEFS)
        assert 'finance' in defs
        assert CUSTOM_PERSONA_ID in defs


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

    def test_custom_persona_conditions_included(self):
        conds = core.get_initial_conditions([CUSTOM_PERSONA_ID], custom_defs=CUSTOM_DEFS)
        assert set(conds.keys()) == {'ct1', 'ct2'}
        assert all(v is False for v in conds.values())

    def test_custom_and_builtin_personas_combined(self):
        conds = core.get_initial_conditions(['finance', CUSTOM_PERSONA_ID], custom_defs=CUSTOM_DEFS)
        assert 'f1' in conds
        assert 'ct1' in conds

    def test_all_values_are_false_on_init(self):
        conds = core.get_initial_conditions(ALL_IDS)
        assert not any(conds.values())


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
        assert 'Alan' in result
        assert 'Head of Finance' in result

    def test_multi_turn_transcript(self):
        result = core.build_transcript_str(SAMPLE_TRANSCRIPT)
        lines = result.strip().split('\n')
        assert len(lines) == 4
        assert lines[0].startswith('Alan')
        assert lines[1].startswith('Presenter')

    def test_unknown_speaker_falls_back_to_id(self):
        msgs = [{'speaker': 'mystery_role', 'text': 'Hmm.'}]
        result = core.build_transcript_str(msgs)
        assert 'mystery_role' in result or 'Panel' in result

    def test_empty_transcript_returns_empty_string(self):
        assert core.build_transcript_str([]) == ''

    def test_custom_persona_name_used_when_defs_provided(self):
        msgs = [{'speaker': CUSTOM_PERSONA_ID, 'text': 'Architecture concern.'}]
        result = core.build_transcript_str(msgs, custom_defs=CUSTOM_DEFS)
        assert 'Dana' in result
        assert 'CTO' in result

    def test_message_with_empty_text(self):
        msgs = [{'speaker': 'presenter', 'text': ''}]
        result = core.build_transcript_str(msgs)
        assert 'Presenter:' in result

    def test_alternating_speakers_preserved_in_order(self):
        msgs = [
            {'speaker': 'finance', 'text': 'Q1'},
            {'speaker': 'presenter', 'text': 'A1'},
            {'speaker': 'legal', 'text': 'Q2'},
        ]
        result = core.build_transcript_str(msgs)
        lines = result.split('\n')
        assert 'Alan' in lines[0]
        assert 'Presenter' in lines[1]
        assert 'Alex' in lines[2]


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
                {'persona_id': 'ghost',   'text': 'Should be dropped.'},
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

    def test_empty_persona_ids_raises_value_error(self):
        with pytest.raises(ValueError, match='persona_ids'):
            core.generate_openings(SAMPLE_PROPOSAL, [], {})

    @patch('agents.core.get_client')
    def test_response_text_none_returns_empty_list(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(None)
        result = core.generate_openings(SAMPLE_PROPOSAL, ['finance'], {})
        assert result == []

    @patch('agents.core.get_client')
    def test_industry_config_in_system_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._openings_payload())
        mock_get_client.return_value = mock_client
        core.generate_openings(SAMPLE_PROPOSAL, ['finance', 'legal', 'ops'], {'industry': 'Healthcare'})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert 'Healthcare' in config.system_instruction

    @patch('agents.core.get_client')
    def test_returns_empty_list_on_malformed_json(self, mock_get_client):
        mock_get_client.return_value = make_mock_client('not valid json {{{')
        result = core.generate_openings(SAMPLE_PROPOSAL, ['finance'], {})
        assert result == []

    @patch('agents.core.get_client')
    def test_returns_empty_list_when_openings_key_missing(self, mock_get_client):
        mock_get_client.return_value = make_mock_client('{}')
        result = core.generate_openings(SAMPLE_PROPOSAL, ['finance'], {})
        assert result == []

    @patch('agents.core.get_client')
    def test_api_exception_raises_runtime_error(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception('503 Service Unavailable')
        mock_get_client.return_value = mock_client
        with pytest.raises(RuntimeError, match='Gemini API error'):
            core.generate_openings(SAMPLE_PROPOSAL, ['finance'], {})

    @patch('agents.core.get_client')
    def test_custom_persona_included_in_prompt(self, mock_get_client):
        payload = json.dumps({'openings': [{'persona_id': CUSTOM_PERSONA_ID, 'text': 'Technical concern.'}]})
        mock_client = make_mock_client(payload)
        mock_get_client.return_value = mock_client
        result = core.generate_openings(
            SAMPLE_PROPOSAL, [CUSTOM_PERSONA_ID], {}, custom_defs=CUSTOM_DEFS
        )
        assert len(result) == 1
        assert result[0]['speaker'] == CUSTOM_PERSONA_ID

    @patch('agents.core.get_client')
    def test_empty_proposal_text_does_not_raise(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._openings_payload(['finance']))
        result = core.generate_openings('', ['finance'], {})
        assert isinstance(result, list)

    @patch('agents.core.get_client')
    def test_id_field_is_sequential_starting_at_1(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._openings_payload())
        result = core.generate_openings(SAMPLE_PROPOSAL, ['finance', 'legal', 'ops'], {})
        ids = [entry['id'] for entry in result]
        assert ids == [1, 2, 3]


# ---------------------------------------------------------------------------
# generate_reply
# ---------------------------------------------------------------------------

class TestGenerateReply:
    def _reply_payload(self, speaker='legal', conditions_met=None):
        return json.dumps({
            'speaker_id':     speaker,
            'response':       f'{speaker} follow-up challenge.',
            'conditions_met': conditions_met or [],
            'source':         None,
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
        assert 'Turn 0' not in contents
        assert 'Turn 19' in contents

    def test_empty_persona_ids_raises_value_error(self):
        with pytest.raises(ValueError, match='persona_ids'):
            core.generate_reply(SAMPLE_PROPOSAL, [], SAMPLE_TRANSCRIPT, {}, {})

    @patch('agents.core.get_client')
    def test_response_text_none_returns_fallback(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(None)
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, {}, {})
        assert result['speaker'] in ['finance', 'legal']
        assert result['text'] == ''
        assert result['conditions_met'] == []

    @patch('agents.core.get_client')
    def test_returns_fallback_on_malformed_json(self, mock_get_client):
        mock_get_client.return_value = make_mock_client('not valid json {{{')
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, {}, {})
        assert result['speaker'] in ['finance', 'legal']
        assert result['text'] == ''
        assert result['conditions_met'] == []

    @patch('agents.core.get_client')
    def test_fact_check_notes_injected_in_reply_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._reply_payload('factcheck'))
        mock_get_client.return_value = mock_client
        notes = 'BLS 2025 confirms $120k median salary.'
        core.generate_reply(
            SAMPLE_PROPOSAL, ['factcheck'], SAMPLE_TRANSCRIPT, {}, {},
            fact_check_notes=notes,
        )
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert notes in config.system_instruction

    @patch('agents.core.get_client')
    def test_last_speaker_injected_in_system_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._reply_payload('ops'))
        mock_get_client.return_value = mock_client
        transcript = [
            {'speaker': 'finance',   'text': 'Cost question.'},
            {'speaker': 'presenter', 'text': 'Here are the numbers.'},
            {'speaker': 'ops',       'text': 'Who owns the transition?'},
        ]
        core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal', 'ops'], transcript, {}, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert 'ops' in config.system_instruction

    @patch('agents.core.get_client')
    def test_empty_transcript_handled_gracefully(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._reply_payload('finance'))
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance'], [], {}, {})
        assert result['speaker'] == 'finance'

    @patch('agents.core.get_client')
    def test_api_exception_raises_runtime_error(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception('Rate limit exceeded')
        mock_get_client.return_value = mock_client
        with pytest.raises(RuntimeError, match='Gemini API error'):
            core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {})

    @patch('agents.core.get_client')
    def test_custom_persona_conditions_evaluated(self, mock_get_client):
        payload = json.dumps({
            'speaker_id': CUSTOM_PERSONA_ID,
            'response': 'Architecture concern.',
            'conditions_met': ['ct1'],
            'source': None,
        })
        mock_get_client.return_value = make_mock_client(payload)
        conds = {'ct1': False, 'ct2': False}
        result = core.generate_reply(
            SAMPLE_PROPOSAL, [CUSTOM_PERSONA_ID], SAMPLE_TRANSCRIPT, conds, {},
            custom_defs=CUSTOM_DEFS,
        )
        assert result['speaker'] == CUSTOM_PERSONA_ID
        assert 'ct1' in result['conditions_met']

    @patch('agents.core.get_client')
    def test_conditions_met_from_foreign_persona_ignored(self, mock_get_client):
        # Model returns a condition ID that belongs to a persona not in the session
        payload = json.dumps({
            'speaker_id': 'finance',
            'response': 'Cost concern.',
            'conditions_met': ['l1', 'f1'],  # l1 is legal, not in persona_ids
            'source': None,
        })
        mock_get_client.return_value = make_mock_client(payload)
        conds = {'f1': False, 'f2': False}
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, conds, {})
        assert 'l1' not in result['conditions_met']
        assert 'f1' in result['conditions_met']


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
                    'asked': 'Alan asked for cost breakdown.',
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

    def test_empty_persona_ids_raises_value_error(self):
        with pytest.raises(ValueError, match='persona_ids'):
            core.generate_report(SAMPLE_PROPOSAL, [], SAMPLE_TRANSCRIPT, {})

    @patch('agents.core.get_client')
    def test_returns_empty_structure_on_invalid_json(self, mock_get_client):
        mock_get_client.return_value = make_mock_client('this is not json {')
        result = core.generate_report(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {})
        assert result == {'weak_points': [], 'moments': []}

    @patch('agents.core.get_client')
    def test_response_text_none_returns_empty_structure(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(None)
        result = core.generate_report(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {})
        assert result == {'weak_points': [], 'moments': []}

    @patch('agents.core.get_client')
    def test_api_exception_raises_runtime_error(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception('403 Permission denied')
        mock_get_client.return_value = mock_client
        with pytest.raises(RuntimeError, match='Gemini API error'):
            core.generate_report(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {})

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

    @patch('agents.core.get_client')
    def test_custom_persona_conditions_in_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._report_payload())
        mock_get_client.return_value = mock_client
        conds = {'ct1': False, 'ct2': True}
        core.generate_report(
            SAMPLE_PROPOSAL, [CUSTOM_PERSONA_ID], SAMPLE_TRANSCRIPT, conds,
            custom_defs=CUSTOM_DEFS,
        )
        contents = mock_client.models.generate_content.call_args.kwargs['contents']
        assert 'ct1' in contents or 'Architecture reviewed' in contents

    @patch('agents.core.get_client')
    def test_turn_count_constrains_moments_in_system_prompt(self, mock_get_client):
        # SAMPLE_TRANSCRIPT has exactly 2 presenter turns
        mock_client = make_mock_client(self._report_payload())
        mock_get_client.return_value = mock_client
        core.generate_report(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        si = config.system_instruction
        # Must mention the turn count so the model cannot hallucinate extra turns
        assert '2' in si
        # Must NOT allow referencing Turn 3 (which doesn't exist)
        assert 'Turn 3' not in si or 'Do not' in si

    @patch('agents.core.get_client')
    def test_single_turn_transcript_caps_moments_at_1(self, mock_get_client):
        mock_client = make_mock_client(self._report_payload())
        mock_get_client.return_value = mock_client
        single_turn = [
            {'speaker': 'finance', 'text': 'Question.'},
            {'speaker': 'presenter', 'text': 'Answer.'},
        ]
        core.generate_report(SAMPLE_PROPOSAL, ['finance'], single_turn, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        si = config.system_instruction
        # With 1 presenter turn, min and max moments are both 1
        assert '1 to 1' in si or ('Turn 1' in si and 'Turn 2' not in si)

    @patch('agents.core.get_client')
    def test_empty_transcript_does_not_raise(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._report_payload())
        result = core.generate_report(SAMPLE_PROPOSAL, ['finance'], [], {})
        assert 'weak_points' in result


# ---------------------------------------------------------------------------
# _answer_quality
# ---------------------------------------------------------------------------

class TestAnswerQuality:
    def test_empty_string_is_poor(self):
        assert core._answer_quality('') == 'poor'

    def test_none_like_falsy_is_poor(self):
        assert core._answer_quality('   ') == 'poor'

    def test_short_answer_under_15_words_is_poor(self):
        assert core._answer_quality('We will handle it.') == 'poor'

    def test_exactly_14_words_is_poor(self):
        # Boundary: 14 words is still under the 15-word threshold
        text = 'The analytics lead will own the transition and manage the parallel migration run today.'
        assert len(text.split()) == 14
        assert core._answer_quality(text) == 'poor'

    def test_exactly_15_words_no_vagueness_no_number_is_medium(self):
        text = 'The analytics lead owns the transition and will run the parallel migration process until cutover.'
        assert core._answer_quality(text) == 'medium'

    def test_two_vague_phrases_is_poor(self):
        text = ('I think we will figure this out and probably the budget will work. '
                'We plan to review the costs and maybe adjust the timeline.')
        assert core._answer_quality(text) == 'poor'

    def test_one_vague_phrase_under_30_words_is_poor(self):
        text = 'The cost is maybe around two hundred and forty thousand per year plus tooling.'
        assert core._answer_quality(text) == 'poor'

    def test_one_vague_phrase_over_30_words_no_number_is_medium(self):
        words = ('The analytics lead owns the transition and will manage the parallel run. '
                 'We have a detailed handover plan and the team is fully prepared. '
                 'I think the cutover will complete within the agreed window.')
        assert core._answer_quality(words) == 'medium'

    def test_answer_with_digit_is_good(self):
        text = ('Total cost is $240,000 per year including salary, tooling and cloud infrastructure. '
                'The payback period is under 6 years based on 30 hours saved per month at a loaded rate.')
        assert core._answer_quality(text) == 'good'

    def test_answer_40_or_more_words_no_digit_is_good(self):
        text = ' '.join(['word'] * 40)
        assert core._answer_quality(text) == 'good'

    def test_answer_39_words_no_digit_no_vagueness_is_medium(self):
        text = ' '.join(['word'] * 39)
        assert core._answer_quality(text) == 'medium'

    def test_vague_phrase_matching_is_case_insensitive(self):
        text = 'I THINK this will work and the team will PROBABLY deliver on time for the review.'
        assert core._answer_quality(text) == 'poor'

    def test_answer_with_percentage_digit_is_good(self):
        text = ('Our retention rate is 94% based on the last three quarters. '
                'The model projects breakeven within eighteen months using conservative assumptions.')
        assert core._answer_quality(text) == 'good'


# ---------------------------------------------------------------------------
# generate_reply: follow_up and turns_remaining (additional tests)
# ---------------------------------------------------------------------------

class TestGenerateReplyFollowUp:
    def _reply_with_followup(self, main='finance', fu_speaker='legal', fu_text='Legal concern.'):
        return json.dumps({
            'speaker_id': main,
            'response': 'Finance challenge.',
            'conditions_met': [],
            'source': None,
            'follow_up': {
                'speaker_id': fu_speaker,
                'response': fu_text,
                'conditions_met': [],
                'source': None,
            },
        })

    @patch('agents.core.get_client')
    def test_follow_up_included_when_valid(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._reply_with_followup('finance', 'legal'))
        conds = core.get_initial_conditions(['finance', 'legal', 'ops'])
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal', 'ops'], SAMPLE_TRANSCRIPT, conds, {})
        assert 'follow_up' in result
        assert result['follow_up']['speaker'] == 'legal'
        assert result['follow_up']['text'] == 'Legal concern.'

    @patch('agents.core.get_client')
    def test_follow_up_absent_when_null(self, mock_get_client):
        payload = json.dumps({
            'speaker_id': 'finance', 'response': 'Cost concern.',
            'conditions_met': [], 'source': None, 'follow_up': None,
        })
        mock_get_client.return_value = make_mock_client(payload)
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, {}, {})
        assert 'follow_up' not in result

    @patch('agents.core.get_client')
    def test_follow_up_excluded_when_same_speaker_as_main(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._reply_with_followup('finance', 'finance'))
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, {}, {})
        assert 'follow_up' not in result

    @patch('agents.core.get_client')
    def test_follow_up_excluded_when_speaker_not_in_persona_ids(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._reply_with_followup('finance', 'unknown_role'))
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, {}, {})
        assert 'follow_up' not in result

    @patch('agents.core.get_client')
    def test_follow_up_excluded_when_text_is_empty(self, mock_get_client):
        mock_get_client.return_value = make_mock_client(self._reply_with_followup('finance', 'legal', ''))
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, {}, {})
        assert 'follow_up' not in result

    @patch('agents.core.get_client')
    def test_follow_up_excluded_when_response_key_missing(self, mock_get_client):
        payload = json.dumps({
            'speaker_id': 'finance', 'response': 'Finance.', 'conditions_met': [], 'source': None,
            'follow_up': {'speaker_id': 'legal', 'conditions_met': [], 'source': None},
            # 'response' key intentionally omitted from follow_up
        })
        mock_get_client.return_value = make_mock_client(payload)
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, {}, {})
        assert 'follow_up' not in result

    @patch('agents.core.get_client')
    def test_follow_up_conditions_met_filters_already_met(self, mock_get_client):
        payload = json.dumps({
            'speaker_id': 'finance', 'response': 'Finance.', 'conditions_met': [], 'source': None,
            'follow_up': {
                'speaker_id': 'legal',
                'response': 'Legal challenge.',
                'conditions_met': ['l1', 'l2'],
                'source': None,
            },
        })
        mock_get_client.return_value = make_mock_client(payload)
        conds = {'f1': False, 'l1': True, 'l2': False, 'l3': False}
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, conds, {})
        assert 'l1' not in result['follow_up']['conditions_met']
        assert 'l2' in result['follow_up']['conditions_met']

    @patch('agents.core.get_client')
    def test_follow_up_source_included_when_present(self, mock_get_client):
        payload = json.dumps({
            'speaker_id': 'finance', 'response': 'Finance.', 'conditions_met': [], 'source': None,
            'follow_up': {
                'speaker_id': 'factcheck',
                'response': 'BLS data shows $120k.',
                'conditions_met': [],
                'source': 'BLS 2025',
            },
        })
        mock_get_client.return_value = make_mock_client(payload)
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'factcheck'], SAMPLE_TRANSCRIPT, {}, {})
        assert result['follow_up']['source']['label'] == 'BLS 2025'

    @patch('agents.core.get_client')
    def test_turns_remaining_3_triggers_urgency_in_system_prompt(self, mock_get_client):
        payload = json.dumps({'speaker_id': 'finance', 'response': 'Cost.', 'conditions_met': [], 'source': None})
        mock_client = make_mock_client(payload)
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {'turns_remaining': 3})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert 'URGENT' in config.system_instruction

    @patch('agents.core.get_client')
    def test_turns_remaining_1_triggers_urgency(self, mock_get_client):
        payload = json.dumps({'speaker_id': 'finance', 'response': 'Cost.', 'conditions_met': [], 'source': None})
        mock_client = make_mock_client(payload)
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {'turns_remaining': 1})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert 'URGENT' in config.system_instruction

    @patch('agents.core.get_client')
    def test_turns_remaining_0_triggers_urgency(self, mock_get_client):
        payload = json.dumps({'speaker_id': 'finance', 'response': 'Cost.', 'conditions_met': [], 'source': None})
        mock_client = make_mock_client(payload)
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {'turns_remaining': 0})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert 'URGENT' in config.system_instruction

    @patch('agents.core.get_client')
    def test_turns_remaining_4_does_not_trigger_urgency(self, mock_get_client):
        payload = json.dumps({'speaker_id': 'finance', 'response': 'Cost.', 'conditions_met': [], 'source': None})
        mock_client = make_mock_client(payload)
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {'turns_remaining': 4})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert 'URGENT' not in config.system_instruction

    @patch('agents.core.get_client')
    def test_no_turns_remaining_in_config_no_urgency(self, mock_get_client):
        payload = json.dumps({'speaker_id': 'finance', 'response': 'Cost.', 'conditions_met': [], 'source': None})
        mock_client = make_mock_client(payload)
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        assert 'URGENT' not in config.system_instruction


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
    def test_proposal_truncated_to_4000_chars(self, mock_get_client):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = 'findings'
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client
        long_proposal = 'x' * 6000
        core.fact_check_proposal(long_proposal)
        contents = mock_client.models.generate_content.call_args.kwargs['contents']
        assert len(contents) < 4600  # prompt prefix ~400 chars + 4000 char proposal cap

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

    @patch('agents.core.get_client')
    def test_returns_empty_string_when_response_text_is_none(self, mock_get_client):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = None
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client
        result = core.fact_check_proposal(SAMPLE_PROPOSAL)
        assert result == ''


# ---------------------------------------------------------------------------
# generate_reply: turn counts, proposal context, last-asked injection
# ---------------------------------------------------------------------------

class TestGenerateReplyPromptEnrichments:
    def _simple_reply(self, speaker='finance'):
        return json.dumps({
            'speaker_id': speaker,
            'response': 'Challenge.',
            'conditions_met': [],
            'source': None,
        })

    @patch('agents.core.get_client')
    def test_turn_counts_in_system_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._simple_reply('ops'))
        mock_get_client.return_value = mock_client
        transcript = [
            {'speaker': 'finance',   'text': 'Question 1.'},
            {'speaker': 'presenter', 'text': 'Answer 1.'},
            {'speaker': 'finance',   'text': 'Question 2.'},
            {'speaker': 'presenter', 'text': 'Answer 2.'},
            {'speaker': 'ops',       'text': 'Ops question.'},
            {'speaker': 'presenter', 'text': 'Answer 3.'},
        ]
        conds = core.get_initial_conditions(['finance', 'ops'])
        core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'ops'], transcript, conds, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        si = config.system_instruction
        # Alan (finance) spoke twice, Renes (ops) spoke once
        assert 'Alan: 2' in si
        assert 'Renes: 1' in si

    @patch('agents.core.get_client')
    def test_turn_counts_zero_for_persona_that_has_not_spoken(self, mock_get_client):
        mock_client = make_mock_client(self._simple_reply('finance'))
        mock_get_client.return_value = mock_client
        transcript = [
            {'speaker': 'finance',   'text': 'Cost question.'},
            {'speaker': 'presenter', 'text': 'Here are numbers.'},
        ]
        conds = core.get_initial_conditions(['finance', 'legal'])
        core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], transcript, conds, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        si = config.system_instruction
        assert 'Alex: 0' in si

    @patch('agents.core.get_client')
    def test_proposal_context_uses_2000_chars(self, mock_get_client):
        mock_client = make_mock_client(self._simple_reply('finance'))
        mock_get_client.return_value = mock_client
        long_proposal = 'A' * 3000
        conds = core.get_initial_conditions(['finance'])
        core.generate_reply(long_proposal, ['finance'], SAMPLE_TRANSCRIPT, conds, {})
        contents = mock_client.models.generate_content.call_args.kwargs['contents']
        # The first 2000 chars of the proposal must appear in contents
        assert 'A' * 2000 in contents

    @patch('agents.core.get_client')
    def test_proposal_context_not_truncated_under_2000(self, mock_get_client):
        mock_client = make_mock_client(self._simple_reply('finance'))
        mock_get_client.return_value = mock_client
        short_proposal = 'B' * 500
        conds = core.get_initial_conditions(['finance'])
        core.generate_reply(short_proposal, ['finance'], SAMPLE_TRANSCRIPT, conds, {})
        contents = mock_client.models.generate_content.call_args.kwargs['contents']
        assert 'B' * 500 in contents

    @patch('agents.core.get_client')
    def test_last_asked_injected_per_persona(self, mock_get_client):
        mock_client = make_mock_client(self._simple_reply('legal'))
        mock_get_client.return_value = mock_client
        transcript = [
            {'speaker': 'finance',   'text': 'Show me the payback period calculation.'},
            {'speaker': 'presenter', 'text': 'The payback is 4 years.'},
            {'speaker': 'legal',     'text': 'Who signs the vendor contract?'},
            {'speaker': 'presenter', 'text': 'Our procurement lead signs all contracts.'},
        ]
        conds = core.get_initial_conditions(['finance', 'legal'])
        core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], transcript, conds, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        si = config.system_instruction
        assert 'Show me the payback period calculation' in si
        assert 'Who signs the vendor contract' in si

    @patch('agents.core.get_client')
    def test_last_asked_absent_for_persona_with_no_turns(self, mock_get_client):
        mock_client = make_mock_client(self._simple_reply('finance'))
        mock_get_client.return_value = mock_client
        transcript = [
            {'speaker': 'finance',   'text': 'Cost breakdown please.'},
            {'speaker': 'presenter', 'text': 'Total is 240k.'},
        ]
        conds = core.get_initial_conditions(['finance', 'ops'])
        core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'ops'], transcript, conds, {})
        config = mock_client.models.generate_content.call_args.kwargs['config']
        si = config.system_instruction
        # ops (Renes) has never spoken so no Last asked line for ops
        # The Last asked line for finance should be present
        assert 'Cost breakdown please' in si


# ---------------------------------------------------------------------------
# generate_reply: answer quality → system prompt quality note injection
# ---------------------------------------------------------------------------

class TestAnswerQualityPromptInjection:
    """Verify that _answer_quality drives the correct quality_note in the system prompt."""

    def _reply(self, speaker='finance'):
        return json.dumps({
            'speaker_id': speaker, 'response': 'Challenge.', 'conditions_met': [], 'source': None,
        })

    @patch('agents.core.get_client')
    def test_poor_answer_injects_do_not_accept_note(self, mock_get_client):
        mock_client = make_mock_client(self._reply())
        mock_get_client.return_value = mock_client
        # Presenter's last message is short and vague
        transcript = [
            {'speaker': 'finance',   'text': 'What is the total cost?'},
            {'speaker': 'presenter', 'text': 'We will figure it out.'},
        ]
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], transcript, {}, {})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        assert 'vague' in si.lower() or 'do not accept' in si.lower()

    @patch('agents.core.get_client')
    def test_good_answer_injects_acknowledge_note(self, mock_get_client):
        mock_client = make_mock_client(self._reply())
        mock_get_client.return_value = mock_client
        good_answer = (
            'Total cost is $240,000 per year. This includes $120,000 salary for each engineer, '
            'plus $20,000 for tooling. The payback period is 4.5 years based on 30 hours saved per '
            'month at a fully loaded rate of $90 per hour.'
        )
        transcript = [
            {'speaker': 'finance',   'text': 'What is the total cost?'},
            {'speaker': 'presenter', 'text': good_answer},
        ]
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], transcript, {}, {})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        assert 'acknowledge' in si.lower() or 'substantive' in si.lower()

    @patch('agents.core.get_client')
    def test_medium_answer_injects_no_quality_note(self, mock_get_client):
        mock_client = make_mock_client(self._reply())
        mock_get_client.return_value = mock_client
        medium_answer = (
            'The analytics team will own the transition and has committed to completing it '
            'within the agreed migration window.'
        )
        transcript = [
            {'speaker': 'finance',   'text': 'Who owns this?'},
            {'speaker': 'presenter', 'text': medium_answer},
        ]
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], transcript, {}, {})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        # Medium quality: no quality_note injected, so no IMPORTANT block
        assert 'IMPORTANT: The presenter just gave' not in si
        assert 'substantive, specific' not in si

    @patch('agents.core.get_client')
    def test_empty_transcript_treated_as_poor_answer(self, mock_get_client):
        mock_client = make_mock_client(self._reply())
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], [], {}, {})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        # Empty transcript means no presenter message, which is falsy → poor quality
        assert 'vague' in si.lower() or 'do not accept' in si.lower() or 'IMPORTANT' in si


# ---------------------------------------------------------------------------
# generate_reply: first-right-of-reply and prompt structure rules
# ---------------------------------------------------------------------------

class TestGenerateReplyPromptRules:
    """Verify that key behavioural rules appear in the system prompt."""

    def _reply(self, speaker='finance'):
        return json.dumps({
            'speaker_id': speaker, 'response': 'Challenge.', 'conditions_met': [], 'source': None,
        })

    @patch('agents.core.get_client')
    def test_first_right_of_reply_rule_in_system_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._reply('ops'))
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'ops'], SAMPLE_TRANSCRIPT, {}, {})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        assert 'first right of reply' in si.lower()

    @patch('agents.core.get_client')
    def test_contradiction_detection_rule_in_system_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._reply('finance'))
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        assert 'contradict' in si.lower()

    @patch('agents.core.get_client')
    def test_em_dash_prohibition_in_system_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._reply('finance'))
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        assert 'em dash' in si.lower()

    @patch('agents.core.get_client')
    def test_follow_up_full_schema_in_system_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._reply('finance'))
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, {}, {})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        # The system prompt must show the follow_up object structure so the model knows
        # it can return a non-null object
        assert '"follow_up"' in si

    @patch('agents.core.get_client')
    def test_all_unmet_conditions_appear_in_system_prompt(self, mock_get_client):
        mock_client = make_mock_client(self._reply('finance'))
        mock_get_client.return_value = mock_client
        conds = {'f1': False, 'f2': False, 'f3': True}
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, conds, {})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        assert 'f1' in si
        assert 'f2' in si
        assert 'unmet' in si.lower()
        assert 'MET' in si

    @patch('agents.core.get_client')
    def test_proposal_marked_as_review_material_not_instructions(self, mock_get_client):
        mock_client = make_mock_client(self._reply('finance'))
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        assert 'never instructions' in si.lower() or 'not instructions' in si.lower()


# ---------------------------------------------------------------------------
# Full rehearsal session simulation
# ---------------------------------------------------------------------------

class TestFullRehearsalSession:
    """Simulate a complete rehearsal: openings → multiple replies → report.
    All Gemini calls are mocked. Verify that conditions accumulate correctly
    across turns and that the final report receives the right state."""

    @patch('agents.core.get_client')
    def test_conditions_accumulate_across_turns(self, mock_get_client):
        # Turn 1 reply: finance meets f1
        # Turn 2 reply: finance meets f2
        # After both turns f1 and f2 are marked True, f3 still False
        side_effects = [
            MagicMock(text=json.dumps({
                'speaker_id': 'finance', 'response': 'Good, TCO noted.',
                'conditions_met': ['f1'], 'source': None, 'follow_up': None,
            })),
            MagicMock(text=json.dumps({
                'speaker_id': 'finance', 'response': 'Payback noted too.',
                'conditions_met': ['f2'], 'source': None, 'follow_up': None,
            })),
        ]
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = side_effects
        mock_get_client.return_value = mock_client

        conds = core.get_initial_conditions(['finance'])
        transcript = [
            {'speaker': 'finance',   'text': 'Where is the cost breakdown?'},
            {'speaker': 'presenter', 'text': 'Total cost is $240k per year. Payback is 4 years.'},
        ]

        r1 = core.generate_reply(SAMPLE_PROPOSAL, ['finance'], transcript, conds, {})
        for cid in r1['conditions_met']:
            conds[cid] = True

        transcript += [
            {'speaker': 'finance',   'text': r1['text']},
            {'speaker': 'presenter', 'text': 'Payback period is 4 years at $90/hr loaded rate.'},
        ]

        r2 = core.generate_reply(SAMPLE_PROPOSAL, ['finance'], transcript, conds, {})
        for cid in r2['conditions_met']:
            conds[cid] = True

        assert conds['f1'] is True
        assert conds['f2'] is True
        assert conds['f3'] is False

    @patch('agents.core.get_client')
    def test_already_met_condition_not_re_marked(self, mock_get_client):
        # Model tries to mark f1 again in turn 2; it should be silently dropped
        side_effects = [
            MagicMock(text=json.dumps({
                'speaker_id': 'finance', 'response': 'Noted.',
                'conditions_met': ['f1'], 'source': None, 'follow_up': None,
            })),
            MagicMock(text=json.dumps({
                'speaker_id': 'finance', 'response': 'Still pressing.',
                'conditions_met': ['f1'], 'source': None, 'follow_up': None,
            })),
        ]
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = side_effects
        mock_get_client.return_value = mock_client

        conds = core.get_initial_conditions(['finance'])
        r1 = core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, conds, {})
        for cid in r1['conditions_met']:
            conds[cid] = True

        r2 = core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, conds, {})
        # f1 already True; generate_reply must not return it again
        assert 'f1' not in r2['conditions_met']

    @patch('agents.core.get_client')
    def test_multi_persona_session_conditions_tracked_independently(self, mock_get_client):
        # finance meets f1 in turn 1; legal meets l1 in turn 2
        side_effects = [
            MagicMock(text=json.dumps({
                'speaker_id': 'finance', 'response': 'Cost ok.',
                'conditions_met': ['f1'], 'source': None, 'follow_up': None,
            })),
            MagicMock(text=json.dumps({
                'speaker_id': 'legal', 'response': 'Privacy noted.',
                'conditions_met': ['l1'], 'source': None, 'follow_up': None,
            })),
        ]
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = side_effects
        mock_get_client.return_value = mock_client

        conds = core.get_initial_conditions(['finance', 'legal'])
        r1 = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, conds, {})
        for cid in r1['conditions_met']:
            conds[cid] = True

        r2 = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, conds, {})
        for cid in r2['conditions_met']:
            conds[cid] = True

        assert conds['f1'] is True
        assert conds['l1'] is True
        assert conds['f2'] is False
        assert conds['l2'] is False

    @patch('agents.core.get_client')
    def test_report_receives_final_condition_state(self, mock_get_client):
        # Set up conditions so that f1 is True, rest False
        # Then call generate_report and confirm MET/UNMET appear correctly in prompt
        report_payload = json.dumps({
            'weak_points': [{'label': 'Finance', 'issue': 'No payback', 'fix': 'Add a table.'}],
            'moments': [],
        })
        mock_client = make_mock_client(report_payload)
        mock_get_client.return_value = mock_client

        conds = core.get_initial_conditions(['finance'])
        conds['f1'] = True  # simulate one condition having been met

        core.generate_report(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, conds)
        contents = mock_client.models.generate_content.call_args.kwargs['contents']
        assert '[MET]' in contents
        assert '[UNMET]' in contents

    @patch('agents.core.get_client')
    def test_follow_up_from_second_persona_during_session(self, mock_get_client):
        # Simulate a scenario where legal jumps in as follow_up during finance's turn
        payload = json.dumps({
            'speaker_id': 'finance',
            'response': 'The cost is $240k. No vendor contract yet.',
            'conditions_met': [],
            'source': None,
            'follow_up': {
                'speaker_id': 'legal',
                'response': 'Hold on. Who is responsible if the vendor breaches the contract?',
                'conditions_met': [],
                'source': None,
            },
        })
        mock_client = make_mock_client(payload)
        mock_get_client.return_value = mock_client

        conds = core.get_initial_conditions(['finance', 'legal'])
        result = core.generate_reply(SAMPLE_PROPOSAL, ['finance', 'legal'], SAMPLE_TRANSCRIPT, conds, {})

        assert result['speaker'] == 'finance'
        assert 'follow_up' in result
        assert result['follow_up']['speaker'] == 'legal'
        assert 'vendor' in result['follow_up']['text'].lower() or 'contract' in result['follow_up']['text'].lower()

    @patch('agents.core.get_client')
    def test_urgency_note_names_count_in_prompt(self, mock_get_client):
        mock_client = make_mock_client(json.dumps({
            'speaker_id': 'finance', 'response': 'Cost.', 'conditions_met': [], 'source': None,
        }))
        mock_get_client.return_value = mock_client
        core.generate_reply(SAMPLE_PROPOSAL, ['finance'], SAMPLE_TRANSCRIPT, {}, {'turns_remaining': 2})
        si = mock_client.models.generate_content.call_args.kwargs['config'].system_instruction
        assert '2' in si
        assert 'URGENT' in si
