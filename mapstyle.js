// Monaco Made Easy map style: champagne land, Riviera-blue sea, charcoal and gold labels.
function mmeMapStyle(base, dark) {
  var C = dark ? {
    sea: "#1b2c3a", earth: "#1c232c", park: "#21302a", wood: "#1f2d26", beach: "#2b2a25", ped: "#232a33", bld: "#283039", bldLine: "#313b46",
    pier: "#262e37", roadCase: "#3a4450", road: "#2f3842", major: "#3d4752", majorCase: "#7a6a45", path: "#6a6252", rail: "#55606b",
    label: "#d9dee4", halo: "#141b22", roadLabel: "#aab3bd", place: "#e6d3a3"
  } : {
    sea: "#c6dfe8", earth: "#f4efe3", park: "#dde7cc", wood: "#d2e0c2", beach: "#f1e5c4", ped: "#eee6d3", bld: "#e6dbc5", bldLine: "#cbb995",
    pier: "#ebe3d2", roadCase: "#dccca9", road: "#fffdf8", major: "#fff8ea", majorCase: "#d4bd8a", path: "#bfa979", rail: "#b7ad9b",
    label: "#3a3f48", halo: "#f7f2e8", roadLabel: "#6b6456", place: "#7c5f1f"
  };
  function w(stops) { return ["interpolate", ["exponential", 1.6], ["zoom"]].concat(stops); }
  var notTunnel = ["!", ["has", "tunnel"]];
  return {
    version: 8,
    glyphs: base + "/fonts/glyphs/{fontstack}/{range}.pbf",
    sources: { mme: { type: "vector", tiles: ["mme://{z}/{x}/{y}"], minzoom: 10, maxzoom: 16, attribution: "© OpenStreetMap contributors" } },
    layers: [
      { id: "earth", type: "background", paint: { "background-color": C.earth } },
      { id: "sea", type: "fill", source: "mme", "source-layer": "sea", paint: { "fill-color": C.sea } },
      { id: "ped", type: "fill", source: "mme", "source-layer": "landuse", filter: ["==", ["get", "kind"], "pedestrian"], paint: { "fill-color": C.ped } },
      { id: "beach", type: "fill", source: "mme", "source-layer": "landuse", filter: ["==", ["get", "kind"], "beach"], paint: { "fill-color": C.beach } },
      { id: "green", type: "fill", source: "mme", "source-layer": "landuse", filter: ["in", ["get", "kind"], ["literal", ["park", "grass", "pitch", "cemetery", "scrub"]]], paint: { "fill-color": C.park } },
      { id: "wood", type: "fill", source: "mme", "source-layer": "landuse", filter: ["==", ["get", "kind"], "wood"], paint: { "fill-color": C.wood } },
      { id: "water", type: "fill", source: "mme", "source-layer": "water", paint: { "fill-color": C.sea } },
      { id: "pier", type: "fill", source: "mme", "source-layer": "pier", paint: { "fill-color": C.pier } },
      { id: "pier-line", type: "line", source: "mme", "source-layer": "pier_line", paint: { "line-color": C.pier, "line-width": w([14, 1.5, 18, 8]) } },
      { id: "buildings", type: "fill", source: "mme", "source-layer": "buildings", minzoom: 14, paint: { "fill-color": C.bld, "fill-outline-color": C.bldLine, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 16, 1] } },
      { id: "road-tunnel", type: "line", source: "mme", "source-layer": "roads", minzoom: 15, filter: ["all", ["has", "tunnel"], ["in", ["get", "kind"], ["literal", ["major", "medium", "minor"]]]],
        paint: { "line-color": C.roadCase, "line-width": w([15, 2, 18, 10]), "line-dasharray": [2, 1.5], "line-opacity": 0.7 } },
      { id: "path", type: "line", source: "mme", "source-layer": "roads", minzoom: 15, filter: ["all", notTunnel, ["==", ["get", "kind"], "path"]],
        paint: { "line-color": C.path, "line-width": w([15, 1, 18, 2.5]), "line-dasharray": [2, 1.2] } },
      { id: "steps", type: "line", source: "mme", "source-layer": "roads", minzoom: 15, filter: ["all", notTunnel, ["==", ["get", "kind"], "steps"]],
        paint: { "line-color": C.path, "line-width": w([15, 2, 18, 5]), "line-dasharray": [0.4, 0.4] } },
      { id: "road-case", type: "line", source: "mme", "source-layer": "roads", filter: ["all", notTunnel, ["in", ["get", "kind"], ["literal", ["minor", "service", "medium"]]]],
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.roadCase, "line-width": w([13, 1, 15, 4, 18, 20]) } },
      { id: "major-case", type: "line", source: "mme", "source-layer": "roads", filter: ["all", notTunnel, ["==", ["get", "kind"], "major"]],
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.majorCase, "line-width": w([12, 1.5, 15, 6, 18, 28]) } },
      { id: "road", type: "line", source: "mme", "source-layer": "roads", filter: ["all", notTunnel, ["in", ["get", "kind"], ["literal", ["minor", "service", "medium"]]]],
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.road, "line-width": w([13, 0.5, 15, 2.8, 18, 17]) } },
      { id: "major", type: "line", source: "mme", "source-layer": "roads", filter: ["all", notTunnel, ["==", ["get", "kind"], "major"]],
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.major, "line-width": w([12, 0.8, 15, 4.5, 18, 24]) } },
      { id: "rail", type: "line", source: "mme", "source-layer": "rail", filter: notTunnel, paint: { "line-color": C.rail, "line-width": w([13, 1, 18, 3]) } },
      { id: "road-label", type: "symbol", source: "mme", "source-layer": "roads", minzoom: 15, filter: ["has", "name"],
        layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Noto-Sans-Regular"], "text-size": w([15, 10.5, 18, 14]), "text-letter-spacing": 0.02 },
        paint: { "text-color": C.roadLabel, "text-halo-color": C.halo, "text-halo-width": 1.6 } },
      { id: "place-label", type: "symbol", source: "mme", "source-layer": "places",
        layout: { "text-field": ["get", "name"], "text-font": ["Noto-Sans-Medium"], "text-size": ["match", ["get", "kind"], "town", 15, "village", 14, 13], "text-transform": "uppercase", "text-letter-spacing": 0.08, "text-max-width": 8 },
        paint: { "text-color": C.place, "text-halo-color": C.halo, "text-halo-width": 1.8, "text-opacity": ["interpolate", ["linear"], ["zoom"], 17, 1, 18, 0] } }
    ]
  };
}
// The whole map of Monaco is one compressed file (about 1.4 MB). It's downloaded once, kept on the phone,
// and the tiles are read from it as the map needs them.
var mmeMapFile = null;
function mmeLoadMapFile() {
  if (!mmeMapFile) mmeMapFile = fetch("/tiles/monaco-map.bin").then(function (r) {
    if (!r.ok) throw new Error("map " + r.status);
    return new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  }).then(function (buf) {
    var n = new DataView(buf).getUint32(0, true);
    var index = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n)));
    return { buf: buf, index: index, start: 4 + n };
  }).catch(function (e) { mmeMapFile = null; throw e; });
  return mmeMapFile;
}
if (typeof window !== "undefined") {
  window.mmeMapStyle = mmeMapStyle;
  window.mmeOwnMapSupported = !!(window.maplibregl && window.DecompressionStream && window.TextDecoder);
  if (window.mmeOwnMapSupported) maplibregl.addProtocol("mme", function (params) {
    var k = params.url.replace("mme://", "");
    return mmeLoadMapFile().then(function (m) {
      var e = m.index[k];
      return { data: e ? m.buf.slice(m.start + e[0], m.start + e[0] + e[1]) : new ArrayBuffer(0) };
    });
  });
}
