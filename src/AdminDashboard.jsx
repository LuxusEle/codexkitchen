import React from 'react';
import {ArrowLeft,Box,ShieldCheck} from 'lucide-react';
import AdminPanel from './AdminPanel.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import UserMenu from './UserMenu.jsx';
import {cloudDocument} from './project-workspace.js';
import './workspace.css';
import './business-admin.css';

export default function AdminDashboard({account,onBack,onOpenProject}){
  return <div className="workspace admin-workspace">
    <header className="workspace-header">
      <div className="brand"><span className="brand-icon"><ShieldCheck size={24}/></span><span>CODEX<span className="brand-light">KITCHEN</span><small>OWNER ADMINISTRATION</small></span></div>
      <div className="header-actions"><button className="secondary compact" onClick={onBack}><ArrowLeft size={16}/>Projects</button><ThemeToggle/><UserMenu account={account}/></div>
    </header>
    <main className="owner-dashboard">
      <div className="dashboard-heading"><div><p className="eyebrow">SUPER-ADMIN · BOTH BUSINESSES</p><h1>Business command centre</h1><p>People, activity, project quality, company settings and bar-token allocation in one place.</p></div><span className="admin-seal"><Box size={18}/>1 token = 1 full stock bar</span></div>
      <AdminPanel onOpenProject={project=>onOpenProject(cloudDocument(project))}/>
    </main>
  </div>;
}
