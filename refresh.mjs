import fs from "node:fs";

const pages=[
  "https://www.rockstargames.com/VI/media/screenshots",
  "https://www.rockstargames.com/VI/media/artwork-wallpapers"
];

const byImage=new Map();
const MIN_WIDTH=2560;
const MIN_HEIGHT=1440;\nconst MIN_ASPECT=1.5;\nconst MAX_ASPECT=2.0;

function cleanName(pathname){
  return decodeURIComponent(pathname.split("/").pop()||"")
    .replace(/\.(?:jpg|jpeg|png|webp)$/i,"")
    .replace(/\.[a-z0-9._~-]{6,}$/i,"");
}

function wantedGalleryImage(pathname){
  const n=cleanName(pathname);
  if(/logo|icon|esrb|favicon|gta_plus|fob_|mobile/i.test(n)) return false;
  // Keep full screenshots and TV-friendly artwork/wallpaper variants.
  // Exclude phone, portrait, square and tablet alternates.
  if(/_(?:phone|portrait|square|tablet)$/i.test(n)) return false;
  return /_\d{2}$/i.test(n) || /_(?:landscape|ultrawide)$/i.test(n) || /wallpaper/i.test(n);
}

function canonicalKey(pathname){
  return cleanName(pathname)
    .replace(/_(?:landscape|ultrawide)$/i,"")
    .toLowerCase();
}

function jpegSize(b){
  if(b[0]!==0xff||b[1]!==0xd8) return null;
  let i=2;
  while(i+9<b.length){
    if(b[i]!==0xff){i++;continue}
    const marker=b[i+1];
    if(marker===0xd8||marker===0xd9){i+=2;continue}
    if(i+4>b.length) break;
    const len=b.readUInt16BE(i+2);
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      return {width:b.readUInt16BE(i+7),height:b.readUInt16BE(i+5)};
    }
    if(len<2) break;
    i+=2+len;
  }
  return null;
}

function pngSize(b){
  if(b.length>=24 && b.toString("ascii",1,4)==="PNG")
    return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
  return null;
}

function dimensions(b){ return jpegSize(b)||pngSize(b); }

for(const page of pages){
  const r=await fetch(page,{headers:{"user-agent":"Mozilla/5.0"}});
  if(!r.ok) throw new Error(`Rockstar returned ${r.status} for ${page}`);
  let t=await r.text();
  t=t.replaceAll("\\u0026","&").replaceAll("\\/","/").replaceAll("&amp;","&");
  const candidates=t.match(/(?:https?:\/\/www\.rockstargames\.com)?\/VI\/_next\/static\/media\/[^"'<>\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\\\s]*)?/gi)||[];
  for(let raw of candidates){
    if(raw.startsWith("/")) raw="https://www.rockstargames.com"+raw;
    const u=new URL(raw);
    if(!wantedGalleryImage(u.pathname)) continue;
    const key=canonicalKey(u.pathname);
    u.search="";
    u.searchParams.set("akim","1");
    u.searchParams.set("imdensity","1");
    u.searchParams.set("imwidth","3840");
    const candidate=u.toString();
    // Prefer landscape over ultrawide when both are alternate crops of the same artwork.
    const old=byImage.get(key);
    if(!old || /_landscape/i.test(u.pathname)) byImage.set(key,candidate);
  }
}

const checked=[];
for(const url of byImage.values()){
  try{
    const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0"}});
    if(!r.ok) continue;
    const b=Buffer.from(await r.arrayBuffer());
    const d=dimensions(b);
    // If dimensions are readable, enforce a genuinely large source.
    if(d && d.width<MIN_WIDTH && d.height<MIN_HEIGHT) continue;
    checked.push({url});
  }catch{}
}

checked.sort((a,b)=>a.url.localeCompare(b.url));
if(checked.length<30) throw new Error(`Only found ${checked.length} high-resolution gallery images; refusing to replace the existing list.`);
fs.writeFileSync("images.json",JSON.stringify(checked,null,2)+"\n");
console.log("Found",checked.length,"high-resolution official Rockstar gallery images");
