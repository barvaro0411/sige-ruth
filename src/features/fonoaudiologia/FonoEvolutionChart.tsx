import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Radar, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

interface Props {
  data: any[];
}

export default function FonoEvolutionChart({ data }: Props) {
  const chartData = useMemo(() => {
    return data.map(s => ({
      fecha: new Date(s.fecha).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' }),
      fonetico: s.nivel_fonetico,
      semantico: s.nivel_semantico,
      morfosintactico: s.nivel_morfosintactico,
      pragmatico: s.nivel_pragmatico,
    })).reverse();
  }, [data]);

  const latestStats = useMemo(() => {
    if (data.length === 0) return [];
    const last = data[0];
    return [
      { subject: 'Fonético', A: last.nivel_fonetico, fullMark: 3 },
      { subject: 'Semántico', A: last.nivel_semantico, fullMark: 3 },
      { subject: 'Morfosintáctico', A: last.nivel_morfosintactico, fullMark: 3 },
      { subject: 'Pragmático', A: last.nivel_pragmatico, fullMark: 3 },
    ];
  }, [data]);

  if (data.length === 0) {
    return <div className="text-center p-10 text-muted">Sin datos de evolución para este alumno.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
        {/* Line Chart for History */}
        <div className="card p-4">
          <h4 className="mb-4 text-base">Historial de Avance</h4>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="fonetico" stroke="#3B82F6" strokeWidth={2} name="Fonético" />
                <Line type="monotone" dataKey="semantico" stroke="#10B981" strokeWidth={2} name="Semántico" />
                <Line type="monotone" dataKey="morfosintactico" stroke="#F59E0B" strokeWidth={2} name="Morfosintáctico" />
                <Line type="monotone" dataKey="pragmatico" stroke="#8B5CF6" strokeWidth={2} name="Pragmático" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart for Current Status */}
        <div className="card p-4">
          <h4 className="mb-4 text-base">Estado Actual</h4>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={latestStats}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                <PolarRadiusAxis angle={30} domain={[0, 3]} tick={false} />
                <Radar
                  name="Nivel"
                  dataKey="A"
                  stroke="var(--color-gold)"
                  fill="var(--color-gold)"
                  fillOpacity={0.5}
 />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-4 gap-3 bg-subtle p-4 rounded-md">
        <div className="text-center">
          <div className="text-xs text-muted font-semibold">FONÉTICO</div>
          <div style={{ fontWeight: 800, color: '#3B82F6' }}>{data[0].nivel_fonetico}/3</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted font-semibold">SEMÁNTICO</div>
          <div style={{ fontWeight: 800, color: '#10B981' }}>{data[0].nivel_semantico}/3</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted font-semibold">MORFOSINTÁCTICO</div>
          <div style={{ fontWeight: 800, color: '#F59E0B' }}>{data[0].nivel_morfosintactico}/3</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted font-semibold">PRAGMÁTICO</div>
          <div style={{ fontWeight: 800, color: '#8B5CF6' }}>{data[0].nivel_pragmatico}/3</div>
        </div>
      </div>
    </div>
  );
}
