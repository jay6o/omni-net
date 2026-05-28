import httpx
import json
from bs4 import BeautifulSoup
from helpers.ollama_query import ollama_query

def get_page_content(url: str):
    try:
        resp = httpx.get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
                },
            timeout=5,
            follow_redirects=True
        )
        # Return None on fail fetch
        if resp.status_code < 200 or resp.status_code >= 400:
            raise Exception(f"status {resp.status_code}")

        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        text = soup.get_text(separator=" ", strip=True)
        return text
    except Exception as e:
        print(f"    [fetch failed] {url}: {e}")
        return None
    
if __name__ == "__main__":
    pass