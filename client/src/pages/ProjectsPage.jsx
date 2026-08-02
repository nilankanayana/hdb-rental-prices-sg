import { Link } from 'react-router-dom';

const PROJECTS = [
  {
    id: 'traffic',
    name: 'Singapore Traffic',
    description: 'Live LTA traffic cameras across expressways and checkpoints.',
    href: 'https://nilankawijewardana.com/projects/traffic-dashboard-sg/',
  },
  {
    id: 'carpark',
    name: 'HDB Carpark Availability',
    description: 'Real-time carpark lot availability across HDB estates.',
    href: 'https://nilankawijewardana.com/projects/hdb-carpark-availability-sg/',
  },
  {
    id: 'rental',
    name: 'HDB Rental Prices',
    description: 'Median rental price trends by town and flat type.',
    routerTo: '/',
  },
];

export default function ProjectsPage() {
  return (
    <main className="projects-page">
      <div className="projects-header">
        <h2 className="projects-title">Singapore Open Data</h2>
        <p className="projects-subtitle">
          Live dashboards built on public APIs from data.gov.sg.
        </p>
      </div>
      <div className="projects-grid">
        {PROJECTS.map((p) => {
          const card = (
            <div className="project-card">
              <div className="project-card-body">
                <h3 className="project-card-name">{p.name}</h3>
                <p className="project-card-desc">{p.description}</p>
              </div>
              <span className="project-card-cta">Open &rarr;</span>
            </div>
          );
          if (p.routerTo) {
            return <Link key={p.id} to={p.routerTo} className="project-card-link">{card}</Link>;
          }
          return <a key={p.id} href={p.href} target="_blank" rel="noreferrer" className="project-card-link">{card}</a>;
        })}
      </div>
    </main>
  );
}
