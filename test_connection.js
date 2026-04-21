/**
 * Quick connection test for RoomService
 */

const { RoomServiceClient } = require('./dist/index.js');

async function testConnection() {
  console.log('Testing RoomService connection...\n');

  // Test with localhost
  const client = new RoomServiceClient({
    host: 'localhost:50050',
    apiKey: '123'
  });

  console.log('✅ Client created successfully');
  console.log('   Host: localhost:50050');
  console.log('   API Key: 123');

  try {
    // Try to create a room
    console.log('\nAttempting to create a test room...');
    const roomId = await client.createRoom({
      game_type: 'test',
      max_users: '2'
    });

    console.log('✅ Room created successfully!');
    console.log('   Room ID:', roomId);

    // Try to get room list
    console.log('\nAttempting to get room list...');
    const rooms = await client.listRooms();
    console.log('✅ Room list retrieved successfully!');
    console.log('   Total rooms:', rooms.length);

    console.log('\n🎉 Connection test PASSED! RoomService is working correctly.');

    // Clean up
    await client.close();
    console.log('✅ Connection closed');

  } catch (error) {
    console.log('\n❌ Connection test FAILED!');
    console.log('   Error:', error.message);
    console.log('   Code:', error.code || 'Unknown');

    if (error.code === 14) {
      console.log('\n💡 Solution: Make sure RoomService backend is running');
      console.log('   Run: cd /path/to/RoomService && task up');
    } else if (error.code === 2 || error.message.includes('unknown service')) {
      console.log('\n💡 Solution: Check if RoomService is the correct version');
      console.log('   The proto definitions may be out of sync');
    }

    await client.close();
    process.exit(1);
  }
}

testConnection().catch(console.error);