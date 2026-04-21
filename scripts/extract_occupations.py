import json
from collections import Counter
import os

# This finds the directory where the script itself is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# This goes up one level to the project root, then into the data folder
file_path = os.path.join(script_dir, '..', 'data', 'final_map_data.json')
output_path = os.path.join(script_dir, '..', 'data', 'occupations_list.txt')

print(f"Targeting data at: {os.path.abspath(file_path)}")

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        people = json.load(f)
except FileNotFoundError:
    print(f"Error: Could not find final_map_data.json at {file_path}")
    exit()

all_occupations = []
for person in people:
    all_occupations.extend(person.get('occupations', []))

occupation_counts = Counter(all_occupations)
sorted_occupations = occupation_counts.most_common()

with open(output_path, 'w', encoding='utf-8') as f:
    f.write("OCCUPATIONS IN UKRAINE DATASET (Sorted by frequency)\n")
    f.write("="*55 + "\n")
    for occ, count in sorted_occupations:
        f.write(f"{occ}: {count}\n")

print(f"\nSuccess! Found {len(occupation_counts)} unique occupations.")
print("Top 10 most common:")
for occ, count in sorted_occupations[:10]:
    print(f" - {occ} ({count} people)")
    
print(f"\nResults saved to: {output_path}")