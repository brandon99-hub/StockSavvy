import subprocess
import os
import sys
import argparse

def update_repository(branch=None):
    """
    Update the current Git repository by pulling the latest changes.
    
    Args:
        branch (str, optional): The branch to pull from. If not provided, 
                               the current branch will be used.
    
    Returns:
        bool: True if the repository was updated successfully, False otherwise.
    """
    try:
        # Check if we're in a git repository
        try:
            subprocess.run(['git', 'rev-parse', '--is-inside-work-tree'], 
                          check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError:
            print("Error: Not a git repository. Please run this script from within a git repository.")
            return False
        
        # Get current branch if none specified
        if not branch:
            result = subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], 
                                   check=True, capture_output=True, text=True)
            branch = result.stdout.strip()
            print(f"Using current branch: {branch}")
        
        # Check for uncommitted changes
        result = subprocess.run(['git', 'status', '--porcelain'], 
                               check=True, capture_output=True, text=True)
        if result.stdout.strip():
            print("Warning: You have uncommitted changes.")
            choice = input("Do you want to stash these changes before updating? (y/n): ").lower()
            if choice == 'y':
                print("Stashing changes...")
                subprocess.run(['git', 'stash'], check=True)
                print("Changes stashed successfully.")
        
        # Pull the latest changes
        print(f"Pulling latest changes from origin/{branch}...")
        result = subprocess.run(['git', 'pull', 'origin', branch], 
                               check=True, capture_output=True, text=True)
        
        print("Repository updated successfully!")
        print(result.stdout)
        
        # Pop stashed changes if we stashed them
        if result.stdout.strip() and choice == 'y':
            print("Reapplying stashed changes...")
            try:
                subprocess.run(['git', 'stash', 'pop'], check=True)
                print("Stashed changes reapplied successfully.")
            except subprocess.CalledProcessError as e:
                print(f"Warning: Could not reapply stashed changes automatically: {e}")
                print("You may need to resolve conflicts manually and then run 'git stash pop'.")
        
        return True
    
    except subprocess.CalledProcessError as e:
        print(f"Error updating repository: {e}")
        print(f"Error output: {e.stderr}")
        return False
    
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Update a Git repository with the latest changes')
    parser.add_argument('-b', '--branch', help='The branch to pull from (defaults to current branch)')
    
    args = parser.parse_args()
    
    update_repository(args.branch)

if __name__ == '__main__':
    main()