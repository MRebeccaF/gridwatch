"""Graph representation and Dijkstra All-Pairs Shortest Path algorithm (BCS502).

Handles undirected weighted network topologies, deterministic tie-breaking:
1. Lowest total cost
2. Fewer hops
3. Lexicographical / alphabetical station code
Detects and warns on graph disconnection.
"""

import heapq
from typing import Any, Dict, List, Optional, Set, Tuple


class NetworkGraph:
    """Represents the smart meter grid topology graph."""

    def __init__(self, stations: List[Dict[str, Any]], edges: List[Dict[str, Any]]):
        """stations: list of dicts with 'key', 'station_code', 'name', etc.

        edges: list of dicts with 'from_station', 'to_station', 'weight'
        """
        self.stations = {s["station_code"]: s for s in stations}
        self.station_keys = {s["key"]: s["station_code"] for s in stations}
        self.key_by_station = {s["station_code"]: s["key"] for s in stations}

        # Adjacency list: station_code -> dict(neighbor_code -> weight)
        self.adj: Dict[str, Dict[str, int]] = {s["station_code"]: {} for s in stations}
        for e in edges:
            u, v, w = e["from_station"], e["to_station"], int(e["weight"])
            if u in self.adj and v in self.adj:
                self.adj[u][v] = w
                self.adj[v][u] = w

    def get_neighbors(self, station: str) -> List[Tuple[str, int]]:
        return sorted(self.adj.get(station, {}).items(), key=lambda x: (x[1], x[0]))

    def dijkstra_single_source(self, start: str) -> Tuple[Dict[str, int], Dict[str, List[str]]]:
        """Computes shortest path from start to all reachable stations with

        deterministic tie-breaking: (cost, hop_count, path_tuple).
        """
        # Distance map
        dist: Dict[str, int] = {s: float("inf") for s in self.stations}
        paths: Dict[str, List[str]] = {s: [] for s in self.stations}

        dist[start] = 0
        paths[start] = [start]

        # Priority queue holds: (cost, hop_count, path_list)
        pq = [(0, 1, [start])]

        while pq:
            d, hops, path = heapq.heappop(pq)
            u = path[-1]

            if d > dist[u]:
                continue

            for v, weight in sorted(self.adj.get(u, {}).items()):
                new_d = d + weight
                new_hops = hops + 1
                new_path = path + [v]

                # Compare: lower cost, then fewer hops, then alphabetical path
                is_better = False
                if new_d < dist[v]:
                    is_better = True
                elif new_d == dist[v]:
                    if new_hops < len(paths[v]):
                        is_better = True
                    elif new_hops == len(paths[v]) and new_path < paths[v]:
                        is_better = True

                if is_better:
                    dist[v] = new_d
                    paths[v] = new_path
                    heapq.heappush(pq, (new_d, new_hops, new_path))

        return dist, paths

    def compute_all_pairs_routing_table(self) -> Dict[str, Any]:
        """Computes complete routing table and shortest paths between all pairs of

        stations.
        """
        routing_table: Dict[str, Dict[str, Any]] = {}
        is_connected = True
        station_list = sorted(self.stations.keys())

        for src in station_list:
            routing_table[src] = {}
            dist, paths = self.dijkstra_single_source(src)
            for dst in station_list:
                if src == dst:
                    routing_table[src][dst] = {
                        "cost": 0,
                        "hops": 0,
                        "path": [src],
                        "next_hop": src,
                        "reachable": True
                    }
                elif dist[dst] < float("inf"):
                    path = paths[dst]
                    next_hop = path[1] if len(path) > 1 else dst
                    routing_table[src][dst] = {
                        "cost": dist[dst],
                        "hops": len(path) - 1,
                        "path": path,
                        "next_hop": next_hop,
                        "reachable": True
                    }
                else:
                    is_connected = False
                    routing_table[src][dst] = {
                        "cost": None,
                        "hops": None,
                        "path": [],
                        "next_hop": None,
                        "reachable": False
                    }

        return {
            "routing_table": routing_table,
            "is_connected": is_connected,
            "warning": None if is_connected else "Network graph is disconnected! Some stations cannot reach each other."
        }
