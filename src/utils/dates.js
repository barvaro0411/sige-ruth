export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateLong(date) {
  const d = new Date(date);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function getToday() {
  return new Date().toISOString().split('T')[0];
}

export function getTodayLabel() {
  const d = new Date();
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

export function getMonthName(monthIndex) {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return months[monthIndex];
}

export function getSchoolDaysInMonth(year, month) {
  const days = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(date.toISOString().split('T')[0]);
    }
  }
  return days;
}

export function getDaysInRange(startDate, endDate) {
  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function getUnidadTematica(month) {
  const unidades = {
    2: 'Yo y mi Escuela',
    3: 'Mi Familia', 
    4: 'Mi Barrio',
    5: 'Los Animales',
    6: 'Mi País',
    7: 'El Medio Ambiente',
    8: 'Las Profesiones',
    9: 'La Primavera',
    10: 'La Navidad y Cierre',
    11: 'Cierre Año Escolar'
  };
  return unidades[month] || 'Sin unidad asignada';
}
