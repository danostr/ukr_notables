import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
topic_map_path = os.path.join(script_dir, '..', 'data', 'topic_map.json')
input_path = os.path.join(script_dir, '..', 'data', 'final_map_data.json')
output_path = os.path.join(script_dir, '..', 'data', 'map_data_with_topics.json')

# Load the TOPIC_MAP from JSON
with open(topic_map_path, 'r', encoding='utf-8') as f:
    TOPIC_MAP = json.load(f)

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
    assigned_topic = "Other"
    assigned_subtopic = "Unknown" # NEW: Default subtopic
    occupations = [o.lower() for o in person.get('occupations', [])]
    
    found = False
    for main_topic, sub_dict in TOPIC_MAP.items():
        for sub_topic, keywords in sub_dict.items():
            for occ in occupations:
                if any(key.lower() in occ for key in keywords):
                    assigned_topic = main_topic
                    assigned_subtopic = sub_topic # NEW: Capture the subtopic
                    found = True
                    break
            if found: break
        if found: break
    
    # Update the person dictionary
    new_person = {
        "id": person.get("id"),
        "name": person.get("name"),
        "birthplace": person.get("birthplace", "Unknown"),
        "coords": person.get("coords"),
        "occupations": person.get("occupations", []),
        "enWiki": person.get("enWiki"),
        "ukWiki": person.get("ukWiki"),
        "ruWiki": person.get("ruWiki"),
        "topic": assigned_topic,
        "sub_topic": assigned_subtopic # NEW: Save it to the JSON
    }
    
    processed_people.append(new_person)
    stats[assigned_topic] += 1

# Save to the NEW version
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(processed_people, f, ensure_ascii=False, indent=4)

print(f"\nSuccessfully created: {output_path}")
print(f"Sample Check - First Person Birthplace: {processed_people[0]['birthplace']}")