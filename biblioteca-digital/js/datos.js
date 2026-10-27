'use strict';

/*
 * DATOS: datos iniciales y persistencia (localStorage). No toca el DOM.
 * Las fechas iniciales se calculan a partir de hoy.
 */
const Datos = (() => {
  const CLAVES = {
    libros: 'rincon_libros',
    prestamos: 'rincon_prestamos',
    tema: 'rincon_tema',
    usuario: 'rincon_usuario',
    orden: 'rincon_orden'
  };
  const GENEROS = ['Ciencia ficción', 'Fantasía', 'Distopía', 'Space opera', 'Cuentos', 'Ensayo'];
  const CAMPOS_ORDEN = ['titulo', 'autor', 'anio'];
  const ORDEN_DEFECTO = { campo: 'titulo', dir: 'asc' };

  function crearIniciales() {
    const h = Logica.hoy();
    const d = n => Logica.sumarDias(h, n);
    const libro = (id, titulo, autor, anio, genero, coleccion) =>
      ({ id, titulo, autor, anio, genero, comentario: '', coleccion });

    const libros = [
      libro('l1', 'Dune', 'Frank Herbert', 1965, 'Ciencia ficción', false),
      libro('l2', 'Fundación', 'Isaac Asimov', 1951, 'Ciencia ficción', false),
      libro('l3', 'El Hobbit', 'J. R. R. Tolkien', 1937, 'Fantasía', false),
      libro('l4', 'Fahrenheit 451', 'Ray Bradbury', 1953, 'Distopía', false),
      libro('l5', 'Solaris', 'Stanisław Lem', 1961, 'Ciencia ficción', true),
      libro('l6', 'Neuromante', 'William Gibson', 1984, 'Ciencia ficción', false),
      libro('l7', 'Un mago de Terramar', 'Ursula K. Le Guin', 1968, 'Fantasía', true),
      libro('l8', 'Ubik', 'Philip K. Dick', 1969, 'Ciencia ficción', false),
      libro('l9', 'La mano izquierda de la oscuridad', 'Ursula K. Le Guin', 1969, 'Ciencia ficción', false),
      libro('l10', 'Crónicas marcianas', 'Ray Bradbury', 1950, 'Cuentos', false),
      libro('l11', 'El señor de los anillos', 'J. R. R. Tolkien', 1954, 'Fantasía', false)
    ];

    const prestamo = (id, idLibro, persona, desde, devolucion) => ({
      id, idLibro, persona,
      fechaPrestamo: d(desde),
      fechaLimite: d(desde + Logica.DIAS_PRESTAMO),
      fechaDevolucion: devolucion === null ? null : d(devolucion)
    });

    const prestamos = [
      prestamo('p1', 'l1', 'Valeria', -20, null),    // activo y vencido (6 días)
      prestamo('p2', 'l2', 'Mateo', -3, null),       // activo, vence en 11 días
      prestamo('p3', 'l4', 'Camila', -30, -20),      // devuelto a tiempo
      prestamo('p4', 'l6', 'Santiago', -40, -20)     // devuelto con 6 días de retraso
    ];
    return { libros, prestamos };
  }

  // ---------- localStorage seguro ----------
  function leer(clave, defecto) {
    try {
      const t = localStorage.getItem(clave);
      return t === null ? defecto : JSON.parse(t);
    } catch (e) {
      return defecto;
    }
  }
  function escribir(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin espacio o bloqueado */ }
  }
  function borrar(clave) {
    try { localStorage.removeItem(clave); } catch (e) { /* nada */ }
  }

  // Comprueba que lo guardado tenga forma y reglas válidas; si no, se usan los iniciales.
  function datosValidos(libros, prestamos) {
    if (!Array.isArray(libros) || !Array.isArray(prestamos)) return false;
    const ids = new Set(libros.map(l => l && l.id));
    const okLibros = libros.every(l => l && typeof l.id === 'string' && typeof l.titulo === 'string' &&
      typeof l.autor === 'string' && typeof l.anio === 'number' && typeof l.genero === 'string' &&
      typeof l.coleccion === 'boolean');
    const okPrest = prestamos.every(p => p && typeof p.id === 'string' && ids.has(p.idLibro) &&
      typeof p.persona === 'string' && typeof p.fechaPrestamo === 'string' &&
      typeof p.fechaLimite === 'string' &&
      (p.fechaDevolucion === null || typeof p.fechaDevolucion === 'string'));
    if (!okLibros || !okPrest) return false;
    const activos = prestamos.filter(p => p.fechaDevolucion === null);
    const unicos = new Set(activos.map(p => p.idLibro)).size === activos.length;
    return unicos && activos.length <= Logica.MAX_ACTIVOS;
  }

  function cargarEstado() {
    const libros = leer(CLAVES.libros, null);
    const prestamos = leer(CLAVES.prestamos, null);
    return datosValidos(libros, prestamos) ? { libros, prestamos } : crearIniciales();
  }
  function guardarEstado(e) {
    escribir(CLAVES.libros, e.libros);
    escribir(CLAVES.prestamos, e.prestamos);
  }
  function restablecer() {
    Object.values(CLAVES).forEach(borrar);
    const e = crearIniciales();
    guardarEstado(e);
    return e;
  }

  // ---------- Tema, usuario y orden ----------
  function temaPorDefecto() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }
  function cargarTema() {
    const t = leer(CLAVES.tema, null);
    return t === 'claro' || t === 'oscuro' ? t : temaPorDefecto();
  }
  const guardarTema = t => escribir(CLAVES.tema, t);

  function cargarUsuario() {
    const u = leer(CLAVES.usuario, '');
    return typeof u === 'string' ? u : '';
  }
  function guardarUsuario(nombre) {
    if (nombre) escribir(CLAVES.usuario, nombre); else borrar(CLAVES.usuario);
  }

  function cargarOrden() {
    const o = leer(CLAVES.orden, null);
    if (o && CAMPOS_ORDEN.includes(o.campo) && (o.dir === 'asc' || o.dir === 'desc')) return o;
    return Object.assign({}, ORDEN_DEFECTO);
  }
  const guardarOrden = (campo, dir) => escribir(CLAVES.orden, { campo, dir });

  return {
    GENEROS, ORDEN_DEFECTO,
    cargarEstado, guardarEstado, restablecer,
    temaPorDefecto, cargarTema, guardarTema,
    cargarUsuario, guardarUsuario,
    cargarOrden, guardarOrden
  };
})();
