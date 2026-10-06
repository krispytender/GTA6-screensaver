import fs from "node:fs";

const pages=[
  "https://www.rockstargames.com/VI/media/screenshots",
  "https://www.rockstargames.com/VI/media/artwork-wallpapers"
];
const byImage=new Map();

function canonicalKey(url){
  const u=new URL(url);
  return u.pathname
    .replace(/\.(?:jpg|jpeg|png|webp)$/i,"")
    .replace(/\.[a-z0-9_~-]{6,}$/i,"")
    .toLowerCase();
}

for(const page of pages){
  const r=await fetch(page,{headers:{"user-agent":"Mozilla/5.0"}});
  if(!r.ok) throw new Error(`Rockstar returned ${r.status} for ${page}`);
  let t=await r.text();
  t=t.replaceAll("\\u0026","&").replaceAll("\\/","/").replaceAll("&amp;","&");
  const candidates=t.match(/(?:https?:\/\/www\.rockstargames\.com)?\/VI\/_next\/static\/media\/[^"'<>\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\\\s]*)?/gi)||[];
  for(let raw of candidates){
    if(raw.startsWith("/")) raw="https://www.rockstargames.com"+raw;
    const u=new URL(raw);
    if(/logo|icon|esrb|favicon/i.test(u.pathname)) continue;
    const key=canonicalKey(u.toString());
    u.search="";
    u.searchParams.set("akim","1");
    u.searchParams.set("imdensity","1");
    u.searchParams.set("imwidth","3840");
    if(!byImage.has(key)) byImage.set(key,u.toString());
  }
}

const out=[...byImage.values()].map(url=>({url})).sort((a,b)=>a.url.localeCompare(b.url));
if(out.length < 100) throw new Error(`Only found ${out.length} unique gallery images; refusing to replace the existing list.`);
fs.writeFileSync("images.json",JSON.stringify(out,null,2)+"\n");
console.log("Found",out.length,"unique official Rockstar gallery images");