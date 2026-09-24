-- Conteo entregado por la escuela: un solo stock para Gambino y Vascongados.
-- Cada cantidad representa la unidad de inventario indicada, no las piezas
-- contenidas dentro de un set, estuche, caja o resma.
begin;

create temporary table utiles_compartidos_importacion (
  referencia integer primary key,
  producto text not null,
  marca text not null,
  codigo text,
  presentacion text not null,
  empaque text not null,
  cantidad numeric(12,2) not null check (cantidad > 0),
  unidad text not null,
  categoria text not null
) on commit drop;

insert into utiles_compartidos_importacion
  (referencia, producto, marca, codigo, presentacion, empaque, cantidad, unidad, categoria)
values
  (1, 'Crayones de cera Jumbo (Wax Crayons)', 'DOMS', null,
   'Caja 12 + 1 (12 colores + 1 plateado)', '70 cajas', 70, 'caja', 'Útiles y escritura'),
  (2, 'Crayones de cera Maxi (Cera Maxi)', 'Giotto (Fila)', null,
   'Caja de 12 colores (Super lavable, Ø 11,5 mm)', '70 cajas', 70, 'caja', 'Útiles y escritura'),
  (3, 'Cola Fría Escolar Lavable (120 g)', 'Artel', null,
   'Cajas display de 12 unidades c/u', '6 cajas', 72, 'unidad', 'Pegamentos y adhesivos'),
  (4, 'Papel Fotocopia / Multiuso Carta (75 g/m²)', 'Equalit', null,
   'Resma de 500 hojas (216 x 279 mm)', '10 resmas', 10, 'resma', 'Papelería y cartulinas'),
  (5, 'Marcadores Gruesos Lavables (Punta gruesa)', 'ADIX (School)', null,
   'Estuche / Pack de 12 colores', '62 estuches', 62, 'estuche', 'Útiles y escritura'),
  (6, 'Lápices de Colores Hexagonales (12 colores)', 'ADIX', 'A605019',
   'Cajas de 12 sets c/u + unidades sueltas', '17 cajas + 14 sueltos', 218, 'set', 'Útiles y escritura'),
  (7, 'Lápices de Colores Hexagonales + 2 Grafitos', 'Monami', 'ALCO125010',
   'Cajas de 12 sets c/u (12 colores + 2 HB)', '9 cajas + 12 sueltos', 120, 'set', 'Útiles y escritura'),
  (8, 'Lápices de Color Largos + 2 Grafitos', 'Proarte', '18893-K',
   'Cajas de 24 sets c/u (12 colores + 2 HB) + sueltos', '29 cajas + 41 sueltos', 737, 'set', 'Útiles y escritura'),
  (9, 'Lápices de Colores + 2 Grafitos + Sacapuntas', 'Proarte Color', null,
   'Blister 15 unid. (12 colores + 2 grafitos + sacapuntas c/depósito)',
   '41 sueltos', 41, 'set', 'Útiles y escritura'),
  (10, 'Ecolápices de Grafito Triangular (1205 MAX, HB)', 'Faber-Castell', '1205 MAX',
   'Caja de 12 unidades triangulares', '24 cajas', 288, 'lapiz', 'Útiles y escritura'),
  (11, 'Lápices Bicolor Grueso (Mina 5 mm)', 'Proarte Color', null,
   'Caja de 12 unidades hexagonales', '6 cajas', 72, 'lapiz', 'Útiles y escritura'),
  (12, 'Ecolápices de Color + 3 Grafitos (15 unidades)', 'Faber-Castell', null,
   'Pack blister (12 colores + 3 grafitos)', '24 packs', 24, 'pack', 'Útiles y escritura'),
  (13, 'Lápices de Colores Gruesos (Giotto Mega)', 'Giotto (Fila)', 'F225600',
   'Caja de 12 colores (mina gruesa Ø 5,5 mm)', '24 cajas', 24, 'caja', 'Útiles y escritura'),
  (14, 'Lápices de Colores (Giotto Colors 3.0)', 'Giotto (Fila)', null,
   'Caja de 24 colores mina resistente', '25 cajas', 25, 'caja', 'Útiles y escritura'),
  (15, 'Marcadores 12 Colores', 'SELLO SCHOOL', 'AETM125001',
   'Estuche de 12 marcadores no tóxico', '19 estuches', 19, 'estuche', 'Útiles y escritura'),
  (16, 'Plumones / Marcadores Fiesta (12 colores)', 'Faber-Castell', null,
   'Estuche de 12 piezas lavable', '18 estuches', 18, 'estuche', 'Útiles y escritura'),
  (17, 'Marcadores 12 Colores (base de agua)', 'Artel', null,
   'Estuche de 12 unidades con canal respiratorio', '13 estuches', 13, 'estuche', 'Útiles y escritura'),
  (18, 'Plumones Punta Delgada (12 colores)', 'Proarte Color', null,
   'Estuche / bolsa de 12 unidades', '21 estuches', 21, 'estuche', 'Útiles y escritura'),
  (19, 'Ecolápices de Grafito (14 unid., N° 2 = HB)', 'Faber-Castell', null,
   'Caja de 14 lápices (12 + 2 gratis, redondos)', '32 cajas', 448, 'lapiz', 'Útiles y escritura'),
  (20, 'Lápices de Grafito Sin Goma (N° 2 HB)', 'Artel', null,
   'Caja de 12 lápices cuerpo hexagonal', '7 cajas', 84, 'lapiz', 'Útiles y escritura'),
  (21, 'Ecolápices de Grafito Hexagonal (1205 MAX, HB)', 'Faber-Castell', '1205 MAX',
   'Caja de 12 lápices hexagonales', '2 cajas', 24, 'lapiz', 'Útiles y escritura'),
  (22, 'Lápices de Colores (12 colores)', 'Artel', null,
   'Caja de 12 colores Calidad Premium', '82 cajas', 82, 'caja', 'Útiles y escritura');

-- Un producto local con el mismo nombre volvería ambigua la selección en la
-- app. Se detiene la importación completa para revisar ese caso manualmente.
do $$
begin
  if (select count(*) from utiles_compartidos_importacion) <> 22 then
    raise exception 'La importación debe contener 22 productos';
  end if;
  if exists (
    select 1 from public.inventario_items i
    join utiles_compartidos_importacion d
      on lower(btrim(i.nombre)) = lower(btrim(d.producto))
    where i.sede_id in ('gambino', 'vascongados')
  ) then
    raise exception 'Ya existe un producto de este listado. Revisa los duplicados antes de importar el stock compartido';
  end if;
end;
$$;

insert into public.inventario_items
  (sede_id, categoria_id, nombre, descripcion, unidad, stock_minimo, compartido)
select
  'gambino', c.id, d.producto,
  'Marca: ' || d.marca
    || coalesce(' · Código: ' || d.codigo, '')
    || ' · Presentación: ' || d.presentacion
    || ' · Empaque: ' || d.empaque
    || ' · Ref. listado: ' || d.referencia,
  d.unidad, 0, true
from utiles_compartidos_importacion d
-- El catálogo remoto conserva nombres sin tildes de una migración anterior.
-- Se compara el nombre normalizado para funcionar también en bases nuevas.
join public.inventario_categorias c
  on lower(translate(c.nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'))
   = lower(translate(d.categoria, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'));

insert into public.inventario_movimientos
  (item_id, tipo, cantidad, motivo, observaciones)
select i.id, 'ingreso', d.cantidad,
  'Conteo inicial de útiles compartidos por ambas escuelas',
  'Ref. listado: ' || d.referencia || ' · Empaque: ' || d.empaque
from public.inventario_items i
join utiles_compartidos_importacion d on d.producto = i.nombre
where i.sede_id = 'gambino' and i.compartido;

do $$
begin
  if (select count(*) from public.inventario_items
      where compartido and nombre in
        (select producto from utiles_compartidos_importacion)) <> 22 then
    raise exception 'No se crearon los 22 productos compartidos';
  end if;
  if exists (
    select 1 from utiles_compartidos_importacion d
    join public.inventario_items i on i.nombre = d.producto
    where i.sede_id = 'gambino' and i.stock_actual <> d.cantidad
  ) then
    raise exception 'El stock inicial no coincide con las cantidades del listado';
  end if;
end;
$$;

commit;
