import { useEffect, useState } from 'react';
import type { Project } from './types';
import { loadProjects, saveProjects } from './utils/storage';
import { ProjectList } from './components/ProjectList/ProjectList';
import { ProjectEditor } from './components/ProjectEditor/ProjectEditor';
import { Help } from './components/Help/Help';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // 初回読み込み
  useEffect(() => {
    setProjects(loadProjects());
    setLoaded(true);
  }, []);

  // 自動保存
  useEffect(() => {
    if (loaded) saveProjects(projects);
  }, [projects, loaded]);

  const currentProject = currentId ? projects.find((p) => p.id === currentId) ?? null : null;

  const handleUpdateProject = (updated: Project) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p))
    );
  };

  const handleCreateProject = (project: Project) => {
    setProjects((prev) => [project, ...prev]);
    setCurrentId(project.id);
  };

  const handleDeleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (currentId === id) setCurrentId(null);
  };

  const handleImportProject = (project: Project) => {
    setProjects((prev) => [project, ...prev.filter((p) => p.id !== project.id)]);
  };

  const handleDuplicateProject = (id: string) => {
    const src = projects.find((p) => p.id === id);
    if (!src) return;
    const now = new Date().toISOString();
    const copy: Project = {
      ...src,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      name: `${src.name}（コピー）`,
      tasks: src.tasks.map((t) => ({
        ...t,
        id: Math.random().toString(36).slice(2, 10),
        bars: t.bars.map((b) => ({ ...b, id: Math.random().toString(36).slice(2, 10) })),
      })),
      createdAt: now,
      updatedAt: now,
    };
    setProjects((prev) => [copy, ...prev]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <span className="logo-mark">工</span>
          コウテイ.app
        </h1>
        <div className="app-header-right">
          {currentProject && (
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentId(null)}>
              ← 一覧
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowHelp(true)} title="使い方ガイド">
            ? 使い方
          </button>
        </div>
      </header>

      <main className="app-main">
        {currentProject ? (
          <ProjectEditor project={currentProject} onChange={handleUpdateProject} />
        ) : (
          <ProjectList
            projects={projects}
            onOpen={(id) => setCurrentId(id)}
            onCreate={handleCreateProject}
            onDelete={handleDeleteProject}
            onImport={handleImportProject}
            onDuplicate={handleDuplicateProject}
          />
        )}
      </main>

      {showHelp && <Help onClose={() => setShowHelp(false)} />}
    </div>
  );
}
