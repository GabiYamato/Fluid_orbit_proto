#!/usr/bin/env python3
"""
Script to wipe the Qdrant vector database.
Deletes all collections (products and product_chunks).

Usage:
    python scripts/wipe_vector_db.py [--confirm]
    
Options:
    --confirm    Skip confirmation prompt and wipe immediately
"""

import sys
import os
import shutil

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import UnexpectedResponse
from app.config import get_settings


def wipe_vector_database(confirm: bool = False) -> bool:
    """
    Wipe all collections from the Qdrant vector database.
    
    Args:
        confirm: If True, skip confirmation prompt
        
    Returns:
        True if successful, False otherwise
    """
    settings = get_settings()
    
    # Collection names used in the application
    collections = ["products", "product_chunks"]
    
    print("=" * 60)
    print("🗑️  QDRANT VECTOR DATABASE WIPE SCRIPT")
    print("=" * 60)
    print()
    
    # Show current configuration
    # Prioritize Path over URL, matching RAG Service logic
    if settings.qdrant_path:
        qdrant_path = settings.qdrant_path
        print(f"📍 Qdrant Path: {os.path.abspath(qdrant_path)}")
        try:
            qdrant_client = QdrantClient(path=qdrant_path)
        except Exception as e:
            print(f"❌ Failed to initialize local Qdrant: {e}")
            return False
            
    elif settings.qdrant_url:
        print(f"📍 Qdrant URL: {settings.qdrant_url}")
        qdrant_client = QdrantClient(url=settings.qdrant_url)
    
    print(f"📦 Collections to delete: {', '.join(collections)}")
    print()
    
    # Check existing collections
    try:
        existing_collections = qdrant_client.get_collections()
        existing_names = [c.name for c in existing_collections.collections]
        print(f"📊 Existing collections: {existing_names if existing_names else 'None'}")
        print()
    except Exception as e:
        print(f"⚠️  Could not fetch existing collections: {e}")
        existing_names = collections  # Assume all exist
    
    # Confirmation prompt
    if not confirm:
        print("⚠️  WARNING: This will permanently delete all vector data!")
        response = input("Type 'YES' to confirm: ").strip()
        if response != "YES":
            print("❌ Aborted. No changes made.")
            return False
    
    print()
    print("🔄 Wiping collections...")
    print("-" * 40)
    
    deleted_count = 0
    
    for collection_name in collections:
        try:
            if collection_name in existing_names:
                # Get collection info before deletion
                try:
                    info = qdrant_client.get_collection(collection_name)
                    point_count = info.points_count
                    print(f"  • {collection_name}: {point_count} vectors")
                except:
                    print(f"  • {collection_name}: unknown size")
                
                # Delete the collection
                qdrant_client.delete_collection(collection_name)
                print(f"    ✅ Deleted successfully")
                deleted_count += 1
            else:
                print(f"  • {collection_name}: not found (skipped)")
        except UnexpectedResponse as e:
            print(f"  • {collection_name}: ❌ Error - {e}")
        except Exception as e:
            print(f"  • {collection_name}: ❌ Error - {e}")
    
    print("-" * 40)
    print()
    
    # Also offer to delete the local storage directory if using file-based storage
    if not settings.qdrant_url and settings.qdrant_path:
        qdrant_path = os.path.abspath(settings.qdrant_path)
        if os.path.exists(qdrant_path):
            print(f"📁 Local storage directory: {qdrant_path}")
            if confirm or input("Delete local storage directory too? (y/N): ").strip().lower() == 'y':
                try:
                    shutil.rmtree(qdrant_path)
                    print(f"    ✅ Deleted {qdrant_path}")
                except Exception as e:
                    print(f"    ❌ Failed to delete directory: {e}")
    
    print()
    print("=" * 60)
    print(f"✨ Done! Deleted {deleted_count} collection(s).")
    print("=" * 60)
    
    return True


def main():
    """Main entry point."""
    # Check for --confirm flag
    confirm = "--confirm" in sys.argv or "-y" in sys.argv
    
    try:
        success = wipe_vector_database(confirm=confirm)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Aborted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
