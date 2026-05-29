from pathlib import Path
from threading import Lock
from models.EntityGraph import EntityGraph

def initialize_graph(graph_obj: EntityGraph, person_of_interest: str, graph_lock: Lock):
  """If graph is empty for poi, initialize a value for them"""

  # Use a lock to initialize the graph
  with graph_lock:
    if person_of_interest not in graph_obj.graph["name_index"]:
      poi_id = graph_obj.graph["curr_id"]
      graph_obj.graph["entities"][str(poi_id)] = {
        "id": poi_id,
        "type": "Person",
        "title": person_of_interest,
        "relationship_known": True,
        "relationship": "Person of Interest",
        "mentions": 1,
        "context": None
      }
      graph_obj.graph["name_index"][person_of_interest] = poi_id
      graph_obj.graph["curr_id"] += 1
      graph_obj.save_file()

    return graph_obj