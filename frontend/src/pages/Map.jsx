import React, { useState, useEffect, useRef } from "react";
import { Clock, Navigation2, Film } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Globe from "react-globe.gl";
import { getAdvisory } from "../api";
import CurtainView from "../components/CurtainView";
import { useOceanDataset } from "../hooks/useOceanDataset";
import { buildSstTexture } from "../utils/buildSstTexture";

export default function MapPage({ date, setDate, depth, setDepth, lat, setLat, lon, setLon }) {
  const [advisory, setAdvisory] = useState(null);
  const { data: oceanData, loading, error } = useOceanDataset(date);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState("2d");
  const [transectStart, setTransectStart] = useState(null);
  const [transectEnd, setTransectEnd] = useState(null);
  const [selectingTransect, setSelectingTransect] = useState(false);
  const [landPopup, setLandPopup] = useState(null);
  const [geoChecking, setGeoChecking] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const navigate = useNavigate();

  const globeRef = useRef();
  const [hover, setHover] = useState(null);      // {x, y, lat, lng, sst, geo}
  const geoCache = useRef({});
  const geoTimer = useRef(null);
  const lastMove = useRef(0);

  const lookupSst = (lat, lng) => {
    if (!oceanData?.data) return null;
    const { lat: lats, lon: lons, data } = oceanData;
    const res = lats[1] - lats[0];
    const iy = Math.round((lat - lats[0]) / res);
    const ix = Math.round((lng - lons[0]) / res);
    const v = data[iy]?.[ix];
    return v === null || v === undefined || Number.isNaN(v) ? null : v;
  };

  const handleMouseMove = (e) => {
    if (e.buttons) { setHover(null); return; }             // dragging/rotating
    const now = performance.now();
    if (now - lastMove.current < 50) return;               // throttle
    lastMove.current = now;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const c = globeRef.current?.toGlobeCoords(x, y);
    if (!c) { setHover(null); return; }

    const { lat, lng } = c;
    const inDomain = lat >= 5 && lat <= 30 && lng >= 45 && lng <= 105;
    const sst = inDomain ? lookupSst(lat, lng) : null;
    setHover({ x, y, lat, lng, sst, inDomain, geo: null });

    // reverse-geocode only after the cursor rests (saves API calls)
    clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(async () => {
      const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
      let geo = geoCache.current[key];
      if (!geo) {
        try {
          const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
          const j = await r.json();
          geo = { country: j.countryName || "", region: j.principalSubdivision || "", isLand: !!j.countryCode };
          geoCache.current[key] = geo;
        } catch { return; }
      }
      setHover(h => (h ? { ...h, geo } : h));
    }, 350);
  };

  // Measure container width so Globe never overflows
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    setContainerWidth(containerRef.current.offsetWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    getAdvisory(date, lat, lon).then(setAdvisory).catch(console.error);
  }, [date, lat, lon]);

  const [texture, setTexture] = useState(null);
  useEffect(() => {
    if (!oceanData?.data) return; // wait for field data
    buildSstTexture(oceanData).then(setTexture).catch(console.error);
  }, [oceanData]);

  const clearTransect = () => {
    setTransectStart(null);
    setTransectEnd(null);
    setSelectingTransect(true);
    setViewMode("2d");
  };

  const handleGlobeClick = async ({ lat: clickLat, lng: clickLng }) => {
    setLandPopup(null);
    setToastMsg("");
    
    // Bounding Box Check (5-30°N, 45-105°E)
    if (clickLat < 5 || clickLat > 30 || clickLng < 45 || clickLng > 105) {
      setToastMsg("No reconstructed data here — try within the North Indian Ocean domain (5-30°N, 45-105°E).");
      setTimeout(() => setToastMsg(""), 4000);
      return;
    }

    setGeoChecking(true);
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${clickLat}&longitude=${clickLng}&localityLanguage=en`
      );
      const data = await res.json();
      if (data.countryCode && data.countryCode.trim().length > 0) {
        setLandPopup({
          lat: clickLat, lng: clickLng,
          country: data.countryName || data.countryCode,
          region: data.principalSubdivision || "",
          city: data.city || data.locality || "",
          continent: data.continent || "",
        });
        setLat(clickLat);
        setLon(clickLng);
      } else {
        setLat(clickLat);
        setLon(clickLng);
        navigate("/deepdive");
      }
    } catch (err) {
      console.error("Geocode check failed", err);
      setLat(clickLat);
      setLon(clickLng);
      navigate("/deepdive");
    } finally {
      setGeoChecking(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", background: "var(--bg-input)", padding: "1rem", borderRadius: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700 }}>DATE</span>
          <input type="date" min="2023-06-01" max="2023-06-07" value={date} onChange={e => setDate(e.target.value)} style={{ border: "none", background: "transparent", outline: "none", fontWeight: 600, color: "var(--text-main)" }} />
        </div>
        <div style={{ width: "1px", background: "#E2E8F0", margin: "0 0.5rem" }}></div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700 }}>DEPTH</span>
          <select value={depth} onChange={e => setDepth(e.target.value)} style={{ border: "none", outline: "none", background: "transparent", fontWeight: 600 }}>
            {[0,5,10,20,30,50,75,100,125,150,200,300,500,700,1000].map(d => (
              <option key={d} value={d}>{d} m</option>
            ))}
          </select>
        </div>
        <div style={{ width: "1px", background: "#E2E8F0", margin: "0 0.5rem" }}></div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.9rem", color: "var(--primary)", fontWeight: 700 }}>
          <span>Current Target:</span> {lat.toFixed(2)}°N, {lon.toFixed(2)}°E
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 className="section-title" style={{ margin: 0 }}>3D Globe — Ocean Temperature</h2>
      </div>

      <div
        ref={containerRef}
        className={`task-card tour-globe-click ${isFullScreen ? "fullscreen-chart" : ""}`}
        style={{ position: "relative", height: isFullScreen ? "100vh" : "450px", padding: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "none", marginBottom: "2rem", background: "#000814", width: "100%" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <button
          onClick={() => setIsFullScreen(!isFullScreen)}
          style={{ position: "absolute", top: 10, left: 10, zIndex: 100, padding: "6px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer", fontWeight: 600, color: "var(--text-main)" }}
        >
          {isFullScreen ? "Exit Full Screen" : "Full Screen"}
        </button>

        {toastMsg && (
          <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 100, background: "rgba(239, 68, 68, 0.9)", color: "white", padding: "8px 16px", borderRadius: "8px", fontWeight: "bold", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
            {toastMsg}
          </div>
        )}

        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 100, background: "rgba(0,0,0,0.55)", color: "#aef", fontSize: "0.75rem", padding: "4px 10px", borderRadius: "20px", backdropFilter: "blur(4px)", pointerEvents: "none" }}>
          🌊 Click ocean → Deep Dive &nbsp;|&nbsp; 🏔 Click land → Stats
        </div>

        {geoChecking && (
          <div style={{ position: "absolute", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}>
            <div style={{ color: "#00d4ff", fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Detecting location…
            </div>
          </div>
        )}

        {landPopup && !geoChecking && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            zIndex: 300, background: "rgba(8,18,38,0.94)", border: "1.5px solid #00aaff",
            borderRadius: "16px", padding: "1.5rem 2rem", color: "#fff", minWidth: "270px",
            boxShadow: "0 8px 40px rgba(0,150,255,0.35)", backdropFilter: "blur(16px)", fontFamily: "monospace"
          }}>
            <button onClick={() => setLandPopup(null)} style={{ position: "absolute", top: "10px", right: "14px", background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            <div style={{ color: "#00ffaa", fontWeight: 800, fontSize: "1rem", marginBottom: "0.75rem", borderBottom: "1px solid #00aaff33", paddingBottom: "0.5rem" }}>
              🏔 LAND LOCATION STATS
            </div>
            {[
              ["Country", landPopup.country],
              landPopup.region ? ["Region", landPopup.region] : null,
              landPopup.city ? ["City / Locality", landPopup.city] : null,
              landPopup.continent ? ["Continent", landPopup.continent] : null,
              ["Latitude", `${landPopup.lat.toFixed(4)}°N`],
              ["Longitude", `${landPopup.lng.toFixed(4)}°E`],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.45rem", fontSize: "0.88rem" }}>
                <span style={{ color: "#88bbee" }}>{label}</span>
                <span style={{ fontWeight: 700 }}>{value || "—"}</span>
              </div>
            ))}
            <div style={{ marginTop: "1rem", fontSize: "0.74rem", color: "#667", textAlign: "center", borderTop: "1px solid #00aaff22", paddingTop: "0.6rem" }}>
              ⚠ Deep Dive is ocean-only. Click an ocean region to dive.
            </div>
          </div>
        )}

        {hover && !landPopup && (
          <div style={{
            position: "absolute", left: hover.x + 14, top: hover.y + 14, zIndex: 150,
            pointerEvents: "none", background: "rgba(8,18,38,0.92)", color: "#fff",
            border: "1px solid #00aaff", borderRadius: 8, padding: "8px 12px",
            fontSize: "0.8rem", fontFamily: "monospace", backdropFilter: "blur(6px)", minWidth: 170,
          }}>
            <div style={{ color: hover.geo?.isLand ? "#00ffaa" : "#00d4ff", fontWeight: 700, marginBottom: 4 }}>
              {hover.geo ? (hover.geo.isLand ? `🏔 ${hover.geo.country}` : "🌊 Ocean") : "…"}
            </div>
            {hover.geo?.region && <div>{hover.geo.region}</div>}
            <div>{hover.lat.toFixed(2)}°N, {hover.lng.toFixed(2)}°E</div>
            {hover.inDomain && !hover.geo?.isLand && (
              <div style={{ color: "#ffd166" }}>
                SST: {hover.sst !== null ? `${hover.sst.toFixed(2)} °C` : "no data"}
              </div>
            )}
            <div style={{ color: "#88a", marginTop: 4 }}>
              {hover.geo?.isLand ? "Click for land stats" : "Click to Deep Dive"}
            </div>
          </div>
        )}

        {viewMode === "3d" ? (
          <CurtainView startPoint={transectStart} endPoint={transectEnd} date={date} />
        ) : loading ? (
          <div style={{ color: "#aef", fontFamily: "monospace" }}>Loading…</div>
        ) : (
          <Globe
            ref={globeRef}
            globeImageUrl={texture || "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"}
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            showAtmosphere={true}
            atmosphereColor="#7fb8ff"
            atmosphereAltitude={0.15}
            width={isFullScreen ? window.innerWidth : (containerWidth || 400)}
            height={isFullScreen ? window.innerHeight : 450}
            onGlobeClick={handleGlobeClick}
          />
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      <h2 className="section-title">Active Alerts <span className="count-badge">({advisory?.alerts?.length || 0})</span></h2>
      <div className="cards-row">
        {advisory?.alerts?.length > 0 ? (
          advisory.alerts.map((alert, i) => (
            <div key={i} className="task-card red">
              <div className="task-title">Marine Warning</div>
              <div className="task-desc">{alert}</div>
              <div className="task-footer"><span><Clock size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Active Now</span></div>
            </div>
          ))
        ) : (
          <div className="task-card green">
            <div className="task-title">All Systems Normal</div>
            <div className="task-desc">No anomalous conditions detected in this region.</div>
            <div className="task-footer"><span><Clock size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Updated recently</span></div>
          </div>
        )}
      </div>
    </>
  );
}
