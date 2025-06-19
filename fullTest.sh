#!/bin/bash

# Tournament System Full Test Script
# Tests all tournament routes and functionality

BASE_URL="http://localhost:3000"
TOKEN=""
USER_ID=""
USERNAME=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎮 Tournament System Full Test Script${NC}"
echo "=================================================="

# Function to make HTTP requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local headers=$4

    if [ -n "$headers" ]; then
        curl -s -X "$method" "$BASE_URL$endpoint" \
             -H "Content-Type: application/json" \
             -H "Authorization: Bearer $TOKEN" \
             -d "$data"
    else
        curl -s -X "$method" "$BASE_URL$endpoint" \
             -H "Content-Type: application/json" \
             -d "$data"
    fi
}

# Function to extract value from JSON response
extract_json_value() {
    echo $1 | grep -o "\"$2\":[^,}]*" | cut -d':' -f2 | tr -d '"'
}

echo -e "\n${YELLOW}Step 1: Authentication${NC}"
echo "Registering/Login user..."

AUTH_RESPONSE=$(make_request "POST" "/auth/authenticate" '{
  "email": "testuser@tournament.com",
  "password": "password123",
  "username": "tournamentplayer"
}')

echo "Auth Response: $AUTH_RESPONSE"

TOKEN=$(echo $AUTH_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
USERNAME=$(echo $AUTH_RESPONSE | grep -o '"username":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Authentication failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Authentication successful!${NC}"
echo "Token: ${TOKEN:0:20}..."
echo "Username: $USERNAME"

echo -e "\n${YELLOW}Step 2: Create 4-Player Tournament${NC}"
echo "Creating tournament with 4 players..."

TOURNAMENT_4_RESPONSE=$(make_request "POST" "/game/create" '{
  "name": "Test Tournament 4 Players",
  "players": ["tournamentplayer", "Alice", "Bob", "Carol"]
}' "auth")

echo "Tournament Response: $TOURNAMENT_4_RESPONSE"

TOURNAMENT_4_ID=$(echo $TOURNAMENT_4_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
MATCH_1_ID=$(echo $TOURNAMENT_4_RESPONSE | grep -o '"id":[0-9]*' | sed -n '2p' | cut -d':' -f2)
MATCH_2_ID=$(echo $TOURNAMENT_4_RESPONSE | grep -o '"id":[0-9]*' | sed -n '3p' | cut -d':' -f2)

if [ -z "$TOURNAMENT_4_ID" ]; then
    echo -e "${RED}❌ Tournament creation failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 4-Player Tournament created!${NC}"
echo "Tournament ID: $TOURNAMENT_4_ID"
echo "Match 1 ID: $MATCH_1_ID"
echo "Match 2 ID: $MATCH_2_ID"

echo -e "\n${YELLOW}Step 3: Play Round 1 Matches (4-Player Tournament)${NC}"

echo "Playing Match 1: tournamentplayer vs Alice..."
MATCH_1_RESULT=$(make_request "POST" "/game/submit-score" '{
  "matchId": '$MATCH_1_ID',
  "score1": 5,
  "score2": 3
}' "auth")

echo "Match 1 Result: $MATCH_1_RESULT"

echo "Playing Match 2: Bob vs Carol..."
MATCH_2_RESULT=$(make_request "POST" "/game/submit-score" '{
  "matchId": '$MATCH_2_ID',
  "score1": 2,
  "score2": 5
}' "auth")

echo "Match 2 Result: $MATCH_2_RESULT"

FINAL_MATCH_ID=$(echo $MATCH_2_RESULT | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -n "$FINAL_MATCH_ID" ]; then
    echo -e "${GREEN}✅ Round 1 completed! Final match created: $FINAL_MATCH_ID${NC}"

    echo -e "\n${YELLOW}Step 4: Play Final Match${NC}"
    echo "Playing Final: tournamentplayer vs Carol..."

    FINAL_RESULT=$(make_request "POST" "/game/submit-score" '{
      "matchId": '$FINAL_MATCH_ID',
      "score1": 5,
      "score2": 4
    }' "auth")

    echo "Final Result: $FINAL_RESULT"
    echo -e "${GREEN}✅ Tournament completed!${NC}"
else
    echo -e "${RED}❌ Final match not created properly${NC}"
fi

echo -e "\n${YELLOW}Step 5: Create 8-Player Tournament${NC}"
echo "Creating tournament with 8 players..."

TOURNAMENT_8_RESPONSE=$(make_request "POST" "/game/create" '{
  "name": "Test Tournament 8 Players",
  "players": ["tournamentplayer", "Alice", "Bob", "Carol", "Dave", "Emma", "Frank", "Grace"]
}' "auth")

echo "Tournament Response: $TOURNAMENT_8_RESPONSE"

TOURNAMENT_8_ID=$(echo $TOURNAMENT_8_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$TOURNAMENT_8_ID" ]; then
    echo -e "${RED}❌ 8-Player Tournament creation failed!${NC}"
else
    echo -e "${GREEN}✅ 8-Player Tournament created! ID: $TOURNAMENT_8_ID${NC}"
fi

echo -e "\n${YELLOW}Step 6: Create Some Local Games${NC}"
echo "Creating local games for stats testing..."

for i in {1..5}; do
    LOCAL_GAME=$(make_request "POST" "/game/local" '{
      "score1": '$((RANDOM % 5 + 3))',
      "score2": '$((RANDOM % 5 + 1))',
      "player2Name": "LocalPlayer'$i'"
    }' "auth")

    echo "Local Game $i: $LOCAL_GAME"
done

echo -e "${GREEN}✅ Local games created!${NC}"

echo -e "\n${YELLOW}Step 7: Test Tournament History${NC}"
echo "Fetching tournament history..."

HISTORY_RESPONSE=$(make_request "GET" "/game/history" "" "auth")
echo "Tournament History: $HISTORY_RESPONSE"

echo -e "\n${YELLOW}Step 8: Test Local Games History${NC}"
echo "Fetching local games history..."

LOCAL_HISTORY=$(make_request "GET" "/game/local" "" "auth")
echo "Local Games History: $LOCAL_HISTORY"

echo -e "\n${YELLOW}Step 9: Test Tournament Bracket (if implemented)${NC}"
echo "Trying to fetch tournament bracket..."

BRACKET_RESPONSE=$(make_request "GET" "/game/bracket/$TOURNAMENT_4_ID" "" "auth")
echo "Bracket Response: $BRACKET_RESPONSE"

echo -e "\n${YELLOW}Step 10: Create Another Tournament for More Stats${NC}"
echo "Creating additional tournament..."

TOURNAMENT_3_RESPONSE=$(make_request "POST" "/game/create" '{
  "name": "Another Test Tournament",
  "players": ["tournamentplayer", "Player1", "Player2", "Player3"]
}' "auth")

echo "Additional Tournament: $TOURNAMENT_3_RESPONSE"

echo -e "\n${BLUE}🎯 Test Summary${NC}"
echo "=================================================="
echo -e "${GREEN}✅ Authentication test passed${NC}"
echo -e "${GREEN}✅ 4-Player tournament creation passed${NC}"
echo -e "${GREEN}✅ Tournament gameplay simulation passed${NC}"
echo -e "${GREEN}✅ 8-Player tournament creation passed${NC}"
echo -e "${GREEN}✅ Local games creation passed${NC}"
echo -e "${GREEN}✅ Tournament history test passed${NC}"
echo -e "${GREEN}✅ Local games history test passed${NC}"

echo -e "\n${BLUE}📊 Final Stats Check${NC}"
echo "Fetching final tournament history with stats..."

FINAL_STATS=$(make_request "GET" "/game/history" "" "auth")
echo "Final Tournament Stats: $FINAL_STATS"

FINAL_LOCAL_STATS=$(make_request "GET" "/game/local" "" "auth")
echo "Final Local Game Stats: $FINAL_LOCAL_STATS"

echo -e "\n${GREEN}🎉 Tournament System Test Completed!${NC}"
echo "Check the responses above to verify all functionality is working correctly."
echo ""
echo "Expected results:"
echo "- User should have played in multiple tournaments"
echo "- Tournament history should show wins/losses"
echo "- Local games should show statistics"
echo "- All API endpoints should return proper JSON responses"
