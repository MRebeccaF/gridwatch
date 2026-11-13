"""Explicit Routing Table and Station Metadata helpers."""

from typing import Any, Dict, List, Optional
from .graph import NetworkGraph

# Default 5 Grid Sections (keyed by letter A to E)
DEFAULT_ZONES = [
    {
        "key": "A",
        "station_code": "BSK",
        "name": "Banashankari",
        "depot": "BSK Depot",
        "authority": "Executive Engineer, BSK",
        "capacity": 6,
        "map_x": 140,
        "map_y": 280,
    },
    {
        "key": "B",
        "station_code": "JP",
        "name": "JP Nagar",
        "depot": "JP Depot",
        "authority": "Executive Engineer, JP",
        "capacity": 6,
        "map_x": 220,
        "map_y": 420,
    },
    {
        "key": "C",
        "station_code": "HSR",
        "name": "HSR Layout",
        "depot": "HSR Depot",
        "authority": "Executive Engineer, HSR",
        "capacity": 6,
        "map_x": 380,
        "map_y": 360,
    },
    {
        "key": "D",
        "station_code": "KOR",
        "name": "Koramangala",
        "depot": "KOR Depot",
        "authority": "Executive Engineer, KOR",
        "capacity": 6,
        "map_x": 320,
        "map_y": 180,
    },
    {
        "key": "E",
        "station_code": "WFD",
        "name": "Whitefield",
        "depot": "WFD Depot",
        "authority": "Executive Engineer, WFD",
        "capacity": 6,
        "map_x": 540,
        "map_y": 140,
    },
]

# Default Undirected Weighted Edges (travel time in minutes)
DEFAULT_EDGES = [
    {"from_station": "BSK", "to_station": "JP", "weight": 10},
    {"from_station": "JP", "to_station": "HSR", "weight": 20},
    {"from_station": "HSR", "to_station": "KOR", "weight": 10},
    {"from_station": "BSK", "to_station": "KOR", "weight": 25},
    {"from_station": "KOR", "to_station": "WFD", "weight": 35},
    {"from_station": "HSR", "to_station": "WFD", "weight": 40},
]


def build_routing_model(zones: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> NetworkGraph:
    """Builds a NetworkGraph instance from the given zones and edges."""
    return NetworkGraph(zones, edges)
