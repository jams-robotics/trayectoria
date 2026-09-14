# ADR-0001 · Astro con islas React

Fecha: 2026-09-13 · Estado: aceptado

## Contexto
La plataforma es principalmente contenido (27 temas en MDX) con piezas interactivas (widgets, dos simuladores). Necesita SEO (docentes buscan temas), carga rápida en conexiones modestas y autoalojado estático.

## Decisión
Astro para páginas y MDX con salida estática; React solo en islas interactivas (`client:visible` por defecto); estado compartido entre islas exclusivamente con nanostores.

## Alternativas descartadas
- SPA React con Vite: sin SEO real, carga inicial mayor. Más simple para agentes, pero peor producto.
- Next.js: acopla frontend y backend, más superficie de la necesaria.
- Godot exportado a web: inadecuado para una plataforma de contenido con cuentas e i18n.

## Consecuencias
Los agentes deben entender islas: reglas simples en `ARCHITECTURE.md` §3.1. Las páginas de simulador son casi todo isla.
