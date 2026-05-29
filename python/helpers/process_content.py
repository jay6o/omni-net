from helpers.normalize import normalize_name
from helpers.is_person_name import is_person_name
from helpers.names_alike import name_score
from helpers.process_name import process_name

from models.EntityGraph import EntityGraph

from threading import Lock
from concurrent.futures import ThreadPoolExecutor, as_completed

def process_content(nlp, content: str, graph_obj: EntityGraph, person_of_interest: str, graph_lock: Lock):
  """Takes content as a string and processes it using spaCy nlp
        Processed entities are saved to the graph connected to POI using a thread lock to prevent race conditions.

    Args:
        nlp: spaCy Language.
        content: content.
        graph_obj: python object storing graph.
        person_of_interest: person of interest.
        graph_lock: threading lock.

    Returns:
        None: only updates graph.
    """

  # Process language using spacy
  doc = nlp(content[:50000])

  # Use a set to prevent executing duplicate threads
  names_to_submit = set()


  for ent in doc.ents:
    if ent.label_ == "PERSON":
      # Find a name match in our graph or use new name
      name = normalize_name(ent.text)
      if name in names_to_submit or not is_person_name(name):
        continue

      if name in graph_obj.graph["name_index"]: # Exact match
        existing_id = graph_obj.graph["name_index"][name]
        if graph_obj.graph["entities"][str(existing_id)].get("relationship_known", True):
          continue  # already known, skip
        match = name  # known but relationship unknown, search again
      else:
        closest_match = 0
        matching_name = None
        for n in graph_obj.graph["name_index"]:  # Find matching name over 80% confidence or add new name
          curr_score = name_score(name, n)
          if curr_score > closest_match:
            matching_name = n
            closest_match = curr_score
        match = matching_name if closest_match >= 0.8 else name

      names_to_submit.add(match)
      print(f"Found {len(names_to_submit)} new entities to process")

  # ThreadPool for all names in our list of names to process
  with ThreadPoolExecutor(max_workers=3) as executor:
    futures = {
      executor.submit(process_name, name, person_of_interest, graph_lock, graph_obj): name 
      for name in names_to_submit
    }
    for future in as_completed(futures):
      name = futures[future]
      try:
        future.result()
        print(f"Saved {name}")
      except Exception as e:
        print(f"Failed on {name}: {e}")

