import { useEffect, useState } from "react";
import {
  Users,
  Scissors,
  UserPlus,
  Plus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import Loading from "../components/ui/Loading";
import {
  getUsers,
  createUser,
  toggleUserActive,
  getServices,
  createService,
  getProfessionals,
  createProfessional,
} from "../api/endpoints";
import type { User, Service, Professional } from "../types";

type Tab = "users" | "services" | "professionals";

const roleIcons: Record<string, React.ElementType> = {
  admin: ShieldAlert,
  professional: ShieldCheck,
  client: Shield,
};

const roleBg: Record<string, string> = {
  admin: "bg-purple-500/15 text-purple-400",
  professional: "bg-blue-500/15 text-blue-400",
  client: "bg-slate-500/15 text-slate-400",
};

export default function Admin() {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    Promise.all([getUsers(), getServices(), getProfessionals()]).then(
      ([u, s, p]) => {
        setUsers(u || []);
        setServices(s || []);
        setProfessionals(p || []);
        setLoading(false);
      },
    );
  }, []);

  // ── Create User ──
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "client",
  });

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) return;
    const result = await createUser(newUser);
    if (result) {
      const updated = await getUsers();
      setUsers(updated || []);
      setNewUser({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "client",
      });
      setShowForm(false);
    } else {
      alert(
        "Email já cadastrado no sistema (pode ter sido criado pelo agendamento público).",
      );
    }
  };

  // ── Create Service ──
  const [newService, setNewService] = useState({
    name: "",
    duration_min: 30,
    price: 0,
    description: "",
  });

  const handleCreateService = async () => {
    if (!newService.name || !newService.price) return;
    const result = await createService(newService);
    if (result) {
      const updated = await getServices();
      setServices(updated || []);
      setNewService({ name: "", duration_min: 30, price: 0, description: "" });
      setShowForm(false);
    }
  };

  // ── Create Professional ──
  const [newProf, setNewProf] = useState({
    user_id: 0,
    specialty: "",
    bio: "",
    work_start: "09:00",
    work_end: "18:00",
    work_days: "1,2,3,4,5,6",
  });

  const handleCreateProf = async () => {
    if (!newProf.user_id) return;
    const result = await createProfessional({
      ...newProf,
      work_start: newProf.work_start + ":00",
      work_end: newProf.work_end + ":00",
    });
    if (result) {
      const updated = await getProfessionals();
      setProfessionals(updated || []);
      setNewProf({
        user_id: 0,
        specialty: "",
        bio: "",
        work_start: "09:00",
        work_end: "18:00",
        work_days: "1,2,3,4,5,6",
      });
      setShowForm(false);
    } else {
      alert("Erro ao criar profissional. Usuário pode já ser profissional.");
    }
  };

  const handleToggle = async (id: number) => {
    await toggleUserActive(id);
    const updated = await getUsers();
    setUsers(updated || []);
  };

  // Users que têm role=professional mas NÃO estão na tabela professionals
  const profUserIds = professionals.map((p) => p.user_id);
  const availableProfUsers = users.filter(
    (u) => u.role === "professional" && !profUserIds.includes(u.id),
  );

  if (loading) return <Loading />;

  const tabs: {
    id: Tab;
    label: string;
    icon: React.ElementType;
    count: number;
  }[] = [
    { id: "users", label: "Usuários", icon: Users, count: users.length },
    {
      id: "services",
      label: "Serviços",
      icon: Scissors,
      count: services.length,
    },
    {
      id: "professionals",
      label: "Profissionais",
      icon: ShieldCheck,
      count: professionals.length,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-emerald-500" />
            Admin
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerenciar usuários, serviços e profissionais
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          Novo
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setShowForm(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                tab === t.id
                  ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800/50 text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-lg">
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Form Novo Usuário ── */}
      {showForm && tab === "users" && (
        <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-400" /> Novo Usuário
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Nome"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <input
              placeholder="Email"
              type="email"
              value={newUser.email}
              onChange={(e) =>
                setNewUser({ ...newUser, email: e.target.value })
              }
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <input
              placeholder="Telefone"
              value={newUser.phone}
              onChange={(e) =>
                setNewUser({ ...newUser, phone: e.target.value })
              }
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <input
              placeholder="Senha"
              type="password"
              value={newUser.password}
              onChange={(e) =>
                setNewUser({ ...newUser, password: e.target.value })
              }
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            >
              <option value="client">Cliente</option>
              <option value="professional">Profissional</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleCreateUser}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl transition"
            >
              Criar Usuário
            </button>
          </div>
        </div>
      )}

      {/* ── Form Novo Serviço ── */}
      {showForm && tab === "services" && (
        <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-emerald-400" /> Novo Serviço
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Nome do serviço"
              value={newService.name}
              onChange={(e) =>
                setNewService({ ...newService, name: e.target.value })
              }
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <input
              placeholder="Preço (R$)"
              type="number"
              step="0.01"
              value={newService.price || ""}
              onChange={(e) =>
                setNewService({
                  ...newService,
                  price: parseFloat(e.target.value) || 0,
                })
              }
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <input
              placeholder="Duração (min)"
              type="number"
              value={newService.duration_min}
              onChange={(e) =>
                setNewService({
                  ...newService,
                  duration_min: parseInt(e.target.value) || 30,
                })
              }
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <input
              placeholder="Descrição"
              value={newService.description}
              onChange={(e) =>
                setNewService({ ...newService, description: e.target.value })
              }
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={handleCreateService}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl transition sm:col-span-2"
            >
              Criar Serviço
            </button>
          </div>
        </div>
      )}

      {/* ── Form Novo Profissional ── */}
      {showForm && tab === "professionals" && (
        <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Novo
            Profissional
          </h3>
          {availableProfUsers.length === 0 ? (
            <p className="text-slate-400 text-sm">
              Nenhum usuário com role "professional" disponível. Crie um usuário
              com role profissional primeiro.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={newProf.user_id}
                onChange={(e) =>
                  setNewProf({ ...newProf, user_id: parseInt(e.target.value) })
                }
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value={0}>Selecione o usuário</option>
                {availableProfUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <input
                placeholder="Especialidade"
                value={newProf.specialty}
                onChange={(e) =>
                  setNewProf({ ...newProf, specialty: e.target.value })
                }
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <input
                placeholder="Bio"
                value={newProf.bio}
                onChange={(e) =>
                  setNewProf({ ...newProf, bio: e.target.value })
                }
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <input
                placeholder="Dias (1,2,3,4,5,6)"
                value={newProf.work_days}
                onChange={(e) =>
                  setNewProf({ ...newProf, work_days: e.target.value })
                }
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="time"
                value={newProf.work_start}
                onChange={(e) =>
                  setNewProf({ ...newProf, work_start: e.target.value })
                }
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="time"
                value={newProf.work_end}
                onChange={(e) =>
                  setNewProf({ ...newProf, work_end: e.target.value })
                }
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <button
                onClick={handleCreateProf}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl transition sm:col-span-2"
              >
                Criar Profissional
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Usuários ── */}
      {tab === "users" && (
        <div className="space-y-2">
          {users.map((u) => {
            const RoleIcon = roleIcons[u.role] || Shield;
            return (
              <div
                key={u.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white font-bold text-sm">
                  {u.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm truncate">
                      {u.name}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-lg flex items-center gap-1 ${roleBg[u.role]}`}
                    >
                      <RoleIcon className="w-3 h-3" /> {u.role}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs truncate">
                    {u.email} {u.phone && `• ${u.phone}`}
                  </p>
                </div>
                <button
                  onClick={() => handleToggle(u.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition"
                  title={u.is_active ? "Desativar" : "Ativar"}
                >
                  {u.is_active ? (
                    <>
                      <ToggleRight className="w-5 h-5 text-emerald-400" />
                      <span className="text-emerald-400">Ativo</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-5 h-5 text-red-400" />
                      <span className="text-red-400">Inativo</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Serviços ── */}
      {tab === "services" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-medium">{svc.name}</p>
                <span className="text-emerald-400 font-bold">
                  R$ {Number(svc.price).toFixed(2)}
                </span>
              </div>
              <p className="text-slate-500 text-xs mb-2">
                {svc.description || "Sem descrição"}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>⏱ {svc.duration_min} min</span>
                <span
                  className={
                    svc.is_active ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {svc.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Profissionais ── */}
      {tab === "professionals" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {professionals.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center text-emerald-400 font-bold">
                  {p.user_name?.charAt(0) || "?"}
                </div>
                <div>
                  <p className="text-white font-medium">{p.user_name}</p>
                  <p className="text-emerald-400 text-xs">
                    {p.specialty || "Sem especialidade"}
                  </p>
                </div>
              </div>
              <p className="text-slate-500 text-xs mb-2">
                {p.bio || "Sem bio"}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>
                  🕐 {p.work_start?.slice(0, 5)} - {p.work_end?.slice(0, 5)}
                </span>
                <span
                  className={p.is_active ? "text-emerald-400" : "text-red-400"}
                >
                  {p.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
