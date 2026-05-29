import ollama

def ollama_query(entity: str, eoi: str, context: str) -> str:
    """Ask ollama to deduce the relationship between 2 entities using the context given.
    
    Args:
        entity (str): The entity we are searching for (child node).
        eoi (str): Parent node of a possible relationship.
        context (str): Context ollama will use to infer a relationship.
    
    Returns:
        str: A brief title/description of the relationship, or "unknown" if ollama could not guess.
    """

    q = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>
        You are a relationship extractor. Reply with a maximum of 35 words describing the relationship. If you can find first and last name, include them in your response. You must find an explicit description of their relationship within a sentence. No explanation. No sentences. If unknown, reply with exactly "unknown".<|eot_id|>
        <|start_header_id|>user<|end_header_id|>
        Text: {context}
        What is {entity}'s relationship to {eoi}? Reply in 35 words or less, or "unknown".<|eot_id|>
        <|start_header_id|>assistant<|end_header_id|>
    """
    response = ollama.generate(
        model="llama3.2:latest",
        prompt=q,
        options={"temperature": 0.1}
    )["response"].strip()

    words = response.split()
    if len(words) > 40 or "unknown" in response.lower() or "no mention" in response.lower():
        return "unknown"
    return " ".join(words)