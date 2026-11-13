"""Automata package for GridWatch."""

from .dfa import DFA
from .definitions import (
    REGEX_METER_ID,
    REGEX_READING,
    REGEX_EVENT_CODE,
    meter_id_dfa,
    reading_dfa,
    event_code_dfa,
    get_all_automata_metadata,
)
from .compare import (
    compare_meter_id,
    compare_reading,
    compare_event_code,
    run_random_mutation_tests,
)

__all__ = [
    "DFA",
    "REGEX_METER_ID",
    "REGEX_READING",
    "REGEX_EVENT_CODE",
    "meter_id_dfa",
    "reading_dfa",
    "event_code_dfa",
    "get_all_automata_metadata",
    "compare_meter_id",
    "compare_reading",
    "compare_event_code",
    "run_random_mutation_tests",
]
