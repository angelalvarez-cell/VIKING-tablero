import { useState, useEffect, useRef, useCallback } from "react";

/* =====================================================================
   CONEXIÓN — pega aquí la URL /exec de tu Apps Script (como en el Cotizador).
   Si se deja vacía, la app corre en MODO DEMO (datos locales, sin sincronizar).
===================================================================== */
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxf2HT7DtnmkeNjfEToLZF6nY5D7MheSmHfBesC87xM3rGOhra566tCDXfjid6RQrKy2g/exec";

/* ================= Catálogo ================= */
const GLASS_POSITIONS = [
  "Parabrisas", "Lateral del. izq.", "Lateral del. der.",
  "Lateral tras. izq.", "Lateral tras. der.", "Aletas / fijos", "Medallón", "Quemacocos",
];
const GRUPOS = {
  Delanteros: ["Lateral del. izq.", "Lateral del. der."],
  Traseros: ["Lateral tras. izq.", "Lateral tras. der.", "Aletas / fijos", "Medallón"],
};
GRUPOS.Todos = [...GRUPOS.Delanteros, ...GRUPOS.Traseros];

const COBERTURAS = {
  "2 laterales del.": { pos: GRUPOS.Delanteros, cod: { "Viking": ["VK101"], "Viking Plus": ["VK102"] } },
  "4 laterales": { pos: ["Lateral del. izq.", "Lateral del. der.", "Lateral tras. izq.", "Lateral tras. der."], cod: { "Viking": ["VK103"], "Viking Plus": ["VK104"] } },
  "6 laterales": { pos: ["Lateral del. izq.", "Lateral del. der.", "Lateral tras. izq.", "Lateral tras. der.", "Aletas / fijos"], cod: { "Viking": ["VK105"], "Viking Plus": ["VK106"] } },
  "Medallón": { pos: ["Medallón"], cod: { "Viking": ["VK107"], "Viking Plus": ["VK108"] } },
  "Parabrisas": { pos: ["Parabrisas"], cod: { "Viking": ["VK110"], "Viking Plus": ["VK110"] } },
  "Cristales completos": { pos: ["Parabrisas", "Lateral del. izq.", "Lateral del. der.", "Lateral tras. izq.", "Lateral tras. der.", "Aletas / fijos", "Medallón"], cod: { "Viking Plus": ["VK106", "VK108", "VK110"] }, soloPlus: true },
};
const KEVLAR_ZONES = ["Puertas del.", "Puertas tras.", "Poste A", "Poste B", "Poste C", "Poste D", "Costados", "Cajuela / 5ª puerta", "Área de carga"];

const VEHICULOS = {
  "Toyota": [["Land Cruiser", "SUV"], ["Sequoia", "SUV"], ["4Runner", "SUV"], ["Tundra", "Pickup"], ["Hilux", "Pickup"], ["Camry", "Sedán"]],
  "Chevrolet": [["Suburban", "SUV"], ["Tahoe", "SUV"], ["Cheyenne", "Pickup"], ["Silverado", "Pickup"], ["Traverse", "SUV"]],
  "Ford": [["Lobo", "Pickup"], ["F-150", "Pickup"], ["Expedition", "SUV"], ["Explorer", "SUV"], ["Ranger", "Pickup"]],
  "GMC": [["Yukon", "SUV"], ["Sierra", "Pickup"], ["Denali", "SUV"]],
  "Jeep": [["Grand Cherokee", "SUV"], ["Wrangler", "SUV"], ["Cherokee", "SUV"], ["Gladiator", "Pickup"]],
  "Land Rover": [["Range Rover", "SUV"], ["Range Rover Sport", "SUV"], ["Defender", "SUV"], ["Discovery", "SUV"]],
  "Mercedes-Benz": [["GLE", "SUV"], ["GLS", "SUV"], ["Clase G", "SUV"], ["Clase S", "Sedán"], ["Sprinter", "Camioneta"]],
  "BMW": [["X5", "SUV"], ["X7", "SUV"], ["Serie 7", "Sedán"], ["X3", "SUV"]],
  "Audi": [["Q7", "SUV"], ["Q8", "SUV"], ["A8", "Sedán"], ["Q5", "SUV"]],
  "Volkswagen": [["Jetta", "Sedán"], ["Tiguan", "SUV"], ["Amarok", "Pickup"], ["Teramont", "SUV"]],
  "Nissan": [["Frontier", "Pickup"], ["Armada", "SUV"], ["Patrol", "SUV"], ["Sentra", "Sedán"]],
  "RAM": [["1500", "Pickup"], ["2500", "Pickup"], ["700", "Pickup"]],
  "Cadillac": [["Escalade", "SUV"], ["XT6", "SUV"]],
  "Lexus": [["LX", "SUV"], ["GX", "SUV"], ["RX", "SUV"]],
  "Tesla": [["Model X", "SUV"], ["Model S", "Sedán"], ["Model Y", "SUV"], ["Cybertruck", "Pickup"]],
  "Porsche": [["Cayenne", "SUV"], ["Macan", "SUV"]],
  "Dodge": [["Durango", "SUV"], ["Charger", "Sedán"]],
  "Otro": [["(escribir modelo)", "SUV"]],
};
const MARCAS = Object.keys(VEHICULOS);
const tipoDe = (marca, modelo) => { const row = (VEHICULOS[marca] || []).find((m) => m[0] === modelo); return row ? row[1] : ""; };
const nombreAuto = (a) => [a.marca, a.modelo].filter(Boolean).join(" ") || "Auto sin nombre";

const HITOS = [
  { n: "Ingresado", ow: "Vendedor", sig: "Ingresar" },
  { n: "Desmontaje", ow: "Vidrios", sig: "Terminé desmontaje" },
  { n: "Material cortado", ow: "Técnico Digital", sig: "Material cortado" },
  { n: "Armado de capas", ow: "Vidrios", sig: "Capas armadas + embolsado" },
  { n: "En autoclave", ow: "Líder", sig: "Metí al autoclave" },
  { n: "Montaje", ow: "Vidrios", sig: "Terminé montaje" },
  { n: "Calidad aprobada", ow: "Líder", sig: "Pasó calidad" },
  { n: "Entregado", ow: "Vendedor", sig: "Entregado" },
];
const HITO_DESMONTAJE = 1; // el carril de Kevlar se desbloquea al llegar aquí
const KEVLAR_HITOS = ["Sin empezar", "Plantillas", "Instalando", "Kevlar listo"];
const KEVLAR_SIG = ["Empecé plantillas", "Instalando", "Kevlar listo"];
const PUESTOS = ["Vendedor", "Líder de Taller", "Técnico Digital", "Vidrios 1", "Vidrios 2", "Kevlar", "Asistente", "Pintor"];

/* ================= Datos DEMO (solo sin backend) ================= */
const AUTOS_DEMO = [
  {
    id: 1, tipo: "Nuevo", marca: "Toyota", modelo: "Land Cruiser", tipoVeh: "SUV", anio: 2025, placa: "LZR-77-40", orden: "VK-1042",
    cliente: "A. Fuentes", bahia: "B1", entregaFecha: "2026-07-10", entregaHora: "18:00", nivel: "Viking Plus",
    paquete: { label: "Protección integral", codigos: ["VK106", "VK108", "VK110", "VK130×4", "VK132"] },
    glass: { "Parabrisas": "Viking Plus", "Lateral del. izq.": "Viking Plus", "Lateral del. der.": "Viking Plus", "Lateral tras. izq.": "Viking Plus", "Lateral tras. der.": "Viking Plus", "Aletas / fijos": "Viking Plus", "Medallón": "Viking Plus" },
    ahumado: { "Lateral tras. izq.": true, "Lateral tras. der.": true, "Aletas / fijos": true, "Medallón": true },
    kevlar: ["Puertas del.", "Puertas tras.", "Poste B", "Poste C", "Cajuela / 5ª puerta"], kevlarHito: 2,
    hito: 5, crew: ["Vidrios 1", "Vidrios 2"], motivo: "", notas: "Faltan 2 laterales por montar.",
  },
  {
    id: 2, tipo: "Nuevo", marca: "Tesla", modelo: "Model X", tipoVeh: "SUV", anio: 2024, placa: "MPT-08-93", orden: "VK-1043",
    cliente: "Const. Vega", bahia: "B2", entregaFecha: "2026-07-10", entregaHora: "16:00", nivel: "Viking Plus",
    paquete: { label: "4 laterales", codigos: ["VK104"] },
    glass: { "Lateral del. izq.": "Viking Plus", "Lateral del. der.": "Viking Plus", "Lateral tras. izq.": "Viking Plus", "Lateral tras. der.": "Viking Plus" },
    ahumado: { "Lateral del. izq.": true, "Lateral del. der.": true },
    kevlar: [], kevlarHito: 0, hito: 4, crew: ["Líder de Taller"], motivo: "", notas: "Sin marco — cuidado con sensores.",
  },
  {
    id: 3, tipo: "Garantía", marca: "Land Rover", modelo: "Range Rover Sport", tipoVeh: "SUV", anio: 2023, placa: "KTM-55-08", orden: "VK-0977",
    cliente: "M. Ibarra", bahia: "B3", entregaFecha: "2026-07-09", entregaHora: "18:00", nivel: "Viking Plus",
    paquete: { label: "Garantía", codigos: [] },
    glass: { "Lateral tras. izq.": "Viking Plus" }, ahumado: {},
    kevlar: [], kevlarHito: 0, hito: 1, crew: ["Kevlar", "Asistente"],
    motivo: "Delaminación en lateral tras. izq. — deslaminar y rehacer", notas: "Vidrio en base de datos, sin escaneo.",
  },
  {
    id: 4, tipo: "Nuevo", marca: "Chevrolet", modelo: "Suburban", tipoVeh: "SUV", anio: 2023, placa: "JGH-42-15", orden: "VK-1045",
    cliente: "R. Delgado", bahia: "B4", entregaFecha: "2026-07-16", entregaHora: "18:00", nivel: "Viking Plus",
    paquete: { label: "Cristales completos + Kevlar", codigos: ["VK106", "VK108", "VK110", "VK130×4"] },
    glass: { "Parabrisas": "Viking Plus", "Lateral del. izq.": "Viking Plus", "Lateral del. der.": "Viking Plus", "Lateral tras. izq.": "Viking Plus", "Lateral tras. der.": "Viking Plus", "Aletas / fijos": "Viking Plus", "Medallón": "Viking Plus" },
    ahumado: {}, kevlar: ["Puertas del.", "Puertas tras."], kevlarHito: 1,
    hito: 2, crew: ["Técnico Digital"], motivo: "", notas: "Moldes de Kevlar en base — corte directo CNC.",
  },
];

/* ================= Utilidades ================= */
const hoy = new Date();
const diasPara = (f) => Math.ceil((new Date(f + "T18:00:00") - hoy) / 86400000);
const kevlarListo = (a) => a.kevlar.length === 0 || a.kevlarHito >= 3;
const entregado = (a) => a.hito >= HITOS.length - 1 && kevlarListo(a);
function urgencia(a) { if (entregado(a)) return "listo"; const d = diasPara(a.entregaFecha); if (d <= 1) return "urgente"; if (d <= 3) return "proximo"; return "enTiempo"; }
const URG = {
  urgente:  { label: "Urgente",   c: "#e07a7a" },
  proximo:  { label: "Próximo",   c: "#c99b4a" },
  enTiempo: { label: "En tiempo", c: "#7da7c4" },
  listo:    { label: "Listo",     c: "#7dbb8d" },
};
const fechaCorta = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
const hora12 = (h) => { if (!h) return ""; const [hh, mm] = h.split(":").map(Number); return (hh % 12 || 12) + ":" + String(mm).padStart(2, "0") + (hh >= 12 ? " pm" : " am"); };
function resumenAhumado(a) {
  const refz = GLASS_POSITIONS.filter((p) => a.glass[p]);
  const ahu = refz.filter((p) => a.ahumado[p]);
  if (!ahu.length) return "Transparente";
  const del = GRUPOS.Delanteros.filter((p) => a.glass[p]);
  const tra = GRUPOS.Traseros.filter((p) => a.glass[p]);
  const sinPb = refz.filter((p) => p !== "Parabrisas");
  if (del.length && del.every((p) => a.ahumado[p]) && !tra.some((p) => a.ahumado[p]) && !a.ahumado["Parabrisas"]) return "Ahumado delanteros";
  if (tra.length && tra.every((p) => a.ahumado[p]) && !del.some((p) => a.ahumado[p]) && !a.ahumado["Parabrisas"]) return "Ahumado traseros";
  if (sinPb.every((p) => a.ahumado[p])) return a.ahumado["Parabrisas"] ? "Ahumado total + parabrisas" : "Ahumado total";
  return "Ahumado parcial";
}

/* ================= Capa de datos (Sheets o demo) ================= */
const MODO_DEMO = !BACKEND_URL;

async function apiListar() {
  const r = await fetch(BACKEND_URL);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Error al leer");
  return j.autos;
}
async function apiPost(payload) {
  const r = await fetch(BACKEND_URL, { method: "POST", body: JSON.stringify(payload) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Error al guardar");
  return j;
}

/* ================= Tokens ================= */
const T = {
  bg: "#0a0a0b", panel: "#101012", line: "#232327", line2: "#2e2e33",
  ink: "#f2f0ec", mut: "#8e8e94", dim: "#5b5b61",
  gold: "#c9973f", goldSoft: "#a37c34", goldDim: "rgba(201,151,63,0.14)",
  blue: "#7da7c4", teal: "#5aa08a",
};
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Michroma&family=Inter:wght@400;500;600;700&display=swap";
const DISPLAY = "'Michroma', 'Arial Black', sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

/* ================= App ================= */
export default function TableroViking() {
  const [vista, setVista] = useState("tv");
  const [autos, setAutos] = useState(MODO_DEMO ? AUTOS_DEMO : []);
  const [reloj, setReloj] = useState(new Date());
  const [ultimaSync, setUltimaSync] = useState(null);
  const [errorSync, setErrorSync] = useState(false);

  const cargar = useCallback(async () => {
    if (MODO_DEMO) return;
    try { setAutos(await apiListar()); setUltimaSync(new Date()); setErrorSync(false); }
    catch (e) { setErrorSync(true); }
  }, []);

  useEffect(() => { const t = setInterval(() => setReloj(new Date()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  // Polling: la TV consulta cada 8 s; las otras vistas cada 20 s
  useEffect(() => {
    if (MODO_DEMO) return;
    const ms = vista === "tv" ? 8000 : 20000;
    const t = setInterval(cargar, ms);
    return () => clearInterval(t);
  }, [vista, cargar]);

  const segsSync = ultimaSync ? Math.round((reloj - ultimaSync) / 1000) : null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: BODY }}>
      <link rel="stylesheet" href={FONT_LINK} />
      <style>{`
        @keyframes breathe { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes glow { 0%{box-shadow:0 0 0 1px ${T.gold}} 50%{box-shadow:0 0 0 1px ${T.gold}, 0 0 22px rgba(201,151,63,.35)} 100%{box-shadow:0 0 0 1px ${T.gold}} }
        @keyframes flash { 0%{background:${T.goldDim}} 100%{background:transparent} }
        @keyframes pop { 0%{transform:scale(1)} 40%{transform:scale(1.04)} 100%{transform:scale(1)} }
        .tnum { font-variant-numeric: tabular-nums; }
        .press { transition: transform .08s ease, filter .12s ease; }
        .press:active { transform: scale(.96); filter: brightness(1.12); }
        ::selection { background: rgba(201,151,63,.3); }
      `}</style>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 34px", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Shield />
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: 17, letterSpacing: "0.34em" }}>VIKING</div>
            <div style={{ fontSize: 9, letterSpacing: "0.42em", color: T.dim, marginTop: 3, textTransform: "uppercase" }}>Taller · by GAV</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 26 }}>
          {[["tv", "Taller"], ["tableta", "Tableta"], ["admin", "Control"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setVista(k)} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 2px", fontFamily: BODY, fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: vista === k ? T.gold : T.dim, borderBottom: `2px solid ${vista === k ? T.gold : "transparent"}` }}>{lbl}</button>
          ))}
        </nav>
        <div style={{ textAlign: "right" }}>
          <div className="tnum" style={{ fontFamily: DISPLAY, fontSize: 19 }}>{reloj.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</div>
          <div style={{ fontSize: 10.5, color: errorSync ? "#e07a7a" : T.dim, textTransform: MODO_DEMO ? "uppercase" : "none", marginTop: 2, letterSpacing: "0.04em" }}>
            {MODO_DEMO ? "modo demo · sin conexión" : errorSync ? "⚠ sin conexión — reintentando" : segsSync === null ? "conectando…" : `actualizado hace ${segsSync}s`}
          </div>
        </div>
      </header>

      {vista === "tv" && <VistaTV autos={autos} />}
      {vista === "tableta" && <VistaTableta autos={autos} setAutos={setAutos} recargar={cargar} />}
      {vista === "admin" && <Panel autos={autos} setAutos={setAutos} recargar={cargar} />}
    </div>
  );
}

/* ================= Vista TV (output) ================= */
function VistaTV({ autos }) {
  const orden = [...autos].filter((a) => !entregado(a)).sort((a, b) => diasPara(a.entregaFecha) - diasPara(b.entregaFecha));
  const ocupacion = {};
  PUESTOS.forEach((p) => (ocupacion[p] = null));
  autos.forEach((a) => a.crew.forEach((p) => { if (!ocupacion[p] && !entregado(a)) ocupacion[p] = { m: nombreAuto(a), e: HITOS[a.hito].n }; }));

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "16px 34px 60px" }}>
      <Leyenda />
      {orden.map((a, i) => <Banda key={a.id} auto={a} ultimo={i === orden.length - 1} />)}
      {orden.length === 0 && <div style={{ textAlign: "center", color: T.dim, padding: "60px 0" }}>Sin autos en proceso.</div>}
      <div style={{ marginTop: 40, display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 11, letterSpacing: "0.34em", color: T.gold, textTransform: "uppercase" }}>Equipo</span>
        <span style={{ flex: 1, height: 1, background: T.line }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", columnGap: 34, marginTop: 6 }}>
        {PUESTOS.map((p) => {
          const o = ocupacion[p];
          return (
            <div key={p} style={{ padding: "13px 0", borderBottom: `1px solid ${T.line}` }}>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", color: T.dim, textTransform: "uppercase" }}>{p}</div>
              <div style={{ fontSize: 13.5, marginTop: 4, fontWeight: o ? 600 : 400, color: o ? T.ink : T.dim, fontStyle: o ? "normal" : "italic" }}>{o ? o.m : "Disponible"}</div>
              {o && <div style={{ fontSize: 11, color: T.mut, marginTop: 1 }}>{o.e}</div>}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Leyenda() {
  const dot = (c) => <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />;
  const item = (sw, txt) => <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: T.mut }}>{sw}{txt}</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", paddingBottom: 14, marginBottom: 4, borderBottom: `1px solid ${T.line}` }}>
      {item(dot(T.blue), "Viking")}
      {item(dot(T.gold), "Viking Plus")}
      {item(<span style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: T.mut, border: `1px solid ${T.line2}`, borderRadius: 4, padding: "1px 6px" }}>ahumado</span>, "Con lámina ahumada")}
      {item(dot(T.teal), "Kevlar")}
    </div>
  );
}

function Banda({ auto, ultimo }) {
  const dias = diasPara(auto.entregaFecha);
  const u = URG[urgencia(auto)];
  const et = HITOS[auto.hito];
  const esG = auto.tipo === "Garantía";
  const pct = (auto.hito / (HITOS.length - 1)) * 100;
  const conKevlar = auto.kevlar.length > 0;

  return (
    <section style={{ padding: "26px 0 24px", borderBottom: ultimo ? "none" : `1px solid ${T.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 23, fontWeight: 700, letterSpacing: "-0.01em" }}>{nombreAuto(auto)} <span style={{ fontWeight: 400, color: T.mut, fontSize: 16 }}>{auto.anio}</span></h3>
            <span style={{ fontFamily: DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.gold, border: `1px solid ${T.goldSoft}`, borderRadius: 3, padding: "3px 8px" }}>{auto.bahia || "—"}</span>
            {esG && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#0a0a0b", background: T.gold, borderRadius: 3, padding: "4px 9px" }}>Garantía</span>}
          </div>
          <div className="tnum" style={{ fontSize: 12, color: T.dim, marginTop: 5, letterSpacing: "0.05em" }}>{auto.placa} &nbsp;·&nbsp; {auto.orden}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: u.c }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: u.c, marginRight: 7, verticalAlign: "middle", animation: u.label === "Urgente" ? "breathe 1.6s ease-in-out infinite" : "none" }} />{u.label}
            </span>
            <span className="tnum" style={{ fontFamily: DISPLAY, fontSize: 42, color: u.c, lineHeight: 1 }}>{entregado(auto) ? "✓" : dias <= 0 ? "HOY" : dias + "d"}</span>
          </div>
          <div style={{ fontSize: 12.5, color: T.mut, marginTop: 4, textTransform: "capitalize", letterSpacing: "0.03em" }}>{fechaCorta(auto.entregaFecha)} · {hora12(auto.entregaHora)}</div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        {esG ? (
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.16em", color: T.dim, textTransform: "uppercase", marginBottom: 5 }}>Motivo de garantía</div>
            <div style={{ fontSize: 15, color: T.ink, fontWeight: 600, lineHeight: 1.4 }}>{auto.motivo || "—"}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 40px" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", color: T.dim, textTransform: "uppercase", marginBottom: 8 }}>Vidrios</div>
              {GLASS_POSITIONS.filter((p) => auto.glass[p]).map((p) => {
                const plus = auto.glass[p] === "Viking Plus";
                return (
                  <div key={p} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "3px 0" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: plus ? T.gold : T.blue, flexShrink: 0, transform: "translateY(-1px)" }} />
                    <span style={{ fontSize: 13.5, color: T.ink, minWidth: 128 }}>{p}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: plus ? T.gold : T.blue }}>{auto.glass[p]}</span>
                    {auto.ahumado[p] && <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.mut, border: `1px solid ${T.line2}`, borderRadius: 4, padding: "1px 6px" }}>ahumado</span>}
                  </div>
                );
              })}
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", color: T.dim, textTransform: "uppercase", marginBottom: 8 }}>Kevlar</div>
              {auto.kevlar.length ? auto.kevlar.map((z) => (
                <div key={z} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "3px 0" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.teal, flexShrink: 0, transform: "translateY(-1px)" }} />
                  <span style={{ fontSize: 13.5, color: T.ink }}>{z}</span>
                </div>
              )) : <div style={{ fontSize: 13.5, color: T.dim, fontStyle: "italic" }}>Sin Kevlar</div>}
              {auto.paquete.codigos.length > 0 && <div className="tnum" style={{ fontSize: 11.5, color: T.dim, letterSpacing: "0.05em", marginTop: 12 }}>{auto.paquete.codigos.join("  ·  ")}</div>}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 9 }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 13, letterSpacing: "0.14em", color: T.gold, textTransform: "uppercase" }}>{et.n}</span>
          <span style={{ fontSize: 11.5, color: T.mut }}>{et.ow}</span>
          <span className="tnum" style={{ fontSize: 11, color: T.dim, marginLeft: "auto" }}>{auto.hito + 1} / {HITOS.length}</span>
        </div>
        <div style={{ position: "relative", height: 12, marginBottom: conKevlar ? 12 : 0 }}>
          <div style={{ position: "absolute", top: 5, left: 0, right: 0, height: 2, background: T.line2, borderRadius: 1 }} />
          <div style={{ position: "absolute", top: 5, left: 0, width: pct + "%", height: 2, background: `linear-gradient(90deg, ${T.goldSoft}, ${T.gold})`, borderRadius: 1 }} />
          {HITOS.map((s, i) => {
            const x = (i / (HITOS.length - 1)) * 100, done = i < auto.hito, now = i === auto.hito;
            return <span key={s.n} title={s.n} style={{ position: "absolute", top: now ? 0 : 2.5, left: `calc(${x}% - ${now ? 6 : 3.5}px)`, width: now ? 12 : 7, height: now ? 12 : 7, borderRadius: "50%", background: now ? T.gold : done ? T.goldSoft : T.line2, boxShadow: now ? `0 0 10px ${T.gold}` : "none" }} />;
          })}
        </div>
        {conKevlar && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.14em", color: T.teal, textTransform: "uppercase", width: 52 }}>Kevlar</span>
            <div style={{ position: "relative", flex: 1, height: 8 }}>
              <div style={{ position: "absolute", top: 3, left: 0, right: 0, height: 2, background: T.line2, borderRadius: 1 }} />
              <div style={{ position: "absolute", top: 3, left: 0, width: (auto.kevlarHito / 3) * 100 + "%", height: 2, background: T.teal, borderRadius: 1 }} />
              {[1, 2, 3].map((i) => {
                const x = (i / 3) * 100;
                return <span key={i} style={{ position: "absolute", top: 1, left: `calc(${x}% - 3px)`, width: 6, height: 6, borderRadius: "50%", background: i <= auto.kevlarHito ? T.teal : T.line2 }} />;
              })}
            </div>
            <span style={{ fontSize: 11, color: auto.kevlarHito >= 3 ? T.teal : T.mut }}>{KEVLAR_HITOS[auto.kevlarHito]}</span>
          </div>
        )}
      </div>

      {auto.crew.length > 0 && <div style={{ marginTop: 13, fontSize: 12.5, color: T.mut }}><span style={{ color: T.dim }}>Equipo&ensp;</span>{auto.crew.join(" · ")}{auto.notas ? <span style={{ color: T.dim, fontStyle: "italic" }}> &nbsp;—&nbsp; {auto.notas}</span> : null}</div>}
      {auto.crew.length === 0 && auto.notas && <div style={{ marginTop: 13, fontSize: 12.5, color: T.dim, fontStyle: "italic" }}>{auto.notas}</div>}
    </section>
  );
}

/* ================= Vista Tableta (input de técnicos) ================= */
function VistaTableta({ autos, setAutos, recargar }) {
  const [flash, setFlash] = useState(null);
  const [pend, setPend] = useState({});
  const doFlash = (id) => { setFlash(id); setTimeout(() => setFlash((f) => (f === id ? null : f)), 900); };
  const marcarPend = (id, v) => setPend((p) => ({ ...p, [id]: v }));

  const mover = async (id, tipoAccion, dir) => {
    const campo = tipoAccion === "hito" ? "hito" : "kevlarHito";
    const max = tipoAccion === "hito" ? HITOS.length - 1 : 3;
    const previo = autos.find((a) => a.id === id);
    if (!previo) return;
    const nuevoVal = Math.max(0, Math.min(max, previo[campo] + dir));
    // Actualización optimista
    setAutos((p) => p.map((a) => (a.id === id ? { ...a, [campo]: nuevoVal } : a)));
    if (dir > 0) doFlash(id);
    if (MODO_DEMO) return;
    marcarPend(id, true);
    try { await apiPost({ action: tipoAccion, id, dir }); }
    catch (e) {
      // Revertir si el backend rechazó (p. ej. Kevlar pendiente)
      setAutos((p) => p.map((a) => (a.id === id ? { ...a, [campo]: previo[campo] } : a)));
      alert("No se pudo guardar: " + e.message);
    }
    finally { marcarPend(id, false); recargar(); }
  };

  const enProceso = [...autos].filter((a) => !entregado(a)).sort((a, b) => diasPara(a.entregaFecha) - diasPara(b.entregaFecha));
  const entregadosSemana = autos.filter(entregado).length;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "18px 20px 70px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, marginBottom: 6, borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontSize: 13, color: T.mut }}>Toca cuando <b style={{ color: T.ink }}>termines</b> tu parte. El tablero se actualiza solo.</span>
        <span style={{ fontSize: 12.5, color: T.mut }}>Entregados esta semana <b className="tnum" style={{ color: T.gold, fontSize: 17, fontFamily: DISPLAY, marginLeft: 6 }}>{entregadosSemana}</b></span>
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
        {enProceso.map((a) => {
          const et = HITOS[a.hito];
          const esUltimo = a.hito >= HITOS.length - 1;
          const conKevlar = a.kevlar.length > 0;
          const bloqueaEntrega = a.hito === HITOS.length - 2 && !kevlarListo(a);
          const ocupado = !!pend[a.id];
          return (
            <div key={a.id} style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, animation: flash === a.id ? "flash .9s ease-out, pop .3s ease-out" : "none", opacity: ocupado ? 0.75 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 700 }}>{nombreAuto(a)} <span style={{ color: T.mut, fontWeight: 400, fontSize: 14 }}>{a.anio}</span></div>
                  <div className="tnum" style={{ fontSize: 12, color: T.dim, marginTop: 3 }}>{a.orden} · {a.bahia}{a.tipo === "Garantía" ? "  · GARANTÍA" : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9.5, letterSpacing: "0.16em", color: T.dim, textTransform: "uppercase" }}>Etapa actual</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 13, color: T.gold, marginTop: 2 }}>{et.n}</div>
                </div>
              </div>

              <div style={{ position: "relative", height: 10, margin: "16px 0 18px" }}>
                <div style={{ position: "absolute", top: 4, left: 0, right: 0, height: 2, background: T.line2 }} />
                <div style={{ position: "absolute", top: 4, left: 0, width: (a.hito / (HITOS.length - 1)) * 100 + "%", height: 2, background: T.gold }} />
                {HITOS.map((s, i) => { const x = (i / (HITOS.length - 1)) * 100, now = i === a.hito, done = i < a.hito;
                  return <span key={s.n} style={{ position: "absolute", top: now ? 0 : 2, left: `calc(${x}% - ${now ? 5 : 3}px)`, width: now ? 10 : 6, height: now ? 10 : 6, borderRadius: "50%", background: now ? T.gold : done ? T.goldSoft : T.line2 }} />; })}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
                <button className="press" onClick={() => mover(a.id, "hito", 1)} disabled={esUltimo || bloqueaEntrega || ocupado}
                  style={{ flex: 1, cursor: esUltimo || bloqueaEntrega ? "not-allowed" : "pointer", border: "none", borderRadius: 12, padding: "18px 20px", fontFamily: BODY, fontSize: 17, fontWeight: 700,
                    background: esUltimo ? T.line : bloqueaEntrega ? T.line2 : T.gold, color: esUltimo || bloqueaEntrega ? T.dim : "#0a0a0b" }}>
                  {esUltimo ? "✓ Entregado" : bloqueaEntrega ? "Falta terminar Kevlar" : "✓ " + HITOS[a.hito + 1].sig}
                </button>
                {a.hito > 0 && !esUltimo && (
                  <button className="press" onClick={() => mover(a.id, "hito", -1)} disabled={ocupado} title="Deshacer"
                    style={{ cursor: "pointer", border: `1px solid ${T.line2}`, background: "transparent", color: T.mut, borderRadius: 12, padding: "0 18px", fontSize: 13, fontFamily: BODY }}>Deshacer</button>
                )}
              </div>

              {conKevlar && (() => {
                const kevlarBloqueado = a.hito < HITO_DESMONTAJE;
                return (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, letterSpacing: "0.14em", color: T.teal, textTransform: "uppercase" }}>Carril Kevlar</span>
                    <span style={{ fontSize: 12.5, color: a.kevlarHito >= 3 ? T.teal : T.mut, fontWeight: 600 }}>{kevlarBloqueado ? "Se habilita al terminar el desmontaje" : KEVLAR_HITOS[a.kevlarHito]}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="press" onClick={() => mover(a.id, "kevlar", 1)} disabled={a.kevlarHito >= 3 || ocupado || kevlarBloqueado}
                      style={{ flex: 1, cursor: a.kevlarHito >= 3 || kevlarBloqueado ? "not-allowed" : "pointer", border: "none", borderRadius: 12, padding: "14px 18px", fontFamily: BODY, fontSize: 15, fontWeight: 700,
                        background: a.kevlarHito >= 3 || kevlarBloqueado ? T.line : T.teal, color: a.kevlarHito >= 3 || kevlarBloqueado ? T.dim : "#0a0a0b" }}>
                      {kevlarBloqueado ? "Kevlar en espera" : a.kevlarHito >= 3 ? "✓ Kevlar listo" : "✓ " + KEVLAR_SIG[a.kevlarHito]}
                    </button>
                    {a.kevlarHito > 0 && !kevlarBloqueado && (
                      <button className="press" onClick={() => mover(a.id, "kevlar", -1)} disabled={ocupado}
                        style={{ cursor: "pointer", border: `1px solid ${T.line2}`, background: "transparent", color: T.mut, borderRadius: 12, padding: "0 16px", fontSize: 13, fontFamily: BODY }}>Deshacer</button>
                    )}
                  </div>
                </div>
                );
              })()}
            </div>
          );
        })}
        {enProceso.length === 0 && <div style={{ textAlign: "center", color: T.dim, padding: "50px 0", fontSize: 14 }}>No hay autos en proceso.</div>}
      </div>
    </main>
  );
}

/* ================= Panel de Control (admin) ================= */
function Panel({ autos, setAutos, recargar }) {
  const [clave, setClave] = useState(MODO_DEMO ? "demo" : "");
  const [intento, setIntento] = useState("");
  const [nuevoId, setNuevoId] = useState(null);
  const [guardando, setGuardando] = useState({});
  const abierto = MODO_DEMO || clave !== "";

  if (!abierto) {
    return (
      <main style={{ maxWidth: 380, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 13, letterSpacing: "0.3em", color: T.gold, marginBottom: 18 }}>CONTROL</div>
        <input type="password" placeholder="Clave de administración" value={intento} onChange={(e) => setIntento(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setClave(intento); }}
          style={{ ...S.inp, textAlign: "center", fontSize: 15, padding: "13px" }} />
        <button onClick={() => setClave(intento)} style={{ ...S.gold, width: "100%", marginTop: 12, padding: "13px" }}>Entrar</button>
        <p style={{ fontSize: 11.5, color: T.dim, marginTop: 14 }}>La clave se valida al guardar. Sin ella, el backend rechaza cualquier cambio.</p>
      </main>
    );
  }

  const upd = (id, c, v) => setAutos((p) => p.map((a) => (a.id === id ? { ...a, [c]: v } : a)));
  const setMarca = (id, marca) => setAutos((p) => p.map((a) => (a.id === id ? { ...a, marca, modelo: "", tipoVeh: "" } : a)));
  const setModelo = (id, marca, modelo) => setAutos((p) => p.map((a) => (a.id === id ? { ...a, modelo, tipoVeh: tipoDe(marca, modelo) } : a)));
  const aplicarCob = (id, nombre) => setAutos((p) => p.map((a) => {
    if (a.id !== id) return a;
    const cob = COBERTURAS[nombre]; const nivel = cob.soloPlus ? "Viking Plus" : a.nivel;
    const glass = {}; cob.pos.forEach((q) => (glass[q] = nivel));
    return { ...a, glass, nivel, paquete: { label: nombre, codigos: [...(cob.cod[nivel] || cob.cod["Viking Plus"])] } };
  }));
  const integral = (id) => setAutos((p) => p.map((a) => {
    if (a.id !== id) return a;
    const glass = {}; COBERTURAS["Cristales completos"].pos.forEach((q) => (glass[q] = "Viking Plus"));
    return { ...a, glass, nivel: "Viking Plus", kevlar: ["Puertas del.", "Puertas tras.", "Cajuela / 5ª puerta"], paquete: { label: "Protección integral", codigos: ["VK106", "VK108", "VK110", "VK130×4", "VK132"] } };
  }));
  const ahuGrupo = (id, g) => setAutos((p) => p.map((a) => {
    if (a.id !== id) return a;
    const ahumado = {}; if (g !== "Ninguno") GRUPOS[g].forEach((q) => { if (a.glass[q]) ahumado[q] = true; });
    return { ...a, ahumado };
  }));
  const ahuPos = (id, q) => setAutos((p) => p.map((a) => {
    if (a.id !== id || !a.glass[q]) return a;
    const ah = { ...a.ahumado }; ah[q] ? delete ah[q] : (ah[q] = true); return { ...a, ahumado: ah };
  }));
  const tgl = (id, campo, v) => setAutos((p) => p.map((a) => (a.id === id ? { ...a, [campo]: a[campo].includes(v) ? a[campo].filter((x) => x !== v) : [...a[campo], v] } : a)));

  const agregar = () => {
    const nid = Math.max(0, ...autos.map((a) => a.id)) + 1;
    setNuevoId(nid);
    setAutos((p) => [{ id: nid, tipo: "Nuevo", marca: "", modelo: "", tipoVeh: "", anio: 2026, placa: "", orden: "VK-", cliente: "", bahia: "", entregaFecha: "2026-07-20", entregaHora: "18:00", nivel: "Viking Plus", paquete: { label: "Sin paquete", codigos: [] }, glass: {}, ahumado: {}, kevlar: [], kevlarHito: 0, hito: 0, crew: [], motivo: "", notas: "" }, ...p]);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardar = async (a) => {
    if (MODO_DEMO) return;
    setGuardando((g) => ({ ...g, [a.id]: "…" }));
    try { await apiPost({ action: "guardar", clave, auto: a }); setGuardando((g) => ({ ...g, [a.id]: "✓" })); setTimeout(() => setGuardando((g) => ({ ...g, [a.id]: "" })), 1800); recargar(); }
    catch (e) { setGuardando((g) => ({ ...g, [a.id]: "✗ " + e.message })); }
  };
  const eliminar = async (id) => {
    setAutos((p) => p.filter((a) => a.id !== id));
    if (MODO_DEMO) return;
    try { await apiPost({ action: "eliminar", clave, id }); recargar(); }
    catch (e) { alert("No se pudo eliminar: " + e.message); recargar(); }
  };

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "26px 34px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: T.mut, maxWidth: 600, lineHeight: 1.5 }}>
          Alta en menos de un minuto. El auto nuevo aparece arriba. {MODO_DEMO ? "MODO DEMO: los cambios no se guardan." : "Al terminar de editar un auto, toca Guardar."}
        </p>
        <button onClick={agregar} style={S.gold}>+ Agregar auto</button>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        {autos.map((a) => {
          const esG = a.tipo === "Garantía", nuevo = a.id === nuevoId;
          return (
            <div key={a.id} style={{ background: T.panel, border: `1px solid ${nuevo ? T.gold : T.line}`, borderRadius: 12, padding: 20, animation: nuevo ? "glow 1.6s ease-in-out 2" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Lbl>Ingreso</Lbl>
                {["Nuevo", "Garantía"].map((t) => <button key={t} onClick={() => upd(a.id, "tipo", t)} style={S.chip(a.tipo === t)}>{t}</button>)}
                {esG && <span style={{ fontSize: 11.5, color: T.mut, marginLeft: 6 }}>Sin facturar · elige la etapa de arranque según la reparación</span>}
                <button onClick={() => eliminar(a.id)} style={{ ...S.ghost, marginLeft: "auto", color: "#c96a6a", borderColor: "rgba(201,106,106,.35)" }}>Eliminar</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr .55fr .8fr .55fr", gap: 10, marginBottom: 10 }}>
                <Campo label="Marca">
                  <select style={S.inp} value={a.marca} onChange={(e) => setMarca(a.id, e.target.value)}>
                    <option value="">— elige —</option>
                    {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Campo>
                <Campo label={"Modelo" + (a.tipoVeh ? " · " + a.tipoVeh : "")}>
                  {a.marca === "Otro" ? (
                    <input style={S.inp} value={a.modelo} onChange={(e) => upd(a.id, "modelo", e.target.value)} placeholder="Escribir modelo" />
                  ) : (
                    <select style={S.inp} value={a.modelo} onChange={(e) => setModelo(a.id, a.marca, e.target.value)} disabled={!a.marca}>
                      <option value="">{a.marca ? "— elige —" : "elige marca"}</option>
                      {(VEHICULOS[a.marca] || []).map((m) => <option key={m[0]} value={m[0]}>{m[0]}</option>)}
                    </select>
                  )}
                </Campo>
                <Campo label="Año"><input style={S.inp} type="number" value={a.anio} onChange={(e) => upd(a.id, "anio", Number(e.target.value))} /></Campo>
                <Campo label="Placa"><input style={S.inp} value={a.placa} onChange={(e) => upd(a.id, "placa", e.target.value)} /></Campo>
                <Campo label="Bahía"><input style={S.inp} value={a.bahia} onChange={(e) => upd(a.id, "bahia", e.target.value)} placeholder="B1" /></Campo>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr .8fr", gap: 10, marginBottom: 14 }}>
                <Campo label="Orden"><input style={S.inp} value={a.orden} onChange={(e) => upd(a.id, "orden", e.target.value)} /></Campo>
                <Campo label="Cliente (privado)"><input style={S.inp} value={a.cliente} onChange={(e) => upd(a.id, "cliente", e.target.value)} /></Campo>
                <Campo label="Entrega"><input style={S.inp} type="date" value={a.entregaFecha} onChange={(e) => upd(a.id, "entregaFecha", e.target.value)} /></Campo>
                <Campo label="Hora"><input style={S.inp} type="time" value={a.entregaHora} onChange={(e) => upd(a.id, "entregaHora", e.target.value)} /></Campo>
              </div>

              {esG ? (
                <div style={{ marginBottom: 14 }}><Campo label="Motivo de garantía"><input style={S.inp} value={a.motivo} onChange={(e) => upd(a.id, "motivo", e.target.value)} placeholder="ej. Delaminación lateral tras. izq. — deslaminar y rehacer" /></Campo></div>
              ) : (
                <>
                  <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      <Lbl>Nivel</Lbl>
                      {["Viking", "Viking Plus"].map((n) => <button key={n} onClick={() => upd(a.id, "nivel", n)} style={S.chip(a.nivel === n)}>{n}</button>)}
                      <span style={{ marginLeft: "auto", fontSize: 12, color: T.mut }}><b style={{ color: T.gold, fontWeight: 600 }}>{a.paquete.label}</b>{a.paquete.codigos.length ? <span className="tnum">&ensp;{a.paquete.codigos.join(" ")}</span> : null}</span>
                    </div>
                    <Lbl style={{ marginBottom: 6, display: "block" }}>Paquete — un clic</Lbl>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {Object.keys(COBERTURAS).map((n) => <button key={n} onClick={() => aplicarCob(a.id, n)} style={S.pkg}>{n}</button>)}
                      <button onClick={() => integral(a.id)} style={{ ...S.pkg, borderColor: T.goldSoft, color: T.gold }}>★ Protección integral</button>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
                      <Lbl>Ahumado</Lbl>
                      {["Ninguno", "Delanteros", "Traseros", "Todos"].map((g) => <button key={g} onClick={() => ahuGrupo(a.id, g)} style={S.chip(false)}>{g}</button>)}
                      <span style={{ fontSize: 11.5, color: T.mut }}>{resumenAhumado(a)}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {GLASS_POSITIONS.filter((q) => a.glass[q]).map((q) => <button key={q} onClick={() => ahuPos(a.id, q)} style={S.chip(!!a.ahumado[q])}>{q}{q === "Parabrisas" ? " ⚠" : ""}</button>)}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Lbl style={{ display: "block", marginBottom: 7 }}>Kevlar — zonas y postes</Lbl>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                      {KEVLAR_ZONES.map((z) => <button key={z} onClick={() => tgl(a.id, "kevlar", z)} style={S.chip(a.kevlar.includes(z))}>{z}</button>)}
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
                <Campo label={esG ? "Etapa de arranque / actual" : "Etapa actual"}>
                  <select style={S.inp} value={a.hito} onChange={(e) => upd(a.id, "hito", Number(e.target.value))}>
                    {HITOS.map((s, i) => <option key={s.n} value={i}>{i + 1}. {s.n} ({s.ow})</option>)}
                  </select>
                </Campo>
                <div>
                  <Lbl style={{ display: "block", marginBottom: 7 }}>Equipo asignado</Lbl>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                    {PUESTOS.map((p) => <button key={p} onClick={() => tgl(a.id, "crew", p)} style={S.chip(a.crew.includes(p))}>{p}</button>)}
                  </div>
                </div>
              </div>
              <Campo label="Notas"><textarea style={{ ...S.inp, minHeight: 42, resize: "vertical" }} value={a.notas} onChange={(e) => upd(a.id, "notas", e.target.value)} /></Campo>

              {!MODO_DEMO && (
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 14 }}>
                  <span style={{ fontSize: 12, color: guardando[a.id] && guardando[a.id].startsWith("✗") ? "#e07a7a" : T.teal }}>{guardando[a.id] || ""}</span>
                  <button onClick={() => guardar(a)} style={S.gold}>Guardar</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

/* ================= Piezas ================= */
function Campo({ label, children }) { return <label style={{ display: "block" }}><Lbl style={{ display: "block", marginBottom: 5 }}>{label}</Lbl>{children}</label>; }
function Lbl({ children, style }) { return <span style={{ fontSize: 9.5, letterSpacing: "0.18em", color: T.dim, textTransform: "uppercase", fontWeight: 600, ...style }}>{children}</span>; }
function Shield() {
  return (
    <svg width="26" height="30" viewBox="0 0 30 34" fill="none">
      <path d="M15 2 L27 7 V17 C27 25 21 30 15 32 C9 30 3 25 3 17 V7 Z" stroke={T.gold} strokeWidth="1.5" fill="none" />
      <path d="M15 8 L21 18 H9 Z" stroke={T.gold} strokeWidth="1.3" fill="none" />
    </svg>
  );
}
const S = {
  inp: { width: "100%", background: T.bg, border: `1px solid ${T.line2}`, borderRadius: 8, padding: "9px 11px", color: T.ink, fontSize: 13, fontFamily: BODY, boxSizing: "border-box", outline: "none" },
  gold: { fontSize: 12.5, fontWeight: 700, letterSpacing: "0.06em", padding: "10px 18px", borderRadius: 8, cursor: "pointer", border: "none", background: T.gold, color: "#0a0a0b", fontFamily: BODY },
  ghost: { fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", background: "transparent", border: `1px solid ${T.line2}`, color: T.mut, fontFamily: BODY },
  pkg: { fontSize: 12, fontWeight: 600, padding: "7px 13px", borderRadius: 8, cursor: "pointer", background: T.panel, border: `1px solid ${T.line2}`, color: T.ink, fontFamily: BODY },
  chip: (on) => ({ fontSize: 12, padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontFamily: BODY, border: `1px solid ${on ? T.goldSoft : T.line2}`, background: on ? T.goldDim : "transparent", color: on ? T.gold : T.mut, fontWeight: on ? 600 : 500 }),
};
