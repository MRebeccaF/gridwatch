"""DFA vs Regular Expression comparison module.

Validates that both formalisms agree on all inputs and provides utilities for
mutation testing and randomized property checking.
"""

import logging
import random
import string
from typing import Any, Dict, List, Tuple
from .definitions import (
    REGEX_METER_ID,
    REGEX_READING,
    REGEX_EVENT_CODE,
    meter_id_dfa,
    reading_dfa,
    event_code_dfa,
)

logger = logging.getLogger("gridwatch.automata.compare")


def compare_meter_id(input_str: str) -> Dict[str, Any]:
    """Compares Meter ID evaluation using DFA and Regex."""
    dfa_res = meter_id_dfa.simulate(input_str)
    regex_match = bool(REGEX_METER_ID.fullmatch(input_str))
    dfa_verdict = dfa_res["accepted"]

    agrees = (dfa_verdict == regex_match)
    if not agrees:
        logger.error(
            "DISAGREEMENT in Meter ID validation: input=%r, dfa=%s, regex=%s",
            input_str, dfa_verdict, regex_match
        )

    return {
        "input": input_str,
        "dfa_accepted": dfa_verdict,
        "regex_accepted": regex_match,
        "agreement": agrees,
        "dfa_trace": dfa_res["trace"],
        "failure_index": dfa_res["failure_index"],
        "expected_symbols": dfa_res["expected_symbols"],
        "error_message": dfa_res["error_message"]
    }


def compare_reading(input_str: str) -> Dict[str, Any]:
    """Compares Reading evaluation using DFA and Regex."""
    dfa_res = reading_dfa.simulate(input_str)
    regex_match = bool(REGEX_READING.fullmatch(input_str))
    dfa_verdict = dfa_res["accepted"]

    agrees = (dfa_verdict == regex_match)
    if not agrees:
        logger.error(
            "DISAGREEMENT in Reading validation: input=%r, dfa=%s, regex=%s",
            input_str, dfa_verdict, regex_match
        )

    return {
        "input": input_str,
        "dfa_accepted": dfa_verdict,
        "regex_accepted": regex_match,
        "agreement": agrees,
        "dfa_trace": dfa_res["trace"],
        "failure_index": dfa_res["failure_index"],
        "expected_symbols": dfa_res["expected_symbols"],
        "error_message": dfa_res["error_message"]
    }


def compare_event_code(input_str: str) -> Dict[str, Any]:
    """Compares Event Code evaluation using DFA and Regex."""
    dfa_res = event_code_dfa.simulate(input_str)
    regex_match = bool(REGEX_EVENT_CODE.fullmatch(input_str))
    dfa_verdict = dfa_res["accepted"]

    agrees = (dfa_verdict == regex_match)
    if not agrees:
        logger.error(
            "DISAGREEMENT in Event Code validation: input=%r, dfa=%s, regex=%s",
            input_str, dfa_verdict, regex_match
        )

    return {
        "input": input_str,
        "dfa_accepted": dfa_verdict,
        "regex_accepted": regex_match,
        "agreement": agrees,
        "dfa_trace": dfa_res["trace"],
        "failure_index": dfa_res["failure_index"],
        "expected_symbols": dfa_res["expected_symbols"],
        "error_message": dfa_res["error_message"]
    }


def run_random_mutation_tests(n: int = 10000) -> Tuple[int, int, List[str]]:
    """Generates valid strings, introduces random mutations, and asserts DFA &

    Regex agree on all.
    Returns (total_tested, agreements, list_of_disagreements).
    """
    disagreements = []
    # Seeded for determinism
    rng = random.Random(42)

    # Valid template components
    chars_pool = string.ascii_letters + string.digits + ". \n\r\t!@#$%^&*()-=_+[]{}|;:'\",<>/?"

    for i in range(n):
        # Pick type of test
        test_type = i % 3

        if test_type == 0:
            # Meter ID
            # 50% chance generate valid base
            if rng.random() < 0.5:
                zone = rng.choice(string.ascii_uppercase)
                digits = f"{rng.randint(0, 999):03d}"
                phase = rng.choice(["R", "Y", "B"])
                s = f"GRID{zone}{digits}{phase}"
            else:
                # Random noisy string
                s = "".join(rng.choice(chars_pool) for _ in range(rng.randint(0, 15)))

            # Occasionally mutate single char
            if rng.random() < 0.3 and len(s) > 0:
                pos = rng.randint(0, len(s) - 1)
                mutation_char = rng.choice(chars_pool)
                s = s[:pos] + mutation_char + s[pos + 1:]

            res = compare_meter_id(s)
            if not res["agreement"]:
                disagreements.append(f"Meter ID disagreement on {s!r}")

        elif test_type == 1:
            # Reading
            if rng.random() < 0.5:
                int_part = f"{rng.randint(0, 99999):05d}"
                dec_part = f"{rng.randint(0, 99):02d}"
                s = f"{int_part}.{dec_part}kWh"
            else:
                s = "".join(rng.choice(chars_pool) for _ in range(rng.randint(0, 18)))

            if rng.random() < 0.3 and len(s) > 0:
                pos = rng.randint(0, len(s) - 1)
                mutation_char = rng.choice(chars_pool)
                s = s[:pos] + mutation_char + s[pos + 1:]

            res = compare_reading(s)
            if not res["agreement"]:
                disagreements.append(f"Reading disagreement on {s!r}")

        else:
            # Event code
            if rng.random() < 0.5:
                s = rng.choice(["TM", "OT", "HA", "CM", "NONE"])
            else:
                s = "".join(rng.choice(chars_pool) for _ in range(rng.randint(0, 8)))

            res = compare_event_code(s)
            if not res["agreement"]:
                disagreements.append(f"Event Code disagreement on {s!r}")

    return n, n - len(disagreements), disagreements
