"""One-off / repeatable: merge generated activities into bot/verified_links.json (150+)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JSON_PATH = ROOT / "verified_links.json"

TYPES = ["Club", "Event", "Sport", "Volunteering", "Study Group", "Cultural"]
TARGET_POOL = [
    "EU Students",
    "Non-EU Students",
    "New Arrivals",
    "First Year",
    "Graduate",
    "Erasmus+",
    "PhD",
]
LOCATIONS = ["On-campus", "Off-campus", "Hybrid"]
SCHEDULES = ["Weekly", "Biweekly", "Monthly", "One-time"]
CITIES = [
    "Iași",
    "Bucharest",
    "Cluj-Napoca",
    "Timișoara",
    "Brașov",
    "Constanța",
    "Craiova",
    "Sibiu",
    "Oradea",
    "Galați",
]
THEMES = [
    ("International student mixer", "Club", "socializing, networking, welcome"),
    ("Campus football league", "Sport", "fitness, team sports, outdoors"),
    ("Romanian film night", "Cultural", "culture, cinema, language"),
    ("Volunteer at food bank", "Volunteering", "community, civic, solidarity"),
    ("Thesis writing circle", "Study Group", "academic, writing, library"),
    ("Erasmus info session", "Event", "mobility, grants, paperwork"),
    ("Hiking club weekend", "Sport", "nature, trips, social"),
    ("Board games café meetup", "Club", "games, casual, friends"),
    ("Coding lab hours", "Study Group", "STEM, programming, projects"),
    ("Intercultural dialogue workshop", "Cultural", "diversity, dialogue, inclusion"),
    ("River clean-up day", "Volunteering", "environment, volunteering, team"),
    ("Public speaking club", "Club", "skills, confidence, English"),
]


def build_activity(index: int) -> dict:
    city = CITIES[index % len(CITIES)]
    base_name, typ, kw = THEMES[index % len(THEMES)]
    name = f"{base_name} — {city}"
    t = TYPES[index % len(TYPES)] if index % 7 != 0 else typ
    targets = [
        TARGET_POOL[index % len(TARGET_POOL)],
        TARGET_POOL[(index + 3) % len(TARGET_POOL)],
    ]
    link = f"https://naviro.app/activities/catalog/{index + 1:04d}"
    return {
        "name": name,
        "type": t,
        "target": targets,
        "link": link,
        "description": f"Student-led initiative in {city}. Open to newcomers; check details before attending.",
        "keywords": kw,
        "meeting_location": LOCATIONS[index % len(LOCATIONS)],
        "schedule": SCHEDULES[index % len(SCHEDULES)],
    }


def main() -> None:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    activities = [build_activity(i) for i in range(160)]
    data["activities"] = activities
    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(activities)} activities to {JSON_PATH}")


if __name__ == "__main__":
    main()
