# OMNI NET

## Use web crawling, NLP, and LLM to build a visual graph of all relationships between entities in a social network using open source information.

## Usage
Currently supported inputs:
| Type             |
| ---------------- |
| .pdf             |

- Edit env.py.template to store your inputs, then rename it to env.py
- Run:  
```sh 
    python3 main.py
```

The program will run with logs and update the graph in `memory/graph.json`

## How it works

1. Input source containing references to other entities, along with our entity of interest
2. Program processes language from the input to identify entities using spaCy NLP
3. Take each identified entity and run a relationship search using the crawling bot (ddgs, httpx, & bs4)
4. Using crawling results, pass them to Ollama to give relationships a title
5. Store the relationships in memory as a graph

# Notes
It is my intention to add functionality for complete relationship graphs, meaning instead of only one root that all entities must connect to, we have each entity connecting (or not connecting) to each other.

I would also like to automate the process, where instead of needing to input for each run, the program runs non-deterministically, acting on its own through recursive calls.
