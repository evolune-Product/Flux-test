#!/usr/bin/env python3
"""
Test script to verify authentication is working
"""
import requests
import json

API_BASE_URL = "http://localhost:8000"

def test_login():
    """Test login and get token"""
    print("Testing login...")

    # Replace with your actual credentials
    login_data = {
        "username": "testuser",  # Replace with your username
        "password": "testpass"   # Replace with your password
    }

    try:
        response = requests.post(f"{API_BASE_URL}/auth/login", json=login_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")

        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            print(f"\n✅ Login successful!")
            print(f"Token: {token[:50]}...")
            return token
        else:
            print(f"\n❌ Login failed: {response.json()}")
            return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None

def test_auth_endpoint(token):
    """Test the /test-auth endpoint"""
    print("\n\nTesting /test-auth endpoint...")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    try:
        response = requests.get(f"{API_BASE_URL}/test-auth", headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")

        if response.status_code == 200:
            print("\n✅ Authentication working!")
            return True
        else:
            print(f"\n❌ Auth test failed: {response.json()}")
            return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def test_create_team(token):
    """Test creating a team"""
    print("\n\nTesting team creation...")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    team_data = {
        "team_name": "Test Team"
    }

    try:
        response = requests.post(f"{API_BASE_URL}/teams/create",
                                json=team_data,
                                headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")

        if response.status_code == 200:
            print("\n✅ Team created successfully!")
            return True
        else:
            print(f"\n❌ Team creation failed: {response.json()}")
            return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    print("=" * 60)
    print("API Authentication Test")
    print("=" * 60)

    # Test 1: Login
    token = test_login()
    if not token:
        print("\n⚠️  Cannot proceed without a valid token")
        print("Please make sure:")
        print("  1. Backend is running (python backend.py)")
        print("  2. Update the username/password in this script")
        print("  3. Database is running")
        return

    # Test 2: Auth endpoint
    if test_auth_endpoint(token):
        # Test 3: Create team
        test_create_team(token)

    print("\n" + "=" * 60)
    print("Test complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
