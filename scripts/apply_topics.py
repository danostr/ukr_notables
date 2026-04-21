import json
import os

# Your current keyword map (we will update this later with the classifier)
TOPIC_MAP = {
    "Politics & Society": ["politician", "activist", "diplomat", "official", "governor", "lawyer", "judge", "revolutionary", "statesman"],
    "Arts & Culture": ["writer", "painter", "poet", "musician", "composer", "actor", "artist", "sculptor", "architect", "film", "singer", "journalist"],
    "Science & Education": ["scientist", "professor", "doctor", "physician", "engineer", "mathematician", "historian", "philosopher", "chemist", "physicist", "astronomer"],
    "Sports": ["footballer", "athlete", "coach", "chess", "swimmer", "tennis", "boxer", "basketball", "cyclist"],
    "Military": ["soldier", "officer", "commander", "general", "colonel", "pilot", "partisan", "military"]
}

script_dir = os.path.dirname(os.path.abspath(__file__))
input_path = os.path.join(script_dir, '..', 'data', 'final_map_data.json')
output_path = os.path.join(script_dir, '..', 'data', 'map_data_with_topics.json')

print(f"Reading from: {input_path}")

try:
    with open(input_path, 'r', encoding='utf-8') as f:
        people = json.load(f)
except FileNotFoundError:
    print("Error: final_map_data.json not found!")
    exit()

processed_people = []
stats = {topic: 0 for topic in TOPIC_MAP}
stats["Other"] = 0

for person in people:
    # --- 1. CLASSIFICATION LOGIC ---
    assigned_topic = "Other"
    occupations = [o.lower() for o in person.get('occupations', [])]
    
    found = False
    for topic, keywords in TOPIC_MAP.items():
        for occ in occupations:
            if any(key in occ for key in keywords):
                assigned_topic = topic
                found = True
                break
        if found: break
    
    # --- 2. PRESERVE AND REBUILD ---
    # We create a clean dictionary ensuring NO data is lost
    new_person = {
        "id": person.get("id"),
        "name": person.get("name"),
        "birthplace": person.get("birthplace", "Unknown"), # Explicitly keeping this!
        "coords": person.get("coords"),
        "occupations": person.get("occupations", []),
        "enWiki": person.get("enWiki"),
        "ukWiki": person.get("ukWiki"),
        "ruWiki": person.get("ruWiki"),
        "topic": assigned_topic
    }
    
    processed_people.append(new_person)
    stats[assigned_topic] += 1

# Save to the NEW version
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(processed_people, f, ensure_ascii=False, indent=4)

print(f"\nSuccessfully created: {output_path}")
print(f"Sample Check - First Person Birthplace: {processed_people[0]['birthplace']}")