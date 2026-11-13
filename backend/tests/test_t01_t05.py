"""Tests T01 to T05: Automata and Regex Twin verification."""

import pytest
from backend.automata import (
    compare_meter_id,
    compare_reading,
    compare_event_code,
    run_random_mutation_tests,
    meter_id_dfa,
    reading_dfa,
    event_code_dfa,
)


def test_t01_valid_meter_id():
    """T01: Valid meter ID GRIDB042R accepted by DFA and regex."""
    res = compare_meter_id("GRIDB042R")
    assert res["agreement"] is True
    assert res["dfa_accepted"] is True
    assert res["regex_accepted"] is True
    assert res["error_message"] is None

    # Test other valid zones and phases
    for zone in ["A", "C", "D", "E", "Z"]:
        for phase in ["R", "Y", "B"]:
            test_id = f"GRID{zone}001{phase}"
            r = compare_meter_id(test_id)
            assert r["agreement"] is True
            assert r["dfa_accepted"] is True


def test_t02_invalid_meter_ids():
    """T02: Invalid meter IDs rejected by both DFA and regex."""
    invalid_cases = [
        ("gridB042R", "lowercase prefix"),
        ("GRIDb042R", "lowercase zone"),
        ("GRID042R", "missing zone letter"),
        ("GRIDB04R", "short digits (2 digits)"),
        ("GRIDB0423R", "long digits (4 digits)"),
        ("GRIDB042X", "bad phase X"),
        ("GRIDB042", "missing phase"),
        ("", "empty string"),
        ("GRIDB042R\n", "trailing newline"),
        ("GRIDB042R ", "trailing space"),
        (" GRIDB042R", "leading space"),
        ("GRIDB०42R", "non-ASCII digit (Devanagari zero)"),
        ("GRIDB042r", "lowercase phase"),
    ]

    for val, reason in invalid_cases:
        res = compare_meter_id(val)
        assert res["agreement"] is True, f"Failed agreement on {reason}: {val!r}"
        assert res["dfa_accepted"] is False, f"Expected reject for {reason}: {val!r}"
        assert res["regex_accepted"] is False, f"Expected regex reject for {reason}: {val!r}"
        assert res["error_message"] is not None


def test_t03_reading_valid_and_invalid():
    """T03: Reading valid and invalid cases."""
    # Valid readings
    valid_readings = [
        "00432.57kWh",
        "00000.00kWh",
        "99999.99kWh",
        "12345.67kWh"
    ]
    for val in valid_readings:
        res = compare_reading(val)
        assert res["agreement"] is True
        assert res["dfa_accepted"] is True
        assert res["regex_accepted"] is True
        assert res["error_message"] is None

    # Invalid readings
    invalid_cases = [
        ("0432.57kWh", "4 digits instead of 5"),
        ("000432.57kWh", "6 digits instead of 5"),
        ("00432,57kWh", "comma instead of dot"),
        ("00432.5kWh", "1 decimal digit"),
        ("00432.570kWh", "3 decimal digits"),
        ("00432.57kwh", "lowercase kwh"),
        ("00432.57KWH", "uppercase KWH"),
        ("00432.57", "missing unit"),
        ("00432.57 kWh", "space before unit"),
        ("00432.57kWh\n", "trailing newline"),
        ("", "empty reading"),
    ]
    for val, reason in invalid_cases:
        res = compare_reading(val)
        assert res["agreement"] is True, f"Disagreement on {reason}: {val!r}"
        assert res["dfa_accepted"] is False, f"Expected reject for {reason}: {val!r}"
        assert res["regex_accepted"] is False, f"Expected regex reject for {reason}: {val!r}"
        assert res["error_message"] is not None


def test_t04_dfa_regex_agree_10000_mutations():
    """T04: DFA and regex agree on 10,000 generated and mutated strings."""
    total, agreed, disagreements = run_random_mutation_tests(10000)
    assert total == 10000
    assert len(disagreements) == 0, f"Disagreements found: {disagreements[:5]}"
    assert agreed == 10000


def test_t05_rejection_messages():
    """T05: Rejection messages include exact position and expected symbols."""
    # Check invalid meter ID phase
    res = meter_id_dfa.simulate("GRIDB042X")
    assert res["accepted"] is False
    assert res["failure_index"] == 8
    assert "Position 8: expected phase [R, Y, B], got 'X'" in res["error_message"]

    # Check incomplete meter ID
    res_inc = meter_id_dfa.simulate("GRIDB04")
    assert res_inc["accepted"] is False
    assert res_inc["failure_index"] == 7
    assert "Position 7: string incomplete" in res_inc["error_message"]

    # Check reading dot error
    res_dot = reading_dfa.simulate("00432,57kWh")
    assert res_dot["accepted"] is False
    assert res_dot["failure_index"] == 5
    assert "Position 5: expected decimal point '.', got ','" in res_dot["error_message"]

    # Check unsupported event code
    res_ev = event_code_dfa.simulate("XX")
    assert res_ev["accepted"] is False
    assert res_ev["failure_index"] == 0
    assert "Position 0:" in res_ev["error_message"]

    # Valid event codes
    for code in ["TM", "OT", "HA", "CM", "NONE"]:
        comp = compare_event_code(code)
        assert comp["agreement"] is True
        assert comp["dfa_accepted"] is True
