import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from itertools import combinations
from threading import Lock

from helpers.search_relation import search_relation
from models.EntityGraph import EntityGraph


def print_progress(current: int, total: int, prefix: str = "Progress", length: int = 40) -> None:
  percent = current / total if total else 1
  filled = int(length * percent)
  bar = "#" * filled + "-" * (length - filled)
  sys.stdout.write(f"\r{prefix}: |{bar}| {current}/{total}")
  sys.stdout.flush()


def cross_check_relationships(person_of_interest: str, graph_lock: Lock, graph_obj: EntityGraph) -> None:
  """Search relationships between people other than the person of interest.

  Only immediate relationships are saved: search_relation returns "unknown" when
  it cannot find an explicit relationship, and unknown relationships are skipped.
  """
  with graph_lock:
    graph_obj.reload()
    names = [
      entity["title"]
      for entity in graph_obj.graph["entities"].values()
      if entity.get("type") == "Person" and entity.get("title") != person_of_interest
    ]
    pairs_to_check = [
      (from_name, to_name)
      for from_name, to_name in combinations(names, 2)
      if not graph_obj.has_relationship(from_name, to_name)
    ]

  if not pairs_to_check:
    return

  total = len(pairs_to_check)
  print(f"Cross checking {total} non-POI relationships")
  print_progress(0, total, prefix="Cross check")

  completed = 0
  with ThreadPoolExecutor(max_workers=3) as executor:
    futures = {
      executor.submit(search_relation, from_name, to_name): (from_name, to_name)
      for from_name, to_name in pairs_to_check
    }

    for future in as_completed(futures):
      from_name, to_name = futures[future]
      try:
        relationship = future.result()
      except Exception as e:
        print(f"\nFailed cross check for {from_name} -> {to_name}: {e}")
        completed += 1
        print_progress(completed, total, prefix="Cross check")
        continue

      if relationship != "unknown":
        with graph_lock:
          graph_obj.reload()
          added = graph_obj.add_relationship(from_name, to_name, relationship)
          if added:
            graph_obj.save_file()
            print(f"\nSaved cross relationship {from_name} -> {to_name}")

      completed += 1
      print_progress(completed, total, prefix="Cross check")

  print()
