import ollama

def ollama_query(entity: str, poi: str, context: str) -> str:
    q = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a relationship extractor. Reply with a maximum of 35 words describing the relationship. No explanation. No sentences. If unknown, reply with exactly "unknown".<|eot_id|>
<|start_header_id|>user<|end_header_id|>
Text: {context}
What is {entity}'s relationship to {poi}? Reply in 6 words or less, or "unknown".<|eot_id|>
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