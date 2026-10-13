from dataclasses import dataclass


@dataclass
class PersonaCard:
    id: str
    name: str
    role: str
    goals: list[str]
    concerns: list[str]
    speaking_style: str


# The three default panelists. All role-based. No real people imitated.
PERSONAS: list[PersonaCard] = [
    PersonaCard(
        id="finance",
        name="Morgan",
        role="Head of Finance",
        goals=[
            "Ensure every cost is justified with a clear ROI",
            "Protect the annual budget from scope creep",
            "Identify hidden or underestimated costs",
        ],
        concerns=[
            "Vague or unsubstantiated financial projections",
            "Missing contingency budget",
            "Optimistic revenue assumptions without evidence",
        ],
        speaking_style=(
            "Direct, numbers-focused, and skeptical of optimism. "
            "Always asks for specific figures and evidence."
        ),
    ),
    PersonaCard(
        id="legal",
        name="Alex",
        role="Legal Counsel",
        goals=[
            "Identify regulatory and compliance risks",
            "Ensure the company is protected from liability",
            "Clarify contractual and IP ownership before any commitment",
        ],
        concerns=[
            "Data privacy and GDPR/CCPA compliance gaps",
            "Undefined liability in vendor contracts",
            "Intellectual property ownership ambiguity",
        ],
        speaking_style=(
            "Precise and methodical. Highlights edge cases and undefined terms. "
            "Asks for documentation and written commitments."
        ),
    ),
    PersonaCard(
        id="ops",
        name="Jordan",
        role="Head of Operations",
        goals=[
            "Verify execution is actually feasible given current capacity",
            "Identify resource and staffing gaps",
            "Protect team bandwidth from over-commitment",
        ],
        concerns=[
            "Unrealistic timelines with no buffer",
            "Unclear ownership of deliverables",
            "Integration complexity with existing systems",
        ],
        speaking_style=(
            "Practical and detail-oriented. Pushes back on vague plans. "
            "Always asks who owns what and what happens when things slip."
        ),
    ),
]
