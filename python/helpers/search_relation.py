import json
from ddgs import DDGS
from google import genai
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from helpers.get_page_content import get_page_content
from helpers.ollama_query import ollama_query

def search_relation(entity: str, poi: str) -> str :
    """ Use a duck duck go search to browse results to find relationship using a crawler and LLM """
    query = f"What is {entity}'s relationship with {poi}"

    with DDGS() as ddg:
        results = list(ddg.text(query, max_results=5))

    context = ""
    with ThreadPoolExecutor(max_workers=5) as executor:
     futures = {executor.submit(get_page_content, r.get("href")): r for r in results if r.get("href")}
     for future, r in futures.items():
         snippet = r.get("body", "")
         try:
             page_content = future.result(timeout=5)
             context += f"{page_content}\n\n" if page_content else f"{snippet}\n\n"
         except TimeoutError:
             print(f"    [timeout] {r.get('href')}")
             context += f"{snippet}\n\n"
         except Exception as e:
             print(f"    [failed] {r.get('href')}: {e}")
             context += f"{snippet}\n\n" 

    return ollama_query(entity, poi, context)

if __name__ == "__main__":
    pass