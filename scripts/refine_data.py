import json

# 1. Load the raw data
print("Loading notable_people.json...")
with open('notable_people.json', 'r', encoding='utf-8') as f:
    people = json.load(f)

# Buckets for our different quality levels
high_quality = []   # Has at least one Wikipedia link
medium_quality = [] # No Wikipedia, but HAS an occupation
low_quality = []    # No Wikipedia AND no occupation (The "junk" entries)

for person in people:
    has_wiki = bool(person.get('enWiki') or person.get('ukWiki') or person.get('ruWiki'))
    has_occ = bool(person.get('occupations') and len(person['occupations']) > 0)

    if has_wiki:
        high_quality.append(person)
    elif has_occ:
        medium_quality.append(person)
    else:
        low_quality.append(person)

# 2. Save the files
print(f"\n--- Cleaning Results ---")
print(f"High Quality (With Wiki): {len(high_quality)} people")
print(f"Medium Quality (Only Occupation): {len(medium_quality)} people")
print(f"Low Quality (Nothing): {len(low_quality)} people")

with open('people_with_wiki.json', 'w', encoding='utf-8') as f:
    json.dump(high_quality, f, ensure_ascii=False, indent=4)

with open('people_only_occupations.json', 'w', encoding='utf-8') as f:
    json.dump(medium_quality, f, ensure_ascii=False, indent=4)

with open('people_junk.json', 'w', encoding='utf-8') as f:
    json.dump(low_quality, f, ensure_ascii=False, indent=4)

print("\nSuccess! Files created. Use 'people_with_wiki.json' for your main map.")