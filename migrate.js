// The app was called Slot Lap Timer before: its data lived in the folder "slot-lap-timer".
// On the first start under the new name the data is COPIED to the new folder (the old folder stays as it was, as a safety copy).
const fs = require('fs'), path = require('path');
const OLD = 'slot-lap-timer', NEW = 'slotforge-timing'; // each name is both the data folder and the start of the file names in it

// Returns true when something was copied.
function migrate(appData) {
  try {
    const from = path.join(appData, OLD), to = path.join(appData, NEW);
    if (!fs.existsSync(path.join(from, OLD + '.json'))) return false;
    if (fs.existsSync(path.join(to, NEW + '.json'))) return false;
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) {
      if (!f.startsWith(OLD) || !f.endsWith('.json')) continue;
      fs.copyFileSync(path.join(from, f), path.join(to, NEW + f.slice(OLD.length)));
    }
    return true;
  } catch { return false; }
}

module.exports = { migrate };
