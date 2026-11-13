"""Classifier and Priority Assignment module (BCS503).

Categorizes smart meter anomaly reports into exactly five categories:
1. Tampering
2. Outage
3. Hardware
4. Communication
5. Overconsumption

Applies deterministic tie-breaking:
Tampering > Outage > Hardware > Communication > Overconsumption.
Assigns base priorities and urgency-adjusted final priorities.
"""

from typing import Any, Dict, List, Optional, Tuple

CATEGORY_PRIORITY_ORDER = [
    "Tampering",
    "Outage",
    "Hardware",
    "Communication",
    "Overconsumption"
]

BASE_PRIORITY_MAP = {
    "Outage": "P1",
    "Tampering": "P2",
    "Hardware": "P3",
    "Communication": "P3",
    "Overconsumption": "P4"
}

# Priority ranking (lower index = more urgent)
PRIORITY_RANKS = {"P1": 1, "P2": 2, "P3": 3, "P4": 4}
RANK_TO_PRIORITY = {1: "P1", 2: "P2", 3: "P3", 4: "P4"}


def parse_reading_hundredths(reading_str: str) -> int:
    """Converts a valid reading string (e.g. '00432.57kWh') into integer hundredths.

    Example: '00432.57kWh' -> 43257.
    """
    clean = reading_str.replace("kWh", "").strip()
    parts = clean.split(".")
    int_part = int(parts[0])
    dec_part = int(parts[1])
    return int_part * 100 + dec_part


def format_hundredths_reading(hundredths: int) -> str:
    """Formats integer hundredths back into standard '00432.57kWh' string format."""
    int_part = hundredths // 100
    dec_part = hundredths % 100
    return f"{int_part:05d}.{dec_part:02d}kWh"


def classify_report(
    event_code: str,
    previous_reading_hundredths: int,
    current_reading_hundredths: int,
    threshold_hundredths: int = 20000,  # 200.00 kWh default
    urgency: str = "Routine"
) -> Tuple[Optional[str], List[str], Optional[str], Optional[str], Optional[str]]:
    """Evaluates anomaly patterns and determines:

    - category (or None if NO_ANOMALY)
    - matched_patterns: list of all matched patterns
    - decision_rule: description of the resolution logic
    - base_priority: most urgent base priority among ALL matched patterns
    - final_priority: urgency-adjusted priority
    """
    matched_patterns = []

    if event_code == "TM":
        matched_patterns.append("Tampering")
    elif event_code == "OT":
        matched_patterns.append("Outage")
    elif event_code == "HA":
        matched_patterns.append("Hardware")
    elif event_code == "CM":
        matched_patterns.append("Communication")

    consumption = current_reading_hundredths - previous_reading_hundredths
    if consumption > threshold_hundredths:
        matched_patterns.append("Overconsumption")

    if not matched_patterns:
        return None, [], "No anomaly patterns matched", None, None

    # Determine winning category based on fixed precedence:
    # Tampering > Outage > Hardware > Communication > Overconsumption
    chosen_category = None
    for cat in CATEGORY_PRIORITY_ORDER:
        if cat in matched_patterns:
            chosen_category = cat
            break

    if len(matched_patterns) > 1:
        decision_rule = (
            f"Multiple patterns matched ({', '.join(matched_patterns)}). "
            f"Resolved by priority order (Tampering > Outage > Hardware > Communication > Overconsumption) to {chosen_category}."
        )
    else:
        decision_rule = f"Single pattern matched: {chosen_category}."

    # Base priority: most urgent base priority among ALL matched patterns
    min_rank = min(PRIORITY_RANKS[BASE_PRIORITY_MAP[p]] for p in matched_patterns)
    base_priority = RANK_TO_PRIORITY[min_rank]

    # Adjust priority by Urgency:
    # Routine: no change
    # Elevated: raises one level (floor P1)
    # Critical: sets P1
    if urgency == "Critical":
        final_priority = "P1"
    elif urgency == "Elevated":
        curr_rank = PRIORITY_RANKS[base_priority]
        adjusted_rank = max(1, curr_rank - 1)
        final_priority = RANK_TO_PRIORITY[adjusted_rank]
    else:  # Routine or unspecified
        final_priority = base_priority

    return chosen_category, matched_patterns, decision_rule, base_priority, final_priority
