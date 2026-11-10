'use strict';
// Timing 2.2.0 activation candidate, following joint Windows qualification.
// Never derive this from settings, IPC, environment or a host announcement.
// Coordinated rollout: docs/PADDOCK-COORDINATED-ACTIVATION.md.
const VERIFIED = true;
function assertEnabled(){if(!VERIFIED)throw Object.assign(Error('Rich-history delivery is disabled pending joint Paddock verification. The saved result is retained.'),{code:'HISTORY_REVIEW_REQUIRED'});}
module.exports=Object.freeze({enabled:()=>VERIFIED,assertEnabled});
