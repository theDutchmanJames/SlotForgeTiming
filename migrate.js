// The app was called Slot Lap Timer before: its data lived in the folder "slot-lap-timer".
// On the first start under the new name the data is COPIED to the new folder (the old folder stays as it was, as a safety copy).
const fs = require('fs'), path = require('path');
const OLD = 'slot-lap-timer', NEW = 'slotforge-timing'; // each name is both the data folder and the start of the file names in it

// Returns true when something was copied.
function migrate(appData, {strict=false}={}) {
  try {
    const from = path.join(appData, OLD), to = path.join(appData, NEW);
    if (!fs.existsSync(path.join(from, OLD + '.json'))) return false;
    if (fs.existsSync(path.join(to, NEW + '.json'))) return false;
    fs.mkdirSync(to, { recursive: true });
    // Publish the main database last; a failed sidecar copy must not look like a completed migration.
    const files=fs.readdirSync(from).sort((a,b)=>Number(a===OLD+'.json')-Number(b===OLD+'.json'));
    for (const f of files) {
      if (!f.startsWith(OLD) || !f.endsWith('.json')) continue;
      const target=path.join(to, NEW + f.slice(OLD.length));
      if(fs.existsSync(target))continue;
      const temporary=target+'.migration-pending';
      fs.copyFileSync(path.join(from, f), temporary);
      fs.renameSync(temporary,target);
    }
    return true;
  } catch(error) { if(strict)throw new Error('Legacy database migration could not finish. Your old database is retained. '+error.message);return false; }
}

module.exports = { migrate };
