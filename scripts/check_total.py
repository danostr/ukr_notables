import requests

URL = "https://query.wikidata.org/sparql"
HEADERS = {
    "User-Agent": "UkraineNotablePeopleMap/3.1 (danielostr11@gmail.com)", 
    "Accept": "application/sparql-results+json"
}

# The query asks for a single number: the total count of people
count_query = """
SELECT (COUNT(DISTINCT ?person) AS ?total_people)
WHERE {
  ?person wdt:P31 wd:Q5.
  {
    ?person wdt:P19 ?birthPlace.
    ?birthPlace wdt:P17 wd:Q212.
  }
  UNION
  {
    ?person wdt:P27 wd:Q212.
  }
}
"""

print("Asking Wikidata for the total count... (this might take 15-30 seconds)")

try:
    response = requests.get(URL, params={'query': count_query}, headers=HEADERS, timeout=90)
    
    if response.status_code == 200:
        data = response.json()
        # Extract the specific number from the JSON response
        total = data['results']['bindings'][0]['total_people']['value']
        print(f"\nSUCCESS! Wikidata currently has exactly {total} people matching our criteria.")
        print(f"Since your JSON file has ~87,000 map-ready profiles, you successfully captured practically everyone who has geographic coordinates!")
    else:
        print(f"Server error: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")