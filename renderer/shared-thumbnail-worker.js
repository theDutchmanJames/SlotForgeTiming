'use strict';
self.onmessage=async({data})=>{
 let image;
 try{
  image=await createImageBitmap(await (await fetch(data.source)).blob());
  const scale=Math.min(1,512/Math.max(image.width,image.height));
  const canvas=new OffscreenCanvas(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const result=new FileReaderSync().readAsDataURL(await canvas.convertToBlob({type:'image/png'}));
  self.postMessage({id:data.id,result});
 }catch{self.postMessage({id:data.id,result:null});}finally{image?.close();}
};
