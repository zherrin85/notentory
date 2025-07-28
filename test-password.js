const bcrypt = require('bcrypt');

async function testPassword() {
    const password = 'admin123';
    const hash = '$2b$10$OxeUDmh/yljruNCgcms6q.ERNgTmA537g33zYPK2nB9378RLiDCeC';
    
    console.log('Testing password:', password);
    console.log('Hash:', hash);
    
    const isValid = await bcrypt.compare(password, hash);
    console.log('Password valid:', isValid);
    
    // Also test creating a new hash
    const newHash = await bcrypt.hash(password, 10);
    console.log('New hash for admin123:', newHash);
}

testPassword().catch(console.error); 