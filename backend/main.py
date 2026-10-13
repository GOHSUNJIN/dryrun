"""
Dry Run: terminal rehearsal script (Milestone 1).

Usage:
    python main.py

Type your responses at the "You:" prompt.
Type "quit" to end the session and receive a feedback report.
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()  # must run before any agents module imports get_client()

from agents.personas import PERSONAS
from agents.persona_agent import persona_reply
from agents.moderator import pick_next_speaker
from agents.report import generate_report

PROPOSAL_FILE = "proposal.txt"
TURN_LIMIT = 20  # max presenter turns before the session auto-ends


def load_proposal() -> str:
    if not os.path.exists(PROPOSAL_FILE):
        sys.exit(f"Error: '{PROPOSAL_FILE}' not found. Add your proposal text and re-run.")
    with open(PROPOSAL_FILE, encoding="utf-8") as f:
        return f.read().strip()


def format_transcript(entries: list[dict]) -> str:
    return "\n".join(f"{e['speaker']}: {e['text']}" for e in entries)


def main() -> None:
    proposal_text = load_proposal()
    personas_by_id = {p.id: p for p in PERSONAS}
    transcript: list[dict] = []

    print("=" * 62)
    print("  DRY RUN: Stakeholder Rehearsal")
    print("=" * 62)
    print("  Panel: " + "  |  ".join(f"{p.name} ({p.role})" for p in PERSONAS))
    print("\n  Proposal loaded. The panel has reviewed it.")
    print("  Type your response at the prompt. Type 'quit' to end.\n")

    # Opening round: each persona states their biggest concern unprompted.
    print("─" * 62)
    print("  OPENING CHALLENGES")
    print("─" * 62)
    for persona in PERSONAS:
        reply = persona_reply(
            persona,
            proposal_text,
            transcript="",
            prompt=(
                "The presenter is about to begin. "
                "State your single biggest concern about this proposal in one sharp question or challenge."
            ),
        )
        transcript.append({"speaker": f"{persona.name} ({persona.role})", "text": reply})

    # Main conversation loop.
    print("\n" + "─" * 62)
    turns = 0
    while turns < TURN_LIMIT:
        try:
            user_input = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not user_input:
            continue
        if user_input.lower() == "quit":
            break

        transcript.append({"speaker": "Presenter", "text": user_input})

        # Moderator picks who responds based on unresolved concerns.
        speaker_id = pick_next_speaker(format_transcript(transcript), user_input)
        persona = personas_by_id.get(speaker_id, PERSONAS[0])

        reply = persona_reply(
            persona,
            proposal_text,
            format_transcript(transcript),
            "Respond to the presenter's last statement.",
        )
        transcript.append({"speaker": f"{persona.name} ({persona.role})", "text": reply})
        turns += 1

    if turns >= TURN_LIMIT:
        print(f"\n[Turn limit of {TURN_LIMIT} reached. Ending session.]")

    # Feedback report.
    print("\n" + "=" * 62)
    print("  SESSION ENDED. Generating feedback report...")
    print("=" * 62 + "\n")

    report = generate_report(proposal_text, format_transcript(transcript))
    print(report)


if __name__ == "__main__":
    main()
