import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-leaflet';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import MapLegend from './MapLegend.jsx';
import { bandOf, addressRent } from '../lib/rentals.js';
import { formatRentCompact } from '../lib/format.js';

// MapLibre finds its web worker by resolving a relative path off its own
// import.meta.url, which only works when it ships as a standalone file next
// to itself. Vite inlines it into our single bundle instead, so that lookup
// 404s and tiles silently never render (only the static background paints).
// Importing the worker as an explicit asset URL fixes the path for both dev
// and the production (subpath) build.
setWorkerUrl(maplibreWorkerUrl);

const DEFAULT_CENTER = [1.3521, 103.8198];
const DEFAULT_ZOOM = 11;
const FOCUS_ZOOM = 15;
const NEAR_ME_ZOOM = 16;

// At/above BLOCK_ZOOM the map swaps town markers for individual block markers
// (filtered to the viewport). Price labels only appear once we're zoomed in
// close enough that they won't overlap; below that, blocks render as dots.
const BLOCK_ZOOM = 15;
const BLOCK_LABEL_ZOOM = 16;
const MAX_BLOCKS = 700; // safety cap on markers rendered at once

// CARTO's legacy raster tile API (basemaps.cartocdn.com/rastertiles/...) now
// requires a paid key. This is their current free vector (GL) Voyager style,
// rendered via MapLibre GL — no key needed.
const VOYAGER_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://carto.com/about-carto/" target="_blank" rel="noreferrer">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const LOCATE_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>' +
  '<line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>' +
  '<line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>' +
  '</svg>';

const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<span class="user-location-pulse"></span><span class="user-location-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const addressPinIcon = L.divIcon({
  className: 'address-pin',
  html:
    '<svg width="26" height="34" viewBox="0 0 26 34" aria-hidden="true">' +
    '<path class="address-pin-body" d="M13 33C13 33 24 20.5 24 12.5C24 6.1 19 1 13 1C7 1 2 6.1 2 12.5C2 20.5 13 33 13 33Z"/>' +
    '<circle class="address-pin-hole" cx="13" cy="12.5" r="4.5"/></svg>',
  iconSize: [26, 34],
  iconAnchor: [13, 33],
});

function makeIcon(median, band, selected) {
  const label = median != null ? formatRentCompact(median) : '—';
  const sizeCls = selected ? 'rent-marker--selected' : '';
  return L.divIcon({
    className: `rent-marker rent-marker--${band} ${sizeCls}`.trim(),
    html: `<span class="rent-marker-label">${label}</span>`,
    iconSize: selected ? [56, 56] : [46, 46],
    iconAnchor: selected ? [28, 28] : [23, 23],
  });
}

function makeBlockIcon(median, band, withLabel, selected) {
  const selCls = selected ? ' block-marker--selected' : '';
  if (withLabel) {
    const label = median != null ? formatRentCompact(median) : '—';
    return L.divIcon({
      className: `block-marker block-marker--label block-marker--${band}${selCls}`,
      html: `<span class="block-marker-pill">${label}</span>`,
      iconSize: [44, 20],
      iconAnchor: [22, 10],
    });
  }
  return L.divIcon({
    className: `block-marker block-marker--dot block-marker--${band}${selCls}`,
    html: '<span class="block-marker-dot"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const sameAddress = (a, b) =>
  !!a && !!b && a.ti === b.ti && a.b === b.b && a.s === b.s;

export default function MapView({ towns, medians, bands, addresses, flatType, selectedTown, selectedAddress, onSelect, onSelectAddress }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef(new Map());
  const addressMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const [locationError, setLocationError] = useState(null);
  // Current zoom + bounds drive whether we show town or block markers.
  const [view, setView] = useState({ zoom: DEFAULT_ZOOM, bounds: null });

  // Init map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true, maxZoom: 19 })
      .setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.maplibreGL({ style: VOYAGER_STYLE_URL, attribution: TILE_ATTRIBUTION }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    const syncView = () => setView({ zoom: map.getZoom(), bounds: map.getBounds() });
    map.on('moveend zoomend', syncView);
    syncView();

    const MapActionsControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const el = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-actions-control');

        const home = L.DomUtil.create('a', 'map-action-home', el);
        home.href = '#';
        home.title = 'Reset view';
        home.setAttribute('role', 'button');
        home.setAttribute('aria-label', 'Reset map to Singapore overview');
        home.innerHTML = '⌂';

        const nearMe = L.DomUtil.create('a', 'map-action-nearme', el);
        nearMe.href = '#';
        nearMe.title = 'Show my location';
        nearMe.setAttribute('role', 'button');
        nearMe.setAttribute('aria-label', 'Show my location and zoom to nearby towns');
        nearMe.innerHTML = LOCATE_ICON_SVG;

        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.on(home, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.6 });
        });
        L.DomEvent.on(nearMe, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          if (nearMe.classList.contains('is-loading')) return;
          if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser.');
            return;
          }
          nearMe.classList.add('is-loading');
          setLocationError(null);

          const onSuccess = (pos) => {
            const latlng = [pos.coords.latitude, pos.coords.longitude];
            if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng(latlng);
            } else {
              userMarkerRef.current = L.marker(latlng, {
                icon: userLocationIcon,
                interactive: false,
                keyboard: false,
                zIndexOffset: 1000,
              }).addTo(map);
            }
            map.flyTo(latlng, NEAR_ME_ZOOM, { duration: 0.8 });
            nearMe.classList.remove('is-loading');
          };

          const fail = (err) => {
            let msg = 'Unable to get your location.';
            if (err.code === err.PERMISSION_DENIED) msg = 'Location permission denied — allow it in your browser, then retry.';
            else if (err.code === err.POSITION_UNAVAILABLE) msg = 'Location unavailable. On a Mac, turn on System Settings → Privacy & Security → Location Services for your browser.';
            else if (err.code === err.TIMEOUT) msg = 'Location request timed out — try again.';
            setLocationError(msg);
            nearMe.classList.remove('is-loading');
          };

          // Macs have no GPS, so a high-accuracy request often fails outright.
          // Try it first (best result on phones), then fall back to coarse
          // Wi-Fi/IP location, which usually succeeds on desktops.
          navigator.geolocation.getCurrentPosition(onSuccess, () => {
            navigator.geolocation.getCurrentPosition(onSuccess, fail, {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 300000,
            });
          }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
        });
        return el;
      },
    });
    new MapActionsControl().addTo(map);

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
      userMarkerRef.current = null;
    };
  }, []);

  // Rebuild markers when the view, data, or selection changes. Zoomed out we
  // show one marker per town; zoomed past BLOCK_ZOOM we swap to individual
  // block markers within the current viewport.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current.clear();

    if (view.zoom >= BLOCK_ZOOM && addresses?.length) {
      const { bounds } = view;
      const withLabel = view.zoom >= BLOCK_LABEL_ZOOM;
      let shown = 0;
      for (const a of addresses) {
        if (!a.g) continue;
        if (bounds && !bounds.contains(a.g)) continue;
        const rent = addressRent(a, flatType);
        if (!rent || rent.median == null) continue;
        const band = bandOf(rent.median, bands);
        const selected = sameAddress(a, selectedAddress);
        const marker = L.marker(a.g, { icon: makeBlockIcon(rent.median, band, withLabel, selected) });
        marker.bindTooltip(`${a.label} · ${formatRentCompact(rent.median)} (${rent.count})`, {
          direction: 'top',
          offset: [0, -8],
        });
        marker.on('click', () => onSelectAddress(a));
        marker.addTo(layer);
        if (++shown >= MAX_BLOCKS) break;
      }
      return;
    }

    for (const t of towns) {
      const cell = medians.get(t.name);
      const median = cell?.median ?? null;
      const band = bandOf(median, bands);
      const selected = t.name === selectedTown;
      const marker = L.marker([t.lat, t.lng], { icon: makeIcon(median, band, selected) });
      const tip = median != null
        ? `${t.name} · ${formatRentCompact(median)}${cell ? ` (${cell.count})` : ''}`
        : `${t.name} · no data`;
      marker.bindTooltip(tip, { direction: 'top', offset: [0, -16] });
      marker.on('click', () => onSelect(t.name));
      marker.addTo(layer);
      markersRef.current.set(t.name, marker);
    }
  }, [towns, medians, bands, selectedTown, onSelect, view, addresses, flatType, selectedAddress, onSelectAddress]);

  // Focus: a selected address (with coordinates) drops a precise pin and zooms
  // to the block; otherwise fall back to centring the selected town.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedAddress?.g) {
      const [lat, lng] = selectedAddress.g;
      if (addressMarkerRef.current) {
        addressMarkerRef.current.setLatLng([lat, lng]);
      } else {
        addressMarkerRef.current = L.marker([lat, lng], { icon: addressPinIcon, zIndexOffset: 1000, interactive: true }).addTo(map);
      }
      addressMarkerRef.current.bindTooltip(selectedAddress.label, { direction: 'top', offset: [0, -30] });
      map.flyTo([lat, lng], 17, { duration: 0.6 });
      setTimeout(() => addressMarkerRef.current?.openTooltip(), 650);
      return;
    }

    if (addressMarkerRef.current) {
      map.removeLayer(addressMarkerRef.current);
      addressMarkerRef.current = null;
    }
    if (selectedTown) {
      const t = towns.find((x) => x.name === selectedTown);
      if (t) {
        map.flyTo([t.lat, t.lng], FOCUS_ZOOM, { duration: 0.6 });
        const marker = markersRef.current.get(selectedTown);
        setTimeout(() => marker?.openTooltip(), 650);
      }
    }
  }, [selectedTown, selectedAddress, towns]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map" />
      <MapLegend bands={bands} />
      {locationError && (
        <div className="map-toast" role="alert">
          <span>{locationError}</span>
          <button
            type="button"
            className="map-toast-close"
            onClick={() => setLocationError(null)}
            aria-label="Dismiss location error"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
