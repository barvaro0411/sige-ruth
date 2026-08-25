import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { formatDateTime } from '../../utils/dates';

// Configuramos una fuente corporativa/profesional (Opcional, pero recomendado para Enterprise Grade)
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf',
});

Font.register({
  family: 'Roboto-Bold',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
});

// Estilos corporativos del documento
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Roboto',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#1B2A4A',
    paddingBottom: 15,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  titleLogo: {
    fontSize: 22,
    fontFamily: 'Roboto-Bold',
    color: '#1B2A4A',
  },
  subtitleRoot: {
    fontSize: 10,
    color: '#64748b',
  },
  titleDoc: {
    fontSize: 14,
    fontFamily: 'Roboto-Bold',
    textTransform: 'uppercase',
    marginTop: 5,
  },
  sectionInfo: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Roboto-Bold',
    backgroundColor: '#f1f5f9',
    padding: '4px 8px',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'column',
    gap: 8,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  label: {
    width: 140,
    fontFamily: 'Roboto-Bold',
    color: '#475569',
  },
  value: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  signaturesBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  signatureLine: {
    width: 200,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    textAlign: 'center',
    paddingTop: 5,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  checkbox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: '#64748b',
    marginRight: 6,
  }
});

// Componente del Documento de Matrícula
export function MatriculaDocument({ estudiante, sede }) {
  const currentDate = new Date().toLocaleDateString('es-CL');
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ENCABEZADO */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.titleLogo}>Escuela de Lenguaje Ruth</Text>
            <Text style={styles.subtitleRoot}>Sede {sede.nombre} — RBD: {sede.id === 'gambino' ? '12345-6' : '65432-1'}</Text>
          </View>
          <View style={styles.headerRight}>
             <Text style={styles.subtitleRoot}>Fecha: {currentDate}</Text>
             <Text style={styles.titleDoc}>Ficha de Matrícula</Text>
          </View>
        </View>

        {/* DATOS DEL ESTUDIANTE */}
        <View style={styles.sectionInfo}>
          <Text style={styles.sectionTitle}>I. Identificación del Estudiante</Text>
          <View style={styles.grid}>
            <View style={styles.row}>
              <Text style={styles.label}>Nombre Completo:</Text>
              <Text style={styles.value}>{estudiante.nombre} {estudiante.apellidoPaterno} {estudiante.apellidoMaterno}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>RUT:</Text>
              <Text style={styles.value}>{estudiante.rut}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Fecha de Nacimiento:</Text>
              <Text style={styles.value}>{new Date(estudiante.fechaNacimiento).toLocaleDateString('es-CL')}</Text>
            </View>
          </View>
        </View>

        {/* DATOS ESCOLARES Y CLÍNICOS */}
        <View style={styles.sectionInfo}>
          <Text style={styles.sectionTitle}>II. Antecedentes Pedagógicos</Text>
          <View style={styles.grid}>
            <View style={styles.row}>
              <Text style={styles.label}>Nivel Asignado:</Text>
              <Text style={styles.value}>{estudiante.nivel}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Jornada:</Text>
              <Text style={styles.value}>{estudiante.jornada}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Diagnóstico (TEL):</Text>
              <Text style={styles.value}>{estudiante.diagnostico}</Text>
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <Text style={styles.label}>Evaluaciones Anexas:</Text>
              <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
                <View style={styles.checkboxRow}>
                  <View style={[styles.checkbox, estudiante.anamnesis && { backgroundColor: '#1e293b' }]} />
                  <Text>Anamnesis</Text>
                </View>
                <View style={styles.checkboxRow}>
                   <View style={[styles.checkbox, estudiante.pruebaInicial && { backgroundColor: '#1e293b' }]} />
                  <Text>Prueba Inicial Fono.</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* DATOS DEL APODERADO */}
        <View style={styles.sectionInfo}>
           <Text style={styles.sectionTitle}>III. Identificación del Apoderado</Text>
           <View style={styles.grid}>
            <View style={styles.row}>
              <Text style={styles.label}>Nombre Apoderado:</Text>
              <Text style={styles.value}>{estudiante.nombreApoderado || 'No Registrado'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Teléfono de Contacto:</Text>
              <Text style={styles.value}>{estudiante.telefonoApoderado || 'No Registrado'}</Text>
            </View>
           </View>
        </View>

        {/* DECLARACIÓN JURADA */}
        <View style={[styles.sectionInfo, { marginTop: 20 }]}>
          <Text style={{ fontSize: 10, textAlign: 'justify', color: '#475569' }}>
            El apoderado firmante declara que la información proporcionada es fidedigna y autoriza a la {sede.nombre} a mantener y procesar estos 
            datos con fines estrictamente referidos al proceso educativo y requerimientos formales del Ministerio de Educación.
          </Text>
        </View>

        {/* FIRMAS */}
        <View style={styles.signaturesBox}>
           <View>
             <Text style={styles.signatureLine}>Firma Apoderado</Text>
           </View>
           <View>
             <Text style={styles.signatureLine}>Firma Director / Encargado</Text>
           </View>
        </View>

        {/* FOOTER AUTOMÁTICO */}
        <Text style={styles.footer} fixed>
          Documento generado digitalmente por SIGE Ruth v6.0 el {formatDateTime(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  );
}
