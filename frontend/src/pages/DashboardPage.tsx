import { useAuth } from '../auth/useAuth';

export default function DashboardPage() {

  const { user } = useAuth();

  return (

    <div>

      <h1
        style={{
          fontSize: 28,
          marginBottom: 20
        }}
      >
        Bienvenido, {user?.first_name}
      </h1>

      <p
        style={{
          color: '#6b7280',
          marginBottom: 30
        }}
      >
        Panel principal del sistema hospitalario
      </p>

      {/* CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20
        }}
      >

        <Card
          title="Usuarios"
          value="12"
          color="#3c9ec2"
        />

        <Card
          title="Pacientes"
          value="48"
          color="#1f6e29"
        />

        <Card
          title="Turnos"
          value="23"
          color="#8a1616"
        />

        <Card
          title="Médicos"
          value="8"
          color="#3c9ec2"
        />

      </div>

    </div>
  );
}

function Card({
  title,
  value,
  color
}: {
  title: string;
  value: string;
  color: string;
}) {

  return (

    <div
      style={{
        background: 'white',
        padding: 20,
        borderRadius: 12,
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
        borderLeft: `5px solid ${color}`
      }}
    >

      <h3
        style={{
          marginBottom: 10,
          color: '#6b7280'
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: 28,
          fontWeight: 'bold'
        }}
      >
        {value}
      </p>

    </div>
  );
}