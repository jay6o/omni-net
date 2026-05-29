from difflib import SequenceMatcher

def name_score(a:str,b:str):
    """ Give a score for 2 names alikeness.
        Used to match 2 entities to each other,
        or find an existing entity in our memory 
        
    Args:
        a (str): First name.
        b (str): Second name.

    Returns:
        float: The confidence score of 2 names being alike in the range [0.0,1.0]
    """

    if a == b:
        return 1.0
    a_parts, b_parts = a.split(), b.split()
    if not a_parts or not b_parts:
        return 0.0

    # hard last name filter when both have multiple parts
    if len(a_parts) > 1 and len(b_parts) > 1:
        if SequenceMatcher(None, a_parts[-1], b_parts[-1]).ratio() < 0.8:
            return 0.0
        # compare first names only, ignoring middle names
        return SequenceMatcher(None, a_parts[0], b_parts[0]).ratio()

    # one is a single name — check against all parts of the other
    single = a if len(a_parts) == 1 else b
    other_parts = b_parts if len(a_parts) == 1 else a_parts
    return max(
        SequenceMatcher(None, single, part).ratio()
        for part in other_parts
    )