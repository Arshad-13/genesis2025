# Multi-User & Mode Switching Analysis

## 🎯 Executive Summary

**Critical Findings**:
1. ✅ **Data clearing on mode switch**: Properly implemented on frontend
2. ❌ **Multi-user replay controls**: GLOBAL state affects ALL users
3. ⚠️ **Architecture issue**: Single backend instance controls all clients

## 📊 Deep Dive Analysis

### 🔄 **Mode Switching Data Clearing**

#### **Frontend Behavior** ✅ **CORRECT**
```javascript
const switchMode = async (mode, symbol = null) => {
  // ... API call to backend ...
  
  if (result.status === 'success') {
    // Clear existing data when switching modes
    setData([]);                    // ✅ Clear chart data
    setLatestSnapshot(null);        // ✅ Clear current snapshot
    
    showToast(`Switched to ${mode} mode`, 'success');
    return true;
  }
}
```

**What happens on mode switch**:
1. **User clicks LIVE/REPLAY button**
2. **Frontend immediately clears**: `data` array and `latestSnapshot`
3. **Backend switches mode** and starts sending new data type
4. **WebSocket receives new data** and populates fresh arrays
5. **Charts re-render** with new mode's data

**Result**: ✅ **Clean separation** - No data contamination between modes

---

### 🌐 **Multi-User WebSocket Architecture**

#### **Current Implementation** ❌ **PROBLEMATIC**

```python
# GLOBAL SINGLETON INSTANCES
controller = ReplayController()        # ❌ Single instance for ALL users
data_buffer: List[dict] = []          # ❌ Shared buffer for ALL users
manager = ConnectionManager()         # ❌ Broadcasts to ALL connections

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Send SAME data_buffer to ALL new connections
    await websocket.send_json({
        "type": "history",
        "data": data_buffer              # ❌ Same data for everyone
    })
```

#### **The Problem**: Global State Sharing

```python
# When ANY user clicks pause...
@app.post("/replay/pause")
def pause_replay():
    controller.pause()               # ❌ Affects GLOBAL controller
    # ALL users see pause immediately
```

---

### 🚨 **Multi-User Scenarios**

#### **Scenario 1: User A pauses, User B affected**
```
User A Dashboard:  [PAUSE] ← clicks pause
Backend:           controller.state = "PAUSED"  ← global change
User B Dashboard:  [PAUSED] ← automatically paused!
User C Dashboard:  [PAUSED] ← also paused!
```

#### **Scenario 2: User A switches to LIVE, User B confused**
```
User A: Switches to LIVE mode
Backend: MODE = "LIVE" (global)
User B: Still sees REPLAY UI, but gets LIVE data!
User C: Same confusion - UI/data mismatch
```

#### **Scenario 3: Speed changes affect everyone**
```
User A: Sets speed to 10x
Backend: controller.speed = 10
User B: Suddenly sees 10x speed (unexpected)
User C: Also affected by speed change
```

---

### 📋 **Current Architecture Problems**

#### **1. Global Replay Controller**
```python
controller = ReplayController()  # ❌ SINGLETON

# All endpoints modify the same instance
@app.post("/replay/pause")  # Affects ALL users
@app.post("/replay/speed/{value}")  # Affects ALL users
@app.post("/replay/stop")  # Affects ALL users
```

#### **2. Global Data Buffer**
```python
data_buffer: List[dict] = []  # ❌ SHARED BUFFER

# All WebSocket connections get same data
await websocket.send_json({
    "type": "history", 
    "data": data_buffer  # Same for everyone
})
```

#### **3. Global Mode State**
```python
MODE = "REPLAY"  # ❌ GLOBAL MODE

# When one user switches mode, affects data generation
if MODE == "LIVE":
    # All users get live data
elif MODE == "REPLAY":
    # All users get replay data
```

---

### 🏗️ **Architectural Solutions**

#### **Option 1: Session-Based Architecture** (Recommended)
```python
# Per-user session state
class UserSession:
    def __init__(self, user_id):
        self.user_id = user_id
        self.controller = ReplayController()  # ✅ Per-user
        self.data_buffer = []                 # ✅ Per-user
        self.mode = "REPLAY"                  # ✅ Per-user
        self.websocket = None

# Session manager
sessions = {}  # user_id -> UserSession

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    if user_id not in sessions:
        sessions[user_id] = UserSession(user_id)
    
    session = sessions[user_id]
    session.websocket = websocket
    
    # Send user-specific data
    await websocket.send_json({
        "type": "history",
        "data": session.data_buffer  # ✅ User-specific data
    })
```

#### **Option 2: Room-Based Architecture**
```python
# Multiple rooms for different use cases
class Room:
    def __init__(self, room_id):
        self.room_id = room_id
        self.controller = ReplayController()
        self.data_buffer = []
        self.connections = []
        self.mode = "REPLAY"

rooms = {
    "default": Room("default"),
    "live_btc": Room("live_btc"),
    "replay_demo": Room("replay_demo")
}

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    room = rooms.get(room_id, rooms["default"])
    # Room-specific controls
```

#### **Option 3: Hybrid Architecture** (Current + Improvements)
```python
# Keep global for default, add user overrides
class UserPreferences:
    def __init__(self):
        self.mode_override = None      # None = use global
        self.speed_override = None     # None = use global
        self.paused_override = None    # None = use global

user_prefs = {}  # websocket_id -> UserPreferences

# Modified broadcast logic
async def broadcast_with_user_context(message):
    for ws in manager.active_connections:
        user_pref = user_prefs.get(id(ws))
        if user_pref and user_pref.should_filter(message):
            continue  # Skip this user
        await ws.send_json(message)
```

---

### 🔧 **Immediate Fixes (Minimal Changes)**

#### **1. Add User Context to WebSocket**
```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, user_id: str = None):
    # Generate unique user ID if not provided
    if not user_id:
        user_id = str(uuid.uuid4())
    
    await manager.connect(websocket, user_id)
```

#### **2. Add Mode Isolation**
```python
# Track per-connection mode preferences
connection_modes = {}  # websocket_id -> mode

async def broadcast_filtered(message):
    for ws in manager.active_connections:
        ws_mode = connection_modes.get(id(ws), "REPLAY")
        if message.get("source_mode") == ws_mode:
            await ws.send_json(message)
```

#### **3. Add Replay Control Scoping**
```python
@app.post("/replay/pause/{user_id}")
def pause_replay_for_user(user_id: str):
    # Only pause for specific user's session
    if user_id in user_sessions:
        user_sessions[user_id].controller.pause()
```

---

### 📊 **Current vs Ideal Behavior**

| Action | Current Behavior | Ideal Behavior |
|--------|------------------|----------------|
| User A pauses | ALL users paused | Only User A paused |
| User B changes speed | ALL users affected | Only User B affected |
| User C switches to LIVE | Global mode change | Only User C sees LIVE |
| New user connects | Gets current global state | Gets default/own state |
| User D disconnects | No impact | Cleanup user session |

---

### 🚨 **Production Risks**

#### **High Risk Issues**:
1. **Unintended control sharing** - Users accidentally controlling others
2. **Data confusion** - Users seeing wrong mode data
3. **Performance impact** - All users affected by one user's actions
4. **Scalability problems** - Global state doesn't scale

#### **User Experience Issues**:
1. **Unexpected pauses** - User didn't click pause but sees pause
2. **Speed changes** - Sudden speed changes without user action
3. **Mode confusion** - UI shows REPLAY but data is LIVE
4. **Control conflicts** - Multiple users fighting over controls

---

### ✅ **Recommendations**

#### **Short Term** (Quick fixes):
1. **Add user session IDs** to WebSocket connections
2. **Filter broadcasts** based on user mode preferences  
3. **Add user context** to replay control endpoints
4. **Document multi-user limitations** clearly

#### **Long Term** (Proper solution):
1. **Implement session-based architecture** with per-user state
2. **Add room/workspace concept** for team collaboration
3. **Implement user authentication** and session management
4. **Add admin controls** for shared sessions when needed

#### **Immediate Action**:
```javascript
// Frontend: Add user ID to WebSocket connection
const userId = localStorage.getItem('userId') || generateUserId();
const ws = new WebSocket(`${BACKEND_WS}?user_id=${userId}`);
```

---

### 🏆 **Conclusion**

**Mode Switching Data Clearing**: ✅ **Working correctly** - Frontend properly clears data on mode switches.

**Multi-User Replay Controls**: ❌ **Critical issue** - Global state means one user's actions affect ALL users.

**Priority**: **HIGH** - This is a significant UX and scalability issue that should be addressed before production deployment with multiple users.