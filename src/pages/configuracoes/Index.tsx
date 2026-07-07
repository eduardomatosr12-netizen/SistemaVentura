import { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, X, ShieldAlert, Trash2,
  Save, CheckCircle2,
  User, UserCircle,
  RefreshCw, Users,
  AlertCircle, MessageCircle
} from 'lucide-react';
import { doc, onSnapshot, setDoc, collection, addDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { generateUUID } from '../../lib/uuid';
import { useNavigate, Link } from 'react-router-dom';

interface Employee {
  id: string;
  name: string;
  role: 'tecnico' | 'motorista' | 'decorador' | 'administrativo';
  createdAt: string;
}

type ModalType = 'perfil' | 'equipe';



const Configuracoes = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const [activeModal, setActiveModal] = useState<ModalType | 'delete' | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const [profileData, setProfileData] = useState({ name: '', email: '', phone: '', avatar: '' });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  const [newEmployee, setNewEmployee] = useState({
    name: '',
    role: 'tecnico' as 'tecnico' | 'motorista' | 'decorador' | 'administrativo',
  });

  useEffect(() => {
    if (!user?.id) return;

    const unsubProfile = onSnapshot(doc(db, 'profiles', user.id), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setProfileData({
          name: data.nome || '',
          email: user.email || '',
          phone: data.telefone || '',
          avatar: data.avatar || ''
        });
        if (data.avatar) {
          setAvatarPreview(data.avatar);
        }
      }
    }, err => console.warn('[CONFIG] Erro ao carregar perfil:', err));

    setIsLoadingEmployees(true);
    const q = query(collection(db, 'employees'), orderBy('createdAt', 'asc'));
    const unsubEmployees = onSnapshot(q, snapshot => {
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
      setIsLoadingEmployees(false);
    }, err => {
      console.warn('[CONFIG] Erro ao carregar funcionários:', err);
      setIsLoadingEmployees(false);
    });

    return () => {
      unsubProfile();
      unsubEmployees();
    };
  }, [user?.id]);

  const handleAddEmployee = async () => {
    if (!newEmployee.name.trim()) {
      setInviteError('Preencha o nome do funcionário');
      return;
    }

    if (!user?.id) {
      setInviteError('Usuário não autenticado. Faça logout e login novamente.');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'employees'), {
        name: newEmployee.name.trim(),
        role: newEmployee.role,
        createdAt: Timestamp.now(),
      });
      setEmployees(prev => [...prev, { id: docRef.id, name: newEmployee.name.trim(), role: newEmployee.role, createdAt: new Date().toISOString() }]);
    } catch (err) {
      console.error('[CONFIG] Erro ao adicionar funcionário:', err);
      setInviteError('Erro ao adicionar funcionário');
      return;
    }

    setNewEmployee({ name: '', role: 'tecnico' });
    setInviteSuccess('Membro adicionado com sucesso');
    setInviteError('');
    setTimeout(() => {
      setInviteSuccess('');
      setActiveModal(null);
    }, 1500);
  };

  const handleRemoveEmployee = async (id: string) => {
    if (!confirm('Remover funcionário?')) return;

    try {
      await deleteDoc(doc(db, 'employees', id));
    } catch (err) {
      console.error('[CONFIG] Erro ao remover funcionário:', err);
    }

    setEmployees(prev => prev.filter(emp => emp.id !== id));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      setProfileError('Usuário não autenticado');
      return;
    }
    if (!profileData.name.trim()) {
      setProfileError('Nome não pode ser vazio');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (profileData.email && profileData.email.trim() && !emailRegex.test(profileData.email.trim())) {
      setProfileError('Email profissional inválido');
      return;
    }
    
    setIsSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');
    
    const finalAvatar = avatarPreview || profileData.avatar;

    try {
      await setDoc(doc(db, 'profiles', user.id), {
        nome: profileData.name.trim(),
        telefone: profileData.phone.trim(),
        email: profileData.email.trim(),
        avatar: finalAvatar,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch (err) {
      console.error('[CONFIG] Erro ao salvar perfil:', err);
      setProfileError('Erro ao salvar perfil');
      setIsSavingProfile(false);
      return;
    }

    setProfileSuccess('Perfil atualizado com sucesso!');
    setProfileData(prev => ({ ...prev, avatar: finalAvatar, email: profileData.email.trim() || prev.email }));
    setTimeout(() => {
      setProfileSuccess('');
      setActiveModal(null);
    }, 1500);
    setIsSavingProfile(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/png'];
    const maxSize = 2 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      setProfileError('Apenas arquivos PNG ou JPG são aceitos.');
      return;
    }

    if (file.size > maxSize) {
      setProfileError('A imagem deve ter no máximo 2MB.');
      return;
    }
    
    setIsUploadingAvatar(true);
    setProfileError('');
    
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsDataURL(file);
      });
      setAvatarPreview(base64);
      setProfileSuccess('Avatar carregado! Clique em Salvar para confirmar.');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch {
      setProfileError('Erro ao processar a imagem. Tente novamente.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmationText !== 'DELETE') return;
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    logout();
    navigate('/login');
  };

  const sections = [
    { id: 'perfil' as ModalType, icon: User, title: 'Perfil', description: 'Gerencie nome, email e foto de perfil', items: ['Nome', 'Email', 'Foto de perfil'] },
    { id: 'equipe' as ModalType, icon: Users, title: 'Equipe', description: 'Convidar membros e gerenciar acessos', items: ['Convidar', 'Permissões', 'Membros'] },
  ];

  return (
    <div className="min-h-screen pb-20 relative">
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-[#ffffff] tracking-tighter mb-1">Configurações</h1>
          <p className="text-[#aaaaaa] text-sm font-medium">Controle central de perfil e preferências.</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-[#111111] border border-[#222222] rounded-3xl p-8 hover:border-[#b5ff03] transition-all group relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-[#1a1a1a] transition-colors">
                    <Icon className="w-8 h-8 text-[#b5ff03] group-hover:text-[#b5ff03] transition-colors" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-black text-[#ffffff] text-lg tracking-tight">{section.title}</h3>
                    <p className="text-xs text-[#aaaaaa] font-bold uppercase tracking-widest mt-1">{section.description}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveModal(section.id)}
                  className="bg-[#b5ff03] text-black font-bold px-6 py-3 rounded-md text-[11px] uppercase tracking-widest hover:bg-[#b5ff03]/90 transition-all active:scale-[0.95] shadow-lg shadow-black/10"
                >
                  Configurar
                </button>
              </div>
              <div className="flex gap-2 flex-wrap mt-8 pt-8 border-t border-[#222222]">
                {section.items.map((item, itemIdx) => (
                  <span key={itemIdx} className="px-4 py-2 bg-[#111111] text-[#aaaaaa] text-[10px] font-black uppercase tracking-[1.5px] rounded-md border border-[#222222]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* WhatsApp Templates card */}
      <div className="mt-6 max-w-2xl">
        <Link
          to="/configuracoes/templates-whatsapp"
          className="block bg-[#111111] border border-[#222222] rounded-3xl p-8 hover:border-[#b5ff03] transition-all group relative overflow-hidden"
        >
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-[#1a1a1a] transition-colors">
                <MessageCircle className="w-8 h-8 text-[#b5ff03] group-hover:text-[#b5ff03] transition-colors" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-black text-[#ffffff] text-lg tracking-tight">Templates WhatsApp</h3>
                <p className="text-xs text-[#aaaaaa] font-bold uppercase tracking-widest mt-1">Crie e gerencie modelos de mensagens para envio rápido</p>
              </div>
            </div>
            <span className="bg-[#b5ff03] text-black font-bold px-6 py-3 rounded-md text-[11px] uppercase tracking-widest hover:bg-[#b5ff03]/90 transition-all active:scale-[0.95] shadow-lg shadow-black/10">
              Gerenciar
            </span>
          </div>
        </Link>
      </div>

      <div className="mt-12 max-w-2xl border-2 border-red-50 bg-red-50/20 rounded-[40px] p-10 relative overflow-hidden group/danger">
        <div className="absolute -right-10 -bottom-10 opacity-5 group-hover/danger:opacity-10 transition-opacity">
          <ShieldAlert size={240} className="text-red-500" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="text-red-600" size={24} />
            <h3 className="font-black text-red-600 uppercase tracking-widest text-sm">Zona de Perigo</h3>
          </div>
          <p className="text-sm text-neutral-500 font-bold leading-relaxed mb-8 max-w-md">Estas ações são irreversíveis e deletarão todos os seus dados e Orçamentos permanentemente.</p>
          <button 
            onClick={() => setActiveModal('delete')}
            className="text-[11px] font-black uppercase tracking-[2px] bg-white border-2 border-red-100 text-red-600 px-10 py-4 rounded-2xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-xl shadow-red-100/50 active:scale-[0.98]"
          >
            Deletar Conta Permanentemente
          </button>
        </div>
      </div>

      {activeModal && activeModal !== 'delete' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden transform animate-in slide-in-from-bottom-8 duration-500">
            {activeModal === 'perfil' ? (
              <form onSubmit={handleSaveProfile}>
                <div className="px-4 md:px-12 py-10 border-b border-[#222222] flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-[#aaaaaa] uppercase tracking-[3px] mb-3 block">Preferências do Sistema</span>
                    <h2 className="text-4xl font-black text-white tracking-tighter">Configurações de Perfil</h2>
                  </div>
                  <button type="button" onClick={() => { setActiveModal(null); setProfileError(''); setProfileSuccess(''); }} className="p-3 hover:bg-[#111111] rounded-2xl transition-colors text-[#aaaaaa] hover:text-white border border-transparent hover:border-[#222222]">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-4 md:p-12 space-y-4 md:space-y-10 max-h-[70vh] md:max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {profileError && (
                    <div className="p-4 bg-[#111111] border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-medium">
                      <AlertCircle size={20} />
                      {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="p-4 bg-[#111111] border border-[#B5FF03]/30 rounded-2xl flex items-center gap-3 text-[#B5FF03] text-sm font-medium">
                      <CheckCircle2 size={20} />
                      {profileSuccess}
                    </div>
                  )}
                  <div className="space-y-8">
                    <div className="flex items-center gap-8 mb-4">
                      <div className="w-24 h-24 bg-[#1a1a1a] rounded-3xl flex items-center justify-center relative group/avatar cursor-pointer overflow-hidden" onClick={() => avatarInputRef.current?.click()}>
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle size={48} className="text-white" />
                        )}
                        <div className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest text-center px-2">
                          {isUploadingAvatar ? 'Enviando...' : 'Alterar Foto'}
                        </div>
                        <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/jpg" onChange={handleAvatarUpload} className="hidden" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-black text-white text-lg">Avatar do Administrador</h4>
                        <p className="text-xs text-[#aaaaaa] font-medium">Clique para fazer upload de um novo arquivo PNG ou JPG.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-[#aaaaaa] uppercase tracking-widest ml-1">Nome Completo</label>
                        <input type="text" value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#222222] rounded-xl px-4 py-3.5 font-bold text-white placeholder-[#555555] focus:border-[#B5FF03] outline-none transition-all" placeholder="Seu nome completo" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-[#aaaaaa] uppercase tracking-widest ml-1">Email Profissional</label>
                        <input type="email" value={profileData.email} onChange={(e) => setProfileData({...profileData, email: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#222222] rounded-xl px-4 py-3.5 font-bold text-white placeholder-[#555555] focus:border-[#B5FF03] outline-none transition-all" placeholder="seu@email.com" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 md:px-12 py-10 border-t border-[#222222] flex gap-4">
                  <button type="button" onClick={() => setActiveModal(null)} className="flex-1 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest text-[#aaaaaa] hover:text-white hover:bg-[#111111] transition-all border border-transparent hover:border-[#222222]">Cancelar</button>
                  <button type="submit" disabled={isSavingProfile} className="flex-[2] py-4 rounded-[20px] bg-[#B5FF03] text-black font-black text-[11px] uppercase tracking-widest hover:bg-[#a1e600] transition-all active:scale-[0.98] flex items-center justify-center gap-3">
                    {isSavingProfile ? <><RefreshCw size={18} className="animate-spin" /> Salvando...</> : <><Save size={18} /> Salvar Perfil</>}
                  </button>
                </div>
                </form>
            ) : activeModal === 'equipe' ? (
              <div className="bg-[#000000]">
                <div className="px-4 md:px-12 py-10 border-b border-[#222222] flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-[#aaaaaa] uppercase tracking-[3px] mb-3 block">Preferências do Sistema</span>
                    <h2 className="text-4xl font-black text-white tracking-tighter">Equipe</h2>
                  </div>
                  <button type="button" onClick={() => { setActiveModal(null); setInviteError(''); setInviteSuccess(''); }} className="p-3 hover:bg-[#111111] rounded-2xl transition-colors text-[#aaaaaa] hover:text-white border border-transparent hover:border-[#222222]">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-4 md:p-12 space-y-4 md:space-y-10 max-h-[70vh] md:max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {inviteError && (
                    <div className="p-4 bg-[#111111] border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-medium">
                      <AlertCircle size={20} />
                      {inviteError}
                    </div>
                  )}
                  {inviteSuccess && (
                    <div className="p-4 bg-[#111111] border border-[#B5FF03]/30 rounded-2xl flex items-center gap-3 text-[#B5FF03] text-sm font-medium">
                      <CheckCircle2 size={20} />
                      {inviteSuccess}
                    </div>
                  )}
                  <div className="space-y-8">
                    <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1">Nome Completo</label>
                        <input type="text" value={newEmployee.name} onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})} placeholder="João Silva" className="w-full bg-[#1a1a1a] border border-[#222222] rounded-xl px-4 py-3 font-bold text-white focus:border-[#B5FF03] outline-none transition-all" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1">Cargo</label>
                        <select value={newEmployee.role} onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value as 'tecnico' | 'motorista' | 'decorador' | 'administrativo'})} className="w-full bg-[#1a1a1a] border border-[#222222] rounded-xl px-4 py-3 font-bold text-white focus:border-[#B5FF03] outline-none transition-all">
                          <option value="tecnico">Técnico</option>
                          <option value="motorista">Motorista</option>
                          <option value="decorador">Decorador</option>
                          <option value="administrativo">Administrativo</option>
                        </select>
                      </div>
                      <button type="button" onClick={handleAddEmployee} className="w-full py-4 bg-[#B5FF03] text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#a1e600] transition-all flex items-center justify-center gap-2">
                        <Users size={16} /> Adicionar Funcionário
                      </button>
                    </div>
                    {employees.length > 0 && (
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1">Funcionários Cadastrados ({employees.length})</label>
                        {employees.map((emp) => (
                          <div key={emp.id} className="p-4 bg-[#111111] border border-[#222222] rounded-xl flex items-center justify-between">
                            <div>
                              <p className="font-black text-white">{emp.name}</p>
                              <p className="text-xs text-[#aaaaaa] font-medium uppercase">Cargo: {emp.role === 'tecnico' ? 'Técnico' : emp.role === 'motorista' ? 'Motorista' : emp.role === 'decorador' ? 'Decorador' : 'Administrativo'}</p>
                            </div>
                            <button type="button" onClick={() => handleRemoveEmployee(emp.id)} className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg font-bold text-xs uppercase hover:bg-red-500/20 transition-all">
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-4 md:px-12 py-10 border-t border-[#222222]">
                  <button type="button" onClick={() => setActiveModal(null)} className="w-full py-5 rounded-[20px] font-black text-[11px] uppercase tracking-widest text-[#aaaaaa] hover:text-white hover:bg-[#111111] transition-all border border-transparent hover:border-[#222222]">Fechar</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {activeModal === 'delete' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white border-2 border-red-100 rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden p-4 md:p-12 text-center transform animate-in slide-in-from-bottom-8">
            <div className="w-24 h-24 bg-red-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 animate-bounce"><Trash2 size={48} className="text-red-600" /></div>
            <h2 className="text-4xl font-black text-black tracking-tighter mb-4">Tem certeza?</h2>
            <p className="text-neutral-500 text-sm font-bold leading-relaxed mb-10">Esta ação é irreversível e apagará todos os dados permanentemente.</p>
            <div className="space-y-8 text-left">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block text-center">Digite <span className="text-black font-black">DELETE</span> para confirmar</label>
                <input autoFocus type="text" value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} placeholder="CONFIRMAÇÃO" className="w-full bg-red-50/50 border-2 border-red-100 rounded-3xl px-8 py-5 text-center text-xl font-black text-red-600 focus:border-red-600 outline-none" />
              </div>
              <div className="flex flex-col gap-4">
                <button disabled={confirmationText !== 'DELETE' || isDeleting} onClick={handleDeleteAccount} className={`w-full py-5 rounded-[24px] font-black text-[11px] uppercase tracking-[2px] shadow-2xl transition-all flex items-center justify-center gap-3 ${confirmationText === 'DELETE' ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200' : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'}`}>{isDeleting ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : 'Deletar Conta e Dados'}</button>
                <button onClick={() => { setActiveModal(null); setConfirmationText(''); }} className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-neutral-400 hover:text-black">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracoes;