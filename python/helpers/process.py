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
from helpers.get_page_content import get_page_content
from helpers.initialize_graph import initialize_graph
from helpers.process_content import process_content

from models.EntityGraph import EntityGraph

nlp = spacy.load("en_core_web_sm") #switch to trf for smaller searches but more accurate results

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
  graph_obj = initialize_graph(graph_obj,person_of_interest,graph_lock)

  # Extract text from input pdf
  reader = PdfReader(file)
  content = ""
  for page in reader.pages:
      text = page.extract_text()
      if text:
          content += text
  # Use content to build graph
  process_content(nlp, content, graph_obj, person_of_interest, graph_lock)
  return 0

def process_html(url: str, person_of_interest: str) -> None :
  try:
    contents = get_page_content(url)
    if contents:
      person_of_interest = normalize_name(person_of_interest.strip())
      memory_path = Path("memory") / "graph.json"
      graph_obj = EntityGraph(memory_path) # Load graph
      graph_lock = Lock() # Initialize lock
      graph_obj = initialize_graph(graph_obj,person_of_interest,graph_lock)

      # Use contents to build graph
      process_content(nlp, contents, graph_obj, person_of_interest, graph_lock)
      return 0
    else:
      raise Exception(f"Could not parse contents of page")
  except Exception as e:
    print(f"Raised when processing html: {e}")

if __name__ == "__main__":
   pass