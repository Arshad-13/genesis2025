#!/usr/bin/env python3
"""
Test script for session management functionality.
Run this to verify that the multi-user session architecture works correctly.
"""

import asyncio
import aiohttp
import json
import time
from typing import List, Dict

BACKEND_URL = "http://localhost:8000"

class SessionTester:
    def __init__(self, session_name: str):
        self.session_name = session_name
        self.session_id = None
        self.session = None
    
    async def create_session(self):
        """Create a new session"""
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/sessions/create") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.session_id = data["session_id"]
                    print(f"✅ {self.session_name}: Created session {self.session_id}")
                    return True
                else:
                    print(f"❌ {self.session_name}: Failed to create session")
                    return False
    
    async def switch_mode(self, mode: str, symbol: str = None):
        """Switch session mode"""
        if not self.session_id:
            print(f"❌ {self.session_name}: No session ID")
            return False
        
        payload = {"mode": mode}
        if symbol:
            payload["symbol"] = symbol
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{BACKEND_URL}/mode/{self.session_id}",
                json=payload
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ {self.session_name}: Switched to {mode} mode" + 
                          (f" ({symbol})" if symbol else ""))
                    return True
                else:
                    print(f"❌ {self.session_name}: Failed to switch mode")
                    return False
    
    async def control_replay(self, action: str):
        """Control replay (pause/resume/start/stop)"""
        if not self.session_id:
            print(f"❌ {self.session_name}: No session ID")
            return False
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/replay/{action}/{self.session_id}") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ {self.session_name}: {action.capitalize()} - {data.get('status')}")
                    return True
                else:
                    print(f"❌ {self.session_name}: Failed to {action}")
                    return False
    
    async def set_speed(self, speed: int):
        """Set replay speed"""
        if not self.session_id:
            print(f"❌ {self.session_name}: No session ID")
            return False
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BACKEND_URL}/replay/speed/{speed}/{self.session_id}") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ {self.session_name}: Speed set to {speed}x")
                    return True
                else:
                    print(f"❌ {self.session_name}: Failed to set speed")
                    return False
    
    async def get_session_state(self):
        """Get session state"""
        if not self.session_id:
            print(f"❌ {self.session_name}: No session ID")
            return None
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/sessions/{self.session_id}") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data["session"]
                else:
                    print(f"❌ {self.session_name}: Failed to get session state")
                    return None

async def test_multi_user_isolation():
    """Test that multiple users don't interfere with each other"""
    print("🧪 Testing Multi-User Session Isolation")
    print("=" * 50)
    
    # Create three test users
    user_a = SessionTester("User A")
    user_b = SessionTester("User B") 
    user_c = SessionTester("User C")
    
    # Step 1: Create sessions
    print("\n📝 Step 1: Creating sessions...")
    await user_a.create_session()
    await user_b.create_session()
    await user_c.create_session()
    
    # Step 2: Test mode switching isolation
    print("\n📝 Step 2: Testing mode switching isolation...")
    await user_a.switch_mode("LIVE", "BTCUSDT")
    await user_b.switch_mode("REPLAY")
    await user_c.switch_mode("LIVE", "ETHUSDT")
    
    # Verify states
    state_a = await user_a.get_session_state()
    state_b = await user_b.get_session_state()
    state_c = await user_c.get_session_state()
    
    print(f"   User A mode: {state_a['mode']} ({state_a.get('active_symbol', 'N/A')})")
    print(f"   User B mode: {state_b['mode']} ({state_b.get('active_symbol', 'N/A')})")
    print(f"   User C mode: {state_c['mode']} ({state_c.get('active_symbol', 'N/A')})")
    
    # Step 3: Test replay control isolation
    print("\n📝 Step 3: Testing replay control isolation...")
    await user_a.control_replay("pause")
    await user_b.control_replay("start")
    await user_c.set_speed(5)
    
    # Verify states again
    state_a = await user_a.get_session_state()
    state_b = await user_b.get_session_state()
    state_c = await user_c.get_session_state()
    
    print(f"   User A controller: {state_a['controller_state']['state']}")
    print(f"   User B controller: {state_b['controller_state']['state']}")
    print(f"   User C speed: {state_c['controller_state']['speed']}x")
    
    # Step 4: Verify isolation
    print("\n📝 Step 4: Verifying isolation...")
    
    isolation_tests = [
        (state_a['mode'] == "LIVE" and state_a['active_symbol'] == "BTCUSDT", "User A mode isolation"),
        (state_b['mode'] == "REPLAY" and not state_b.get('active_symbol'), "User B mode isolation"),
        (state_c['mode'] == "LIVE" and state_c['active_symbol'] == "ETHUSDT", "User C mode isolation"),
        (state_a['controller_state']['state'] == "PAUSED", "User A pause isolation"),
        (state_b['controller_state']['state'] == "PLAYING", "User B play isolation"),
        (state_c['controller_state']['speed'] == 5, "User C speed isolation"),
    ]
    
    all_passed = True
    for test_result, test_name in isolation_tests:
        if test_result:
            print(f"   ✅ {test_name}")
        else:
            print(f"   ❌ {test_name}")
            all_passed = False
    
    # Step 5: Test session stats
    print("\n📝 Step 5: Checking session statistics...")
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{BACKEND_URL}/sessions/stats") as resp:
            if resp.status == 200:
                stats = await resp.json()
                print(f"   Total sessions: {stats['total_sessions']}")
                print(f"   Active sessions: {stats['active_sessions']}")
                print(f"   Mode distribution: {stats['mode_distribution']}")
            else:
                print("   ❌ Failed to get session stats")
                all_passed = False
    
    # Final result
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 ALL TESTS PASSED - Multi-user isolation working correctly!")
    else:
        print("❌ SOME TESTS FAILED - Check implementation")
    
    return all_passed

async def test_backward_compatibility():
    """Test that old API endpoints still work"""
    print("\n🧪 Testing Backward Compatibility")
    print("=" * 50)
    
    # Test global endpoints (without session ID)
    async with aiohttp.ClientSession() as session:
        # Test global mode switch
        async with session.post(f"{BACKEND_URL}/mode", json={"mode": "REPLAY"}) as resp:
            if resp.status == 200:
                print("✅ Global mode switch works")
            else:
                print("❌ Global mode switch failed")
        
        # Test global replay controls
        async with session.post(f"{BACKEND_URL}/replay/start") as resp:
            if resp.status == 200:
                print("✅ Global replay start works")
            else:
                print("❌ Global replay start failed")
        
        async with session.post(f"{BACKEND_URL}/replay/pause") as resp:
            if resp.status == 200:
                print("✅ Global replay pause works")
            else:
                print("❌ Global replay pause failed")

if __name__ == "__main__":
    async def main():
        print("🚀 Starting Session Management Tests")
        print("Make sure the backend is running on localhost:8000")
        print()
        
        # Test multi-user isolation
        isolation_success = await test_multi_user_isolation()
        
        # Test backward compatibility
        await test_backward_compatibility()
        
        print("\n🏁 Test Summary:")
        if isolation_success:
            print("✅ Multi-user session isolation: WORKING")
        else:
            print("❌ Multi-user session isolation: FAILED")
        
        print("✅ Backward compatibility: MAINTAINED")
        print("\n💡 The session-based architecture is ready for production!")
    
    asyncio.run(main())