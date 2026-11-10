'use strict';
// Resolve revisions only on the first execution, inside the receipt transaction.
// A retry is checked against its original request before reaching this function.
const Records=require('./sqlite-records');
function apply(s,{scope,operation,args}) {
  require('./sqlite-editor-generation').check(s,scope);
  if(!Array.isArray(args))throw Error('Invalid editor save arguments.');
  const [entity,id,value]=args, expectedRevision=['update','remove'].includes(operation)?s.revision(entity,id):undefined;
  const command=(name,input)=>Records.commands[name](s,input);
  switch(operation){
    case 'add': return command('addRecord',{entity,item:id});
    case 'update':
      if(entity==='sessions'){
        if(!value||Object.keys(value).length!==1||!Object.hasOwn(value,'champ'))throw Error('Only championship awards may be edited on a saved session.');
        command('setChampionshipAwards',{edits:[{sessionId:id,champ:value.champ,expectedRevision}]});
        return {recordId:id};
      }
      if(entity==='laps'){s.lapEligibility({lapId:id,flags:value,expectedRevision});return {recordId:id};}
      return command('updateRecord',{entity,recordId:id,patch:value,expectedRevision});
    case 'remove':
      if(!s.get(entity,id))return {removed:true};
      command('removeRecord',{entity,recordId:id,expectedRevision});return {removed:true};
    case 'addCustomField': return command('addCustomDefinition',{entity,field:id,expectedRevision:s.revision('@meta','customFields')});
    case 'setCustomFieldGroup': return command('setCustomGroup',{entity,fieldId:id,group:value,expectedRevision:s.revision('@meta','customFields')});
    case 'removeCustomField': command('removeCustomDefinition',{entity,fieldId:id,expectedRevision:s.revision('@meta','customFields')});return {removed:true};
    default: throw Error('Unsupported editor save.');
  }
}
module.exports={apply};
