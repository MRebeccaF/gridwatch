"""Generic Deterministic Finite Automaton (DFA) Simulator.

Provides data-driven DFA simulation with state transition tracing, explicit dead
state tracking, and informative rejection messages (including exact failure index
and expected symbol sets).
"""

from typing import Any, Callable, Dict, List, Optional, Set, Tuple


class DFA:
    """Represents a Deterministic Finite Automaton with explicit dead state."""

    def __init__(
        self,
        name: str,
        states: List[str],
        start_state: str,
        accept_states: Set[str],
        dead_state: str,
        alphabet_description: str,
        transition_rules: List[Dict[str, Any]],
        description: str = "",
    ):
        """
        transition_rules: list of rules, evaluated in order.
        Each rule has:
          - 'from_state': state name
          - 'symbol_matcher': predicate func (char) -> bool or set of chars or exact char
          - 'label': human-readable description for UI / error reporting
          - 'to_state': destination state
        """
        self.name = name
        self.states = states
        self.start_state = start_state
        self.accept_states = set(accept_states)
        self.dead_state = dead_state
        self.alphabet_description = alphabet_description
        self.transition_rules = transition_rules
        self.description = description

    def step(self, current_state: str, symbol: str) -> Tuple[str, str]:
        """Given current state and symbol, returns (next_state, rule_label).

        If no transition matches, returns (dead_state, 'invalid').
        """
        if current_state == self.dead_state:
            return self.dead_state, "dead"

        for rule in self.transition_rules:
            if rule["from_state"] != current_state:
                continue
            matcher = rule["symbol_matcher"]
            matched = False
            if callable(matcher):
                matched = matcher(symbol)
            elif isinstance(matcher, (set, list, tuple)):
                matched = symbol in matcher
            elif isinstance(matcher, str):
                matched = symbol == matcher

            if matched:
                return rule["to_state"], rule.get("label", symbol)

        return self.dead_state, "invalid"

    def get_expected_symbols_for_state(self, state: str) -> List[str]:
        """Returns the list of expected symbol labels for transitions out of state."""
        if state == self.dead_state:
            return []
        expected = []
        for rule in self.transition_rules:
            if rule["from_state"] == state:
                expected.append(rule.get("label", "valid symbol"))
        return expected

    def simulate(self, text: str) -> Dict[str, Any]:
        """Simulates the DFA on the input string text.

        Returns a dictionary:
        {
            "accepted": bool,
            "current_state": str,
            "trace": [
                {"step": 0, "from_state": "q0", "symbol": "G", "to_state": "q1", "label": "G"}
            ],
            "failure_index": Optional[int],
            "failure_char": Optional[str],
            "expected_symbols": List[str],
            "error_message": Optional[str]
        }
        """
        current_state = self.start_state
        trace: List[Dict[str, Any]] = []
        failure_index: Optional[int] = None
        failure_char: Optional[str] = None
        expected_symbols: List[str] = []
        error_message: Optional[str] = None

        for idx, char in enumerate(text):
            expected_for_current = self.get_expected_symbols_for_state(current_state)
            next_state, label = self.step(current_state, char)
            trace.append({
                "step": idx,
                "from_state": current_state,
                "symbol": char,
                "to_state": next_state,
                "label": label
            })
            if next_state == self.dead_state:
                failure_index = idx
                failure_char = char
                expected_symbols = expected_for_current
                expected_desc = " or ".join(expected_symbols) if expected_symbols else "nothing (end of string)"
                char_display = repr(char) if char in ("\n", "\r", "\t") else f"'{char}'"
                error_message = f"Position {idx}: expected {expected_desc}, got {char_display}"
                current_state = next_state
                # Process remaining characters into DEAD state for full trace
                for rem_idx, rem_char in enumerate(text[idx + 1:], start=idx + 1):
                    trace.append({
                        "step": rem_idx,
                        "from_state": self.dead_state,
                        "symbol": rem_char,
                        "to_state": self.dead_state,
                        "label": "dead"
                    })
                break
            current_state = next_state

        accepted = (current_state in self.accept_states)

        if not accepted and failure_index is None:
            # String ended prematurely before reaching accept state
            failure_index = len(text)
            failure_char = "EOF"
            expected_symbols = self.get_expected_symbols_for_state(current_state)
            expected_desc = " or ".join(expected_symbols) if expected_symbols else "valid continuation"
            error_message = f"Position {failure_index}: string incomplete, expected {expected_desc}"

        return {
            "accepted": accepted,
            "final_state": current_state,
            "trace": trace,
            "failure_index": failure_index,
            "failure_char": failure_char,
            "expected_symbols": expected_symbols,
            "error_message": error_message
        }

    def to_dict(self) -> Dict[str, Any]:
        """Serializes the DFA structure for visualization on frontend."""
        rules_serializable = []
        for r in self.transition_rules:
            rules_serializable.append({
                "from_state": r["from_state"],
                "label": r.get("label", ""),
                "to_state": r["to_state"]
            })
        return {
            "name": self.name,
            "states": self.states,
            "start_state": self.start_state,
            "accept_states": list(self.accept_states),
            "dead_state": self.dead_state,
            "alphabet_description": self.alphabet_description,
            "description": self.description,
            "transitions": rules_serializable
        }
