"""
apply_topics.py
---------------
This script acts as the final step in the data pipeline. 
It takes the raw notable people data and assigns a main topic and sub-topic 
based on the rules defined in topic_map.json.

Crucially, it reads from the local data_pipeline folder, but outputs the 
final JSON to the production data folder for the web application to use.
"""

import json
import os

# ==========================================
# CONFIGURATION & CONSTANTS
# ==========================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Internal pipeline data directory
PIPELINE_DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'data')
# Public production data directory (up two levels)
MAIN_DATA_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'data')

TOPIC_MAP_PATH = os.path.join(PIPELINE_DATA_DIR, 'topic_map.json')
INPUT_PATH = os.path.join(PIPELINE_DATA_DIR, 'final_map_data.json')
OUTPUT_PATH = os.path.join(MAIN_DATA_DIR, 'map_data_with_topics.json')

def load_json(filepath: str):
    """Safely loads a JSON file, exiting gracefully if not found."""
    print(f"Loading data from: {os.path.abspath(filepath)}")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find {os.path.basename(filepath)} at {filepath}")
        exit()

def apply_topics(people_data: list, topic_map: dict) -> tuple:
    """
    Iterates through the dataset, matching occupations to the hierarchical 
    topic map to assign main topics and sub-topics.
    """
    processed_people = []
    
    # Initialize stats dictionary
    stats = {topic: 0 for topic in topic_map.keys()}
    stats["Other"] = 0

    for person in people_data:
        assigned_main_topic = "Other"
        assigned_sub_topic = "Unknown"
        
        # Lowercase all occupations for case-insensitive matching
        occupations = [occ.lower() for occ in person.get('occupations', [])]
        
        match_found = False
        
        # Deep search through the hierarchy
        for main_topic, sub_dict in topic_map.items():
            for sub_topic, keywords in sub_dict.items():
                for occ in occupations:
                    # Substring match (e.g., 'medic' catches 'paramedic')
                    if any(key.lower() in occ for key in keywords):
                        assigned_main_topic = main_topic
                        assigned_sub_topic = sub_topic
                        match_found = True
                        break
                if match_found: break
            if match_found: break
        
        # Construct the clean, final dictionary for this person
        new_person = {
            "id": person.get("id"),
            "name": person.get("name"),
            "birthplace": person.get("birthplace", "Unknown"),
            "coords": person.get("coords"),
            "occupations": person.get("occupations", []),
            "enWiki": person.get("enWiki"),
            "ukWiki": person.get("ukWiki"),
            "ruWiki": person.get("ruWiki"),
            "topic": assigned_main_topic,
            "sub_topic": assigned_sub_topic
        }
        
        processed_people.append(new_person)
        stats[assigned_main_topic] += 1
        
    return processed_people, stats

def main():
    print("--- STARTING TOPIC CLASSIFICATION ---")
    
    topic_map = load_json(TOPIC_MAP_PATH)
    people_data = load_json(INPUT_PATH)
    
    print("\nApplying classification rules...")
    processed_people, stats = apply_topics(people_data, topic_map)
    
    # Save to the production data folder
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(processed_people, f, ensure_ascii=False, indent=4)
        
    print(f"\nSuccessfully created production data: {os.path.abspath(OUTPUT_PATH)}")
    print("\n--- Final Category Breakdown ---")
    for category, count in stats.items():
        print(f" - {category}: {count}")
        
    if processed_people:
        print(f"\nSample Check - First Person Birthplace: {processed_people[0]['birthplace']}")

if __name__ == "__main__":
    main()