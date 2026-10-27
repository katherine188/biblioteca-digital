# Rincón Estelar

Biblioteca de ciencia ficción y fantasía. Primer parcial de Programación Web. Aplicación de una sola página en HTML, CSS y JavaScript puros (sin librerías) para gestionar un catálogo de libros, préstamos, historial y ajustes. Los datos se guardan en `localStorage`.

## Cómo ejecutarla
Abre `index.html` en el navegador. No necesita servidor ni instalación.

## Estructura
- `index.html`: las cuatro vistas y los dos modales.
- `css/styles.css`: estilos, tema claro/oscuro, diseño responsivo, transiciones y animación.
- `js/logica.js`: reglas de negocio (prestar, devolver, validar, agregar, editar, eliminar, filtrar, ordenar). No usa el DOM.
- `js/datos.js`: datos iniciales (fechas calculadas desde hoy) y persistencia.
- `js/ui.js`: dibuja la pantalla solo a partir de `libros` y `prestamos`.
- `js/app.js`: eventos que conectan las tres capas.

## Modelo
Dos colecciones: `libros` y `prestamos`. Disponible, prestado, vencido y días de retraso se calculan; nunca se guardan.
