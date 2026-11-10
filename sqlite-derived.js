'use strict';
// Only disposable projections use this check. Never infer that authoritative
// records, command receipts or identity metadata may be recreated when absent.
function tables(s,names){return names.every(name=>!!s.statement("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));}
module.exports={tables};
