// The frame of a widget on the timing page: its background and its border.
//  - Border: the theme's own line (the default), none at all, a shade made from the widget's background colour, or a colour of your own (1.46.0).
//    The shade slider runs from 0 (white) over 50 (the background colour itself) to 100 (black), in steps of 0.5.
//  - Border thickness (1.46.0): 0 to 40 layout units (a layout is 1000 units wide), in steps of 0.5, so it grows and shrinks with the page like the text does.
//    Empty is the standard thin line (1 px). It counts for every kind of border, a colour of your own or the theme's.
//  - Transparency (0 = solid, 100 = invisible) fades the background and the border together. The title and the value are not touched.
//    The layout has one setting for all its widgets; a widget can have its own, which wins.
//  - Corners: a layout-wide radius with an override per widget.
// Pure functions that make CSS text, so they can be tested without a screen. The colours are mixed by the browser (color-mix),
// which means a background that is a theme colour (var(--panel)) works too.
(function (root) {
  const safe = v => { const t = String(v ?? '').trim(); return /^[#\w\s.,%()/-]{1,60}$/.test(t) && !/url|expression|import|@/i.test(t) ? t : ''; };
  const number = (v, lo, hi, fallback, step) => {
    const n = typeof v === 'string' && !v.trim() ? NaN : Number(v);
    if (!((typeof v === 'number' || typeof v === 'string') && Number.isFinite(n))) return fallback;
    return Math.round(Math.min(hi, Math.max(lo, n)) / step) * step;
  };

  const MODES = ['', 'shade', 'custom', 'off']; // '' = the theme's own border
  const DEFAULT_SHADE = 37.5; // a quarter white: halfway between the middle (50) and white (0)
  const mode = w => (MODES.includes(w.borderMode) ? w.borderMode : '');
  // a colour of your own: '#rgb' or '#rrggbb' (kept as '#rrggbb'); anything else is the start colour, a quiet grey that shows on a dark and on a light page
  const COLOR_START = '#8f98a3', PAGE_UNITS = 1000;
  const hex = v => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v ?? '').trim()); if (!m) return ''; const h = m[1].toLowerCase(); return '#' + (h.length === 3 ? [...h].map(c => c + c).join('') : h); };
  const colorOf = w => hex(w.borderColor) || COLOR_START;
  // the thickness in layout units, 0 to 40 in half steps; null = nothing set (the standard thin line)
  const widthOf = w => number(w.borderWidth, 0, 40, null, 0.5);
  const shade = w => number(w.borderShade, 0, 100, DEFAULT_SHADE, 0.5);
  // Transparency: the widget's own setting if it has one (also 0, which is solid), otherwise the layout's (widgetTransparency), otherwise solid.
  const ownTransparency = w => number(w.transparency, 0, 100, null, 1); // null = follows the layout
  const layoutTransparency = l => number(l && l.widgetTransparency, 0, 100, 0, 1);
  const transparency = (w, layout) => { const o = ownTransparency(w); return o !== null ? o : layoutTransparency(layout); };

  const pct = n => String(Math.round(n * 10) / 10);
  // the border colour that goes with a background: white (0) ... the background (50) ... black (100)
  const shadeOf = (bg, s) => (s === 50 ? bg : `color-mix(in srgb, ${s < 50 ? 'white' : 'black'} ${pct(Math.abs(50 - s) * 2)}%, ${bg})`);
  const fade = (c, t) => (t ? `color-mix(in srgb, ${c} ${100 - t}%, transparent)` : c);

  // What to set on a widget: { background, borderColor, backgroundClip }. An empty text leaves the style sheet in charge,
  // so a widget that never used these settings looks exactly as before.
  // bg: the colour of the background; classic: the colour of the theme's border.
  // U: the width of the page in layout units (1000), which the thickness of the border is a share of (in cqw, like the corners)
  const widthCss = (w, U) => { const t = widthOf(w); return t === null ? '' : `${Math.round(t / (U > 0 ? U : PAGE_UNITS) * 100000) / 1000}cqw`; }; // (three decimals: a half unit on a page of 1000 is 0.05cqw)
  const style = (bgColor, w, classic, layout, U) => {
    if (modern(w, layout)) return modernStyle(bgColor, w, classic, layout, U);
    const bg = safe(bgColor) || 'var(--panel)', m = mode(w), t = transparency(w, layout), bw = widthCss(w, U);
    if (!m && !t) return { background: bg, borderColor: '', backgroundClip: '', borderWidth: bw };
    const line = m === 'off' ? 'transparent' : fade(m === 'shade' ? shadeOf(bg, shade(w)) : m === 'custom' ? colorOf(w) : safe(classic) || 'var(--line)', t);
    return { background: fade(bg, t), borderColor: line, backgroundClip: 'padding-box', borderWidth: bw };
  };
  const css = (bgColor, w, classic, layout, U) => { const s = style(bgColor, w, classic, layout, U); return `background:${s.background}${s.borderColor ? `;border-color:${s.borderColor};background-clip:${s.backgroundClip}` : ''}${s.borderWidth ? `;border-width:${s.borderWidth}` : ''}`; };
  // How solid a widget is, 0 to 1 (the depth of the page, see styles.css, fades with the background so a see-through widget stays flat)
  const solidity = (w, layout) => modern(w, layout) ? (appearance(w, layout).fill === 'none' ? 0 : appearance(w, layout).surfaceOpacity / 100) : Math.round((100 - transparency(w, layout)) * 10) / 1000;

  // Lane colour is a visual treatment, independent of a widget's status/flash colours.
  // Missing settings preserve the original full-background look. Empty on a widget follows its layout.
  // "side" remains the stored value for the original left-hand treatment, so older
  // layouts keep their exact appearance.  The labels make its direction explicit.
  const LANE_STYLES = [['full', 'Full Widget'], ['top', 'Top Stripe'], ['side', 'Left Stripe'], ['right', 'Right Stripe']];
  const ownLaneStyle = w => [...LANE_STYLES.map(x => x[0]), 'none'].includes(w && w.laneColorStyle) ? w.laneColorStyle : '';
  const layoutLaneStyle = layout => LANE_STYLES.some(x => x[0] === (layout && layout.laneColorStyle)) ? layout.laneColorStyle : 'full';
  const laneStyle = (w, layout) => ownLaneStyle(w) || layoutLaneStyle(layout);
  const laneStripe = (w, layout, color, U = PAGE_UNITS) => {
    if (modern(w, layout)) {
      const a = appearance(w, layout), c = sourceColour(a.accent, a.accentColor, a.accentShade, w, layout);
      if (a.accent === 'none' || !c) return { cls: '', css: '', color: '', size: '' };
      const size = `${Math.min(a.accentWidth, (w.w || 1000) * .14, (w.h || 1000) * .14) / (U || 1000) * 100}cqw`, ink = fade(c, 100 - a.accentOpacity), edge = a.edge === 'left' ? 'side' : a.edge;
      return { cls: ' lcstripe-' + edge, css: `--lane-stripe:${ink};--lane-size:${size}`, color: ink, size };
    }
    const mode = laneStyle(w, layout), c = safe(color);
    if (!c || (mode !== 'top' && mode !== 'side' && mode !== 'right')) return { cls: '', css: '', color: '', size: '' };
    // Fit even a five-unit widget. This paints inside the frame, without changing its saved geometry.
    const units = Math.min(4, Number(w.w) > 0 ? w.w * .14 : 4, Number(w.h) > 0 ? w.h * .14 : 4);
    const size = `${Math.round(units / (U > 0 ? U : PAGE_UNITS) * 100000) / 1000}cqw`, ink = fade(c, transparency(w, layout));
    return { cls: ' lcstripe-' + mode, css: `--lane-stripe:${ink};--lane-size:${size}`, color: ink, size };
  };

  // Rounded corners: how round, from 0 (square) to 50 (fully round: a circle on a square widget, a pill on a long one), as a percent of the widget's
  // shorter side, so it looks the same at any size. A widget's own setting wins over the layout's. null = nothing set (the style sheet's own corners).
  const cornerPct = v => number(v, 0, 50, null, 0.5);
  const corner = (w, layout, U) => {
    if (modern(w, layout) && appearance(w, layout).radiusPixels !== null) return `${appearance(w, layout).radiusPixels / (U || 1000) * 100}cqw`;
    const own = cornerPct(w.radius), pct = own !== null ? own : cornerPct(layout && layout.radius);
    return pct === null || !(U > 0) ? '' : `${Math.round(pct * Math.min(w.w, w.h) / U * 100) / 100}cqw`;
  };

  // what a layout keeps of the frame settings
  const pickLayout = l => ({ radius: cornerPct(l && l.radius) ?? '', widgetTransparency: layoutTransparency(l), ...(layoutLaneStyle(l) !== 'full' ? { laneColorStyle: layoutLaneStyle(l) } : {}), ...(l?.widgetAppearance ? {widgetAppearance: cleanAppearance(l.widgetAppearance)} : {}), ...(l?.widgetFonts ? {widgetFonts: (root.WidgetFonts || (typeof require!=="undefined" ? require("./widgetfonts.js") : null))?.clean(l.widgetFonts) || {}} : {}) });

  // New settings are opt-in. Missing properties continue to resolve from the
  // original layout/widget settings, so opening an old layout never migrates it.
  const PALETTE = ['#2f9fc5','#76a747','#e64d59','#f0c329','#ae82e8','#f39436','#e882b0','#c4ccd8'];
  const APP_CHOICES = {fill:['solid','gradient','none'],source:['theme','lane','custom'],gradientSource:['theme','lane','custom'],strength:['subtle','medium','strong'],border:['theme','shade','lane','custom','none'],accent:['shade','lane','custom','none'],edge:['top','left','right'],depth:['follow','0','35','55','75'],spacing:['legacy','compact','comfortable','custom'],highlightTarget:['background','text','text-border']};
  const APP_NUMBERS = {gradientOpacity:[0,100,1],angle:[0,359,1],borderShade:[-100,100,1],accentShade:[-100,100,1],borderWidth:[0,40,.5],accentWidth:[1,20,.5],radiusPixels:[0,250,.5],surfaceOpacity:[0,100,1],borderOpacity:[0,100,1],accentOpacity:[0,100,1],padding:[0,60,1]};
  function cleanAppearance(raw) {
    const a = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}, out = {};
    for (const [k, choices] of Object.entries(APP_CHOICES)) if (choices.includes(String(a[k]))) out[k] = String(a[k]);
    for (const [k, [lo, hi, step]] of Object.entries(APP_NUMBERS)) { const v = number(a[k],lo,hi,null,step); if(v !== null) out[k]=v; }
    for(const k of ['baseColor','gradientColor','borderColor','accentColor']) if(hex(a[k])) out[k]=hex(a[k]);
    if(typeof a.highlights==='boolean')out.highlights=a.highlights;
    return out;
  }
  const modern = (w,l) => !!(Object.keys(cleanAppearance(l?.widgetAppearance)).length || Object.keys(cleanAppearance(w?.appearance)).length);
  function appearance(w={},l={}) {
    const oldLane=laneStyle(w,l),oldOpacity=100-transparency(w,l),bound=Number.isInteger(w.lane)&&w.lane>=0&&w.lane<8;
    return {fill:'solid',source:hex(w.bgColor)?'custom':oldLane==='full'&&bound?'lane':'theme',baseColor:hex(w.bgColor)||'#299ec3',strength:'medium',angle:135,
      border:mode(w)==='off'?'none':mode(w)||'theme',borderColor:colorOf(w),borderShade:(50-shade(w))*2,borderWidth:widthOf(w)??1,
      accent:['top','side','right'].includes(oldLane)?'lane':'none',accentColor:'#299ec3',accentShade:40,edge:oldLane==='top'?'top':oldLane==='right'?'right':'left',accentWidth:4,
      radiusPixels:null,depth:'follow',surfaceOpacity:oldOpacity,borderOpacity:oldOpacity,accentOpacity:oldOpacity,spacing:'legacy',padding:22,highlights:true,highlightTarget:'background',
      gradientSource:bound?'lane':'theme',gradientColor:'#299ec3',gradientOpacity:100,
      ...gradientDefaults(l?.widgetAppearance),...cleanAppearance(l?.widgetAppearance),...gradientDefaults(w?.appearance),...cleanAppearance(w?.appearance)};
  }
  // Retain a saved strength as opacity until the user changes the new control.
  // The base source remains independent; never blend a custom base into the theme.
  function gradientDefaults(raw) {const a=cleanAppearance(raw);return a.strength&&!Object.hasOwn(a,'gradientOpacity')?{gradientOpacity:{subtle:20,medium:36,strong:52}[a.strength]}:{};}
  function laneColour(w,l) {return Number.isInteger(w?.lane)&&w.lane>=0&&w.lane<8 ? hex(l?.laneColors?.[w.lane]?.bg)||PALETTE[w.lane] : '';}
  function baseColour(w,l) {const a=appearance(w,l);return a.source==='custom'?a.baseColor:a.source==='lane'?laneColour(w,l)||'var(--panel)':'var(--panel)';}
  const tint = (c, s) => s===0?c:`color-mix(in srgb, ${s>0?'white':'black'} ${Math.abs(s)}%, ${c})`;
  function sourceColour(mode,c,shade,w,l) {return mode==='none'?'':mode==='custom'?hex(c):mode==='lane'?laneColour(w,l):mode==='theme'?'var(--line)':tint(baseColour(w,l),shade);}
  function modernStyle(eventBg,w,classic,l,U) {
    const a=appearance(w,l),base=baseColour(w,l),event=a.highlights&&a.highlightTarget==='background'&&safe(eventBg)&&safe(eventBg)!==base? safe(eventBg):'',colour=event||base;
    let bg=fade(colour,100-a.surfaceOpacity);
    if(a.fill==='gradient'&&!event){const seed=a.gradientSource==='custom'?a.gradientColor:a.gradientSource==='lane'?laneColour(w,l)||'var(--accent)':'var(--accent)';
      // Blend before applying surface opacity, so a transparent widget never
      // becomes more opaque where its gradient is strongest.
      const start=`color-mix(in srgb, ${seed} ${a.gradientOpacity}%, ${base})`;
      bg=`linear-gradient(${a.angle}deg, ${fade(start,100-a.surfaceOpacity)}, ${fade(base,100-a.surfaceOpacity)})`;
    }
    if(a.fill==='none'&&!event)bg='transparent';
    const border=sourceColour(a.border,a.borderColor,a.borderShade,w,l)||'transparent';
    return {background:bg,borderColor:fade(border,100-a.borderOpacity),backgroundClip:'padding-box',borderWidth:`${a.border==='none'?0:a.borderWidth/(U||1000)*100}cqw`};
  }
  const TYPE_NUMBERS={titleSize:[11,60],valueSize:[14,200],supportSize:[11,40],labelSize:[11,32],minSize:[11,60],iconSize:[16,400]};
  function typography(w={}) {const raw=w.typography||{},out={mode:w.textSize?'manual':'auto',titleSize:w.titleSize||12,valueSize:w.textSize||30,supportSize:13,labelSize:11,minSize:14,iconSize:44,shrink:true,longText:'wrap',textSource:w.textColor?'custom':'auto'};
    if(['pace','tyrelife'].includes(w.type)&&Number(w.h)>0)out.iconSize=Math.max(16,Math.min(400,Math.round(w.h*(Number(w.opt?.[w.type==='pace'?'gaugeScale':'pictureScale'])||55)/100)));
    for(const [k,choices] of Object.entries({mode:['auto','manual'],longText:['wrap','fit','ellipsis'],textSource:['auto','theme','custom']}))if(choices.includes(raw[k]))out[k]=raw[k];
    for(const [k,[lo,hi]] of Object.entries(TYPE_NUMBERS))out[k]=number(raw[k],lo,hi,out[k],1);
    if(typeof raw.shrink==='boolean')out.shrink=raw.shrink;
    return out;
  }
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const mixHex=(a,b,f)=>'#'+rgb(a).map((v,i)=>Math.round(v*f+rgb(b)[i]*(1-f)).toString(16).padStart(2,'0')).join('');
  const luminance=h=>rgb(h).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  let paletteCache=null,paletteKey='';
  const themeKey=()=>{const el=root.document?.documentElement;return el?(el.getAttribute?.('style')||'')+'|'+el.dataset?.theme+'|'+el.dataset?.tone:'';};
  function palette() {const doc=root.document;if(!doc?.documentElement||!root.getComputedStyle)return null;const el=doc.documentElement,key=(el.getAttribute?.('style')||'')+'|'+el.dataset?.theme+'|'+el.dataset?.tone;if(key!==paletteKey||!paletteCache){const s=root.getComputedStyle(el);paletteCache=Object.fromEntries(['panel','bg','ink','accent'].map(k=>[k,hex(s.getPropertyValue('--'+k))||({panel:'#222831',bg:'#171b21',ink:'#e8e6e1',accent:'#e5484d'})[k]]));paletteKey=key;}return paletteCache;}
  function surfaceSamples(w,l,eventBg) {const p=palette();if(!p)return null;const a=appearance(w,l),base=a.source==='theme'?p.panel:a.source==='custom'?a.baseColor:laneColour(w,l)||p.panel;let ends=[base,base];
    if(a.fill==='gradient'){const seed=a.gradientSource==='custom'?a.gradientColor:a.gradientSource==='lane'?laneColour(w,l)||p.accent:p.accent;ends=[mixHex(seed,base,a.gradientOpacity/100),base];}
    const event=a.highlights&&a.highlightTarget==='background'&&safe(eventBg)!==baseColour(w,l)&&hex(eventBg);
    if(event)ends=[event,event];
    const opacity=a.fill==='none'&&!event?0:a.surfaceOpacity/100;
    return Array.from({length:9},(_,i)=>mixHex(mixHex(ends[0],ends[1],i/8),p.bg,opacity));
  }
  function inkFor(w,l,eventBg) {const p=palette(),points=surfaceSamples(w,l,eventBg);if(!p||!points)return '';
    return [p.ink,'#101820','#ffffff'].sort((x,y)=>Math.min(...points.map(p=>contrast(y,p)))-Math.min(...points.map(p=>contrast(x,p))))[0];
  }
  const stateInkCache=new Map();
  function stateInk(w,l,colour) {
    const p=palette(),seed=hex(colour);if(!seed||!p)return safe(colour);
    const a=appearance(w,l),key=JSON.stringify([seed,p,baseColour(w,l),a.fill,a.gradientSource,a.gradientColor,a.gradientOpacity,laneColour(w,l),a.surfaceOpacity]);
    if(stateInkCache.has(key))return stateInkCache.get(key);
    const points=surfaceSamples(w,l),score=c=>Math.min(...points.map(bg=>contrast(c,bg)));
    let best=seed,bestScore=score(seed);
    // Preserve the hue, using the smallest light/dark adjustment that reads well.
    if(bestScore<4.5)outer:for(let step=1;step<=40;step++)for(const end of ['#000000','#ffffff']){const c=mixHex(end,seed,step/40),s=score(c);if(s>bestScore){best=c;bestScore=s;}if(s>=4.5){best=c;break outer;}}
    if(stateInkCache.size>=128)stateInkCache.clear();stateInkCache.set(key,best);return best;
  }
  function stateText(w,l,out={}) {
    const a=appearance(w,l);if(!a.highlights||a.highlightTarget==='background')return '';
    // Background + contrast text is the renderer's event signal. A plain lane
    // swatch has no contrast text, so its lane colour is not a race warning.
    const colour=out.bg&&out.color?safe(out.bg):w.type==='clock'&&w.opt?.flagColour!==false?safe(out.color):'';
    return colour?stateInk(w,l,colour):'';
  }
  // Applied to both editor and live DOM. No timing state is changed.
  function present(el,w,l,out={},refit) {
    if(!el?.style?.setProperty||!el.style.removeProperty||!el.classList)return;
    root.WidgetFonts?.apply(el,w,l,refit);
    const enhanced=modern(w,l),type=!!w.typography,a=appearance(w,l),t=typography(w),scale=(el.getBoundingClientRect?.().width||w.w)/(w.w||1000);
    if(enhanced){el.classList.add('ws-appearance');el.dataset.wsDepth=a.depth;Object.assign(el.style,modernStyle(out.bg||baseColour(w,l),w,'var(--line)',l,1000));el.style.setProperty('--wf',String(solidity(w,l)));if(a.depth==='follow')el.style.removeProperty('--depth');else el.style.setProperty('--depth',String(Number(a.depth)/100));
      el.style.boxShadow=a.depth==='0'||solidity(w,l)===0?'none':'';
      const stripe=laneStripe(w,l,laneColour(w,l));el.classList.remove('lcstripe-top','lcstripe-side','lcstripe-right');if(stripe.cls)el.classList.add(stripe.cls.trim());el.style.setProperty('--lane-size',stripe.size||'0px');el.style.setProperty('--lane-stripe',stripe.color||'transparent');el.style.borderRadius=corner(w,l,1000);
      if(a.spacing!=='legacy'){el.classList.add('ws-spacing');el.style.setProperty('--ws-padding',((a.spacing==='compact'?12:a.spacing==='comfortable'?22:a.padding)*scale)+'px');}
      else {el.classList.remove('ws-spacing');el.style.removeProperty('--ws-padding');}
    }
    if(enhanced||type){if(t.textSource==='custom'&&hex(w.textColor))el.style.color=hex(w.textColor);else if(a.highlights&&out.color)el.style.color=out.color;else el.style.color=t.textSource==='theme'?'var(--ink)':enhanced?inkFor(w,l,out.bg):w.textColor||'';}
    // Follow flags is the clock's explicit text-colour choice, independent of surface highlights.
    if(w.type==='clock'&&w.opt?.flagColour!==false)el.style.color=out.color||'var(--clock-green)';
    const stateColour=stateText(w,l,out);
    if(stateColour){el.dataset.wsStateText='';el.style.setProperty('--ws-state-ink',stateColour);el.style.color=stateColour;
      if(a.highlightTarget==='text-border'){el.style.borderColor=stateColour;el.style.borderWidth=`max(1px, ${Math.max(1,a.borderWidth)/10}cqw)`;}
    }else {delete el.dataset.wsStateText;el.style.removeProperty('--ws-state-ink');}
    if(!type)return;
    if(t.mode==='auto'&&root.Widgets?.def)el.style.fontSize=((root.Widgets.def(w.type)?.textSize||30)/10)+'cqw';
    el.classList.add('ws-type');el.dataset.wsSizing=t.mode;el.dataset.wsLong=t.longText;
    el.toggleAttribute('data-ws-icon',Object.hasOwn(w.typography,'iconSize'));
    for(const [k,css] of Object.entries({valueSize:'value',supportSize:'support',labelSize:'label',iconSize:'icon'}))el.style.setProperty('--ws-'+css,Math.max(k==='iconSize'?0:k==='valueSize'?t.minSize:11,t[k]*scale)+'px');
    el.style.setProperty('--ws-align',w.valueAlign||'center');const value=el.querySelector('.lw-val'),title=el.querySelector('.lw-title');if(title)title.style.fontSize=Math.max(11,t.titleSize*scale)+'px';
    if(value&&!el.classList.contains('aio-widget'))value.style.fontSize=t.mode==='manual'?Math.max(t.minSize,t.valueSize*scale)+'px':'';
    if(value&&!value.children.length){value.style.whiteSpace=t.longText==='wrap'?'normal':'nowrap';value.style.overflowWrap=t.longText==='wrap'?'anywhere':'';value.style.textOverflow=t.longText==='ellipsis'?'ellipsis':'';value.style.display=t.longText==='ellipsis'?'block':'';value.style.alignContent=t.longText==='ellipsis'?'center':'';}
  }

  // Bounded search works for both a very large manual size and a tiny frame.
  // Always leave the tested lower bound applied; never rely on a CSS transform.
  function fitSize(min,max,apply,fits) {
    min=Math.max(1,min);max=Math.max(min,max);apply(min);
    if(!fits())return {size:min,fits:false};
    apply(max);if(fits())return {size:max,fits:true};
    let lo=min,hi=max;
    for(let i=0;i<12&&hi-lo>.1;i++){const mid=(lo+hi)/2;apply(mid);if(fits())lo=mid;else hi=mid;}
    const size=Math.max(min,Math.floor(lo*10)/10);apply(size);return {size,fits:fits()};
  }
  // Range bounds catch centred overflow that scrollWidth alone misses. Keep this
  // shared by the editor, live canvases, row cells and Builder text components.
  function textFits(node,box=node,vertical=true) {
    const b=box.getBoundingClientRect(),s=root.getComputedStyle(box),p=k=>parseFloat(s[k])||0;
    const left=b.left+p('paddingLeft'),right=b.right-p('paddingRight'),top=b.top+p('paddingTop'),bottom=b.bottom-p('paddingBottom');
    if(right<=left||bottom<=top)return false;
    const walk=node.ownerDocument.createTreeWalker(node,4);let n;
    while(n=walk.nextNode()){
      if(!n.textContent.trim()||!n.parentElement.getClientRects().length||n.parentElement.closest('svg'))continue;
      const range=node.ownerDocument.createRange();range.selectNodeContents(n);
      for(const r of range.getClientRects())if(r.left<left-.75||r.right>right+.75||(vertical&&(r.top<top-.75||r.bottom>bottom+.75)))return false;
    }
    return true;
  }
  function fitText(node,{min=11,max=200,box=node,shrink=true,vertical=true}={}) {
    if(!shrink){node.style.fontSize=max+'px';return textFits(node,box,vertical);}
    return fitSize(min,max,n=>{node.style.fontSize=n+'px';},()=>textFits(node,box,vertical)).fits;
  }
  function fitTitle(el,w={}) {
    const title=el?.querySelector?.(':scope > .lw-title');
    // Title is a bounded independent top row, including left-aligned titles.
    if(title){if(!w.titleSize&&!w.typography?.titleSize)title.style.fontSize='max(11px, 1.2cqw)';Object.assign(title.style,{left:'12px',right:'12px',top:'6px',maxWidth:'calc(100% - 24px)',transform:'',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'});}
  }
  const fitCache=new WeakMap();let fontEpoch=0;
  root.document?.fonts?.addEventListener('loadingdone',()=>{fontEpoch++;});
  function fit(el,w={}) {
    if(!el?.querySelector||!root.getComputedStyle||!el.getBoundingClientRect)return false;
    const v=el.querySelector(':scope > .lw-val');if(!v||!el.clientWidth||!el.clientHeight)return false;
    const t=typography(w),scale=el.getBoundingClientRect().width/(w.w||el.clientWidth);
    v.style.transform='';v.style.transformOrigin='';
    fitTitle(el,w);
    const kind=w.layoutKind||root.Widgets?.layoutOfWidget(w)||'text';
    const simple=!v.children.length,list=kind==='list'&&v.querySelector(':scope > .ll'),stock=kind==='stock'&&v.querySelector(':scope > .twav'),strategy=kind==='strategy'&&v.querySelector(':scope > .strategy-widget'),composition=kind==='composition'&&v.querySelector(':scope > .wc-root');
    const pitcontrol=kind==='pitcontrol',gauge=kind==='gauge',aio=kind==='aio',richText=kind==='text'||kind==='flow'||pitcontrol;
    const handled=simple||richText||list||stock||strategy||composition||gauge||aio;
    if(!handled)return false;
    // Explicit spacing wins. Otherwise use a modest screen-pixel safety margin.
    const pad=el.classList.contains('rcell')?2:el.classList.contains('ws-spacing')?parseFloat(el.style.getPropertyValue('--ws-padding'))||0:Math.min(10,el.clientWidth*.06,el.clientHeight*.06);
    el.classList.add('wf-fitted');
    Object.assign(v.style,{left:pad+'px',right:pad+'px',bottom:pad+'px',top:pad+'px',padding:'0px',width:'auto',height:'auto'});
    // List-style overviews reserve the actual title height, including manual sizing.
    const fuelGauge=v.querySelector(':scope > .fuel-gauge');
    if(pitcontrol||fuelGauge){const title=el.querySelector(':scope > .lw-title');if(title)v.style.top=Math.max(pad,title.offsetTop+title.offsetHeight+6)+'px';}
    if(fuelGauge){const compact=v.clientHeight<68||(fuelGauge.classList.contains('fg-vertical')&&v.clientWidth<90);fuelGauge.classList.toggle('fg-compact',compact);const detail=fuelGauge.querySelector('.fg-detail');if(detail)detail.hidden=compact;}
    let ok=true;
    if(composition){root.WidgetCompose?.fit(el,w);ok=!el.classList.contains('wc-crowded');}
    else if(simple||richText||list||stock||strategy){
      const numeric=/^[\d\s+−—:.,%×/-]+$/.test(v.textContent);
      v.style.whiteSpace=(simple||richText)&&t.longText==='wrap'&&!numeric?'normal':'nowrap';
      v.style.overflowWrap='normal';
      let initial=t.mode==='manual'?t.valueSize*scale:Math.min(512,Math.max(v.clientWidth,v.clientHeight));
      if(pitcontrol&&t.mode!=='manual')initial=Math.min(initial,24);
      // Fit the whole grid uniformly, including lap numbers and column gaps.
      if(list){list.style.maxWidth='none';list.style.flexShrink='0';list.style.setProperty('--lap-number-ch',String(Math.max(1,...[...list.querySelectorAll('.lln')].map(n=>n.textContent.trim().length))));}
      if(stock){
        // Tyre pictures are flexible; stock counts keep their readable size.
        const icons=[...stock.querySelectorAll('.twav-c')],size=Math.max(8,Math.min(38,v.clientHeight*.38,v.clientWidth/(icons.length+2)*.7));
        icons.forEach(n=>{n.style.width=size+'px';n.style.height=size+'px';});
        stock.style.gap='5px';stock.querySelectorAll('.twav-row2,.twav-row').forEach(n=>n.style.gap='5px');
        stock.querySelectorAll('.twav-team,.twav-next').forEach(n=>n.style.fontSize='11px');
        if(t.mode==='auto')initial=Math.min(initial,28,Math.max(t.minSize,v.clientWidth/(icons.length+2)));
      }
      const min=list?t.minSize/.8:strategy?Math.max(t.minSize,11/.48):pitcontrol?Math.max(t.minSize,14):t.minSize;
      const computed=root.getComputedStyle(v),tabular=/^(?:"?SF (?:Inter|Roboto Mono|Barlow Condensed)|"?Segoe UI)/.test(computed.fontFamily);
      const key=JSON.stringify([v.clientWidth,v.clientHeight,initial,min,t.mode,t.shrink,t.longText,tabular?v.textContent.replace(/\d/g,'0'):v.textContent,w.opt,w.fonts,el.style.getPropertyValue('--wf-support-font'),computed.fontFamily,computed.fontWeight,computed.fontStyle,computed.letterSpacing,fontEpoch,pitcontrol?[...v.querySelectorAll('.pcw-row')].filter(n=>!n.hidden).length:null]);
      const cached=fitCache.get(v);
      if(simple&&t.longText==='ellipsis'&&!numeric){
        // Shortening a description is an explicit user choice, not a fitting failure.
        v.style.fontSize=Math.max(min,Math.min(initial,v.clientHeight*.68))+'px';
        Object.assign(v.style,{display:'block',alignContent:'center',textOverflow:'ellipsis',whiteSpace:'nowrap'});
        ok=v.clientHeight>=min*1.35;
      }else if(cached?.key===key){v.style.fontSize=cached.size;ok=cached.ok;}
      else {
        if(pitcontrol){
          // Include row padding/backgrounds; glyphs fitting alone can still clip the last card.
          const fits=()=>textFits(v)&&v.querySelector('.pcw').getBoundingClientRect().bottom<=v.getBoundingClientRect().bottom+.75;
          if(t.mode==='auto'||t.shrink)ok=fitSize(min,initial,size=>{v.style.fontSize=size+'px';},fits).fits;
          else {v.style.fontSize=initial+'px';ok=fits();}
        }else ok=fitText(v,{min,max:initial,shrink:t.mode==='auto'||t.shrink});
        fitCache.set(v,{key,size:v.style.fontSize,ok});
      }
    }else{
      if(aio)root.AllInOne?.fit(v);
      if(gauge&&t.mode==='auto'){
        const hasPicture=!!v.querySelector('.twbox2,.psbox-gauge');
        v.style.fontSize=Math.max(t.minSize,Math.min(v.clientHeight*(hasPicture?.2:.35),v.clientWidth*.18))+'px';
      }
      const selector=aio?'.aio-fact b,.aio-who>strong,.aio-who>span,.aio-laprow strong,.aio-system strong':'.twlf,.twgr,.twnm,.twpct,.twtemp,.twvalue,.twn>small,.twbar-details,.ftxt,.fnum,.fg-value,.fg-detail,.fg-warning,.pspill>span,.pssmall,.psp,.psbox>small,.psw>b,.psw>small';
      const targets=[...v.querySelectorAll(selector)].filter(n=>!n.hidden);
      targets.forEach(n=>{n.style.removeProperty('font-size');n.style.lineHeight=fuelGauge?'1.5':'1.35';});
      const mediaFloor=Math.min(40,v.clientHeight*.25);
      if(gauge){
        const media=v.querySelector('.twbox2,.psbox-gauge');
        if(media){const rows=[...media.children].filter(n=>!n.matches('svg,.twpic,.twringw,.psgauge')).length;media.style.gridTemplateRows=`minmax(${mediaFloor}px,1fr)${' auto'.repeat(rows)}`;media.style.height='100%';}
      }
      for(const n of targets){
        const primary=n.matches('.aio-fact b,.aio-laprow strong,.psp,.twpct,.twvalue,.psw>b,.fnum,.fg-value'),min=primary?t.minSize:11;
        const max=Math.max(min,parseFloat(root.getComputedStyle(n).fontSize)||min);
        // A local box constrains each label, then the final check covers siblings.
        ok=fitText(n,{min,max,box:n,shrink:t.mode==='auto'||t.shrink,vertical:false})&&ok;
      }
      if(!textFits(v)&&(t.mode==='auto'||t.shrink)){
        const sizes=targets.map(n=>parseFloat(root.getComputedStyle(n).fontSize));
        fitSize(1,100,p=>targets.forEach((n,i)=>{const min=n.matches('.aio-fact b,.aio-laprow strong,.psp,.twpct,.twvalue,.psw>b,.fnum,.fg-value')?t.minSize:11;n.style.fontSize=Math.max(min,sizes[i]*p/100)+'px';}),()=>textFits(v));
      }
      if(gauge){
        const media=v.querySelector('.twbox2,.psbox-gauge');
        if(media){const rows=[...media.children].filter(n=>!n.matches('svg,.twpic,.twringw,.psgauge')),gap=parseFloat(root.getComputedStyle(media).rowGap)||0;
          const room=Math.max(0,v.clientHeight-rows.reduce((n,x)=>n+x.getBoundingClientRect().height,0)-gap*rows.length);
          const preferred=Object.hasOwn(w.typography||{},'iconSize')?t.iconSize*scale:v.clientHeight*(Number(w.opt?.[w.type==='pace'?'gaugeScale':'pictureScale'])||55)/100;
          media.style.gridTemplateRows=`minmax(0, ${Math.max(Math.min(mediaFloor,preferred),Math.min(room,preferred))}px)${' auto'.repeat(rows.length)}`;
        }
      }
      // The final supporting-text layout can change the bar's available width.
      // Recheck its own clipping box, not only the outer widget boundary.
      for(const n of v.querySelectorAll('.ftxt'))ok=fitText(n,{min:11,max:parseFloat(root.getComputedStyle(n).fontSize)||11,box:n,shrink:t.mode==='auto'||t.shrink})&&ok;
      ok=textFits(v)&&ok;
    }
    el.classList.toggle('wf-crowded',!ok);el.dataset.fitStatus=ok?'fits':'too-small';
    return true;
  }

  const api = { fitTitle, LANE_STYLES, ownLaneStyle, layoutLaneStyle, laneStyle, laneStripe, mode, shade, colorOf, widthOf, hex, solidity, COLOR_START, transparency, ownTransparency, layoutTransparency, pickLayout, shadeOf, style, css, cornerPct, corner, DEFAULT_SHADE, MODES,
    cleanAppearance,modern,appearance,laneColour,baseColour,typography,present,fit,fitSize,fitText,textFits,inkFor,stateText,themeKey,APP_CHOICES,APP_NUMBERS,TYPE_NUMBERS };
  root.Frame = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
