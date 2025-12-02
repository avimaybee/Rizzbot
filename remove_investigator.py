#!/usr/bin/env python3
"""
Script to remove all investigator mode related code from the DeadOrGhosting app.
This script was created to handle Windows line endings correctly.
"""
import os
import re
import shutil

PROJECT_DIR = r"d:\vs studio\wingman\DeadOrGhosting"

def remove_files():
    """Delete ResultCard.tsx and MemeGenerator.tsx"""
    files_to_delete = [
        os.path.join(PROJECT_DIR, "components", "ResultCard.tsx"),
        os.path.join(PROJECT_DIR, "components", "MemeGenerator.tsx"),
    ]
    
    for filepath in files_to_delete:
        if os.path.exists(filepath):
            os.remove(filepath)
            print(f"Deleted: {filepath}")
        else:
            print(f"File not found (may already be deleted): {filepath}")

def update_app_tsx():
    """Update App.tsx to remove investigator mode code"""
    filepath = os.path.join(PROJECT_DIR, "App.tsx")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove imports
    content = re.sub(r"import \{ analyzeGhosting \} from './services/geminiService';\r?\n", "", content)
    content = re.sub(r"import \{ ResultCard \} from './components/ResultCard';\r?\n", "", content)
    content = content.replace("GhostResult, ", "")
    content = content.replace(", getWellbeingState", "")
    content = content.replace(", Sparkles", "")
    content = content.replace(", useRef", "")
    
    # Remove ENABLE_INVESTIGATOR constant and comments
    content = re.sub(r"// Feature flag to enable/disable Investigator mode\r?\n// Set to true to re-enable Investigator in dev builds\r?\nconst ENABLE_INVESTIGATOR = false;\r?\n\r?\n", "", content)
    
    # Update Module type
    content = content.replace("type Module = 'standby' | 'simulator' | 'investigator' | 'quick' | 'profile';",
                             "type Module = 'standby' | 'simulator' | 'quick' | 'profile';")
    
    # Remove investigator from SideDock - replace specific section
    content = re.sub(
        r'\s+\{ENABLE_INVESTIGATOR && \(\r?\n\s+<DockItem\r?\n\s+active=\{activeModule === \'investigator\'\}\r?\n\s+onClick=\{\(\) => setModule\(\'investigator\'\)\}\r?\n\s+label="SCAN"\r?\n\s+index="03"\r?\n\s+/>\r?\n\s+\)\}',
        '',
        content
    )
    
    # Update Practice Mode index
    content = re.sub(
        r'index=\{ENABLE_INVESTIGATOR \? "04" : "03"\}',
        'index="03"',
        content
    )
    
    # Remove investigator button from StandbyScreen
    content = re.sub(
        r'\s+\{ENABLE_INVESTIGATOR && \(\r?\n.*?<ArrowRight className="w-12 h-12 text-hard-gold -rotate-45" />\r?\n.*?</button>\r?\n\s+\)\}\r?\n',
        '',
        content,
        flags=re.DOTALL
    )
    
    # Update Practice Mode label in StandbyScreen
    content = re.sub(
        r'<div className="label-sm text-zinc-500 group-hover:text-hard-blue transition-colors mb-2">\{ENABLE_INVESTIGATOR \? \'MODULE 03\' : \'MODULE 02\'\}</div>',
        '<div className="label-sm text-zinc-500 group-hover:text-hard-blue transition-colors mb-2">MODULE 02</div>',
        content
    )
    
    # Remove investigator state variables (lines ~629-687)
    content = re.sub(
        r'\s+// Investigator State\r?\n.*?const hasScreenshots = investigateMode === \'screenshot\' && screenshots\.length > 0;\r?\n',
        '',
        content,
        flags=re.DOTALL
    )
    
    # Remove investigator module rendering (lines ~7 94-937)
    content = re.sub(
        r'\s+\{/\* INVESTIGATOR MODULE.*?\}\r?\n\s+\)\}\r?\n',
        '',
        content,
        flags=re.DOTALL
    )
    
    # Remove onPivotToInvestigator prop
    content = re.sub(
        r'onPivotToInvestigator=\{ENABLE_INVESTIGATOR \? \(\) => setActiveModule\(\'investigator\'\) : undefined\}\r?\n\s+',
        '',
        content
    )
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Updated: {filepath}")

def update_simulator_tsx():
    """Update Simulator.tsx to remove onPivotToInvestigator prop"""
    filepath = os.path.join(PROJECT_DIR, "components", "Simulator.tsx")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove onPivotToInvestigator from interface
    content = re.sub(
        r'\s+// Optional callback - used when Investigator mode is enabled\r?\n\s+onPivotToInvestigator\?: \(\) => void;\r?\n',
        '',
        content
    )
    
    # Remove from component props
    content = content.replace("onPivotToInvestigator, ", "")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Updated: {filepath}")

def update_gemini_service():
    """Update geminiService.ts to remove analyzeGhosting function"""
    filepath = os.path.join(PROJECT_DIR, "services", "geminiService.ts")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove GhostResult from imports
    content = content.replace("GhostResult, ", "")
    
    # Remove analyzeGhosting function (lines ~22-177)
    content = re.sub(
        r'export const analyzeGhosting = async.*?^};',
        '',
        content,
        flags=re.DOTALL | re.MULTILINE
    )
    
    # Clean up extra blank lines
    content = re.sub(r'\n\n\n+', '\n\n', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Updated: {filepath}")

def update_types():
    """Update types.ts to remove investigator types"""
    filepath = os.path.join(PROJECT_DIR, "types.ts")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove investigator-related interfaces (lines 2-36)
    content = re.sub(
        r'\nexport interface GhostRequest.*?^}',
        '',
        content,
        flags=re.DOTALL | re.MULTILINE
    )
    content = re.sub(
        r'\nexport interface EvidenceItem.*?^}',
        '',
        content,
        flags=re.DOTALL | re.MULTILINE
    )
    content = re.sub(
        r'\nexport interface SocialFootprint.*?^}',
        '',
        content,
        flags=re.DOTALL | re.MULTILINE
    )
    content = re.sub(
        r'\nexport interface GhostResult.*?^}',
        '',
        content,
        flags=re.DOTALL | re.MULTILINE
    )
    
    # Clean up extra blank lines
    content = re.sub(r'\n\n\n+', '\n\n', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Updated: {filepath}")

def update_docs():
    """Update documentation"""
    filepath = os.path.join(PROJECT_DIR, "docs", "03_DEVELOPMENT_STATUS.md")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Mark deprecate investigator as complete
    content = content.replace(
        "*   Deprecate Investigator UI.",
        "*   ✅ Deprecate Investigator UI."
    )
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Updated: {filepath}")

def main():
    print("Starting investigator mode removal...")
    print("=" * 60)
    
    remove_files()
    update_app_tsx()
    update_simulator_tsx()
    update_gemini_service()
    update_types()
    update_docs()
    
    print("=" * 60)
    print("✅ All done! Investigator mode has been removed.")
    print("\nPlease run 'npm run build' to verify changes.")

if __name__ == "__main__":
    main()
