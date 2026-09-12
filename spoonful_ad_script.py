#!/usr/bin/env python3
"""
Spoonful - Video Advertisement Script
A React Native cooking/recipe app advertisement.

This script creates a structured video advertisement that explains the Spoonful app features.
It can be used with video editing tools or AI video generation platforms.
"""

import enum
from dataclasses import dataclass
from typing import List

class Scene(enum.IntEnum):
    """Video scenes for the Spoonful advertisement."""
    INTRO = 0       # Hook: "A calmer kitchen"
    PROBLEM = 1     # Fridge staring, "What should I cook?"
    AI_CHEF = 2     # AI Chef feature
    RECIPES = 3     # Recipe library
    TRACKING = 4    # Calorie tracker
    SHELF = 5       # Saved recipes & shopping list
    CTA = 6         # Call to action: "Get started for free"

@dataclass
class SceneDescription:
    """Description of a video scene."""
    number: int
    title: str
    duration: float  # seconds
    visuals: str     # What's shown on screen
    voiceover: str   # Narrated text
    on_screen_text: str  # Text overlay

# Define all advertisement scenes
SCENES: List[SceneDescription] = [
    SceneDescription(
        number=1,
        title="Hook - A calmer kitchen",
        duration=3.0,
        visuals="Opening shot of a clean, organized kitchen. Text overlay: 'A calmer kitchen'. Chef hat icon animates in.",
        voiceover="Welcome to a calmer kitchen. Meet Spoonful.",
        on_screen_text="A calmer kitchen"
    ),
    SceneDescription(
        number=2,
        title="Problem - What should I cook?",
        duration=2.0,
        visuals="Person staring into an open fridge, looking confused. Thought bubble with question marks.",
        voiceover="Standing in front of an open fridge? Wondering what to cook?",
        on_screen_text="What should I cook?"
    ),
    SceneDescription(
        number=3,
        title="AI Chef - Tell it what you have",
        duration=4.0,
        visuals="Split screen: Left - fridge ingredients, Right - AI Chef interface typing. Text: 'I have chicken, eggs, vegetables'. Recipe auto-generates.",
        voiceover="Spoonful's AI Chef writes recipes around your ingredients. Just tell it what you have.",
        on_screen_text="AI Chef"
    ),
    SceneDescription(
        number=4,
        title="Recipe Library - 1,100+ recipes",
        duration=3.0,
        visuals="Scrolling through a beautiful recipe library with photos. Users tapping on recipes.",
        voiceover="Or browse 1,100+ handcrafted recipes with step-by-step guides and nutrition facts.",
        on_screen_text="1,100+ recipes"
    ),
    SceneDescription(
        number=5,
        title="Calorie Tracker - Watch totals fill up",
        duration=3.0,
        visuals="Dashboard showing daily calorie progress bar filling up. Meal logs appearing.",
        voiceover="Log meals from any recipe and watch your daily totals fill up. Stay on track with your goals.",
        on_screen_text="Calorie tracker"
    ),
    SceneDescription(
        number=6,
        title="Your Shelf - Save & organize",
        duration=3.0,
        visuals="Collection of saved recipes, ingredients being added to a shopping list. User organizing recipes into collections.",
        voiceover="Save recipes into collections and add ingredients to your shopping list. Everything you need, in one place.",
        on_screen_text="Your shelf"
    ),
    SceneDescription(
        number=7,
        title="Call to Action",
        duration=4.0,
        visuals="Final CTA screen: 'Get started for free' button animates. App store icons (App Store / Google Play) fade in.",
        voiceover="Keep the good stuff close. Get started for free.",
        on_screen_text="Get started for free"
    )
]

def generate_script_text() -> str:
    """Generate the full video script as formatted text."""
    lines = []
    lines.append("=" * 60)
    lines.append("SPOONFUL - VIDEO ADVERTISEMENT SCRIPT")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"Total duration: {sum(s.duration for s in SCENES):.1f} seconds")
    lines.append("")

    for scene in SCENES:
        lines.append("-" * 40)
        lines.append(f"SCENE {scene.number}: {scene.title}")
        lines.append(f"Duration: {scene.duration}s")
        lines.append(f"Visuals: {scene.visuals}")
        lines.append(f"Voiceover: {scene.voiceover}")
        lines.append(f"On-screen text: {scene.on_screen_text}")
        lines.append("")

    lines.append("=" * 60)
    lines.append("PRODUCTION NOTES")
    lines.append("=" * 60)
    lines.append("")
    lines.append("Recommended aspect ratio: 9:16 (vertical mobile)")
    lines.append("Recommended duration: 18-20 seconds (short-form ad)")
    lines.append("Style: Clean, colorful, app-demo style")
    lines.append("Music: Upbeat, positive, modern cooking/tech vibe")
    lines.append("")
    lines.append("SCENE BREAKDOWN:")
    for scene in SCENES:
        lines.append(f"  {scene.number:2d}. {scene.title:30s} ({scene.duration:.1f}s)")
    lines.append("")
    lines.append("KEY FEATURES HIGHLIGHTED:")
    lines.append("  • AI Chef - recipe generation from ingredients")
    lines.append("  • 1,100+ recipe library")
    lines.append("  • Calorie tracking")
    lines.append("  • Recipe collections & shopping list")
    lines.append("")
    lines.append("=" * 60)
    lines.append("END OF SCRIPT")
    lines.append("=" * 60)

    return "\n".join(lines)


def generate_telepromprompter() -> str:
    """Generate a simplified teleprompter view for recording."""
    lines = []
    lines.append("=" * 60)
    lines.append("SPOONFUL - TELEPROMPTER")
    lines.append("=" * 60)
    lines.append("")

    for scene in SCENES:
        lines.append(f"--- Scene {scene.number} ---")
        lines.append(f"VO: {scene.voiceover}")
        lines.append("")

    lines.append("=" * 60)
    lines.append("END")
    lines.append("=" * 60)

    return "\n".join(lines)


if __name__ == "__main__":
    print(generate_script_text())