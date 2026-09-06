import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * El sistema de diseño tiene que existir de verdad.
 *
 * Una variable CSS que no está definida no rompe nada: `var(--space-4)`
 * simplemente no produce valor, la declaración se descarta y la regla se
 * pierde. Ya pasó — seis componentes usaban `--space-*`, `--text-xs`,
 * `--color-gray-*`, `--color-white`, `--bg-color`, `--font-primary` y
 * `--danger`, ninguna definida. Ese padding y esos tamaños de letra nunca se
 * aplicaron y nadie se enteró, porque el modo de fallo es que no se vea nada
 * raro: solo se ve distinto de lo que el autor quiso.
 *
 * Lo mismo con las clases: `.btn-primary` se usaba en tres pantallas —incluido
 * el botón de guardar de la ficha de estudiante— y no existía en la hoja.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizSrc = path.resolve(aqui, '..');
const css = fs.readFileSync(path.join(aqui, 'index.css'), 'utf8');

function fuentes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entrada => {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return fuentes(completo);
    return /\.tsx$/.test(entrada.name) ? [completo] : [];
  });
}

const archivos = fuentes(raizSrc);
const relativo = (p: string) => path.relative(raizSrc, p).replace(/\\/g, '/');

describe('sistema de diseño', () => {
  it('define toda variable CSS que el código usa', () => {
    const definidas = new Set(
      [...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map(m => m[1]),
    );

    const huerfanas = new Map<string, Set<string>>();

    for (const archivo of [...archivos, path.join(aqui, 'index.css')]) {
      const texto = fs.readFileSync(archivo, 'utf8');
      for (const uso of texto.matchAll(/var\(\s*(--[\w-]+)\s*[,)]/g)) {
        const nombre = uso[1];
        if (definidas.has(nombre)) continue;
        if (!huerfanas.has(nombre)) huerfanas.set(nombre, new Set());
        huerfanas.get(nombre)!.add(relativo(archivo));
      }
    }

    expect(
      [...huerfanas.entries()].map(([v, donde]) => `${v} (${[...donde].join(', ')})`),
    ).toEqual([]);
  });

  it('define toda clase que el JSX aplica', () => {
    const definidas = new Set(
      [...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]),
    );

    // Clases que el propio componente construye: `toast-${tipo}` y compañía.
    // Se listan a mano porque su nombre no existe hasta que corre.
    const dinamicas = new Set([
      'toast-', 'badge-', 'kpi-icon-', 'bottom-nav-item-',
    ]);

    const huerfanas = new Map<string, Set<string>>();

    for (const archivo of archivos) {
      const texto = fs.readFileSync(archivo, 'utf8');
      const candidatas: string[] = [];

      for (const m of texto.matchAll(/className="([^"{}]+)"/g)) {
        candidatas.push(...m[1].split(/\s+/));
      }
      // Dentro de una plantilla se miran solo los trozos literales.
      for (const m of texto.matchAll(/className=\{`([^`]*)`\}/g)) {
        for (const trozo of m[1].split(/\$\{[^}]*\}/)) {
          candidatas.push(...trozo.split(/\s+/));
        }
      }

      for (const clase of candidatas.filter(Boolean)) {
        if (definidas.has(clase) || dinamicas.has(clase)) continue;
        if (!huerfanas.has(clase)) huerfanas.set(clase, new Set());
        huerfanas.get(clase)!.add(relativo(archivo));
      }
    }

    expect(
      [...huerfanas.entries()].map(([c, donde]) => `.${c} (${[...donde].join(', ')})`),
    ).toEqual([]);
  });

  it('no deja bloques <style> dentro de los componentes', () => {
    // Se reinyectan en cada montaje, obligan a `unsafe-inline` en la CSP y
    // parten el sistema de diseño en dos lugares que se contradicen: el bloque
    // de la navegación inferior duplicaba y pisaba al de index.css.
    const conEstilo = archivos
      .filter(a => fs.readFileSync(a, 'utf8').includes('<style>'))
      .map(relativo);

    expect(conEstilo).toEqual([]);
  });
});
