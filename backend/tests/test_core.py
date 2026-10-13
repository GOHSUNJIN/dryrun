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

    def test_custom_does_not_overwrite_builtins(self):
        defs = core.all_defs({'finance': {'name': 'Override'}})
        assert defs['finance']['name'] == 'Override'

    def test_none_custom_defs_treated_as_empty(self):
        defs = core.all_defs(None)
        assert 'finance' in defs
        assert len(defs) == len(core.PERSONA_DEFS)


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

    def test_custom_persona_name_used_when_defs_provided(self):
        msgs = [{'speaker': CUSTOM_PERSONA_ID, 'text': 'Architecture concern.'}]
        result = core.build_transcript_str(msgs, custom_defs=CUSTOM_DEFS)
        assert 'Dana' in result
        assert 'CTO' in result


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

    def test_exactly_15_words_no_vagueness_no_number_is_medium(self):
        # 15 words: just clears the < 15 short-answer gate
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
        # 31 words, 1 vague phrase ('i think') but >= 30 words so only 'poor' if vague_hits >= 2
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
