"""Automata definitions for Meter ID, Reading, and Event Code."""

import re
import string
from typing import Dict
from .dfa import DFA

# Regex twins with strict ASCII character classes
REGEX_METER_ID = re.compile(r"^GRID[A-Z][0-9]{3}[RYB]$")
REGEX_READING = re.compile(r"^[0-9]{5}[.][0-9]{2}kWh$")
REGEX_EVENT_CODE = re.compile(r"^(TM|OT|HA|CM|NONE)$")

ASCII_DIGITS = set(string.digits)
ASCII_UPPERCASE = set(string.ascii_uppercase)
PHASE_LETTERS = {"R", "Y", "B"}


def is_ascii_digit(char: str) -> bool:
    return char in ASCII_DIGITS


def is_ascii_upper(char: str) -> bool:
    return char in ASCII_UPPERCASE


def is_phase_letter(char: str) -> bool:
    return char in PHASE_LETTERS


# -------------------------------------------------------------
# 1. Meter ID DFA (9-step symbol chain)
# Format: GRID + [A-Z] + [0-9]{3} + [RYB]
# Total length: 9 chars
# -------------------------------------------------------------
METER_ID_STATES = [f"q{i}" for i in range(10)] + ["DEAD"]
METER_ID_RULES = [
    {"from_state": "q0", "symbol_matcher": "G", "label": "'G'", "to_state": "q1"},
    {"from_state": "q1", "symbol_matcher": "R", "label": "'R'", "to_state": "q2"},
    {"from_state": "q2", "symbol_matcher": "I", "label": "'I'", "to_state": "q3"},
    {"from_state": "q3", "symbol_matcher": "D", "label": "'D'", "to_state": "q4"},
    {"from_state": "q4", "symbol_matcher": is_ascii_upper, "label": "grid zone [A-Z]", "to_state": "q5"},
    {"from_state": "q5", "symbol_matcher": is_ascii_digit, "label": "digit [0-9]", "to_state": "q6"},
    {"from_state": "q6", "symbol_matcher": is_ascii_digit, "label": "digit [0-9]", "to_state": "q7"},
    {"from_state": "q7", "symbol_matcher": is_ascii_digit, "label": "digit [0-9]", "to_state": "q8"},
    {"from_state": "q8", "symbol_matcher": is_phase_letter, "label": "phase [R, Y, B]", "to_state": "q9"},
]

meter_id_dfa = DFA(
    name="Meter ID DFA",
    states=METER_ID_STATES,
    start_state="q0",
    accept_states={"q9"},
    dead_state="DEAD",
    alphabet_description="Literal 'GRID' + uppercase zone [A-Z] + 3 digits [0-9] + phase letter [RYB]",
    transition_rules=METER_ID_RULES,
    description="Recognizes valid 9-character smart meter IDs (e.g. GRIDB042R)."
)


# -------------------------------------------------------------
# 2. Reading DFA (11-step symbol chain)
# Format: [0-9]{5} + '.' + [0-9]{2} + 'kWh'
# Total length: 11 chars
# -------------------------------------------------------------
READING_STATES = [f"q{i}" for i in range(12)] + ["DEAD"]
READING_RULES = [
    {"from_state": "q0", "symbol_matcher": is_ascii_digit, "label": "digit [0-9]", "to_state": "q1"},
    {"from_state": "q1", "symbol_matcher": is_ascii_digit, "label": "digit [0-9]", "to_state": "q2"},
    {"from_state": "q2", "symbol_matcher": is_ascii_digit, "label": "digit [0-9]", "to_state": "q3"},
    {"from_state": "q3", "symbol_matcher": is_ascii_digit, "label": "digit [0-9]", "to_state": "q4"},
    {"from_state": "q4", "symbol_matcher": is_ascii_digit, "label": "digit [0-9]", "to_state": "q5"},
    {"from_state": "q5", "symbol_matcher": ".", "label": "decimal point '.'", "to_state": "q6"},
    {"from_state": "q6", "symbol_matcher": is_ascii_digit, "label": "digit [0-9]", "to_state": "q7"},
    {"from_state": "q7", "symbol_matcher": is_ascii_digit, "label": "digit [0-9]", "to_state": "q8"},
    {"from_state": "q8", "symbol_matcher": "k", "label": "literal 'k'", "to_state": "q9"},
    {"from_state": "q9", "symbol_matcher": "W", "label": "literal 'W'", "to_state": "q10"},
    {"from_state": "q10", "symbol_matcher": "h", "label": "literal 'h'", "to_state": "q11"},
]

reading_dfa = DFA(
    name="Reading DFA",
    states=READING_STATES,
    start_state="q0",
    accept_states={"q11"},
    dead_state="DEAD",
    alphabet_description="5 digits + decimal point '.' + 2 digits + literal 'kWh'",
    transition_rules=READING_RULES,
    description="Recognizes valid 11-character cumulative meter readings (e.g. 00432.57kWh)."
)


# -------------------------------------------------------------
# 3. Event Code DFA (Branching tree)
# Supported: TM, OT, HA, CM, NONE
# -------------------------------------------------------------
EVENT_CODE_STATES = [
    "q0", "q_T", "q_TM", "q_O", "q_OT", "q_H", "q_HA", "q_C", "q_CM",
    "q_N", "q_NO", "q_NON", "q_NONE", "DEAD"
]
EVENT_CODE_RULES = [
    # TM
    {"from_state": "q0", "symbol_matcher": "T", "label": "'T'", "to_state": "q_T"},
    {"from_state": "q_T", "symbol_matcher": "M", "label": "'M'", "to_state": "q_TM"},
    # OT
    {"from_state": "q0", "symbol_matcher": "O", "label": "'O'", "to_state": "q_O"},
    {"from_state": "q_O", "symbol_matcher": "T", "label": "'T'", "to_state": "q_OT"},
    # HA
    {"from_state": "q0", "symbol_matcher": "H", "label": "'H'", "to_state": "q_H"},
    {"from_state": "q_H", "symbol_matcher": "A", "label": "'A'", "to_state": "q_HA"},
    # CM
    {"from_state": "q0", "symbol_matcher": "C", "label": "'C'", "to_state": "q_C"},
    {"from_state": "q_C", "symbol_matcher": "M", "label": "'M'", "to_state": "q_CM"},
    # NONE
    {"from_state": "q0", "symbol_matcher": "N", "label": "'N'", "to_state": "q_N"},
    {"from_state": "q_N", "symbol_matcher": "O", "label": "'O'", "to_state": "q_NO"},
    {"from_state": "q_NO", "symbol_matcher": "N", "label": "'N'", "to_state": "q_NON"},
    {"from_state": "q_NON", "symbol_matcher": "E", "label": "'E'", "to_state": "q_NONE"},
]

event_code_dfa = DFA(
    name="Event Code DFA",
    states=EVENT_CODE_STATES,
    start_state="q0",
    accept_states={"q_TM", "q_OT", "q_HA", "q_CM", "q_NONE"},
    dead_state="DEAD",
    alphabet_description="Event codes: TM (Tamper), OT (Outage), HA (Hardware), CM (Communication), NONE",
    transition_rules=EVENT_CODE_RULES,
    description="Recognizes supported anomaly event codes."
)


def get_all_automata_metadata() -> Dict[str, dict]:
    """Returns complete JSON metadata for all 3 DFAs and their regex twins."""
    return {
        "meter_id": {
            "dfa": meter_id_dfa.to_dict(),
            "regex": REGEX_METER_ID.pattern,
            "example_valid": "GRIDB042R",
            "example_invalid": "GRIDB042X",
            "description": "Validates 9-char meter identifier (Prefix GRID, zone [A-Z], 3-digit serial, phase R/Y/B)."
        },
        "reading": {
            "dfa": reading_dfa.to_dict(),
            "regex": REGEX_READING.pattern,
            "example_valid": "00432.57kWh",
            "example_invalid": "00432.5kWh",
            "description": "Validates 11-char energy reading in format XXXXX.XXkWh."
        },
        "event_code": {
            "dfa": event_code_dfa.to_dict(),
            "regex": REGEX_EVENT_CODE.pattern,
            "example_valid": "TM",
            "example_invalid": "UNKNOWN",
            "description": "Validates supported anomaly codes (TM, OT, HA, CM, NONE)."
        }
    }
