import json
from collections import Counter

print("Reading notable_people.json...")

# 1. Load your massive dataset
with open('_notable_people.json', 'r', encoding='utf-8') as f:
    people = json.load(f)

# 2. Extract every occupation into a massive list
all_occupations = []
for person in people:
    all_occupations.extend(person['occupations'])

# 3. Count how many people have each occupation
occupation_counts = Counter(all_occupations)

# 4. Sort them from most common (e.g., 'politician') to least common
sorted_occupations = occupation_counts.most_common()

# 5. Save it to a readable text file
output_file = 'occupations_list.txt'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write("OCCUPATIONS IN UKRAINE DATASET (Sorted by frequency)\n")
    f.write("="*55 + "\n")
    for occ, count in sorted_occupations:
        f.write(f"{occ}: {count}\n")

print(f"\nSuccess! Found {len(occupation_counts)} unique occupations.")
print("Here are the top 10 most common:")
for occ, count in sorted_occupations[:10]:
    print(f" - {occ} ({count} people)")
    
print(f"\nOpen '{output_file}' to see the full list!")