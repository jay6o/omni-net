import json
from pathlib import Path
#import cProfile

from helpers.process import process_pdf, process_html
from helpers.search_relation import search_relation
from env import INPUT, POI

def main() -> int :
    """Driver method"""

    # Only runs if the file doesnt exist
    file_path = Path("memory/graph.json")
    if not file_path.is_file():
         create_graph_json(file_path)
    create_graph_json()
    process_html(INPUT, POI)

def create_graph_json(file_path: Path):
        with file_path.open(mode="w", encoding="utf-8") as file:
            data = {
                    "entities": {
                    },
                    "relationships": [],
                    "curr_id": 0,
                    "name_index": {
                    } 
                }
            json.dump(data, file, indent=2)

if __name__ == "__main__":
    main()