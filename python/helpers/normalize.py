import re

TITLES = {"mr", "mrs", "ms", "dr", "prof", "sir", "rev", "gen", "sgt", "det"}
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "esq"}

def normalize_name(name: str) -> str:
    """Format name in a standardized, reproducible way.
    Examples:
        >>> normalize_name("JOHN DOE")
            "John Doe"
        >>> normalize_name("DR. ALBERT EINSTEIN III")
            "Albert Einstein"
    
    Args:
        name (str): The name to normalize.
    
    Returns:
        str: The normalized name.
    """

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