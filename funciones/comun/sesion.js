/* ══════════════════════════════════════════════════════════════════
   SESIÓN  ·  funciones/comun/sesion.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Revisa que haya sesión al abrir el editor (si no, vuelve al login), cerrar sesión y el menú de tema.
   QUIÉN LO USA: Se carga en el <head>, antes que todo.
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// Auth guard: si no hay sesión, redirige al login.
(async () => {
  try {
    const r = await fetch("/api/whoami", { credentials: "include" });
    if (!r.ok) { location.replace("/"); return; }
    const data = await r.json();
    window.SBB_USER = data;
    // Mostrar email + chip de usuario cuando el DOM esté listo
    const set = () => {
      const chip = document.getElementById("user-chip");
      const em = document.getElementById("user-email");
      if (chip && em) { em.textContent = data.email; chip.style.display = "flex"; }
      if (typeof aplicarPermisosUI === "function") aplicarPermisosUI();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", set);
    else set();
  } catch (e) { location.replace("/"); }
})();
async function cerrarSesion(){
  try { await fetch("/api/auth/logout", { method:"POST", credentials:"include" }); } catch(e) {}
  location.replace("/");
}
function toggleTemaPop(e){
  if(e) e.stopPropagation();
  const p = document.getElementById("tema-popover");
  if(p) p.classList.toggle("open");
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".tema-wrapper")) {
    const p = document.getElementById("tema-popover");
    if (p) p.classList.remove("open");
  }
});
