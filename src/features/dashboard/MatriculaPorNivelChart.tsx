import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

export interface BarraNivel {
  name: string;
  alumnos: number;
  color: string;
}

/**
 * El gráfico de matrícula por nivel, en su propio archivo por una razón de
 * peso: `recharts` son ~400 KB que antes viajaban en el bundle común y bajaba
 * todo el personal — incluida la persona de aseo, que entra a pedir cloro y
 * nunca ve un gráfico.
 *
 * Al vivir acá, quien lo importa lo hace con `lazy()` y el chunk se descarga
 * solo cuando alguien abre una pantalla que efectivamente muestra un gráfico.
 * Es el mismo tratamiento que ya tenía el generador de PDF.
 */
export default function MatriculaPorNivelChart({ data }: { data: BarraNivel[] }) {
  return (
    <ResponsiveContainer width="100%" height={300} minWidth={0}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="name" axisLine={false} tickLine={false}
          tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }} dy={10}
        />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.02)' }}
          contentStyle={{
            borderRadius: '16px', border: 'none',
            boxShadow: 'var(--shadow-lg)', padding: '12px',
          }}
        />
        <Bar dataKey="alumnos" radius={[8, 8, 0, 0]} barSize={50}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
