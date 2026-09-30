import React, { useState, useEffect, useRef } from "react";
import { Clock, Navigation2, Film } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Globe from "react-globe.gl";
import { getField, getAdvisory } from "../api";
import CurtainView from "../components/CurtainView";

export default function MapPage({ date, setDate, depth, setDepth, lat, setLat, lon, setLon }) {
  const [advisory, setAdvisory] = useState(null);
  const [fieldData, setFieldData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState("2d");
  const [transectStart, setTransectStart] = useState(null);
  const [transectEnd, setTransectEnd] = useState(null);
  const [selectingTransect, setSelectingTransect] = useState(false);
  const [landPopup, setLandPopup] = useState(null);
  const [geoChecking, setGeoChecking] = useState(false);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const navigate = useNavigate();

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

  useEffect(() => {
    setLoading(true);
    getField(date, depth)
      .then(data => { setFieldData(data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, [date, depth]);

  const clearTransect = () => {
    setTransectStart(null);
    setTransectEnd(null);
    setSelectingTransect(true);
    setViewMode("2d");
  };

  const handleGlobeClick = async ({ lat: clickLat, lng: clickLng }) => {
    setLandPopup(null);
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
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", background: "#F8F9FA", padding: "1rem", borderRadius: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700 }}>DATE</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ border: "none", background: "transparent", outline: "none", fontWeight: 600 }} />
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
        <div style={{ display: "flex", gap: "10px" }}>
          {selectingTransect && (
            <span style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", color: "#EAB308", fontWeight: 600 }}>
              {transectStart ? "Click to set End Point" : "Click to set Start Point"}
            </span>
          )}
          <button
            onClick={() => {
              if (viewMode === "2d") { if (transectStart && transectEnd) setViewMode("3d"); else clearTransect(); }
              else setViewMode("2d");
            }}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "var(--primary)", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, color: "white" }}
          >
            <Navigation2 size={16} />
            {viewMode === "2d" ? (transectStart && transectEnd ? "Show 3D Curtain" : "Draw 3D Transect") : "Back to Globe"}
          </button>
          <button
            onClick={() => navigate("/cinematic")}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "#F59E0B", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, color: "white" }}
          >
            <Film size={16} /> Launch Cinematic View
          </button>
          {transectStart && viewMode === "2d" && (
            <button onClick={clearTransect} style={{ padding: "6px 12px", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "6px", cursor: "pointer", fontWeight: 600, color: "var(--text-main)" }}>
              Clear Transect
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={`task-card ${isFullScreen ? "fullscreen-chart" : ""}`}
        style={{ position: "relative", height: isFullScreen ? "100vh" : "450px", padding: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "none", marginBottom: "2rem", background: "#000814", width: "100%" }}
      >
        <button
          onClick={() => setIsFullScreen(!isFullScreen)}
          style={{ position: "absolute", top: 10, left: 10, zIndex: 100, padding: "6px 12px", background: "white", border: "1px solid #E2E8F0", borderRadius: "6px", cursor: "pointer", fontWeight: 600, color: "var(--text-main)" }}
        >
          {isFullScreen ? "Exit Full Screen" : "Full Screen"}
        </button>

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

        {viewMode === "3d" ? (
          <CurtainView startPoint={transectStart} endPoint={transectEnd} />
        ) : loading ? (
          <div style={{ color: "#aef", fontFamily: "monospace" }}>Loading…</div>
        ) : (
          <Globe
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
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
