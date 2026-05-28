import re

TITLES = {"mr", "mrs", "ms", "dr", "prof", "sir", "rev", "gen", "sgt", "det"}
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "esq"}

def normalize_name(name: str) -> str:
    # lowercase and strip
    name = name.lower().strip()
    
    # remove punctuation except hyphens
    name = re.sub(r"[^\w\s\-]", "", name)
    
    # split and filter out titles and suffixes
    tokens = [
        t for t in name.split()
        if t not in TITLES and t not in SUFFIXES
    ]
    
    # rejoin and title case
    return " ".join(tokens).title()