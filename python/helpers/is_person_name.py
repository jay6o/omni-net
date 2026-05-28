def is_person_name(name: str) -> bool:
    parts = name.split()
    # reject if too many words (businesses tend to be long)
    if len(parts) > 4:
        return False
    # reject if any part is all digits or looks like a code
    if any(p.isdigit() or (p[0].isdigit()) for p in parts):
        return False
    return True