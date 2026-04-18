import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, Target, CheckCircle2, AlertCircle, BrainCircuit,
  UploadCloud, Play, User, MessageSquare, ChevronRight, Search,
  ClipboardPaste, X, Wifi, WifiOff, Zap
} from 'lucide-react';

const API_BASE = "http://localhost:9000";

// --- Subcomponents ---

const ChatMessage = ({ sender, text }) => (
  <div className={`flex gap-3 mb-4 ${sender === 'user' ? 'justify-end' : 'justify-start'}`}>
    {sender === 'ai' && <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/50"><BrainCircuit size={16} className="text-indigo-400" /></div>}
    <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm ${sender === 'user' ? 'bg-indigo-500 text-white rounded-tr-sm' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm shadow-lg'}`}>
      {text}
    </div>
  </div>
);

const AnimatedScore = ({ finalScore }) => {
  const [score, setScore] = useState(0);
  
  useEffect(() => {
    let currentScore = 0;
    const interval = setInterval(() => {
      currentScore += Math.ceil(finalScore / 25); // Faster animation
      if (currentScore >= finalScore) {
        currentScore = finalScore;
        clearInterval(interval);
      }
      setScore(currentScore);
    }, 20);
    return () => clearInterval(interval);
  }, [finalScore]);

  const getColor = (s) => s > 75 ? 'text-emerald-400' : s > 50 ? 'text-yellow-400' : 'text-rose-400';

  return (
    <div className={`text-4xl font-black ${getColor(score)} tabular-nums tracking-tighter`}>
      {score}%
    </div>
  );
};

const SkillBar = ({ matched, missing }) => {
  const total = matched + missing || 1;
  const matchPct = (matched / total) * 100;
  
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs font-semibold mb-1 text-slate-400">
        <span>Skills Match</span>
        <span>{matched}/{total}</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
        <div className="bg-emerald-500 h-full transition-all duration-1000 ease-out" style={{ width: `${matchPct}%` }} />
        <div className="bg-rose-500/50 h-full transition-all duration-1000 ease-out" style={{ width: `${100 - matchPct}%` }} />
      </div>
    </div>
  );
};

// --- Main App ---

function App() {
  const [chatLog, setChatLog] = useState([
    { sender: 'ai', text: "Hello! I'm your Talent Intelligence Engine. Tell me what kind of role we are hiring for today." }
  ]);
  
  const [rankedCandidates, setRankedCandidates] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [jobTitle, setJobTitle] = useState('Senior AI Engineer');
  const [jobDescription, setJobDescription] = useState('');
  const [jobSkills, setJobSkills] = useState('Python, NLP, React');
  const [currentNote, setCurrentNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null); // null=checking, true=online, false=offline

  useEffect(() => {
    if (selectedProfile) {
      setCurrentNote(selectedProfile.recruiter_notes || "");
    }
  }, [selectedProfile]);

  const handleSaveNote = async () => {
    if (!selectedProfile) return;
    setIsSavingNote(true);
    try {
      const response = await fetch(`${API_BASE}/candidates/${selectedProfile.candidate_id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: currentNote }),
      });
      
      if (response.ok) {
        // Update local state for both the list and the selection
        setRankedCandidates(prev => prev.map(c => 
          c.candidate_id === selectedProfile.candidate_id ? { ...c, recruiter_notes: currentNote } : c
        ));
        setSelectedProfile(prev => ({ ...prev, recruiter_notes: currentNote }));
        addChat('ai', `✅ Human observation saved for ${selectedProfile.candidate_name}`);
      }
    } catch (err) {
      addChat('ai', "❌ Failed to save note.");
    }
    setIsSavingNote(false);
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0); 
  const [view, setView] = useState('job'); // 'job' or 'add'
  const [manualData, setManualData] = useState({
    name: 'Jane Smith',
    experience: 3,
    bio: '',
    skills_csv: '',
    github_url: 'https://github.com/jsmith',
    projects: [{ title: '', description: '' }]
  });

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const jdRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  // Poll backend health every 5s
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await fetch(`${API_BASE}/candidates`, { signal: AbortSignal.timeout(2000) });
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePasteJD = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJobDescription(text);
      jdRef.current?.focus();
    } catch {
      jdRef.current?.focus();
      alert('Click inside the box, then press Ctrl+V to paste your Job Description.');
    }
  };

  const addChat = (sender, text) => {
    setChatLog(prev => [...prev, { sender, text }]);
  };

  const handleBulkUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    addChat('user', `Starting bulk upload for ${files.length} items (including folders)...`);
    setIsAnalyzing(true);
    
    let totalIngested = 0;

    for (const file of files) {
      addChat('ai', `📁 Indexing ${file.name}...`);
      
      // Safety breather for massive datasets
      await new Promise(r => setTimeout(r, 50));

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${API_BASE}/upload_resume`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json(); // Data is now a list
          const count = data.length;
          totalIngested += count;
          if (count > 1) {
             addChat('ai', `✅ Extracted ${count} candidates from ${file.name}`);
          } else if (count === 1) {
             addChat('ai', `✅ Successfully indexed ${file.name}`);
          } else {
             addChat('ai', `ℹ️ Skipped ${file.name} (no valid candidate data found)`);
          }
        } else {
          addChat('ai', `❌ Error indexing ${file.name}`);
        }
      } catch (err) {
        addChat('ai', `❌ Connection error for ${file.name}`);
      }
    }
    
    setIsAnalyzing(false);
    addChat('ai', `🎯 Ingestion complete. Total of ${totalIngested} candidates are now in the Intelligence Core.`);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetCore = async () => {
    if (!window.confirm("⚠️ This will permanently WIPE the entire Intelligence Core. Proceed?")) return;
    
    try {
      const response = await fetch(`${API_BASE}/candidates/clear`, { method: 'DELETE' });
      if (response.ok) {
        setRankedCandidates([]);
        setSelectedProfile(null);
        addChat('ai', "🚨 Intelligence Core has been fully purged. Dataset is clean.");
      }
    } catch (err) {
      addChat('ai', "❌ Failed to reset core.");
    }
  };

  const handleManualAdd = async () => {
    setIsAnalyzing(true);
    addChat('user', `Adding manual profile for ${manualData.name}...`);
    addChat('ai', "🔍 Initializing multimodal ingestion...");
    
    try {
      const response = await fetch(`${API_BASE}/add_candidate_manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualData),
      });

      if (response.ok) {
        addChat('ai', `✅ Profile for ${manualData.name} indexed and GitHub simulation established.`);
        setView('job');
      } else {
        addChat('ai', "❌ Failed to index manual candidate.");
      }
    } catch (err) {
      addChat('ai', "❌ Backend connection error.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setRankedCandidates([]);
    setSelectedProfile(null);
    setLoadingStep(1);
    
    addChat('user', `Analyzing holistic match for ${jobTitle} against descriptive requirements...`);
    
    // UI steps reflection user requirements
    setTimeout(() => {
      addChat('ai', "🔍 Initializing Deep Transformer Encodings...");
      setLoadingStep(1);
    }, 400);

    setTimeout(() => {
      addChat('ai', "🧠 Computing Latent Semantic Embeddings...");
      setLoadingStep(2);
    }, 1400);

    setTimeout(() => {
      addChat('ai', "📊 Synthesizing Holistic Fit Scores...");
      setLoadingStep(3);
    }, 2400);

    try {
      const response = await fetch(`${API_BASE}/match_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: jobTitle,
          job_description: jobDescription,
          required_skills: jobSkills.split(',').map(s => s.trim()).filter(s => s.length > 0),
          years_experience: 5
        }),
      });

      const data = await response.json();
      
      setTimeout(() => {
        setIsAnalyzing(false);
        // Add a "visible" property to each candidate to handle staggering
        setRankedCandidates(data.map((c, i) => ({ ...c, visible: false })));
        
        // Staggered appearance: card by card
        data.forEach((_, index) => {
          setTimeout(() => {
            setRankedCandidates(prev => prev.map((c, i) => i === index ? { ...c, visible: true } : c));
          }, index * 200);
        });

        if (data.length > 0) {
          addChat('ai', `Analysis complete! Top match is ${data[0].candidate_name} with score ${data[0].fit_score}%`);
        } else {
          addChat('ai', "No candidates found in the database. Please upload resumes first!");
        }
      }, 3500); 
      
    } catch (err) {
      setTimeout(() => {
        setIsAnalyzing(false);
        addChat('ai', "Error connecting to Intelligence Core.");
      }, 3500);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 font-sans p-6">
      {/* Hidden File Input */}
      <input 
        type="file" 
        multiple 
        webkitdirectory="" 
        directory=""
        ref={fileInputRef} 
        style={{ display: 'none' }}
        onChange={handleBulkUpload}
        accept=".txt,.docx,.json,.pdf,.csv"
      />

      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col items-center justify-center mb-10 pb-6 border-b border-white/5 space-y-2">
        <h1 className="text-4xl font-black flex items-center gap-4">
          <BrainCircuit className="text-indigo-500" size={40} />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 animate-gradient-x">TalentAI</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium tracking-widest uppercase">Multimodal Talent Intelligence</p>
        <div className="pt-4 flex items-center gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 border border-indigo-400/20"
          >
            <UploadCloud size={18} /> Bulk Ingest Dataset
          </button>
          {/* Backend Status Pill */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all ${
            backendOnline === null ? 'bg-slate-800 border-slate-700 text-slate-400' :
            backendOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {backendOnline === null ? <><div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" /> Checking...</> :
             backendOnline ? <><div className="w-2 h-2 rounded-full bg-emerald-400" /> Intelligence Core LIVE</> :
             <><div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" /> Core Offline — Run START_BACKEND.bat</>}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar / Chat & Job Setup */}
        <div className="lg:col-span-4 space-y-6 flex flex-col h-[calc(100vh-140px)]">
          {/* View Toggler */}
          <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
             <button 
               onClick={() => setView('job')}
               className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === 'job' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
             >
               JOB TARGET
             </button>
             <button 
               onClick={() => setView('add')}
               className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === 'add' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
             >
               QUICK ADD CANDIDATE
             </button>
          </div>

          {/* Job Setup Card */}
          {view === 'job' ? (
            <div className="p-5 rounded-3xl bg-slate-900/50 border border-white/5 shadow-2xl backdrop-blur-xl shrink-0 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <Briefcase size={16} /> Job Description
                </h2>
                {!backendOnline && backendOnline !== null && (
                  <span className="text-xs text-rose-400 font-semibold animate-pulse">⚠ Backend offline</span>
                )}
              </div>
              <div className="space-y-3">
                <input 
                  placeholder="Job Title (e.g. Senior AI Engineer)"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold placeholder:text-slate-700 outline-none transition-all focus:border-indigo-500/60"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                />
                {/* JD Paste Area */}
                <div className="relative">
                  <textarea 
                    ref={jdRef}
                    placeholder="📋 Paste your full Job Description here (Ctrl+V or use the Paste button below).

The AI will semantically analyze every resume against this description.

Tip: Copy from any job posting and paste directly!"
                    className="w-full h-56 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-sm text-slate-300 leading-relaxed outline-none transition-all focus:border-indigo-500/60 resize-y placeholder:text-slate-600 placeholder:text-xs"
                    value={jobDescription}
                    onChange={e => setJobDescription(e.target.value)}
                    onPaste={e => { /* allow native paste */ }}
                  />
                  {/* Clear button inside textarea */}
                  {jobDescription && (
                    <button
                      onClick={() => setJobDescription('')}
                      className="absolute top-3 right-3 w-6 h-6 rounded-full bg-slate-700 hover:bg-rose-500/80 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                      title="Clear job description"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                {/* Paste helper + char count */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={handlePasteJD}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
                  >
                    <ClipboardPaste size={13} /> Paste from Clipboard
                  </button>
                  <span className="text-xs text-slate-600">{jobDescription.length} chars</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleRunAnalysis}
                    disabled={isAnalyzing || !jobDescription.trim()}
                    className={`flex-1 py-3.5 px-5 rounded-2xl font-black transition-all flex items-center justify-center gap-2.5 shadow-2xl text-sm ${
                      isAnalyzing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' :
                      !jobDescription.trim() ? 'bg-slate-800 text-slate-600 cursor-not-allowed' :
                      'bg-gradient-to-r from-indigo-600 to-cyan-500 hover:scale-[1.02] active:scale-[0.98] text-white shadow-indigo-500/30'
                    }`}
                  >
                    <Zap size={16} fill={isAnalyzing || !jobDescription.trim() ? 'none' : 'currentColor'} />
                    {isAnalyzing ? 'Synthesizing...' : 'Analyze Holistic Match'}
                  </button>
                  <button 
                    onClick={handleResetCore}
                    title="Reset Intelligence Core (wipes all candidates)"
                    className="w-12 h-12 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center justify-center transition-all group"
                  >
                    <AlertCircle size={18} className="group-hover:rotate-12 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-2xl backdrop-blur-xl shrink-0 space-y-3 overflow-y-auto max-h-[400px] custom-scrollbar">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <User size={16} /> Manual Ingestion
              </h2>
              <input 
                placeholder="Full Name"
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                value={manualData.name}
                onChange={e => setManualData({...manualData, name: e.target.value})}
              />
              <div className="flex gap-2">
                <input 
                  type="number"
                  placeholder="Yrs Exp"
                  className="w-24 bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  value={manualData.experience}
                  onChange={e => setManualData({...manualData, experience: parseInt(e.target.value)})}
                />
                <input 
                  placeholder="GitHub URL"
                  className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  value={manualData.github_url}
                  onChange={e => setManualData({...manualData, github_url: e.target.value})}
                />
              </div>
              <textarea 
                placeholder="Profile Bio / Resume Snippet"
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-xs h-20 focus:outline-none"
                value={manualData.bio}
                onChange={e => setManualData({...manualData, bio: e.target.value})}
              />
              <input 
                placeholder="Manual Skills (comma separated)"
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                value={manualData.skills_csv}
                onChange={e => setManualData({...manualData, skills_csv: e.target.value})}
              />
              <button 
                onClick={handleManualAdd}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/10 transition-all"
              >
                Submit Multimodal Profile
              </button>
            </div>
          )}

          {/* Conversational UI */}
          <div className="flex-1 p-5 rounded-2xl bg-slate-900/30 border border-slate-800 shadow-inner overflow-hidden flex flex-col">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MessageSquare size={16} /> Intelligence Log
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {chatLog.map((chat, idx) => <ChatMessage key={idx} {...chat} />)}
              
              {/* Progressive loading visuals */}
              {isAnalyzing && (
                <div className="flex gap-3 mb-4 transition-all duration-500">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/50">
                    <div className="w-3 h-3 bg-indigo-400 rounded-full animate-ping" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-slate-800 border-slate-700 text-slate-400 text-sm italic">
                    {loadingStep === 1 ? "🔍 Generating Transformer Embeddings..." : loadingStep === 2 ? "🧠 Computing Latent Semantic Similarity..." : "📊 Synthesizing Holistic Match..."}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>

        {/* Main Ranking Panel */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-140px)]">
          {rankedCandidates.length === 0 && !isAnalyzing ? (
            <div className="flex-1 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-500 bg-slate-900/10">
              <Target size={64} className="mb-4 opacity-5" />
              <p className="text-xl font-semibold opacity-30 tracking-tight uppercase">Ready to source talent</p>
              <p className="text-xs opacity-40 mt-2">Configure job details and click "Analyze Candidates" to begin.</p>
            </div>
          ) : (
            <div className="flex gap-6 h-full">
              {/* Ranked Grid (Left half) */}
              <div className="w-1/2 overflow-y-auto custom-scrollbar pr-2 space-y-4 pb-10">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Candidate Ranking
                </h2>
                {rankedCandidates.map((cand, idx) => (
                  <div 
                    key={cand.candidate_id}
                    onClick={() => setSelectedProfile(cand)}
                    style={{ opacity: cand.visible ? 1 : 0, transform: cand.visible ? 'translateY(0)' : 'translateY(20px)' }}
                    className={`p-5 rounded-2xl border transition-all duration-500 cursor-pointer ${selectedProfile?.candidate_id === cand.candidate_id ? 'bg-indigo-900/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-black shadow-inner">
                          #{idx + 1}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-200 flex items-center gap-2">
                            {cand.candidate_name || "Candidate"}
                            {cand.recruiter_notes && <MessageSquare size={12} className="text-indigo-400" title="Manual note added" />}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 flex gap-1 items-center">
                            <CheckCircle2 size={12} className="text-emerald-400" /> {cand.matched_skills.length} Direct Matches
                          </p>
                        </div>
                      </div>
                      <AnimatedScore finalScore={cand.fit_score} />
                    </div>
                    
                    <SkillBar matched={cand.matched_skills.length} missing={cand.missing_skills.length} />
                    
                  </div>
                ))}
                {isAnalyzing && (
                  <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/20 opacity-50 animate-pulse h-32" />
                )}
              </div>

              {/* Explainable UI Panel (Right half) */}
              <div className="w-1/2 rounded-3xl bg-gradient-to-br from-slate-900 to-[#111827] border border-slate-800 p-8 shadow-2xl overflow-y-auto">
                <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <BrainCircuit size={18} /> AI Insight Panel
                </h2>
                
                {selectedProfile ? (
                  <div className="animate-fade-in space-y-8">
                    <div>
                      <h3 className="text-2xl font-black mb-1">{selectedProfile.candidate_name}</h3>
                      <p className="text-slate-400">Intelligence Consensus: <span className="text-white font-bold">{selectedProfile.fit_score}% Fit</span></p>
                    </div>

                    {/* Recruiter Manual Notes Layer */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recruiter Perspective (Editable)</h4>
                        {isSavingNote && <div className="text-[10px] text-indigo-400 animate-pulse uppercase font-black">Syncing...</div>}
                      </div>
                      <textarea 
                        className="w-full h-28 bg-slate-950/40 border border-slate-800 focus:border-indigo-500/50 rounded-2xl p-4 text-sm text-slate-300 focus:outline-none transition-all placeholder:italic"
                        placeholder="Add manual intelligence (e.g., 'Correctly lacks Python but has strong Java foundation')..."
                        value={currentNote}
                        onChange={(e) => setCurrentNote(e.target.value)}
                      />
                      <button 
                        onClick={handleSaveNote}
                        disabled={isSavingNote}
                        className="w-full py-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 group"
                      >
                        <MessageSquare size={14} className="group-hover:scale-110 transition-transform" /> Save Human Observation
                      </button>
                    </div>

                    {/* AI Insights Brain Panel with EXACT user required strings */}
                    <div className="relative">
                      <div className="absolute -left-3 top-0 bottom-0 w-1 bg-indigo-500/50 rounded-full" />
                      <div className="space-y-5 text-sm leading-relaxed text-slate-300">
                        {selectedProfile.recommendations && selectedProfile.recommendations.length > 0 ? (
                          selectedProfile.recommendations.map((rec, i) => (
                            <p key={i}>🧠 <span className="font-semibold text-slate-200 uppercase text-[10px] tracking-widest text-indigo-400">Insight:</span> {rec}</p>
                          ))
                        ) : (
                          <p>🧠 <span className="font-semibold text-indigo-400 uppercase text-[10px] tracking-widest">Insight:</span> Strong semantic alignment with role context and project experience.</p>
                        )}
                        
                        {selectedProfile.missing_skills.length > 0 && (
                          <div className="space-y-4 pt-2">
                            <p className="text-rose-300 bg-rose-500/5 p-4 rounded-xl border border-rose-500/10">
                              ⚠️ <span className="font-semibold text-rose-400 uppercase text-[10px] tracking-widest block mb-2">Gap:</span> 
                              The candidate lacks explicit background in {selectedProfile.missing_skills.slice(0, 3).join(', ')}.
                            </p>
                            
                            <p className="text-emerald-300 bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                              📈 <span className="font-semibold text-emerald-400 uppercase text-[10px] tracking-widest block mb-2">Suggestion:</span> 
                              Targeted training in {selectedProfile.missing_skills[0]} could improve fit score by ~12-15%.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <h4 className="text-xs font-bold text-emerald-400 mb-2 uppercase">Proven Match</h4>
                        <div className="flex flex-wrap gap-1">
                          {selectedProfile.matched_skills.map(s => <span key={s} className="px-2 py-1 text-[10px] bg-emerald-500/20 text-emerald-300 rounded-md font-medium capitalize">{s}</span>)}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                        <h4 className="text-xs font-bold text-rose-400 mb-2 uppercase">Missing</h4>
                        <div className="flex flex-wrap gap-1">
                          {selectedProfile.missing_skills.slice(0, 8).map(s => <span key={s} className="px-2 py-1 text-[10px] bg-rose-500/20 text-rose-300 rounded-md font-medium capitalize">{s}</span>)}
                        </div>
                      </div>
                    </div>

                    <button className="w-full py-4 glass-card border border-slate-700 hover:border-indigo-500 text-sm font-bold flex items-center justify-center gap-2 transition-all">
                      Review Full Portfolio <ChevronRight size={16} className="text-indigo-400" />
                    </button>
                    
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                    <User size={80} className="mb-4 text-slate-500" />
                    <p className="font-medium text-lg">No Profile Selected</p>
                    <p className="text-sm">Click a candidate card to view AI reasoning.</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
