'use strict';

/*
 * UI: dibuja la pantalla a partir de los datos (libros y prestamos).
 * Todo se crea con createElement y textContent (nunca con HTML en texto).
 */
const Ui = (() => {
  const $ = id => document.getElementById(id);
  const ZONAS = ['catalogo', 'prestamos', 'formulario', 'ajustes'];
  const CAMPOS = ['titulo', 'autor', 'anio', 'genero', 'comentario', 'coleccion'];
  const NOMBRE_ESTADO = { disponible: 'Disponible', prestado: 'Prestado', coleccion: 'De colección' };
  let focoPrevio = null;

  // ---------- Constructores ----------
  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  }
  const etiqueta = (texto, tipo) => el('span', 'etiqueta etiqueta-' + tipo, texto);
  function boton(texto, accion, id, clase, aria, deshabilitado) {
    const b = el('button', 'btn ' + clase, texto);
    b.type = 'button';
    b.dataset.accion = accion;
    b.dataset.id = id;
    if (aria) b.setAttribute('aria-label', aria);
    b.disabled = !!deshabilitado;
    return b;
  }
  const tituloDe = (e, id) => {
    const l = Logica.buscarLibro(e, id);
    return l ? l.titulo : '(libro eliminado)';
  };

  // ---------- Navegación, mensajes, tema ----------
  function mostrarVista(v) {
    document.querySelectorAll('.vista').forEach(s => { s.hidden = s.id !== 'vista-' + v; });
    document.querySelectorAll('#menu a').forEach(a => {
      const activo = a.dataset.vista === v;
      a.classList.toggle('activo', activo);
      if (activo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function mensaje(zona, texto, tipo) {
    const p = $('msg-' + zona);
    p.textContent = texto || '';
    p.className = 'mensaje' + (texto ? ' mensaje-' + tipo : '');
    p.hidden = !texto;
  }
  const limpiarMensajes = () => ZONAS.forEach(z => mensaje(z, ''));
  function aplicarTema(tema) {
    document.documentElement.dataset.tema = tema;
    $('btn-tema').textContent = tema === 'oscuro' ? 'Activar modo día' : 'Activar modo noche';
  }

  // ---------- Vista 1: catálogo ----------
  function tarjeta(e, l) {
    const act = Logica.prestamoActivo(e, l.id);
    const vencido = !!act && Logica.estaVencido(act);
    const est = Logica.estadoDeLibro(e, l);
    const t = el('article', 'tarjeta' + (act ? ' prestado' : '') + (vencido ? ' vencido' : '') + (l.coleccion ? ' coleccion' : ''));

    const cab = el('div', 'tarjeta-cab');
    cab.append(el('h3', '', l.titulo), etiqueta(NOMBRE_ESTADO[est], est));
    t.append(cab, el('p', 'autor', l.autor), el('p', 'meta', l.anio + ' · ' + l.genero));
    if (l.comentario) t.append(el('p', 'comentario', l.comentario));

    if (act) {
      const info = el('div', 'info-prestamo');
      info.append(
        el('p', '', 'Prestado a ' + act.persona),
        el('p', '', 'Devolver antes del ' + Logica.formatear(act.fechaLimite))
      );
      if (vencido) {
        info.append(etiqueta('Vencido', 'vencido'),
          el('p', 'retraso', Logica.textoDias(Logica.diasRetraso(act)) + ' de retraso'));
      }
      t.append(info);
    }

    const ac = el('div', 'acciones');
    ac.append(
      act ? boton('Devolver', 'devolver', l.id, 'btn-primario', 'Devolver «' + l.titulo + '»')
          : boton('Prestar', 'prestar', l.id, 'btn-primario', 'Prestar «' + l.titulo + '»', l.coleccion),
      boton('Editar', 'editar', l.id, 'btn-sec', 'Editar «' + l.titulo + '»'),
      boton('Eliminar', 'eliminar', l.id, 'btn-peligro', 'Eliminar «' + l.titulo + '»')
    );
    t.append(ac);
    return t;
  }

  function renderCatalogo(e, f) {
    const lista = Logica.ordenar(Logica.filtrar(e, f), f.campo, f.dir);
    const cont = $('lista-libros');
    cont.replaceChildren();
    lista.forEach(l => cont.append(tarjeta(e, l)));
    $('contador').textContent = 'Mostrando ' + lista.length + ' de ' + e.libros.length + ' libros';
    $('vacio-catalogo').hidden = lista.length > 0;
    document.querySelectorAll('[data-filtro]').forEach(b => {
      const on = b.dataset.filtro === f.estado;
      b.classList.toggle('activo', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  // Reconstruye el selector de géneros con los que existen; devuelve el valor vigente.
  function renderGeneros(e, seleccionado) {
    const sel = $('filtro-genero');
    const gens = Logica.generos(e);
    const valor = gens.includes(seleccionado) ? seleccionado : '';
    sel.replaceChildren(new Option('Todos los géneros', ''), ...gens.map(g => new Option(g, g)));
    sel.value = valor;
    return valor;
  }

  function cargarControles(f) {
    $('buscar').value = f.texto;
    $('orden-campo').value = f.campo;
    $('orden-dir').value = f.dir;
  }

  // ---------- Vista 2: préstamos ----------
  function itemActivo(e, p) {
    const li = el('li', 'item' + (Logica.estaVencido(p) ? ' vencido' : ''));
    const info = el('div', 'item-info');
    info.append(el('strong', '', tituloDe(e, p.idLibro)),
      el('span', '', 'Prestado a ' + p.persona),
      el('span', '', 'Fecha límite: ' + Logica.formatear(p.fechaLimite)));
    if (Logica.estaVencido(p)) {
      info.append(etiqueta('Vencido', 'vencido'),
        el('span', 'retraso', Logica.textoDias(Logica.diasRetraso(p)) + ' de retraso'));
    }
    li.append(info, boton('Devolver', 'devolver', p.idLibro, 'btn-primario', 'Devolver «' + tituloDe(e, p.idLibro) + '»'));
    return li;
  }
  function itemHistorial(e, p) {
    const li = el('li', 'item');
    const retraso = Logica.diasRetraso(p);
    const info = el('div', 'item-info');
    info.append(el('strong', '', tituloDe(e, p.idLibro)),
      el('span', '', 'Prestado a ' + p.persona),
      el('span', '', 'Préstamo: ' + Logica.formatear(p.fechaPrestamo) + ' · Devolución: ' + Logica.formatear(p.fechaDevolucion)),
      retraso === 0 ? etiqueta('A tiempo', 'disponible')
                    : etiqueta('Con ' + Logica.textoDias(retraso) + ' de retraso', 'vencido'));
    li.append(info);
    return li;
  }
  function renderPrestamos(e) {
    const activos = Logica.activosOrdenados(e);
    const hist = Logica.historial(e);
    const la = $('lista-activos');
    const lh = $('lista-historial');
    la.replaceChildren(...activos.map(p => itemActivo(e, p)));
    lh.replaceChildren(...hist.map(p => itemHistorial(e, p)));
    $('vacio-activos').hidden = activos.length > 0;
    $('vacio-historial').hidden = hist.length > 0;
  }

  // ---------- Menú y vista 4 ----------
  function renderMenu(e, usuario) {
    $('num-prestamos').textContent = '(' + Logica.prestamosActivos(e).length + ')';
    const s = $('saludo');
    s.textContent = usuario ? 'Hola, ' + usuario : '';
    s.hidden = !usuario;
  }
  function renderResumen(e) {
    const r = Logica.resumen(e);
    const cont = $('resumen');
    cont.replaceChildren();
    [['Total de libros', r.total], ['Disponibles', r.disponibles], ['Prestados', r.prestados],
     ['Vencidos', r.vencidos], ['De colección', r.coleccion]].forEach(([nombre, valor]) => {
      const d = el('div', 'estadistica');
      d.append(el('strong', '', String(valor)), el('span', '', nombre));
      cont.append(d);
    });
    const ul = $('resumen-generos');
    ul.replaceChildren();
    if (!r.porGenero.length) ul.append(el('li', '', 'No hay libros.'));
    r.porGenero.forEach(([g, n]) => ul.append(el('li', '', g + ': ' + n)));
  }

  // ---------- Vista 3: formulario ----------
  function cargarGenerosForm(generos) {
    $('campo-genero').replaceChildren(new Option('Selecciona un género', ''), ...generos.map(g => new Option(g, g)));
  }
  function actualizarContador() {
    const quedan = Logica.MAX_COMENTARIO - $('campo-comentario').value.length;
    $('contador-comentario').textContent = 'Quedan ' + quedan + (quedan === 1 ? ' carácter' : ' caracteres');
  }
  function leerFormulario() {
    return {
      titulo: $('campo-titulo').value,
      autor: $('campo-autor').value,
      anio: $('campo-anio').value,
      genero: $('campo-genero').value,
      comentario: $('campo-comentario').value,
      coleccion: $('campo-coleccion').checked
    };
  }
  function mostrarErrores(errores) {
    let primero = null;
    CAMPOS.forEach(c => {
      const msg = errores[c];
      const campo = $('campo-' + c);
      $('error-' + c).textContent = msg || '';
      if (msg) {
        campo.setAttribute('aria-invalid', 'true');
        if (!primero) primero = campo;
      } else {
        campo.removeAttribute('aria-invalid');
      }
    });
    if (primero) primero.focus();
  }
  function modoEdicion(editando) {
    $('btn-enviar').textContent = editando ? 'Guardar cambios' : 'Añadir al catálogo';
    $('btn-cancelar-edicion').hidden = !editando;
    $('t-agregar').textContent = editando ? 'Editar libro' : 'Nuevo libro';
  }
  function limpiarFormulario() {
    $('form-libro').reset();
    mostrarErrores({});
    actualizarContador();
    modoEdicion(false);
  }
  function cargarFormulario(l) {
    $('campo-titulo').value = l.titulo;
    $('campo-autor').value = l.autor;
    $('campo-anio').value = String(l.anio);
    $('campo-genero').value = l.genero;
    $('campo-comentario').value = l.comentario || '';
    $('campo-coleccion').checked = l.coleccion;
    mostrarErrores({});
    actualizarContador();
    modoEdicion(true);
  }
  function errorUsuario(texto) {
    $('error-usuario').textContent = texto;
    if (texto) $('campo-usuario').setAttribute('aria-invalid', 'true');
    else $('campo-usuario').removeAttribute('aria-invalid');
  }

  // ---------- Modales ----------
  function abrirModal(id, foco) {
    focoPrevio = document.activeElement;
    $(id).hidden = false;
    foco.focus();
  }
  function abrirModalPrestar(titulo, nombre) {
    $('modal-prestar-libro').textContent = 'Libro: «' + titulo + '»';
    const i = $('input-persona');
    i.value = nombre || '';
    errorPersona('');
    abrirModal('modal-prestar', i);
    i.select();
  }
  function errorPersona(texto) {
    $('error-persona').textContent = texto;
    if (texto) $('input-persona').setAttribute('aria-invalid', 'true');
    else $('input-persona').removeAttribute('aria-invalid');
  }
  function abrirConfirmar(texto, detalle, etiquetaBtn) {
    $('modal-confirmar-texto').textContent = texto;
    $('modal-confirmar-detalle').textContent = detalle;
    $('btn-confirmar').textContent = etiquetaBtn;
    abrirModal('modal-confirmar', $('modal-confirmar').querySelector('[data-accion="cancelar-modal"]'));
  }
  function cerrarModal() {
    document.querySelectorAll('.modal-fondo').forEach(m => { m.hidden = true; });
    if (focoPrevio && document.contains(focoPrevio)) focoPrevio.focus();
    focoPrevio = null;
  }
  const hayModalAbierto = () => [...document.querySelectorAll('.modal-fondo')].some(m => !m.hidden);
  function atraparFoco(ev) {
    const m = document.querySelector('.modal-fondo:not([hidden]) .modal');
    if (!m) return;
    const f = [...m.querySelectorAll('button, input')].filter(x => !x.disabled);
    const primero = f[0];
    const ultimo = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
  }

  return {
    mostrarVista, mensaje, limpiarMensajes, aplicarTema,
    renderCatalogo, renderGeneros, cargarControles,
    renderPrestamos, renderMenu, renderResumen,
    cargarGenerosForm, actualizarContador, leerFormulario, mostrarErrores,
    modoEdicion, limpiarFormulario, cargarFormulario, errorUsuario,
    abrirModalPrestar, errorPersona, abrirConfirmar, cerrarModal, hayModalAbierto, atraparFoco
  };
})();
