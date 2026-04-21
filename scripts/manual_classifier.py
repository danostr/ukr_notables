import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
topic_map_path = os.path.join(script_dir, '..', 'data', 'topic_map.json')
occ_list_path = os.path.join(script_dir, '..', 'data', 'occupations_list.txt')

# 1. The Hierarchical Base Map
BASE_MAP = {
    "Politics & Society": {
        "Government & Law": ["politician", "statesperson", "diplomat", "lawyer", "judge", "jurist", "mayor", "governor", "official"],
        "Religion": ["priest", "bishop", "monk", "theologian", "rabbi", "clergy"],
        "Activism & Media": ["journalist", "activist", "dissident", "revolutionary", "blogger"]
    },
    "Arts & Culture": {
        "Literature": ["writer", "poet", "author", "novelist", "essayist", "playwright", "critic"],
        "Visual Arts": ["painter", "sculptor", "artist", "architect", "photographer", "designer"],
        "Performing Arts": ["actor", "director", "choreographer", "dancer", "comedian"],
        "Music": ["singer", "musician", "composer", "conductor", "pianist", "violinist"]
    },
    "Science & Education": {
        "Science & Math": ["scientist", "physicist", "mathematician", "chemist", "biologist", "astronomer"],
        "Humanities": ["historian", "philosopher", "linguist", "archaeologist", "philologist"],
        "Education": ["teacher", "professor", "pedagogue", "educator", "lecturer"],
        "Engineering & Tech": ["engineer", "inventor", "programmer"]
    },
    "Medicine": {
        "Healthcare": ["physician", "doctor", "surgeon", "psychiatrist", "pharmacist", "nurse"]
    },
    "Sports": {
        "Athletics": ["athlete", "football", "coach", "gymnast", "swimmer", "boxer", "chess"]
    },
    "Military": {
        "Armed Forces": ["military", "soldier", "officer", "commander", "general", "partisan"]
    },
    "Business & Labor": {
        "Business": ["entrepreneur", "businessperson", "manager", "banker"],
        "Labor & Agriculture": ["worker", "peasant", "miner", "agronomist", "driver"]
    }
}

# 2. Setup mapping shortcuts for speed
SHORTCUTS = {
    "pg": ("Politics & Society", "Government & Law"),
    "pr": ("Politics & Society", "Religion"),
    "pa": ("Politics & Society", "Activism & Media"),
    "al": ("Arts & Culture", "Literature"),
    "av": ("Arts & Culture", "Visual Arts"),
    "ap": ("Arts & Culture", "Performing Arts"),
    "am": ("Arts & Culture", "Music"),
    "at": ("Arts & Culture", "TV & Internet Influencer"),
    "ac": ("Arts & Culture", "Cinema & Filmmaking"),
    "ss": ("Science & Education", "Science & Math"),
    "sh": ("Science & Education", "Humanities"),
    "se": ("Science & Education", "Education"),
    "st": ("Science & Education", "Engineering & Tech"),
    "mh": ("Medicine", "Healthcare"),
    "sf": ("Sports", "Football"),
    "sc": ("Sports", "Combat Sports"),
    "sg": ("Sports", "Athletics & Gymnastics"),
    "sw": ("Sports", "Winter Sports"),
    "sl": ("Sports", "Water Sports"),
    "so": ("Sports", "Other Sports"),
    "ma": ("Military", "Armed Forces"),
    "bb": ("Business & Labor", "Business"),
    "bt": ("Business & Labor", "Transport & Aviation"),
    "bl": ("Business & Labor", "Labor & Agriculture")
}

# Initialize or Load JSON
if not os.path.exists(topic_map_path):
    print("Creating new hierarchical topic_map.json...")
    with open(topic_map_path, 'w', encoding='utf-8') as f:
        json.dump(BASE_MAP, f, ensure_ascii=False, indent=4)
    topic_map = BASE_MAP
else:
    with open(topic_map_path, 'r', encoding='utf-8') as f:
        topic_map = json.load(f)

def save_map():
    with open(topic_map_path, 'w', encoding='utf-8') as f:
        json.dump(topic_map, f, ensure_ascii=False, indent=4)

def is_covered(occ):
    occ_lower = occ.lower()
    for main_topic, sub_dict in topic_map.items():
        for sub_topic, keywords in sub_dict.items():
            for key in keywords:
                if key.lower() in occ_lower:
                    return True
    return False

# Parse and Sort Occupations by Frequency
print("Loading and sorting occupations...")
try:
    with open(occ_list_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
except FileNotFoundError:
    print(f"Error: {occ_list_path} not found!")
    exit()

parsed_occupations = []
for line in lines:
    # Safely extract the occupation without using complex regex
    if ":" in line and not line.startswith("="):
        parts = line.split(":")
        occ_name = parts[0]
        
        # Remove the "" tags if they exist
        if "]" in occ_name:
            occ_name = occ_name.split("]")[-1]
            
        occ_name = occ_name.strip()
        
        try:
            count = int(parts[1].strip())
            parsed_occupations.append((occ_name, count))
        except ValueError:
            continue

# Sort descending so you tackle the biggest numbers first
parsed_occupations.sort(key=lambda x: x[1], reverse=True)

print("\n--- HIERARCHICAL SPEED CLASSIFIER ---")
print("Shortcuts:")
for key, val in SHORTCUTS.items():
    print(f" [{key}] {val[0]} -> {val[1]}")
print(" [s] Skip | [q] Save & Quit")
print("-" * 50)

# Process loop
for occ, count in parsed_occupations:
    if is_covered(occ):
        continue
    
    print(f"\nOccupation: '{occ}' (Matches {count} people)")
    choice = input("Shortcut (e.g. 'al' for Arts-Lit): ").lower().strip()
    
    if choice == 'q':
        break
    elif choice == 's':
        print("Skipped.")
        continue
    elif choice in SHORTCUTS:
        main_topic, sub_topic = SHORTCUTS[choice]
        
        # Check if user wants to shorten the keyword
        custom_kw = input(f"Add as '{occ}'? (Press Enter to confirm, or type a shorter keyword): ").strip()
        keyword_to_add = custom_kw if custom_kw else occ
        
        topic_map[main_topic][sub_topic].append(keyword_to_add)
        save_map()
        print(f" -> Added '{keyword_to_add}' to {main_topic} -> {sub_topic}")
    else:
        print("Invalid shortcut. Skipped.")

print("\nSession complete. topic_map.json updated!")