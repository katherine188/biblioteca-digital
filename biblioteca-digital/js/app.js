'use strict';

/*
 * APP: conecta eventos (addEventListener) con Logica, Datos y Ui.
 * Flujo de cada cambio: Logica modifica el estado -> Datos guarda -> Ui redibuja.
 */
(() => {
  const $ = id => document.getElementById(id);

  let estado = Datos.cargarEstado();
  const orden = Datos.cargarOrden();
  const filtros = { texto: '', estado: 'todos', genero: '', campo: orden.campo, dir: orden.dir };
  const app = {
    vista: 'catalogo',
    editandoId: null,
    prestandoId: null,
    pendiente: null,
    usuario: Datos.cargarUsuario(),
    tema: Datos.cargarTema()
  };

  function renderTodo() {
    filtros.genero = Ui.renderGeneros(estado, filtros.genero);
    Ui.renderCatalogo(estado, filtros);
    Ui.renderPrestamos(estado);
    Ui.renderResumen(estado);
    Ui.renderMenu(estado, app.usuario);
  }
  function persistir() {
    Datos.guardarEstado(estado);
    renderTodo();
  }

  // ---------- Navegación ----------
  function irA(vista) {
    if (vista !== 'agregar' && app.editandoId !== null) cancelarEdicion();
    app.vista = vista;
    Ui.limpiarMensajes();
    Ui.mostrarVista(vista);
    window.scrollTo(0, 0);
  }
  $('menu').addEventListener('click', ev => {
    const a = ev.target.closest('a[data-vista]');
    if (!a) return;
    ev.preventDefault();
    irA(a.dataset.vista);
  });

  // ---------- Filtros, búsqueda y orden ----------
  $('buscar').addEventListener('input', ev => {
    filtros.texto = ev.target.value;
    Ui.renderCatalogo(estado, filtros);
  });
  document.querySelector('.filtros').addEventListener('click', ev => {
    const b = ev.target.closest('[data-filtro]');
    if (!b) return;
    filtros.estado = b.dataset.filtro;
    Ui.renderCatalogo(estado, filtros);
  });
  $('filtro-genero').addEventListener('change', ev => {
    filtros.genero = ev.target.value;
    Ui.renderCatalogo(estado, filtros);
  });
  function cambiarOrden() {
    filtros.campo = $('orden-campo').value;
    filtros.dir = $('orden-dir').value;
    Datos.guardarOrden(filtros.campo, filtros.dir);
    Ui.renderCatalogo(estado, filtros);
  }
  $('orden-campo').addEventListener('change', cambiarOrden);
  $('orden-dir').addEventListener('change', cambiarOrden);

  // ---------- Acciones sobre libros y préstamos ----------
  function pedirPrestamo(id) {
    const r = Logica.puedePrestar(estado, id);
    if (!r.ok) { Ui.mensaje('catalogo', r.mensaje, 'error'); return; }
    app.prestandoId = id;
    Ui.abrirModalPrestar(Logica.buscarLibro(estado, id).titulo, app.usuario);
  }
  function devolver(id, zona) {
    const r = Logica.devolver(estado, id);
    if (r.ok) persistir();
    Ui.mensaje(zona, r.mensaje, r.ok ? 'ok' : 'error');
  }
  function pedirEliminar(id) {
    const l = Logica.buscarLibro(estado, id);
    if (!l) return;
    if (Logica.prestamoActivo(estado, id)) {
      Ui.mensaje('catalogo', 'No se puede eliminar «' + l.titulo + '» porque tiene un préstamo activo.', 'error');
      return;
    }
    app.pendiente = { tipo: 'eliminar', id };
    Ui.abrirConfirmar('¿Eliminar «' + l.titulo + '»?', 'También se borra su historial de préstamos devueltos.', 'Eliminar');
  }
  function iniciarEdicion(id) {
    const l = Logica.buscarLibro(estado, id);
    if (!l) return;
    irA('agregar');
    app.editandoId = id;
    Ui.cargarFormulario(l);
    $('campo-titulo').focus();
  }

  function despachar(ev, zona) {
    const b = ev.target.closest('button[data-accion]');
    if (!b || b.disabled) return;
    const id = b.dataset.id;
    switch (b.dataset.accion) {
      case 'prestar': pedirPrestamo(id); break;
      case 'devolver': devolver(id, zona); break;
      case 'editar': iniciarEdicion(id); break;
      case 'eliminar': pedirEliminar(id); break;
    }
  }
  $('lista-libros').addEventListener('click', ev => despachar(ev, 'catalogo'));
  $('lista-activos').addEventListener('click', ev => despachar(ev, 'prestamos'));

  // ---------- Modales ----------
  function cerrarModal() {
    Ui.cerrarModal();
    app.prestandoId = null;
    app.pendiente = null;
  }
  document.addEventListener('click', ev => {
    if (ev.target.closest('[data-accion="cancelar-modal"]') || ev.target.classList.contains('modal-fondo')) {
      cerrarModal();
    }
  });
  $('form-prestar').addEventListener('submit', ev => {
    ev.preventDefault();
    const r = Logica.prestar(estado, app.prestandoId, $('input-persona').value);
    if (!r.ok && r.campo === 'persona') {
      Ui.errorPersona(r.mensaje);
      $('input-persona').focus();
      return;
    }
    cerrarModal();
    if (r.ok) persistir();
    Ui.mensaje('catalogo', r.mensaje, r.ok ? 'ok' : 'error');
  });
  $('btn-confirmar').addEventListener('click', () => {
    const p = app.pendiente;
    cerrarModal();
    if (!p) return;
    if (p.tipo === 'eliminar') {
      const r = Logica.eliminarLibro(estado, p.id);
      if (r.ok) persistir();
      Ui.mensaje('catalogo', r.mensaje, r.ok ? 'ok' : 'error');
    } else if (p.tipo === 'restablecer') {
      restablecer();
    }
  });

  // ---------- Formulario de libros ----------
  function cancelarEdicion() {
    app.editandoId = null;
    Ui.limpiarFormulario();
    Ui.mensaje('formulario', '');
  }
  $('form-libro').addEventListener('submit', ev => {
    ev.preventDefault();
    const datos = Ui.leerFormulario();
    const r = app.editandoId !== null
      ? Logica.editarLibro(estado, app.editandoId, datos)
      : Logica.agregarLibro(estado, datos);
    if (!r.ok) {
      Ui.mostrarErrores(r.errores);
      Ui.mensaje('formulario', r.mensaje || '', 'error');
      return;
    }
    persistir();
    app.editandoId = null;
    Ui.limpiarFormulario();
    Ui.mensaje('formulario', r.mensaje, 'ok');
  });
  $('btn-cancelar-edicion').addEventListener('click', cancelarEdicion);
  $('campo-comentario').addEventListener('input', Ui.actualizarContador);

  // ---------- Ajustes ----------
  $('btn-tema').addEventListener('click', () => {
    app.tema = app.tema === 'oscuro' ? 'claro' : 'oscuro';
    Datos.guardarTema(app.tema);
    Ui.aplicarTema(app.tema);
  });
  $('form-usuario').addEventListener('submit', ev => {
    ev.preventDefault();
    const nombre = $('campo-usuario').value.trim();
    const error = nombre ? Logica.validarPersona(nombre) : '';
    Ui.errorUsuario(error);
    if (error) { $('campo-usuario').focus(); return; }
    app.usuario = nombre;
    Datos.guardarUsuario(nombre);
    Ui.renderMenu(estado, app.usuario);
    Ui.mensaje('ajustes', nombre ? '¡Listo! Ahora el Rincón te saluda por tu nombre.' : 'Nombre borrado.', 'ok');
  });
  $('btn-restablecer').addEventListener('click', () => {
    app.pendiente = { tipo: 'restablecer' };
    Ui.abrirConfirmar('¿Restablecer la biblioteca?',
      'Se borra todo lo guardado y vuelven los libros y préstamos iniciales.', 'Restablecer');
  });
  function restablecer() {
    estado = Datos.restablecer();
    Object.assign(filtros, { texto: '', estado: 'todos', genero: '' }, Datos.ORDEN_DEFECTO);
    app.usuario = '';
    app.tema = Datos.temaPorDefecto();
    if (app.editandoId !== null) cancelarEdicion();
    $('campo-usuario').value = '';
    Ui.errorUsuario('');
    Ui.aplicarTema(app.tema);
    Ui.cargarControles(filtros);
    renderTodo();
    Ui.mensaje('ajustes', 'Biblioteca restablecida a los datos iniciales.', 'ok');
  }

  // ---------- Teclado: Escape y foco en modales ----------
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      if (Ui.hayModalAbierto()) {      // el modal tiene prioridad: no se toca el formulario
        ev.preventDefault();
        cerrarModal();
      } else if (app.vista === 'agregar') {
        cancelarEdicion();
      }
    } else if (ev.key === 'Tab' && Ui.hayModalAbierto()) {
      Ui.atraparFoco(ev);
    }
  });

  // ---------- Inicio ----------
  Ui.cargarGenerosForm(Datos.GENEROS);
  Ui.aplicarTema(app.tema);
  Ui.cargarControles(filtros);
  $('campo-usuario').value = app.usuario;
  Ui.actualizarContador();
  renderTodo();
  Ui.mostrarVista('catalogo');
})();
