# OMNI NET

## Use web crawling, NLP, and LLM to build a visual graph of all relationships between entities in a social network using open source information.

<img width="1440" height="780" alt="Screenshot 2026-06-08 at 2 38 38 PM" src="https://github.com/user-attachments/assets/5e94e7a1-c409-4eec-a1f8-a18f5ec15cf8" />


## Usage
Currently supported inputs:
| Type             |
| ---------------- |
| .pdf             |
| url              |
| text (string)    |

- From `python` install all requirements by running `pip3 install -r requirements.txt`
- Edit `python/env.py.template` to store your inputs, then rename it to `env.py`
- From the root folder, run by running:  
```sh 
    sh run.sh
```

The program will run with logs and update the graph in `python/memory/graph.json`

You can then use import this graph.json into the web app to visualize the relationships.

## Graph visualizer

The visualizer is now a standalone static web app. It does not need the Python crawler to run; open it and use the upload button to import any graph JSON with this shape:

```json
{
  "entities": {},
  "relationships": []
}
```

To run it locally, serve the `visualizer` folder:

```sh
cd visualizer
python3 -m http.server 5174
```

Then visit `http://127.0.0.1:5174/`.

You can also use the web app at `https://omni-net-flame.vercel.app/` and import your graph file.
## How it works

1. Input source containing references to other entities, along with our entity of interest
2. Program processes language from the input to identify entities using spaCy NLP
3. Take each identified entity and run a relationship search using the crawling bot (cURL & BeautifulSoup)
4. Using crawling results, pass them to Ollama to give relationships a title
5. Store the relationships in memory as a graph

# Notes
It is my intention to add functionality for complete relationship graphs, meaning instead of only one root that all entities must connect to, we have each entity connecting (or not connecting) to each other.

I would also like to automate the process, where instead of needing to input for each run, the program runs non-deterministically, acting on its own through recursive calls.
