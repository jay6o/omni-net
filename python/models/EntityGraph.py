import json
from pathlib import Path
class EntityGraph:
    """
    A class used to load and edit graph information from a json file.

    Attributes
    ----------
    path: str
        The path to the json file that stores or will store our graph.
    graph:
        The python object representation of the graph that is loaded from our json file.
    """

    def __init__(self, path: Path) -> None :
        self.path = path
        with self.path.open("r", encoding="utf-8") as file:
            self.graph = json.load(file)
    
    def reload(self):
        """Update object to keep up with concurrent updates"""
        with self.path.open("r", encoding="utf-8") as file:
            self.graph = json.load(file)

    def add_person(self, name: str, connect_to: str, relation: str) -> None:
        """Add new person to the graph with relationships"""
        curr_id = self.graph["curr_id"]
        relationship_known = relation.strip().lower() != "unknown"

        if connect_to in self.graph["name_index"]:
            if name not in self.graph["name_index"]:
                # New person
                self.graph["entities"][str(curr_id)] = {
                    "id": curr_id,
                    "type": "Person",
                    "title": name,
                    "relationship_known": relationship_known,
                    "relationship": relation,
                    "mentions": 1,
                    "context": None
                }
                self.graph["name_index"][name] = curr_id
                self.graph["curr_id"] += 1
            elif not self.graph["entities"][str(self.graph["name_index"][name])]["relationship_known"]:
                # Existing person with unknown relationship — update it
                existing_id = self.graph["name_index"][name]
                self.graph["entities"][str(existing_id)]["relationship"] = relation
                self.graph["entities"][str(existing_id)]["relationship_known"] = relationship_known

            self.graph["relationships"].append({
                "from": self.graph["name_index"][name],
                "to": self.graph["name_index"][connect_to],
                "relationship": relation
            })

    def save_file(self):
        """Write self.graph object to the json file"""
        with self.path.open("w", encoding="utf-8") as file:
            json.dump(self.graph, file, indent=2)