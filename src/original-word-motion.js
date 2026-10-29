// Verbatim supplied prototype functions. Do not format or edit the block.
export function createOriginalWordMotion({ $, current }) {
// BEGIN ORIGINAL
let motionLayer=null,motionAnimations=[],motionCleanup=null;
function stopWordMotion(){
 clearTimeout(motionCleanup);motionCleanup=null;
 for(const animation of motionAnimations)animation.cancel();motionAnimations=[];
 motionLayer?.remove();motionLayer=null;
}
function captureWordMotion(kind){
 stopWordMotion();
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
 const stage=$('word-stage'),rect=stage.getBoundingClientRect(),word=stage.querySelector('.word,.spell-answer:not([hidden]),.spelling-prompt');
 if(!word||!rect.width||!rect.height)return null;
 const clone=stage.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
 clone.querySelectorAll('input').forEach(input=>{input.tabIndex=-1;});
 clone.style.cssText='position:fixed;left:'+rect.left+'px;top:'+rect.top+'px;width:'+rect.width+'px;height:'+rect.height+'px;min-height:0;margin:0;padding:0;pointer-events:none;';
 return {kind,clone,rect,word:word.getBoundingClientRect()};
}
function motionAnimate(element,frames,options){const animation=element.animate(frames,{fill:'both',...options});motionAnimations.push(animation);return animation;}
function playWordMotion(capture){
 if(!capture)return;
 const {kind,clone,rect,word}=capture,stage=current()?$('word-stage'):$('summary-view');
 const layer=document.createElement('div');layer.className='word-motion-layer';layer.setAttribute('aria-hidden','true');layer.inert=true;document.body.append(layer);motionLayer=layer;
 const ease='cubic-bezier(.16,1,.3,1)';
 if(kind!=='kill'){
  layer.append(clone);const distance=Math.min(innerWidth*.7,900);
  motionAnimate(clone,[{transform:'translateX(0)',opacity:1},{transform:'translateX(-'+distance+'px)',opacity:0}],{duration:170,easing:'cubic-bezier(.3,.6,.45,1)'});
  motionAnimate(stage,[{transform:'translateX('+Math.min(distance*.35,280)+'px)',opacity:0},{transform:'translateX(0)',opacity:1}],{duration:230,delay:85,easing:ease});
  motionCleanup=setTimeout(stopWordMotion,350);return;
 }
 const split=word.top-rect.top+word.height*.55,slant=rect.width*.08;
 const upper=clone,lower=clone.cloneNode(true);
 upper.style.clipPath='polygon(0 0,100% 0,100% '+(split-slant)+'px,0 '+(split+slant)+'px)';
 lower.style.clipPath='polygon(0 '+(split+slant)+'px,100% '+(split-slant)+'px,100% 100%,0 100%)';
 layer.append(upper,lower);
 motionAnimate(upper,[{transform:'translate(0,0) rotate(0)',opacity:1,offset:0},{transform:'translate(-3px,-2px) rotate(-.3deg)',opacity:1,offset:.14},{transform:'translate(-180px,-110px) rotate(-9deg)',opacity:0,filter:'blur(2px)',offset:1}],{duration:430,easing:'cubic-bezier(.32,0,.18,1)'});
 motionAnimate(lower,[{transform:'translate(0,0) rotate(0)',opacity:1,offset:0},{transform:'translate(4px,3px) rotate(.4deg)',opacity:1,offset:.14},{transform:'translate(200px,120px) rotate(8deg)',opacity:0,filter:'blur(3px)',offset:1}],{duration:470,easing:'cubic-bezier(.32,0,.18,1)'});
 const slash=document.createElement('i');slash.className='word-slash';
 slash.style.cssText='left:'+(word.left-65)+'px;top:'+(word.top+word.height*.55)+'px;width:'+(word.width+130)+'px;';layer.append(slash);
 motionAnimate(slash,[{transform:'rotate(-9deg) scaleX(0)',opacity:0,offset:0},{transform:'rotate(-9deg) scaleX(1.03)',opacity:1,offset:.22},{transform:'rotate(-9deg) scaleX(1.12)',opacity:0,offset:1}],{duration:230,easing:'cubic-bezier(.2,.8,.2,1)'});
 for(let i=0;i<16;i++){
  const fragment=document.createElement('i');fragment.className='word-fragment';
  const along=(i/15-.5)*word.width*.88,originX=word.left+word.width*.5+along,originY=word.top+word.height*.55-along*.16;
  fragment.style.cssText='left:'+originX+'px;top:'+originY+'px;width:'+(i%3===0?3:2)+'px;height:'+(i%3===0?16:7)+'px;';layer.append(fragment);
  const direction=i%2===0?-1:1,dx=direction*(35+(i%5)*24),dy=direction*(28+(i%4)*22),rotation=direction*(35+i*19);
  motionAnimate(fragment,[{transform:'translate(0,0) rotate(-9deg) scaleY(.3)',opacity:0,offset:0},{transform:'translate('+dx*.1+'px,'+dy*.1+'px) rotate(-9deg)',opacity:.8,offset:.15},{transform:'translate('+dx+'px,'+dy+'px) rotate('+rotation+'deg) scale(.3)',opacity:0,offset:1}],{duration:320+(i%4)*35,delay:40,easing:'cubic-bezier(.2,.7,.3,1)'});
 }
 motionAnimate(layer,[{transform:'translate(0,0)'},{transform:'translate(-4px,2px)'},{transform:'translate(3px,-1px)'},{transform:'translate(-1px,0)'},{transform:'translate(0,0)'}],{duration:140,delay:45,easing:'ease-out'});
 motionAnimate(stage,[{transform:'translateY(18px) scale(.975)',opacity:0,filter:'blur(3px)'},{transform:'translateY(0) scale(1)',opacity:1,filter:'blur(0)'}],{duration:300,delay:145,easing:ease});
 motionCleanup=setTimeout(stopWordMotion,550);
}
// END ORIGINAL
return {stop:stopWordMotion,capture:captureWordMotion,play:playWordMotion};
}
