import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Controls from './components/Controls.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import FlatTypeSelector from './components/FlatTypeSelector.jsx';
import MonthSlider from './components/MonthSlider.jsx';
import MapView from './components/MapView.jsx';
import SearchBox from './components/SearchBox.jsx';
import TownPanel from './components/TownPanel.jsx';
import AddressPanel from './components/AddressPanel.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import { useResource } from './hooks/useResource.js';
import { useTheme } from './hooks/useTheme.js';
import { ALL_FLAT_TYPE, townMedians, computeBands, buildAddressIndex } from './lib/rentals.js';

const NEVER_MS = 24 * 60 * 60 * 1000; // static data — never auto-poll

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const location = useLocation();
  const isDashboard = location.pathname === '/';
  const { data, error, loading, refresh } = useResource(`${import.meta.env.BASE_URL}api/rentals`, NEVER_MS);

  const [flatType, setFlatType] = useState(ALL_FLAT_TYPE);
  const [monthIdx, setMonthIdx] = useState(null);
  const [selectedTown, setSelectedTown] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);

  const addressIndex = useMemo(() => (data ? buildAddressIndex(data) : []), [data]);

  const selectTown = (name) => { setSelectedAddress(null); setSelectedTown(name); };
  const selectAddress = (addr) => { setSelectedAddress(addr); setSelectedTown(addr.town); };

  // Default to the most recent month that has broad coverage (the very latest
  // months can be thin, since rentals are owner-declared as they're approved).
  useEffect(() => {
    if (!data || monthIdx != null) return;
    const total = data.towns.length;
    let chosen = data.months.length - 1;
    for (let i = data.months.length - 1; i >= 0; i--) {
      if (townMedians(data, ALL_FLAT_TYPE, i).size >= total * 0.7) { chosen = i; break; }
    }
    setMonthIdx(chosen);
  }, [data, monthIdx]);

  const medians = useMemo(
    () => (data && monthIdx != null ? townMedians(data, flatType, monthIdx) : new Map()),
    [data, flatType, monthIdx]
  );

  const bands = useMemo(
    () => computeBands([...medians.values()].map((c) => c.median)),
    [medians]
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">🔑</span>
          <div className="brand-text">
            <h1 className="brand-title">Singapore HDB Rental Prices</h1>
            <span className="brand-subtitle">Median rent by town · data.gov.sg</span>
          </div>
        </div>
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}>Dashboard</NavLink>
          <NavLink to="/projects" className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}>Projects</NavLink>
        </nav>
        <div className="header-actions">
          {isDashboard && (
            <Controls
              onRefresh={refresh}
              loading={loading}
              error={error}
              hasData={!!data}
              monthRange={data?.monthRange}
              count={data?.totalRecords}
            />
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>
      <Routes>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/" element={<main className="app-main">
        <section className="map-card">
          {data && monthIdx != null && (
            <div className="map-toolbar">
              <FlatTypeSelector
                flatTypes={data.flatTypes}
                counts={data.flatTypeCounts}
                value={flatType}
                onChange={setFlatType}
              />
              <MonthSlider months={data.months} value={monthIdx} onChange={setMonthIdx} />
            </div>
          )}
          {data && (
            <SearchBox
              towns={data.towns}
              medians={medians}
              addressIndex={addressIndex}
              flatType={flatType}
              onSelectTown={selectTown}
              onSelectAddress={selectAddress}
            />
          )}
          {data && monthIdx != null ? (
            <MapView
              towns={data.towns}
              medians={medians}
              bands={bands}
              addresses={addressIndex}
              flatType={flatType}
              selectedTown={selectedTown}
              selectedAddress={selectedAddress}
              onSelect={selectTown}
              onSelectAddress={selectAddress}
            />
          ) : (
            <div className="map-loading">
              {error ? `Could not load data: ${error}` : 'Loading rental data…'}
            </div>
          )}
        </section>

        <section className="side-column">
          {data && (
            <SearchBox
              towns={data.towns}
              medians={medians}
              addressIndex={addressIndex}
              flatType={flatType}
              onSelectTown={selectTown}
              onSelectAddress={selectAddress}
            />
          )}
          {data && monthIdx != null && (
            selectedAddress ? (
              <AddressPanel
                addr={selectedAddress}
                flatType={flatType}
                onBack={() => setSelectedAddress(null)}
                onClose={() => { setSelectedAddress(null); setSelectedTown(null); }}
              />
            ) : (
              <TownPanel
                data={data}
                town={selectedTown}
                flatType={flatType}
                monthIdx={monthIdx}
                onClose={() => setSelectedTown(null)}
              />
            )
          )}
        </section>
        </main>} />
      </Routes>

      <footer className="app-footer">
        <span>
          Data from <a href="https://data.gov.sg" target="_blank" rel="noreferrer">data.gov.sg</a> — "Renting Out of Flats from Jan 2021", published by HDB. Rents are owner-declared and not verified.
          Address coordinates &copy; <a href="https://www.onemap.gov.sg" target="_blank" rel="noreferrer">OneMap</a>, Singapore Land Authority.
        </span>
        <span>
          Made by Nilanka with <a href="https://claude.com/claude-code" target="_blank" rel="noreferrer">Claude Code</a> — 2026 May
        </span>
      </footer>
    </div>
  );
}
