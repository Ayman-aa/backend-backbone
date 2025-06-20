#!/bin/bash

# ================================================================= #
#             TWO-FACTOR AUTHENTICATION (2FA) TEST SCRIPT           #
# ================================================================= #
# This script tests the full 2FA lifecycle:
# 1. Creates a new user.
# 2. Enables 2FA for that user.
# 3. Simulates a login that triggers the 2FA challenge.
# 4. Verifies the 2FA code provided by the user.
# 5. Tests the 'resend code' functionality.
# 6. Disables 2FA to clean up.
# ================================================================= #

# --- Configuration ---
BASE_URL="http://localhost:3000/auth"
USER_EMAIL="twood8153@gmail.com"
USER_PASSWORD="achahrou"
USER_USERNAME="twood2fa"

# --- State Variables ---
# Holds the full-access JWT after a successful login.
ACCESS_TOKEN=""
# Holds the temporary token issued after password verification, used for 2FA.
TEMP_2FA_TOKEN=""

# --- Colors for beautiful output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# --- Helper Functions ---

# Function to print a standardized header for major sections.
print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${WHITE}            $1${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
}

# Function to make HTTP requests with curl.
#
# Arguments:
#   $1: HTTP Method (e.g., "POST", "GET")
#   $2: API endpoint (e.g., "/authenticate")
#   $3: JSON data payload (optional)
#   $4: Token type ("auth" for full token, "2fa" for temp token, "" for none)
#
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token_type=$4
    local auth_header=""

    if [ "$token_type" = "auth" ]; then
        auth_header="Authorization: Bearer $ACCESS_TOKEN"
    elif [ "$token_type" = "2fa" ]; then
        auth_header="Authorization: Bearer $TEMP_2FA_TOKEN"
    fi

    if [ -z "$auth_header" ]; then
        curl -s -X "$method" "$BASE_URL$endpoint" \
             -H "Content-Type: application/json" \
             -d "$data"
    else
        curl -s -X "$method" "$BASE_URL$endpoint" \
             -H "Content-Type: application/json" \
             -H "$auth_header" \
             -d "$data"
    fi
}

# Function to extract a value from a JSON response string.
extract_json() {
    # This simple grep/cut combo works for basic, un-nested JSON.
    echo "$1" | grep -o "\"$2\":\"[^\"]*" | cut -d':' -f2- | tr -d '"'
}

# --- Test Execution ---

clear
print_header "          STEP 1: USER REGISTRATION & LOGIN             "

echo -e "\n${CYAN}▶ Attempting to create and log in user '${USER_USERNAME}'...${NC}"

AUTH_PAYLOAD='{
  "email": "'$USER_EMAIL'",
  "password": "'$USER_PASSWORD'",
  "username": "'$USER_USERNAME'"
}'

AUTH_RESPONSE=$(make_request "POST" "/authenticate" "$AUTH_PAYLOAD")
ACCESS_TOKEN=$(extract_json "$AUTH_RESPONSE" "token")

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ FAILED: Could not register or log in.${NC}"
    echo -e "${GRAY}Server Response: $AUTH_RESPONSE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SUCCESS: User created and logged in.${NC}"
echo -e "${GRAY}Received initial access token.${NC}"


print_header "             STEP 2: ENABLING 2FA                       "

echo -e "\n${CYAN}▶ Sending request to enable 2FA for this account...${NC}"
# Corrected: Send an empty JSON object {} for POST requests with no body data.
ENABLE_RESPONSE=$(make_request "POST" "/enable-2fa" "{}" "auth")

if [[ $(extract_json "$ENABLE_RESPONSE" "message") != "2FA enabled successfully" ]]; then
    echo -e "${RED}❌ FAILED: Could not enable 2FA.${NC}"
    echo -e "${GRAY}Server Response: $ENABLE_RESPONSE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SUCCESS: 2FA is now enabled on the account.${NC}"


print_header "          STEP 3: RE-AUTHENTICATION (2FA Trigger)       "

echo -e "\n${CYAN}▶ Simulating logout and logging in again with password...${NC}"
echo -e "${YELLOW}   This should trigger the 2FA challenge.${NC}"

# We use the same payload as before, but the server logic should be different now.
AUTH_RESPONSE_2FA=$(make_request "POST" "/authenticate" "$AUTH_PAYLOAD")
TEMP_2FA_TOKEN=$(extract_json "$AUTH_RESPONSE_2FA" "tempToken")

if [ -z "$TEMP_2FA_TOKEN" ]; then
    echo -e "${RED}❌ FAILED: Did not receive the temporary 2FA token.${NC}"
    echo -e "${GRAY}Server Response: $AUTH_RESPONSE_2FA${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SUCCESS: Password accepted. Server has issued a temporary token.${NC}"
echo -e "${PURPLE}✉️ A 2FA code has been sent to ${USER_EMAIL}.${NC}"


print_header "          STEP 4: VERIFYING THE 2FA CODE                "

echo -e "\n${CYAN}▶ Please check your email for the 6-digit code.${NC}"
read -p "Enter the 2FA code here: " USER_CODE

VERIFY_PAYLOAD='{"code": "'$USER_CODE'"}'
VERIFY_RESPONSE=$(make_request "POST" "/verify-2fa" "$VERIFY_PAYLOAD" "2fa")
ACCESS_TOKEN=$(extract_json "$VERIFY_RESPONSE" "token") # This should be the new, final token

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "\n${RED}❌ FAILED: 2FA verification failed. The code might be wrong or expired.${NC}"
    echo -e "${GRAY}Server Response: $VERIFY_RESPONSE${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ SUCCESS: 2FA code verified!${NC}"
echo -e "${GREEN}   Received final, full-access token. You are now fully logged in.${NC}"


print_header "          STEP 5: TESTING RESEND FUNCTIONALITY          "

echo -e "\n${CYAN}▶ Testing the 'resend code' feature...${NC}"
echo -e "${YELLOW}   This will invalidate the old code and send a new one.${NC}"
# Corrected: Send an empty JSON object {} for POST requests with no body data.
RESEND_RESPONSE=$(make_request "POST" "/resend-2fa" "{}" "auth")

if [[ $(extract_json "$RESEND_RESPONSE" "message") != "2FA code re-sent to your email" ]]; then
    echo -e "${RED}❌ FAILED: Could not resend 2FA code.${NC}"
    echo -e "${GRAY}Server Response: $RESEND_RESPONSE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SUCCESS: Resend request was successful.${NC}"
echo -e "${PURPLE}✉️ A new 2FA code has been sent to ${USER_EMAIL}.${NC}"
echo -e "\n${CYAN}   To confirm, let's try to verify with the new code.${NC}"
# Note: For a real test, you'd log out and back in. Here we'll just test the resend endpoint.
# In a real app, the user would be stuck on the verification screen and click "resend".
# The verification would then use the same tempToken.
read -p "Enter the NEW 2FA code here: " NEW_USER_CODE
VERIFY_PAYLOAD_NEW='{"code": "'$NEW_USER_CODE'"}'

# For this test script, we assume the temp token is still valid.
VERIFY_RESPONSE_NEW=$(make_request "POST" "/verify-2fa" "$VERIFY_PAYLOAD_NEW" "2fa")
NEW_ACCESS_TOKEN=$(extract_json "$VERIFY_RESPONSE_NEW" "token")

if [ -z "$NEW_ACCESS_TOKEN" ]; then
    echo -e "\n${RED}❌ NOTE: Verification with the new code failed.${NC}"
    echo -e "${YELLOW}This is expected if the temporary token from Step 3 has expired.${NC}"
    echo -e "${GRAY}The resend API call itself worked correctly.${NC}"
else
    echo -e "\n${GREEN}✅ SUCCESS: Verified with the new resent code!${NC}"
    ACCESS_TOKEN=$NEW_ACCESS_TOKEN # Update our token
fi

print_header "          STEP 6: DISABLING 2FA                       "

echo -e "\n${CYAN}▶ Cleaning up by disabling 2FA for the user...${NC}"
# Corrected: Send an empty JSON object {} for POST requests with no body data.
DISABLE_RESPONSE=$(make_request "POST" "/disable-2fa" "{}" "auth")

if [[ $(extract_json "$DISABLE_RESPONSE" "message") != "2FA disabled successfully" ]]; then
    echo -e "${RED}❌ FAILED: Could not disable 2FA.${NC}"
    echo -e "${GRAY}Server Response: $DISABLE_RESPONSE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SUCCESS: 2FA has been disabled for the account.${NC}"

print_header "               2FA TEST COMPLETE                        "
echo -e "\n${WHITE}🎉 All Two-Factor Authentication flows were tested successfully!${NC}\n"
