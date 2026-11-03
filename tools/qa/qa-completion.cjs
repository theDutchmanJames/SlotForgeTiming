'use strict';
const fs=require('node:fs');
function preventRelaunch(app){app.relaunch=()=>{throw Error('Unexpected app relaunch in a single-process QA run. Use an explicitly staged restart test.');};}
function verify(file,runId,status){
 if(status!==0)throw Error('QA process did not exit successfully.');
 let result;try{result=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error('QA exited without a completed test result.');}
 if(!runId||result.runId!==runId||result.passed!==true)throw Error('QA completion is missing or belongs to another run.');
 return result;
}
function complete(){
 if(!process.env.SF_UI_QA_RUN_ID||!process.env.SF_UI_QA_COMPLETION)throw Error('Run this UI check through its qualification launcher.');
 fs.writeFileSync(process.env.SF_UI_QA_COMPLETION,JSON.stringify({runId:process.env.SF_UI_QA_RUN_ID,passed:true}));
}
module.exports={preventRelaunch,verify,complete};
