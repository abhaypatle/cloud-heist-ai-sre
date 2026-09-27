import { useMemo, useState } from "react";

type Profile = {
  id: string;
  name: string;
  role: string;
  experience: string;
  domains: string[];
  linkedin: string;
  resumeName: string;
  consentProfile: boolean;
  consentGameplay: boolean;
  skills: Record<string, number>;
  strongest: string;
  weakest: string;
  level: number;
  xp: number;
  createdAt: string;
};

const DOMAINS = [
  ["cloud","CLOUD","AWS / Azure / GCP"],
  ["devops","DEVOPS","CI/CD / Containers"],
  ["kubernetes","KUBERNETES","Clusters / Workloads"],
  ["devsecops","DEVSECOPS","Security / Supply Chain"],
  ["linux","LINUX","OS / Shell / Systems"],
  ["networking","NETWORKING","DNS / TCP / HTTP"],
  ["terraform","TERRAFORM","IaC / Drift"],
  ["sre","SRE","Reliability / Incidents"],
  ["databases","DATABASES","SQL / Connections / Storage"]
] as const;

const QUESTIONS = [
  {
    domain:"kubernetes",
    q:"A Kubernetes pod enters CrashLoopBackOff immediately after a deployment. What is the first investigation step?",
    options:["Delete the cluster","Inspect pod logs and describe the failure","Increase node count","Disable health checks"],
    answer:1
  },
  {
    domain:"cloud",
    q:"A production service suddenly receives 5x normal traffic. What should you investigate first?",
    options:["Scale capacity and inspect traffic/error telemetry","Delete old backups","Rotate every secret","Change the domain"],
    answer:0
  },
  {
    domain:"devops",
    q:"A deployment pipeline starts failing immediately after a commit. What is the strongest first move?",
    options:["Ignore the failed stage","Inspect the failed stage and recent change","Rebuild the entire cloud","Delete the repository"],
    answer:1
  },
  {
    domain:"devsecops",
    q:"A secret is accidentally committed to a repository. What is the safest immediate response?",
    options:["Only delete the commit","Rotate/revoke the exposed secret and investigate","Post the secret in Slack","Wait for the next release"],
    answer:1
  },
  {
    domain:"linux",
    q:"A Linux worker reports disk pressure. What should you inspect?",
    options:["Disk usage and the directories consuming space","CPU temperature only","Browser cache","DNS TTL only"],
    answer:0
  },
  {
    domain:"networking",
    q:"Users report intermittent DNS failures while the application itself is healthy. What should you inspect?",
    options:["DNS resolution path and resolver errors","GPU drivers","Git history only","Application logo"],
    answer:0
  },
  {
    domain:"terraform",
    q:"Terraform reports infrastructure drift. What should you do before applying changes?",
    options:["Destroy everything","Inspect the plan and identify the drift source","Disable Terraform","Delete state immediately"],
    answer:1
  },
  {
    domain:"sre",
    q:"A service has rising latency and error rate. Which signal combination is most useful?",
    options:["Only server uptime","Latency, errors, traffic and resource saturation","Only user count","Only deployment count"],
    answer:1
  },
  {
    domain:"databases",
    q:"A database suddenly rejects new connections. What is a likely first investigation?",
    options:["Connection pool/exhaustion metrics and active sessions","Change the frontend font","Delete the database","Disable monitoring"],
    answer:0
  }
];

export default function ProfileGate({children}:{children:React.ReactNode}) {
  const [profile,setProfile] = useState<Profile|null>(() => {
    try {
      const raw = localStorage.getItem("cloudHeistOperatorProfile");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  if (profile) return <>{children}</>;

  return <ProfileWizard onComplete={(p)=>setProfile(p)} />;
}

function ProfileWizard({onComplete}:{onComplete:(p:Profile)=>void}) {
  const [step,setStep] = useState(0);
  const [name,setName] = useState("");
  const [role,setRole] = useState("DevOps Engineer");
  const [experience,setExperience] = useState("1–2 Years");
  const [domains,setDomains] = useState<string[]>(["cloud","devops"]);
  const [linkedin,setLinkedin] = useState("");
  const [resumeName,setResumeName] = useState("");
  const [consentProfile,setConsentProfile] = useState(false);
  const [consentGameplay,setConsentGameplay] = useState(true);
  const [answers,setAnswers] = useState<number[]>([]);
  const [result,setResult] = useState<Record<string,number>|null>(null);

  const progress = Math.round(((step+1)/4)*100);

  const toggleDomain=(id:string)=>{
    setDomains(v=>v.includes(id) ? v.filter(x=>x!==id) : [...v,id]);
  };

  const finishTest=()=>{
    const scores:Record<string,number>={};
    for(const [id] of DOMAINS) scores[id]=45;
    QUESTIONS.forEach((q,i)=>{
      if(answers[i]===q.answer) scores[q.domain]=Math.min(100,(scores[q.domain]||45)+12);
      else scores[q.domain]=Math.max(25,(scores[q.domain]||45)-4);
    });
    setResult(scores);
    setStep(3);
  };

  const createProfile=()=>{
    if(!name.trim() || !consentProfile) return;

    const scores=result || {};
    const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const strongest=sorted[0]?.[0] || "devops";
    const weakest=sorted[sorted.length-1]?.[0] || "kubernetes";
    const avg=Math.round(Object.values(scores).reduce((a,b)=>a+b,0)/Math.max(1,Object.values(scores).length));
    const level=Math.max(1,Math.floor(avg/10));

    const p:Profile={
      id:crypto.randomUUID(),
      name:name.trim(),
      role,
      experience,
      domains,
      linkedin:linkedin.trim(),
      resumeName,
      consentProfile,
      consentGameplay,
      skills:scores,
      strongest,
      weakest,
      level,
      xp:level*100,
      createdAt:new Date().toISOString()
    };

    localStorage.setItem("cloudHeistOperatorProfile",JSON.stringify(p));
    onComplete(p);
  };

  return (
    <div className="profile-shell">
      <div className="profile-grid-bg"/>
      <div className="profile-card">
        <div className="profile-kicker">CLOUD HEIST // OPERATOR INTAKE</div>

        <div className="profile-head">
          <div>
            <h1>BUILD YOUR <span>OPERATOR DNA</span></h1>
            <p>Your profile starts with your experience — then gameplay proves it.</p>
          </div>
          <div className="profile-progress">{progress}%</div>
        </div>

        <div className="profile-progress-line"><span style={{width:`${progress}%`}}/></div>

        {step===0 && (
          <section className="profile-step">
            <div className="profile-section-label">01 / IDENTITY</div>

            <label>OPERATOR NAME</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your operator name"/>

            <div className="profile-two">
              <div>
                <label>CURRENT ROLE</label>
                <select value={role} onChange={e=>setRole(e.target.value)}>
                  <option>Student</option>
                  <option>Cloud Engineer</option>
                  <option>DevOps Engineer</option>
                  <option>SRE</option>
                  <option>Platform Engineer</option>
                  <option>Security Engineer</option>
                  <option>Software Engineer</option>
                  <option>Engineering Manager</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label>EXPERIENCE</label>
                <select value={experience} onChange={e=>setExperience(e.target.value)}>
                  <option>Student</option>
                  <option>Beginner</option>
                  <option>1–2 Years</option>
                  <option>3–5 Years</option>
                  <option>5+ Years</option>
                </select>
              </div>
            </div>

            <label>PRIMARY DOMAINS</label>
            <div className="domain-picks">
              {DOMAINS.map(([id,title,sub])=>(
                <button key={id} className={domains.includes(id)?"domain-pick active":"domain-pick"} onClick={()=>toggleDomain(id)}>
                  <strong>{title}</strong><small>{sub}</small>
                </button>
              ))}
            </div>

            <button className="profile-next" disabled={!name.trim()} onClick={()=>setStep(1)}>
              CONTINUE TO PROFESSIONAL PROFILE →
            </button>
          </section>
        )}

        {step===1 && (
          <section className="profile-step">
            <div className="profile-section-label">02 / PROFESSIONAL EVIDENCE</div>
            <h2>OPTIONAL — CONNECT YOUR EXPERIENCE</h2>
            <p className="profile-muted">
              Resume and LinkedIn information can help build your starting profile.
              Your actual raid performance will be treated as separate gameplay evidence.
            </p>

            <label>LINKEDIN PROFILE URL</label>
            <input value={linkedin} onChange={e=>setLinkedin(e.target.value)} placeholder="https://www.linkedin.com/in/your-profile"/>

            <label>RESUME</label>
            <div className="resume-box">
              <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e=>setResumeName(e.target.files?.[0]?.name || "")}/>
              {resumeName && <span>✓ {resumeName}</span>}
            </div>

            <div className="consent-box">
              <label className="check-row">
                <input type="checkbox" checked={consentProfile} onChange={e=>setConsentProfile(e.target.checked)}/>
                <span>I consent to using the information I provide to create my Cloud Heist operator profile.</span>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={consentGameplay} onChange={e=>setConsentGameplay(e.target.checked)}/>
                <span>I allow gameplay performance to improve my skill recommendations.</span>
              </label>
            </div>

            <div className="profile-actions">
              <button className="profile-back" onClick={()=>setStep(0)}>← BACK</button>
              <button className="profile-next" disabled={!consentProfile} onClick={()=>{setStep(2);setAnswers([])}}>START BASELINE TEST →</button>
            </div>
          </section>
        )}

        {step===2 && (
          <BaselineTest answers={answers} setAnswers={setAnswers} finish={finishTest}/>
        )}

        {step===3 && result && (
          <section className="profile-step">
            <div className="profile-section-label">04 / OPERATOR DNA INITIALIZED</div>
            <h2>YOUR BASELINE PROFILE</h2>
            <p className="profile-muted">This is your starting point. Every raid will update the demonstrated skill model.</p>

            <div className="skill-list">
              {DOMAINS.map(([id,title])=>{
                const score=result[id] ?? 45;
                return (
                  <div className="skill-row" key={id}>
                    <div><strong>{title}</strong><span>{score}</span></div>
                    <div className="skill-track"><i style={{width:`${score}%`}}/></div>
                  </div>
                );
              })}
            </div>

            <div className="profile-insight">
              <div>
                <small>INITIAL LEVEL</small>
                <strong>{Math.max(1,Math.floor(Object.values(result).reduce((a,b)=>a+b,0)/Object.values(result).length/10))}</strong>
              </div>
              <div>
                <small>STRONGEST SIGNAL</small>
                <strong>{DOMAINS.find(x=>x[0]===Object.entries(result).sort((a,b)=>b[1]-a[1])[0][0])?.[1]}</strong>
              </div>
              <div>
                <small>FOCUS AREA</small>
                <strong>{DOMAINS.find(x=>x[0]===Object.entries(result).sort((a,b)=>a[1]-b[1])[0][0])?.[1]}</strong>
              </div>
            </div>

            <button className="profile-next wide" onClick={createProfile}>ENTER CLOUD HEIST →</button>
          </section>
        )}
      </div>
    </div>
  );
}

function BaselineTest({answers,setAnswers,finish}:{answers:number[];setAnswers:(v:number[])=>void;finish:()=>void}) {
  const [index,setIndex]=useState(0);
  const q=QUESTIONS[index];
  const selected=answers[index];

  const choose=(i:number)=>{
    const next=[...answers];
    next[index]=i;
    setAnswers(next);
  };

  return (
    <section className="profile-step">
      <div className="profile-section-label">03 / BASELINE INCIDENT TEST</div>
      <div className="test-meta">
        <span>INCIDENT {index+1} / {QUESTIONS.length}</span>
        <span>{q.domain.toUpperCase()}</span>
      </div>

      <h2>{q.q}</h2>

      <div className="test-options">
        {q.options.map((o,i)=>(
          <button key={o} className={selected===i?"test-option selected":"test-option"} onClick={()=>choose(i)}>
            <span>{String.fromCharCode(65+i)}</span>{o}
          </button>
        ))}
      </div>

      <div className="profile-actions">
        <button className="profile-back" disabled={index===0} onClick={()=>setIndex(Math.max(0,index-1))}>← PREVIOUS</button>
        {index<QUESTIONS.length-1
          ? <button className="profile-next" disabled={selected===undefined} onClick={()=>setIndex(index+1)}>NEXT INCIDENT →</button>
          : <button className="profile-next" disabled={selected===undefined} onClick={finish}>CALCULATE OPERATOR DNA →</button>
        }
      </div>
    </section>
  );
}
