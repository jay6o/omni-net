from helpers.process import process_pdf
from helpers.search_relation import search_relation
from env import FILE, POI

def main() -> int :
    process_pdf(FILE, POI)


if __name__ == "__main__":
    main()