const fs = require('fs');
const path = require('path');

const contactsPath = path.join(__dirname, 'data', 'contacts.json');
const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));

console.log(`Total contacts: ${contacts.length}`);

// Remove duplicates by email + accountId
const seen = new Set();
const unique = contacts.filter(contact => {
  const key = `${contact.email.toLowerCase()}-${contact.accountId}`;
  if (seen.has(key)) {
    console.log(`Removing duplicate: ${contact.email}`);
    return false;
  }
  seen.add(key);
  return true;
});

console.log(`Unique contacts: ${unique.length}`);
console.log(`Removed: ${contacts.length - unique.length} duplicates`);

// Backup
fs.writeFileSync(contactsPath + '.backup', JSON.stringify(contacts, null, 2));
console.log('Backup created: contacts.json.backup');

// Save cleaned
fs.writeFileSync(contactsPath, JSON.stringify(unique, null, 2));
console.log('Cleaned contacts saved!');
