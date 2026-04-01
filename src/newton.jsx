import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";

const FIREBASE = "https://newton-93d05-default-rtdb.firebaseio.com";

// ── Firebase helpers ──────────────────────────────────────────────────────────
async function fbGet(path) {
  const r = await fetch(`${FIREBASE}/${path}.json`);
  if (!r.ok) throw new Error(`GET ${path} → HTTP ${r.status}`);
  return await r.json();
}
async function fbSet(path, data) {
  const r = await fetch(`${FIREBASE}/${path}.json`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(`PUT ${path} → HTTP ${r.status}: ${await r.text()}`);
}
// Quick round-trip test: write then read back
async function fbConnectTest() {
  const val = Date.now();
  await fbSet('_test', {t: val});
  const back = await fbGet('_test');
  if (!back || back.t !== val) throw new Error("Write succeeded but read-back mismatch");
  return true;
}

const QUIZZES = [
  { id:"q1",  title:"Quiz 1: Course Access",          questions:[{id:"q1_1",text:"Do you have access to the course textbook (digital or physical)?",yesNo:true},{id:"q1_2",text:"Can you access the online homework assignments?",yesNo:true}] },
  { id:"q2",  title:"Quiz 2: Vectors & Measurements", questions:[{id:"q2_1",text:"What is the difference between precision and accuracy?"},{id:"q2_2",text:"What is a vector component?"},{id:"q2_3",text:"Complete the sentence by dragging the correct words into the blanks:",displaySentence:"A dot product results in a ___, a cross product results in a ___.",blanksLabel:["dot product →","cross product →"],wordBank:["scalar","vector"],correctBlanks:["scalar","vector"],dragDrop:true}]},
  { id:"q3",  title:"Quiz 3: Motion Graphs",          questions:[{id:"q3_1",requiresImage:true,formatLabel:"PNG, JPG, WEBP, or GIF",acceptedFormats:["image/png","image/jpeg","image/webp","image/gif"],text:"Draw the position, velocity, and acceleration plots that describe the following motion, then upload a photo or image of your drawing:\n\nI start at rest at the origin. I then walk forward (+ direction) slowly for 2 seconds. Then I stop for 1 second. Then I walk backward (− direction) twice as fast for 2 seconds. Then I stop again for 2 seconds. Finally, I walk forward again for 2 seconds, increasing my speed with constant acceleration until I reach my starting position at the origin."}]},
  { id:"q4",  title:"Quiz 4: Projectile Motion",      questions:[{id:"q4_1",text:"An apple is tossed straight up into the air and then caught again as it falls straight back down. At the highest point in its trajectory, what is its speed (the magnitude of its velocity)?"},{id:"q4_2",text:"A projectile is at the highest point in its trajectory and its vertical speed is momentarily zero. What is the magnitude of its acceleration?"}]},
  { id:"q5",  title:"Quiz 5: Newton's Laws",          questions:[{id:"q5_1",text:"In the demonstration video about inertia and Newton's 1st law (https://www.youtube.com/watch?v=EsfKfNKSoMc), why does the string lift the mug when pulled slowly but not when pulled rapidly?"},{id:"q5_2",text:"If every force has an equal and opposite reaction force according to Newton's 3rd law, why does anything move at all? In other words, if every force is being \"countered\" with an equal and opposite force, why don't they just cancel each other out and result in nothing happening?"}]},
  { id:"q6",  title:"Quiz 6: Friction & Normal Force", questions:[{id:"q6_1",text:"Is the normal force of an object resting on a surface always equal to its weight? If not, when is it not and what is it equal to instead?"},{id:"q6_2",text:"Why is the static friction force fₛ ≤ μₛN stated as being less than or equal to μₛN instead of just equal to?"}]},
  { id:"q7",  title:"Quiz 7: Work",                   questions:[{id:"q7_1",text:"A nonzero force is applied to a moving block. Describe the relationship between the force vector and the velocity vector for three scenarios: (a) the force does positive work on the block, (b) the force does negative work on the block, and (c) the force does zero work on the block."},{id:"q7_2",text:"The sign of many physical quantities depends on the choice of coordinates — for example, aᵧ for free-fall can be negative or positive depending on your sign convention. Is the same thing true of work? Can we make positive work negative by a different choice of coordinates? Explain."}]},
  { id:"q8",  title:"Quiz 8: Energy",                 questions:[{id:"q8_1",text:"An object is released from rest at the top of a ramp. If the ramp is frictionless, does the object's speed at the bottom depend on the shape of the ramp or just on its height? Explain. What if the ramp is not frictionless?"},{id:"q8_2",text:"Watch this demonstration: https://youtu.be/sJG-rXBbmCc?t=1414 — why, in terms of energy, is it extremely important that he does not give the ball even the slightest push when releasing it?"}]},
  { id:"q9",  title:"Quiz 9: Momentum",               questions:[{id:"q9_1",text:"Suppose you catch a baseball and then someone invites you to catch a bowling ball with either the same momentum or the same kinetic energy as the baseball. Which would you choose and why?"},{id:"q9_2",text:"(a) When a larger car collides with a small car, which one undergoes the greater change in momentum: the large one or the small one? Or is it the same for both?\n\n(b) In light of your answer to part (a), why are the occupants of the small car more likely to be hurt than those of the large car, assuming both cars are equally sturdy?"}]},
  { id:"q10", title:"Quiz 10: Rotation & Torque",     questions:[{id:"q10_1",text:"Suppose you could use wheels of any type in the design of a soapbox-derby racer (an unpowered, four-wheel vehicle that coasts from rest down a hill). To conform to the rules on total weight, should you design your car with large massive wheels or small light wheels? Should you use solid wheels or wheels with most of the mass at the rim? Explain."},{id:"q10_2",text:"The work done by a force is the product of force and distance. The torque due to a force is also the product of force and distance. Does this mean that torque and work are equivalent? Explain."}]},
  { id:"q11", title:"Quiz 11: Rolling Race",          questions:[{id:"q11_1",text:"Watch this video: https://www.youtube.com/watch?v=lvfzdibrUFA\n\nFrom left to right, the objects are: a solid sphere, a hollow cylinder of large radius, a solid cylinder, a hollow sphere, and a hollow cylinder of small radius.\n\nWhich object finishes 1st, 2nd, 3rd, 4th, and 5th in the race?"}]},
  { id:"q12", title:"Quiz 12: Statics & Elasticity",  questions:[{id:"q12_1",text:"Why is a tapered water glass with a narrow base easier to tip over than a glass with straight sides? Does it matter whether the glass is empty or full?"},{id:"q12_2",text:"A metal wire of diameter D stretches by 0.100 mm when supporting a weight W. If the same-length wire is used to support a weight three times as heavy, what would its diameter have to be (in terms of D) so it still stretches only 0.100 mm?"}]},
  { id:"q13", title:"Quiz 13: Fluids",                questions:[{id:"q13_1",text:"Why do big heavy cargo ships float in water?"},{id:"q13_2",text:"How do airplane wings generate lift to keep the plane in the air?"}]},
  { id:"q14", title:"Quiz 14: Gravitation",           questions:[{id:"q14_1",text:"A student wrote: \"The only reason an apple falls downward to meet the earth instead of the earth rising upward to meet the apple is that the earth is much more massive and so exerts a much greater pull.\" Please comment."},{id:"q14_2",text:"As defined in lecture 7, gravitational potential energy is U = mgy (positive above Earth's surface). But in this lecture, gravitational potential energy is U = −GmₑM/r (negative above Earth's surface). How can you reconcile these seemingly incompatible descriptions of gravitational potential energy?"}]},
];

const ACCEPTED_IMG=["image/png","image/jpeg","image/webp","image/gif"];
const BG="#1c1d1f",CARD="rgba(23,23,23,0.85)",TEAL="#00828c",TEAL_DIM="rgba(0,130,140,0.15)",MUTED="#a0a0a0",BORDER="rgba(255,255,255,0.08)";
const s={
  page:{minHeight:"100vh",background:BG,color:"#fff"},
  card:{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16},
  input:{background:"rgba(255,255,255,0.06)",border:`1px solid ${BORDER}`,color:"#fff",borderRadius:10,padding:"12px 16px",outline:"none",width:"100%",fontSize:14,boxSizing:"border-box"},
  btnPri:{background:TEAL,color:"#fff",border:"none",borderRadius:10,padding:"12px 20px",fontWeight:600,cursor:"pointer",width:"100%",fontSize:15},
  btnSec:{background:CARD,color:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,padding:"12px 20px",fontWeight:600,cursor:"pointer",width:"100%",fontSize:15},
  btnGhost:{background:"transparent",color:MUTED,border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13},
  btnDanger:{background:"rgba(127,29,29,0.4)",color:"#fca5a5",border:"1px solid rgba(127,29,29,0.6)",borderRadius:8,padding:"10px 16px",cursor:"pointer",width:"100%",fontSize:13,fontWeight:500},
  label:{color:MUTED,fontSize:13,fontWeight:500,display:"block",marginBottom:6},
  muted:{color:MUTED,fontSize:13},
  badge:(color)=>({background:color+"22",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}),
};

async function hashPw(pw,salt){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(salt+pw));return Array.from(new Uint8Array(b)).map(b=>b.toString(16).padStart(2,"0")).join("");}
function genSalt(){const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a).map(b=>b.toString(16).padStart(2,"0")).join("");}
async function verifyPw(input,hash,salt){return(await hashPw(input,salt))===hash;}
async function makeHash(pw){const salt=genSalt();return{hash:await hashPw(pw,salt),salt};}

function parseRoster(text){
  return text.split("\n").map(l=>l.trim()).filter(Boolean).reduce((acc,line)=>{
    const[lastName,firstName,studentId]=line.split(",").map(p=>p.trim());
    if(!lastName||!firstName||!studentId||lastName.toLowerCase()==="last name")return acc;
    return[...acc,{studentId,firstName,lastName,fullName:firstName+" "+lastName}];
  },[]).sort((a,b)=>a.lastName.localeCompare(b.lastName));
}

function parseGradesCSV(text){
  const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
  if(lines.length<2)return{students:[],quizColCount:0,detectedHeaders:""};
  const isTab=lines[0].includes("\t");
  const parseLine=line=>{
    if(isTab)return line.split("\t").map(f=>f.trim().replace(/^"|"$/g,""));
    const fields=[];let cur="",inQ=false;
    for(let i=0;i<line.length;i++){
      if(line[i]==='"'){inQ=!inQ;}else if(line[i]===","&&!inQ){fields.push(cur.trim());cur="";}else cur+=line[i];
    }
    fields.push(cur.trim());return fields;
  };
  const headers=parseLine(lines[0]);
  const quizCols=[];
  for(let i=0;i<headers.length;i++){const m=headers[i].match(/\bquiz\s*(\d+)/i);if(m)quizCols.push({colIdx:i,quizNum:parseInt(m[1])});}
  const students=lines.slice(1).reduce((acc,line)=>{
    const cols=parseLine(line);
    const lastName=cols[0]?.trim(),firstName=cols[1]?.trim();
    if(!lastName||!firstName)return acc;
    let studentId="";
    for(let i=2;i<=4&&i<cols.length;i++){const v=cols[i]?.trim();if(v&&/^\d+$/.test(v)){studentId=v;break;}}
    if(!studentId)return acc;
    studentId=studentId.padStart(7,"0");
    const scores=quizCols.reduce((s,{colIdx,quizNum})=>{
      const v=cols[colIdx]?.trim();
      if(v!==""&&v!==undefined&&v!==null){const n=parseFloat(v);if(!isNaN(n))s.push({quizNum,score:n});}
      return s;
    },[]);
    return[...acc,{lastName,firstName,studentId,fullName:firstName+" "+lastName,scores}];
  },[]);
  return{students,quizColCount:quizCols.length,detectedHeaders:headers.slice(0,8).join(" | ")};
}

async function checkImageReadability(imgData){
  const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:200,system:"You are checking whether a student's uploaded photo of a hand-drawn physics graph is legible enough to evaluate. Reply ONLY with valid JSON: {\"readable\":true} if the drawing is clear enough to assess, or {\"readable\":false,\"reason\":\"one short sentence telling the student specifically what to fix\"} if not.",messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:imgData.type,data:imgData.data}},{type:"text",text:"Is this image of a hand-drawn physics graph clear and legible enough to evaluate?"}]}]})});
  const data=await res.json();
  const text=data.content?.map(b=>b.text||"").join("")||"";
  try{return JSON.parse(text.replace(/```json\n?|```/g,"").trim());}catch{return{readable:true};}
}
async function evaluateAnswer(question,answer,history,imageData){
  const system="You are a Physics 1 teaching assistant evaluating student understanding.\n\nCRITICAL RULE: If the student's answer captures the essential correct idea — even if informal, incomplete in detail, or not perfectly worded — mark it CORRECT. You are checking for conceptual understanding, not a textbook-perfect response. When in doubt, mark it correct.\n\nOnly mark INCORRECT if the answer contains a clear conceptual error, is substantially missing the key idea, or is too vague to demonstrate any understanding.\n\nFor image submissions (motion graphs): accept the drawing if the key features are essentially correct.\n\nReply ONLY with valid JSON:\n- If adequate: {\"status\":\"correct\",\"message\":\"1-2 sentences confirming what they got right\"}\n- If not: {\"status\":\"incorrect\",\"message\":\"One focused Socratic question targeting the gap\"}";
  const userContent=imageData?[{type:"text",text:"Physics Question: "+question+"\n\nThe student submitted a drawing."+(answer?"\nNote: "+answer:"")},{type:"image",source:{type:"base64",media_type:imageData.type,data:imageData.data}}]:"Physics Question: "+question+"\n\nStudent Answer: "+answer;
  const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system,messages:[...history,{role:"user",content:userContent}]})});
  const data=await res.json();
  const text=data.content?.map(b=>b.text||"").join("")||"";
  try{return JSON.parse(text.replace(/```json\n?|```/g,"").trim());}catch{return{status:"incorrect",message:text||"Can you elaborate a bit more?"};}
}
function compressImage(file,maxPx=1200,quality=0.8){
  return new Promise((res,rej)=>{
    const reader=new FileReader();reader.onerror=rej;
    reader.onload=ev=>{
      const img=new Image();img.onerror=rej;
      img.onload=()=>{
        let{naturalWidth:w,naturalHeight:h}=img;
        if(w>maxPx||h>maxPx){if(w>=h){h=Math.round(h*maxPx/w);w=maxPx;}else{w=Math.round(w*maxPx/h);h=maxPx;}}
        const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        res({data:canvas.toDataURL("image/jpeg",quality).split(",")[1],type:"image/jpeg"});
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const dueToDate=due=>{if(!due)return null;if(due.length===10){const noon=new Date(due+'T12:00:00Z');const isEDT=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'short'}).format(noon).includes('EDT');return new Date(due+'T23:59:00'+(isEDT?'-04:00':'-05:00'));}return new Date(due);};
const isLate=due=>due&&new Date()>dueToDate(due);
const fmtDate=ts=>new Date(ts).toLocaleString();
const ptsPer=n=>{const b=Math.floor(10/n),r=10-b*n;return Array.from({length:n},(_,i)=>b+(i<r?1:0));};

function ChatMessages({messages,busy=false}){
  return(<>
    {messages.map((msg,i)=>{
      if(msg.type==="system")return(<div key={i} style={{display:"flex",justifyContent:"center"}}><div style={{...s.card,padding:"12px 20px",color:MUTED,fontSize:13,maxWidth:480,textAlign:"center",whiteSpace:"pre-line"}}>{msg.text}</div></div>);
      if(msg.type==="question")return(<div key={i} style={{background:TEAL_DIM,border:`2px solid ${TEAL}44`,borderRadius:14,padding:20}}><div style={{color:TEAL,fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Question {msg.num} of {msg.total} · {msg.pts} {msg.pts===1?"point":"points"}</div><p style={{color:"#fff",fontSize:14,lineHeight:1.7,margin:0,whiteSpace:"pre-wrap"}}>{msg.q.text}</p>{msg.q.requiresImage&&<div style={{marginTop:12,background:"rgba(0,130,140,0.1)",border:`1px solid ${TEAL}44`,borderRadius:8,padding:"10px 14px",fontSize:13,color:"rgba(255,255,255,0.7)"}}>Drawing required. Accepted formats: {msg.q.formatLabel}.</div>}</div>);
      if(msg.type==="student")return(<div key={i} style={{display:"flex",justifyContent:"flex-end"}}><div style={{background:TEAL,color:"#fff",borderRadius:"14px 14px 4px 14px",padding:"10px 16px",maxWidth:480,fontSize:14,lineHeight:1.6}}>{msg.imageUrl&&<img src={msg.imageUrl} alt="Drawing" style={{borderRadius:8,maxWidth:"100%",maxHeight:220,objectFit:"contain",marginBottom:msg.text?8:0}}/>}{msg.text&&<p style={{margin:0,whiteSpace:"pre-wrap"}}>{msg.text}</p>}</div></div>);
      if(msg.type==="tutor")return(<div key={i} style={{display:"flex",justifyContent:"flex-start"}}><div style={{background:msg.correct?"rgba(74,222,128,0.08)":"rgba(255,255,255,0.06)",border:`1px solid ${msg.correct?"rgba(74,222,128,0.25)":BORDER}`,borderRadius:"14px 14px 14px 4px",padding:"10px 16px",maxWidth:480,fontSize:14,lineHeight:1.6,color:msg.correct?"#bbf7d0":"#e2e8f0"}}>{msg.text}</div></div>);
      if(msg.type==="result"){
        const pct=msg.final/10,scoreColor=pct>=0.9?"#4ade80":pct>=0.7?"#a3e635":pct>=0.5?"#facc15":"#f87171";
        return(<div key={i} style={{...s.card,padding:28}}><div style={{textAlign:"center",marginBottom:20}}><h3 style={{color:"#fff",fontWeight:700,fontSize:22,margin:"0 0 4px"}}>{msg.practiceMode?"Practice Complete":"Quiz Complete"}</h3>{msg.practiceMode&&<p style={{color:TEAL,fontSize:13,margin:0}}>Practice run — no grade recorded.</p>}{!msg.practiceMode&&msg.late&&<p style={{color:"#facc15",fontSize:13,margin:0}}>⚠️ Late submission — half credit applied</p>}</div><div style={{textAlign:"center",margin:"20px 0"}}><span style={{fontSize:64,fontWeight:700,color:scoreColor}}>{msg.final}</span><span style={{fontSize:24,color:MUTED}}>/10</span>{!msg.practiceMode&&msg.late&&<p style={{color:MUTED,fontSize:13,marginTop:4}}>Raw: {msg.raw}/10 → {msg.final}/10 after late penalty</p>}</div><div style={{borderTop:`1px solid ${BORDER}`,paddingTop:16,display:"flex",flexDirection:"column",gap:10}}>{msg.questions.map((q,qi)=>(<div key={qi} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}><span style={{color:MUTED,flex:1,fontSize:13,lineHeight:1.5}}>Q{qi+1}: {q.text.length>70?q.text.slice(0,70)+"…":q.text}</span><span style={{fontFamily:"monospace",flexShrink:0,fontWeight:700,color:(msg.scores[qi]||0)===msg.pts[qi]?"#4ade80":"#f87171"}}>{msg.scores[qi]??0}/{msg.pts[qi]}</span></div>))}</div></div>);
      }
      return null;
    })}
    {busy&&(<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{...s.card,padding:"10px 16px",display:"flex",gap:4,alignItems:"center"}}>{[0,200,400].map(d=><span key={d} style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:TEAL,animation:"pulse 1.2s infinite",animationDelay:d+"ms"}}/>)}</div></div>)}
  </>);
}

function DragDropQuestion({q,onSubmit,busy}){
  const[blanks,setBlanks]=useState([null,null]);
  const dragSrc=useRef(null);const[dot,setDot]=useState(null);
  const bankWords=q.wordBank.filter(w=>!blanks.includes(w));
  const allFilled=blanks.every(b=>b!==null);
  const ds=(word,from)=>{dragSrc.current={word,from};};
  const dropBlank=i=>{const src=dragSrc.current;if(!src)return;setBlanks(prev=>{const n=[...prev];if(src.from==='bank'){n[i]=src.word;}else{const t=n[i];n[i]=src.word;n[src.from]=t;}return n;});setDot(null);dragSrc.current=null;};
  const dropBank=()=>{const src=dragSrc.current;if(!src||src.from==='bank')return;setBlanks(prev=>{const n=[...prev];n[src.from]=null;return n;});setDot(null);dragSrc.current=null;};
  const bSt=i=>({display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:80,height:34,borderRadius:8,border:`2px ${blanks[i]?"solid":"dashed"} ${dot==="b"+i?TEAL:blanks[i]?TEAL:BORDER}`,background:dot==="b"+i?TEAL_DIM:blanks[i]?"rgba(0,130,140,0.2)":"rgba(255,255,255,0.04)",color:blanks[i]?"#fff":MUTED,fontSize:13,fontWeight:600,cursor:"default",transition:"all 0.15s"});
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${BORDER}`,borderRadius:12,padding:"16px 20px",fontSize:14,lineHeight:2,color:"#fff",textAlign:"center"}}>
      A dot product results in a{" "}<span style={bSt(0)} onDragOver={e=>{e.preventDefault();setDot("b0");}} onDragLeave={()=>setDot(null)} onDrop={()=>dropBlank(0)}>{blanks[0]?<span draggable onDragStart={()=>ds(blanks[0],0)} style={{cursor:"grab"}}>{blanks[0]}</span>:<span style={{fontSize:11}}>drop here</span>}</span>, a cross product results in a{" "}<span style={bSt(1)} onDragOver={e=>{e.preventDefault();setDot("b1");}} onDragLeave={()=>setDot(null)} onDrop={()=>dropBlank(1)}>{blanks[1]?<span draggable onDragStart={()=>ds(blanks[1],1)} style={{cursor:"grab"}}>{blanks[1]}</span>:<span style={{fontSize:11}}>drop here</span>}</span>.
    </div>
    <div onDragOver={e=>{e.preventDefault();setDot("bank");}} onDragLeave={()=>setDot(null)} onDrop={dropBank} style={{border:`2px dashed ${dot==="bank"?TEAL:BORDER}`,borderRadius:12,padding:"14px 16px",minHeight:56,display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",justifyContent:"center",background:dot==="bank"?TEAL_DIM:"rgba(255,255,255,0.02)",transition:"all 0.15s"}}>
      {bankWords.length===0?<span style={{...s.muted,fontSize:12}}>Word bank — drag words back here to swap</span>:bankWords.map((w,i)=><span key={w+i} draggable onDragStart={()=>ds(w,"bank")} style={{background:TEAL,color:"#fff",borderRadius:8,padding:"6px 16px",fontWeight:600,fontSize:13,cursor:"grab",userSelect:"none"}}>{w}</span>)}
    </div>
    <div style={{display:"flex",gap:10}}>
      <button onClick={()=>setBlanks([null,null])} style={{...s.btnGhost,flex:"0 0 auto"}}>Reset</button>
      <button onClick={()=>allFilled&&!busy&&onSubmit(blanks)} disabled={!allFilled||busy} style={{...s.btnPri,opacity:(!allFilled||busy)?0.4:1}}>Submit Answer</button>
    </div>
  </div>);
}

function ManualAddStudent({roster,onAdd}){
  const[fn,setFn]=useState("");const[ln,setLn]=useState("");const[sid,setSid]=useState("");
  const[err,setErr]=useState("");const[ok,setOk]=useState("");
  const add=async()=>{
    setErr("");setOk("");
    const f=fn.trim(),l=ln.trim(),s=sid.trim();
    if(!f||!l||!s){setErr("All three fields are required.");return;}
    if(roster.some(r=>r.studentId===s)){setErr("A student with that ID already exists.");return;}
    await onAdd({firstName:f,lastName:l,studentId:s,fullName:f+" "+l});
    setFn("");setLn("");setSid("");setOk(f+" "+l+" added successfully.");setTimeout(()=>setOk(""),3000);
  };
  return(<div style={{...s.card,padding:20,marginBottom:16}}>
    <p style={{color:"#fff",fontWeight:600,fontSize:14,margin:"0 0 14px"}}>Add Student Manually</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:10,alignItems:"end"}}>
      <div><label style={s.label}>First Name</label><input style={s.input} placeholder="Jane" value={fn} onChange={e=>setFn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/></div>
      <div><label style={s.label}>Last Name</label><input style={s.input} placeholder="Smith" value={ln} onChange={e=>setLn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/></div>
      <div><label style={s.label}>Student ID</label><input style={s.input} placeholder="1234567" value={sid} onChange={e=>setSid(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/></div>
      <button onClick={add} style={{...s.btnPri,width:"auto",padding:"12px 20px",whiteSpace:"nowrap"}}>Add Student</button>
    </div>
    {err&&<p style={{color:"#f87171",fontSize:13,margin:"10px 0 0"}}>{err}</p>}
    {ok&&<p style={{color:"#4ade80",fontSize:13,margin:"10px 0 0"}}>✓ {ok}</p>}
  </div>);
}

// ── SyncBadge ────────────────────────────────────────────────────────────────
function SyncBadge({status,error}){
  if(status==='idle')return null;
  const cfg={saving:{color:"#facc15",label:"💾 Saving…"},saved:{color:"#4ade80",label:"✓ Saved"},error:{color:"#f87171",label:"⚠️ Save failed"}};
  const c=cfg[status]||cfg.saving;
  return <span style={{fontSize:12,color:c.color,fontWeight:500,maxWidth:320,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={error}>{c.label}{status==='error'&&error?`: ${error}`:''}</span>;
}

export default function App(){
  const[roster,setRoster]=useState([]);
  const[studentPws,setStudentPws]=useState({});
  const[dueDates,setDueDates]=useState({});
  const[submissions,setSubmissions]=useState([]);
  const[checkedSubs,setCheckedSubs]=useState({});
  const[settings,setSettings]=useState({passwordHash:null,passwordSalt:null});
  const[ready,setReady]=useState(false);
  const[syncStatus,setSyncStatus]=useState('idle');
  const[syncError,setSyncError]=useState('');
  const[fbConnStatus,setFbConnStatus]=useState('checking'); // 'checking'|'ok'|'error'
  const[fbConnError,setFbConnError]=useState('');

  const[screen,setScreen]=useState("home");
  const[nameQuery,setNameQuery]=useState("");
  const[selectedStudent,setSelectedStudent]=useState(null);
  const[highlightIdx,setHighlightIdx]=useState(-1);
  const[pwInput,setPwInput]=useState("");const[pwError,setPwError]=useState("");
  const[loggedInStudent,setLoggedInStudent]=useState(null);
  const[showStudentSettings,setShowStudentSettings]=useState(false);
  const[newPw1,setNewPw1]=useState("");const[newPw2,setNewPw2]=useState("");const[pwChangeMsg,setPwChangeMsg]=useState("");

  const[activeQuiz,setActiveQuiz]=useState(null);
  const[practiceMode,setPracticeMode]=useState(false);
  const[showLeaveConfirm,setShowLeaveConfirm]=useState(false);
  const[qIdx,setQIdx]=useState(0);const[apiHist,setApiHist]=useState([]);
  const[messages,setMessages]=useState([]);const[qScores,setQScores]=useState([]);
  const[input,setInput]=useState("");const[pendingFile,setPendingFile]=useState(null);
  const[pasteWarning,setPasteWarning]=useState(false);
  const[busy,setBusy]=useState(false);const[quizDone,setQuizDone]=useState(false);

  const[instPw,setInstPw]=useState("");const[instErr,setInstErr]=useState("");
  const[instTab,setInstTab]=useState("submissions");
  const[editPw,setEditPw]=useState("");
  const[openQuizzes,setOpenQuizzes]=useState({});
  const[dangerAction,setDangerAction]=useState(null);
  const[dangerPw,setDangerPw]=useState("");const[dangerErr,setDangerErr]=useState("");
  const[removeStudent,setRemoveStudent]=useState(null);
  const[removePw,setRemovePw]=useState("");const[removeErr,setRemoveErr]=useState("");
  const[viewingSub,setViewingSub]=useState(null);
  const[gradeImportMsg,setGradeImportMsg]=useState("");
  const[pwImportMsg,setPwImportMsg]=useState("");
  const[dueDateImportMsg,setDueDateImportMsg]=useState("");
  const[backupModal,setBackupModal]=useState(null);

  const chatRef=useRef(null);const detailRef=useRef(null);const inputRef=useRef(null);
  const fileInputRef=useRef(null);const rosterInputRef=useRef(null);
  const gradesInputRef=useRef(null);const backupInputRef=useRef(null);
  const pwImportRef=useRef(null);const dueDateImportRef=useRef(null);
  const syncTimer=useRef(null);

  // ── Load from Firebase on startup ──────────────────────────────────────────
  useEffect(()=>{
    (async()=>{
      // First run a round-trip connectivity test
      try{
        await fbConnectTest();
        setFbConnStatus('ok');
      }catch(e){
        setFbConnStatus('error');
        setFbConnError(e.message||String(e));
        setReady(true);
        return; // No point loading if Firebase is unreachable
      }
      try{
        const[rosterData,pwsData,datesData,settingsData,checkedData,subsData]=await Promise.all([
          fbGet('roster').catch(()=>null),
          fbGet('studentPws').catch(()=>null),
          fbGet('dueDates').catch(()=>null),
          fbGet('settings').catch(()=>null),
          fbGet('checkedSubs').catch(()=>null),
          fbGet('submissions').catch(()=>null),
        ]);
        if(Array.isArray(rosterData))setRoster(rosterData);
        if(pwsData&&typeof pwsData==='object')setStudentPws(pwsData);
        if(datesData&&typeof datesData==='object')setDueDates(datesData);
        if(checkedData&&typeof checkedData==='object')setCheckedSubs(checkedData);
        if(settingsData?.passwordHash){
          setSettings(settingsData);
        }else{
          const h=await makeHash("physics123");
          const ns={passwordHash:h.hash,passwordSalt:h.salt};
          setSettings(ns);
          await fbSet('settings',ns);
        }
        if(subsData&&typeof subsData==='object'){
          const allSubs=Object.values(subsData).flat().filter(Boolean);
          setSubmissions(allSubs);
        }
      }catch(e){console.error("Startup load error:",e);}
      setReady(true);
    })();
  },[]);

  // ── Scroll / focus ──────────────────────────────────────────────────────────
  const doScroll=useCallback(()=>{const el=chatRef.current;if(!el)return;el.scrollTop=el.scrollHeight-el.clientHeight;},[]);
  useLayoutEffect(()=>{doScroll();},[messages]);
  useLayoutEffect(()=>{doScroll();},[busy]);
  useEffect(()=>{if(screen==="quiz"&&!isYesNoQ&&!isDragDropQ&&!quizDone)requestAnimationFrame(()=>inputRef.current?.focus());},[qIdx,screen,quizDone]);
  const prevBusy=useRef(false);
  useEffect(()=>{
    if(prevBusy.current&&!busy&&screen==="quiz"&&!isYesNoQ&&!isDragDropQ&&!quizDone)requestAnimationFrame(()=>inputRef.current?.focus());
    prevBusy.current=busy;
  },[busy]);

  // ── Firebase save helper ───────────────────────────────────────────────────
  const fbSave=async(path,data)=>{
    setSyncStatus('saving');setSyncError('');
    clearTimeout(syncTimer.current);
    try{
      await fbSet(path,data);
      setSyncStatus('saved');
      syncTimer.current=setTimeout(()=>setSyncStatus('idle'),3000);
    }catch(e){
      const msg=e.message||String(e);
      console.error("fbSave error:",msg);
      setSyncError(msg);
      setSyncStatus('error');
      syncTimer.current=setTimeout(()=>setSyncStatus('idle'),8000);
    }
  };

  // ── Persist functions ──────────────────────────────────────────────────────
  const saveRoster=async r=>{setRoster(r);await fbSave('roster',r);};
  const saveStudentPws=async p=>{setStudentPws(p);await fbSave('studentPws',p);};
  const saveDueDates=async d=>{setDueDates(d);await fbSave('dueDates',d);};
  const saveSettings=async s=>{setSettings(s);await fbSave('settings',s);};
  const saveChecked=async c=>{setCheckedSubs(c);await fbSave('checkedSubs',c);};

  const saveSubs=async newSubs=>{
    setSubmissions(newSubs);
    // Group by studentId — each student's submissions live under /submissions/{studentId}
    const byStudent={};
    newSubs.forEach(s=>{
      if(!byStudent[s.studentId])byStudent[s.studentId]=[];
      byStudent[s.studentId].push(s);
    });
    await fbSave('submissions',byStudent);
  };

  // ── Backup export ──────────────────────────────────────────────────────────
  const exportAllData=()=>{
    const snapshot={version:2,exportedAt:new Date().toISOString(),roster,studentPws,dueDates,submissions,checkedSubs,settings};
    const json=JSON.stringify(snapshot,null,2);
    const now=new Date(),pad=n=>String(n).padStart(2,"0");
    const stamp=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const filename=`newton-backup-${stamp}.json`;
    setBackupModal({filename,json});
    try{const blob=new Blob([json],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{}
  };

  const onBackupImport=e=>{
    const file=e.target.files[0];if(!file)return;
    const r=new FileReader();
    r.onload=async ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.version){alert("⚠️ Invalid backup file.");return;}
        if(data.submissions&&data.checkedSubs){
          const cids=new Set(Object.keys(data.checkedSubs));
          data.submissions=data.submissions.map(s=>cids.has(s.id)?{...s,dialogue:null}:s);
        }
        if(data.settings)await saveSettings(data.settings);
        if(data.roster)await saveRoster(data.roster);
        if(data.studentPws)await saveStudentPws(data.studentPws);
        if(data.dueDates)await saveDueDates(data.dueDates);
        if(data.checkedSubs)await saveChecked(data.checkedSubs);
        if(data.submissions)await saveSubs(data.submissions);
        alert("✅ Restore complete!");
      }catch(err){alert("⚠️ Restore failed: "+(err?.message||"unknown error"));}
    };
    r.readAsText(file);e.target.value="";
  };

  // ── Auth ───────────────────────────────────────────────────────────────────
  const handleStudentLogin=async()=>{
    if(!selectedStudent)return;
    const stored=studentPws[selectedStudent.studentId];let ok=false;
    if(!stored){ok=pwInput===selectedStudent.studentId;if(ok){const h=await makeHash(pwInput);await saveStudentPws({...studentPws,[selectedStudent.studentId]:h});}}
    else if(typeof stored==="string"){ok=pwInput===stored;if(ok){const h=await makeHash(pwInput);await saveStudentPws({...studentPws,[selectedStudent.studentId]:h});}}
    else{ok=await verifyPw(pwInput,stored.hash,stored.salt);}
    if(ok){setLoggedInStudent(selectedStudent);setPwInput("");setPwError("");setShowStudentSettings(false);setScreen("student-portal");}
    else setPwError("Incorrect password.");
  };
  const handleChangePassword=async()=>{
    setPwChangeMsg("");
    if(!newPw1.trim()){setPwChangeMsg("Password cannot be empty.");return;}
    if(newPw1!==newPw2){setPwChangeMsg("Passwords do not match.");return;}
    if(newPw1.length<4){setPwChangeMsg("Password must be at least 4 characters.");return;}
    const h=await makeHash(newPw1);await saveStudentPws({...studentPws,[loggedInStudent.studentId]:h});
    setNewPw1("");setNewPw2("");setPwChangeMsg("✅ Password updated successfully!");
  };
  const handleStudentLogout=()=>{setLoggedInStudent(null);setSelectedStudent(null);setNameQuery("");setShowStudentSettings(false);setScreen("home");};
  const doLogin=async()=>{
    if(!settings.passwordHash){setInstErr("Settings still loading.");return;}
    const ok=await verifyPw(instPw,settings.passwordHash,settings.passwordSalt);
    if(ok){setInstErr("");setEditPw("");setScreen("instructor");}else setInstErr("Incorrect password.");
  };
  const confirmDanger=(label,onConfirm)=>{setDangerAction({label,onConfirm});setDangerPw("");setDangerErr("");};
  const executeDanger=async()=>{
    if(!settings.passwordHash){setDangerErr("Settings not loaded.");return;}
    const ok=await verifyPw(dangerPw,settings.passwordHash,settings.passwordSalt);
    if(!ok){setDangerErr("Incorrect password.");return;}
    dangerAction.onConfirm();setDangerAction(null);setDangerPw("");setDangerErr("");
  };

  // ── Quiz helpers ───────────────────────────────────────────────────────────
  const quizzes=QUIZZES.map(q=>({...q,dueDate:dueDates[q.id]||null}));
  const currentQ=activeQuiz?.questions[qIdx];
  const isImageQ=!!currentQ?.requiresImage,isYesNoQ=!!currentQ?.yesNo,isDragDropQ=!!currentQ?.dragDrop;
  const completedQuizIds=new Set(submissions.filter(s=>s.studentId===loggedInStudent?.studentId).map(s=>s.quizId));
  const filteredRoster=nameQuery.trim().length===0?[]:roster.filter(s=>{const q=nameQuery.toLowerCase();return s.fullName.toLowerCase().includes(q)||s.lastName.toLowerCase().includes(q)||s.firstName.toLowerCase().includes(q);}).slice(0,8);

  const advanceOrFinish=async(quiz,nScores,afterMsgs,nextIdx)=>{
    if(nextIdx>=quiz.questions.length){await finishQuiz(quiz,nScores,afterMsgs);}
    else{const nPts=ptsPer(quiz.questions.length);setMessages([...afterMsgs,{id:Date.now()+2,type:"question",q:quiz.questions[nextIdx],num:nextIdx+1,total:quiz.questions.length,pts:nPts[nextIdx]}]);setQIdx(nextIdx);setApiHist([]);}
  };
  const startQuiz=(quiz,isPractice=false)=>{
    setPracticeMode(isPractice);setActiveQuiz(quiz);setQIdx(0);setApiHist([]);
    setQScores(new Array(quiz.questions.length).fill(null));
    setQuizDone(false);setInput("");setPendingFile(null);setBusy(false);setShowLeaveConfirm(false);
    const late=isLate(quiz.dueDate);
    setMessages([
      {id:0,type:"system",text:(isPractice?"Practice Mode — this run will not be submitted for a grade\n\n":"")+"📚 "+quiz.title+"  •  "+loggedInStudent.fullName+(late&&!isPractice?"\n\n⚠️ This quiz is past the due date. Your score will be halved.":"")},
      {id:1,type:"question",q:quiz.questions[0],num:1,total:quiz.questions.length,pts:ptsPer(quiz.questions.length)[0]}
    ]);
    setScreen("quiz");
  };
  const handleLeaveQuiz=()=>{if(quizDone){setScreen("student-portal");return;}setShowLeaveConfirm(true);};
  const confirmLeave=()=>{setShowLeaveConfirm(false);setScreen("student-portal");};
  const onFileSelect=async e=>{
    const file=e.target.files[0];if(!file)return;
    if(!ACCEPTED_IMG.includes(file.type)){alert("Please upload PNG, JPG, WEBP, or GIF.");e.target.value="";return;}
    const b64=await compressImage(file);const previewUrl=`data:${b64.type};base64,${b64.data}`;
    setPendingFile({file,previewUrl,base64:b64,readability:"checking"});e.target.value="";
    try{const result=await checkImageReadability(b64);setPendingFile(prev=>prev?{...prev,readability:result.readable?"ok":{status:"fail",reason:result.reason||"Image is not legible enough."}}:null);}
    catch{setPendingFile(prev=>prev?{...prev,readability:"ok"}:null);}
  };
  const clearFile=()=>{setPendingFile(null);};
  const submitYesNo=async answer=>{
    if(busy)return;setBusy(true);
    const pts=ptsPer(activeQuiz.questions.length),qPts=pts[qIdx];
    const reply=answer?"Great — glad you're all set! Make sure to keep it handy throughout the semester.":"No worries — please contact your instructor as soon as possible to get access sorted out.";
    const nScores=[...qScores];nScores[qIdx]=qPts;setQScores(nScores);
    const newMsgs=[...messages,{id:Date.now(),type:"student",text:answer?"Yes":"No"},{id:Date.now()+1,type:"tutor",text:"✅ "+reply,correct:true}];
    await advanceOrFinish(activeQuiz,nScores,newMsgs,qIdx+1);setBusy(false);
  };
  const submitDragDrop=async blanks=>{
    if(busy)return;setBusy(true);
    const q=activeQuiz.questions[qIdx],pts=ptsPer(activeQuiz.questions.length),qPts=pts[qIdx];
    const correct=blanks[0]===q.correctBlanks[0]&&blanks[1]===q.correctBlanks[1];
    const nScores=[...qScores];
    const newMsgs=[...messages,{id:Date.now(),type:"student",text:"Dot product → "+blanks[0]+", Cross product → "+blanks[1]}];
    if(correct){
      nScores[qIdx]=qPts;setQScores(nScores);
      await advanceOrFinish(activeQuiz,nScores,[...newMsgs,{id:Date.now()+1,type:"tutor",text:"✅ Exactly right! The dot product yields a scalar, while the cross product yields a vector.",correct:true}],qIdx+1);
    }else{
      setMessages([...newMsgs,{id:Date.now()+1,type:"tutor",text:blanks[0]==="vector"&&blanks[1]==="scalar"?"Those are swapped — think about which operation gives a single number (like work = F·d) and which gives a new vector (like torque = r×F).":"Not quite. Consider: work is calculated using a dot product and gives a single number — what does that tell you about the type of quantity it produces?"}]);
    }
    setBusy(false);
  };
  const submitAnswer=async()=>{
    if(busy)return;
    if(isImageQ&&!pendingFile&&!input.trim())return;
    if(!isImageQ&&!input.trim())return;
    const ans=input.trim(),imgData=pendingFile?.base64||null,previewUrl=pendingFile?.previewUrl||null;
    setInput("");clearFile();setBusy(true);
    const q=activeQuiz.questions[qIdx],pts=ptsPer(activeQuiz.questions.length),qPts=pts[qIdx];
    const newMsgs=[...messages,{id:Date.now(),type:"student",text:ans||null,imageUrl:previewUrl}];
    setMessages(newMsgs);
    try{
      const result=await evaluateAnswer(q.text,ans,apiHist,imgData);
      const histUser=imgData?"Physics Question: "+q.text+"\n\n[Student submitted a drawing"+(ans?". Note: "+ans:"")+"]":"Physics Question: "+q.text+"\n\nStudent Answer: "+ans;
      setApiHist([...apiHist,{role:"user",content:histUser},{role:"assistant",content:JSON.stringify(result)}]);
      if(result.status==="correct"){
        const nScores=[...qScores];nScores[qIdx]=qPts;setQScores(nScores);
        await advanceOrFinish(activeQuiz,nScores,[...newMsgs,{id:Date.now()+1,type:"tutor",text:"✅ "+result.message,correct:true}],qIdx+1);
      }else{setMessages([...newMsgs,{id:Date.now()+1,type:"tutor",text:result.message}]);}
    }catch{setMessages([...newMsgs,{id:Date.now()+1,type:"tutor",text:"⚠️ Error evaluating your answer. Please try again."}]);}
    setBusy(false);
  };
  const finishQuiz=async(quiz,scores,curMsgs)=>{
    const raw=scores.reduce((a,b)=>a+(b||0),0),late=isLate(quiz.dueDate);
    const final=late?parseFloat((raw*0.5).toFixed(1)):raw;
    const resultMsg={id:Date.now()+10,type:"result",raw,final,late,scores,questions:quiz.questions,pts:ptsPer(quiz.questions.length),practiceMode};
    setQuizDone(true);setMessages([...curMsgs,resultMsg]);
    if(!practiceMode){
      const sub={id:"sub_"+Date.now(),studentName:loggedInStudent.fullName,studentId:loggedInStudent.studentId,quizId:quiz.id,quizTitle:quiz.title,rawScore:raw,score:final,late,timestamp:new Date().toISOString(),dialogue:[...curMsgs,resultMsg].map(({imageUrl,...m})=>m)};
      await saveSubs([...submissions,sub]);
    }
  };

  const toggleChecked=async subId=>{
    const nc={...checkedSubs};
    if(nc[subId]){delete nc[subId];}
    else{nc[subId]=true;}
    await saveChecked(nc);
  };
  const toggleQuizOpen=qid=>setOpenQuizzes(o=>({...o,[qid]:!o[qid]}));
  const onRosterUpload=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=async ev=>{const parsed=parseRoster(ev.target.result);await saveRoster(parsed);alert("✅ Roster uploaded: "+parsed.length+" students loaded.");};r.readAsText(file);e.target.value="";};

  const onGradesUpload=e=>{
    const file=e.target.files[0];if(!file)return;setGradeImportMsg("");
    const r=new FileReader();
    r.onload=async ev=>{
      const{students,quizColCount,detectedHeaders}=parseGradesCSV(ev.target.result);
      if(!students.length){setGradeImportMsg("⚠️ No valid rows found.");e.target.value="";return;}
      const importedIds=new Set(students.map(s=>s.studentId));
      const keptRoster=roster.filter(r=>!importedIds.has(r.studentId));
      const newRosterEntries=students.map(({studentId,firstName,lastName,fullName})=>({studentId,firstName,lastName,fullName}));
      await saveRoster([...keptRoster,...newRosterEntries].sort((a,b)=>a.lastName.localeCompare(b.lastName)));
      const newPws={...studentPws};students.forEach(s=>{delete newPws[s.studentId];});
      await saveStudentPws(newPws);
      const kept=submissions.filter(s=>!s.imported);const added=[];let scoreCount=0;
      for(const stu of students){
        for(const{quizNum,score}of stu.scores){
          const qId="q"+quizNum,qDef=QUIZZES.find(q=>q.id===qId);
          added.push({id:"imported_"+stu.studentId+"_"+qId+"_"+Date.now()+"_"+Math.random(),studentName:stu.fullName,studentId:stu.studentId,quizId:qId,quizTitle:qDef?qDef.title:"Quiz "+quizNum,rawScore:score,score,late:false,timestamp:new Date().toISOString(),imported:true,dialogue:null});
          scoreCount++;
        }
      }
      await saveSubs([...kept,...added]);
      if(scoreCount===0)setGradeImportMsg("✅ Roster: "+newRosterEntries.length+" students imported. ⚠️ No quiz scores found ("+quizColCount+" quiz columns detected). First 8 headers: "+detectedHeaders);
      else setGradeImportMsg("✅ Roster: "+newRosterEntries.length+" students. Grades: "+scoreCount+" score"+(scoreCount!==1?"s":"")+" imported. Passwords reset to Student IDs.");
    };
    r.readAsText(file);e.target.value="";
  };

  const onPwImport=e=>{
    const file=e.target.files[0];if(!file)return;setPwImportMsg("");
    const r=new FileReader();
    r.onload=async ev=>{
      try{
        const data=JSON.parse(ev.target.result);const pws=data.studentPws||data;
        const valid=Object.entries(pws).every(([,v])=>v&&typeof v.hash==="string"&&typeof v.salt==="string");
        if(!valid){setPwImportMsg("⚠️ Invalid password file format.");return;}
        await saveStudentPws({...studentPws,...pws});
        setPwImportMsg("✅ "+Object.keys(pws).length+" password"+(Object.keys(pws).length!==1?"s":"")+" restored.");
      }catch{setPwImportMsg("⚠️ Could not parse file.");}
    };
    r.readAsText(file);e.target.value="";
  };

  const onDueDateImport=e=>{
    const file=e.target.files[0];if(!file)return;setDueDateImportMsg("");
    const r=new FileReader();
    r.onload=async ev=>{
      try{
        const cleaned=ev.target.result.replace(/,\s*([}\]])/g,"$1");
        const data=JSON.parse(cleaned);const dates=data.dueDates||data;
        const valid=Object.entries(dates).every(([k,v])=>/^q\d+$/.test(k)&&typeof v==="string");
        if(!valid){setDueDateImportMsg("⚠️ Invalid due dates file format.");return;}
        await saveDueDates(dates);
        setDueDateImportMsg("✅ "+Object.keys(dates).length+" due date"+(Object.keys(dates).length!==1?"s":"")+" restored.");
      }catch{setDueDateImportMsg("⚠️ Could not parse file.");}
    };
    r.readAsText(file);e.target.value="";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if(!ready)return <div style={{...s.page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><span style={{color:TEAL,fontSize:18}}>Loading…</span><span style={{color:MUTED,fontSize:13}}>Testing Firebase connection</span></div>;

  if(fbConnStatus==='error')return(
    <div style={{...s.page,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:520,width:"100%",...s.card,padding:32,display:"flex",flexDirection:"column",gap:16}}>
        <h2 style={{color:"#f87171",fontWeight:700,fontSize:20,margin:0}}>⚠️ Firebase Unreachable</h2>
        <p style={{...s.muted,margin:0,lineHeight:1.6}}>The app cannot connect to Firebase. This is likely because the Claude artifact sandbox restricts outbound connections to <code style={{background:"rgba(255,255,255,0.08)",padding:"1px 6px",borderRadius:4}}>firebaseio.com</code>.</p>
        <div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"12px 16px",fontFamily:"monospace",fontSize:12,color:"#fca5a5",wordBreak:"break-all"}}>{fbConnError}</div>
        <p style={{...s.muted,margin:0,lineHeight:1.6}}>Please share this error message so we can find a working alternative.</p>
      </div>
    </div>
  );

  if(backupModal)return(
    <div style={{...s.page,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:640,width:"100%",...s.card,padding:28,display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
          <div><h2 style={{color:"#fff",fontWeight:700,fontSize:18,margin:"0 0 4px"}}>Backup Ready</h2><p style={{...s.muted,margin:0,fontSize:12,fontFamily:"monospace"}}>{backupModal.filename}</p></div>
          <button onClick={()=>setBackupModal(null)} style={{background:"none",border:"none",color:MUTED,fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{background:"rgba(0,130,140,0.08)",border:`1px solid ${TEAL}33`,borderRadius:10,padding:"12px 16px",fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6}}>
          If a download didn't start automatically, use <strong style={{color:"#fff"}}>Copy JSON</strong> below and save as <code style={{background:"rgba(255,255,255,0.08)",padding:"1px 5px",borderRadius:4}}>{backupModal.filename}</code>.
        </div>
        <textarea readOnly value={backupModal.json} style={{...s.input,fontFamily:"monospace",fontSize:11,height:220,resize:"vertical",lineHeight:1.4,color:MUTED}} onClick={e=>e.target.select()}/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{const el=document.querySelector("textarea[readonly]");if(!el)return;el.select();el.setSelectionRange(0,99999);document.execCommand("copy");}} style={{...s.btnPri,flex:1}}>Copy JSON to Clipboard</button>
          <button onClick={()=>setBackupModal(null)} style={{...s.btnGhost,flex:"0 0 auto"}}>Close</button>
        </div>
      </div>
    </div>
  );

  if(screen==="home")return(
    <div style={{...s.page,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:400,width:"100%",textAlign:"center",marginBottom:40}}>
        <h1 style={{fontSize:72,fontWeight:700,color:TEAL,margin:0}}>Newton</h1>
      </div>
      <div style={{maxWidth:400,width:"100%",display:"flex",flexDirection:"column",gap:12}}>
        <button onClick={()=>{setNameQuery("");setSelectedStudent(null);setPwError("");setScreen("student-search");}} style={s.btnSec}>Student Login</button>
        <button onClick={()=>setScreen("inst-login")} style={s.btnSec}>Instructor Portal</button>
      </div>
    </div>
  );

  const handleSelectStudent=st=>{setSelectedStudent(st);setPwInput("");setPwError("");setNameQuery("");setScreen("student-pw");};

  if(screen==="student-search")return(
    <div style={{...s.page,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:420,width:"100%",...s.card,padding:36}}>
        <button onClick={()=>setScreen("home")} style={{...s.btnGhost,marginBottom:24,width:"auto"}}>← Back</button>
        <div style={{textAlign:"center",marginBottom:28}}>
          <h2 style={{fontSize:22,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Student Login</h2>
          <p style={{...s.muted,margin:0}}>Start typing your name to find yourself on the roster</p>
        </div>
        {roster.length===0&&<div style={{background:"rgba(202,138,4,0.1)",border:"1px solid rgba(202,138,4,0.3)",borderRadius:8,padding:"10px 14px",color:"#fde047",fontSize:13,marginBottom:16}}>No roster uploaded yet. Please contact your instructor.</div>}
        <div style={{position:"relative"}}>
          <input style={s.input} placeholder="Begin typing your name…" value={nameQuery}
            onChange={e=>{setNameQuery(e.target.value);setHighlightIdx(-1);}}
            onKeyDown={e=>{
              if(e.key==="ArrowDown"){e.preventDefault();setHighlightIdx(i=>Math.min(i+1,filteredRoster.length-1));}
              else if(e.key==="ArrowUp"){e.preventDefault();setHighlightIdx(i=>Math.max(i-1,0));}
              else if(e.key==="Enter"){e.preventDefault();const st=highlightIdx>=0?filteredRoster[highlightIdx]:filteredRoster.length===1?filteredRoster[0]:null;if(st)handleSelectStudent(st);}
            }} autoFocus/>
          {filteredRoster.length>0&&(<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#252627",border:`1px solid ${BORDER}`,borderRadius:10,overflow:"hidden",zIndex:10,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            {filteredRoster.map((st,i)=>(<button key={st.studentId} onClick={()=>handleSelectStudent(st)} style={{width:"100%",textAlign:"left",padding:"12px 16px",background:highlightIdx===i?TEAL_DIM:"transparent",border:"none",borderBottom:`1px solid ${BORDER}`,color:highlightIdx===i?TEAL:"#fff",fontSize:14,cursor:"pointer",fontWeight:highlightIdx===i?600:400}} onMouseEnter={()=>setHighlightIdx(i)}>{st.fullName}</button>))}
          </div>)}
          {nameQuery.trim().length>0&&filteredRoster.length===0&&roster.length>0&&(<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#252627",border:`1px solid ${BORDER}`,borderRadius:10,padding:"12px 16px",color:MUTED,fontSize:13,zIndex:10}}>No matches found. Check your spelling.</div>)}
        </div>
      </div>
    </div>
  );

  if(screen==="student-pw"&&selectedStudent)return(
    <div style={{...s.page,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:420,width:"100%",...s.card,padding:36}}>
        <button onClick={()=>setScreen("student-search")} style={{...s.btnGhost,marginBottom:24,width:"auto"}}>← Back</button>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{background:TEAL_DIM,border:`1px solid ${TEAL}44`,borderRadius:12,padding:"12px 20px",display:"inline-block",marginBottom:16}}><p style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>{selectedStudent.fullName}</p></div>
          <p style={{...s.muted,margin:0}}>Enter your password to continue</p>
        </div>
        <input type="password" style={{...s.input,marginBottom:10}} placeholder="Password" value={pwInput} onChange={e=>setPwInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleStudentLogin()} autoFocus/>
        {pwError&&<p style={{color:"#f87171",fontSize:13,margin:"0 0 10px"}}>{pwError}</p>}
        <button onClick={handleStudentLogin} style={{...s.btnPri,marginBottom:10}}>Login</button>
        <button onClick={()=>{setSelectedStudent(null);setScreen("student-search");}} style={s.btnGhost}>Not me — go back</button>
        {!studentPws[selectedStudent.studentId]&&(<div style={{marginTop:16,background:"rgba(202,138,4,0.08)",border:"1px solid rgba(202,138,4,0.25)",borderRadius:10,padding:"12px 16px",display:"flex",gap:12,alignItems:"flex-start"}}><span style={{color:"#fbbf24",fontSize:18,flexShrink:0}}>💡</span><div><p style={{color:"#fbbf24",fontWeight:600,fontSize:13,margin:"0 0 4px"}}>First time logging in?</p><p style={{color:"rgba(251,191,36,0.7)",fontSize:13,margin:0}}>Your initial password is your <strong>Student ID number</strong>.</p></div></div>)}
      </div>
    </div>
  );

  if(screen==="student-portal"&&loggedInStudent){
    if(showStudentSettings)return(
      <div style={{...s.page,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{maxWidth:420,width:"100%",...s.card,padding:36}}>
          <button onClick={()=>{setShowStudentSettings(false);setNewPw1("");setNewPw2("");setPwChangeMsg("");}} style={{...s.btnGhost,marginBottom:24,width:"auto"}}>← Back to quizzes</button>
          <h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>Account Settings</h2>
          <p style={{...s.muted,marginBottom:28}}>{loggedInStudent.fullName}</p>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div><label style={s.label}>New Password</label><input type="password" style={s.input} placeholder="New password" value={newPw1} onChange={e=>setNewPw1(e.target.value)}/></div>
            <div><label style={s.label}>Confirm New Password</label><input type="password" style={s.input} placeholder="Confirm password" value={newPw2} onChange={e=>setNewPw2(e.target.value)}/></div>
            {pwChangeMsg&&<p style={{color:pwChangeMsg.startsWith("✅")?"#4ade80":"#f87171",fontSize:13,margin:0}}>{pwChangeMsg}</p>}
            <button onClick={handleChangePassword} style={s.btnPri}>Update Password</button>
          </div>
        </div>
      </div>
    );
    const completedCount=completedQuizIds.size;
    return(
      <div style={{...s.page,display:"flex",flexDirection:"column",alignItems:"center",padding:24}}>
        <div style={{maxWidth:860,width:"100%",...s.card,padding:28}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <div><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>Hi, {loggedInStudent.firstName}!</h2><p style={{...s.muted,margin:0}}>Select a quiz to begin</p></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={handleStudentLogout} style={{...s.btnGhost,width:"auto",padding:"6px 14px",fontSize:13}}>Log Out</button>
              <button onClick={()=>setShowStudentSettings(true)} style={{background:"none",border:"none",color:MUTED,fontSize:20,cursor:"pointer"}} title="Account settings">⚙️</button>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"12px 0 20px"}}>
            <div style={{flex:1,background:"rgba(255,255,255,0.08)",borderRadius:99,height:6,overflow:"hidden"}}><div style={{background:TEAL,height:6,borderRadius:99,width:(completedCount/QUIZZES.length*100)+"%",transition:"width 0.4s"}}/></div>
            <span style={{...s.muted,fontSize:12,flexShrink:0}}>{completedCount}/{QUIZZES.length} completed</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {quizzes.map(quiz=>{
              const late=isLate(quiz.dueDate),completed=completedQuizIds.has(quiz.id);
              const sub=completed?[...submissions].reverse().find(s=>s.studentId===loggedInStudent?.studentId&&s.quizId===quiz.id):null;
              return(<div key={quiz.id} style={{borderRadius:12,border:`1px solid ${completed?"rgba(0,130,140,0.3)":BORDER}`,background:completed?TEAL_DIM:"rgba(255,255,255,0.02)",padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{flexShrink:0,width:22,height:22,borderRadius:"50%",border:`2px solid ${completed?TEAL:BORDER}`,background:completed?TEAL:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700}}>{completed&&"✓"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:completed?TEAL:"#fff",fontWeight:600,fontSize:13}}>{quiz.title}</div>
                  <div style={{...s.muted,fontSize:12,marginTop:3,display:"flex",flexWrap:"wrap",gap:8}}>
                    <span>{quiz.questions.length} question{quiz.questions.length>1?"s":""}  •  10 pts</span>
                    {quiz.questions.some(q=>q.requiresImage)&&<span style={{color:"#a78bfa"}}>Drawing required</span>}
                    {completed&&sub?<span style={{color:sub.score>=8?"#4ade80":sub.score>=6?"#facc15":sub.score>=4?"#fb923c":"#f87171",fontWeight:600}}>Score: {sub.score}/10{sub.late?" · submitted late":""}{sub.imported?" · graded off-platform":""}</span>
                      :quiz.dueDate&&<span style={{color:late?"#f87171":"#4ade80"}}>{late?"Past due (½ credit)":"Due "+dueToDate(quiz.dueDate).toLocaleDateString('en-US',{timeZone:'America/New_York'})+" · 11:59 PM ET"}</span>}
                  </div>
                </div>
                {completed?<button onClick={()=>startQuiz(quiz,true)} style={{...s.btnGhost,flexShrink:0,fontSize:12,padding:"6px 12px"}}>Practice</button>
                  :<button onClick={()=>startQuiz(quiz,false)} style={{...s.btnPri,flexShrink:0,width:"auto",fontSize:12,padding:"6px 14px"}}>Start →</button>}
              </div>);
            })}
          </div>
        </div>
      </div>
    );
  }

  if(screen==="quiz")return(
    <div style={{...s.page,display:"flex",flexDirection:"column"}}>
      {showLeaveConfirm&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
        <div style={{...s.card,padding:24,width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(0,0,0,0.6)"}}>
          <h3 style={{color:"#fff",fontWeight:700,fontSize:18,margin:"0 0 8px"}}>Leave quiz?</h3>
          <p style={{...s.muted,marginBottom:20}}>Your progress will be lost and this attempt will not be saved.</p>
          <div style={{display:"flex",gap:10}}><button onClick={()=>setShowLeaveConfirm(false)} style={{...s.btnSec,flex:1}}>Keep going</button><button onClick={confirmLeave} style={{...s.btnPri,flex:1,background:"#b91c1c"}}>Leave</button></div>
        </div>
      </div>)}
      <div style={{background:CARD,borderBottom:`1px solid ${BORDER}`,padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button onClick={handleLeaveQuiz} style={{...s.btnGhost,padding:"6px 12px",width:"auto"}}>← Back</button>
          <div style={{width:1,height:20,background:BORDER}}/>
          <div><div style={{color:"#fff",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:8}}>{activeQuiz?.title}{practiceMode&&<span style={s.badge(TEAL)}>Practice</span>}</div><p style={{...s.muted,fontSize:12,margin:0}}>{loggedInStudent?.fullName}</p></div>
        </div>
        {!quizDone&&<div style={{...s.muted,fontFamily:"monospace"}}>Q{qIdx+1}/{activeQuiz?.questions.length}</div>}
      </div>
      <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:"20px 16px",display:"flex",flexDirection:"column",gap:14,maxWidth:720,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
        <ChatMessages messages={messages} busy={busy}/>
        {quizDone&&<button onClick={()=>setScreen("student-portal")} style={{...s.btnPri,marginTop:8}}>Back to Quiz List</button>}
      </div>
      {!quizDone&&(<div style={{background:CARD,borderTop:`1px solid ${BORDER}`,padding:16,flexShrink:0}}>
        <div style={{maxWidth:720,margin:"0 auto",display:"flex",flexDirection:"column",gap:10}}>
          {isYesNoQ?(<div style={{display:"flex",gap:10}}>
            <button onClick={()=>submitYesNo(true)} disabled={busy} style={{flex:1,background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.3)",color:"#4ade80",borderRadius:12,padding:"14px",fontWeight:700,fontSize:18,cursor:"pointer",opacity:busy?0.4:1}}>Yes</button>
            <button onClick={()=>submitYesNo(false)} disabled={busy} style={{flex:1,...s.btnSec,fontSize:18,opacity:busy?0.4:1}}>No</button>
          </div>):isDragDropQ?(<DragDropQuestion key={qIdx} q={currentQ} onSubmit={submitDragDrop} busy={busy}/>):(
            <>
              {pendingFile&&(<div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12,...s.card,padding:12}}>
                  <img src={pendingFile.previewUrl} alt="Preview" style={{height:72,width:72,objectFit:"cover",borderRadius:8,border:`1px solid ${BORDER}`,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{color:"#fff",fontSize:12,fontWeight:500,margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pendingFile.file.name}</p>
                    <p style={{...s.muted,fontSize:12,margin:"0 0 4px"}}>{(pendingFile.file.size/1024).toFixed(1)} KB</p>
                    {pendingFile.readability==="checking"&&<p style={{color:TEAL,fontSize:12,margin:0}}>🔍 Checking image quality…</p>}
                    {pendingFile.readability==="ok"&&<p style={{color:"#4ade80",fontSize:12,margin:0}}>✓ Image looks clear and readable</p>}
                    {pendingFile.readability?.status==="fail"&&<p style={{color:"#f87171",fontSize:12,margin:0}}>⚠️ {pendingFile.readability.reason}</p>}
                  </div>
                  <button onClick={clearFile} style={{background:"none",border:"none",color:MUTED,fontSize:20,cursor:"pointer",lineHeight:1,flexShrink:0}}>×</button>
                </div>
                {pendingFile.readability?.status==="fail"&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.5}}>Please retake the photo and re-upload. Tips: make sure the drawing is well-lit, hold the camera steady, and ensure the full page is visible.</div>}
              </div>)}
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                {isImageQ&&(<><input ref={fileInputRef} type="file" accept={ACCEPTED_IMG.join(",")} onChange={onFileSelect} style={{display:"none"}}/><button onClick={()=>fileInputRef.current?.click()} disabled={busy} style={{background:"rgba(167,139,250,0.1)",border:"1px solid rgba(167,139,250,0.3)",color:"#a78bfa",borderRadius:10,padding:"0 14px",cursor:"pointer",flexShrink:0,alignSelf:"stretch",display:"flex",alignItems:"center",fontSize:18}}>🖼</button></>)}
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
                  <textarea ref={inputRef} style={{...s.input,resize:"none",lineHeight:1.5}} placeholder={isImageQ?"Upload your drawing above, and optionally add a note…":"Type your answer… (Enter to submit, Shift+Enter for new line)"} value={input} onChange={e=>setInput(e.target.value)} rows={2} disabled={busy}
                    onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitAnswer();}}}
                    onPaste={e=>{e.preventDefault();setPasteWarning(true);setTimeout(()=>setPasteWarning(false),3000);}}/>
                  {pasteWarning&&<p style={{color:"#f87171",fontSize:12,margin:0,textAlign:"center"}}>⚠️ Pasting is not allowed — please type your answer.</p>}
                </div>
                <button onClick={submitAnswer} disabled={busy||pendingFile?.readability==="checking"||pendingFile?.readability?.status==="fail"||(isImageQ?(!pendingFile&&!input.trim()):!input.trim())} style={{...s.btnPri,width:"auto",padding:"0 20px",alignSelf:"stretch",opacity:(busy||pendingFile?.readability==="checking"||pendingFile?.readability?.status==="fail"||(isImageQ?(!pendingFile&&!input.trim()):!input.trim()))?0.4:1}}>Send</button>
              </div>
              {isImageQ&&!pendingFile&&<p style={{...s.muted,fontSize:12,textAlign:"center",margin:0}}>Click the 🖼 button to upload your drawing</p>}
            </>
          )}
        </div>
      </div>)}
    </div>
  );

  if(screen==="inst-login")return(
    <div style={{...s.page,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:400,width:"100%",...s.card,padding:36}}>
        <button onClick={()=>setScreen("home")} style={{...s.btnGhost,marginBottom:24,width:"auto"}}>← Back</button>
        <div style={{textAlign:"center",marginBottom:28}}><h2 style={{fontSize:22,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Instructor Login</h2><p style={{...s.muted,margin:0}}>Enter your instructor password</p></div>
        <input type="password" style={{...s.input,marginBottom:10}} placeholder="Password" value={instPw} onChange={e=>setInstPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} autoFocus/>
        {instErr&&<p style={{color:"#f87171",fontSize:13,margin:"0 0 10px"}}>{instErr}</p>}
        <button onClick={doLogin} style={s.btnPri}>Login</button>
      </div>
    </div>
  );

  if(screen==="inst-sub-detail"&&viewingSub){
    const scoreColor=viewingSub.score>=8?"#4ade80":viewingSub.score>=6?"#facc15":viewingSub.score>=4?"#fb923c":"#f87171";
    return(<div style={{...s.page,display:"flex",flexDirection:"column"}}>
      <div style={{background:CARD,borderBottom:`1px solid ${BORDER}`,padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button onClick={()=>{setScreen("instructor");setViewingSub(null);}} style={{...s.btnGhost,padding:"6px 12px",width:"auto"}}>← Back</button>
          <div style={{width:1,height:20,background:BORDER}}/>
          <div><div style={{color:"#fff",fontWeight:700,fontSize:14}}>{viewingSub.quizTitle}</div><p style={{...s.muted,fontSize:12,margin:0}}>{viewingSub.studentName} · {fmtDate(viewingSub.timestamp)}</p></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {viewingSub.late&&<span style={s.badge("#facc15")}>LATE</span>}
          <div style={{textAlign:"right"}}><span style={{fontSize:22,fontWeight:700,color:scoreColor}}>{viewingSub.score}</span><span style={{color:MUTED,fontSize:16}}>/10</span>{viewingSub.late&&viewingSub.rawScore!==viewingSub.score&&<div style={{color:MUTED,fontSize:11}}>raw: {viewingSub.rawScore}</div>}</div>
        </div>
      </div>
      <div ref={detailRef} style={{flex:1,overflowY:"auto",padding:"20px 16px",display:"flex",flexDirection:"column",gap:14,maxWidth:720,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
        {viewingSub.dialogue?.length>0?<ChatMessages messages={viewingSub.dialogue}/>:<div style={{...s.card,padding:32,textAlign:"center",color:MUTED}}>No dialogue saved for this submission.</div>}
      </div>
    </div>);
  }

  if(screen==="instructor"){
    const tabs=[{id:"submissions",label:"Submissions"},{id:"quizzes",label:"Quizzes & Dates"},{id:"roster",label:"Roster"},{id:"settings",label:"Settings"}];
    const subsByQuiz={};submissions.forEach(s=>{(subsByQuiz[s.quizId]=subsByQuiz[s.quizId]||[]).push(s);});
    const totalUnchecked=submissions.filter(s=>!checkedSubs[s.id]&&!s.imported).length;
    return(<div style={{...s.page,display:"flex",flexDirection:"column"}}>
      {dangerAction&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
        <div style={{...s.card,border:"1px solid rgba(127,29,29,0.6)",padding:24,width:"100%",maxWidth:360}}>
          <h3 style={{color:"#fff",fontWeight:700,fontSize:18,margin:"0 0 8px"}}>Confirm Action</h3>
          <p style={{...s.muted,marginBottom:16}}>You are about to: <span style={{color:"#fca5a5",fontWeight:500}}>{dangerAction.label}</span>. This cannot be undone.</p>
          <input type="password" style={{...s.input,marginBottom:8}} placeholder="Instructor password" value={dangerPw} onChange={e=>setDangerPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&executeDanger()} autoFocus/>
          {dangerErr&&<p style={{color:"#f87171",fontSize:13,margin:"0 0 8px"}}>{dangerErr}</p>}
          <div style={{display:"flex",gap:10,marginTop:12}}><button onClick={()=>{setDangerAction(null);setDangerPw("");setDangerErr("");}} style={{...s.btnSec,flex:1}}>Cancel</button><button onClick={executeDanger} style={{...s.btnPri,flex:1,background:"#b91c1c"}}>Confirm</button></div>
        </div>
      </div>)}
      <div style={{background:CARD,borderBottom:`1px solid ${BORDER}`,padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}><h1 style={{color:TEAL,fontWeight:700,fontSize:20,margin:0}}>Newton</h1><SyncBadge status={syncStatus} error={syncError}/></div>
        <button onClick={()=>{setInstPw("");setScreen("home");}} style={{...s.btnGhost,width:"auto"}}>Logout</button>
      </div>
      <div style={{background:CARD,borderBottom:`1px solid ${BORDER}`,display:"flex",overflowX:"auto",flexShrink:0}}>
        {tabs.map(t=>(<button key={t.id} onClick={()=>setInstTab(t.id)} style={{padding:"14px 20px",fontSize:13,fontWeight:500,whiteSpace:"nowrap",background:"none",border:"none",borderBottom:`2px solid ${instTab===t.id?TEAL:"transparent"}`,color:instTab===t.id?TEAL:MUTED,cursor:"pointer"}}>{t.label}</button>))}
      </div>
      <div style={{flex:1,overflowY:"auto"}}><div style={{maxWidth:860,margin:"0 auto",padding:24}}>

        {instTab==="submissions"&&(<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
            <div><h2 style={{color:"#fff",fontWeight:700,fontSize:20,margin:"0 0 4px"}}>Student Submissions</h2><p style={{...s.muted,margin:0,display:"flex",alignItems:"center",gap:8}}>{submissions.length} total{totalUnchecked>0&&<span style={s.badge("#facc15")}>{totalUnchecked} pending</span>}{totalUnchecked===0&&submissions.filter(s=>!s.imported).length>0&&<span style={s.badge("#4ade80")}>All entered ✓</span>}</p></div>
            <div style={{display:"flex",gap:8}}><button onClick={()=>setOpenQuizzes(QUIZZES.reduce((a,q)=>({...a,[q.id]:true}),{}))} style={s.btnGhost}>Expand all</button><button onClick={()=>setOpenQuizzes({})} style={s.btnGhost}>Collapse all</button></div>
          </div>
          {submissions.length===0?<div style={{...s.card,padding:40,textAlign:"center",color:MUTED}}>No submissions yet.</div>:(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {QUIZZES.map(quiz=>{
                const subs=(subsByQuiz[quiz.id]||[]).slice().sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
                if(!subs.length)return null;
                const isOpen=!!openQuizzes[quiz.id],unchecked=subs.filter(s=>!checkedSubs[s.id]&&!s.imported).length;
                return(<div key={quiz.id} style={{...s.card,overflow:"hidden"}}>
                  <button onClick={()=>toggleQuizOpen(quiz.id)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",background:"none",border:"none",cursor:"pointer",textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.03)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{color:MUTED,fontSize:13,transform:isOpen?"rotate(90deg)":"none",display:"inline-block",transition:"transform 0.2s"}}>▶</span><div><span style={{color:"#fff",fontWeight:600,fontSize:14}}>{quiz.title}</span><span style={{...s.muted,fontSize:12,marginLeft:8}}>{subs.length} submission{subs.length!==1?"s":""}</span></div></div>
                    <span style={unchecked>0?s.badge("#facc15"):s.badge("#4ade80")}>{unchecked>0?unchecked+" pending":"All entered ✓"}</span>
                  </button>
                  {isOpen&&(<div style={{borderTop:`1px solid ${BORDER}`}}>
                    {subs.map((sub,i)=>{
                      const checked=!!checkedSubs[sub.id],scoreColor=sub.score>=8?"#4ade80":sub.score>=6?"#facc15":sub.score>=4?"#fb923c":"#f87171";
                      return(<div key={sub.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 18px",borderTop:i>0?`1px solid ${BORDER}`:"none",background:checked?"rgba(255,255,255,0.01)":"transparent",opacity:checked?0.65:1,transition:"opacity 0.2s"}}>
                        {!sub.imported?<button onClick={()=>toggleChecked(sub.id)} style={{flexShrink:0,width:22,height:22,borderRadius:6,border:`2px solid ${checked?TEAL:BORDER}`,background:checked?TEAL:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700}}>{checked&&"✓"}</button>:<div style={{flexShrink:0,width:22,height:22}}/>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{color:"#fff",fontSize:14,fontWeight:500}}>{sub.studentName}</span>{sub.late&&<span style={s.badge("#facc15")}>LATE</span>}{sub.imported&&<span style={s.badge(MUTED)}>Imported</span>}</div>
                          <div style={{...s.muted,fontSize:12,marginTop:2}}>{fmtDate(sub.timestamp)}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0,marginRight:8}}><span style={{fontWeight:700,fontSize:16,color:scoreColor}}>{sub.score}</span><span style={{color:MUTED,fontSize:14}}>/10</span>{sub.late&&sub.rawScore!==sub.score&&<div style={{color:MUTED,fontSize:12}}>raw: {sub.rawScore}</div>}</div>
                        {!sub.imported?<button onClick={()=>{setViewingSub(sub);setScreen("inst-sub-detail");}} style={{flexShrink:0,background:TEAL_DIM,border:`1px solid ${TEAL}44`,color:TEAL,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}} onMouseEnter={e=>{e.currentTarget.style.background=TEAL;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background=TEAL_DIM;e.currentTarget.style.color=TEAL;}}>View →</button>:<div style={{flexShrink:0,width:72}}/>}
                      </div>);
                    })}
                  </div>)}
                </div>);
              })}
            </div>
          )}
        </div>)}

        {instTab==="quizzes"&&(<div>
          <h2 style={{color:"#fff",fontWeight:700,fontSize:20,margin:"0 0 6px"}}>Quizzes & Due Dates</h2>
          <p style={{...s.muted,marginBottom:24}}>All deadlines are at <strong style={{color:"rgba(255,255,255,0.7)"}}>11:59 PM EST</strong> on the selected date.</p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {quizzes.map(quiz=>{
              const late=isLate(quiz.dueDate);
              return(<div key={quiz.id} style={{...s.card,padding:"14px 18px",display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:14}}>
                <div style={{flex:1,minWidth:0}}><div style={{color:"#fff",fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:8}}>{quiz.title}{quiz.questions.some(q=>q.requiresImage)&&<span style={s.badge("#a78bfa")}>drawing</span>}</div><div style={{...s.muted,fontSize:12,marginTop:3}}>{quiz.questions.length} question{quiz.questions.length>1?"s":""}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                  <input type="date" style={{...s.input,width:"auto",padding:"6px 10px",fontSize:12}} value={quiz.dueDate?(quiz.dueDate.length===10?quiz.dueDate:new Date(new Date(quiz.dueDate)-5*3600000).toISOString().slice(0,10)):""} onChange={async e=>{const nd={...dueDates};if(e.target.value)nd[quiz.id]=e.target.value;else delete nd[quiz.id];await saveDueDates(nd);}}/>
                  {quiz.dueDate&&<span style={s.badge(late?"#f87171":"#4ade80")}>{late?"Past due":"Active"}</span>}
                </div>
              </div>);
            })}
          </div>
        </div>)}

        {instTab==="roster"&&(<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:12}}>
            <div><h2 style={{color:"#fff",fontWeight:700,fontSize:20,margin:"0 0 4px"}}>Class Roster</h2><p style={{...s.muted,margin:0}}>{roster.length} students loaded</p></div>
            <label style={{...s.btnGhost,cursor:"pointer",display:"inline-block",padding:"10px 18px",fontSize:14}}>Upload Roster CSV<input ref={rosterInputRef} type="file" accept=".csv,.txt" onChange={onRosterUpload} style={{display:"none"}}/></label>
          </div>
          <ManualAddStudent roster={roster} onAdd={async student=>{const updated=[...roster,student].sort((a,b)=>a.lastName.localeCompare(b.lastName));await saveRoster(updated);}}/>
          <div style={{...s.card,padding:20,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
              <div><p style={{color:"#fff",fontWeight:600,fontSize:14,margin:"0 0 4px"}}>Import Grades from Blackboard CSV</p><p style={{...s.muted,fontSize:12,margin:0}}>Also populates roster and resets passwords to Student IDs.</p></div>
              <label style={{...s.btnPri,width:"auto",cursor:"pointer",display:"inline-block",padding:"10px 18px",fontSize:14,whiteSpace:"nowrap"}}>Upload Grades CSV<input ref={gradesInputRef} type="file" accept=".csv,.txt" onChange={onGradesUpload} style={{display:"none"}}/></label>
            </div>
            {gradeImportMsg&&<p style={{margin:"12px 0 0",fontSize:13,color:gradeImportMsg.startsWith("✅")?"#4ade80":"#f87171"}}>{gradeImportMsg}</p>}
          </div>
          <div style={{...s.card,padding:20,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
              <div><p style={{color:"#fff",fontWeight:600,fontSize:14,margin:"0 0 4px"}}>Restore Student Passwords</p><p style={{...s.muted,fontSize:12,margin:0}}>Upload a JSON file with the <code style={{background:"rgba(255,255,255,0.08)",padding:"1px 5px",borderRadius:4}}>studentPws</code> object.</p></div>
              <label style={{...s.btnPri,width:"auto",cursor:"pointer",display:"inline-block",padding:"10px 18px",fontSize:14,whiteSpace:"nowrap"}}>Upload Passwords JSON<input ref={pwImportRef} type="file" accept=".json" onChange={onPwImport} style={{display:"none"}}/></label>
            </div>
            {pwImportMsg&&<p style={{margin:"12px 0 0",fontSize:13,color:pwImportMsg.startsWith("✅")?"#4ade80":"#f87171"}}>{pwImportMsg}</p>}
          </div>
          <div style={{...s.card,padding:20,marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
              <div><p style={{color:"#fff",fontWeight:600,fontSize:14,margin:"0 0 4px"}}>Restore Quiz Due Dates</p><p style={{...s.muted,fontSize:12,margin:0}}>Upload a JSON file with the <code style={{background:"rgba(255,255,255,0.08)",padding:"1px 5px",borderRadius:4}}>dueDates</code> object.</p></div>
              <label style={{...s.btnPri,width:"auto",cursor:"pointer",display:"inline-block",padding:"10px 18px",fontSize:14,whiteSpace:"nowrap"}}>Upload Due Dates JSON<input ref={dueDateImportRef} type="file" accept=".json" onChange={onDueDateImport} style={{display:"none"}}/></label>
            </div>
            {dueDateImportMsg&&<p style={{margin:"12px 0 0",fontSize:13,color:dueDateImportMsg.startsWith("✅")?"#4ade80":"#f87171"}}>{dueDateImportMsg}</p>}
          </div>
          <div style={{...s.card,padding:14,marginBottom:20,fontSize:13,color:MUTED}}>
            <p style={{color:"rgba(255,255,255,0.7)",fontWeight:600,margin:"0 0 4px"}}>Roster CSV format:</p>
            <code style={{background:"rgba(255,255,255,0.06)",padding:"3px 8px",borderRadius:6,fontSize:12}}>Last Name,First Name,Student ID,</code>
            <p style={{margin:"8px 0 0"}}>Initial password = Student ID for all students.</p>
          </div>
          {roster.length===0?<div style={{...s.card,padding:40,textAlign:"center",color:MUTED}}>No roster uploaded yet.</div>:(
            <div style={{...s.card,overflow:"hidden"}}>
              {removeStudent&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
                <div style={{...s.card,border:"1px solid rgba(127,29,29,0.6)",padding:24,width:"100%",maxWidth:360}}>
                  <h3 style={{color:"#fff",fontWeight:700,fontSize:18,margin:"0 0 8px"}}>Remove Student</h3>
                  <p style={{color:"#fff",fontWeight:600,fontSize:15,margin:"0 0 4px"}}>{removeStudent.fullName}</p>
                  <p style={{color:MUTED,fontFamily:"monospace",fontSize:13,margin:"0 0 16px"}}>ID: {removeStudent.studentId}</p>
                  <p style={{...s.muted,fontSize:13,marginBottom:16}}>This removes them from the roster only. Their submissions will remain.</p>
                  <input type="password" style={{...s.input,marginBottom:8}} placeholder="Instructor password" value={removePw} onChange={e=>setRemovePw(e.target.value)} autoFocus/>
                  {removeErr&&<p style={{color:"#f87171",fontSize:13,margin:"0 0 8px"}}>{removeErr}</p>}
                  <div style={{display:"flex",gap:10,marginTop:12}}>
                    <button onClick={()=>{setRemoveStudent(null);setRemovePw("");setRemoveErr("");}} style={{...s.btnSec,flex:1}}>Cancel</button>
                    <button onClick={async()=>{
                      if(!settings.passwordHash){setRemoveErr("Settings not loaded.");return;}
                      const ok=await verifyPw(removePw,settings.passwordHash,settings.passwordSalt);
                      if(!ok){setRemoveErr("Incorrect password.");return;}
                      saveRoster(roster.filter(r=>r.studentId!==removeStudent.studentId));
                      setRemoveStudent(null);setRemovePw("");setRemoveErr("");
                    }} style={{...s.btnPri,flex:1,background:"#b91c1c"}}>Remove</button>
                  </div>
                </div>
              </div>)}
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
                  <thead><tr style={{borderBottom:`1px solid ${BORDER}`}}>{["Name","Student ID","Password Status",""].map(h=><th key={h} style={{textAlign:"left",color:MUTED,fontWeight:500,padding:"12px 16px",fontSize:13}}>{h}</th>)}</tr></thead>
                  <tbody>{roster.map((stu,i)=>(
                    <tr key={stu.studentId} style={{borderBottom:i<roster.length-1?`1px solid ${BORDER}`:"none"}}>
                      <td style={{padding:"12px 16px",color:"#fff",fontWeight:500}}>{stu.fullName}</td>
                      <td style={{padding:"12px 16px",color:MUTED,fontFamily:"monospace",fontSize:13}}>{stu.studentId}</td>
                      <td style={{padding:"12px 16px"}}><span style={studentPws[stu.studentId]?s.badge(TEAL):s.badge(MUTED)}>{studentPws[stu.studentId]?"Hashed password":"Using Student ID"}</span></td>
                      <td style={{padding:"8px 16px",textAlign:"right",display:"flex",gap:6,justifyContent:"flex-end",alignItems:"center"}}>
                        <button onClick={async()=>{if(!window.confirm(`Reset ${stu.fullName}'s password back to their Student ID?`))return;const np={...studentPws};delete np[stu.studentId];await saveStudentPws(np);}} style={{background:"rgba(202,138,4,0.15)",border:"1px solid rgba(202,138,4,0.4)",color:"#fde047",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:500}}>Reset PW</button>
                        <button onClick={()=>{setRemoveStudent(stu);setRemovePw("");setRemoveErr("");}} style={{background:"rgba(127,29,29,0.3)",border:"1px solid rgba(127,29,29,0.5)",color:"#fca5a5",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:500}}>Remove</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>)}

        {instTab==="settings"&&(<div style={{maxWidth:500}}>
          <h2 style={{color:"#fff",fontWeight:700,fontSize:20,margin:"0 0 24px"}}>Settings</h2>
          <div style={{...s.card,padding:20,marginBottom:20,background:"rgba(0,130,140,0.06)",border:`1px solid ${TEAL}33`}}>
            <p style={{color:TEAL,fontWeight:600,fontSize:14,margin:"0 0 6px"}}>🔥 Firebase Storage <span style={{fontSize:11,fontWeight:400,marginLeft:6,color:fbConnStatus==='ok'?"#4ade80":"#f87171"}}>{fbConnStatus==='ok'?"● Connected":"● Unreachable"}</span></p>
            <p style={{...s.muted,fontSize:13,margin:"0 0 6px",lineHeight:1.6}}>All data persists via Firebase Realtime Database.</p>
            <code style={{fontSize:11,color:MUTED,background:"rgba(255,255,255,0.04)",padding:"4px 8px",borderRadius:6,display:"block",wordBreak:"break-all"}}>{FIREBASE}</code>
            {fbConnStatus==='error'&&<p style={{color:"#f87171",fontSize:12,margin:"8px 0 0",fontFamily:"monospace",wordBreak:"break-all"}}>{fbConnError}</p>}
          </div>
          <div style={{...s.card,padding:20,marginBottom:20,background:"rgba(0,130,140,0.06)",border:`1px solid ${TEAL}33`}}>
            <p style={{color:TEAL,fontWeight:600,fontSize:14,margin:"0 0 6px"}}>🔒 Password Security</p>
            <p style={{...s.muted,fontSize:13,margin:0,lineHeight:1.6}}>All passwords are hashed with SHA-256 + a random salt using the browser's Web Crypto API. No plaintext passwords are stored anywhere.</p>
          </div>
          <div style={{...s.card,padding:24,marginBottom:20}}>
            <h3 style={{color:"#fff",fontWeight:600,fontSize:16,margin:"0 0 4px"}}>Backup & Restore</h3>
            <p style={{...s.muted,fontSize:13,margin:"0 0 18px"}}>Export everything to a local JSON file as a safety copy.</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button onClick={exportAllData} style={{...s.btnPri,flex:1,minWidth:160}}>Download Backup</button>
              <label style={{...s.btnGhost,flex:1,minWidth:160,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center"}}>Restore from Backup<input ref={backupInputRef} type="file" accept=".json" onChange={onBackupImport} style={{display:"none"}}/></label>
            </div>
          </div>
          <div style={{...s.card,padding:24,display:"flex",flexDirection:"column",gap:18}}>
            <div><label style={s.label}>New Instructor Password</label><input type="password" style={s.input} placeholder="Leave blank to keep current" value={editPw} onChange={e=>setEditPw(e.target.value)}/></div>
            <button onClick={async()=>{if(editPw.trim()){const h=await makeHash(editPw.trim());await saveSettings({passwordHash:h.hash,passwordSalt:h.salt});}setEditPw("");alert("✅ Settings saved!");}} style={s.btnPri}>Save Password</button>
            <hr style={{border:`1px solid ${BORDER}`,margin:"4px 0"}}/>
            <p style={{color:"#fca5a5",fontSize:14,fontWeight:600,margin:0}}>Danger Zone</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[["Clear All Quiz Due Dates",async()=>saveDueDates({})],["Clear All Submissions",async()=>saveSubs([])],["Clear Imported Grades Only",async()=>saveSubs(submissions.filter(s=>!s.imported))],["Clear All Gradebook Check Marks",async()=>saveChecked({})],["Reset All Student Passwords",async()=>saveStudentPws({})],["Clear Roster",async()=>saveRoster([])],].map(([label,action])=>(
                <button key={label} onClick={()=>confirmDanger(label,action)} style={s.btnDanger}>{label}</button>
              ))}
            </div>
          </div>
        </div>)}

      </div></div>
    </div>);
  }
  return null;
}
