from helpers.search_relation import search_relation

from models.EntityGraph import EntityGraph

from threading import Lock

def process_name(name: str, person_of_interest: str, graph_lock: Lock, graph_obj: EntityGraph):
  """Individual process of name that finds a relationship and overwrites it to the graph file

  Returns:
    None: Overwrites the graph file, returns nothing.
  """
  print(f"Searching {name}")
  relationship = search_relation(name, person_of_interest)
  with graph_lock:
    graph_obj.reload()
    if relationship == "unknown":
      return
    graph_obj.add_person(name, person_of_interest, relationship)
    graph_obj.save_file()