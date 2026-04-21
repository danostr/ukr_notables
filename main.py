import requests
import json
import time

URL = "https://query.wikidata.org/sparql"
HEADERS = {
    "User-Agent": "UkraineNotablePeopleMap/3.0 (danielostr11@gmail.com)", 
    "Accept": "application/sparql-results+json"
}

print("--- STARTING WIKIDATA EXPANDED EXTRACTION ---")

# ==========================================
# STEP 1: GET ALL IDs (Birthplace OR Citizenship)
# ==========================================
print("\nStep 1: Fetching all Person IDs (Born in Ukraine OR Ukrainian citizenship)...")

# NEW: The UNION block expands our search criteria
query_ids = """
SELECT DISTINCT ?person WHERE {
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

response = requests.get(URL, params={'query': query_ids}, headers=HEADERS)
if response.status_code != 200:
    print(f"Failed to get IDs. Error {response.status_code}")
    exit()

data_ids = response.json()
all_person_ids = [row['person']['value'].replace("http://www.wikidata.org/entity/", "wd:") for row in data_ids['results']['bindings']]

print(f"-> Success! Found {len(all_person_ids)} total people fitting the criteria.")

# ==========================================
# STEP 2: FETCH DETAILS IN CHUNKS
# ==========================================
print("\nStep 2: Fetching details and Wikipedia links (EN, UK, RU) in chunks of 200...")

CHUNK_SIZE = 200
all_raw_results = []
step2_start_time = time.time()
batch_count = 0

for i in range(0, len(all_person_ids), CHUNK_SIZE):
    chunk_start_time = time.time()
    batch_count += 1
    
    chunk = all_person_ids[i:i + CHUNK_SIZE]
    values_string = " ".join(chunk)
    
    # NEW: Fetching EN, UK, and RU wiki links, and safely linking coords to birthplace
    query_details = f"""
    SELECT ?person ?personLabel ?birthPlaceLabel ?coords ?occupationLabel ?enWiki ?ukWiki ?ruWiki
    WHERE {{
      VALUES ?person {{ {values_string} }}
      
      OPTIONAL {{ 
        ?person wdt:P19 ?birthPlace. 
        ?birthPlace wdt:P625 ?coords. 
      }}
      OPTIONAL {{ ?person wdt:P106 ?occupation. }}
      
      OPTIONAL {{
        ?enWiki schema:about ?person ;
                schema:inLanguage "en" ;
                schema:isPartOf <https://en.wikipedia.org/> .
      }}
      OPTIONAL {{
        ?ukWiki schema:about ?person ;
                schema:inLanguage "uk" ;
                schema:isPartOf <https://uk.wikipedia.org/> .
      }}
      OPTIONAL {{
        ?ruWiki schema:about ?person ;
                schema:inLanguage "ru" ;
                schema:isPartOf <https://ru.wikipedia.org/> .
      }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,uk,ru". }}
    }}
    """
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            res = requests.get(URL, params={'query': query_details}, headers=HEADERS, timeout=60)
            
            if res.status_code == 200:
                batch_results = res.json()['results']['bindings']
                all_raw_results.extend(batch_results)
                
                chunk_duration = time.time() - chunk_start_time
                print(f"-> Grabbed details for IDs {i} to {i + len(chunk)} in {chunk_duration:.2f}s...")
                
                time.sleep(1) 
                break 
                
            else:
                print(f"-> Error {res.status_code} on chunk {i}. Retrying {attempt + 1}/{max_retries} in 5 seconds...")
                time.sleep(5)
                
        except Exception as e:
            print(f"-> Network error on chunk {i}. Retrying {attempt + 1}/{max_retries} in 5 seconds...")
            time.sleep(5)
            
    else:
        chunk_duration = time.time() - chunk_start_time
        print(f"-> PERMANENTLY SKIPPED chunk {i} after {max_retries} failed attempts (took {chunk_duration:.2f}s).")

    if batch_count % 10 == 0:
        total_elapsed = time.time() - step2_start_time
        print(f"\n   [PROGRESS UPDATE] Processed {batch_count} batches. Total time elapsed in Step 2: {total_elapsed:.2f} seconds.\n")

# ==========================================
# STEP 3: CLEAN, FILTER, & SAVE
# ==========================================
print(f"\nStep 3: Filtering and deduplicating {len(all_raw_results)} downloaded rows...")
clean_data = {}
skipped_no_coords = 0

for row in all_raw_results:
    person_id = row['person']['value']
    
    # NEW: The Coordinate Filter. If they have no coordinates, throw them away immediately.
    coords = row.get('coords', {}).get('value')
    if not coords:
        skipped_no_coords += 1
        continue
    
    if person_id not in clean_data:
        clean_data[person_id] = {
            "id": person_id,
            "name": row.get('personLabel', {}).get('value', 'Unknown'),
            "birthplace": row.get('birthPlaceLabel', {}).get('value', 'Unknown'),
            "coords": coords,
            "enWiki": row.get('enWiki', {}).get('value', None),
            "ukWiki": row.get('ukWiki', {}).get('value', None),
            "ruWiki": row.get('ruWiki', {}).get('value', None),
            "occupations": set() 
        }
    
    if 'occupationLabel' in row:
        clean_data[person_id]["occupations"].add(row['occupationLabel']['value'])
        
final_list = []
for person in clean_data.values():
    person["occupations"] = list(person["occupations"])
    final_list.append(person)

print(f"-> Dropped {skipped_no_coords} rows due to missing geographic coordinates.")
print(f"\nStep 4: Saving {len(final_list)} complete, map-ready profiles to disk...")

with open('notable_people.json', 'w', encoding='utf-8') as f:
    json.dump(final_list, f, ensure_ascii=False, indent=4)
    
print("--- EXTRACTION COMPLETE! ---")