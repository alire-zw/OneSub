require('dotenv').config();
const path = require('path');

// Test if we can import samanDirect
console.log('Testing Saman Service import...\n');

try {
  const samanDirectPath = path.join(__dirname, '../../saman/samanDirect');
  console.log('Trying to import from:', samanDirectPath);
  
  const { checkDeposits, ensureValidSession } = require(samanDirectPath);
  console.log('✅ Successfully imported samanDirect');
  console.log('   Available functions:', Object.keys({ checkDeposits, ensureValidSession }));
  
  // Test environment variables
  console.log('\nChecking environment variables...');
  const username = process.env.SAMAN_USERNAME;
  const password = process.env.SAMAN_PASSWORD;
  
  if (username && password) {
    console.log('✅ SAMAN_USERNAME: Set');
    console.log('✅ SAMAN_PASSWORD: Set');
  } else {
    console.log('⚠️  SAMAN_USERNAME:', username ? 'Set' : 'Not set');
    console.log('⚠️  SAMAN_PASSWORD:', password ? 'Set' : 'Not set');
    console.log('\n⚠️  Please set SAMAN_USERNAME and SAMAN_PASSWORD in your .env file');
  }
  
  // Test service import
  console.log('\nTesting service import...');
  const samanService = require('../services/samanService');
  console.log('✅ Successfully imported samanService');
  console.log('   Available functions:', Object.keys(samanService));
  
  console.log('\n✅ All tests passed!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}

