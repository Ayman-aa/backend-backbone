const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Test user credentials (replace with actual test users)
const USER1 = {
  email: 'user1@test.com',
  password: 'password123'
};

const USER2 = {
  email: 'user2@test.com', 
  password: 'password123'
};

let user1Token = '';
let user2Token = '';
let user1Id = 0;
let user2Id = 0;

async function authenticate(email, password) {
  try {
    const response = await fetch(`${BASE_URL}/auth/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (response.ok) {
      return { token: data.access_token, userId: data.user.id };
    } else {
      throw new Error(`Auth failed: ${data.error}`);
    }
  } catch (error) {
    console.error('Authentication error:', error.message);
    throw error;
  }
}

async function makeRequest(endpoint, method = 'GET', body = null, token = '') {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      ...(body && { body: JSON.stringify(body) })
    };

    console.log(`\n🔄 ${method} ${endpoint}`);
    if (body) console.log('📤 Body:', JSON.stringify(body, null, 2));

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log('📥 Response:', JSON.stringify(data, null, 2));
    
    return { response, data };
  } catch (error) {
    console.error('Request error:', error.message);
    throw error;
  }
}

async function testBlockingWorkflow() {
  console.log('🚀 Starting Blocking Debug Test');
  console.log('================================');

  try {
    // Step 1: Authenticate both users
    console.log('\n1️⃣ Authenticating users...');
    const auth1 = await authenticate(USER1.email, USER1.password);
    const auth2 = await authenticate(USER2.email, USER2.password);
    
    user1Token = auth1.token;
    user2Token = auth2.token;
    user1Id = auth1.userId;
    user2Id = auth2.userId;
    
    console.log(`✅ User 1 authenticated: ID ${user1Id}`);
    console.log(`✅ User 2 authenticated: ID ${user2Id}`);

    // Step 2: Check initial blocking status
    console.log('\n2️⃣ Checking initial blocking status...');
    await makeRequest(`/blocks/check/${user2Id}`, 'GET', null, user1Token);
    await makeRequest(`/blocks/list`, 'GET', null, user1Token);

    // Step 3: Block user 2 from user 1
    console.log('\n3️⃣ User 1 blocking User 2...');
    await makeRequest('/blocks/block', 'POST', { userId: user2Id }, user1Token);

    // Step 4: Verify blocking status
    console.log('\n4️⃣ Verifying blocking status...');
    await makeRequest(`/blocks/check/${user2Id}`, 'GET', null, user1Token);
    await makeRequest(`/blocks/list`, 'GET', null, user1Token);

    // Step 5: Check friends list
    console.log('\n5️⃣ Checking friends list...');
    await makeRequest('/friends/list', 'GET', null, user1Token);

    // Step 6: Try to send message (should fail)
    console.log('\n6️⃣ Trying to send message (should fail)...');
    await makeRequest('/chats/send', 'POST', { 
      toUserId: user2Id, 
      content: 'This should fail' 
    }, user1Token);

    // Step 7: Unblock user
    console.log('\n7️⃣ Unblocking user...');
    await makeRequest('/blocks/unblock', 'POST', { userId: user2Id }, user1Token);

    // Step 8: Verify unblocking
    console.log('\n8️⃣ Verifying unblocking...');
    await makeRequest(`/blocks/check/${user2Id}`, 'GET', null, user1Token);
    await makeRequest(`/blocks/list`, 'GET', null, user1Token);

    // Step 9: Try to send message again (should work)
    console.log('\n9️⃣ Trying to send message again (should work)...');
    await makeRequest('/chats/send', 'POST', { 
      toUserId: user2Id, 
      content: 'This should work now' 
    }, user1Token);

    console.log('\n✅ Blocking test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    await testBlockingWorkflow();
  } catch (error) {
    console.error('❌ Debug script failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testBlockingWorkflow };