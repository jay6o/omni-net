import sys
import spacy
from pathlib import Path
from pypdf import PdfReader
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

from helpers.normalize import normalize_name
from helpers.search_relation import search_relation
from helpers.names_alike import name_score
from helpers.is_person_name import is_person_name

from models.EntityGraph import EntityGraph

nlp = spacy.load("en_core_web_trf")

def process_pdf(file: str, person_of_interest: str) -> int :

  """ Process entities from a document as text and adds them to the in-memory graph
  
  Args:
    file (str): string of path to file.
    person_of_interest (str): person we are trying to find.

  Returns:
    int: exit code.
  """
  person_of_interest = normalize_name(person_of_interest.strip())
  memory_path = Path("memory") / "graph.json"
  graph_obj = EntityGraph(memory_path) # Load graph
  graph_lock = Lock() # Initialize lock

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

  # Extract text from input pdf
  reader = PdfReader(file)
  content = ""
  for page in reader.pages:
      text = page.extract_text()
      if text:
          content += text

  # Process language
  doc = nlp(content)

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

  def process_name(name):
    """Individual process of name that finds a relationship and overwrites it to the graph file

    Args:
      name (str): Name to process.
    
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

  # ThreadPool for all names in our list of names to process
  with ThreadPoolExecutor(max_workers=3) as executor:
    futures = {
      executor.submit(process_name, name): name 
      for name in names_to_submit
    }
    for future in as_completed(futures):
      name = futures[future]
      try:
        future.result()
        print(f"Saved {name}")
      except Exception as e:
        print(f"Failed on {name}: {e}")
  return 0


if __name__ == "__main__":
   pass