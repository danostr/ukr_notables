import json
import re
import os

def is_valid_name(name):
    # Filters out Wikidata IDs (Q123...) or names that are just numbers
    if re.match(r'^Q\d+$', name): return False
    if name.isdigit(): return False
    if len(name) < 2: return False
    return True

# Ensure the data directory exists
data_dir = 'data'
input_file = os.path.join(data_dir, 'people_with_wiki.json')
output_file = os.path.join(data_dir, 'final_map_data.json')

print(f"Starting Deep Clean of {input_file}...")

try:
    with open(input_file, 'r', encoding='utf-8') as f:
        people = json.load(f)
except FileNotFoundError:
    print(f"Error: {input_file} not found. Did you run refine_data.py first?")
    exit()

final_clean = []
removed_stats = {"bad_name": 0, "no_valid_links": 0}

for person in people:
    # 1. Clean Names
    if not is_valid_name(person.get('name', '')):
        removed_stats["bad_name"] += 1
        continue

    # 2. Filter useless occupation tags
    # Since person['occupations'] is a list, we clean it up
    useless_tags = {"human", "person", "being", "male", "female"}
    if 'occupations' in person:
        person['occupations'] = [o for o in person['occupations'] if o.lower() not in useless_tags]

    # 3. Check for valid links (using your flat keys: enWiki, ukWiki, ruWiki)
    # We check if at least one exists and starts with http
    has_valid_link = False
    for key in ['enWiki', 'ukWiki', 'ruWiki']:
        link = person.get(key)
        if link and isinstance(link, str) and link.startswith('http'):
            has_valid_link = True
        else:
            # Clean up non-links (like None or empty strings)
            person[key] = None

    if not has_valid_link:
        removed_stats["no_valid_links"] += 1
        continue

    final_clean.append(person)

# Save the Gold Standard
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(final_clean, f, ensure_ascii=False, indent=4)

print(f"\n--- Deep Clean Results ---")
print(f"Total entries processed: {len(people)}")
print(f"Removed (Bad Names): {removed_stats['bad_name']}")
print(f"Removed (Broken Links): {removed_stats['no_valid_links']}")
print(f"Final Gold Standard count: {len(final_clean)}")
print(f"File saved to: {output_file}")