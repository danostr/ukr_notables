"""
manual_classifier.py
--------------------
A command-line interface (CLI) tool that helps the user rapidly categorize 
uncategorized occupations. It reads the frequency list, skips occupations 
already covered by the topic_map, and prompts the user to map the remaining 
ones using quick 2-letter shortcuts.
"""

import json
import os

# ==========================================
# CONFIGURATION & CONSTANTS
# ==========================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'data')

TOPIC_MAP_PATH = os.path.join(DATA_DIR, 'topic_map.json')
OCC_LIST_PATH = os.path.join(DATA_DIR, 'occupations_list.txt')

# The default hierarchy used if topic_map.json doesn't exist yet
BASE_MAP = {
    "Politics & Society": {
        "Government & Law": [], "Religion": [], "Activism & Media": []
    },
    "Arts & Culture": {
        "Literature": [], "Visual Arts": [], "Performing Arts": [], 
        "Music": [], "TV & Internet Influencer": [], "Cinema & Filmmaking": []
    },
    "Science & Education": {
        "Science & Math": [], "Humanities": [], "Education": [], "Engineering & Tech": []
    },
    "Medicine": {
        "Healthcare": []
    },
    "Sports": {
        "Football": [], "Combat Sports": [], "Athletics & Gymnastics": [], 
        "Winter Sports": [], "Water Sports": [], "Other Sports": []
    },
    "Military": {
        "Armed Forces": []
    },
    "Business & Labor": {
        "Business": [], "Transport & Aviation": [], "Labor & Agriculture": []
    }
}

# 2-letter shortcuts for lightning-fast CLI classification
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

def initialize_topic_map() -> dict:
    """Loads the existing topic map or creates a new one from BASE_MAP."""
    if not os.path.exists(TOPIC_MAP_PATH):
        print("Creating new hierarchical topic_map.json...")
        os.makedirs(os.path.dirname(TOPIC_MAP_PATH), exist_ok=True)
        with open(TOPIC_MAP_PATH, 'w', encoding='utf-8') as f:
            json.dump(BASE_MAP, f, ensure_ascii=False, indent=4)
        return BASE_MAP
    else:
        with open(TOPIC_MAP_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)

def save_topic_map(topic_map: dict):
    """Saves the updated topic map to disk."""
    with open(TOPIC_MAP_PATH, 'w', encoding='utf-8') as f:
        json.dump(topic_map, f, ensure_ascii=False, indent=4)

def is_covered(occ: str, topic_map: dict) -> bool:
    """
    Checks if an occupation is already caught by existing keywords in the map.
    Does a case-insensitive substring match.
    """
    occ_lower = occ.lower()
    for main_topic, sub_dict in topic_map.items():
        for sub_topic, keywords in sub_dict.items():
            for key in keywords:
                if key.lower() in occ_lower:
                    return True
    return False

def load_and_sort_occupations() -> list:
    """
    Reads the frequency text file, cleans out any formatting artifacts, 
    and sorts the occupations by frequency (descending).
    """
    print("Loading and sorting occupations...")
    try:
        with open(OCC_LIST_PATH, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"Error: {OCC_LIST_PATH} not found!")
        exit()

    parsed_occupations = []
    for line in lines:
        # Skip header lines
        if ":" in line and not line.startswith("="):
            parts = line.split(":")
            occ_name = parts[0]
            
            # Clean up residual "" tags if they exist
            if "]" in occ_name:
                occ_name = occ_name.split("]")[-1]
                
            occ_name = occ_name.strip()
            
            try:
                count = int(parts[1].strip())
                parsed_occupations.append((occ_name, count))
            except ValueError:
                continue

    # Sort descending to tackle the most impactful (highest count) occupations first
    parsed_occupations.sort(key=lambda x: x[1], reverse=True)
    return parsed_occupations

def run_interactive_cli(parsed_occupations: list, topic_map: dict):
    """
    The main loop that prompts the user to categorize unknown occupations.
    """
    print("\n--- HIERARCHICAL SPEED CLASSIFIER ---")
    print("Shortcuts:")
    # Format shortcuts nicely into columns if possible, or just a list
    for key, val in SHORTCUTS.items():
        print(f" [{key}] {val[0]} -> {val[1]}")
    print("-" * 50)
    print("Commands: [s] Skip | [q] Save & Quit")
    print("-" * 50)

    for occ, count in parsed_occupations:
        if is_covered(occ, topic_map):
            continue
        
        print(f"\nOccupation: '{occ}' (Matches {count} people)")
        choice = input("Shortcut (e.g. 'al' for Arts-Lit): ").lower().strip()
        
        if choice == 'q':
            print("Exiting and saving progress...")
            break
        elif choice == 's':
            print("Skipped.")
            continue
        elif choice in SHORTCUTS:
            main_topic, sub_topic = SHORTCUTS[choice]
            
            # Allow user to input a broader keyword (e.g., "film" instead of "film director")
            custom_kw = input(f"Add as '{occ}'? (Press Enter to confirm, or type a shorter keyword): ").strip()
            keyword_to_add = custom_kw if custom_kw else occ
            
            # Make sure the sub_topic exists to prevent KeyError
            if sub_topic not in topic_map[main_topic]:
                topic_map[main_topic][sub_topic] = []
                
            topic_map[main_topic][sub_topic].append(keyword_to_add)
            save_topic_map(topic_map)
            print(f" -> Added '{keyword_to_add}' to {main_topic} -> {sub_topic}")
        else:
            print("Invalid shortcut. Skipped.")

def main():
    topic_map = initialize_topic_map()
    parsed_occupations = load_and_sort_occupations()
    run_interactive_cli(parsed_occupations, topic_map)
    print("\nSession complete. topic_map.json updated!")

if __name__ == "__main__":
    main()