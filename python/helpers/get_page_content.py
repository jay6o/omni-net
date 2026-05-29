import subprocess
import json
from bs4 import BeautifulSoup
from helpers.ollama_query import ollama_query

def get_page_content(url: str):
    """Extract contents from a given page as a url.
    
    Args:
        url (str): the url.
    
    Returns:
        str: If the page was able to have been fetched.
        None: If we couldn't get the page.
    """
    try:
        resp = subprocess.run(
            [
                "curl", "-L",
                "-s",
                "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                "--max-time", "5",     # hard timeout
                "--compressed",        # handle gzip
                url
            ],
            capture_output=True,
            text=True,
            timeout=8
        )
        
        if resp.returncode != 0:
            print(f"    [fetch failed] {url}: curl exit {resp.returncode}")
            return None

        soup = BeautifulSoup(resp.stdout, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        return soup.get_text(separator=" ", strip=True)
    except subprocess.TimeoutExpired:
        print(f"    [timeout] {url}")
        return None
    except Exception as e:
        print(f"    [fetch failed] {url}: {e}")
        return None
    
if __name__ == "__main__":
    pass