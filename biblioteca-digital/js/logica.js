'use strict';

/*
 * LÓGICA: reglas de negocio puras. No toca el DOM ni localStorage.
 * Recibe y modifica el "estado": { libros: [...], prestamos: [...] }.
 * Fechas como texto ISO "AAAA-MM-DD" (comparables como texto).
 */
const Logica = (() => {
  const MAX_ACTIVOS = 3;
  const DIAS_PRESTAMO = 14;
  const ANIO_MIN = 1000;
  const ANIO_MAX = 2026;
  const MAX_COMENTARIO = 120;
  const colador = new Intl.Collator('es');

  // ---------- Fechas ----------
  const pad = n => String(n).padStart(2, '0');
  const aISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hoy = () => aISO(new Date());
  function aUTC(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  function sumarDias(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    return aISO(new Date(y, m - 1, d + n));
  }
  const diasEntre = (desde, hasta) => Math.round((aUTC(hasta) - aUTC(desde)) / 86400000);
  function formatear(iso) {
    const [y, m, d] = iso.split('-');
    return d + '/' + m + '/' + y;
  }
  const textoDias = n => n + (n === 1 ? ' día' : ' días');

  // ---------- Utilidades ----------
  const generarId = pref => pref + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const normalizar = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');

  // ---------- Consultas (todo se calcula, nada se guarda) ----------
  const buscarLibro = (e, id) => e.libros.find(l => l.id === id) || null;
  const prestamoActivo = (e, idLibro) =>
    e.prestamos.find(p => p.idLibro === idLibro && p.fechaDevolucion === null) || null;
  const prestamosActivos = e => e.prestamos.filter(p => p.fechaDevolucion === null);
  const estaDisponible = (e, l) => !l.coleccion && !prestamoActivo(e, l.id);
  const estaVencido = (p, fecha = hoy()) => p.fechaDevolucion === null && p.fechaLimite < fecha;
  function diasRetraso(p, fecha = hoy()) {
    const fin = p.fechaDevolucion || fecha;
    return Math.max(0, diasEntre(p.fechaLimite, fin));
  }
  function estadoDeLibro(e, l) {
    if (l.coleccion) return 'coleccion';
    return prestamoActivo(e, l.id) ? 'prestado' : 'disponible';
  }
  const generos = e => [...new Set(e.libros.map(l => l.genero))].sort(colador.compare);

  function activosOrdenados(e) {
    return prestamosActivos(e).sort((a, b) =>
      a.fechaLimite.localeCompare(b.fechaLimite) || a.fechaPrestamo.localeCompare(b.fechaPrestamo));
  }
  function historial(e) {
    return e.prestamos.filter(p => p.fechaDevolucion !== null).sort((a, b) =>
      b.fechaDevolucion.localeCompare(a.fechaDevolucion) || b.fechaPrestamo.localeCompare(a.fechaPrestamo));
  }

  function resumen(e, fecha = hoy()) {
    const activos = prestamosActivos(e);
    const porGenero = {};
    e.libros.forEach(l => { porGenero[l.genero] = (porGenero[l.genero] || 0) + 1; });
    return {
      total: e.libros.length,
      disponibles: e.libros.filter(l => estaDisponible(e, l)).length,
      prestados: activos.length,
      vencidos: activos.filter(p => estaVencido(p, fecha)).length,
      coleccion: e.libros.filter(l => l.coleccion).length,
      porGenero: Object.entries(porGenero).sort((a, b) => colador.compare(a[0], b[0]))
    };
  }

  // ---------- Filtrar y ordenar ----------
  function filtrar(e, { texto = '', estado = 'todos', genero = '' }) {
    const q = normalizar(texto);
    return e.libros.filter(l => {
      if (q && !normalizar(l.titulo).includes(q) && !normalizar(l.autor).includes(q)) return false;
      if (genero && l.genero !== genero) return false;
      if (estado === 'disponibles' && !estaDisponible(e, l)) return false;
      if (estado === 'prestados' && !prestamoActivo(e, l.id)) return false;
      return true;
    });
  }
  // Devuelve una copia: el arreglo original no se altera.
  function ordenar(lista, campo, dir) {
    const signo = dir === 'desc' ? -1 : 1;
    return lista.slice().sort((a, b) => {
      let r = campo === 'anio' ? a.anio - b.anio : colador.compare(a[campo], b[campo]);
      if (r === 0) r = colador.compare(a.titulo, b.titulo);
      return r * signo;
    });
  }

  // ---------- Préstamos ----------
  function validarPersona(nombre) {
    const t = String(nombre || '').trim();
    return t.length < 2 || t.length > 40 ? 'El nombre debe tener entre 2 y 40 caracteres.' : '';
  }

  function puedePrestar(e, idLibro) {
    const l = buscarLibro(e, idLibro);
    if (!l) return { ok: false, mensaje: 'El libro no existe.' };
    if (l.coleccion) return { ok: false, mensaje: '«' + l.titulo + '» es un ejemplar de colección y no se presta.' };
    if (prestamoActivo(e, idLibro)) return { ok: false, mensaje: '«' + l.titulo + '» ya está prestado.' };
    if (prestamosActivos(e).length >= MAX_ACTIVOS) {
      return { ok: false, mensaje: 'No se puede prestar: ya hay ' + MAX_ACTIVOS + ' préstamos activos (el máximo).' };
    }
    return { ok: true };
  }

  function prestar(e, idLibro, persona, fecha = hoy()) {
    const r = puedePrestar(e, idLibro);
    if (!r.ok) return r;
    const error = validarPersona(persona);
    if (error) return { ok: false, campo: 'persona', mensaje: error };
    const nombre = persona.trim();
    const libro = buscarLibro(e, idLibro);
    e.prestamos.push({
      id: generarId('p'),
      idLibro,
      persona: nombre,
      fechaPrestamo: fecha,
      fechaLimite: sumarDias(fecha, DIAS_PRESTAMO),
      fechaDevolucion: null
    });
    return { ok: true, mensaje: '«' + libro.titulo + '» salió de viaje con ' + nombre + '.' };
  }

  function devolver(e, idLibro, fecha = hoy()) {
    const p = prestamoActivo(e, idLibro);
    const libro = buscarLibro(e, idLibro);
    if (!p || !libro) return { ok: false, mensaje: 'Ese libro no tiene un préstamo activo.' };
    p.fechaDevolucion = fecha;
    const retraso = diasRetraso(p);
    const mensaje = retraso === 0
      ? '«' + libro.titulo + '» regresó a tiempo a la estantería.'
      : '«' + libro.titulo + '» regresó con ' + textoDias(retraso) + ' de retraso.';
    return { ok: true, mensaje };
  }

  // ---------- Libros ----------
  function validarLibro(e, d, idEditando = null) {
    const err = {};
    const titulo = d.titulo.trim();
    const autor = d.autor.trim();
    const anioTxt = String(d.anio).trim();
    const anio = Number(anioTxt);

    if (titulo.length < 3 || titulo.length > 60) err.titulo = 'El título debe tener entre 3 y 60 caracteres.';
    if (!autor) err.autor = 'El autor es obligatorio.';
    if (anioTxt === '' || !Number.isInteger(anio) || anio < ANIO_MIN || anio > ANIO_MAX) {
      err.anio = 'El año debe ser un número entero entre ' + ANIO_MIN + ' y ' + ANIO_MAX + '.';
    }
    if (!d.genero) err.genero = 'Elige un género de la lista.';
    if (d.comentario.length > MAX_COMENTARIO) {
      err.comentario = 'El comentario no puede superar los ' + MAX_COMENTARIO + ' caracteres.';
    }
    if (!err.titulo && autor) {
      const duplicado = e.libros.some(l => l.id !== idEditando &&
        normalizar(l.titulo) === normalizar(titulo) && normalizar(l.autor) === normalizar(autor));
      if (duplicado) err.titulo = 'Ya existe un libro con ese título y ese autor.';
    }
    if (idEditando && d.coleccion && prestamoActivo(e, idEditando)) {
      err.coleccion = 'Un libro con préstamo activo no se puede marcar como de colección.';
    }
    return err;
  }

  function datosLimpios(d) {
    return {
      titulo: d.titulo.trim(),
      autor: d.autor.trim(),
      anio: Number(d.anio),
      genero: d.genero,
      comentario: d.comentario.trim(),
      coleccion: !!d.coleccion
    };
  }

  function agregarLibro(e, d) {
    const errores = validarLibro(e, d);
    if (Object.keys(errores).length) return { ok: false, errores };
    const libro = Object.assign({ id: generarId('l') }, datosLimpios(d));
    e.libros.push(libro);
    return { ok: true, mensaje: '«' + libro.titulo + '» ya forma parte del catálogo.' };
  }

  function editarLibro(e, id, d) {
    const libro = buscarLibro(e, id);
    if (!libro) return { ok: false, errores: {}, mensaje: 'El libro ya no existe.' };
    const errores = validarLibro(e, d, id);
    if (Object.keys(errores).length) return { ok: false, errores };
    Object.assign(libro, datosLimpios(d));
    return { ok: true, mensaje: 'Cambios guardados en «' + libro.titulo + '».' };
  }

  function eliminarLibro(e, id) {
    const libro = buscarLibro(e, id);
    if (!libro) return { ok: false, mensaje: 'El libro no existe.' };
    if (prestamoActivo(e, id)) {
      return { ok: false, mensaje: 'No se puede eliminar «' + libro.titulo + '» porque tiene un préstamo activo.' };
    }
    e.libros = e.libros.filter(l => l.id !== id);
    e.prestamos = e.prestamos.filter(p => p.idLibro !== id); // solo quedan los devueltos
    return { ok: true, mensaje: '«' + libro.titulo + '» se eliminó del catálogo junto con su historial.' };
  }

  return {
    MAX_ACTIVOS, DIAS_PRESTAMO, MAX_COMENTARIO,
    hoy, sumarDias, diasEntre, formatear, textoDias,
    buscarLibro, prestamoActivo, prestamosActivos, estaDisponible, estaVencido, diasRetraso,
    estadoDeLibro, generos, activosOrdenados, historial, resumen,
    filtrar, ordenar,
    validarPersona, puedePrestar, prestar, devolver,
    validarLibro, agregarLibro, editarLibro, eliminarLibro
  };
})();
