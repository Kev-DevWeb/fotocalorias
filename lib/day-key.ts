/**
 * Clave del día (`AAAA-MM-DD`) de los documentos de hidratación y actividad,
 * según la fecha local del dispositivo.
 *
 * Hasta el 11/10/2026 se usaba la fecha en UTC, así que en México el día
 * cambiaba a las 6 pm. Los documentos anteriores no se movieron: lo que se
 * registró después de esa hora quedó en el documento del día siguiente.
 */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
